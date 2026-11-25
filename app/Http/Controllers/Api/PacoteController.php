<?php

namespace App\Http\Controllers\Api;

use App\Enums\SituacaoPacote;
use App\Enums\StatusEntregador;
use App\Exceptions\MapAddressNotFoundException;
use App\Exceptions\MapProviderException;
use App\Http\Controllers\Controller;
use App\Models\Entregador;
use App\Models\Pacote;
use App\Services\OpenStreetMapRoutingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PacoteController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json($this->withRelations()->latest('id_pacote')->paginate(15));
    }

    public function status(): JsonResponse
    {
        $counts = Pacote::query()
            ->selectRaw('situacao, COUNT(*) as quantidade')
            ->groupBy('situacao')
            ->pluck('quantidade', 'situacao');

        return response()->json([
            'data' => array_map(
                fn (SituacaoPacote $situacao): array => [
                    'situacao' => $situacao->value,
                    'quantidade' => (int) ($counts[$situacao->value] ?? 0),
                ],
                SituacaoPacote::cases(),
            ),
        ]);
    }

    public function store(Request $request, OpenStreetMapRoutingService $maps): JsonResponse
    {
        $data = $request->validate($this->rules());

        $courierId = $data['id_entregador_responsavel'] ?? null;

        if ($courierId !== null && Entregador::query()->findOrFail($courierId)->status !== StatusEntregador::Disponivel->value) {
            throw ValidationException::withMessages([
                'id_entregador_responsavel' => 'O entregador selecionado não está disponível.',
            ]);
        }

        try {
            $coordinates = $maps->geocode($data['endereco_entrega']);
        } catch (MapAddressNotFoundException $exception) {
            throw ValidationException::withMessages([
                'endereco_entrega' => $exception->getMessage(),
            ]);
        } catch (MapProviderException $exception) {
            return response()->json(['message' => $exception->getMessage()], 502);
        }

        $data['latitude'] = $coordinates['lat'];
        $data['longitude'] = $coordinates['lon'];

        $pacote = DB::transaction(function () use ($data, $courierId): Pacote {
            if ($courierId !== null) {
                $this->lockAvailableCourier($courierId);
            }

            $pacote = Pacote::create($data);
            $this->syncCourierStatuses([$courierId]);

            return $pacote;
        });

        return response()->json($this->withRelations()->findOrFail($pacote->id_pacote), 201);
    }

    public function show(int $pacote): JsonResponse
    {
        return response()->json($this->withRelations()->findOrFail($pacote));
    }

    public function update(Request $request, int $pacote, OpenStreetMapRoutingService $maps): JsonResponse
    {
        $package = Pacote::query()->findOrFail($pacote);
        $data = $request->validate($this->rules($package));

        if (isset($data['endereco_entrega']) && $data['endereco_entrega'] !== $package->endereco_entrega) {
            try {
                $coordinates = $maps->geocode($data['endereco_entrega']);
            } catch (MapAddressNotFoundException $exception) {
                throw ValidationException::withMessages([
                    'endereco_entrega' => $exception->getMessage(),
                ]);
            } catch (MapProviderException $exception) {
                return response()->json(['message' => $exception->getMessage()], 502);
            }

            $data['latitude'] = $coordinates['lat'];
            $data['longitude'] = $coordinates['lon'];
        }

        $package = DB::transaction(function () use ($data, $package): Pacote {
            $previousCourierId = $package->id_entregador_responsavel;
            $newCourierId = array_key_exists('id_entregador_responsavel', $data)
                ? $data['id_entregador_responsavel']
                : $previousCourierId;

            if ($newCourierId !== null && $newCourierId != $previousCourierId) {
                $this->lockAvailableCourier($newCourierId);
            }

            $package->fill($data)->save();
            $this->syncCourierStatuses([$previousCourierId, $newCourierId]);

            return $package;
        });

        return response()->json($this->withRelations()->findOrFail($package->id_pacote));
    }

    public function destroy(int $pacote): JsonResponse
    {
        DB::transaction(function () use ($pacote): void {
            $package = Pacote::query()->lockForUpdate()->findOrFail($pacote);
            $courierId = $package->id_entregador_responsavel;
            $package->delete();

            $this->syncCourierStatuses([$courierId]);
        });

        return response()->json(null, 204);
    }

    private function rules(?Pacote $package = null): array
    {
        $required = $package === null ? 'required' : 'sometimes|required';

        return [
            'cod_rastreio' => [
                $required,
                'string',
                'max:255',
                Rule::unique('pacotes', 'cod_rastreio')->ignore($package?->id_pacote, 'id_pacote'),
            ],
            'nome_destinatario' => [$required, 'string', 'max:255'],
            'endereco_entrega' => [$required, 'string', 'max:255'],
            'id_origem' => [$required, 'integer', 'exists:centros_logisticos,id_centro_logistico'],
            'id_entregador_responsavel' => [
                'sometimes',
                'nullable',
                'integer',
                'exists:entregadores,id_entregador',
            ],
            'situacao' => ['sometimes', 'required', Rule::enum(SituacaoPacote::class)],
            'cpf_destinatario' => [$required, 'string', 'digits:11'],
            'telefone_destinatario' => [$required, 'string', 'max:30'],
            'data_prevista' => [$required, 'date_format:Y-m-d'],
        ];
    }

    private function withRelations(): Builder
    {
        return Pacote::query()->with([
            'origem:id_centro_logistico,nome_centro',
            'entregadorResponsavel:id_entregador,nome_entregador,num_entregador,status',
        ]);
    }

    private function lockAvailableCourier(int $courierId): Entregador
    {
        $courier = Entregador::query()->lockForUpdate()->findOrFail($courierId);

        if ($courier->status !== StatusEntregador::Disponivel->value) {
            throw ValidationException::withMessages([
                'id_entregador_responsavel' => 'O entregador selecionado não está disponível.',
            ]);
        }

        return $courier;
    }

    private function syncCourierStatuses(array $courierIds): void
    {
        foreach (array_unique(array_filter($courierIds)) as $courierId) {
            $courier = Entregador::query()->find($courierId);

            if ($courier === null) {
                continue;
            }

            $hasActivePackages = $courier->pacotes()
                ->whereNotIn('situacao', [
                    SituacaoPacote::Entregue->value,
                    SituacaoPacote::Devolvido->value,
                ])
                ->exists();

            if ($hasActivePackages) {
                $courier->update(['status' => StatusEntregador::EmRota->value]);
            } elseif ($courier->status === StatusEntregador::EmRota->value) {
                $courier->update(['status' => StatusEntregador::Disponivel->value]);
            }
        }
    }
}

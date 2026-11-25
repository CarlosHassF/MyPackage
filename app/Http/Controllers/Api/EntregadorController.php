<?php

namespace App\Http\Controllers\Api;

use App\Enums\StatusEntregador;
use App\Http\Controllers\Controller;
use App\Models\Entregador;
use App\Models\Pacote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EntregadorController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Entregador::query()->latest('id_entregador')->paginate(15));
    }

    public function disponiveis(): JsonResponse
    {
        return response()->json(
            Entregador::query()
                ->where('status', StatusEntregador::Disponivel->value)
                ->orderBy('nome_entregador')
                ->get(),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nome_entregador' => ['required', 'string', 'max:255'],
            'num_entregador' => ['required', 'string', 'max:255', 'unique:entregadores,num_entregador'],
            'status' => ['sometimes', 'required', Rule::enum(StatusEntregador::class)],
        ]);
        $data += ['status' => StatusEntregador::Disponivel->value];

        return response()->json(Entregador::create($data), 201);
    }

    public function show(int $entregador): JsonResponse
    {
        return response()->json(Entregador::query()->findOrFail($entregador));
    }

    public function update(Request $request, int $entregador): JsonResponse
    {
        $courier = Entregador::query()->findOrFail($entregador);
        $data = $request->validate([
            'nome_entregador' => ['sometimes', 'required', 'string', 'max:255'],
            'num_entregador' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('entregadores', 'num_entregador')->ignore($courier),
            ],
            'status' => ['sometimes', 'required', Rule::enum(StatusEntregador::class)],
        ]);

        if (
            isset($data['status'])
            && $data['status'] !== StatusEntregador::EmRota->value
            && Pacote::query()
                ->where('id_entregador_responsavel', $courier->id_entregador)
                ->whereNotIn('situacao', ['entregue', 'devolvido'])
                ->exists()
        ) {
            return response()->json([
                'message' => 'O entregador possui pacotes ativos e não pode sair do status "em rota".',
            ], 409);
        }

        $courier->update($data);

        return response()->json($courier->refresh());
    }

    public function destroy(int $entregador): JsonResponse
    {
        Entregador::query()->findOrFail($entregador)->delete();

        return response()->json(null, 204);
    }
}

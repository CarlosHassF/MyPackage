<?php

namespace App\Http\Controllers\Api;

use App\Enums\SituacaoPacote;
use App\Enums\StatusEntregador;
use App\Http\Controllers\Controller;
use App\Models\Entregador;
use App\Models\Pacote;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $statusCounts = Pacote::query()
            ->selectRaw('situacao, COUNT(*) as quantidade')
            ->groupBy('situacao')
            ->pluck('quantidade', 'situacao');

        $activeSituations = [
            SituacaoPacote::EmSeparacao->value,
            SituacaoPacote::Enviado->value,
            SituacaoPacote::EmRota->value,
        ];

        return response()->json([
            'total_entregas' => Pacote::query()->count(),
            'entregas_atrasadas' => Pacote::query()
                ->whereDate('data_prevista', '<', today())
                ->whereIn('situacao', $activeSituations)
                ->count(),
            'entregas_concluidas' => (int) ($statusCounts[SituacaoPacote::Entregue->value] ?? 0),
            'entregadores_disponiveis' => Entregador::query()
                ->where('status', StatusEntregador::Disponivel->value)
                ->count(),
            'por_situacao' => array_map(
                fn (SituacaoPacote $situacao): array => [
                    'situacao' => $situacao->value,
                    'quantidade' => (int) ($statusCounts[$situacao->value] ?? 0),
                ],
                SituacaoPacote::cases(),
            ),
            'entregas_recentes' => Pacote::query()
                ->with('entregadorResponsavel:id_entregador,nome_entregador')
                ->latest('created_at')
                ->limit(6)
                ->get([
                    'id_pacote',
                    'cod_rastreio',
                    'nome_destinatario',
                    'situacao',
                    'data_prevista',
                    'id_entregador_responsavel',
                ]),
            'pacotes_no_mapa' => Pacote::query()
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->count(),
            'pacotes_mapa' => Pacote::query()
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->latest('id_pacote')
                ->limit(250)
                ->get([
                    'id_pacote',
                    'cod_rastreio',
                    'nome_destinatario',
                    'situacao',
                    'latitude',
                    'longitude',
                ]),
            'atualizado_em' => now()->toIso8601String(),
        ]);
    }
}

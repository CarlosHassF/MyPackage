<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\MapAddressNotFoundException;
use App\Exceptions\MapProviderException;
use App\Http\Controllers\Controller;
use App\Models\Pacote;
use App\Services\OpenStreetMapRoutingService;
use Illuminate\Http\JsonResponse;

class RotaPacoteController extends Controller
{
    public function __invoke(Pacote $pacote, OpenStreetMapRoutingService $routing): JsonResponse
    {
        $pacote->loadMissing('origem:id_centro_logistico,nome_centro,endereco_centro');

        if (blank($pacote->origem?->endereco_centro)) {
            return response()->json([
                'message' => 'Cadastre o endereço do centro logístico para calcular esta rota.',
            ], 422);
        }

        try {
            $route = $routing->route($pacote->origem->endereco_centro, $pacote->endereco_entrega);
        } catch (MapAddressNotFoundException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        } catch (MapProviderException $exception) {
            return response()->json(['message' => $exception->getMessage()], 502);
        }

        if ($pacote->latitude === null || $pacote->longitude === null) {
            $pacote->forceFill([
                'latitude' => $route['destino']['lat'],
                'longitude' => $route['destino']['lon'],
            ])->save();
        }

        return response()->json([
            'pacote' => $pacote->only(['id_pacote', 'cod_rastreio']),
            ...$route,
        ]);
    }
}

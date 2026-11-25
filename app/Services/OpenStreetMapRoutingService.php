<?php

namespace App\Services;

use App\Exceptions\MapAddressNotFoundException;
use App\Exceptions\MapProviderException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class OpenStreetMapRoutingService
{
    public function route(string $originAddress, string $destinationAddress): array
    {
        $origin = $this->geocode($originAddress);
        $destination = $this->geocode($destinationAddress);

        try {
            $response = Http::acceptJson()
                ->connectTimeout(3)
                ->timeout(10)
                ->get(
                    rtrim(config('maps.osrm_url'), '/').sprintf(
                        '/%s,%s;%s,%s',
                        $origin['lon'],
                        $origin['lat'],
                        $destination['lon'],
                        $destination['lat'],
                    ),
                    ['overview' => 'full', 'geometries' => 'geojson', 'steps' => 'false'],
                )
                ->throw()
                ->json();
        } catch (ConnectionException|RequestException $exception) {
            throw new MapProviderException('O serviço de rotas está indisponível no momento.', previous: $exception);
        }

        $route = $response['routes'][0] ?? null;

        if (($response['code'] ?? null) !== 'Ok' || $route === null) {
            throw new MapProviderException('Não foi possível calcular uma rota entre os endereços informados.');
        }

        return [
            'origem' => $origin,
            'destino' => $destination,
            'distancia_km' => round($route['distance'] / 1000, 1),
            'duracao_minutos' => (int) round($route['duration'] / 60),
            'geometria' => $route['geometry'],
            'provedor' => 'OpenStreetMap / OSRM',
        ];
    }

    public function geocode(string $address): array
    {
        $normalizedAddress = mb_strtolower(trim(preg_replace('/\s+/', ' ', $address)));
        $cacheKey = 'maps:geocode:'.hash('sha256', $normalizedAddress);

        return Cache::remember($cacheKey, now()->addDays(30), function () use ($address): array {
            return Cache::lock('maps:nominatim-rate-limit', 20)->block(15, function () use ($address): array {
                $lastRequest = (float) Cache::get('maps:nominatim-last-request', 0);
                $remainingMicroseconds = (int) max(0, (1.1 - (microtime(true) - $lastRequest)) * 1_000_000);

                if ($remainingMicroseconds > 0) {
                    usleep($remainingMicroseconds);
                }

                Cache::put('maps:nominatim-last-request', microtime(true), now()->addMinute());

                try {
                    $results = Http::acceptJson()
                        ->withUserAgent(config('maps.user_agent'))
                        ->connectTimeout(3)
                        ->timeout(8)
                        ->get(config('maps.nominatim_url'), [
                            'q' => $address,
                            'format' => 'jsonv2',
                            'limit' => 1,
                        ])
                        ->throw()
                        ->json();
                } catch (ConnectionException|RequestException $exception) {
                    throw new MapProviderException(
                        'O serviço de geocodificação está indisponível no momento.',
                        previous: $exception,
                    );
                }

                $location = $results[0] ?? null;

                if (! is_array($location) || ! isset($location['lat'], $location['lon'])) {
                    throw new MapAddressNotFoundException('Não foi possível localizar um dos endereços informados.');
                }

                return [
                    'lat' => (float) $location['lat'],
                    'lon' => (float) $location['lon'],
                    'rotulo' => $location['display_name'] ?? $address,
                ];
            });
        });
    }
}

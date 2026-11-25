<?php

namespace App\Services;

use App\Exceptions\CepProviderException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class CepLookupService
{
    /**
     * @return array{cep: string, logradouro: string, bairro: string, localidade: string, uf: string, endereco: string}|null
     */
    public function lookup(string $cep): ?array
    {
        $providers = [
            [
                'url' => "https://viacep.com.br/ws/{$cep}/json/",
                'map' => fn (array $data): array => [
                    'logradouro' => $data['logradouro'] ?? '',
                    'bairro' => $data['bairro'] ?? '',
                    'localidade' => $data['localidade'] ?? '',
                    'uf' => $data['uf'] ?? '',
                ],
                'not_found' => fn (array $data): bool => filter_var($data['erro'] ?? false, FILTER_VALIDATE_BOOLEAN),
            ],
            [
                'url' => "https://brasilapi.com.br/api/cep/v1/{$cep}",
                'map' => fn (array $data): array => [
                    'logradouro' => $data['street'] ?? '',
                    'bairro' => $data['neighborhood'] ?? '',
                    'localidade' => $data['city'] ?? '',
                    'uf' => $data['state'] ?? '',
                ],
                'not_found' => fn (array $data): bool => false,
            ],
            [
                'url' => "https://cep.awesomeapi.com.br/json/{$cep}",
                'map' => fn (array $data): array => [
                    'logradouro' => $data['address'] ?? '',
                    'bairro' => $data['district'] ?? '',
                    'localidade' => $data['city'] ?? '',
                    'uf' => $data['state'] ?? '',
                ],
                'not_found' => fn (array $data): bool => false,
            ],
        ];
        $providerUnavailable = false;

        foreach ($providers as $provider) {
            try {
                $response = Http::acceptJson()
                    ->connectTimeout(2)
                    ->timeout(4)
                    ->get($provider['url']);
            } catch (ConnectionException) {
                $providerUnavailable = true;

                continue;
            }

            if ($response->notFound()) {
                continue;
            }

            if (! $response->successful()) {
                $providerUnavailable = true;

                continue;
            }

            $data = $response->json();

            if (! is_array($data)) {
                $providerUnavailable = true;

                continue;
            }

            if ($provider['not_found']($data)) {
                continue;
            }

            $address = $this->normalizeAddress($provider['map']($data));

            if ($address === null) {
                $providerUnavailable = true;

                continue;
            }

            return [
                'cep' => substr($cep, 0, 5).'-'.substr($cep, 5),
                ...$address,
            ];
        }

        if ($providerUnavailable) {
            throw new CepProviderException('Os serviços de consulta de CEP estão indisponíveis.');
        }

        return null;
    }

    /**
     * @param  array{logradouro: mixed, bairro: mixed, localidade: mixed, uf: mixed}  $address
     * @return array{logradouro: string, bairro: string, localidade: string, uf: string, endereco: string}|null
     */
    private function normalizeAddress(array $address): ?array
    {
        $street = trim((string) $address['logradouro']);
        $neighborhood = trim((string) $address['bairro']);
        $city = trim((string) $address['localidade']);
        $state = trim((string) $address['uf']);

        if ($city === '' || $state === '') {
            return null;
        }

        $cityAndState = "{$city} - {$state}";
        $fullAddress = implode(', ', array_filter(
            [$street, $neighborhood, $cityAndState],
            fn (string $part): bool => $part !== '',
        ));

        return [
            'logradouro' => $street,
            'bairro' => $neighborhood,
            'localidade' => $city,
            'uf' => $state,
            'endereco' => $fullAddress,
        ];
    }
}

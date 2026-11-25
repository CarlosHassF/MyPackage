<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CepLookupControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_address_from_primary_provider_for_a_brazilian_cep(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'viacep.com.br/*' => Http::response([
                'cep' => '01001-000',
                'logradouro' => 'Praça da Sé',
                'bairro' => 'Sé',
                'localidade' => 'São Paulo',
                'uf' => 'SP',
            ]),
        ]);
        Sanctum::actingAs(User::factory()->create());

        $response = $this->getJson('/api/cep/01001000');

        $response->assertOk()
            ->assertJsonPath('logradouro', 'Praça da Sé')
            ->assertJsonPath('localidade', 'São Paulo')
            ->assertJsonPath('uf', 'SP');
    }

    public function test_returns_address_from_fallback_provider_for_a_brazilian_cep(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'viacep.com.br/*' => Http::response(['erro' => 'true']),
            'brasilapi.com.br/*' => Http::response([
                'street' => 'Praça da Sé',
                'neighborhood' => 'Sé',
                'city' => 'São Paulo',
                'state' => 'SP',
            ]),
        ]);
        Sanctum::actingAs(User::factory()->create());

        $response = $this->getJson('/api/cep/01001-000');

        $response->assertOk()
            ->assertJsonPath('cep', '01001-000')
            ->assertJsonPath('logradouro', 'Praça da Sé')
            ->assertJsonPath('bairro', 'Sé')
            ->assertJsonPath('localidade', 'São Paulo')
            ->assertJsonPath('uf', 'SP')
            ->assertJsonPath('endereco', 'Praça da Sé, Sé, São Paulo - SP');
    }

    public function test_returns_404_when_all_providers_confirm_the_cep_does_not_exist(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'viacep.com.br/*' => Http::response(['erro' => 'true']),
            'brasilapi.com.br/*' => Http::response([], 404),
            'cep.awesomeapi.com.br/*' => Http::response([], 404),
        ]);
        Sanctum::actingAs(User::factory()->create());

        $response = $this->getJson('/api/cep/99999999');

        $response->assertNotFound()
            ->assertJsonPath('message', 'CEP não encontrado nas bases consultadas.');
    }

    public function test_returns_address_from_third_provider_when_first_two_do_not_find_cep(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'viacep.com.br/*' => Http::response(['erro' => 'true']),
            'brasilapi.com.br/*' => Http::response([], 404),
            'cep.awesomeapi.com.br/*' => Http::response([
                'address' => 'Praça da Sé',
                'district' => 'Sé',
                'city' => 'São Paulo',
                'state' => 'SP',
            ]),
        ]);
        Sanctum::actingAs(User::factory()->create());

        $response = $this->getJson('/api/cep/01001000');

        $response->assertOk()
            ->assertJsonPath('logradouro', 'Praça da Sé')
            ->assertJsonPath('localidade', 'São Paulo')
            ->assertJsonPath('uf', 'SP');
    }

    public function test_returns_503_when_all_providers_are_unavailable(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'viacep.com.br/*' => Http::response([], 503),
            'brasilapi.com.br/*' => Http::response([], 503),
            'cep.awesomeapi.com.br/*' => Http::response([], 503),
        ]);
        Sanctum::actingAs(User::factory()->create());

        $response = $this->getJson('/api/cep/01001000');

        $response->assertServiceUnavailable()
            ->assertJsonPath('message', 'Os serviços de consulta de CEP estão indisponíveis.');
    }

    public function test_returns_422_when_cep_does_not_have_eight_digits(): void
    {
        Http::preventStrayRequests();
        Sanctum::actingAs(User::factory()->create());

        $response = $this->getJson('/api/cep/1234A-567');

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('cep');
    }

    public function test_requires_authentication_for_cep_lookup(): void
    {
        Http::preventStrayRequests();

        $response = $this->getJson('/api/cep/01001000');

        $response->assertUnauthorized();
    }
}

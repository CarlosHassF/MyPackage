<?php

namespace Tests\Feature;

use App\Enums\SituacaoPacote;
use App\Enums\StatusEntregador;
use App\Models\CentroLogistico;
use App\Models\Entregador;
use App\Models\Pacote;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LogisticsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_logistics_endpoints_require_sanctum_authentication(): void
    {
        $this->getJson('/api/dashboard')->assertUnauthorized();
        $this->getJson('/api/usuarios')->assertUnauthorized();
        $this->getJson('/api/centros-logisticos')->assertUnauthorized();
        $this->getJson('/api/entregadores')->assertUnauthorized();
        $this->getJson('/api/entregadores/disponiveis')->assertUnauthorized();
        $this->getJson('/api/pacotes')->assertUnauthorized();
        $this->getJson('/api/pacotes/status')->assertUnauthorized();
    }

    public function test_dashboard_login_and_statistics_are_available_to_authenticated_users(): void
    {
        $client = User::factory()->create([
            'email' => 'dashboard@example.com',
            'password' => 'senha-segura-123',
        ]);

        $login = $this->postJson('/api/login', [
            'email' => 'dashboard@example.com',
            'password' => 'senha-segura-123',
        ])->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

        $token = $login->json('token');
        $this->getJson('/api/dashboard', ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonPath('total_entregas', 0);
        $this->withToken($token)->postJson('/api/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);

        Sanctum::actingAs($client);
        $center = CentroLogistico::create([
            'nome_centro' => 'Centro Dashboard',
            'responsavel_centro' => 'Responsável',
            'num_entregadores' => 1,
        ]);
        Entregador::create([
            'nome_entregador' => 'Disponível',
            'num_entregador' => 'DASH-001',
            'status' => StatusEntregador::Disponivel->value,
        ]);

        Pacote::create([
            'cod_rastreio' => 'DASH-ATRASADO',
            'nome_destinatario' => 'Destinatário A',
            'endereco_entrega' => 'Rua A, 1',
            'id_origem' => $center->id_centro_logistico,
            'situacao' => SituacaoPacote::EmRota->value,
            'cpf_cliente' => $client->cpf,
            'data_prevista' => today()->subDay()->toDateString(),
            'latitude' => -23.5505,
            'longitude' => -46.6333,
        ]);
        Pacote::create([
            'cod_rastreio' => 'DASH-ENTREGUE',
            'nome_destinatario' => 'Destinatário B',
            'endereco_entrega' => 'Rua B, 2',
            'id_origem' => $center->id_centro_logistico,
            'situacao' => SituacaoPacote::Entregue->value,
            'cpf_cliente' => $client->cpf,
            'data_prevista' => today()->subDay()->toDateString(),
        ]);

        $this->getJson('/api/dashboard')
            ->assertOk()
            ->assertJson(fn (AssertableJson $json) => $json
                ->where('total_entregas', 2)
                ->where('entregas_atrasadas', 1)
                ->where('entregas_concluidas', 1)
                ->where('entregadores_disponiveis', 1)
                ->has('por_situacao', count(SituacaoPacote::cases()))
                ->has('entregas_recentes', 2)
                ->where('pacotes_no_mapa', 1)
                ->has('pacotes_mapa', 1)
                ->where('pacotes_mapa.0.cod_rastreio', 'DASH-ATRASADO')
                ->has('atualizado_em')
                ->etc());
    }

    public function test_user_crud_hashes_password_and_returns_user_without_password(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/usuarios', [
            'name' => 'Maria Silva',
            'email' => 'maria@example.com',
            'password' => 'senha-segura-123',
            'endereco' => 'Rua das Flores, 10',
            'telefone' => '11987654321',
            'cpf' => '12345678901',
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'Maria Silva')
            ->assertJsonMissingPath('password');
        $this->assertTrue(Hash::check('senha-segura-123', User::query()->where('email', 'maria@example.com')->value('password')));

        $id = $response->json('id');
        $this->getJson("/api/usuarios/{$id}")->assertOk();
        $this->patchJson("/api/usuarios/{$id}", ['telefone' => '11999999999'])
            ->assertOk()
            ->assertJsonPath('telefone', '11999999999');
        $this->deleteJson("/api/usuarios/{$id}")->assertNoContent();
    }

    public function test_logistics_centers_have_complete_crud(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/centros-logisticos', [
            'nome_centro' => 'Centro Sul',
            'responsavel_centro' => 'João Souza',
            'endereco_centro' => 'Rua do Centro, 10, São Paulo, SP',
            'num_entregadores' => 5,
        ]);

        $response->assertCreated()
            ->assertJsonPath('num_entregadores', 5)
            ->assertJsonPath('endereco_centro', 'Rua do Centro, 10, São Paulo, SP');
        $id = $response->json('id_centro_logistico');
        $this->getJson('/api/centros-logisticos')->assertOk();
        $this->getJson("/api/centros-logisticos/{$id}")->assertOk();
        $this->patchJson("/api/centros-logisticos/{$id}", ['num_entregadores' => 6])
            ->assertOk()
            ->assertJsonPath('num_entregadores', 6);
        $this->deleteJson("/api/centros-logisticos/{$id}")->assertNoContent();
    }

    public function test_courier_crud_and_available_list(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/entregadores', [
            'nome_entregador' => 'Ana Lima',
            'num_entregador' => 'ENT-100',
        ]);

        $response->assertCreated()->assertJsonPath('status', StatusEntregador::Disponivel->value);
        $id = $response->json('id_entregador');
        $this->getJson('/api/entregadores')->assertOk();
        $this->getJson('/api/entregadores/disponiveis')
            ->assertOk()
            ->assertJsonFragment(['id_entregador' => $id]);
        $this->getJson("/api/entregadores/{$id}")->assertOk();
        $this->patchJson("/api/entregadores/{$id}", ['status' => StatusEntregador::Indisponivel->value])
            ->assertOk()
            ->assertJsonPath('status', StatusEntregador::Indisponivel->value);
        $this->getJson('/api/entregadores/disponiveis')->assertJsonMissing(['id_entregador' => $id]);
        $this->deleteJson("/api/entregadores/{$id}")->assertNoContent();
    }

    public function test_package_crud_updates_courier_availability_and_summarizes_statuses(): void
    {
        Http::fake([
            'nominatim.openstreetmap.org/search*' => Http::response([
                ['lat' => '-23.5505', 'lon' => '-46.6333', 'display_name' => 'São Paulo'],
            ]),
        ]);
        Sanctum::actingAs(User::factory()->create());
        $client = User::factory()->create();
        $center = CentroLogistico::create([
            'nome_centro' => 'Centro Norte',
            'responsavel_centro' => 'Carlos Costa',
            'num_entregadores' => 2,
        ]);
        $courier = Entregador::create([
            'nome_entregador' => 'Pedro Santos',
            'num_entregador' => 'ENT-200',
            'status' => StatusEntregador::Disponivel->value,
        ]);

        $response = $this->postJson('/api/pacotes', [
            'cod_rastreio' => 'BR123456789',
            'nome_destinatario' => 'Paula Nunes',
            'endereco_entrega' => 'Rua A, 20',
            'id_origem' => $center->id_centro_logistico,
            'id_entregador_responsavel' => $courier->id_entregador,
            'cpf_cliente' => $client->cpf,
            'data_prevista' => '2027-01-15',
        ]);

        $response->assertCreated()
            ->assertJsonPath('situacao', SituacaoPacote::EmSeparacao->value)
            ->assertJsonPath('cpf_cliente', $client->cpf)
            ->assertJsonPath('latitude', -23.5505)
            ->assertJsonPath('longitude', -46.6333);
        $id = $response->json('id_pacote');
        $this->assertDatabaseHas('entregadores', [
            'id_entregador' => $courier->id_entregador,
            'status' => StatusEntregador::EmRota->value,
        ]);
        $this->getJson('/api/entregadores/disponiveis')
            ->assertJsonMissing(['id_entregador' => $courier->id_entregador]);
        $this->getJson('/api/pacotes')->assertOk();
        $this->getJson("/api/pacotes/{$id}")->assertOk();
        $this->getJson('/api/pacotes/status')
            ->assertOk()
            ->assertJsonCount(count(SituacaoPacote::cases()), 'data')
            ->assertJsonFragment([
                'situacao' => SituacaoPacote::EmSeparacao->value,
                'quantidade' => 1,
            ]);

        $this->patchJson("/api/pacotes/{$id}", [
            'situacao' => SituacaoPacote::Entregue->value,
        ])->assertOk()->assertJsonPath('situacao', SituacaoPacote::Entregue->value);
        $this->assertDatabaseHas('entregadores', [
            'id_entregador' => $courier->id_entregador,
            'status' => StatusEntregador::Disponivel->value,
        ]);
        $this->deleteJson("/api/pacotes/{$id}")->assertNoContent();
    }

    public function test_cannot_delete_a_user_or_center_referenced_by_a_package(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $client = User::factory()->create();
        $center = CentroLogistico::create([
            'nome_centro' => 'Centro Leste',
            'responsavel_centro' => 'Rita Alves',
            'num_entregadores' => 0,
        ]);
        Pacote::create([
            'cod_rastreio' => 'BR987654321',
            'nome_destinatario' => 'Joana Reis',
            'endereco_entrega' => 'Rua B, 30',
            'id_origem' => $center->id_centro_logistico,
            'cpf_cliente' => $client->cpf,
            'data_prevista' => '2027-02-01',
        ]);

        $this->deleteJson("/api/usuarios/{$client->id}")->assertConflict();
        $this->deleteJson("/api/centros-logisticos/{$center->id_centro_logistico}")->assertConflict();
    }

    public function test_package_cannot_be_assigned_to_a_courier_that_is_not_available(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $client = User::factory()->create();
        $center = CentroLogistico::create([
            'nome_centro' => 'Centro Oeste',
            'responsavel_centro' => 'Lia Rocha',
            'num_entregadores' => 1,
        ]);
        $courier = Entregador::create([
            'nome_entregador' => 'Igor Melo',
            'num_entregador' => 'ENT-300',
            'status' => StatusEntregador::Indisponivel->value,
        ]);

        Http::fake();
        $this->postJson('/api/pacotes', [
            'cod_rastreio' => 'BR555555555',
            'nome_destinatario' => 'Rui Dias',
            'endereco_entrega' => 'Rua C, 40',
            'id_origem' => $center->id_centro_logistico,
            'id_entregador_responsavel' => $courier->id_entregador,
            'cpf_cliente' => $client->cpf,
            'data_prevista' => '2027-02-02',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('id_entregador_responsavel');
        Http::assertNothingSent();
    }

    public function test_package_route_uses_openstreetmap_geocoding_and_osrm(): void
    {
        Cache::flush();
        Http::fake([
            'nominatim.openstreetmap.org/search*' => Http::response([
                ['lat' => '-23.5505', 'lon' => '-46.6333', 'display_name' => 'São Paulo'],
            ]),
            'router.project-osrm.org/route/v1/driving/*' => Http::response([
                'code' => 'Ok',
                'routes' => [[
                    'distance' => 12450,
                    'duration' => 1800,
                    'geometry' => [
                        'type' => 'LineString',
                        'coordinates' => [[-46.6333, -23.5505], [-46.6400, -23.5600]],
                    ],
                ]],
            ]),
        ]);
        Sanctum::actingAs(User::factory()->create());
        $client = User::factory()->create();
        $center = CentroLogistico::create([
            'nome_centro' => 'Centro com endereço',
            'responsavel_centro' => 'Responsável',
            'endereco_centro' => 'Praça da Sé, São Paulo, SP',
            'num_entregadores' => 0,
        ]);
        $package = Pacote::create([
            'cod_rastreio' => 'MAP-123',
            'nome_destinatario' => 'Destinatário',
            'endereco_entrega' => 'Avenida Paulista, São Paulo, SP',
            'id_origem' => $center->id_centro_logistico,
            'cpf_cliente' => $client->cpf,
            'data_prevista' => today()->addDay()->toDateString(),
        ]);

        $this->getJson("/api/pacotes/{$package->id_pacote}/rota")
            ->assertOk()
            ->assertJsonPath('distancia_km', 12.5)
            ->assertJsonPath('duracao_minutos', 30)
            ->assertJsonPath('provedor', 'OpenStreetMap / OSRM')
            ->assertJsonPath('geometria.type', 'LineString');
        $this->assertDatabaseHas('pacotes', [
            'id_pacote' => $package->id_pacote,
            'latitude' => -23.5505,
            'longitude' => -46.6333,
        ]);

        Http::assertSentCount(3);
        Http::assertSent(fn (ClientRequest $request) => str_contains($request->url(), 'nominatim.openstreetmap.org'));
        Http::assertSent(fn (ClientRequest $request) => str_contains($request->url(), 'router.project-osrm.org'));
    }

    public function test_package_route_requires_a_center_address(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $client = User::factory()->create();
        $center = CentroLogistico::create([
            'nome_centro' => 'Centro sem endereço',
            'responsavel_centro' => 'Responsável',
            'num_entregadores' => 0,
        ]);
        $package = Pacote::create([
            'cod_rastreio' => 'MAP-456',
            'nome_destinatario' => 'Destinatário',
            'endereco_entrega' => 'Rua A, 10',
            'id_origem' => $center->id_centro_logistico,
            'cpf_cliente' => $client->cpf,
            'data_prevista' => today()->addDay()->toDateString(),
        ]);

        $this->getJson("/api/pacotes/{$package->id_pacote}/rota")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Cadastre o endereço do centro logístico para calcular esta rota.');
    }

    public function test_package_is_not_created_when_geocoding_cannot_find_its_address(): void
    {
        Http::fake([
            'nominatim.openstreetmap.org/search*' => Http::response([]),
        ]);
        Sanctum::actingAs(User::factory()->create());
        $client = User::factory()->create();
        $center = CentroLogistico::create([
            'nome_centro' => 'Centro com endereço',
            'responsavel_centro' => 'Responsável',
            'endereco_centro' => 'Praça da Sé, São Paulo, SP',
            'num_entregadores' => 0,
        ]);

        $this->postJson('/api/pacotes', [
            'cod_rastreio' => 'MAP-NOT-FOUND',
            'nome_destinatario' => 'Destinatário',
            'endereco_entrega' => 'Endereço inexistente 123',
            'id_origem' => $center->id_centro_logistico,
            'cpf_cliente' => $client->cpf,
            'data_prevista' => today()->addDay()->toDateString(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('endereco_entrega');

        $this->assertDatabaseMissing('pacotes', ['cod_rastreio' => 'MAP-NOT-FOUND']);
    }

    public function test_dashboard_map_shows_geocoded_packages_and_package_form_can_use_a_new_center(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/centros-logisticos', [
            'nome_centro' => 'Centro criado pelo formulário',
            'responsavel_centro' => 'Responsável',
            'endereco_centro' => 'Avenida Central, 10, São Paulo, SP',
            'num_entregadores' => 3,
        ])->assertCreated();

        $this->assertDatabaseHas('centros_logisticos', [
            'id_centro_logistico' => $response->json('id_centro_logistico'),
            'endereco_centro' => 'Avenida Central, 10, São Paulo, SP',
        ]);
    }
}

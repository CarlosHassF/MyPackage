# MyPackage

Base de aplicação com Laravel 13 como API e React 19 como interface, compilada
pelo Vite. O banco inicial usa SQLite; a autenticação de API está preparada com
Laravel Sanctum e senhas são armazenadas com bcrypt.

## Requisitos

- PHP 8.3 ou superior e Composer
- Node.js e npm compatíveis com Vite 8

## Instalação e execução

```bash
composer run setup
composer run dev
```

O comando `setup` instala as dependências PHP e JavaScript, gera a chave da
aplicação, executa as migrations e compila os arquivos do frontend. `dev`
inicia o servidor Laravel, o Vite e os processos de desenvolvimento.

## Estrutura

- `resources/js/`: aplicação React
- `resources/css/`: estilos e Tailwind CSS
- `routes/api.php`: endpoints da API
- `routes/web.php`: entrada da aplicação React

A rota `GET /api/user` já exige autenticação Sanctum. O modelo `User` inclui
`HasApiTokens` para emissão de tokens e aplica hash automaticamente ao atribuir
uma senha.

## API logística

Execute `php artisan migrate` para criar os campos de cliente e as tabelas
logísticas. `usuarios` usa a tabela existente `users`; os campos `cpf`,
`endereco` e `telefone` foram adicionados sem remover dados existentes. O CPF
é único e deve ser enviado com 11 dígitos. Pacotes referenciam esse CPF,
um centro de origem e, opcionalmente, um entregador.

Todos os endpoints abaixo exigem autenticação Sanctum com `Authorization:
Bearer <token>`. Para criar o primeiro usuário e token localmente, use
`php artisan tinker`:

```php
$user = \App\Models\User::create([
    'name' => 'Administrador',
    'email' => 'admin@example.com',
    'password' => 'troque-esta-senha',
    'endereco' => 'Endereço',
    'telefone' => '11999999999',
    'cpf' => '12345678901',
]);
$token = $user->createToken('api')->plainTextToken;
```

O dashboard React autentica com e-mail e senha usando `POST /api/login`, mantém
o token Sanctum apenas na sessão do navegador e atualiza `GET /api/dashboard`
automaticamente a cada minuto. O logout revoga o token atual.

Na barra lateral, o atalho do relógio abre o cadastro de pacote. O atalho de
entregadores abre as opções para cadastrar ou listar a equipe; quando a barra
está recolhida, os ícones ficam centralizados e mostram dicas ao passar o mouse
ou ao receber foco pelo teclado. O ícone do centro logístico abre seu cadastro;
o formulário de pacote também permite criar um centro sem perder os dados do
pacote.

| Recurso | Endpoints |
| --- | --- |
| Usuários | `GET/POST /api/usuarios`, `GET/PUT/PATCH/DELETE /api/usuarios/{id}` |
| Centros logísticos | `GET/POST /api/centros-logisticos`, `GET/PUT/PATCH/DELETE /api/centros-logisticos/{id}` |
| Entregadores | `GET/POST /api/entregadores`, `GET/PUT/PATCH/DELETE /api/entregadores/{id}` |
| Pacotes | `GET/POST /api/pacotes`, `GET/PUT/PATCH/DELETE /api/pacotes/{id}` |
| Sessão e painel | `POST /api/login`, `POST /api/logout`, `GET /api/dashboard` |

O painel exibe o total de pacotes, entregas vencidas ainda em andamento,
entregas com situação `entregue`, entregadores disponíveis, distribuição por
situação e as seis entregas mais recentes. As métricas são calculadas no
servidor e retornadas somente para usuários autenticados.

- Para visualizar uma rota, cadastre `endereco_centro` no centro logístico e
  selecione uma entrega recente no mapa do dashboard. O endpoint
  `GET /api/pacotes/{id}/rota` geocodifica a origem e o destino com
  OpenStreetMap/Nominatim e calcula distância, duração estimada e geometria
  pelo OSRM.
- O endereço de entrega é geocodificado ao cadastrar/alterar o pacote; as
  coordenadas ficam gravadas no banco e o pacote aparece automaticamente como
  marcador no mapa. O dashboard exibe os 250 pacotes geolocalizados mais
  recentes. Pacotes antigos só entram no mapa depois de calculada a rota.
- Ao geocodificar, o endereço é enviado ao OpenStreetMap/Nominatim. As
  coordenadas ficam em cache por 30 dias, e as consultas Nominatim são
  serializadas e limitadas a uma por segundo. Configure `MAPS_CONTACT_EMAIL`
  para incluir um contato no User-Agent da aplicação. Falha de geocodificação
  impede o cadastro/alteração e retorna um erro para o formulário.
- Nominatim, OSRM público e tiles OpenStreetMap são serviços comunitários,
  sujeitos a limites e disponibilidade, sem SLA. O tempo de percurso é uma
  estimativa sem informação de trânsito; para produção ou alto volume, configure
  serviços/provedores próprios compatíveis com as URLs `NOMINATIM_URL` e
  `OSRM_URL`, ou escolha um provedor comercial com chave e SLA.

- `GET /api/entregadores/disponiveis` lista os entregadores disponíveis para
  atribuição.
- `GET /api/pacotes/status` retorna a quantidade de pacotes em cada situação,
  inclusive situações com quantidade zero. Os estados são enums; não é
  necessária uma tabela separada.
- Atribuir um entregador disponível a um pacote altera o status dele para
  `em rota`. Ao concluir ou devolver seus pacotes ativos, ele volta para
  `disponivel`.
- Os índices de listagem são paginados (15 registros). Pacotes incluem as
  informações relacionadas de origem, cliente e entregador.
- Exclusões de usuários ou centros referenciados por pacotes retornam `409`.
- `num_entregadores` em centros é informado e mantido no próprio CRUD do
  centro; entregadores não possuem vínculo com centro no modelo solicitado.

## Senhas

O driver padrão está definido como bcrypt em `config/hashing.php`. A quantidade
de rounds pode ser configurada pela variável `BCRYPT_ROUNDS` no `.env` (12 por
padrão). Use `Hash::make()` ou atribua a senha ao modelo `User`; não armazene
senhas em texto puro.

## Testes

```bash
composer run test
```

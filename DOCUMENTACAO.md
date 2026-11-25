# Documentação do sistema Rota

Este projeto é um sistema de gestão de entregas com API Laravel 13, autenticação
por tokens Laravel Sanctum e interface React 19. O banco padrão é SQLite e as
senhas são armazenadas com hash bcrypt.

## Executar o projeto

Na raiz do repositório, execute:

```bash
composer run setup
composer run dev
```

O comando `setup` instala dependências, prepara o `.env`, gera a chave da
aplicação, executa as migrations e compila o frontend. O comando `dev` inicia
os serviços de desenvolvimento. Mantenha esse terminal aberto enquanto usa a
aplicação.

Para executar os testes:

```bash
composer run test
```

### Problemas de conexão e carregamento

- Inicie o projeto com `composer run dev` e mantenha o terminal aberto. Acesse
  o endereço do servidor Laravel iniciado pelo comando; a aplicação e a API
  devem estar na mesma origem. Uma aba aberta numa porta antiga ou temporária
  pode continuar visível, mas as chamadas à API falharão quando o servidor
  daquela porta estiver parado.
- Após reiniciar os serviços, atualize a página sem usar o cache (`Ctrl+Shift+R`
  no Linux/Windows ou `Cmd+Shift+R` no macOS). Se a mensagem “Failed to fetch”
  persistir, confira se o terminal ainda mostra os servidores ativos e se a
  URL aberta corresponde à porta atual do Laravel.
- A integração React/Vite precisa do preâmbulo `@viteReactRefresh` antes de
  `@vite` no template Blade. Um erro de preâmbulo no console indica que os
  assets não foram carregados corretamente; reinicie `composer run dev` ou
  gere novamente os assets com `npm run build`.
- “Failed to fetch” indica que o navegador não conseguiu alcançar o servidor.
  Uma resposta HTTP `401` é diferente: significa que a API respondeu, mas a
  sessão expirou ou o token não é válido; entre novamente pela tela de login.

### Criar o primeiro usuário

As rotas de usuários também exigem autenticação. Portanto, crie o primeiro
usuário localmente pelo Tinker:

```bash
php artisan tinker
```

No prompt do Tinker, execute o código abaixo com dados próprios. Digite somente
o código PHP, sem `<?php` e sem o caractere `>` do prompt:

```php
App\Models\User::create([
    'name' => 'Administrador',
    'email' => 'admin@example.com',
    'password' => 'troque-esta-senha',
    'endereco' => 'Endereço do administrador',
    'telefone' => '11999999999',
    'cpf' => '12345678901',
]);
```

O CPF deve ter 11 dígitos e ser único. O modelo aplica hash à senha
automaticamente. Para sair do Tinker, use `exit`.

## Como funciona

1. O usuário entra pela interface React com e-mail e senha. A API valida as
   credenciais e retorna um token Sanctum.
2. O frontend mantém o token na sessão atual do navegador e o envia nas
   chamadas autenticadas usando o cabeçalho `Authorization: Bearer <token>`.
3. O dashboard consulta as métricas, as entregas recentes e os pacotes com
   coordenadas para exibição no mapa.
4. O administrador cadastra centros logísticos, entregadores e pacotes. Um
   pacote referencia o centro de origem, o administrador pelo CPF cadastrado em
   `users` e, opcionalmente, um entregador disponível.
5. Os formulários de administrador, centro e pacote consultam automaticamente o CEP
   informado pela API interna, que tenta ViaCEP, BrasilAPI e AwesomeAPI. Após
   localizar o CEP, o endereço base é preenchido; confira e complete número e
   complemento antes de salvar.
6. Ao cadastrar um pacote, o endereço de entrega é geocodificado. As
   coordenadas são salvas e o pacote pode aparecer no mapa. O endereço é
   enviado ao serviço externo Nominatim; geocodificações ficam em cache por
   30 dias e as consultas são limitadas a uma por segundo.
7. Para calcular uma rota, o centro de origem precisa ter endereço. O sistema
   geocodifica origem e destino e consulta o OSRM para obter distância, duração
   estimada e geometria da rota.
8. Ao atribuir um pacote a um entregador disponível, seu status passa para
   `em rota`. Quando não há mais pacotes ativos associados, ele pode voltar
   automaticamente para `disponivel`.

O mapa usa OpenStreetMap, Nominatim e OSRM públicos, que não oferecem SLA e
podem limitar ou indisponibilizar consultas. A duração da rota é estimada e não
considera trânsito. As URLs podem ser substituídas por configuração de
ambiente; `MAPS_CONTACT_EMAIL` adiciona um contato ao User-Agent do Nominatim.
O CEP digitado é consultado automaticamente pela API interna após a entrada dos
oito dígitos; também é possível iniciar a consulta pelo botão do formulário. A
API consulta os provedores nacionais ViaCEP, BrasilAPI e AwesomeAPI em sequência
até localizar o CEP. O limite é de quatro segundos por provedor. Após localizar
o CEP, o endereço base é preenchido automaticamente. Confira e complete número
e complemento antes de salvar. Erros de validação, API e conexão aparecem em um
popup global e junto ao formulário quando aplicável. CEP não encontrado retorna
`404`; se todos os provedores estiverem indisponíveis, retorna `503`. O popup
fecha sozinho após alguns segundos ou pelo botão de fechar.

A consulta é por CEP individual e cobre endereços de todo o Brasil; ela não
baixa uma lista completa de CEPs. A rota autenticada `GET /api/cep/{cep}` aceita
oito dígitos, com ou sem hífen. Exemplo: `GET /api/cep/01001-000`. A resposta
inclui `cep`, `logradouro`, `bairro`, `localidade`, `uf` e `endereco`.

## Convenções da API

- Prefixo: `/api`.
- Formato de entrada e saída: JSON.
- Todos os endpoints exigem autenticação Sanctum, exceto `POST /api/login`.
- Envie `Accept: application/json` nas requisições. Para enviar JSON, inclua
  também `Content-Type: application/json`.
- Após autenticar, inclua `Authorization: Bearer SEU_TOKEN`.
- As listagens são paginadas em 15 registros por página e aceitam `?page=2`.
- Validações retornam HTTP `422` com `message` e `errors`.
- Credenciais inválidas também retornam `422`. Token ausente ou inválido
  retorna `401`; recurso inexistente retorna `404`; conflitos de integridade ou
  estado retornam `409`.
- O login limita tentativas a seis por minuto. O cálculo de rota limita
  chamadas a dez por minuto por cliente; exceder os limites retorna `429`.

## Rotas de autenticação e painel

| Método | Rota | Autenticação | Funcionamento |
| --- | --- | --- | --- |
| `POST` | `/api/login` | Não | Recebe `email` e `password`; retorna `token` e dados básicos do usuário. Limitada a seis tentativas por minuto. |
| `POST` | `/api/logout` | Sim | Revoga o token Sanctum usado na chamada. |
| `GET` | `/api/user` | Sim | Retorna o usuário associado ao token atual. |
| `GET` | `/api/dashboard` | Sim | Retorna métricas, distribuição por situação, seis entregas recentes e pacotes geolocalizados. |
| `GET` | `/api/cep/{cep}` | Sim | Consulta CEPs de todo o Brasil via ViaCEP, BrasilAPI e AwesomeAPI, retornando endereço padronizado. Limitada a 60 consultas por minuto. |

O JSON do login tem o formato:

```json
{
  "email": "admin@example.com",
  "password": "sua-senha"
}
```

O dashboard retorna `total_entregas`, `entregas_atrasadas`,
`entregas_concluidas`, `entregadores_disponiveis`, `por_situacao`,
`entregas_recentes`, `pacotes_no_mapa`, `pacotes_mapa` e `atualizado_em`.
Uma entrega é considerada atrasada quando sua data prevista já passou e a
situação ainda é `em separação`, `enviado` ou `em rota`. A lista do mapa inclui
no máximo os 250 pacotes geolocalizados mais recentes.

## Rotas de administradores

Os usuários cadastrados são administradores que podem autenticar no painel. O
CPF é único e identifica o administrador associado ao pacote pelo campo
`cpf_cliente` da API, mantido por compatibilidade.

| Método | Rota | Funcionamento |
| --- | --- | --- |
| `GET` | `/api/usuarios` | Lista usuários paginados. |
| `POST` | `/api/usuarios` | Cadastra usuário. Campos obrigatórios: `name`, `email`, `password`, `endereco`, `telefone` e `cpf`. O CPF deve ter 11 dígitos. |
| `GET` | `/api/usuarios/{usuario}` | Consulta usuário pelo ID. |
| `PUT`, `PATCH` | `/api/usuarios/{usuario}` | Atualiza usuário. Envie apenas os campos que deseja alterar; campos enviados continuam sujeitos às validações de cadastro. |
| `DELETE` | `/api/usuarios/{usuario}` | Exclui usuário. Retorna `409` se houver pacotes associados ao CPF. |

O atributo `password` não é incluído nas respostas. O hash é criado pelo modelo
Laravel; nunca envie ou armazene a senha em texto puro diretamente no banco.

## Rotas de centros logísticos

Um centro pode ter endereço opcional, usado como origem para cálculo de rotas.

| Método | Rota | Funcionamento |
| --- | --- | --- |
| `GET` | `/api/centros-logisticos` | Lista centros paginados. |
| `POST` | `/api/centros-logisticos` | Cadastra centro com `nome_centro`, `responsavel_centro`, `num_entregadores` e, opcionalmente, `endereco_centro`. A quantidade de entregadores deve ser maior ou igual a zero. |
| `GET` | `/api/centros-logisticos/{centro}` | Consulta centro pelo ID. |
| `PUT`, `PATCH` | `/api/centros-logisticos/{centro}` | Atualiza os campos enviados. |
| `DELETE` | `/api/centros-logisticos/{centro}` | Exclui centro; retorna `409` se houver pacotes vinculados. |

`num_entregadores` é informado no cadastro do centro. O modelo atual não
relaciona entregadores a um centro específico.

## Rotas de entregadores

Os status possíveis são `disponivel`, `em rota` e `indisponivel`.

| Método | Rota | Funcionamento |
| --- | --- | --- |
| `GET` | `/api/entregadores` | Lista entregadores paginados. |
| `GET` | `/api/entregadores/disponiveis` | Retorna todos os entregadores disponíveis, ordenados por nome. Usado na criação de pacotes. |
| `POST` | `/api/entregadores` | Cadastra entregador com `nome_entregador` e `num_entregador`; `status` é opcional e assume `disponivel` por padrão. O número deve ser único. |
| `GET` | `/api/entregadores/{entregador}` | Consulta entregador pelo ID. |
| `PUT`, `PATCH` | `/api/entregadores/{entregador}` | Atualiza os campos enviados. |
| `DELETE` | `/api/entregadores/{entregador}` | Exclui entregador. Pacotes que o referenciavam ficam sem entregador atribuído. |

Um entregador com pacotes ativos não pode ser alterado para status diferente de
`em rota`; a tentativa retorna `409`. Pacotes ativos são os que não estão
`entregue` nem `devolvido`.

## Rotas de pacotes

Situações possíveis: `entregue`, `enviado`, `em rota`, `devolvido` e
`em separação`. Na criação, a situação padrão é `em separação`.

| Método | Rota | Funcionamento |
| --- | --- | --- |
| `GET` | `/api/pacotes` | Lista pacotes paginados, incluindo relações com origem, administrador e entregador. |
| `POST` | `/api/pacotes` | Cadastra pacote, geocodifica o endereço e retorna o registro criado com HTTP `201`. |
| `GET` | `/api/pacotes/status` | Retorna a quantidade de pacotes em cada situação, inclusive as que têm quantidade zero. |
| `GET` | `/api/pacotes/{pacote}` | Consulta pacote pelo ID e inclui origem, administrador e entregador. |
| `PUT`, `PATCH` | `/api/pacotes/{pacote}` | Atualiza os campos enviados. Alterar o endereço de entrega atualiza as coordenadas por geocodificação. |
| `DELETE` | `/api/pacotes/{pacote}` | Exclui pacote e sincroniza o status do entregador associado. |
| `GET` | `/api/pacotes/{pacote}/rota` | Calcula rota entre o centro de origem e o endereço de entrega. Limitada a dez chamadas por minuto. |

Campos obrigatórios para criar pacote:

| Campo | Regra |
| --- | --- |
| `cod_rastreio` | Texto único. |
| `nome_destinatario` | Texto. |
| `endereco_entrega` | Texto localizável pelo provedor de mapas. |
| `id_origem` | ID de um centro logístico cadastrado. |
| `cpf_cliente` | CPF de 11 dígitos de um administrador cadastrado em `users.cpf`. O nome do campo é mantido por compatibilidade. |
| `data_prevista` | Data no formato `YYYY-MM-DD`. |
| `id_entregador_responsavel` | Opcional e anulável; se informado, deve ser um entregador disponível. |
| `situacao` | Opcional na criação; deve corresponder a uma das situações listadas. |

Se o endereço não for localizado, o cadastro/alteração retorna `422`. Se o
provedor de geocodificação estiver indisponível, retorna `502`. Na rota, o
centro precisa ter `endereco_centro`; se faltar, a API retorna `422`. A
resposta de rota contém origem, destino, `distancia_km`, `duracao_minutos`,
`geometria` e nome do provedor. A duração não representa trânsito em tempo
real.

Exemplo de criação:

```json
{
  "cod_rastreio": "BR123456789",
  "nome_destinatario": "Maria da Silva",
  "endereco_entrega": "Avenida Paulista, 1000, São Paulo, SP",
  "id_origem": 1,
  "id_entregador_responsavel": null,
  "situacao": "em separação",
  "cpf_cliente": "12345678901",
  "data_prevista": "2026-12-01"
}
```

O CPF do exemplo precisa corresponder ao CPF de um administrador existente no banco. Ao
atribuir um entregador, a API verifica novamente sua disponibilidade dentro da
transação para evitar atribuição simultânea incompatível.

## Interface React

- A tela de login autentica pela API e mantém a sessão no armazenamento
  `sessionStorage` do navegador.
- O dashboard atualiza os dados periodicamente e apresenta os totais, atrasos,
  entregas concluídas, disponibilidade da equipe, distribuição por situação,
  entregas recentes e mapa.
- O atalho de pacote abre o formulário de criação. O formulário permite
  selecionar um centro, escolher entregador disponível ou deixar a atribuição
  para depois, e informa o CPF do administrador associado ao pacote.
- O atalho de centros permite cadastrar centros logísticos; também é possível
  criar um centro durante o fluxo de pacote sem perder os dados preenchidos.
- Os menus de pacotes, centros logísticos, administradores e entregadores permitem
  cadastrar os registros compatíveis e abrir suas listagens paginadas.
- O cadastro de administrador solicita nome, e-mail, senha, endereço, telefone
  e CPF. Como administradores são registros da tabela `users`, e-mail e CPF
  devem ser únicos; o CPF cadastrado pode então ser vinculado ao pacote.
- A listagem de pacotes mostra rastreamento, destinatário, administrador, centro de
  origem, situação e previsão. As demais listagens mostram os dados principais
  de centros, administradores e entregadores.
- Encerrar sessão revoga o token atual na API.

## Estrutura principal do código

| Caminho | Responsabilidade |
| --- | --- |
| `routes/api.php` | Declara endpoints, autenticação e limites de requisição. |
| `routes/web.php` | Entrega a aplicação React na rota `/`. |
| `app/Http/Controllers/Api/` | Implementa autenticação, CRUDs, dashboard e rotas. |
| `app/Models/` | Modelos Eloquent e relacionamentos. |
| `app/Enums/` | Situações válidas de pacotes e status de entregadores. |
| `app/Services/OpenStreetMapRoutingService.php` | Geocodificação Nominatim, cache e consulta OSRM. |
| `resources/js/app.jsx` | Interface React, formulários, chamadas à API e dashboard. |
| `resources/css/app.css` | Estilos da interface. |
| `database/migrations/` | Esquema e alterações do banco de dados. |
| `tests/Feature/LogisticsApiTest.php` | Testes de integração da API de logística. |

# Design Técnico — MVP Trip (Assessor de Viagem)

- **Status:** aprovado para plano de implementação
- **Data:** 2026-08-27
- **Autor:** Felippe Butland
- **Documento pai:** `PRD.md` (seções 4 e 5, fase MVP)

---

## 1. Objetivo e escopo

Entregar o **slice vertical do MVP**: da conta do usuário até um roteiro de viagem
salvo e ajustável por chat.

### 1.1 Dentro do escopo
1. Autenticação (Supabase: e-mail + Google).
2. Onboarding de gosto (questionário → perfil persistido).
3. Descoberta de destino (datas/duração + origem + orçamento + perfil → 3–5 destinos rankeados).
4. Roteiro dia a dia para o destino escolhido (geração assíncrona, editável).
5. Busca de voos (Amadeus) — lista + deep link.
6. Busca de hotéis (Amadeus) — lista por região + deep link.
7. Restaurantes / POIs (Google Places) encaixados no roteiro.
8. Chat IA que edita o estado da viagem via tool-calling.
9. Salvar múltiplas viagens + histórico.

### 1.2 Fora do escopo (fases posteriores)
Motor de milhas, alertas de preço, datas flexíveis, assinatura premium / billing,
consultoria paga, colaboração em grupo, reserva integrada (checkout), app mobile,
modo B2B, experiências/tours.

### 1.3 Critérios de sucesso do MVP (técnico)
- Usuário completa o fluxo descoberta → roteiro em uma sessão.
- Geração de roteiro p95 ≤ 15 s (via job + polling; não bloqueia request).
- Chamadas a Amadeus e Places com retry, cache e degradação graciosa.
- Custo de LLM por roteiro medido e visível em log/observabilidade.
- Cobertura de testes conforme pipeline TDD (`.spec.ts` primeiro).

---

## 2. Decisões de arquitetura (registradas)

| # | Decisão | Motivo |
|---|---|---|
| D1 | Monorepo **Turborepo** | Compartilhar schema, tipos e lógica entre web e api sem publicar pacotes |
| D2 | `apps/web` = **Next.js** só frontend (App Router) | SSR + DX; sem lógica de negócio |
| D3 | `apps/api` = **NestJS** | Estrutura opinativa, DI, módulos — escala com o time |
| D4 | `apps/worker` = 2º processo NestJS | Jobs longos fora do ciclo HTTP; reaproveitado pelos alertas do v1 |
| D5 | **Supabase**: Auth + Postgres + Storage | Uma peça só para identidade e dados |
| D6 | **Drizzle** ORM | SQL-first, type-safe, leve, integra bem com Postgres do Supabase |
| D7 | Fila = **pg-boss** (schema no próprio Postgres) | Sem Redis no MVP; retry/backoff prontos |
| D8 | Providers reais: **Amadeus Self-Service** (voo + hotel) + **Google Places** (POI) | Sandbox gratuito, começa hoje, um contrato só |
| D9 | LLM = **Claude (Anthropic)** | Roteamento por tarefa (descoberta/roteiro/chat = modelo capaz; extração = modelo barato) |
| D10 | Monetização de afiliado **fora do MVP** | Amadeus Self-Service é data-only; MVP faz deep-link para site de reserva |
| D11 | Hospedagem **agnóstica** | Design fixa só: container + Postgres + variáveis de ambiente |
| D12 | `api` **stateless**; todo estado no Postgres | Escala horizontal, sem sessão em memória |

---

## 3. Estrutura do monorepo

```
trip/
├── apps/
│   ├── web/                Next.js (App Router)
│   │   ├── app/            rotas, layouts, server components
│   │   ├── components/
│   │   └── lib/            supabase client, api client (fetch + Bearer)
│   ├── api/                NestJS (HTTP)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── modules/    (ver seção 4)
│   │   │   └── common/     guards, filters, interceptors, config
│   │   └── test/
│   └── worker/             NestJS (bootstrap sem HTTP; só JobsModule + deps)
│       └── src/main.worker.ts
├── packages/
│   ├── db/                 schema Drizzle, migrations, client factory
│   ├── domain/             lógica pura: scoring de destino, montagem de roteiro
│   ├── providers/          interfaces + AmadeusFlight/AmadeusHotel/GooglePlaces
│   └── shared/             DTOs, tipos, zod schemas, erros de domínio
├── turbo.json
├── package.json            workspaces
└── tsconfig.base.json
```

**Regras de dependência:**
- `web` → `shared` (tipos/DTOs) apenas. Nunca importa `db`, `domain`, `providers`.
- `api` e `worker` → `db`, `domain`, `providers`, `shared`.
- `domain` → `shared` apenas (lógica pura, sem I/O, sem NestJS).
- `providers` → `shared`. Sem NestJS (classes simples injetáveis por token).

---

## 4. Módulos do `apps/api`

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `ConfigModule` | Env validada com zod (`@nestjs/config`) | — |
| `AuthModule` | Verifica JWT do Supabase (JWKS), `AuthGuard`, `@CurrentUser()`, upsert em `users` | ConfigModule |
| `ProfileModule` | CRUD do `taste_profile` | db |
| `TripsModule` | CRUD de viagens; expõe o agregado `TripState`; aplica mutações vindas do chat | db, domain |
| `DiscoveryModule` | Recomendação de destino: pré-filtro no catálogo + ranking via LLM | db, domain, LlmModule |
| `ItineraryModule` | Enfileira `itinerary.generate`; lê/serve itinerário; regenera dia | db, JobsModule |
| `FlightsModule` | Busca de voos via `providers`; cache | providers, db |
| `HotelsModule` | Busca de hotéis via `providers`; cache | providers, db |
| `PlacesModule` | Google Places: search + details; usado no enrich do roteiro | providers, db |
| `ChatModule` | Endpoint conversacional; loop de tool-calling do Claude; persiste `chat_messages` | LlmModule, TripsModule, ItineraryModule, Flights/Hotels/Places |
| `JobsModule` | Setup pg-boss, registro de handlers, retry/backoff, dead-letter log | db |
| `LlmModule` | Client Claude, templates de prompt, roteamento de modelo, contagem de tokens/custo | ConfigModule |
| `HealthModule` | `/health` (db, pg-boss, Amadeus token) | db |

O `apps/worker` faz bootstrap só de `ConfigModule`, `JobsModule`, `ItineraryModule`,
`PlacesModule`, `LlmModule` e `db` — sem servidor HTTP.

---

## 5. Modelo de dados (Drizzle — `packages/db`)

Postgres do Supabase. IDs `uuid` (default `gen_random_uuid()`), timestamps `timestamptz`.
`users.id` = `auth.users.id` do Supabase.

### 5.1 Tabelas

**users**
- `id` uuid PK (= Supabase auth uid)
- `email` text not null
- `display_name` text
- `created_at` timestamptz default now()

**taste_profiles**
- `id` uuid PK
- `user_id` uuid FK → users, unique
- `interests` jsonb — `["praia","cultura","gastronomia",...]`
- `pace` text — `relaxado | moderado | intenso`
- `party_type` text — `sozinho | casal | familia | amigos`
- `budget_band` text — `economico | medio | conforto | luxo`
- `constraints` jsonb — `{ mobilidade: bool, kids: bool, pet: bool, restricoes_alimentares: [] }`
- `updated_at` timestamptz

**trips**
- `id` uuid PK
- `user_id` uuid FK → users
- `status` text — `draft | planned | done`
- `title` text
- `origin_iata` text — aeroporto/cidade de origem
- `date_start` date null
- `date_end` date null
- `duration_days` int null — usado quando datas não fixas
- `target_month` text null — `YYYY-MM` aproximado
- `party` jsonb — `{ adults: int, children: int }`
- `budget_total` numeric null
- `currency` text default `BRL`
- `chosen_destination_id` uuid null FK → trip_destinations
- `created_at` / `updated_at`

**trip_destinations** (candidatos e escolhido)
- `id` uuid PK
- `trip_id` uuid FK → trips
- `city` text / `country` text / `iata` text
- `score` numeric — aderência ao perfil (0–1)
- `rationale` text — justificativa personalizada (2–3 frases)
- `est_cost` jsonb — `{ flight: n, lodging_per_night: n, daily_local: n, currency }`
- `climate` jsonb — `{ expected_c: n, summary: text, best_months: [] }`
- `flight_time_hours` numeric
- `chosen` boolean default false
- `created_at`

**itineraries** (versionado)
- `id` uuid PK
- `trip_id` uuid FK → trips
- `version` int — incrementa a cada regeneração completa
- `status` text — `pending | ready | failed`
- `error` text null
- `generated_at` timestamptz null
- `created_at`

**itinerary_days**
- `id` uuid PK
- `itinerary_id` uuid FK → itineraries
- `day_index` int — 1..N
- `date` date null
- `notes` text null

**itinerary_items**
- `id` uuid PK
- `day_id` uuid FK → itinerary_days
- `slot` text — `morning | afternoon | evening`
- `type` text — `activity | meal | transfer | free`
- `title` text
- `description` text null
- `place_id` text null — Google Place ID
- `lat` / `lng` numeric null
- `rating` numeric null
- `duration_min` int null
- `est_cost` numeric null
- `sort_order` int
- `pinned` boolean default false — protegido na regeneração

**flight_selections**
- `id` uuid PK
- `trip_id` uuid FK → trips
- `offer` jsonb — snapshot cru da offer Amadeus
- `price` numeric / `currency` text
- `carrier` text / `stops` int / `depart_at` timestamptz / `return_at` timestamptz null
- `deep_link` text
- `selected_at` timestamptz

**hotel_selections**
- `id` uuid PK
- `trip_id` uuid FK → trips
- `offer` jsonb — snapshot cru
- `name` text / `region` text
- `price_per_night` numeric / `price_total` numeric / `currency` text
- `rating` numeric
- `deep_link` text
- `selected_at` timestamptz

**chat_messages**
- `id` uuid PK
- `trip_id` uuid FK → trips
- `role` text — `user | assistant | tool`
- `content` text
- `tool_calls` jsonb null — chamadas emitidas / resultados
- `created_at`

**provider_cache**
- `key` text PK — hash determinístico dos params + provider + endpoint
- `provider` text — `amadeus_flight | amadeus_hotel | google_places`
- `payload` jsonb
- `fetched_at` timestamptz
- `expires_at` timestamptz — TTL: voo 10 min, hotel 1 h, places 24 h

### 5.2 Índices principais
- `trips (user_id, status)`
- `trip_destinations (trip_id)`
- `itineraries (trip_id, version desc)`
- `itinerary_days (itinerary_id, day_index)`
- `itinerary_items (day_id, sort_order)`
- `chat_messages (trip_id, created_at)`
- `provider_cache (expires_at)` — para limpeza

### 5.3 RLS
RLS **desligada** nas tabelas de aplicação: o acesso passa sempre pela `api` com
`service_role`, e a autorização é feita na camada de serviço (`trip.user_id === currentUser.id`).
Supabase Auth é usado só para identidade. (Revisar se algum dia o `web` acessar o DB direto.)

---

## 6. Orquestração de IA (`LlmModule` + módulos de domínio)

### 6.1 Catálogo de destinos (seed)
- Arquivo curado em `packages/domain/data/destinations.csv` (~200 cidades no MVP).
- Colunas: `city, country, iata, tags[], best_months[], avg_flight_cost_from_gru, avg_lodging_night, avg_daily_local, region, visa_free_br(bool)`.
- Carregado para a tabela `destination_catalog` por seed script (migration de dados).
- **Questão aberta Q1:** fonte e processo de curadoria/atualização do catálogo pós-MVP.

### 6.2 Descoberta de destino
```
Input: taste_profile + trip (origem, datas/duração, orçamento, party)
 1. Pré-filtro determinístico (domain):
      - orçamento compatível (voo + lodging estimados)
      - melhor época casa com target_month / date_start
      - visto (visa_free_br) se internacional
      - descarta destinos já rejeitados nesta trip
    → shortlist de ~20
 2. LlmService.rankDestinations(shortlist, profile, trip):
      - Claude recebe a shortlist como dados
      - DEVE escolher 3–5 da shortlist (não inventa destino)
      - retorna JSON: [{ iata, score, rationale }]
      - saída validada com zod; se inválida → 1 retry com feedback; senão erro tratado
 3. Persistir em trip_destinations (chosen=false)
```
Modelo: capaz. Sem streaming (resposta rápida, JSON pequeno).

### 6.3 Geração de roteiro (job `itinerary.generate`)
```
 1. ItineraryModule cria itineraries(status=pending, version=N) e enfileira job
 2. Worker:
    a. LlmService.buildItinerary(destination, duration, pace, interests, party):
         - Claude retorna estrutura dia a dia em JSON schema forçado
           (days[].slots[] com type/title/description/duration_min/est_cost)
         - itens pinned da versão anterior são passados como fixos
    b. Enrich (PlacesModule): para itens type in (activity, meal) sem place_id:
         - Google Places Text Search por title + cidade
         - anexa place_id, lat/lng, rating; se nada → mantém item, marca needs_review
         - refeições: se slot sem meal, busca restaurante por cozinha/preço perto do centroide do dia
    c. Persistir itinerary_days + itinerary_items; itineraries.status=ready, generated_at=now
    d. Falha em qualquer passo → status=failed, error=...; retry do pg-boss (máx 3, backoff exp.)
 3. Web faz polling GET /trips/:id/itinerary até status != pending
```

### 6.4 Chat (`ChatModule`)
- Endpoint: `POST /trips/:id/chat { message }` → resposta com estado atualizado + texto do assistente.
- Loop de tool-calling do Claude. **Tools (mapeadas 1:1 para métodos de serviço):**

| Tool | Efeito |
|---|---|
| `set_destination(iata)` | Marca `chosen` em `trip_destinations`; invalida itinerário |
| `shift_dates(date_start, date_end)` \| `set_duration(days)` | Atualiza `trips`; marca itinerário para regenerar |
| `set_budget(total)` | Atualiza `trips` |
| `add_interest(tag)` / `remove_interest(tag)` | Atualiza `taste_profiles` |
| `regenerate_day(day_index)` | Enfileira `itinerary.regenerate-day` (respeita itens `pinned`) |
| `remove_item(item_id)` / `pin_item(item_id)` | Muta `itinerary_items` |
| `find_hotel(near?)` | Chama `HotelsModule.search`; retorna opções (não seleciona sozinho) |
| `swap_restaurant(item_id, cuisine?)` | Places search + substitui o item |
| `search_flights()` | Chama `FlightsModule.search`; retorna opções |

- **Fonte da verdade = estado da viagem no Postgres.** O chat só dispara mutações; a UI
  relê o `TripState` após cada resposta.
- Cada turno persiste `chat_messages` (user, tool calls/results, assistant).
- **Undo:** regeneração completa cria nova `version`; voltar = apontar para a versão anterior.
  Mutações pontuais (remove/pin) não têm undo no MVP (aceitável) — registrado como Q2.
- Guard-rails: máx N turnos por minuto por usuário; máx tokens por turno; timeout por tool.

### 6.5 Orçamento de custo LLM
- `LlmModule` loga por chamada: modelo, tokens in/out, custo estimado, latência, `trip_id`.
- **Questão aberta Q3:** teto de custo por roteiro (definir número; alertar acima dele).
- Roteamento: descoberta e roteiro = modelo capaz; normalização/extração e classificação
  de intenção simples = modelo barato.

---

## 7. Camada de providers (`packages/providers`)

### 7.1 Interfaces
```ts
interface FlightProvider {
  search(params: FlightSearchParams): Promise<FlightOffer[]>;
}
interface HotelProvider {
  search(params: HotelSearchParams): Promise<HotelOffer[]>;
}
interface PlacesProvider {
  textSearch(params: PlacesSearchParams): Promise<Place[]>;
  details(placeId: string): Promise<PlaceDetails>;
}
```
Params e retornos (DTOs normalizados) vivem em `packages/shared`.

### 7.2 Implementações
- `AmadeusFlightProvider` — `GET /v2/shopping/flight-offers`.
- `AmadeusHotelProvider` — `GET /v3/shopping/hotel-offers` (+ lista de hotéis por cidade).
- `GooglePlacesProvider` — Places API (Text Search + Place Details).
- **Amadeus auth:** OAuth2 client-credentials; token cacheado em memória com margem
  antes do expiry; `AMADEUS_BASE_URL` configurável (`test` → `prod` sem mudar código).
- **Normalização:** resposta do provider → DTO; snapshot cru guardado em `*_selections.offer`.
- **Resiliência:** `p-retry` com backoff exponencial (429/5xx), timeout por chamada,
  circuit breaker simples (abre após N falhas seguidas, meio-aberto após cooldown).
- **Cache:** `provider_cache` com chave = hash(provider+endpoint+params); TTL da seção 5.1.
- **Deep link:** `flight_selections.deep_link` / `hotel_selections.deep_link` apontam para
  site de reserva parceiro (sem afiliado no MVP — D10).

### 7.3 Degradação graciosa
- Places falha no enrich → item do roteiro renderiza sem lugar real, flag `needs_review`.
- Amadeus hotel falha → roteiro e voo seguem; seção de hotel mostra estado de erro + retry.
- Amadeus flight falha → idem, seção de voo isolada.

---

## 8. Autenticação e autorização

```
web (supabase-js): signup / login / OAuth Google
   ↓ obtém access_token (JWT) do Supabase
web → api: Authorization: Bearer <access_token>
api AuthGuard:
   - valida assinatura via JWKS do Supabase (cache das chaves)
   - extrai sub (= user id), email
   - upsert em users no primeiro acesso
   - injeta CurrentUser no request
Autorização: cada serviço confere recurso.user_id === currentUser.id
```
- `api` não guarda sessão. Refresh de token é responsabilidade do `web` (supabase-js).
- Rotas de leitura pública: nenhuma no MVP (tudo autenticado).

---

## 9. Jobs (`JobsModule` + `apps/worker`)

- **pg-boss** no Postgres do Supabase, schema `pgboss` (isolado do schema de aplicação).
- Sem Redis.
- Filas / jobs:
  - `itinerary.generate` — geração completa.
  - `itinerary.regenerate-day` — um dia, respeitando `pinned`.
  - `places.enrich` — reprocessa itens `needs_review` (retry manual ou agendado).
- Config: `retryLimit: 3`, `retryBackoff: true`, `expireInMinutes: 5`.
- Falha final → job vai para arquivado + log estruturado (pino) com `trip_id` e causa.
- `apps/worker` roda o mesmo código dos módulos, sem HTTP. Escala independente do `api`.

---

## 10. Preocupações transversais

| Tema | Decisão |
|---|---|
| Validação | zod em toda borda: DTOs de entrada da `api`, saídas do LLM, respostas de provider |
| Erros | Erros de domínio tipados (`packages/shared`) → `ExceptionFilter` mapeia para HTTP; nunca vaza stack para o cliente |
| Config | `@nestjs/config` + schema zod; falha no boot se env inválida; segredos só via env var |
| Logging | `pino` com request id; um span por chamada LLM/provider com latência + custo |
| Observabilidade | métricas: latência p50/p95 por endpoint e por provider, custo LLM por trip, taxa de erro de provider |
| Rate limiting | `@nestjs/throttler` global; limites extra no `ChatModule` |
| CORS | `web` origin allowlist por env |
| Segredos | `SUPABASE_SERVICE_ROLE_KEY`, `AMADEUS_CLIENT_ID/SECRET`, `GOOGLE_PLACES_KEY`, `ANTHROPIC_API_KEY` |
| i18n | textos do produto externalizados; PT-BR default (conforme PRD) |
| LGPD | consentimento no onboarding; sem conexão de contas de milhas no MVP (nada sensível de fidelidade ainda) |

---

## 11. Estratégia de testes (pipeline TDD do CLAUDE.md)

- **`.spec.ts` primeiro** para cada serviço novo.
- **Unit:** `domain` (pré-filtro de destino, montagem de roteiro, cálculo de centroide/proximidade)
  100% puro, sem mock. Serviços da `api` com `providers` e `LlmModule` mockados.
- **Contrato de provider:** testes contra fixtures gravadas (respostas reais do sandbox
  Amadeus / Places salvas em `__fixtures__`); sem rede no CI.
- **Integração (happy path):**
  1. descoberta: perfil + trip → 3–5 destinos persistidos.
  2. roteiro: destino escolhido → job → `itineraries.status = ready` com dias e itens.
  3. chat: `remove_item` → item some do `TripState`.
- **E2E (mínimo):** um fluxo Playwright no `web` — login (usuário seed) → onboarding →
  descoberta → escolher destino → ver roteiro.
- LLM em teste: modo `LlmService` fake determinístico (retorna JSON fixo por prompt key).

---

## 12. Questões abertas

| ID | Questão | Encaminhamento |
|---|---|---|
| Q1 | Catálogo de destinos: fonte e processo de atualização pós-seed | Começar com CSV curado (~200 cidades); revisar no v1 |
| Q2 | Undo de mutações pontuais no chat (remove/pin item) | Fora do MVP; avaliar event log no v1 |
| Q3 | Teto de custo de LLM por roteiro | Definir número antes do início da implementação |
| Q4 | Hospedagem final (container onde?) | Adiada; design é agnóstico (container + Postgres + env) |
| Q5 | Deep-link: qual site parceiro de reserva para voo/hotel no MVP | Definir na fase de implementação (Skyscanner/Booking públicos servem) |
| Q6 | Migrations do Drizzle no Supabase: `drizzle-kit push` vs migrations versionadas | Usar migrations versionadas desde o início |

---

## 13. Fora de escopo deste design (vai para o próximo ciclo)

Motor de milhas (arquitetura própria: base de regras, valor do ponto, integrações),
alertas + notificações (worker + agendador + canais), billing/premium (gateway + webhooks +
paywall), colaboração em grupo (realtime + permissões), reserva integrada (merchant of record).

---

## Apêndice — Fluxo de sequência (descoberta → roteiro)

```
Usuário → web: preenche datas/origem/orçamento
web → api: POST /trips  (cria trip draft)
web → api: POST /trips/:id/discovery
  api: pré-filtro (domain) → shortlist
  api → Claude: rankDestinations(shortlist, profile)
  api ← Claude: JSON [3–5 destinos]
  api → db: insert trip_destinations
web ← api: lista de destinos + rationale
Usuário → web: escolhe destino
web → api: POST /trips/:id/destination { iata }
  api → db: chosen=true; cria itineraries(pending)
  api → pg-boss: enqueue itinerary.generate
web → api: GET /trips/:id/itinerary  (polling)
  worker: Claude buildItinerary → Places enrich → db insert dias/itens → status=ready
web ← api: itinerário pronto
Usuário → web: "tira o segundo dia de museu"
web → api: POST /trips/:id/chat { message }
  api → Claude: tool-calling → regenerate_day(2)
  api → pg-boss: enqueue itinerary.regenerate-day
web ← api: TripState atualizado + resposta do assistente
```

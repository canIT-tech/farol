# Providers Amadeus (voo + hotel) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buscar voos e hotéis reais para uma viagem via Amadeus Self-Service, com token OAuth2 em cache, retry, circuit breaker e cache de resposta com TTL; normalizar para DTOs, guardar o snapshot cru na seleção e devolver deep link para o parceiro de reserva. Falha de provider degrada a seção sem derrubar o resto.

**Architecture:** `packages/providers` define `FlightProvider` / `HotelProvider` e as implementações Amadeus. `AmadeusAuth` guarda o token client-credentials com margem antes do `exp`. Um cliente HTTP com `p-retry` (429/5xx) + circuit breaker simples. `apps/api` `FlightsModule` / `HotelsModule` orquestram: chave de cache = hash(provider+endpoint+params), TTL curto (voo 10 min, hotel 1 h); em cache miss chamam o provider; persistem a seleção do usuário em `flight_selections` / `hotel_selections` com a `offer` crua e o `deep_link`.

**Tech Stack:** herda dos Planos 1–4. Novo: `p-retry`.

**Spec:** `docs/superpowers/specs/2026-08-27-mvp-trip-design.md` §5 (`provider_cache`, `flight_selections`, `hotel_selections`), §7 (camada de providers), §7.2 (Amadeus auth, normalização, deep link), §7.3 (degradação graciosa), D10 (sem afiliado no MVP). Telas: `FlightsHotels.dc.html`, `AutoPlan.dc.html`.

## Global Constraints

- Herdam dos Planos 1–4 (pnpm, Node 22, cobertura 100% por pacote, mutação ≥ 90%, TDD, `@farol/*`, env com zod, PT-BR, DoD = testes completos).
- **`packages/providers` não depende de NestJS** — classes simples, injetadas por token na `api`.
- **Sem rede no CI:** testes de provider rodam contra fixtures gravadas em `packages/providers/src/**/__fixtures__/` (respostas reais do sandbox Amadeus, capturadas uma vez e versionadas). O cliente HTTP recebe um `fetchImpl` injetável.
- **Amadeus:** `AMADEUS_BASE_URL` (default `https://test.api.amadeus.com`), `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`. Trocar `test` → `production` é só env.
- **Deep link:** template configurável por env — `FLIGHT_DEEPLINK_TEMPLATE`, `HOTEL_DEEPLINK_TEMPLATE` (default apontando para busca pública do parceiro; Q5 do PRD — parceiro definitivo ainda em aberto).
- **Degradação graciosa (§7.3):** endpoint responde `200 { offers: [], stale: false, error: "unavailable" }` quando o provider falha após os retries — a UI renderiza a seção com estado de erro, não quebra a página.
- **Sem afiliado (D10):** nada de tracking de comissão; só `deep_link`.

---

### Task 1: `packages/db` — `provider_cache`, `flight_selections`, `hotel_selections` + migration

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0004_*.sql`
- Test: `packages/db/src/schema.spec.ts` (novos casos)

**Interfaces:**
- Produces (colunas conforme design §5.1):
  - `provider_cache`: `key text pk`, `provider text notNull`, `payload jsonb notNull`, `fetchedAt timestamptz notNull defaultNow()`, `expiresAt timestamptz notNull`. Índice `provider_cache (expiresAt)`.
  - `flight_selections`: `id uuid pk`, `tripId uuid notNull → trips.id onDelete cascade`, `offer jsonb notNull`, `price numeric notNull`, `currency text notNull`, `carrier text`, `stops integer`, `departAt timestamptz`, `returnAt timestamptz`, `deepLink text notNull`, `selectedAt timestamptz notNull defaultNow()`
  - `hotel_selections`: `id uuid pk`, `tripId uuid notNull → trips.id onDelete cascade`, `offer jsonb notNull`, `name text notNull`, `region text`, `pricePerNight numeric notNull`, `priceTotal numeric`, `currency text notNull`, `rating numeric`, `deepLink text notNull`, `selectedAt timestamptz notNull defaultNow()`
  - re-export das três no `index.ts`

- [ ] **Step 1: Casos de teste (falham)** — `provider_cache.key` é pk; `expiresAt` notNull; `flight_selections.offer` e `deepLink` notNull; FK em cascade.

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/db vitest run`

- [ ] **Step 3: Implementar o schema.** Re-export no `index.ts`.

- [ ] **Step 4: Gerar migration + aplicar + testar** — `db:generate` → `0004_*.sql` revisada; `db:migrate`; `pnpm --filter @farol/db test` verde, 100%.

- [ ] **Step 5: Commit** — `feat(db): provider_cache, flight_selections e hotel_selections + migration 0004`

---

### Task 2: `packages/shared` — DTOs de busca e ofertas

**Files:**
- Create: `packages/shared/src/flights.ts`, `packages/shared/src/hotels.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/flights.spec.ts`, `packages/shared/src/hotels.spec.ts`

**Interfaces:**
- Produces:
  - `flightSearchParamsSchema`: `{ originIata: string(3); destinationIata: string(3); departDate: isoDate; returnDate: isoDate.optional(); adults: int ≥ 1; children: int ≥ 0; maxStops: int.optional() }`
  - `flightOfferSchema`: `{ id: string; price: number; currency: string; carrier: string; stops: int; departAt: string; arriveAt: string; returnAt: string | null; durationMinutes: int; deepLink: string }`
  - `hotelSearchParamsSchema`: `{ cityCode: string; checkIn: isoDate; checkOut: isoDate; adults: int ≥ 1; radiusKm: int.optional() }`
  - `hotelOfferSchema`: `{ id: string; name: string; region: string | null; pricePerNight: number; priceTotal: number; currency: string; rating: number | null; deepLink: string }`
  - `providerSectionSchema<T>(item)` → `{ offers: T[]; stale: boolean; error: "unavailable" | null }`
  - tipos: `FlightSearchParams`, `FlightOffer`, `HotelSearchParams`, `HotelOffer`, `ProviderSection<T>`

- [ ] **Step 1: Testes (falham)** — `flightSearchParamsSchema`: rejeita iata de 2 letras; `returnDate` opcional; `adults` mín. 1. `flightOfferSchema`: `stops` int não-negativo; `deepLink` url.

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/shared vitest run`

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Run — passa (100%) + mutação.**

- [ ] **Step 5: Commit** — `feat(shared): DTOs de busca e oferta de voo e hotel`

---

### Task 3: `packages/providers` — `AmadeusAuth` + cliente HTTP resiliente

**Files:**
- Create: `packages/providers/src/amadeus/amadeus-auth.ts`, `packages/providers/src/amadeus/http.ts`, `packages/providers/src/http/circuit-breaker.ts`
- Modify: `packages/providers/package.json` (`p-retry`), `packages/providers/src/index.ts`
- Test: `packages/providers/src/amadeus/amadeus-auth.spec.ts`, `packages/providers/src/http/circuit-breaker.spec.ts`, `packages/providers/src/amadeus/http.spec.ts`

**Interfaces:**
- Produces:
  - `AmadeusAuth(cfg: { baseUrl: string; clientId: string; clientSecret: string; fetchImpl?: typeof fetch; now?: () => number })`
    - `getToken(): Promise<string>` — `POST /v1/security/oauth2/token` (grant_type=client_credentials); guarda `access_token` + `expiresAt = now + expires_in*1000 - 30_000`; só refaz quando expirado.
  - `CircuitBreaker(cfg: { failureThreshold: number; cooldownMs: number; now?: () => number })`
    - `exec<T>(fn: () => Promise<T>): Promise<T>` — `closed` → executa; N falhas seguidas → `open` (rejeita `CircuitOpenError` sem chamar `fn`); após `cooldownMs` → `half-open` (1 tentativa; sucesso fecha, falha reabre).
  - `amadeusGet<T>(cfg, path: string, query: Record<string,string>): Promise<T>` — anexa `Authorization: Bearer <token>`, `p-retry` (retries 3, só em 429/5xx e erro de rede), passa por `CircuitBreaker`; erros não-retryáveis (4xx exceto 429) propagam na hora.

- [ ] **Step 1: Testes (falham)**
  - `AmadeusAuth`: primeira chamada busca token; segunda (antes do `exp`) não busca; após `exp` (via `now` mockado) busca de novo.
  - `CircuitBreaker`: abre após N falhas; rejeita rápido enquanto `open`; meia-abertura após cooldown; sucesso fecha.
  - `amadeusGet`: retenta em 503 e sucede; não retenta em 400; anexa o Bearer (checar header no `fetchImpl` fake).

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/providers vitest run`

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Run — passa (100%) + mutação (mirar 100 no circuit breaker).**

- [ ] **Step 5: Commit** — `feat(providers): AmadeusAuth com cache de token + cliente HTTP com retry e circuit breaker`

---

### Task 4: `packages/providers` — `AmadeusFlightProvider`

**Files:**
- Create: `packages/providers/src/amadeus/amadeus-flight-provider.ts`, `packages/providers/src/amadeus/__fixtures__/flight-offers.json`, `packages/providers/src/amadeus/normalize-flight.ts`
- Modify: `packages/providers/src/index.ts`
- Test: `packages/providers/src/amadeus/amadeus-flight-provider.spec.ts`, `packages/providers/src/amadeus/normalize-flight.spec.ts`

**Interfaces:**
- Consumes: `amadeusGet`, `flightSearchParamsSchema`, `flightOfferSchema` (`@farol/shared`), `FLIGHT_DEEPLINK_TEMPLATE`.
- Produces:
  - `interface FlightProvider { search(params: FlightSearchParams): Promise<FlightOffer[]> }`
  - `AmadeusFlightProvider(cfg & { deepLinkTemplate: string }) implements FlightProvider` — `GET /v2/shopping/flight-offers` com os params traduzidos; `normalizeFlight(raw, template)` → `FlightOffer[]` (id do Amadeus, preço total, carrier do primeiro segmento, contagem de escalas, `deepLink` = template com placeholders substituídos); ordena por preço asc; corta `maxStops` se veio.
  - `normalizeFlight(raw: unknown, template: string): FlightOffer[]` — pura, testável isolada.

- [ ] **Step 1: Testes (falham)** — `normalizeFlight` contra `__fixtures__/flight-offers.json`: N ofertas, campos batendo `flightOfferSchema`, `stops` correto, `deepLink` com origem/destino/datas preenchidos. `AmadeusFlightProvider.search`: usa `fetchImpl` fake retornando a fixture → devolve ofertas ordenadas; `maxStops: 0` filtra as com escala.

- [ ] **Step 2: Run — falha.** (gravar a fixture a partir de uma chamada real ao sandbox uma vez, fora do CI, e commitar)

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Run — passa (100%) + mutação.**

- [ ] **Step 5: Commit** — `feat(providers): AmadeusFlightProvider com normalização e deep link`

---

### Task 5: `packages/providers` — `AmadeusHotelProvider`

**Files:**
- Create: `packages/providers/src/amadeus/amadeus-hotel-provider.ts`, `packages/providers/src/amadeus/__fixtures__/hotel-list.json`, `packages/providers/src/amadeus/__fixtures__/hotel-offers.json`, `packages/providers/src/amadeus/normalize-hotel.ts`
- Test: análogo à Task 4

**Interfaces:**
- Produces:
  - `interface HotelProvider { search(params: HotelSearchParams): Promise<HotelOffer[]> }`
  - `AmadeusHotelProvider` — `GET /v1/reference-data/locations/hotels/by-city` para a lista de `hotelIds` da cidade, depois `GET /v3/shopping/hotel-offers` com esses ids + datas; `normalizeHotel(rawList, rawOffers, template)` → `HotelOffer[]` (nome, `pricePerNight` = total/noites, `priceTotal`, `rating` se houver, `region` do bairro se disponível senão `null`, `deepLink`); ordena por `pricePerNight` asc.

- [ ] **Steps 1–5:** espelham a Task 4 (fixtures gravadas, `normalizeHotel` puro testado isolado, provider testado com `fetchImpl` fake).
- Commit — `feat(providers): AmadeusHotelProvider (lista por cidade + ofertas) com normalização`

---

### Task 6: `apps/api` — `ProviderCacheRepository` + `FlightsModule` / `HotelsModule`

**Files:**
- Create: `apps/api/src/providers/provider-cache.repository.ts`, `apps/api/src/providers/providers.module.ts`, `apps/api/src/flights/flights.service.ts`, `apps/api/src/flights/flights.controller.ts`, `apps/api/src/flights/flights.module.ts`, `apps/api/src/hotels/*` (idem)
- Modify: `apps/api/src/config/env.schema.ts` (`AMADEUS_*`, `*_DEEPLINK_TEMPLATE`, TTLs opcionais)
- Test: `apps/api/src/providers/provider-cache.repository.spec.ts` (integração), `apps/api/src/flights/flights.service.spec.ts` (integração, provider fake), `apps/api/test/flights.e2e-spec.ts`

**Interfaces:**
- Consumes: token `DB`; `FLIGHT_PROVIDER` / `HOTEL_PROVIDER` (tokens no `ProvidersModule`, factory monta `AmadeusFlightProvider`/`AmadeusHotelProvider` a partir da env; nos testes trocados por fakes); `TripsService.get`; `AuthGuard`.
- Produces:
  - `ProviderCacheRepository.getOrSet<T>(args: { provider: string; endpoint: string; params: object; ttlSeconds: number; load: () => Promise<T> }): Promise<{ value: T; stale: boolean }>` — `key = sha256(provider+endpoint+JSON.stringify(params sorted))`; `expiresAt < now` → chama `load`, grava, `stale: false`; hit válido → `stale: false`; miss + `load` falha → sem fallback (propaga).
  - `FlightsService.search(userId, tripId): Promise<ProviderSection<FlightOffer>>` — deriva params do `TripState` (origin, chosen destination iata, datas/nights, party); cache 10 min; em erro do provider → `{ offers: [], stale: false, error: "unavailable" }` (log do erro).
  - `FlightsService.select(userId, tripId, offerId): Promise<FlightSelection>` — reexecuta/recupera a oferta do cache, persiste em `flight_selections` com `offer` crua + `deepLink`.
  - `HotelsService` — análogo (cache 1 h; `hotel_selections`).
  - `GET /trips/:id/flights` → 200 `ProviderSection<FlightOffer>`. `POST /trips/:id/flights/select { offerId }` → 201 `FlightSelection`. Idem `/hotels`.

- [ ] **Step 1: Testes (falham)** — cache: 1ª chamada carrega e grava; 2ª usa cache (não chama `load`); expirado recarrega. `FlightsService.search` com provider fake ok → ofertas; provider fake que lança → `{ offers: [], error: "unavailable" }`. `select` grava `flight_selections` com `offer` e `deepLink`. e2e: `GET /trips/:id/flights` com provider fake → 200 shape certo; sem auth → 401.

- [ ] **Step 2: Run — falha.**

- [ ] **Step 3: Implementar.** `ProvidersModule` `@Global()` expõe os tokens; nos testes `overrideProvider(FLIGHT_PROVIDER).useValue(fake)`.

- [ ] **Step 4: Run integração + e2e** — cobertura 100%.

- [ ] **Step 5: Stryker + commit** — `feat(api): FlightsModule e HotelsModule com provider_cache e persistência de seleção`

---

## Self-Review

**1. Spec coverage:**
- `provider_cache` / `flight_selections` / `hotel_selections` §5.1 → Task 1.
- Interfaces `FlightProvider`/`HotelProvider` §7.1 → Tasks 4, 5.
- Amadeus auth (token cache, base URL configurável) §7.2 → Task 3. Normalização + snapshot cru em `*_selections.offer` §7.2 → Tasks 4–6.
- Resiliência (retry, circuit breaker, cache TTL voo 10 min / hotel 1 h) §7.2 → Tasks 3, 6.
- Degradação graciosa §7.3 → `ProviderSection` com `error` (Tasks 2, 6).
- Deep link sem afiliado D10/§7.2 → template por env (Global Constraints, Tasks 4–6); **parceiro definitivo é Q5 do PRD — em aberto, template configurável cobre o MVP.**
- Baseline de testes → unidade (auth, circuit breaker, normalizers), integração (cache repo, services com provider fake + Postgres), e2e API, contrato contra `__fixtures__` sem rede, mutação em todos, 100% por pacote.

**2. Placeholder scan:** sem "TBD". As fixtures precisam ser gravadas uma vez a partir do sandbox — anotado nas Tasks 4 e 5 como passo explícito antes do "Run".

**3. Type consistency:** `FlightSearchParams`/`FlightOffer`/`HotelSearchParams`/`HotelOffer`/`ProviderSection` (Task 2) usados nas Tasks 3–6. `FlightProvider.search` / `HotelProvider.search` (Tasks 4, 5) são a única superfície que `FlightsService`/`HotelsService` (Task 6) chamam. `ProviderCacheRepository.getOrSet` (Task 6) genérico, retorna `{ value, stale }` consumido pelos services.

## Execução

Cobre o **Passo 5** do backlog. Depende do Passo 3. Pode ser puxado em paralelo com o
Passo 4. Puxar o passo 5 (guideline do `CLAUDE.md`) antes de começar.

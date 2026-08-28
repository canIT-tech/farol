# Google Places + Enrich — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois que o Claude gera a estrutura do roteiro (Passo 4), cada item do tipo `activity`/`meal` ganha um lugar real do Google Places (`placeId`, `lat`/`lng`, `rating`); dias sem refeição recebem um restaurante por cozinha/preço perto do centro do dia; itens sem match ficam marcados `needsReview` e podem ser reprocessados pelo job `places.enrich`. `swap_restaurant` troca um item de refeição.

**Architecture:** `packages/providers` ganha `GooglePlacesProvider` (Text Search + Place Details) contra fixtures. `apps/api` `PlacesModule` embrulha o provider com `provider_cache` (TTL 24 h). O **passo de enrich** entra dentro do `ItineraryGenerateHandler` (Passo 4, Task 5) logo após a inserção dos itens; roda também como job dedicado `places.enrich` para reprocessar `needsReview`. Degradação graciosa: sem Places o item renderiza sem lugar, marcado.

**Tech Stack:** herda dos Planos 1–5. Sem dependência nova (Places via HTTP + `amadeusGet`-style client genérico já existe no `packages/providers`).

**Spec:** `docs/superpowers/specs/2026-08-27-mvp-trip-design.md` §5.1 (`itinerary_items.placeId/lat/lng/rating`), §6.3 (passo b — enrich), §7 (`PlacesProvider`), §7.3 (degradação). Telas: `Itinerary.dc.html`.

## Global Constraints

- Herdam dos Planos 1–5 (pnpm, Node 22, cobertura 100% por pacote, mutação ≥ 90%, TDD, `@farol/*`, env com zod, PT-BR, DoD = testes completos).
- **Sem rede no CI:** `GooglePlacesProvider` testado contra fixtures em `packages/providers/src/google/__fixtures__/`.
- **`GOOGLE_PLACES_KEY`** obrigatória na env da `api`/`worker`.
- **Cache Places TTL 24 h** (`provider_cache`, chave = hash da query).
- **Degradação (§7.3):** falha do Places em um item → item mantém `title`, `placeId` nulo, `needsReview = true`; o roteiro não falha.
- **Enrich é idempotente:** rodar de novo num item já enriquecido não muda nada; num `needsReview` tenta de novo.
- **O enrich não altera** `type`, `slot`, `title` nem `sortOrder` gerados pelo LLM — só preenche `placeId/lat/lng/rating` e `needsReview`, e insere itens de refeição faltantes.

---

### Task 1: `packages/db` — coluna `needsReview` em `itinerary_items` + migration

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0005_*.sql`
- Test: `packages/db/src/schema.spec.ts` (novo caso)

**Interfaces:**
- Produces: `itineraryItems.needsReview boolean notNull default false`.

- [ ] **Step 1: Teste (falha)** — `getTableColumns(itineraryItems).needsReview.notNull === true`.
- [ ] **Step 2: Run — falha.**
- [ ] **Step 3: Adicionar a coluna.**
- [ ] **Step 4: `db:generate` → `0005_*.sql` (ALTER TABLE ... ADD COLUMN) → `db:migrate` → `pnpm --filter @farol/db test`.**
- [ ] **Step 5: Commit** — `feat(db): itinerary_items.needsReview + migration 0005`

---

### Task 2: `packages/shared` — DTOs de Places

**Files:**
- Create: `packages/shared/src/places.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/places.spec.ts`

**Interfaces:**
- Produces:
  - `placesTextSearchParamsSchema`: `{ query: string(2..200); near?: { lat: number; lng: number }; type?: "restaurant" | "tourist_attraction" | "point_of_interest"; minPrice?: 0..4; maxPrice?: 0..4 }`
  - `placeSchema`: `{ placeId: string; name: string; lat: number; lng: number; rating: number | null; priceLevel: number | null; types: string[] }`
  - `placeDetailsSchema` = `placeSchema` + `{ address: string | null; openingHours: string[] | null }`
  - tipos: `PlacesTextSearchParams`, `Place`, `PlaceDetails`

- [ ] **Step 1: Testes (falham)** — `placeSchema`: `rating` aceita `null`; `lat`/`lng` numéricos obrigatórios. params: `query` mín. 2; `minPrice`/`maxPrice` 0..4.
- [ ] **Step 2: Run — falha.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Run — passa (100%) + mutação.**
- [ ] **Step 5: Commit** — `feat(shared): DTOs de Google Places`

---

### Task 3: `packages/providers` — `GooglePlacesProvider`

**Files:**
- Create: `packages/providers/src/google/google-places-provider.ts`, `packages/providers/src/google/normalize-place.ts`, `packages/providers/src/google/__fixtures__/text-search.json`, `packages/providers/src/google/__fixtures__/details.json`
- Modify: `packages/providers/src/index.ts`
- Test: `packages/providers/src/google/google-places-provider.spec.ts`, `packages/providers/src/google/normalize-place.spec.ts`

**Interfaces:**
- Produces:
  - `interface PlacesProvider { textSearch(p: PlacesTextSearchParams): Promise<Place[]>; details(placeId: string): Promise<PlaceDetails> }`
  - `GooglePlacesProvider(cfg: { apiKey: string; fetchImpl?: typeof fetch })` — Places API v1 (`places:searchText`, `places/{id}`); `normalizePlace(raw)` → `Place` (rating/priceLevel para `null` quando ausente); `textSearch` respeita `near` (locationBias) e faixa de preço.

- [ ] **Step 1: Testes (falham)** — `normalizePlace` contra fixture: campos batem `placeSchema`, `rating` nulo quando o raw não traz. `textSearch` com `fetchImpl` fake → lista; `details` → `PlaceDetails`. (gravar fixtures de uma chamada real uma vez, commitar)
- [ ] **Step 2: Run — falha.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Run — passa (100%) + mutação.**
- [ ] **Step 5: Commit** — `feat(providers): GooglePlacesProvider (text search + details)`

---

### Task 4: `apps/api` — `PlacesModule` (provider + cache 24 h)

**Files:**
- Create: `apps/api/src/places/places.service.ts`, `apps/api/src/places/places.module.ts`
- Modify: `apps/api/src/config/env.schema.ts` (`GOOGLE_PLACES_KEY`), `apps/api/src/providers/providers.module.ts` (token `PLACES_PROVIDER`)
- Test: `apps/api/src/places/places.service.spec.ts` (integração, provider fake + `provider_cache`)

**Interfaces:**
- Consumes: `PLACES_PROVIDER`; `ProviderCacheRepository` (Plano 5).
- Produces:
  - `PlacesService.findFirst(query: string, opts?: { near?; type?; minPrice?; maxPrice? }): Promise<Place | null>` — `textSearch` via cache 24 h; devolve o 1º ou `null`.
  - `PlacesService.details(placeId: string): Promise<PlaceDetails>` — via cache 24 h.

- [ ] **Step 1: Testes (falham)** — `findFirst` usa cache na 2ª chamada; `null` quando o provider devolve `[]`; provider que lança → `findFirst` retorna `null` (degrada, loga).
- [ ] **Step 2: Run — falha.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Run integração** — cobertura 100%.
- [ ] **Step 5: Stryker + commit** — `feat(api): PlacesModule com cache de 24h`

---

### Task 5: `apps/api` — enrich dentro do `ItineraryGenerateHandler`

**Files:**
- Create: `apps/api/src/itinerary/enrich-itinerary.ts`
- Modify: `apps/api/src/itinerary/itinerary-generate.handler.ts` (chamar o enrich após inserir os itens), `apps/api/src/itinerary/itinerary.module.ts` (importar `PlacesModule`)
- Test: `apps/api/src/itinerary/enrich-itinerary.spec.ts` (integração, `PlacesService` fake)

**Interfaces:**
- Consumes: token `DB`; `PlacesService`.
- Produces:
  - `enrichItinerary(deps: { db; places: PlacesService }, itineraryId: string, cityQueryHint: string): Promise<void>`:
    1. Carrega dias + itens da versão.
    2. Para cada item `type in ("activity","meal")` sem `placeId`: `places.findFirst("<title> <cityQueryHint>")` → se achou, `update` `placeId/lat/lng/rating`, `needsReview=false`; se não, `needsReview=true`.
    3. Para cada dia **sem** item `type="meal"` no slot `afternoon` ou `evening`: calcula o centroide (média de `lat/lng` dos itens do dia com coordenada; se nenhum, pula); `places.findFirst("restaurante", { near: centroid, type: "restaurant", minPrice: 1, maxPrice: 3 })` → insere um `itinerary_item` `type="meal"` no slot livre, `sortOrder` no fim.
  - `ItineraryGenerateHandler` chama `enrichItinerary` depois de `status` ainda `pending`; só então marca `ready`. Falha do enrich inteiro → loga e segue (`ready` mesmo assim; itens ficam `needsReview`).

- [ ] **Step 1: Testes (falham)** — item com match → `placeId` preenchido, `needsReview=false`; sem match → `needsReview=true`; dia sem refeição e com itens geolocalizados → ganha item `meal`; dia sem nenhuma coordenada → não ganha nada; rodar o enrich 2x → sem mudança (idempotente); `PlacesService` que lança em tudo → handler ainda marca `ready`, itens `needsReview=true`.
- [ ] **Step 2: Run — falha.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Run integração** — cobertura 100%.
- [ ] **Step 5: Stryker + commit** — `feat(api): enrich do roteiro com Google Places dentro do handler`

---

### Task 6: `apps/api` — `swap_restaurant` (serviço + endpoint)

**Files:**
- Modify: `apps/api/src/itinerary/itinerary.service.ts` (`swapRestaurant`), `apps/api/src/itinerary/itinerary.controller.ts`
- Test: `apps/api/src/itinerary/swap-restaurant.spec.ts` (integração), e2e

**Interfaces:**
- Produces:
  - `ItineraryService.swapRestaurant(userId, tripId, itemId, opts?: { cuisine?: string }): Promise<ItineraryItem>` — valida dono; item precisa ser `type="meal"`; `places.findFirst("<cuisine ou 'restaurante'> perto de <lat,lng do item>", { near, type: "restaurant" })`; atualiza `title/placeId/lat/lng/rating` do item; `NotFoundError` se Places não retornar nada.
  - `POST /trips/:id/itinerary/items/:itemId/swap-restaurant { cuisine? }` → 200 `ItineraryItem` | 404/403/422.

- [ ] **Step 1: Testes (falham)** — troca ok atualiza o item; item que não é `meal` → 422; sem resultado do Places → 404. e2e: swap com auth → 200.
- [ ] **Step 2: Run — falha.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Run integração + e2e** — cobertura 100%.
- [ ] **Step 5: Stryker + commit** — `feat(api): swap_restaurant no roteiro via Google Places`

---

### Task 7: `apps/api` — job `places.enrich` + registro no worker + e2e ponta a ponta

**Files:**
- Create: `apps/api/src/itinerary/places-enrich.handler.ts`
- Modify: `apps/api/src/jobs/job-names.ts` (`placesEnrich: "places.enrich"`), `apps/worker/src/register-handlers.ts`, `apps/api/src/itinerary/itinerary.service.ts` (`requestEnrich`)
- Test: `apps/api/src/itinerary/places-enrich.handler.spec.ts`, `apps/worker/test/enrich.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `PlacesEnrichHandler.handle({ itineraryId }): Promise<void>` — roda `enrichItinerary` só nos itens `needsReview=true`.
  - `ItineraryService.requestEnrich(userId, tripId): Promise<void>` — `JOB_QUEUE.publish(JOB_NAMES.placesEnrich, { itineraryId })` da versão atual.
  - `POST /trips/:id/itinerary/enrich` → 202.
  - Worker registra o handler.

- [ ] **Step 1: Testes (falham)** — handler só toca itens `needsReview`; e2e no worker: cria itinerary com 2 itens `needsReview`, publica `places.enrich`, com `PlacesService` fake que agora acha → itens ficam `needsReview=false` com `placeId`.
- [ ] **Step 2: Run — falha.**
- [ ] **Step 3: Implementar + registrar no worker.**
- [ ] **Step 4: Run e2e** — passa; cobertura 100%.
- [ ] **Step 5: Stryker + commit** — `feat(api): job places.enrich para reprocessar itens needsReview`

---

## Self-Review

**1. Spec coverage:**
- `PlacesProvider` (textSearch + details) §7.1 → Task 3. `PlacesModule` com cache 24 h §7.2 → Task 4.
- Enrich §6.3 passo b (item sem place_id → text search; sem match → `needsReview`; refeição por cozinha/preço perto do centroide) → Task 5.
- `swap_restaurant` §6.4 → Task 6 (o endpoint direto; a **tool** de chat que chama isso é o Passo 7).
- `placeId/lat/lng/rating` em `itinerary_items` §5.1 → preenchidos nas Tasks 5–7. `needsReview` como marca de falha §7.3 → Task 1.
- Job `places.enrich` §6.3/§9 → Task 7, registrado no `apps/worker`.
- Baseline de testes → unidade (normalizer), integração (PlacesService, enrich, swap com Postgres + fake), e2e worker, contrato contra fixtures sem rede, mutação, 100% por pacote.

**2. Placeholder scan:** sem "TBD". Gravar as fixtures do Google (Task 3) é passo explícito antes do "Run". O enrich alterando o handler do Passo 4 está dito na Task 5 (modifica `itinerary-generate.handler.ts`).

**3. Type consistency:** `Place` / `PlaceDetails` / `PlacesTextSearchParams` (Task 2) usados nas Tasks 3–7. `PlacesProvider` (Task 3) é a única superfície que `PlacesService` (Task 4) chama; `PlacesService.findFirst` é a única que `enrichItinerary` (Task 5) e `swapRestaurant` (Task 6) usam. `enrichItinerary(deps, itineraryId, hint)` reusado pela Task 7 sem mudar assinatura.

## Execução

Cobre o **Passo 6** do backlog. Depende dos Passos 4 e 5. Puxar o passo 6 (guideline
do `CLAUDE.md`) antes de começar.

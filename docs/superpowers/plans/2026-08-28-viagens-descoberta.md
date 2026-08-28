# Viagens + Descoberta de Destino — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Usuário cria uma viagem (origem, datas/duração, orçamento, party), e a `apps/api` cruza o perfil de gosto com um catálogo de destinos — pré-filtro determinístico → shortlist → ranking via Claude — e persiste 3–5 destinos candidatos com justificativa personalizada, custo estimado e clima.

**Architecture:** `TripsModule` faz o CRUD de `trips` e expõe o agregado `TripState`. `DiscoveryModule` recebe `POST /trips/:id/discovery`: `packages/domain` filtra o `destination_catalog` (orçamento, melhor época, visto, exclui rejeitados) e devolve ~20 candidatos; `LlmModule` manda essa shortlist como dado para o Claude, que **escolhe 3–5 da lista** e escreve a justificativa; a saída é validada com zod (1 retry em falha) e persistida em `trip_destinations`. `LlmModule` registra modelo/tokens/custo por chamada.

**Tech Stack:** herda dos Planos 1–2. Novo: `@anthropic-ai/sdk`.

**Spec:** `docs/superpowers/specs/2026-08-27-mvp-trip-design.md` §5.1 (`trips`), §5.2 (uso do `taste_profiles`), §5 (`trip_destinations`, `destination_catalog`), §6.1 (catálogo), §6.2 (descoberta), §6.5 (custo LLM). Telas: `DiscoveryInput.dc.html`, `Main.dc.html`.

## Global Constraints

- Herdam dos Planos 1–2 (pnpm, Node 22, cobertura 100% por pacote, mutação ≥ 90%, TDD, `@farol/*`, env com zod, PT-BR nos comentários, DoD = testes completos).
- **O LLM nunca inventa destino:** o prompt recebe a shortlist como dados e a saída só pode conter `iata` presentes nela. Validação rejeita qualquer `iata` fora da shortlist.
- **Saída do LLM sempre validada com zod.** Em falha de schema: 1 retry incluindo o erro no prompt; segunda falha → `DomainError("llm_invalid_output")`, tratado como 502 no controller.
- **LLM em teste = fake determinístico.** `LlmModule` exporta um token; os testes trocam por um `FakeLlmService` que retorna JSON fixo por "kind" de prompt. Nenhuma chamada real no CI.
- **Roteamento de modelo:** `LLM_MODEL_CAPABLE` (default `claude-sonnet-5`) para descoberta; `LLM_MODEL_CHEAP` (default `claude-haiku-4-5-20251001`) reservado para extração/classificação futura. IDs configuráveis por env.
- **Custo por chamada** logado (pino, structured): `{ model, inputTokens, outputTokens, estimatedUsd, tripId, kind, latencyMs }`. Persistência em tabela fica para depois (anotado no self-review).
- **Catálogo:** `packages/domain/data/destinations.csv` entra com ~20 cidades reais para os testes passarem; expandir para ~200 é trabalho de curadoria contínua fora deste plano (pendência do PRD).

---

### Task 1: `packages/db` — `trips`, `trip_destinations`, `destination_catalog` + migration

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0002_*.sql` (gerada)
- Test: `packages/db/src/schema.spec.ts` (novos casos)

**Interfaces:**
- Consumes: `users`, `tasteProfiles` (Planos 1–2).
- Produces (colunas conforme design §5.1):
  - `trips`: `id uuid pk`, `userId uuid notNull → users.id`, `status text notNull default 'draft'` (draft|planned|done), `title text`, `originIata text notNull`, `dateStart date`, `dateEnd date`, `durationDays integer`, `targetMonth text` (`YYYY-MM`), `party jsonb notNull default '{"adults":1,"children":0}'`, `budgetTotal numeric`, `currency text notNull default 'BRL'`, `chosenDestinationId uuid` (FK → trip_destinations, nullable), `createdAt`/`updatedAt timestamptz notNull defaultNow()`
  - `trip_destinations`: `id uuid pk`, `tripId uuid notNull → trips.id onDelete cascade`, `city text notNull`, `country text notNull`, `iata text notNull`, `score numeric notNull`, `rationale text notNull`, `estCost jsonb notNull`, `climate jsonb notNull`, `flightTimeHours numeric`, `chosen boolean notNull default false`, `createdAt timestamptz notNull defaultNow()`
  - `destination_catalog`: `id uuid pk`, `city text notNull`, `country text notNull`, `iata text notNull unique`, `tags jsonb notNull` (`string[]`), `bestMonths jsonb notNull` (`number[]`, 1–12), `avgFlightCostFromGru numeric notNull`, `avgLodgingNight numeric notNull`, `avgDailyLocal numeric notNull`, `region text notNull`, `visaFreeBr boolean notNull`
  - Índices: `trips (userId, status)`, `trip_destinations (tripId)`, `destination_catalog (iata)`
  - re-export das três no `index.ts`

- [ ] **Step 1: Casos de teste (falham)**

```ts
// packages/db/src/schema.spec.ts  (novos casos)
import { getTableColumns } from "drizzle-orm";
import { trips, tripDestinations, destinationCatalog } from "./schema";

it("trips tem as colunas do design §5.1", () => {
  const cols = Object.keys(getTableColumns(trips)).sort();
  expect(cols).toEqual([
    "id","userId","status","title","originIata","dateStart","dateEnd","durationDays",
    "targetMonth","party","budgetTotal","currency","chosenDestinationId","createdAt","updatedAt"
  ].sort());
});
it("trip_destinations referencia trips e tem score/rationale", () => {
  const c = getTableColumns(tripDestinations);
  expect(c.score.notNull).toBe(true);
  expect(c.rationale.notNull).toBe(true);
  expect(c.chosen.notNull).toBe(true);
});
it("destination_catalog tem iata unique", () => {
  expect(getTableColumns(destinationCatalog).iata.isUnique).toBe(true);
});
```

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/db vitest run`

- [ ] **Step 3: Implementar o schema** (Drizzle `pgTable`, `jsonb().$type<...>()`, FKs; ver colunas acima). Re-export em `index.ts`.

- [ ] **Step 4: Gerar migration + aplicar + testar**

Run: `pnpm --filter @farol/db db:generate && docker compose up -d db && pnpm --filter @farol/db db:migrate && pnpm --filter @farol/db test`
Expected: `0002_*.sql` revisada; testes verdes, cobertura 100%.

- [ ] **Step 5: Commit** — `feat(db): trips, trip_destinations e destination_catalog + migration 0002`

---

### Task 2: `packages/db` — seed do `destination_catalog`

**Files:**
- Create: `packages/domain/data/destinations.csv` (~20 linhas reais), `packages/db/src/seed-catalog.ts`
- Modify: `packages/db/package.json` (script `db:seed`)
- Test: `packages/db/src/seed-catalog.spec.ts` (integração, Postgres)

**Interfaces:**
- Produces:
  - `seedCatalog(url: string, csvPath: string): Promise<{ inserted: number }>` — parseia o CSV, faz `insert ... onConflictDoUpdate` por `iata` (idempotente), retorna a contagem.

- [ ] **Step 1: Teste (falha)**

```ts
// packages/db/src/seed-catalog.spec.ts
import { describe, it, expect, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { createDbClient } from "./client";
import { runMigrations } from "./migrate";
import { seedCatalog } from "./seed-catalog";
import { destinationCatalog } from "./schema";

const url = process.env.DATABASE_URL!;
const csv = fileURLToPath(new URL("../../domain/data/destinations.csv", import.meta.url));
const { db, close } = createDbClient(url);
afterAll(() => close());

describe("seedCatalog", () => {
  it("insere as cidades do CSV e é idempotente", async () => {
    await runMigrations(url);
    const a = await seedCatalog(url, csv);
    expect(a.inserted).toBeGreaterThanOrEqual(20);
    const b = await seedCatalog(url, csv);            // segunda rodada não duplica
    const rows = await db.select().from(destinationCatalog);
    expect(rows.length).toBe(a.inserted);
    expect(b.inserted).toBe(a.inserted);
  });
  it("cada linha tem tags e bestMonths não-vazios", async () => {
    const rows = await db.select().from(destinationCatalog);
    for (const r of rows) {
      expect(Array.isArray(r.tags) && r.tags.length).toBeTruthy();
      expect(Array.isArray(r.bestMonths) && r.bestMonths.length).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run — falha.**

- [ ] **Step 3: Implementar** o CSV (colunas: `city,country,iata,tags,bestMonths,avgFlightCostFromGru,avgLodgingNight,avgDailyLocal,region,visaFreeBr`; `tags` e `bestMonths` como listas separadas por `;`) e `seed-catalog.ts` (parser simples sem lib, `onConflictDoUpdate` em `destinationCatalog.iata`). Cidades iniciais: Cartagena, Cidade do México, Lisboa, Maceió, Fernando de Noronha, Buenos Aires, Santiago, Cusco, Cartagena, Punta Cana, Bariloche, Montevidéu, Foz do Iguaçu, Jericoacoara, Porto, Madri, Cidade do Cabo, Cancún, Bonito, Gramado (ajustar para ~20 únicas, dados reais aproximados).

- [ ] **Step 4: Run + `db:seed` script** — `pnpm --filter @farol/db test`; adicionar `"db:seed": "tsx src/seed-catalog.ts"` chamando com `DATABASE_URL` + caminho padrão.

- [ ] **Step 5: Commit** — `feat(db): seed do destination_catalog a partir de CSV curado`

---

### Task 3: `packages/shared` — DTOs de viagem e de descoberta

**Files:**
- Create: `packages/shared/src/trip.ts`, `packages/shared/src/discovery.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/trip.spec.ts`, `packages/shared/src/discovery.spec.ts`

**Interfaces:**
- Produces:
  - `tripInputSchema` (zod): `originIata: string(3)`, `party: { adults: int ≥ 1; children: int ≥ 0 }`, `budgetTotal: number > 0`, `currency: default "BRL"`, e **um de**: `{ dateStart, dateEnd }` (ISO date, `end > start`) **ou** `{ durationDays: int 2..30, targetMonth: /^\d{4}-\d{2}$/ }` — refine que exige exatamente um dos dois.
  - `type TripInput`, `tripStatusEnum`
  - `destinationCandidateSchema`: `{ iata, city, country, score: 0..1, rationale: string(10..400), estCost: { flight, lodgingPerNight, dailyLocal, currency }, climate: { expectedC, summary, bestMonths: number[] }, flightTimeHours }`
  - `llmRankingSchema` = `z.array(z.object({ iata: string, score: number(0..1), rationale: string(10..400) })).min(3).max(5)` — a forma que o Claude devolve.
  - `type DestinationCandidate`, `type LlmRanking`

- [ ] **Step 1: Testes (falham)** — `tripInputSchema`: aceita datas exatas; aceita duração+mês; rejeita os dois juntos; rejeita nenhum; rejeita `end <= start`; `adults` mín. 1. `llmRankingSchema`: rejeita array de 2; rejeita `score` 1.5; rejeita `rationale` de 3 chars.

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/shared vitest run`

- [ ] **Step 3: Implementar** os schemas (usar `z.union` + `superRefine` para o "exatamente um" de datas/duração).

- [ ] **Step 4: Run — passa (100%) + mutação.**

- [ ] **Step 5: Commit** — `feat(shared): DTOs de trip input, destino candidato e ranking do LLM`

---

### Task 4: `packages/domain` — pré-filtro de destinos (puro)

**Files:**
- Create: `packages/domain/src/discovery/prefilter.ts`, `packages/domain/src/discovery/types.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `packages/domain/src/discovery/prefilter.spec.ts`

**Interfaces:**
- Consumes: `@farol/shared` (`TripInput`, `TasteProfileInput`).
- Produces:
  - `type CatalogEntry` = shape de uma linha de `destination_catalog` (camelCase).
  - `prefilterDestinations(args: { catalog: CatalogEntry[]; trip: TripInput; profile: TasteProfileInput; excludeIata?: string[]; limit?: number }): CatalogEntry[]`
    - Regras (puras, sem I/O):
      1. **Orçamento:** `avgFlightCostFromGru + avgLodgingNight * nights + avgDailyLocal * nights ≤ budgetTotal / party.adults`, onde `nights` = `durationDays` ou diferença de datas.
      2. **Época:** o mês alvo (`targetMonth` ou o mês de `dateStart`) está em `bestMonths`.
      3. **Visto:** se o destino é internacional (`region !== "brasil"`) e `visaFreeBr === false`, descarta.
      4. **Exclusão:** `excludeIata` fora.
      5. **Score de aderência** = fração de `profile.interests` presente em `tags` (0..1); ordena desc; `limit` (default 20).

- [ ] **Step 1: Testes (falham)** — casos: destino caro fora; destino fora de época fora; internacional sem visto fora; nacional sem visto entra; `excludeIata` respeitado; ordenação por overlap de tags; `limit` corta; empate desempata por `avgFlightCostFromGru` asc.

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/domain vitest run`

- [ ] **Step 3: Implementar** `prefilterDestinations` (função pura). Helper `nightsOf(trip)`.

- [ ] **Step 4: Run — passa (100%) + mutação (≥ 90 — este arquivo é o coração do pré-filtro, mirar 100).**

- [ ] **Step 5: Commit** — `feat(domain): pré-filtro determinístico de destinos`

---

### Task 5: `apps/api` — `LlmModule` (client Claude + roteamento + custo) + fake

**Files:**
- Create: `apps/api/src/llm/llm.service.ts`, `apps/api/src/llm/llm.module.ts`, `apps/api/src/llm/llm.types.ts`, `apps/api/src/llm/fake-llm.service.ts`, `apps/api/src/llm/prompts/rank-destinations.ts`
- Modify: `apps/api/src/config/env.schema.ts` (`ANTHROPIC_API_KEY`, `LLM_MODEL_CAPABLE`, `LLM_MODEL_CHEAP`)
- Test: `apps/api/src/llm/llm.service.spec.ts` (com um fake do SDK), `apps/api/src/llm/fake-llm.service.spec.ts`

**Interfaces:**
- Consumes: `envSchema`; `@anthropic-ai/sdk`.
- Produces:
  - `LLM` (injection token) → implementação de `LlmPort`.
  - `interface LlmPort { rankDestinations(input: RankDestinationsInput): Promise<LlmRanking> }` (design deixa espaço p/ `buildItinerary` no Passo 4).
  - `RankDestinationsInput = { shortlist: DestinationCandidateSeed[]; profile: TasteProfileInput; trip: TripInput }` (só os campos necessários; sem PII).
  - `LlmService` (real): monta o prompt de `prompts/rank-destinations.ts`, chama `messages.create` com `LLM_MODEL_CAPABLE`, faz `JSON.parse` + `llmRankingSchema.parse`; em falha, 1 retry acrescentando o erro; loga `{ model, inputTokens, outputTokens, estimatedUsd, kind: "rank_destinations", latencyMs }` (custo via tabela de preços em `llm.types.ts`).
  - `FakeLlmService` (test): `rankDestinations` devolve os 3 primeiros `iata` da shortlist com `score` decrescente e `rationale` fixa.

- [ ] **Step 1: Testes (falham)**

```ts
// apps/api/src/llm/llm.service.spec.ts  (resumo)
// - fake do SDK Anthropic: messages.create -> retorna content JSON válido -> rankDestinations resolve com 3 itens
// - SDK retorna JSON inválido na 1ª, válido na 2ª -> resolve (verifica 2 chamadas)
// - SDK retorna inválido nas 2 -> rejeita com DomainError("llm_invalid_output")
// - iata fora da shortlist na resposta -> rejeita
// - logger.info chamado uma vez por chamada bem-sucedida com o shape de métrica
```

```ts
// fake-llm.service.spec.ts
// - retorna exatamente 3 itens, todos com iata presente na shortlist, score desc
```

- [ ] **Step 2: Run — falha.**

- [ ] **Step 3: Implementar.** `LlmService` recebe o client Anthropic e um `Logger` por injeção (testável). Prompt: system curto ("assessor de viagem; escolha 3–5 da lista; responda só JSON no formato X"); user com a shortlist + perfil + restrições. Tabela de preço por modelo em `llm.types.ts` (valores aproximados, comentados como "revisar").

- [ ] **Step 4: Run — passa (100%; `*.module.ts` excluído) + mutação.**

- [ ] **Step 5: Commit** — `feat(api): LlmModule com rankDestinations, roteamento de modelo e log de custo`

---

### Task 6: `apps/api` — `TripsModule` (CRUD + `TripState`)

**Files:**
- Create: `apps/api/src/trips/trips.service.ts`, `apps/api/src/trips/trips.controller.ts`, `apps/api/src/trips/trips.module.ts`, `apps/api/src/trips/trip-state.ts`
- Test: `apps/api/src/trips/trips.service.spec.ts` (integração), `apps/api/test/trips.e2e-spec.ts`

**Interfaces:**
- Consumes: token `DB`; `AuthGuard` + `@CurrentUser` (Plano 2); `@farol/shared` (`tripInputSchema`, `NotFoundError`, `ForbiddenError`).
- Produces:
  - `TripsService.create(userId, input: TripInput): Promise<Trip>`
  - `TripsService.get(userId, tripId): Promise<TripState>` — `NotFoundError` se não existe; `ForbiddenError` se `trip.userId !== userId`.
  - `TripsService.list(userId): Promise<Trip[]>`
  - `type TripState = Trip & { destinations: DestinationCandidate[]; chosenDestination: DestinationCandidate | null }`
  - `POST /trips` (body zod) → 201 `Trip`; `GET /trips` → 200 `Trip[]`; `GET /trips/:id` → 200 `TripState` | 404/403.

- [ ] **Step 1: Testes (falham)** — service: `create` grava com `status='draft'`; `get` de outro usuário → `ForbiddenError`; `get` inexistente → `NotFoundError`; `get` monta `destinations` vazio quando não houve descoberta. e2e: `POST /trips` sem auth → 401; com auth → 201; `GET /trips/:id` de outro usuário → 403.

- [ ] **Step 2: Run — falha.**

- [ ] **Step 3: Implementar.** `trip-state.ts` monta o agregado a partir de `trips` + `trip_destinations`.

- [ ] **Step 4: Run unit/integração + e2e** — cobertura 100%.

- [ ] **Step 5: Stryker + commit** — `feat(api): TripsModule com CRUD e agregado TripState`

---

### Task 7: `apps/api` — `DiscoveryModule` (POST /trips/:id/discovery) + e2e

**Files:**
- Create: `apps/api/src/discovery/discovery.service.ts`, `apps/api/src/discovery/discovery.controller.ts`, `apps/api/src/discovery/discovery.module.ts`, `apps/api/src/discovery/catalog.repository.ts`
- Test: `apps/api/src/discovery/discovery.service.spec.ts` (integração, `FakeLlmService`), `apps/api/test/discovery.e2e-spec.ts`

**Interfaces:**
- Consumes: token `DB`; `prefilterDestinations` (`@farol/domain`); `LLM` port (Task 5); `ProfileService.get` (Plano 2); `TripsService.get` (Task 6); `AuthGuard`.
- Produces:
  - `CatalogRepository.all(): Promise<CatalogEntry[]>` — lê `destination_catalog`.
  - `DiscoveryService.run(userId, tripId): Promise<DestinationCandidate[]>`:
    1. `trip = TripsService.get(userId, tripId)` · `profile = ProfileService.get(userId)` (404 `taste_profile_required` se não houver).
    2. `shortlist = prefilterDestinations({ catalog, trip, profile, excludeIata: <iata de trip_destinations já rejeitados> })`.
    3. Se `shortlist.length < 3` → `DomainError("no_destinations_in_budget")` (422 no controller, mensagem acionável).
    4. `ranking = LLM.rankDestinations({ shortlist, profile, trip })`.
    5. Mapeia `ranking` + dados do catálogo → `DestinationCandidate[]` (estCost/climate montados do catálogo + `nights`); `flightTimeHours` do catálogo se houver, senão `null`.
    6. Substitui os `trip_destinations` daquela trip (delete + insert) com `chosen=false`.
  - `POST /trips/:id/discovery` → 200 `DestinationCandidate[]` | 401/403/404/422/502.

- [ ] **Step 1: Testes (falham)**

```ts
// discovery.service.spec.ts  (integração, Postgres + FakeLlmService)
// - seed catálogo + trip + taste_profile -> run() persiste 3 trip_destinations, chosen=false
// - run() sem taste_profile -> NotFoundError("taste_profile_required")
// - orçamento minúsculo -> DomainError("no_destinations_in_budget")
// - rodar run() duas vezes -> substitui, não acumula
// e2e: POST /trips/:id/discovery com auth -> 200 e 3..5 itens com rationale não-vazio
```

- [ ] **Step 2: Run — falha.**

- [ ] **Step 3: Implementar** (`DiscoveryModule` importa `LlmModule`, `TripsModule`, `ProfileModule`; nos testes, `overrideProvider(LLM).useClass(FakeLlmService)`).

- [ ] **Step 4: Run integração + e2e** — cobertura 100%.

- [ ] **Step 5: Stryker + commit** — `feat(api): DiscoveryModule — pré-filtro + ranking Claude -> trip_destinations`

---

## Self-Review

**1. Spec coverage:**
- `trips` §5.1, `trip_destinations` e `destination_catalog` §5 → Task 1. Seed do catálogo §6.1 → Task 2 (com a ressalva de ~20 vs. ~200 cidades — pendência de curadoria já registrada no PRD).
- Descoberta §6.2 (pré-filtro determinístico → shortlist ~20 → Claude escolhe da lista → zod + 1 retry → persistir) → Tasks 4, 5, 7.
- Uso do `taste_profiles` §5.2 → Task 7 (`ProfileService.get`).
- Custo LLM §6.5 → Task 5 (log estruturado por chamada; roteamento de modelo por env). **Tabela de persistência das métricas fica para depois** — decisão consciente, o log já dá observabilidade no MVP.
- Baseline de testes → unidade (shared, domain, llm), integração (db seed, trips, discovery com Postgres), e2e API (trips, discovery), mutação em todos, cobertura 100% por pacote.

**2. Placeholder scan:** sem "TBD". As duas escolhas em aberto do PRD que tocam este passo — teto de custo de LLM por roteiro e tamanho do catálogo — estão explicitadas nas Global Constraints e no self-review, não escondidas.

**3. Type consistency:** `TripInput` / `DestinationCandidate` / `LlmRanking` definidos na Task 3, consumidos nas Tasks 5–7. `CatalogEntry` definido na Task 4, usado pelo `CatalogRepository` (Task 7). `LlmPort.rankDestinations` (Task 5) é a única superfície que a Task 7 chama. `TripState` (Task 6) estende `Trip` com `destinations` que são `DestinationCandidate[]` (Task 3) — coerente.

## Execução

Cobre o **Passo 3** do backlog. Depende dos Passos 1 e 2 concluídos. Puxar o passo 3
(guideline do `CLAUDE.md`) antes de começar. Passos 4 e 5 podem ser puxados em
paralelo depois deste.

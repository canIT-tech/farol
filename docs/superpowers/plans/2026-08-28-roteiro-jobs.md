# Roteiro + Jobs (pg-boss) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao escolher um destino, a `apps/api` marca a escolha, cria um `itinerary` `pending` e enfileira o job `itinerary.generate`; o `apps/worker` (processo separado, sem HTTP) gera o roteiro dia a dia via Claude e persiste dias/itens; a `apps/web` faz polling em `GET /trips/:id/itinerary` até `ready`.

**Architecture:** `JobsModule` embrulha o **pg-boss** (fila no schema `pgboss` do próprio Postgres do Supabase) atrás de um port `JobQueue` (`publish` / `work`). A `apps/api` só **publica**. O `apps/worker` bootstra `ConfigModule + DbModule + LlmModule + JobsModule + ItineraryModule` sem servidor HTTP e **registra os handlers**. O handler `itinerary.generate` chama `LlmService.buildItinerary` (JSON schema forçado, itens `pinned` preservados), persiste `itinerary_days` + `itinerary_items` e marca `status = ready` (ou `failed` + retry do pg-boss). **Sem enrich de Places aqui** — isso é o Passo 6.

**Tech Stack:** herda dos Planos 1–3. Novo: `pg-boss`.

**Spec:** `docs/superpowers/specs/2026-08-27-mvp-trip-design.md` §5 (`itineraries`, `itinerary_days`, `itinerary_items`), §6.3 (geração de roteiro), §9 (jobs / pg-boss / worker), Apêndice (sequência). Tela: `Itinerary.dc.html`.

## Global Constraints

- Herdam dos Planos 1–3 (pnpm, Node 22, cobertura 100% por pacote, mutação ≥ 90%, TDD, `@farol/*`, env com zod, PT-BR nos comentários, DoD = testes completos).
- **pg-boss no schema `pgboss`** (isolado do schema de aplicação). Sem Redis. `retryLimit: 3`, `retryBackoff: true`, `expireInMinutes: 5`.
- **A `apps/api` nunca registra workers** — só `publish`. Só o `apps/worker` chama `work(...)`.
- **Handler idempotente:** reprocessar o mesmo `itineraryId` recomeça do zero (apaga dias/itens daquela versão antes de inserir).
- **Saída do LLM validada com zod**, 1 retry com o erro no prompt; segunda falha → `itineraries.status = 'failed'`, `error` preenchido, e o job **relança** (deixa o pg-boss reter). Após esgotar os retries, o job vai para arquivado + log estruturado.
- **LLM em teste = fake determinístico** (`FakeLlmService`, estendido nesta fase). Nenhuma chamada real no CI.
- **Latência alvo:** geração p95 ≤ 15 s (design §1.3) — fora do ciclo HTTP, então o gate é só do job; o endpoint HTTP responde na hora com `status: pending`.
- **Itens `pinned`** da versão anterior são passados ao LLM como fixos e recolocados na nova versão sem alteração.

---

### Task 1: `packages/db` — `itineraries`, `itinerary_days`, `itinerary_items` + migration

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0003_*.sql` (gerada)
- Test: `packages/db/src/schema.spec.ts` (novos casos)

**Interfaces:**
- Consumes: `trips` (Plano 3).
- Produces (colunas conforme design §5.1):
  - `itineraries`: `id uuid pk`, `tripId uuid notNull → trips.id onDelete cascade`, `version integer notNull`, `status text notNull default 'pending'` (pending|ready|failed), `error text`, `generatedAt timestamptz`, `createdAt timestamptz notNull defaultNow()`
  - `itinerary_days`: `id uuid pk`, `itineraryId uuid notNull → itineraries.id onDelete cascade`, `dayIndex integer notNull`, `date date`, `notes text`
  - `itinerary_items`: `id uuid pk`, `dayId uuid notNull → itinerary_days.id onDelete cascade`, `slot text notNull` (morning|afternoon|evening), `type text notNull` (activity|meal|transfer|free), `title text notNull`, `description text`, `placeId text`, `lat numeric`, `lng numeric`, `rating numeric`, `durationMin integer`, `estCost numeric`, `sortOrder integer notNull`, `pinned boolean notNull default false`
  - Índices: `itineraries (tripId, version)`, `itinerary_days (itineraryId, dayIndex)`, `itinerary_items (dayId, sortOrder)`
  - re-export das três no `index.ts`

- [ ] **Step 1: Casos de teste (falham)**

```ts
// packages/db/src/schema.spec.ts  (novos casos)
import { getTableColumns } from "drizzle-orm";
import { itineraries, itineraryDays, itineraryItems } from "./schema";

it("itineraries tem version, status e error", () => {
  const c = getTableColumns(itineraries);
  expect(c.version.notNull).toBe(true);
  expect(c.status.notNull).toBe(true);
  expect("error" in c).toBe(true);
});
it("itinerary_items tem slot, type, sortOrder e pinned", () => {
  const c = getTableColumns(itineraryItems);
  for (const k of ["slot","type","title","sortOrder","pinned"]) expect(c[k].notNull).toBe(true);
  expect("placeId" in c).toBe(true); // nulo nesta fase, preenchido no Passo 6
});
```

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/db vitest run`

- [ ] **Step 3: Implementar o schema** (Drizzle `pgTable`, FKs em cascade, índices). Re-export no `index.ts`.

- [ ] **Step 4: Gerar migration + aplicar + testar**

Run: `pnpm --filter @farol/db db:generate && docker compose up -d db && pnpm --filter @farol/db db:migrate && pnpm --filter @farol/db test`
Expected: `0003_*.sql` revisada; testes verdes, cobertura 100%.

- [ ] **Step 5: Commit** — `feat(db): itineraries, itinerary_days e itinerary_items + migration 0003`

---

### Task 2: `packages/shared` — DTOs de roteiro e da geração

**Files:**
- Create: `packages/shared/src/itinerary.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/itinerary.spec.ts`

**Interfaces:**
- Produces:
  - `slotEnum = z.enum(["morning","afternoon","evening"])`, `itemTypeEnum = z.enum(["activity","meal","transfer","free"])`, `itineraryStatusEnum = z.enum(["pending","ready","failed"])`
  - `itineraryItemSchema`: `{ id, slot, type, title, description: nullable, placeId: nullable, lat: nullable, lng: nullable, rating: nullable, durationMin: nullable, estCost: nullable, sortOrder, pinned }`
  - `itineraryDaySchema`: `{ id, dayIndex: int ≥ 1, date: nullable, notes: nullable, items: itineraryItemSchema[] }`
  - `itinerarySchema`: `{ id, tripId, version: int ≥ 1, status, error: nullable, generatedAt: nullable, days: itineraryDaySchema[] }`
  - `buildItineraryOutputSchema` (o que o Claude devolve): `{ days: z.array(z.object({ dayIndex: int, slots: z.array(z.object({ slot: slotEnum, type: itemTypeEnum, title: string(2..120), description: string.max(400).optional(), durationMin: int.positive().optional(), estCost: number.nonnegative().optional() })) })).min(1) }`
  - tipos inferidos: `ItineraryItem`, `ItineraryDay`, `Itinerary`, `BuildItineraryOutput`

- [ ] **Step 1: Testes (falham)** — `buildItineraryOutputSchema`: aceita 1 dia com slots válidos; rejeita `slot` fora do enum; rejeita `days` vazio; rejeita `estCost` negativo. `itinerarySchema`: aceita `status: "pending"` com `days: []`.

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/shared vitest run`

- [ ] **Step 3: Implementar** os schemas.

- [ ] **Step 4: Run — passa (100%) + mutação.**

- [ ] **Step 5: Commit** — `feat(shared): DTOs de itinerary e buildItineraryOutputSchema`

---

### Task 3: `apps/api` — `JobsModule` (wrapper pg-boss: publish / work)

**Files:**
- Create: `apps/api/src/jobs/jobs.module.ts`, `apps/api/src/jobs/job-queue.ts`, `apps/api/src/jobs/pgboss-queue.ts`, `apps/api/src/jobs/job-names.ts`
- Modify: `apps/api/src/config/env.schema.ts` (reusa `DATABASE_URL`; add `JOBS_SCHEMA` default `pgboss`)
- Test: `apps/api/src/jobs/pgboss-queue.spec.ts` (integração — pg-boss real no Postgres de teste)

**Interfaces:**
- Consumes: `envSchema` (`DATABASE_URL`, `JOBS_SCHEMA`).
- Produces:
  - `JOB_QUEUE` (injection token) → `JobQueue`.
  - `interface JobQueue { publish<T>(name: string, data: T): Promise<string>; work<T>(name: string, handler: (data: T) => Promise<void>): Promise<void>; }`
  - `PgBossQueue implements JobQueue, OnModuleInit, OnModuleDestroy` — `onModuleInit` faz `boss.start()` com `{ schema, retryLimit: 3, retryBackoff: true, expireInMinutes: 5 }`; `work` registra o handler; erro no handler propaga (pg-boss retenta); esgotados os retries, loga `{ job, data, error }` (dead-letter).
  - `JOB_NAMES = { itineraryGenerate: "itinerary.generate", itineraryRegenerateDay: "itinerary.regenerate-day" } as const`

- [ ] **Step 1: Teste de integração (falha)**

```ts
// apps/api/src/jobs/pgboss-queue.spec.ts  (resumo)
// - cria PgBossQueue(url, "pgboss_test"); onModuleInit()
// - registra work("t.echo", async (d) => { received.push(d) })
// - publish("t.echo", { n: 1 }); aguarda (poll ~2s) -> received contém { n: 1 }
// - handler que lança na 1ª e resolve na 2ª -> job roda 2x (retry do pg-boss)
// - onModuleDestroy() encerra sem pendurar
```

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/api vitest run` (com Postgres de pé)

- [ ] **Step 3: Implementar** `PgBossQueue` (dep `pg-boss`). Timeout curto nos testes via `newJobCheckIntervalSeconds` baixo.

- [ ] **Step 4: Run integração** — cobertura 100% (`*.module.ts` excluído; `job-names.ts` é dado, coberto por uso).

- [ ] **Step 5: Stryker + commit** — `feat(api): JobsModule com wrapper pg-boss (publish/work)`

---

### Task 4: `apps/api` — `LlmService.buildItinerary` + fake

**Files:**
- Modify: `apps/api/src/llm/llm.types.ts` (`LlmPort` ganha `buildItinerary`), `apps/api/src/llm/llm.service.ts`, `apps/api/src/llm/fake-llm.service.ts`
- Create: `apps/api/src/llm/prompts/build-itinerary.ts`
- Test: `apps/api/src/llm/llm.service.spec.ts` (novos casos), `apps/api/src/llm/fake-llm.service.spec.ts` (novos casos)

**Interfaces:**
- Produces:
  - `LlmPort.buildItinerary(input: BuildItineraryInput): Promise<BuildItineraryOutput>`
  - `BuildItineraryInput = { destination: { city: string; country: string }; nights: number; pace: TasteProfileInput["pace"]; interests: string[]; party: { adults: number; children: number }; pinned?: { dayIndex: number; slot: Slot; type: ItemType; title: string }[] }`
  - `LlmService.buildItinerary`: prompt de `prompts/build-itinerary.ts` com `LLM_MODEL_CAPABLE`; `JSON.parse` + `buildItineraryOutputSchema.parse`; 1 retry com o erro; loga `{ kind: "build_itinerary", model, tokens, estimatedUsd, latencyMs }`.
  - `FakeLlmService.buildItinerary`: gera `nights` dias, cada um com 3 slots determinísticos (morning=activity, afternoon=meal, evening=activity); reinsere os `pinned` no dia/slot correspondente.

- [ ] **Step 1: Testes (falham)** — real: SDK devolve JSON válido → parse ok; inválido→válido → 2 chamadas; inválido×2 → `DomainError("llm_invalid_output")`; `pinned` aparece no prompt (checar string). fake: `nights=7` → 7 dias; `pinned` de `{dayIndex:2,...}` está no dia 2.

- [ ] **Step 2: Run — falha.**

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Run — passa (100%) + mutação.**

- [ ] **Step 5: Commit** — `feat(api): LlmService.buildItinerary com JSON schema forçado e itens pinned`

---

### Task 5: `apps/api` — `ItineraryModule` (criar pending, enfileirar, servir) + handler

**Files:**
- Create: `apps/api/src/itinerary/itinerary.service.ts`, `apps/api/src/itinerary/itinerary.controller.ts`, `apps/api/src/itinerary/itinerary.module.ts`, `apps/api/src/itinerary/itinerary-generate.handler.ts`, `apps/api/src/itinerary/itinerary.repository.ts`
- Test: `apps/api/src/itinerary/itinerary.service.spec.ts` (integração), `apps/api/src/itinerary/itinerary-generate.handler.spec.ts` (integração, `FakeLlmService`), `apps/api/test/itinerary.e2e-spec.ts`

**Interfaces:**
- Consumes: token `DB`; `JOB_QUEUE`; `LLM` port; `TripsService.get` (Plano 3); `AuthGuard` + `@CurrentUser`; `@farol/shared` (`itinerarySchema`, `NotFoundError`, `ForbiddenError`, `DomainError`).
- Produces:
  - `ItineraryService.chooseDestination(userId, tripId, iata): Promise<{ itineraryId: string }>` — valida dono; marca `trip_destinations.chosen` e `trips.chosenDestinationId`; cria `itineraries` com `version = maxVersion+1`, `status='pending'`; `JOB_QUEUE.publish(JOB_NAMES.itineraryGenerate, { itineraryId })`.
  - `ItineraryService.getLatest(userId, tripId): Promise<Itinerary>` — última versão com dias/itens; `NotFoundError` se não houver.
  - `ItineraryGenerateHandler.handle(data: { itineraryId: string }): Promise<void>` — carrega itinerary + trip + destino + profile; `nights` do trip; chama `LLM.buildItinerary` (com `pinned` da versão anterior); **apaga** dias/itens da versão atual; insere `itinerary_days` + `itinerary_items` (`sortOrder` = ordem dos slots; `placeId/lat/lng/rating` = null nesta fase); `status='ready'`, `generatedAt=now()`. Em erro: `status='failed'`, `error=<mensagem>`, **relança** para o pg-boss reter.
  - `POST /trips/:id/destination { iata }` → 202 `{ itineraryId }`. `GET /trips/:id/itinerary` → 200 `Itinerary` (pode vir `status: pending`) | 404/403.

- [ ] **Step 1: Testes (falham)**

```ts
// itinerary.service.spec.ts  (integração)
// - chooseDestination: cria itineraries(pending, version=1); publish chamado com { itineraryId }
// - segunda chamada -> version=2
// - chooseDestination de trip de outro usuário -> ForbiddenError
// - getLatest sem itinerary -> NotFoundError

// itinerary-generate.handler.spec.ts  (integração + FakeLlmService)
// - dado itinerary pending + trip + destino + profile -> handle() persiste N dias e itens; status=ready; generatedAt setado
// - reprocessar o mesmo itineraryId -> não duplica dias (idempotente)
// - item pinned da versão anterior é recolocado igual
// - LLM lança -> status=failed, error preenchido, handle() relança

// itinerary.e2e-spec.ts
// - POST /trips/:id/destination -> 202 { itineraryId }
// - GET /trips/:id/itinerary -> 200 status "pending" (worker não roda no teste da api)
```

- [ ] **Step 2: Run — falha.**

- [ ] **Step 3: Implementar.** `ItineraryGenerateHandler` é `@Injectable()` e vive no `ItineraryModule` — **não** é registrado no `work()` aqui (só o worker registra, Task 6). O e2e da api valida só o caminho `pending`; o caminho `ready` ponta a ponta fica na Task 6.

- [ ] **Step 4: Run integração + e2e** — cobertura 100%.

- [ ] **Step 5: Stryker + commit** — `feat(api): ItineraryModule — escolher destino, enfileirar e servir roteiro`

---

### Task 6: `apps/worker` — bootstrap real + registro dos handlers + e2e ponta a ponta

**Files:**
- Modify: `apps/worker/src/main.worker.ts` (era stub do Plano 1)
- Create: `apps/worker/src/worker.module.ts`, `apps/worker/src/register-handlers.ts`
- Modify: `apps/worker/package.json` (deps de workspace, script `dev`/`start`), `turbo.json` se necessário
- Test: `apps/worker/test/generate.e2e-spec.ts` (e2e: enfileira → worker processa → `ready`)

**Interfaces:**
- Consumes: `ConfigModule`, `DbModule`, `LlmModule`, `JobsModule`, `ItineraryModule` (só os providers; sem `HealthModule`/controllers).
- Produces:
  - `WorkerModule` — `imports: [ConfigModule, DbModule, LlmModule, JobsModule, ItineraryModule]`.
  - `registerHandlers(app): Promise<void>` — pega `JOB_QUEUE` e `ItineraryGenerateHandler` do container e chama `queue.work(JOB_NAMES.itineraryGenerate, (d) => handler.handle(d))` (e `itineraryRegenerateDay` se já existir; senão fica para o Passo 6 real).
  - `main.worker.ts` — `NestFactory.createApplicationContext(WorkerModule)` (sem HTTP), `await registerHandlers(app)`, log "worker pronto".

- [ ] **Step 1: e2e (falha)**

```ts
// apps/worker/test/generate.e2e-spec.ts  (resumo)
// - sobe o WorkerModule em applicationContext + registerHandlers (LLM trocado por FakeLlmService)
// - via DB: cria trip + destino + profile + itinerary(pending)
// - publica itinerary.generate { itineraryId }
// - faz poll (~5s) em itineraries.status -> vira "ready", com dias/itens no banco
```

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/worker vitest run`

- [ ] **Step 3: Implementar** `WorkerModule`, `registerHandlers`, `main.worker.ts`.

- [ ] **Step 4: Run e2e** — passa; cobertura 100% (`main.worker.ts` excluído como bootstrap; `register-handlers.ts` coberto pelo e2e).

- [ ] **Step 5: Rodar o par api+worker localmente** — `pnpm --filter @farol/db db:migrate`, subir `apps/api` e `apps/worker`, `POST /trips/:id/destination` → poll `GET /trips/:id/itinerary` → `ready`.

- [ ] **Step 6: Stryker + commit** — `feat(worker): bootstrap sem HTTP + registro do handler itinerary.generate`

---

### Task 7: `apps/api` — regeneração de um dia (`itinerary.regenerate-day`)

**Files:**
- Create: `apps/api/src/itinerary/itinerary-regenerate-day.handler.ts`
- Modify: `apps/api/src/itinerary/itinerary.service.ts` (`regenerateDay`), `apps/api/src/itinerary/itinerary.controller.ts`, `apps/worker/src/register-handlers.ts`
- Test: `apps/api/src/itinerary/itinerary-regenerate-day.handler.spec.ts`, e2e no worker

**Interfaces:**
- Produces:
  - `ItineraryService.regenerateDay(userId, tripId, dayIndex): Promise<void>` — valida dono + itinerary `ready`; `JOB_QUEUE.publish(JOB_NAMES.itineraryRegenerateDay, { itineraryId, dayIndex })`.
  - `ItineraryRegenerateDayHandler.handle({ itineraryId, dayIndex })` — chama `LLM.buildItinerary` restrito a 1 dia (ou um método dedicado no fake), **preserva itens `pinned`** daquele dia, substitui só os itens não-`pinned` do dia.
  - `POST /trips/:id/itinerary/days/:dayIndex/regenerate` → 202.

- [ ] **Step 1: Testes (falham)** — handler: itens `pinned` do dia intactos; itens não-`pinned` trocados; outros dias inalterados. e2e worker: publica regenerate-day → dia N muda, resto igual.

- [ ] **Step 2–4:** implementar; registrar o handler no `apps/worker`; cobertura 100%.

- [ ] **Step 5: Stryker + commit** — `feat(api): regeneração de um dia do roteiro via job`

---

## Self-Review

**1. Spec coverage:**
- `itineraries` / `itinerary_days` / `itinerary_items` §5.1 → Task 1 (versionado, `status`, `pinned`, `placeId` nulo aguardando o Passo 6).
- Geração via job §6.3 (Claude JSON schema forçado → persistir dias/itens; falha → `failed` + retry) → Tasks 4, 5, 6. **Enrich de Places (§6.3 passo b) fica explicitamente no Passo 6.**
- Jobs / pg-boss / worker §9 (`retryLimit: 3`, `retryBackoff`, `expireInMinutes: 5`, dead-letter log, worker é 2º processo sem HTTP) → Tasks 3, 6.
- Regeneração parcial de um dia §5.3 (itens `pinned` preservados) → Task 7.
- Sequência do Apêndice (`POST /trips/:id/destination` → cria pending → enfileira → polling) → Task 5.
- Baseline de testes → integração real de pg-boss (Task 3), integração dos handlers com Postgres + `FakeLlmService` (Tasks 5, 7), e2e ponta a ponta no worker (Tasks 6, 7), cobertura 100% por pacote, mutação em todos.

**2. Placeholder scan:** sem "TBD". A separação "handler existe no ItineraryModule mas só o worker registra em `work()`" está dita nas Tasks 5 e 6. O caminho HTTP `ready` só é testado ponta a ponta na Task 6 (quando há worker) — anotado na Task 5.

**3. Type consistency:** `BuildItineraryOutput` / `Itinerary` / `Slot` / `ItemType` definidos na Task 2, usados nas Tasks 4–7. `JobQueue` (Task 3) é a única superfície de fila; `JOB_NAMES` compartilhado entre `api` e `worker`. `ItineraryGenerateHandler.handle({ itineraryId })` (Task 5) é registrado sem alteração de assinatura na Task 6. `LlmPort.buildItinerary` (Task 4) estende o port criado no Plano 3 sem quebrar `rankDestinations`.

## Execução

Cobre o **Passo 4** do backlog. Depende do Passo 3 concluído. Pode ser puxado em
paralelo com o Passo 5 (Providers Amadeus). Puxar o passo 4 (guideline do `CLAUDE.md`)
antes de começar. O Passo 6 (Google Places) liga o enrich dentro do handler desta fase.

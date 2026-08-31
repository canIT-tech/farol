# Plano de Correção — Débito Técnico dos Passos 2–5

> Não é feature. São correções pontuais de CI, configuração e placeholders acumulados
> nos Passos 2–5. Cada item é independente; ordem = risco. Pode virar 1 PR só
> (`chore/debito-tecnico-passos-2-5`) ou vários pequenos.

> **Nota 2026-08-31.** Onde este plano cita `AMADEUS_*`, `AmadeusFlightProvider`,
> "sandbox Amadeus" ou "fixtures Amadeus" (itens A2, C2, e o placeholder de
> `flightTimeHours`): a Amadeus descontinuou o Self-Service. O provider migra para
> **Travelpayouts** — ver `docs/negocio/2026-08-31-spec-migracao-travelpayouts.md`
> (Passo 10). Fazer a migração antes ou junto de C2; as envs de CI usam
> `TRAVELPAYOUTS_TOKEN` / `TRAVELPAYOUTS_MARKER`.

**Regra:** todo item que toca código passa pelos mesmos gates (cobertura 100%,
mutação ≥ break por pacote). Itens de config/CI validam com `pnpm build && pnpm
typecheck && pnpm lint && pnpm test && pnpm test:e2e` verdes.

---

## Bloco A — CI e ambiente (fazer primeiro)

### A1. `.env.example` completo — FEITO nesta sessão
- `.env.example` estava parado no Passo 2. Reescrito com todas as envs dos Passos 3–5
  (`ANTHROPIC_API_KEY`, `LLM_MODEL_*`, `JOBS_SCHEMA`, `AMADEUS_*`, `*_DEEPLINK_TEMPLATE`,
  `*_CACHE_TTL_SECONDS`, `DATABASE_URL_TEST`) + placeholder do `GOOGLE_PLACES_API_KEY`.
- **Verificação:** `grep -roE "process\.env\.[A-Z_]+" apps packages --include='*.ts' | grep -v spec`
  não pode ter var fora do `.env.example` (menos `CI`).

### A2. Envs no `.github/workflows/ci.yml`
- **Arquivo:** `.github/workflows/ci.yml`
- No bloco `env:` do job `check`, acrescentar valores fixos de teste:
  ```yaml
  SUPABASE_JWKS_URL: https://example.com/auth/v1/.well-known/jwks.json
  ANTHROPIC_API_KEY: sk-ant-ci
  AMADEUS_CLIENT_ID: amadeus-ci
  AMADEUS_CLIENT_SECRET: amadeus-ci-secret
  JOBS_SCHEMA: pgboss_ci
  ```
- Passo `db:seed` explícito **depois** do `db:migrate`:
  ```yaml
  - run: pnpm --filter @farol/db run db:seed
  ```
- **Porquê:** hoje os e2e só passam porque `apps/api/test/setup-e2e.ts` e o
  `apps/worker/test/generate.spec.ts` setam esses defaults por conta própria. É frágil —
  qualquer spec novo que suba `AppModule`/`WorkerModule` sem esse cuidado quebra o CI.
- **Verificação:** abrir um PR e ver o CI verde; localmente `env -i PATH=$PATH
  DATABASE_URL=... pnpm test` (ambiente mínimo) não pode depender de env do shell.

### A3. Banco de teste dedicado (opcional, mas recomendado)
- **Arquivos:** `docker-compose.yml`, `.github/workflows/ci.yml`, `packages/db/vitest.config.ts`
- `docker-compose.yml`: adicionar um init script que cria `farol_test`
  (`./docker/init-test-db.sql` com `CREATE DATABASE farol_test;`, montado em
  `/docker-entrypoint-initdb.d/`). Só roda em volume novo — documentar `docker compose down -v`.
- CI: passo `psql -c "CREATE DATABASE farol_test"` antes dos testes.
- Rodar os testes com `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/farol_test`
  no `env:` global (turbo já expõe `DATABASE_URL_TEST` em `globalEnv`; os specs já preferem
  ele a `DATABASE_URL`).
- **Ganho:** desfaz a necessidade da serialização `@farol/db#test → @farol/api#test` no
  `turbo.json` (pode voltar a paralelizar) e elimina o "banco sujo" local.
- **Se fizer:** remover as linhas `@farol/api#test` / `@farol/worker#test` do `turbo.json`
  e rodar `pnpm test` 3x seguidas pra confirmar que não flaka.

### A4. Mutação no CI — escopo e tempo
- **Arquivo:** `.github/workflows/ci.yml` (e talvez um `ci-mutation.yml` novo)
- `pnpm test:mutation` hoje roda Stryker em **todos** os pacotes, incluindo `apps/api`
  (grande) e os specs de pg-boss real dentro do sandbox. Tende a estourar tempo/flakar.
- Opções (escolher uma no PR):
  1. Mover `test:mutation` pra job separado com `continue-on-error: false` mas
     `if: github.event_name == 'pull_request'` e `timeout-minutes: 30`.
  2. Rodar mutação só nos pacotes com diff (`turbo run test:mutation --filter='...[origin/main]'`).
  3. Job nightly (`schedule:`) com mutação completa; no PR só cobertura + testes.
- **Recomendação:** opção 2 no PR + opção 3 nightly.

---

## Bloco B — Placeholders da pipeline (naturalmente fecham no Passo 6, mas anotar)

### B1. Clima e tempo de voo nos candidatos de destino
- **Onde:** `apps/api/src/discovery/discovery.service.ts` — `toCandidate()` usa
  `DEFAULT_EXPECTED_C = 22` e `flightTimeHours: null`.
- **Correção (Passo 6):** o enrich do Google Places (ou uma fonte de clima simples,
  ex. média histórica por mês/região no próprio `destination_catalog`) preenche
  `climate.expectedC` real. `flightTimeHours` pode sair do Amadeus (Passo 5 já tem
  `AmadeusFlightProvider`) — ligar no job de descoberta ou no de roteiro.
- **Sem esperar o Passo 6:** adicionar colunas `avg_temp_by_month jsonb` ao
  `destination_catalog` e popular no CSV; `toCandidate` lê o mês alvo. ~2h.

### B2. `itinerary_items` sem lugar/coordenadas
- **Onde:** `apps/api/src/itinerary/itinerary.repository.ts` — `replaceDays`/`replaceDayItems`
  gravam `placeId/lat/lng/rating` implícitos como `null` (nem passam no insert).
- **Correção:** é exatamente o Passo 6 (`swap_restaurant` + enrich no `ItineraryGenerateHandler`).
  Nenhuma ação agora além de manter o schema (já tem as colunas).

### B3. `prefilterDestinations({ excludeIata })` sem uso
- **Onde:** `packages/domain/src/discovery/prefilter.ts` aceita `excludeIata`, mas
  `DiscoveryService.run` sempre passa vazio (a descoberta substitui todos os
  `trip_destinations`, então não há o que excluir).
- **Decisão a tomar:** (a) manter para quando existir "rejeitar destino" no chat (Passo 7)
  — aí `excludeIata` = iatas de `trip_destinations` marcados como rejeitados (nova coluna
  `rejected boolean`); ou (b) remover o parâmetro até ter o caso de uso.
- **Recomendação:** manter (a) e criar a coluna quando o Passo 7 mexer no chat. Só anotar.

---

## Bloco C — Precisão e limpeza

### C1. Teto de custo de LLM por roteiro + preços reais
- **Onde:** `apps/api/src/llm/llm.types.ts` (`MODEL_PRICING`), `LlmService`
  (`rankDestinations`/`buildItinerary`).
- Ações:
  1. Fixar `MODEL_PRICING` com os preços vigentes da tabela oficial (input/output por 1M tok)
     e trocar o comentário "revisar" por "conferido em AAAA-MM-DD".
  2. Definir `LLM_ROUTE_BUDGET_USD` (env, default ex. `0.15`) e, no `LlmService`,
     somar o `estimatedUsd` das chamadas de um mesmo `tripId`+`kind`; ao passar do teto,
     lançar `DomainError("llm_budget_exceeded")` → 429 no filtro.
  3. Persistir as métricas: tabela `llm_calls` (migration nova) + gravar no lugar do
     `console.info`. Cobre a pendência "custo LLM §6.5" do design.
- **Gates:** `LlmService` já é 100%/mutação alta; manter. Nova tabela → hardening do
  `schema.spec` (padrão `checkColumns`).

### C2. Fixtures Amadeus reais
- **Onde:** `packages/providers/src/amadeus/__fixtures__/*.json`
- Com credenciais do sandbox Amadeus Self-Service: gravar 1 resposta real de cada
  endpoint (Flight Offers Search, Hotel List by City, Hotel Search v3), anonimizar o
  que for PII, substituir os arquivos. Rodar `pnpm --filter @farol/providers test` +
  mutação — não deve mudar nada além dos valores.

### C3. `AdvisorChat.tsx` — warning de eslint
- **Onde:** `packages/ui/src/AdvisorChat/AdvisorChat.tsx:26`
- Remover o `// eslint-disable-next-line @typescript-eslint/no-non-null-assertion`
  que não pega mais nada (o código foi ajustado para `const el = listRef.current!`
  numa linha que a regra não cobre). Rodar `pnpm --filter @farol/ui lint` limpo.
- ~5 min. Fecha o único warning do monorepo.

### C4. `apps/web` desatualizado (na verdade é o Passo 8)
- As telas de descoberta/destino/roteiro/voo/hotel ainda são as `.dc.html` de design;
  o `apps/web` real só tem login + onboarding + status. Ligar tudo ao `apps/api` +
  polling do roteiro + Playwright do fluxo completo é o **Passo 8** — não antecipar aqui,
  só garantir que o backlog reflete isso (reflete).

---

## Ordem sugerida
1. **A2** (envs no CI) — 30 min, destrava PRs.
2. **C3** (warning eslint) — 5 min.
3. **A1** já feito; commitar `.env.example`.
4. **A4** (escopo da mutação no CI) — 1–2h.
5. **A3** (banco de teste dedicado) — 2–3h; reverte a serialização do turbo.
6. **C1** (custo de LLM) — meio dia; casa com a pendência do PRD.
7. **B1** (clima/tempo de voo) — junto com o Passo 6.
8. **C2** (fixtures Amadeus) — quando houver credenciais.
9. **B3** — anotar; implementa junto do Passo 7.

## Definition of Done
- CI verde num PR limpo, sem depender de env do shell local.
- `.env.example` cobre 100% das `process.env.*` lidas fora de testes.
- `pnpm lint` sem warnings.
- Nenhum item do "Débito técnico conhecido" do `CLAUDE.md` sem link para issue/PR ou
  para o passo do backlog que o resolve.

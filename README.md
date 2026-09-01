# Farol

O assessor que guia a viagem inteira. Ver `CLAUDE.md` para o contexto do projeto,
`docs/` para PRD, design técnico e planos de implementação.

## Requisitos

- Node 22+ (`.nvmrc`)
- pnpm (`corepack enable`)
- Docker (Postgres local para testes/migração)

## Setup

```bash
pnpm install
docker compose up -d db
cp .env.example .env          # ajuste o que precisar
source .env
pnpm build                    # os packages/* publicam dist/; api e worker leem de lá
pnpm --filter @farol/db run db:migrate
pnpm --filter @farol/db run db:seed   # catálogo de destinos; sem ele a descoberta não acha nada
```

O `pnpm build` é obrigatório antes do primeiro `dev`: cada `packages/*` expõe
`./dist/index.js`, e `pnpm --filter <app> dev` chama o script do pacote direto,
sem passar pelo Turbo — então ninguém constrói as dependências por você.
`pnpm dev` (via Turbo) já resolve isso sozinho.

**Não há `dotenv` no projeto.** `apps/api` e `apps/worker` leem `process.env`
direto, então as envs precisam estar no shell — daí o `source .env`. O
`apps/web` é a exceção: o Next lê `apps/web/.env.local` sozinho.

## Rodando em desenvolvimento

Três processos, cada um no seu terminal:

```bash
source .env && pnpm --filter @farol/api dev      # NestJS  :3333
source .env && pnpm --filter @farol/worker dev   # jobs (pg-boss)
pnpm --filter @farol/web dev                     # Next    :3000
```

Sem o `worker` de pé, o roteiro fica `pending` para sempre — a geração roda em job.

A rota `/` do web é a **landing pública**; o fluxo do app começa em `/login`.
Verificação rápida da API: `curl localhost:3333/health`.

Para checar que a API sobe de verdade (Node cru, sem Vitest no caminho):
`source .env && pnpm --filter @farol/api smoke`.

### IA é opcional

A aplicação sobe **sem nenhuma env de LLM**. Nesse modo, descoberta de destino,
geração de roteiro e chat respondem `503 llm_not_configured`; todo o resto
(landing, waitlist, login, onboarding, viagens, Places, enrich) funciona.

Para ligar, defina as quatro juntas — `LLM_PROVIDER` presente torna as outras
três obrigatórias, e a falta de qualquer uma barra no boot:

```
LLM_PROVIDER=anthropic|groq|openai
LLM_API_KEY=...
LLM_MODEL_CAPABLE=...
LLM_MODEL_CHEAP=...
```

Trocar de provider, ou de modelo dentro do mesmo provider, é só mudar env:
nenhum código conhece fornecedor. Ver
`docs/superpowers/specs/2026-08-31-llm-provider-agnostico-design.md`.

## Rodando os testes

```bash
pnpm lint            # eslint em todos os workspaces
pnpm typecheck       # tsc --noEmit em todos os workspaces
pnpm test            # unidade + integração, com cobertura 100% por pacote (falha abaixo)
pnpm test:e2e        # e2e da api (Vitest+Supertest) e do web (Playwright)
pnpm test:mutation   # StrykerJS por pacote (falha abaixo do threshold.break)
```

Os testes de banco e os e2e da api usam o Postgres do `docker-compose.yml`.
Playwright precisa dos browsers: `pnpm exec playwright install chromium`.

## CI

`.github/workflows/ci.yml` roda lint, typecheck, testes, e2e e mutação em todo
push e PR. **Configurar no GitHub que o job `check` seja obrigatório para merge na
`main`** (Settings → Branches → branch protection rule).

## Estrutura

```
apps/
  web/       Next.js (App Router) — só frontend
  api/       NestJS — HTTP + orquestração
  worker/    NestJS — jobs (stub no Passo 1)
packages/
  shared/    DTOs, zod, erros de domínio
  db/        Drizzle (schema + migrations)
  domain/    lógica pura (stub no Passo 1)
  providers/ interfaces de provider (stub no Passo 1)
```

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
DATABASE_URL=postgres://postgres:postgres@localhost:5432/farol pnpm --filter @farol/db run db:migrate
```

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

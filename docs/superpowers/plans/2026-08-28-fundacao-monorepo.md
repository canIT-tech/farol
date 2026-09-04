# Fundação do Monorepo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o monorepo Farol de pé — `turbo dev` sobe `apps/web` e `apps/api`, `/health` responde verde consultando o Postgres do Supabase, uma migration Drizzle aplicada, e o harness de testes (Vitest + Playwright + Stryker) com gates de cobertura 100% e mutação rodando no CI.

**Architecture:** Monorepo Turborepo com pnpm workspaces. `apps/web` (Next.js App Router, só frontend), `apps/api` (NestJS HTTP), `apps/worker` (stub por enquanto). `packages/`: `shared` (DTOs/zod/erros), `db` (Drizzle + migrations), `domain` (lógica pura, stub), `providers` (stub). `apps/api` é stateless; todo estado no Postgres do Supabase.

**Tech Stack:** pnpm, Turborepo, TypeScript 5.6, NestJS 10, Next.js 15 (App Router), Drizzle ORM + `postgres` (postgres.js), Supabase Postgres, Vitest (+ `unplugin-swc` para os decorators do Nest), Supertest, Playwright, StrykerJS, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-27-mvp-trip-design.md` (seções 3, 5, 9, 11) e `CLAUDE.md` (seção "Baseline de testes").

## Global Constraints

- **Gerenciador de pacotes:** pnpm. `packageManager` fixo no `package.json` raiz. Node **22 LTS** (`.nvmrc` = `22`).
- **Cobertura:** gate de **100%** (`statements`, `branches`, `functions`, `lines`) por pacote, no `vitest.config` de cada workspace, provider `v8`. Exclusões só as listadas no `CLAUDE.md`.
- **Mutação:** StrykerJS por pacote; `thresholds.break = 90`. No Passo 1 pode ficar em `high = 100 / low = 80 / break = 60` só nos pacotes que ainda quase não têm código — mas o Stryker **tem que rodar** no CI.
- **TDD:** todo arquivo de código nasce de um `*.spec.ts` que falha primeiro.
- **Sem estado em `apps/api`:** nada de sessão em memória.
- **Nomes:** pacotes publicáveis com escopo `@farol/*` (`@farol/shared`, `@farol/db`, `@farol/domain`, `@farol/providers`). `private: true` em todos.
- **Env:** validada com zod no boot; falha o processo se inválida. Segredos só via variável de ambiente. `.env.example` versionado; `.env` no `.gitignore`.
- **Idioma:** identificadores em inglês; comentários e docs em PT-BR.
- **Commits:** pequenos, um por passo. Mensagens terminam com as linhas `Co-Authored-By` / `Claude-Session` do projeto.

---

### Task 1: Scaffold do monorepo (pnpm + Turborepo + TS base)

**Files:**
- Create: `package.json` (raiz), `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.npmrc`, `.editorconfig`, `.env.example`
- Modify: `.gitignore` (append)
- Test: `tools/scaffold.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: workspaces `apps/*` e `packages/*` reconhecidos pelo pnpm; scripts `pnpm build`, `pnpm dev`, `pnpm test`, `pnpm test:e2e`, `pnpm test:mutation`, `pnpm lint` na raiz delegando ao Turbo; `tsconfig.base.json` com `paths` para `@farol/*`.

- [ ] **Step 1: Write the failing test**

```ts
// tools/scaffold.spec.ts
import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";

describe("scaffold do monorepo", () => {
  it("declara pnpm workspaces para apps e packages", () => {
    const ws = readFileSync("pnpm-workspace.yaml", "utf8");
    expect(ws).toContain("apps/*");
    expect(ws).toContain("packages/*");
  });

  it("fixa o packageManager como pnpm e Node 22", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.packageManager).toMatch(/^pnpm@/);
    expect(pkg.engines.node).toContain("22");
    expect(readFileSync(".nvmrc", "utf8").trim()).toBe("22");
  });

  it("expõe os scripts de pipeline na raiz", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    for (const s of ["build", "dev", "test", "test:e2e", "test:mutation", "lint"]) {
      expect(pkg.scripts[s]).toBeDefined();
    }
  });

  it("mapeia os aliases @farol/* no tsconfig base", () => {
    const ts = JSON.parse(readFileSync("tsconfig.base.json", "utf8"));
    expect(ts.compilerOptions.paths["@farol/shared"]).toEqual(["packages/shared/src"]);
    expect(ts.compilerOptions.paths["@farol/db"]).toEqual(["packages/db/src"]);
  });

  it("nao versiona .env.example", () => {
    const ig = readFileSync(".gitignore", "utf8");
    expect(ig).toMatch(/^\.env$/m);
    expect(existsSync(".env.example")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tools/scaffold.spec.ts`
Expected: FAIL — `pnpm-workspace.yaml` não existe / arquivos ausentes.

- [ ] **Step 3: Criar os arquivos de scaffold**

`package.json` (raiz):

```json
{
  "name": "farol",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=22 <23" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "test:mutation": "turbo run test:mutation",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "eslint": "^9.11.0",
    "prettier": "^3.3.0"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "test:e2e": { "dependsOn": ["^build"], "cache": false },
    "test:mutation": { "dependsOn": ["^build"], "cache": false, "outputs": ["reports/mutation/**"] }
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@farol/shared": ["packages/shared/src"],
      "@farol/db": ["packages/db/src"],
      "@farol/domain": ["packages/domain/src"],
      "@farol/providers": ["packages/providers/src"]
    }
  }
}
```

`.nvmrc` → `22`
`.npmrc` → `auto-install-peers=true\nstrict-peer-dependencies=false`
`.env.example`:

```
# Postgres do Supabase (connection string direta ou pooler)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/farol
# API
API_PORT=3333
# Supabase (usado a partir do Passo 2)
SUPABASE_URL=
SUPABASE_JWKS_URL=
SUPABASE_SERVICE_ROLE_KEY=
# Web
NEXT_PUBLIC_API_URL=http://localhost:3333
```

Append em `.gitignore`:

```
# Env
.env
.env.local

# Build
dist/
.next/
.turbo/
coverage/
reports/
playwright-report/
test-results/
```

Adicionar `vitest.config.ts` na raiz só para os testes de `tools/`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tools/**/*.spec.ts"], environment: "node" }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm install && pnpm vitest run tools/scaffold.spec.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .nvmrc .npmrc .editorconfig .env.example .gitignore vitest.config.ts tools/scaffold.spec.ts pnpm-lock.yaml
git commit -m "chore: scaffold turborepo com pnpm workspaces e tsconfig base"
```

---

### Task 2: `packages/shared` — DTOs, zod e erros de domínio

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`, `packages/shared/src/index.ts`, `packages/shared/src/errors.ts`, `packages/shared/src/health.ts`
- Test: `packages/shared/src/errors.spec.ts`, `packages/shared/src/health.spec.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json`.
- Produces:
  - `class DomainError extends Error { readonly code: string; constructor(code: string, message: string) }`
  - `class NotFoundError extends DomainError` / `class ForbiddenError extends DomainError` / `class ValidationError extends DomainError`
  - `isDomainError(e: unknown): e is DomainError`
  - `healthResponseSchema` (zod) → `{ status: "ok" | "degraded"; checks: { db: "up" | "down" }; version: string }`
  - `type HealthResponse = z.infer<typeof healthResponseSchema>`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/shared/src/errors.spec.ts
import { describe, it, expect } from "vitest";
import { DomainError, NotFoundError, ForbiddenError, isDomainError } from "./errors";

describe("erros de domínio", () => {
  it("DomainError carrega code e message", () => {
    const e = new DomainError("trip_not_found", "viagem não encontrada");
    expect(e.code).toBe("trip_not_found");
    expect(e.message).toBe("viagem não encontrada");
    expect(e).toBeInstanceOf(Error);
  });

  it("subclasses fixam o code", () => {
    expect(new NotFoundError("x").code).toBe("not_found");
    expect(new ForbiddenError("x").code).toBe("forbidden");
  });

  it("isDomainError discrimina", () => {
    expect(isDomainError(new NotFoundError("x"))).toBe(true);
    expect(isDomainError(new Error("x"))).toBe(false);
    expect(isDomainError(null)).toBe(false);
  });
});
```

```ts
// packages/shared/src/health.spec.ts
import { describe, it, expect } from "vitest";
import { healthResponseSchema } from "./health";

describe("healthResponseSchema", () => {
  it("aceita um payload válido", () => {
    const ok = healthResponseSchema.parse({
      status: "ok", checks: { db: "up" }, version: "0.0.0"
    });
    expect(ok.status).toBe("ok");
  });

  it("rejeita status fora do enum", () => {
    expect(() => healthResponseSchema.parse({
      status: "fine", checks: { db: "up" }, version: "0.0.0"
    })).toThrow();
  });

  it("rejeita check db ausente", () => {
    expect(() => healthResponseSchema.parse({
      status: "ok", checks: {}, version: "0.0.0"
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @farol/shared vitest run`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implementar**

`packages/shared/package.json`:

```json
{
  "name": "@farol/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src",
    "test": "vitest run --coverage",
    "test:mutation": "stryker run"
  },
  "dependencies": { "zod": "^3.23.0" },
  "devDependencies": {
    "@stryker-mutator/core": "^8.6.0",
    "@stryker-mutator/vitest-runner": "^8.6.0"
  }
}
```

`packages/shared/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src"] }
```

`packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/*.spec.ts"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});
```

`packages/shared/src/errors.ts`:

```ts
export class DomainError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class NotFoundError extends DomainError {
  constructor(message: string) { super("not_found", message); }
}
export class ForbiddenError extends DomainError {
  constructor(message: string) { super("forbidden", message); }
}
export class ValidationError extends DomainError {
  constructor(message: string) { super("validation", message); }
}
export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
```

`packages/shared/src/health.ts`:

```ts
import { z } from "zod";
export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  checks: z.object({ db: z.enum(["up", "down"]) }),
  version: z.string()
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
```

`packages/shared/src/index.ts`:

```ts
export * from "./errors";
export * from "./health";
```

`packages/shared/stryker.config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/stryker-mutator/stryker-js/master/packages/api/schema/stryker-schema.json",
  "testRunner": "vitest",
  "reporters": ["progress", "clear-text", "html"],
  "mutate": ["src/**/*.ts", "!src/**/*.spec.ts", "!src/index.ts"],
  "htmlReporter": { "fileName": "reports/mutation/shared.html" },
  "thresholds": { "high": 100, "low": 80, "break": 90 }
}
```

- [ ] **Step 4: Run to verify pass (com cobertura)**

Run: `pnpm --filter @farol/shared test`
Expected: PASS, cobertura 100% (0 linhas descobertas).

- [ ] **Step 5: Rodar mutação**

Run: `pnpm --filter @farol/shared test:mutation`
Expected: mutation score ≥ 90.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): erros de domínio e healthResponseSchema com cobertura 100%"
```

---

### Task 3: `packages/db` — Drizzle, schema `users` e primeira migration

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/vitest.config.ts`, `packages/db/drizzle.config.ts`, `packages/db/src/schema.ts`, `packages/db/src/client.ts`, `packages/db/src/migrate.ts`, `packages/db/src/index.ts`, `packages/db/drizzle/` (migration gerada)
- Create: `docker-compose.yml` (raiz — Postgres local para testes/migração)
- Test: `packages/db/src/schema.spec.ts`, `packages/db/src/client.spec.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` do ambiente.
- Produces:
  - `users` table (Drizzle): `id uuid pk`, `email text notNull`, `displayName text`, `createdAt timestamptz default now()`
  - `createDbClient(url: string): { db: PostgresJsDatabase<typeof schema>; close: () => Promise<void> }`
  - `runMigrations(url: string): Promise<void>`
  - `export * as schema` e re-export de `users`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/db/src/schema.spec.ts
import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { users } from "./schema";

describe("schema.users", () => {
  it("tem as colunas mínimas do design (seção 5.1)", () => {
    const cols = Object.keys(getTableColumns(users));
    expect(cols.sort()).toEqual(["createdAt", "displayName", "email", "id"].sort());
  });

  it("id é a primary key", () => {
    const { id } = getTableColumns(users);
    expect(id.primary).toBe(true);
  });

  it("email é notNull", () => {
    const { email } = getTableColumns(users);
    expect(email.notNull).toBe(true);
  });
});
```

```ts
// packages/db/src/client.spec.ts
import { describe, it, expect, afterAll } from "vitest";
import { createDbClient } from "./client";
import { runMigrations } from "./migrate";
import { users } from "./schema";
import { sql } from "drizzle-orm";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL!;
const { db, close } = createDbClient(url);
afterAll(() => close());

describe("createDbClient + runMigrations", () => {
  it("aplica as migrations e a tabela users existe", async () => {
    await runMigrations(url);
    const rows = await db.execute(
      sql`select 1 from information_schema.tables where table_name = 'users'`
    );
    expect(rows.length).toBe(1);
  });

  it("faz insert e select de um usuário", async () => {
    const id = crypto.randomUUID();
    await db.insert(users).values({ id, email: `u_${id}@farol.test` });
    const found = await db.select().from(users).where(sql`${users.id} = ${id}`);
    expect(found[0]?.email).toBe(`u_${id}@farol.test`);
  });
});
```

- [ ] **Step 2: Subir Postgres local e rodar (falha)**

`docker-compose.yml` (raiz):

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: farol
    ports: ["5432:5432"]
```

Run: `docker compose up -d db && pnpm --filter @farol/db vitest run`
Expected: FAIL — módulos e migration não existem.

- [ ] **Step 3: Implementar**

`packages/db/package.json`:

```json
{
  "name": "@farol/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src",
    "test": "vitest run --coverage",
    "test:mutation": "stryker run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/migrate.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.33.0",
    "postgres": "^3.4.4"
  },
  "devDependencies": {
    "drizzle-kit": "^0.24.0",
    "tsx": "^4.19.0",
    "@stryker-mutator/core": "^8.6.0",
    "@stryker-mutator/vitest-runner": "^8.6.0"
  }
}
```

`packages/db/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" }
});
```

`packages/db/src/schema.ts`:

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
```

`packages/db/src/client.ts`:

```ts
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDbClient(url: string): {
  db: PostgresJsDatabase<typeof schema>;
  close: () => Promise<void>;
} {
  const sql = postgres(url, { max: 5 });
  return { db: drizzle(sql, { schema }), close: () => sql.end({ timeout: 5 }) };
}
```

`packages/db/src/migrate.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";

export async function runMigrations(url: string): Promise<void> {
  const sql = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url))
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente");
  runMigrations(url).then(() => console.log("migrations aplicadas"));
}
```

`packages/db/src/index.ts`:

```ts
export * from "./client";
export * from "./migrate";
export * as schema from "./schema";
export { users } from "./schema";
```

`packages/db/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/*.spec.ts"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});
```

`packages/db/tsconfig.json` — igual ao de `shared`.

- [ ] **Step 4: Gerar a migration**

Run: `pnpm --filter @farol/db db:generate`
Expected: cria `packages/db/drizzle/0000_*.sql` com a tabela `users`. Revisar o SQL.

- [ ] **Step 5: Run tests (com Postgres de pé)**

Run: `pnpm --filter @farol/db test`
Expected: PASS, cobertura 100%.

- [ ] **Step 6: Rodar mutação + commit**

```bash
pnpm --filter @farol/db test:mutation
git add packages/db docker-compose.yml
git commit -m "feat(db): drizzle client, schema users e primeira migration"
```

---

### Task 4: `apps/api` — NestJS boot, ConfigModule (zod) e HealthModule

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json`, `apps/api/vitest.config.ts`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/config/config.module.ts`, `apps/api/src/config/env.schema.ts`, `apps/api/src/health/health.module.ts`, `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.service.ts`, `apps/api/src/db/db.module.ts`
- Test: `apps/api/src/config/env.schema.spec.ts`, `apps/api/src/health/health.service.spec.ts`, `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: `@farol/db` (`createDbClient`), `@farol/shared` (`healthResponseSchema`, `HealthResponse`).
- Produces:
  - `envSchema` (zod) → `{ DATABASE_URL: string; API_PORT: number }` com `API_PORT` default `3333`, coerção de número.
  - `parseEnv(raw: Record<string,string|undefined>): Env` — lança `Error` com lista de campos inválidos.
  - `DB` (Nest injection token) → `PostgresJsDatabase<typeof schema>`
  - `HealthService.check(): Promise<HealthResponse>` — roda `select 1`; `db: "up"` / `status: "ok"` no sucesso, `db: "down"` / `status: "degraded"` no erro.
  - `GET /health` → 200 com `HealthResponse` quando ok, 503 quando degraded.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/config/env.schema.spec.ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "./env.schema";

describe("parseEnv", () => {
  it("aplica default de API_PORT", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://x" });
    expect(env.API_PORT).toBe(3333);
  });
  it("coage API_PORT para número", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://x", API_PORT: "4000" });
    expect(env.API_PORT).toBe(4000);
  });
  it("lança quando DATABASE_URL falta", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
```

```ts
// apps/api/src/health/health.service.spec.ts
import { describe, it, expect, vi } from "vitest";
import { HealthService } from "./health.service";

const dbOk = { execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]) };
const dbDown = { execute: vi.fn().mockRejectedValue(new Error("no conn")) };

describe("HealthService", () => {
  it("status ok quando o banco responde", async () => {
    const res = await new HealthService(dbOk as never).check();
    expect(res).toMatchObject({ status: "ok", checks: { db: "up" } });
  });
  it("status degraded quando o banco falha", async () => {
    const res = await new HealthService(dbDown as never).check();
    expect(res).toMatchObject({ status: "degraded", checks: { db: "down" } });
  });
});
```

```ts
// apps/api/test/health.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

let app: INestApplication;
beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
});
afterAll(() => app.close());

describe("GET /health", () => {
  it("responde 200 e o shape do healthResponseSchema", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", checks: { db: "up" } });
    expect(typeof res.body.version).toBe("string");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @farol/api vitest run`
Expected: FAIL — nada implementado.

- [ ] **Step 3: Implementar**

`apps/api/package.json`:

```json
{
  "name": "@farol/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src test",
    "test": "vitest run --coverage",
    "test:e2e": "vitest run --config vitest.config.e2e.ts",
    "test:mutation": "stryker run"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "@farol/db": "workspace:*",
    "@farol/shared": "workspace:*",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/testing": "^10.4.0",
    "supertest": "^7.0.0",
    "unplugin-swc": "^1.5.1",
    "@swc/core": "^1.7.0",
    "@stryker-mutator/core": "^8.6.0",
    "@stryker-mutator/vitest-runner": "^8.6.0"
  }
}
```

`apps/api/vitest.config.ts` (unidade — decorators via swc):

```ts
import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts", "src/**/*.module.ts", "src/**/*.spec.ts"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});
```

`apps/api/vitest.config.e2e.ts`:

```ts
import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";
export default defineConfig({
  plugins: [swc.vite()],
  test: { environment: "node", include: ["test/**/*.e2e-spec.ts"], coverage: { enabled: false } }
});
```

`apps/api/src/config/env.schema.ts`:

```ts
import { z } from "zod";
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3333)
});
export type Env = z.infer<typeof envSchema>;
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const r = envSchema.safeParse(raw);
  if (!r.success) {
    const fields = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Env inválida: ${fields}`);
  }
  return r.data;
}
```

`apps/api/src/config/config.module.ts`:

```ts
import { Global, Module } from "@nestjs/common";
import { parseEnv, type Env } from "./env.schema";

export const ENV = Symbol("ENV");

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: (): Env => parseEnv(process.env) }],
  exports: [ENV]
})
export class ConfigModule {}
```

`apps/api/src/db/db.module.ts`:

```ts
import { Global, Module } from "@nestjs/common";
import { createDbClient } from "@farol/db";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";

export const DB = Symbol("DB");

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ENV],
      useFactory: (env: Env) => createDbClient(env.DATABASE_URL).db
    }
  ],
  exports: [DB]
})
export class DbModule {}
```

`apps/api/src/health/health.service.ts`:

```ts
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { HealthResponse } from "@farol/shared";
import { DB } from "../db/db.module";

@Injectable()
export class HealthService {
  constructor(@Inject(DB) private readonly db: { execute: (q: unknown) => Promise<unknown> }) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: "ok", checks: { db: "up" }, version: process.env.npm_package_version ?? "0.0.0" };
    } catch {
      return { status: "degraded", checks: { db: "down" }, version: process.env.npm_package_version ?? "0.0.0" };
    }
  }
}
```

`apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get, HttpCode } from "@nestjs/common";
import { HealthService } from "./health.service";
import type { HealthResponse } from "@farol/shared";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(200)
  async get(): Promise<HealthResponse> {
    return this.health.check();
  }
}
```

> Nota: para o e2e que espera 503 no estado degraded, adicionar depois um interceptor/filtro
> que troca o status quando `body.status === "degraded"`. No Passo 1 o e2e cobre só o caminho 200.

`apps/api/src/health/health.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({ controllers: [HealthController], providers: [HealthService] })
export class HealthModule {}
```

`apps/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { HealthModule } from "./health/health.module";

@Module({ imports: [ConfigModule, DbModule, HealthModule] })
export class AppModule {}
```

`apps/api/src/main.ts`:

```ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { parseEnv } from "./config/env.schema";

async function bootstrap(): Promise<void> {
  const env = parseEnv(process.env);
  const app = await NestFactory.create(AppModule);
  await app.listen(env.API_PORT);
}
void bootstrap();
```

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "test"]
}
```

`apps/api/nest-cli.json`:

```json
{ "collection": "@nestjs/schematics", "sourceRoot": "src" }
```

- [ ] **Step 4: Run unit tests**

Run: `pnpm --filter @farol/api test`
Expected: PASS, cobertura 100% (arquivos de `.module.ts` e `main.ts` excluídos).

- [ ] **Step 5: Run e2e (Postgres de pé + migrations aplicadas)**

Run: `pnpm --filter @farol/db db:migrate && pnpm --filter @farol/api test:e2e`
Expected: `GET /health` → 200 com `{ status: "ok", checks: { db: "up" } }`.

- [ ] **Step 6: Stryker + commit**

```bash
pnpm --filter @farol/api test:mutation
git add apps/api
git commit -m "feat(api): boot NestJS com ConfigModule zod, DbModule e GET /health"
```

---

### Task 5: `apps/web` — Next.js App Router e página que consome `/health`

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.mjs`, `apps/web/vitest.config.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/status/page.tsx`, `apps/web/e2e/smoke.spec.ts`, `apps/web/playwright.config.ts`
- Test: `apps/web/src/lib/api.spec.ts`

**Interfaces:**
- Consumes: `@farol/shared` (`healthResponseSchema`, `HealthResponse`), `NEXT_PUBLIC_API_URL`.
- Produces:
  - `fetchHealth(fetchImpl?: typeof fetch): Promise<HealthResponse>` — GET `${NEXT_PUBLIC_API_URL}/health`, valida com `healthResponseSchema`, lança em resposta inválida.
  - Rota `/status` (Server Component) que renderiza `status` e `checks.db`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/api.spec.ts
import { describe, it, expect, vi } from "vitest";
import { fetchHealth } from "./api";

const ok: Response = new Response(
  JSON.stringify({ status: "ok", checks: { db: "up" }, version: "0.0.0" }),
  { status: 200, headers: { "content-type": "application/json" } }
);

describe("fetchHealth", () => {
  it("retorna o payload validado", async () => {
    const res = await fetchHealth(vi.fn().mockResolvedValue(ok) as never);
    expect(res.status).toBe("ok");
  });
  it("lança quando o payload não bate o schema", async () => {
    const bad = new Response(JSON.stringify({ status: "nope" }), { status: 200 });
    await expect(fetchHealth(vi.fn().mockResolvedValue(bad) as never)).rejects.toThrow();
  });
  it("lança em status HTTP != 200", async () => {
    const err = new Response("x", { status: 503 });
    await expect(fetchHealth(vi.fn().mockResolvedValue(err) as never)).rejects.toThrow(/503/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @farol/web vitest run`
Expected: FAIL — `./api` não existe.

- [ ] **Step 3: Implementar**

`apps/web/package.json`:

```json
{
  "name": "@farol/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "next build",
    "dev": "next dev -p 3000",
    "start": "next start -p 3000",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "next lint",
    "test": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:mutation": "stryker run"
  },
  "dependencies": {
    "@farol/shared": "workspace:*",
    "next": "^15.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "@vitejs/plugin-react": "^4.3.1",
    "@stryker-mutator/core": "^8.6.0",
    "@stryker-mutator/vitest-runner": "^8.6.0"
  }
}
```

`apps/web/src/lib/api.ts`:

```ts
import { healthResponseSchema, type HealthResponse } from "@farol/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export async function fetchHealth(fetchImpl: typeof fetch = fetch): Promise<HealthResponse> {
  const res = await fetchImpl(`${BASE}/health`, { cache: "no-store" });
  if (res.status !== 200) throw new Error(`health respondeu ${res.status}`);
  return healthResponseSchema.parse(await res.json());
}
```

`apps/web/src/app/status/page.tsx`:

```tsx
import { fetchHealth } from "../../lib/api";

export default async function StatusPage() {
  const h = await fetchHealth();
  return (
    <main>
      <h1>Status</h1>
      <p>API: {h.status}</p>
      <p>Banco: {h.checks.db}</p>
    </main>
  );
}
```

`apps/web/src/app/layout.tsx` e `page.tsx` — mínimos (um `<html><body>{children}</body></html>` e um "Farol").

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/**/*.spec.*"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});
```

> `src/app/**` (Server Components) fica coberto pelo e2e do Playwright, não pelo Vitest — refletido no `include` acima.

`apps/web/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI
  },
  use: { baseURL: "http://localhost:3000" }
});
```

`apps/web/e2e/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("a home carrega", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Farol")).toBeVisible();
});
```

- [ ] **Step 4: Run unit tests**

Run: `pnpm --filter @farol/web test`
Expected: PASS, cobertura 100% em `src/lib`.

- [ ] **Step 5: Run e2e (com api + web de pé)**

Run: `pnpm --filter @farol/api dev &` … `pnpm --filter @farol/web test:e2e`
Expected: smoke test verde.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): Next.js App Router com fetchHealth e rota /status"
```

---

### Task 6: Harness de testes central + CI (cobertura + mutação como gate)

**Files:**
- Create: `.github/workflows/ci.yml`, `stryker.config.json` (raiz, herança), `apps/api/stryker.config.json`, `apps/web/stryker.config.json`, `packages/domain/` (stub com 1 função + teste), `packages/providers/` (stub com 1 interface + teste)
- Modify: `turbo.json` (garantir `test`, `test:e2e`, `test:mutation`), `README.md` (seção "Rodando os testes")
- Test: `packages/domain/src/index.spec.ts`, `packages/providers/src/index.spec.ts`

**Interfaces:**
- Consumes: os scripts `test` / `test:e2e` / `test:mutation` de cada workspace (Tasks 2–5).
- Produces:
  - `packages/domain` e `packages/providers` como workspaces válidos com cobertura 100%.
  - Workflow de CI que roda em todo push e PR: `lint`, `typecheck`, `test` (com cobertura), `test:e2e`, `test:mutation`. **Job falha se qualquer gate falhar.**

- [ ] **Step 1: Stubs com teste primeiro (domain e providers)**

```ts
// packages/domain/src/index.spec.ts
import { describe, it, expect } from "vitest";
import { withinBudget } from "./index";

describe("withinBudget", () => {
  it("true quando o custo estimado cabe no orçamento", () => {
    expect(withinBudget(3000, 5000)).toBe(true);
  });
  it("false quando estoura", () => {
    expect(withinBudget(6000, 5000)).toBe(false);
  });
  it("true no limite exato", () => {
    expect(withinBudget(5000, 5000)).toBe(true);
  });
});
```

```ts
// packages/providers/src/index.spec.ts
import { describe, it, expect } from "vitest";
import { isFlightProvider } from "./index";

describe("isFlightProvider", () => {
  it("reconhece um objeto com search()", () => {
    expect(isFlightProvider({ search: async () => [] })).toBe(true);
  });
  it("rejeita objeto sem search", () => {
    expect(isFlightProvider({})).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @farol/domain vitest run && pnpm --filter @farol/providers vitest run`
Expected: FAIL.

- [ ] **Step 3: Implementar os stubs**

`packages/domain/src/index.ts`:

```ts
/** Custo estimado (voo + hospedagem + local) cabe no orçamento por pessoa? */
export function withinBudget(estimatedCost: number, budgetPerPerson: number): boolean {
  return estimatedCost <= budgetPerPerson;
}
```

`packages/providers/src/index.ts`:

```ts
export interface FlightSearchParams { origin: string; destination: string; departAt: string; }
export interface FlightOffer { price: number; currency: string; }
export interface FlightProvider { search(p: FlightSearchParams): Promise<FlightOffer[]>; }

export function isFlightProvider(x: unknown): x is FlightProvider {
  return typeof x === "object" && x !== null && typeof (x as FlightProvider).search === "function";
}
```

`package.json` / `tsconfig.json` / `vitest.config.ts` / `stryker.config.json` de cada um — espelhando `packages/shared` (Task 2), trocando nome e caminho do reporter.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm -r test`
Expected: todos os pacotes verdes, cada um com cobertura 100%.

- [ ] **Step 5: Escrever o workflow de CI**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: {}

jobs:
  check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres, POSTGRES_DB: farol }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s
          --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/farol
      NEXT_PUBLIC_API_URL: http://localhost:3333
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm --filter @farol/db db:migrate
      - run: pnpm test                 # cobertura 100% por pacote — falha se abaixo
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
      - run: pnpm test:mutation        # StrykerJS — falha abaixo do threshold.break
```

Documentar no `README.md`: exigir no GitHub que o job `check` seja obrigatório para merge na `main` (branch protection — passo manual do admin do repo).

- [ ] **Step 6: Rodar o pipeline inteiro local**

Run: `docker compose up -d db && pnpm install && pnpm lint && pnpm typecheck && pnpm --filter @farol/db db:migrate && pnpm test && pnpm test:e2e && pnpm test:mutation`
Expected: tudo verde; relatórios de cobertura em `*/coverage/`, de mutação em `reports/mutation/`.

- [ ] **Step 7: Commit**

```bash
git add .github packages/domain packages/providers stryker.config.json README.md turbo.json
git commit -m "chore(ci): pipeline com gates de cobertura 100% e mutação; stubs domain/providers"
```

---

## Self-Review

**1. Spec coverage:**
- Estrutura do monorepo (spec §3) → Tasks 1–6 criam `apps/{web,api}`, `packages/{shared,db,domain,providers}`. `apps/worker` fica como stub explícito para o Passo 4 do backlog — anotado, fora do escopo aqui.
- `users` table (spec §5.1) → Task 3.
- Auth via JWKS (spec §8) → **fora do escopo** (Passo 2 do backlog). `.env.example` já reserva `SUPABASE_JWKS_URL`.
- `/health` checando db, pg-boss, Amadeus (spec §4 HealthModule) → Task 4 cobre só o check de `db`; pg-boss e Amadeus entram com os Passos 4 e 5.
- Baseline de testes (`CLAUDE.md`) → Tasks 2–6: unidade, integração (Task 3/4 com Postgres), e2e API (Task 4), e2e web (Task 5), mutação (todas), cobertura 100% por pacote (todos os `vitest.config`).

**2. Placeholder scan:** sem "TBD"/"TODO" pendentes; a única nota de trabalho futuro (503 no `/health` degraded, `apps/worker`) está marcada explicitamente como próximo passo, com o caminho 200 já testado.

**3. Type consistency:** `HealthResponse` / `healthResponseSchema` definidos na Task 2 e consumidos nas Tasks 4 e 5 com o mesmo nome. `createDbClient` (Task 3) → usado na Task 4 via token `DB`. `FlightProvider.search` (Task 6) alinhado com o design §7.1.

## Execução

Este plano cobre o **Passo 1** do backlog do `CLAUDE.md`. Quem for executar deve primeiro
"puxar o passo 1" (guideline do `CLAUDE.md`): commit de claim na `main`, criar a branch
`<nome>/passo-1-fundacao`, e então rodar as Tasks 1→6 em ordem.

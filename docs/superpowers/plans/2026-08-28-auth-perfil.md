# Auth + Perfil de Gosto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Usuário faz login (Supabase: e-mail + Google) no `apps/web`, a `apps/api` valida o JWT do Supabase via JWKS e faz upsert em `users`, e o usuário salva/edita o perfil de gosto (`taste_profiles`) pelo onboarding.

**Architecture:** `apps/web` usa `@supabase/supabase-js` para login e guarda a sessão; envia o `access_token` como `Authorization: Bearer` para a `apps/api`. A `api` tem um `AuthGuard` que verifica a assinatura do JWT contra o JWKS do Supabase (chaves em cache), extrai `sub`/`email`, faz upsert em `users` no primeiro acesso e injeta `CurrentUser`. `ProfileModule` expõe `GET/PUT /me/profile`. `api` continua stateless.

**Tech Stack:** herda do Plano 1. Novo: `@supabase/supabase-js`, `jose` (verificação JWT/JWKS na api).

**Spec:** `docs/superpowers/specs/2026-08-27-mvp-trip-design.md` §5.1 (`users`), §5.2 (`taste_profiles`), §6.4 (perfil influenciando recomendações — só o modelo aqui), §8 (auth). Tela: `Onboarding.dc.html`. Tokens: `docs/design-system.md`.

## Global Constraints

- Herdam do Plano 1 (pnpm, Node 22, cobertura 100% por pacote, mutação ≥ 90%, TDD, `@farol/*`, env com zod, PT-BR nos comentários).
- **api stateless:** nenhuma sessão em memória. O único estado de auth é o upsert em `users`.
- **JWKS em cache** com TTL e refetch em `kid` desconhecido — nunca buscar o JWKS a cada request.
- **Sem RLS** nas tabelas de app (design §5.3): a autorização é `profile.userId === currentUser.id` na camada de serviço.
- **Testes de auth sem Supabase real:** gerar um par de chaves RSA no setup do teste, assinar um JWT de teste e servir um JWKS local (fake) — o `JwtVerifier` recebe a URL do JWKS por config.
- `.env.example` ganha `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

### Task 1: `packages/db` — tabela `taste_profiles` + migration

**Files:**
- Modify: `packages/db/src/schema.ts` (add `tasteProfiles`)
- Create: `packages/db/drizzle/0001_*.sql` (gerada)
- Test: `packages/db/src/schema.spec.ts` (add casos)

**Interfaces:**
- Consumes: `users` (Plano 1).
- Produces:
  - `tasteProfiles` table: `id uuid pk`, `userId uuid notNull unique → users.id`, `interests jsonb notNull default '[]'`, `pace text notNull`, `partyType text notNull`, `budgetBand text notNull`, `constraints jsonb notNull default '{}'`, `updatedAt timestamptz notNull defaultNow()`
  - re-export `tasteProfiles` no `index.ts`

- [ ] **Step 1: Adicionar casos ao teste de schema**

```ts
// packages/db/src/schema.spec.ts  (novos casos)
import { getTableColumns } from "drizzle-orm";
import { tasteProfiles } from "./schema";

it("taste_profiles tem as colunas do design §5.2", () => {
  const cols = Object.keys(getTableColumns(tasteProfiles)).sort();
  expect(cols).toEqual(
    ["budgetBand", "constraints", "id", "interests", "pace", "partyType", "updatedAt", "userId"].sort()
  );
});
it("userId é notNull e unique", () => {
  const { userId } = getTableColumns(tasteProfiles);
  expect(userId.notNull).toBe(true);
  expect(userId.isUnique).toBe(true);
});
```

- [ ] **Step 2: Run — falha**

Run: `pnpm --filter @farol/db vitest run`
Expected: FAIL — `tasteProfiles` não existe.

- [ ] **Step 3: Implementar o schema**

```ts
// packages/db/src/schema.ts  (append)
import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const tasteProfiles = pgTable("taste_profiles", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  interests: jsonb("interests").$type<string[]>().notNull().default([]),
  pace: text("pace").notNull(),               // relaxado | moderado | intenso
  partyType: text("party_type").notNull(),    // sozinho | casal | familia | amigos
  budgetBand: text("budget_band").notNull(),  // economico | medio | conforto | luxo
  constraints: jsonb("constraints").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
```

Re-export em `src/index.ts`: `export { users, tasteProfiles } from "./schema";`

- [ ] **Step 4: Gerar migration + rodar testes**

Run: `pnpm --filter @farol/db db:generate && docker compose up -d db && pnpm --filter @farol/db db:migrate && pnpm --filter @farol/db test`
Expected: migration `0001_*.sql` criada e revisada; testes verdes, cobertura 100%.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): tabela taste_profiles + migration 0001"
```

---

### Task 2: `packages/shared` — DTOs de perfil e tipo `CurrentUser`

**Files:**
- Create: `packages/shared/src/taste-profile.ts`, `packages/shared/src/auth.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/taste-profile.spec.ts`

**Interfaces:**
- Produces:
  - `tasteProfileInputSchema` (zod): `interests: string[] (min 3)`, `pace: enum`, `partyType: enum`, `budgetBand: enum`, `constraints: { mobility?: boolean; kids?: boolean; pet?: boolean; dietary?: string[] }`
  - `type TasteProfileInput = z.infer<...>`
  - `tasteProfileSchema` = input + `{ id: string; userId: string; updatedAt: string }`
  - `type CurrentUser = { id: string; email: string }`

- [ ] **Step 1: Teste (falha)**

```ts
// packages/shared/src/taste-profile.spec.ts
import { describe, it, expect } from "vitest";
import { tasteProfileInputSchema } from "./taste-profile";

describe("tasteProfileInputSchema", () => {
  const base = { interests: ["praia", "gastronomia", "sossego"], pace: "moderado",
    partyType: "casal", budgetBand: "medio", constraints: {} };
  it("aceita um perfil válido", () => {
    expect(tasteProfileInputSchema.parse(base).interests).toHaveLength(3);
  });
  it("exige ao menos 3 interesses", () => {
    expect(() => tasteProfileInputSchema.parse({ ...base, interests: ["praia"] })).toThrow();
  });
  it("rejeita pace fora do enum", () => {
    expect(() => tasteProfileInputSchema.parse({ ...base, pace: "devagar" })).toThrow();
  });
  it("constraints é opcional por campo", () => {
    expect(tasteProfileInputSchema.parse({ ...base, constraints: { kids: true } }).constraints.kids).toBe(true);
  });
});
```

- [ ] **Step 2: Run — falha.**  `pnpm --filter @farol/shared vitest run`

- [ ] **Step 3: Implementar**

```ts
// packages/shared/src/taste-profile.ts
import { z } from "zod";
export const paceEnum = z.enum(["relaxado", "moderado", "intenso"]);
export const partyEnum = z.enum(["sozinho", "casal", "familia", "amigos"]);
export const budgetEnum = z.enum(["economico", "medio", "conforto", "luxo"]);
export const tasteProfileInputSchema = z.object({
  interests: z.array(z.string().min(1)).min(3),
  pace: paceEnum,
  partyType: partyEnum,
  budgetBand: budgetEnum,
  constraints: z.object({
    mobility: z.boolean().optional(),
    kids: z.boolean().optional(),
    pet: z.boolean().optional(),
    dietary: z.array(z.string()).optional()
  }).default({})
});
export type TasteProfileInput = z.infer<typeof tasteProfileInputSchema>;
export const tasteProfileSchema = tasteProfileInputSchema.extend({
  id: z.string().uuid(), userId: z.string().uuid(), updatedAt: z.string()
});
export type TasteProfile = z.infer<typeof tasteProfileSchema>;
```

```ts
// packages/shared/src/auth.ts
export type CurrentUser = { id: string; email: string };
```

`index.ts`: `export * from "./taste-profile"; export * from "./auth";`

- [ ] **Step 4: Run — passa (cobertura 100%) + mutação.**
`pnpm --filter @farol/shared test && pnpm --filter @farol/shared test:mutation`

- [ ] **Step 5: Commit** — `feat(shared): DTOs de taste profile e tipo CurrentUser`

---

### Task 3: `apps/api` — `AuthModule` (JWKS + guard + CurrentUser + upsert users)

**Files:**
- Create: `apps/api/src/auth/jwt-verifier.ts`, `apps/api/src/auth/auth.guard.ts`, `apps/api/src/auth/current-user.decorator.ts`, `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/user-upsert.service.ts`
- Modify: `apps/api/src/config/env.schema.ts` (add `SUPABASE_JWKS_URL`), `apps/api/src/app.module.ts`
- Test: `apps/api/src/auth/jwt-verifier.spec.ts`, `apps/api/src/auth/auth.guard.spec.ts`, `apps/api/test/auth.e2e-spec.ts`
- Test util: `apps/api/test/support/test-jwt.ts` (gera par RSA, assina JWT, serve JWKS fake)

**Interfaces:**
- Consumes: `envSchema` (Plano 1) + `SUPABASE_JWKS_URL`; `createDbClient` via token `DB`; `@farol/shared` `CurrentUser`.
- Produces:
  - `JwtVerifier.verify(token: string): Promise<{ sub: string; email: string }>` — usa `jose.createRemoteJWKSet(url)`, valida assinatura + `exp`; lança `UnauthorizedException` em token inválido/expirado.
  - `AuthGuard` (implements `CanActivate`) — lê `Authorization: Bearer`, chama `JwtVerifier`, chama `UserUpsertService.ensure({ id: sub, email })`, põe `CurrentUser` em `request.currentUser`.
  - `@CurrentUser()` param decorator → `request.currentUser`.
  - `UserUpsertService.ensure(u: CurrentUser): Promise<void>` — `insert ... on conflict (id) do update set email`.

- [ ] **Step 1: Test util + testes que falham**

```ts
// apps/api/test/support/test-jwt.ts
import { generateKeyPair, exportJWK, SignJWT, type JWK } from "jose";
import { createServer, type Server } from "node:http";

export async function startFakeJwks(): Promise<{
  jwksUrl: string; sign: (claims: Record<string, unknown>) => Promise<string>; stop: () => Promise<void>;
}> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" } as JWK;
  const server: Server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  return {
    jwksUrl: `http://localhost:${port}/`,
    sign: (claims) =>
      new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setExpirationTime("5m").setIssuedAt().sign(privateKey),
    stop: () => new Promise<void>((r) => server.close(() => r()))
  };
}
```

```ts
// apps/api/src/auth/jwt-verifier.spec.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startFakeJwks } from "../../test/support/test-jwt";
import { JwtVerifier } from "./jwt-verifier";

let jwks: Awaited<ReturnType<typeof startFakeJwks>>;
beforeAll(async () => { jwks = await startFakeJwks(); });
afterAll(() => jwks.stop());

describe("JwtVerifier", () => {
  it("aceita token válido e devolve sub/email", async () => {
    const token = await jwks.sign({ sub: "u-1", email: "a@b.com" });
    const v = new JwtVerifier(jwks.jwksUrl);
    await expect(v.verify(token)).resolves.toEqual({ sub: "u-1", email: "a@b.com" });
  });
  it("rejeita token com assinatura inválida", async () => {
    const v = new JwtVerifier(jwks.jwksUrl);
    await expect(v.verify("aaa.bbb.ccc")).rejects.toThrow();
  });
});
```

```ts
// apps/api/test/auth.e2e-spec.ts  (rota protegida de exemplo: GET /me)
// - sem header  -> 401
// - com token do fake JWKS -> 200 e body { id, email }
// - após 1ª chamada, existe 1 linha em users com aquele id
```

- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/api vitest run`

- [ ] **Step 3: Implementar** (`jose` como dep)

```ts
// apps/api/src/auth/jwt-verifier.ts
import { createRemoteJWKSet, jwtVerify } from "jose";
import { UnauthorizedException } from "@nestjs/common";

export class JwtVerifier {
  private readonly jwks;
  constructor(jwksUrl: string) { this.jwks = createRemoteJWKSet(new URL(jwksUrl)); }
  async verify(token: string): Promise<{ sub: string; email: string }> {
    try {
      const { payload } = await jwtVerify(token, this.jwks);
      if (!payload.sub || typeof payload.email !== "string") throw new Error("claims");
      return { sub: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException("token inválido");
    }
  }
}
```

`auth.guard.ts` — extrai Bearer, `verifier.verify`, `userUpsert.ensure`, seta `req.currentUser`; lança `UnauthorizedException` sem header.
`current-user.decorator.ts` — `createParamDecorator((_d, ctx) => ctx.switchToHttp().getRequest().currentUser)`.
`user-upsert.service.ts` — Drizzle `insert(users).values(...).onConflictDoUpdate({ target: users.id, set: { email } })`.
`auth.module.ts` — `@Global()`, providers: `{ provide: JwtVerifier, inject: [ENV], useFactory: (env) => new JwtVerifier(env.SUPABASE_JWKS_URL) }`, `UserUpsertService`, `AuthGuard`; exports os três.
`env.schema.ts` — add `SUPABASE_JWKS_URL: z.string().url()`.
Adicionar um `MeController` (`GET /me` com `@UseGuards(AuthGuard)` retornando `@CurrentUser()`), só para o e2e — ou já colocar em `ProfileModule` na Task 4 e mover o e2e.

- [ ] **Step 4: Run unit + e2e**

Run: `pnpm --filter @farol/db db:migrate && pnpm --filter @farol/api test && pnpm --filter @farol/api test:e2e`
Expected: guard 401/200; upsert cria 1 linha; cobertura 100% (guard, verifier, upsert; `*.module.ts` excluído).

- [ ] **Step 5: Stryker + commit** — `feat(api): AuthModule com verificação JWKS, guard e upsert de users`

---

### Task 4: `apps/api` — `ProfileModule` (GET/PUT /me/profile)

**Files:**
- Create: `apps/api/src/profile/profile.service.ts`, `apps/api/src/profile/profile.controller.ts`, `apps/api/src/profile/profile.module.ts`
- Test: `apps/api/src/profile/profile.service.spec.ts` (integração, Postgres), `apps/api/test/profile.e2e-spec.ts`

**Interfaces:**
- Consumes: token `DB`; `AuthGuard` + `@CurrentUser`; `@farol/shared` `tasteProfileInputSchema`, `TasteProfile`, `NotFoundError`.
- Produces:
  - `ProfileService.get(userId: string): Promise<TasteProfile>` — lança `NotFoundError` se não houver.
  - `ProfileService.upsert(userId: string, input: TasteProfileInput): Promise<TasteProfile>` — insert/update por `userId`, seta `updatedAt = now()`.
  - `GET /me/profile` → 200 `TasteProfile` | 404. `PUT /me/profile` (body validado com zod pipe) → 200 `TasteProfile`.

- [ ] **Step 1: Testes (falham)** — service com Postgres real: `upsert` cria; segundo `upsert` atualiza (mesma linha, `updatedAt` muda); `get` inexistente lança `NotFoundError`. e2e: `PUT` sem auth → 401; `PUT` válido → 200; `GET` depois → 200 com o mesmo payload; `PUT` com `interests` de 2 itens → 400.

- [ ] **Step 2: Run — falha.**

- [ ] **Step 3: Implementar** — `ProfileService` com Drizzle (`onConflictDoUpdate` em `tasteProfiles.userId`); `ProfileController` com `@UseGuards(AuthGuard)` e um `ZodValidationPipe` (criar util simples em `apps/api/src/common/zod.pipe.ts` — com teste próprio de 100%).

- [ ] **Step 4: Run unit/integração + e2e** — cobertura 100%.

- [ ] **Step 5: Stryker + commit** — `feat(api): ProfileModule com GET/PUT /me/profile`

---

### Task 5: `apps/web` — Supabase client, sessão e cliente HTTP com Bearer

**Files:**
- Create: `apps/web/src/lib/supabase.ts`, `apps/web/src/lib/api-client.ts`, `apps/web/src/app/login/page.tsx`, `apps/web/src/components/AuthGate.tsx`
- Modify: `apps/web/src/lib/api.ts` (usar o novo `api-client`)
- Test: `apps/web/src/lib/api-client.spec.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`; `@farol/shared` schemas.
- Produces:
  - `getSupabaseBrowserClient()` — singleton `createBrowserClient`.
  - `apiFetch<T>(path: string, opts: { schema: ZodType<T>; method?; body?; token: string }): Promise<T>` — monta `Authorization: Bearer ${token}`, valida a resposta com `schema`, lança em `!res.ok` ou schema inválido.
  - `/login` — botões "Entrar com Google" e form de e-mail (magic link) via supabase-js.

- [ ] **Step 1: Teste do `api-client` (falha)** — `apiFetch` anexa o Bearer (checar header passado ao fetch fake); valida com schema; lança em 401; lança em body fora do schema.

- [ ] **Step 2–4:** implementar; `apiFetch` puro e testável (recebe `fetchImpl` opcional). `/login` e `supabase.ts` ficam cobertos pelo e2e da Task 6, não pelo Vitest (`coverage.include` = `src/lib/**` só).

- [ ] **Step 5: Commit** — `feat(web): supabase client + apiFetch com Bearer + tela de login`

---

### Task 6: `apps/web` — Onboarding de gosto salvando o perfil (+ e2e)

**Files:**
- Create: `apps/web/src/app/onboarding/page.tsx`, `apps/web/src/components/onboarding/*` (InterestGrid, SegmentedControl, BudgetPills — a partir de `Onboarding.dc.html` e `docs/design-system.md`), `apps/web/e2e/onboarding.spec.ts`
- Test: `apps/web/src/components/onboarding/InterestGrid.spec.tsx` (e demais componentes com lógica)

**Interfaces:**
- Consumes: `apiFetch`, sessão do Supabase (token), `tasteProfileInputSchema`.
- Produces:
  - Fluxo `/onboarding`: seleção de interesses (mín. 3, botão "Continuar" desabilitado antes disso), ritmo, companhia, orçamento → `PUT /me/profile` → redireciona.
  - Componentes reutilizáveis alinhados aos tokens (`--accent`, chips `taste`, etc.).

- [ ] **Step 1: Testes de componente (falham)** — `InterestGrid`: seleção/deseleção, expõe `selected: string[]`, respeita máx.; "Continuar" só habilita com ≥ 3. `SegmentedControl`: valor controlado, um ativo por vez.

- [ ] **Step 2–4:** implementar os componentes (unidade 100%) e a página (coberta pelo e2e). e2e Playwright: mock da sessão Supabase (setar token de teste no storage) + intercept do `PUT /me/profile` retornando 200 → seleciona 3 interesses, ritmo, companhia, orçamento, "Continuar" → assert redirect e chamada feita com o body certo.

- [ ] **Step 5: Rodar tudo** — `pnpm test && pnpm test:e2e` verdes; cobertura 100%; Stryker nos componentes.

- [ ] **Step 6: Commit** — `feat(web): onboarding de gosto persistindo taste profile`

---

## Self-Review

**1. Spec coverage:**
- `taste_profiles` (§5.2) → Task 1. `users` já do Plano 1; upsert em §8 → Task 3.
- Auth JWKS / guard / stateless (§8) → Task 3. `CurrentUser` na camada de serviço para autorização (§5.3) → Task 4 (`ProfileService` usa `currentUser.id`).
- Perfil editável, influência futura (§5.1/§6.4) → Tasks 4 e 6 (persistência + edição); o uso na descoberta é do Plano 3.
- Baseline de testes → unidade (verifier, guard, service, componentes), integração (ProfileService + Postgres), e2e API (auth + profile), e2e web (onboarding), mutação em todos, cobertura 100% por pacote.

**2. Placeholder scan:** `MeController` de exemplo na Task 3 é substituído/movido para `ProfileModule` na Task 4 — anotado explicitamente. Nenhum "TBD" solto.

**3. Type consistency:** `tasteProfileInputSchema` / `TasteProfile` / `CurrentUser` definidos na Task 2, usados nas Tasks 4–6 com o mesmo nome. `JwtVerifier.verify` → `{ sub, email }` consumido pelo `AuthGuard` (Task 3). `apiFetch` (Task 5) usado na Task 6.

## Execução

Cobre o **Passo 2** do backlog. Depende do Passo 1 concluído. Puxar o passo 2 (guideline do `CLAUDE.md`) antes de começar.

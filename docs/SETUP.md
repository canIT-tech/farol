# Setup do ambiente — passo a passo

Para quem vai rodar o Farol na própria máquina e mexer em produção. Feito para o
felippebutland em 2026-09-03; vale para qualquer pessoa nova no time.

**Regra única que organiza tudo: credencial vive no Doppler, e só lá.** Nada de `.env`,
nada de chave em chat, nada de env editada à mão no Render. Local lê do Doppler config
`farol/dev`; produção lê do `farol/prd` espelhado no Render. Quem escreve no Render é o
Claude, a partir do Doppler. Design completo em
`docs/superpowers/specs/2026-09-02-deploy-render-doppler-design.md`.

---

## 0. Pré-requisitos (uma vez)

| Ferramenta | Versão | Como |
|---|---|---|
| Node | ≥ 22.12 (`.nvmrc` = 22) | `nvm install 22 && nvm use` |
| pnpm | 9.14.4 (travado no `packageManager`) | `corepack enable` — o corepack baixa a versão certa sozinho |
| Docker Desktop | qualquer recente | Postgres local roda em container |
| Doppler CLI | ≥ 3.7 | `brew install dopplerhq/cli/doppler` |
| GitHub CLI | qualquer | `brew install gh && gh auth login` — PRs e checks |

Acessos que alguém do time precisa te dar antes do passo 2:
- **Doppler:** convite para o workplace `canit`, projeto `farol`, configs `dev` e `prd`.
  Free tier = 3 pessoas; hoje são Rafael e Felipe.
- **GitHub:** `canIT-tech/farol`.
- **Render** (só para quem faz deploy/diagnóstico): workspace `can it`.
- **Supabase** (só para Auth/URLs): projeto `farol` (`vvmnkqgdtgvdhheoqvjt`).

---

## 1. Clonar

```bash
cd ~/www            # ou onde você guarda os projetos
git clone git@github.com:canIT-tech/farol.git
cd farol
corepack enable
pnpm install --frozen-lockfile
```

---

## 2. Doppler — o cofre

```bash
doppler login                      # abre o browser, OAuth
doppler setup --no-interactive     # lê o doppler.yaml da raiz → farol/dev
doppler configure get project config --plain   # esperado: farol dev
```

A partir daqui **todo comando que precisa de env roda com `doppler run --` na frente.**
Ele injeta as variáveis no processo e mais nada — nenhum arquivo é escrito.

Conferir que você enxerga o config (nomes, nunca valores):

```bash
doppler secrets --only-names
```

Tem que listar, no mínimo: `DATABASE_URL`, `DATABASE_URL_TEST`, `SUPABASE_JWKS_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`,
`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL_CAPABLE`, `LLM_MODEL_CHEAP`,
`GOOGLE_PLACES_KEY`, `TRAVELPAYOUTS_TOKEN`, `TRAVELPAYOUTS_MARKER`, `LITEAPI_KEY`.

O que **não** está lá é porque tem default no código (`apps/api/src/config/env.schema.ts`):
`API_PORT=3333`, TTLs de cache, `RUN_JOB_HANDLERS=false`, `SERVE_WEB=false`, etc.
Invariante: **só entra no Doppler o que algum código lê, e nunca um valor igual ao default.**

---

## 3. Banco local

```bash
docker compose up -d               # postgres:16 em localhost:5432
```

O compose cria dois bancos: `farol` (dev) e `farol_test` (o `client.spec` de `@farol/db`
**dropa o schema `public` inteiro** — por isso os testes de integração apontam para
`DATABASE_URL_TEST`, nunca para o `farol`).

```bash
doppler run -- pnpm --filter @farol/db db:migrate   # migrations 0000..000N
doppler run -- pnpm --filter @farol/db db:seed      # 23 destinos do catálogo
```

Um `NOTICE: schema "drizzle" already exists, skipping` no meio é normal.

Banco sujo (run de teste interrompido, etc.):

```bash
docker compose exec db psql -U postgres -d farol -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE"
doppler run -- pnpm --filter @farol/db db:migrate && doppler run -- pnpm --filter @farol/db db:seed
```

---

## 4. Rodar

```bash
doppler run -- pnpm dev
```

Sobe `apps/api` (:3333, rotas em `/api/*`), `apps/web` (:3000) e `apps/worker` (jobs do
pg-boss). Abrir `http://localhost:3000` → **Entrar** → link mágico no seu e-mail →
`/trips` (Minhas viagens). O primeiro acesso manda para o onboarding.

O que é compartilhado com produção mesmo rodando local:
- **Supabase Auth** é o mesmo projeto. Sua conta é a mesma nos dois. O allowlist de
  redirect inclui `http://localhost:3000/**`, então o link mágico volta para o local.
  Limite do mailer embutido: **2 e-mails/hora** no projeto inteiro — não peça vários links.
- **Chaves de provider** (Groq, Travelpayouts, LiteAPI sandbox, Google Places) são as mesmas.
  Groq free: 30 req/min, 1000/dia. Um roteiro ≈ 23k tokens.
- **Banco não é compartilhado**: local é o docker. Nada que você criar aqui aparece em produção.

---

## 5. Testes

```bash
doppler run -- pnpm test                 # unidade + integração, cobertura 100% por pacote
doppler run -- pnpm test:e2e             # Playwright (apps/web) + e2e da api
pnpm lint && pnpm typecheck && pnpm build
```

Antes do primeiro e2e:

```bash
pnpm --filter @farol/web exec playwright install --with-deps chromium
```

Os pacotes de teste de integração **compartilham um Postgres** e o `turbo.json` serializa
`db → api → worker`. Rodar `pnpm test` inteiro é o jeito seguro; rodar um pacote isolado
também funciona. Mutação (`pnpm test:mutation`) é pesado — roda no nightly do CI, não por PR.

Definition of Done de qualquer passo: cobertura 100% + unidade, integração, e2e e mutação
passando. Ver "Baseline de testes" no `CLAUDE.md`.

---

## 6. Fluxo de trabalho

- Uma branch por pessoa/frente: `git switch -c <seu-user>/<frente>`. Nunca commit direto na
  `main`. Merge só por PR com CI verde.
- Puxar um passo do backlog: dizer ao Claude "puxar o próximo passo N" — ele faz o claim no
  `CLAUDE.md` e cria a branch (guideline "modo gerenciador de tarefas" no `CLAUDE.md`).
- Decisão/descoberta relevante vai para `docs/` no repo, não para vault pessoal.

---

## 7. Credenciais — como adicionar, trocar ou remover

Toda credencial passa pelo mesmo caminho. **Nunca colar valor no chat com o Claude.**

### 7.1 Nova credencial (ex.: chave da Stripe no Passo 11)

1. O código passa a ler a env (`env.schema.ts` + `.env.example` só com o **nome**).
2. Gravar no Doppler, **stdin/prompt, nunca argumento** (argumento vai para o history do shell):
   ```bash
   doppler secrets set STRIPE_SECRET_KEY --project farol --config dev --silent
   doppler secrets set STRIPE_SECRET_KEY --project farol --config prd --silent
   ```
   O CLI abre um prompt; cole o valor ali. `--silent` evita que o CLI imprima a tabela de
   segredos depois (ele faz isso por padrão, com valores truncados).
3. Conferir por presença, não por valor:
   ```bash
   doppler run --config prd -- sh -c 'echo "${STRIPE_SECRET_KEY:+set}"'
   ```
4. **Espelhar no Render**: pedir ao Claude ("espelha STRIPE_SECRET_KEY do Doppler prd no
   Render"). Ele lê do Doppler e escreve pelo MCP do Render; a mudança de env dispara
   deploy automático. Nunca editar a env no dashboard do Render à mão — o invariante é
   **env do Render == Doppler `prd`, chave a chave**.
5. Conferir o deploy **pelo log de boot**, não pelo `/api/health` (o Render mantém a
   instância anterior viva se a nova cair — health 200 pode ser a antiga). A linha que
   importa: `Nest application successfully started`; a que mata: `Env inválida: ...`.

### 7.2 Trocar (rotacionar) uma credencial

Mesmo `doppler secrets set` (dev e/ou prd) + espelho no Render. Revogar a antiga no
provedor **depois** que o deploy novo estiver `live`.

### 7.3 Remover

```bash
doppler secrets delete NOME --project farol --config dev --yes --silent
doppler secrets delete NOME --project farol --config prd --yes --silent
```
E pedir a remoção no Render. (Hoje o MCP do Render só faz merge; remover exige `replace`
com a lista completa — tratar como pendência até lá, ou apagar no dashboard.)

### 7.4 Onde cada credencial nasce

| Credencial | Onde criar | Quem já tem |
|---|---|---|
| `DATABASE_URL` (prd) | Supabase → Connect → **Session pooler** (não o transaction pooler 6543; o pg-boss quebra) | Rafael |
| `SUPABASE_JWKS_URL`, `NEXT_PUBLIC_SUPABASE_*` | derivados do project ref / dashboard | Rafael |
| `LLM_API_KEY` (Groq) | console.groq.com | Rafael |
| `GOOGLE_PLACES_KEY` | Google Cloud Console, Places API (New) + billing | **placeholder em prd — pendente** |
| `TRAVELPAYOUTS_TOKEN` / `_MARKER` | app.travelpayouts.com → perfil → API token; marker no topo | Felipe |
| `LITEAPI_KEY` | liteapi.travel → API Keys → **Sandbox** (`sand_*`) | Felipe |
| `EMAIL_API_KEY` (Resend, só prd) | resend.com → API Keys | Rafael |
| `STRIPE_SECRET_KEY` (`sk_test_…` do sandbox; `sk_live_…` só no lançamento) | dashboard.stripe.com → Developers → API keys (ou uma *restricted key* só com Checkout Sessions) | Rafael |
| `STRIPE_WEBHOOK_SECRET` (`whsec_…`) | prd: Developers → Webhooks → endpoint `https://farol-ekk3.onrender.com/api/payments/webhook`, eventos `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`. dev: o que o `stripe listen` imprime | Rafael |
| `STRIPE_PRICE_SINGLE` / `STRIPE_PRICE_PACK3` | criados pelo Claude via MCP no sandbox (`price_…` dos produtos "Farol · 1 viagem" R$ 39 e "Farol · 3 viagens" R$ 89); não são segredo | ✅ dev e prd |
| `APP_URL` (só prd; dev usa o default) | origem pública do web, monta as urls de retorno do checkout | ✅ prd |
| `SUPABASE_ACCESS_TOKEN` (só prd, uso operacional) | supabase.com/dashboard/account/tokens — deixa o Claude ler/alterar Auth config pela Management API | Rafael |

---

## 7.5 Pagamento em desenvolvimento (Stripe sandbox — sempre)

Sem `PAYMENT_PROVIDER` a aplicação sobe, o 1º roteiro é grátis e o 2º responde 402;
só a compra fica fechada (503). Para testar a compra de ponta a ponta:

1. `PAYMENT_PROVIDER=stripe` + as quatro `STRIPE_*` no Doppler `dev` (chave **de teste**).
2. Webhook local: `stripe listen --forward-to localhost:3333/api/payments/webhook`
   (Stripe CLI, `brew install stripe/stripe-cli/stripe`); o `whsec_…` que ele imprime é
   o `STRIPE_WEBHOOK_SECRET` do `dev`.
3. Cartão de teste `4242 4242 4242 4242`, qualquer validade futura e CVC. Estorno pelo
   painel da Stripe → o webhook `charge.refunded` desconta o crédito.
4. Nos testes automatizados o provider é sempre `fake` (`ci.yml`, `setup-e2e.ts`).

## 8. Produção (Render) — o que você precisa saber

| Item | Valor |
|---|---|
| Serviço | `farol` (`srv-dacanevavr4c73fpn8tg`), free tier, Oregon, auto-deploy da `main` |
| URL | https://farol-ekk3.onrender.com |
| Processo | um só: api Nest serve `/api/*`, o Next em `/*` (`SERVE_WEB=true`) e os handlers do pg-boss (`RUN_JOB_HANDLERS=true`) — o `apps/worker` **não** é deployado (free tier sem background worker) |
| Banco | Supabase `vvmnkqgdtgvdhheoqvjt`, Session pooler. **Migration não roda no build** — é manual, com autorização, quando o schema muda |
| Cold start | free tier dorme após 15 min; primeiro acesso mostra "Application loading" por 30–60 s. Não é bug |

Diagnóstico: o Claude tem MCP do Render (`list_deploys`, `list_logs`) e do Supabase
(`execute_sql`, `query_logs`). Pedir: "deploy X caiu? lê o log de boot".

Migration em produção (com o Rafael ciente, porque o banco é compartilhado):

```bash
doppler run --config prd -- pnpm --filter @farol/db db:migrate
```

---

## 9. Checklist de "está funcionando"

- [ ] `doppler configure get project config --plain` → `farol dev`
- [ ] `docker compose ps` → `farol-db-1 Up`
- [ ] `doppler run -- pnpm --filter @farol/db db:migrate` → `migrations aplicadas`
- [ ] `doppler run -- pnpm dev` → api em :3333, web em :3000
- [ ] `curl localhost:3333/api/health` → `{"status":"ok","checks":{"db":"up"}}`
- [ ] `http://localhost:3000` → Entrar → link mágico → `/trips`
- [ ] `doppler run -- pnpm test` verde

Travou em algum item: abrir o Claude no repo e colar o erro exato — sem colar credencial.

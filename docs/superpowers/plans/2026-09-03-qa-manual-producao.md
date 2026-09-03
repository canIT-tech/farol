# QA manual em produção — o que falta para o dono testar o app como usuário

Objetivo único: Rafael abre `https://farol-ekk3.onrender.com`, entra com a própria conta e
testa feature por feature, na ordem em que um usuário real passaria. **Nenhuma feature
nova.** Só o que está quebrado, ausente ou nunca foi verificado.

Estado em 2026-09-03: **nunca foi possível fazer login e testar uma feature sequer em
produção.** Os motivos estão abaixo, do mais grave para o menos.

---

## Parte A — Bloqueios de deploy (sem isso o app nem sobe no código atual)

Regra que vale para toda a Parte A: **Doppler `farol/prd` é a origem, Render é destino.**
Nunca editar a env do Render à mão; toda mudança nasce no Doppler (CLI, via stdin) e é
espelhada no Render por MCP. O MCP do Doppler está instável — usar a CLI, já
autenticada (`doppler me` → workplace `canit`).

### A1. Deploy do Passo 10 caiu e o Render fez rollback silencioso

**Fato verificado (Render `list_deploys` + `list_logs`, 2026-09-03):**

| Deploy | Commit | Status |
|---|---|---|
| `dep-dacocouq1p3s73ethup0` 14:38 UTC | `ebd4cd8` merge PR #13 (Passo 10) | `update_failed` |
| `dep-dacbrceq1p3s73ehae3g` 00:22 UTC | `965a3a2` claim do Passo 10 (**código pré-Passo 10**) | `live` |

Log de boot do deploy que falhou, duas tentativas, mesma linha:
```
Error: Env inválida: TRAVELPAYOUTS_TOKEN, TRAVELPAYOUTS_MARKER, LITEAPI_KEY
    at parseEnv (/opt/render/project/src/apps/api/dist/config/env.schema.js:91:15)
==> Exited with status 1
==> No open ports detected, continuing to scan...
```

Consequências:
- `GET /api/health` → `{"status":"ok","checks":{"db":"up"}}` **mente**: é a instância
  antiga respondendo. Nenhuma verificação pode usar só o health.
- A produção roda `Amadeus*Provider`, que já estava morto (Self-Service descontinuado).
  Voo e hotel devolvem `error: "unavailable"` hoje, e vão continuar até A5.
- Qualquer push novo na `main` vai falhar do mesmo jeito até A2+A3 entrarem.

**Por que aconteceu:** `env.schema.ts:32-41` tornou as três envs obrigatórias
(`z.string().min(1)`, sem default, sem `.optional()`), mas a spec de migração delegou a
criação das contas ("(felippe) criar conta Travelpayouts") e ninguém fechou o ciclo até o
Doppler. O CI passa porque usa fixtures gravadas e `TRAVELPAYOUTS_TOKEN=test` no `env:` do
workflow — o gap só aparece no boot real.

**Fix:** A2 → A3 → A4 → A5, nessa ordem. Nada de código.

### A2. Credenciais do Travelpayouts — não existem em nenhum cofre

**Estado:** `doppler secrets --project farol --config prd --only-names` não lista
`TRAVELPAYOUTS_TOKEN` nem `TRAVELPAYOUTS_MARKER`. Render também não (espelho do Doppler).

**O que o código lê** (`apps/api/src/config/env.schema.ts`):

| Env | Obrigatória | Default | Uso |
|---|---|---|---|
| `TRAVELPAYOUTS_TOKEN` | sim | — | header `X-Access-Token` em toda chamada à Data API |
| `TRAVELPAYOUTS_MARKER` | sim | — | `marker=` em todo deep-link (Aviasales) — é o que gera comissão |
| `TRAVELPAYOUTS_BASE_URL` | não | `https://api.travelpayouts.com` | não entra no Doppler (igual ao default) |
| `TRAVELPAYOUTS_CURRENCY` | não | `brl` | idem |
| `GEO_DUMP_TTL_SECONDS` | não | `86400` | idem |

**Ação humana (Rafael ou Felipe) — onde achar no painel do Travelpayouts:**
1. Entrar em `app.travelpayouts.com` (criar conta se não houver; é gratuito, sem cartão).
2. **Token:** menu do perfil (canto superior direito) → *API token*. String longa, hex.
3. **Marker:** aparece no topo do painel / em *Programs → Aviasales* como "your marker"
   — número inteiro (ex. `123456`). Um por conta.
4. A conta precisa estar **inscrita no programa Aviasales** (Programs → Aviasales →
   Join) para o marker gerar comissão. Sem isso o deep-link funciona mas não rende.

**Ação Claude — gravar no Doppler (stdin, nunca argumento):**
```bash
# o valor é digitado no prompt da CLI, não passa pelo chat nem pelo history
doppler secrets set TRAVELPAYOUTS_TOKEN --project farol --config prd
doppler secrets set TRAVELPAYOUTS_MARKER --project farol --config prd
```
Alternativa, se o Rafael preferir digitar ele mesmo: rodar os dois comandos acima no
terminal, colar o valor no prompt, e avisar o Claude "pronto". O Claude só confere
`--only-names`.

**Verificação (sem imprimir valor):**
```bash
doppler run --project farol --config prd -- sh -c \
  'echo "token: ${TRAVELPAYOUTS_TOKEN:+set} marker: ${TRAVELPAYOUTS_MARKER:+set}"'
```
Esperado: `token: set marker: set`.

**Smoke opcional contra a API real** (o repo já tem
`packages/providers/scripts/smoke-travelpayouts.mjs`):
```bash
doppler run --project farol --config prd -- node packages/providers/scripts/smoke-travelpayouts.mjs
```

### A3. Credencial do LiteAPI (hotel) — idem

**Estado:** `LITEAPI_KEY` ausente do Doppler `prd`.

**O que o código lê:**

| Env | Obrigatória | Default |
|---|---|---|
| `LITEAPI_KEY` | sim | — (header `X-API-Key`) |
| `LITEAPI_BASE_URL` | não | `https://api.liteapi.travel/v3.0` |
| `LITEAPI_CURRENCY` | não | `BRL` |
| `LITEAPI_GUEST_NATIONALITY` | não | `BR` |

**Ação humana — LiteAPI (Nuitée):**
1. Criar conta em `liteapi.travel` → dashboard.
2. *API Keys* → copiar a chave de **Sandbox** (prefixo `sand_`). Self-serve, sem cartão,
   sem contrato. Devolve conteúdo real (nome, estrelas, nota, foto, endereço, geo) com
   **tarifa de teste** — suficiente para o QA ver a aba de hotéis funcionando.
3. **Não** usar a chave de produção agora: exige cartão cadastrado e transforma o Farol
   em canal de reserva (decisão comercial em aberto —
   `docs/negocio/2026-09-03-opcoes-provider-hotel.md`).
4. Limite do sandbox: 5 req/s. O `http.ts` já trata 429 com retry.

**Ação Claude:**
```bash
doppler secrets set LITEAPI_KEY --project farol --config prd
```
Verificação: `${LITEAPI_KEY:+set}` como em A2.

### A4. Doppler `prd` está com lixo do Amadeus

**Estado:** `AMADEUS_CLIENT_ID` e `AMADEUS_CLIENT_SECRET` seguem no `farol/prd`. Nenhum
arquivo em `apps/api/src/config/env.schema.ts` os lê desde o PR #13. Viola o invariante
"só entra no Doppler o que algum código lê; env do Render == Doppler prd, chave a chave".

**Ação Claude (ordem importa — Doppler primeiro, Render depois):**
```bash
doppler secrets delete AMADEUS_CLIENT_ID AMADEUS_CLIENT_SECRET \
  --project farol --config prd --yes
```
Depois, no Render (`update_environment_variables` no `srv-dacanevavr4c73fpn8tg`): remover
as duas chaves. O tool faz merge por padrão — remover exige passar a lista completa ou usar
o modo de replace; conferir a assinatura antes de chamar para não apagar o resto.

**Verificação:** `doppler secrets --only-names` sem `AMADEUS_*`; `get_service` do Render
mostrando o mesmo conjunto de nomes que o Doppler.

### A5. Espelhar no Render, redeploy, verificação que não mente

Pré-condição: A2, A3, A4 concluídos no Doppler.

1. **Espelhar** — ler cada valor do Doppler e escrever no Render por MCP, sem passar pelo
   chat:
   ```bash
   # o Claude lê com `doppler secrets get NAME --plain` DENTRO da chamada de tool,
   # nunca em um Bash cuja saída volte para o contexto
   ```
   Chaves a adicionar no Render: `TRAVELPAYOUTS_TOKEN`, `TRAVELPAYOUTS_MARKER`,
   `LITEAPI_KEY`. Chaves a remover: `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`.
   Mudar env no Render dispara deploy automático — não precisa `trigger_deploy` separado.

2. **Acompanhar o deploy** — `list_deploys` até o mais novo sair de `build_in_progress`
   / `update_in_progress`. Resultado aceitável: `live`. `update_failed` = voltar ao log.

3. **Ler o log de boot da instância nova** (`list_logs`, `type: app`, janela do deploy).
   O que precisa aparecer, nesta ordem:
   ```
   ==> Running 'node apps/api/dist/main.js'
   [Nest] ... LOG [NestApplication] Nest application successfully started
   ==> Your service is live 🎉
   ```
   O que **não** pode aparecer: `Env inválida`, `Exited with status 1`,
   `No open ports detected`.

4. **Confirmar que a instância que responde é a nova** — não confiar no 200:
   ```bash
   curl -s https://farol-ekk3.onrender.com/api/health
   ```
   Cruzar com `list_logs` filtrando `path: /api/health` e ver o `instance` do request
   log: tem que ser o id da instância do deploy novo, não `srv-...-` da antiga.

5. **Landing** — `curl -s https://farol-ekk3.onrender.com/ | grep -c waitlist` > 0, e no
   browser o contador da waitlist carrega (vem de `GET /api/waitlist/count` na mesma
   origem).

6. **Primeiro sinal de que voo/hotel estão vivos** (ainda sem login): não há rota
   pública. Fica para D11/D13. Mas o log de boot não pode ter `flight_provider_failed`
   nem `hotel_search_failed` antes de qualquer request.

**Só depois disso** a Parte B faz sentido — sem A5, o login funciona mas o app por trás
continua o antigo.

---

## Parte B — Login (o que impede o Rafael de entrar)

Fatos verificados em 2026-09-03 contra o projeto Supabase `vvmnkqgdtgvdhheoqvjt`
(`GET /auth/v1/settings` com a anon key, que é pública por design):

```json
{ "external": { "email": true }, "disable_signup": false, "mailer_autoconfirm": false }
```

E o JWKS (`/auth/v1/.well-known/jwks.json`) publica **uma chave ES256** (`kid
038da72f-…`). Isso importa: o `JwtVerifier` da api (`apps/api/src/auth/jwt-verifier.ts`)
valida por JWKS com `jose`, o que só funciona com chave assimétrica. Projeto criado em
2026-08-31 já nasce com ES256 — **a validação do token na api deve funcionar** sem mexer
em nada. (Se fosse projeto antigo em HS256, o JWKS viria vazio e todo request autenticado
daria `401 token inválido`.)

### B1. Botão "Entrar com Google" não funciona — provider desligado

- `external` só tem `email`. Google OAuth **não está habilitado** no Supabase. O botão
  chama `signInWithOAuth({ provider: "google" })`, que devolve erro do Supabase
  (`Unsupported provider: provider is not enabled`), exibido no `<p role="alert">` da
  tela. Não é bug nosso.
- **Decisão para o QA: não habilitar agora.** Habilitar = criar projeto no Google Cloud,
  OAuth consent screen, client ID/secret, redirect URI `https://<ref>.supabase.co/auth/v1/callback`,
  colar no dashboard do Supabase. É feature nova, fora do escopo deste plano.
- **Débito registrado:** ou habilitar depois, ou esconder o botão enquanto o provider
  estiver desligado (mudança de 1 linha na `login/page.tsx`, também fora deste plano).
- **No QA:** Rafael ignora o botão. Se clicar, o erro esperado é o acima.

### B2. Link mágico — único caminho de login, nunca testado de verdade

**Como funciona hoje, ponta a ponta (lido do código):**

1. `login/page.tsx` → `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo:
   \`${window.location.origin}/onboarding\` } })`. Em produção `origin` =
   `https://farol-ekk3.onrender.com`.
2. Supabase manda e-mail pelo **serviço embutido dele** (não é o nosso Resend). Vai para
   qualquer destinatário. Rate limit do free tier: **~3–4 e-mails/hora por projeto** —
   não pedir vários links seguidos; se não chegar, esperar, não reenviar.
3. Usuário clica. O link aponta para `https://vvmnkqgdtgvdhheoqvjt.supabase.co/auth/v1/verify?token=…&type=magiclink&redirect_to=https://farol-ekk3.onrender.com/onboarding`.
4. Supabase valida e redireciona para o `redirect_to` **se ele estiver na allowlist**
   (ver B3). Como o cliente é criado com o padrão da lib (`flowType: pkce`), a URL de volta
   traz `?code=…`.
5. `lib/supabase.ts` cria o client com `detectSessionInUrl: true` → a lib troca o `code`
   por sessão **usando o `code_verifier` que ela guardou no `localStorage` do browser que
   pediu o link**. Sessão vai para `localStorage` na chave `sb-vvmnkqgdtgvdhheoqvjt-auth-token`.
6. `AuthGate` (`components/AuthGate.tsx`) faz `getSession()`; com token, renderiza o
   onboarding e passa o `access_token` para o `apiFetch`.
7. Primeira chamada autenticada à api (`GET /me` ou `PUT /profile`) → `AuthGuard` valida o
   JWT no JWKS → `UserUpsertService.ensure({ id: sub, email })` cria a linha em `users`.

**Armadilha do PKCE (passo 5) — a mais provável de morder no QA:** o link **tem que ser
aberto no mesmo browser (mesmo perfil) que pediu o link.** Abrir o e-mail no celular e
clicar, ou abrir em outro browser, ou em janela anônima → não existe `code_verifier` →
erro `invalid request: both auth code and code verifier should be non-empty` e a tela
fica em `/login` sem sessão. Não é bug; é o fluxo PKCE. Instrução para o Rafael:
**pedir o link no Chrome do Mac, abrir o Gmail no mesmo Chrome, clicar lá.**

**Por que "nunca testado":** `apps/web/e2e/fixtures/test-session.ts` gera um JWT com
assinatura literal `"sig"` e o injeta em `localStorage["sb-localhost-auth-token"]`. O E2E
nunca chama o Supabase. O Passo 8 ficou ✅ sem um login real. Os passos 2–5 e 7 acima
não têm nenhuma evidência de funcionar.

**Verificação (feita pelo Rafael, guiada):**
1. Chrome → `https://farol-ekk3.onrender.com/login`.
2. Digitar `rafa.ignaulin@gmail.com` → "Enviar link mágico". Tela mostra "Link enviado".
3. Gmail **no mesmo Chrome**. E-mail do remetente `noreply@mail.app.supabase.io`. Clicar
   no link.
4. Esperado: cai em `https://farol-ekk3.onrender.com/onboarding` **logado** (tela do
   onboarding, não redirect para `/login`).
5. Se cair em `localhost:3000/...` → B3 não foi feito. Se cair em `/login` com erro de
   code verifier → clicou em outro browser (armadilha acima). Se cair em `/onboarding` e a
   primeira ação der 401 → B4.

**Como o Claude confirma pelo lado da api** (sem pedir token ao Rafael): `list_logs` do
Render filtrando `path: /api/me` ou `/api/profile` na janela do teste — status 200 = JWT
validou no JWKS e `users` foi upsertado.

### B3. Site URL e Redirect URLs do Supabase Auth — provavelmente apontando errado

**Por que é bloqueio:** o Supabase só redireciona o link mágico para URLs da allowlist
(Authentication → URL Configuration → *Redirect URLs*). Fora da lista, ele cai no *Site
URL*. Se Site URL e Redirect URLs só tiverem `localhost:3000` (padrão de projeto novo),
o link volta para localhost — no Mac do Rafael até pode abrir o `pnpm dev` local se
estiver rodando, e o QA "passa" contra o app errado.

**Não há tool de MCP para isso.** O Supabase MCP conectado não expõe auth config; o
GoTrue não tem endpoint público de leitura da allowlist. É dashboard.

**Ação humana (Rafael, dashboard do Supabase → projeto `farol` → Authentication → URL
Configuration):**

| Campo | Valor |
|---|---|
| Site URL | `https://farol-ekk3.onrender.com` |
| Redirect URLs (adicionar, manter as existentes) | `https://farol-ekk3.onrender.com/**` |
| Manter para dev | `http://localhost:3000/**` |

O `/**` é o wildcard do Supabase para "qualquer caminho" — cobre `/onboarding` e qualquer
outro `emailRedirectTo` futuro.

**Verificação:** não dá para ler a allowlist por API. A prova é o B2 passo 4 cair no
domínio certo. Antes disso, o Rafael pode tirar screenshot da tela de URL Configuration e
o Claude confere os valores.

### B4. Primeiro login cria a linha em `users`?

- `AuthGuard.canActivate` chama `UserUpsertService.ensure({ id: sub, email })` em **toda**
  request autenticada. Idempotente. Não precisa de ação — mas precisa de verificação,
  porque é o primeiro usuário real do banco de produção.
- **Verificação (Claude, após B2 passar):**
  ```sql
  select id, email, created_at from users where email = 'rafa.ignaulin@gmail.com';
  ```
  via `execute_sql` do Supabase MCP (leitura). Esperado: 1 linha, `id` igual ao `sub` do
  JWT do Supabase (uuid do usuário em Authentication → Users).
- Se a linha não existir mas o onboarding carregou: o `AuthGate` passou (sessão no
  browser) mas nenhuma chamada à api aconteceu ainda — normal até o primeiro `PUT /profile`.
- Se der 401 na primeira chamada: JWKS. Checar no log do Render `token inválido` e
  comparar o `kid` do JWT (decodificar o header, só o header) com o do JWKS.

### B5. Ordem de execução das Partes A e B

```
A2 humano ─┐
A3 humano ─┼─► A4 Claude ─► A5 Claude (espelho + deploy + log) ─┐
B3 humano ─┘                                                     ├─► B2 Rafael (login real) ─► B4 Claude (users)
                                                                 ┘
```

A2/A3/B3 são independentes entre si e todas humanas — fazer as três de uma vez. A4/A5
só depois de A2+A3. B2 só depois de A5 (senão o login funciona contra o app antigo) e
de B3.

### Progresso (2026-09-03)

| Item | Status | Nota |
|---|---|---|
| A2 Travelpayouts | ✅ | Felipe gravou `TRAVELPAYOUTS_TOKEN` + `TRAVELPAYOUTS_MARKER` no Doppler `prd` |
| A3 LiteAPI | ✅ | Felipe gravou `LITEAPI_KEY` (sandbox) no Doppler `prd` |
| A4 limpar Amadeus | ✅ Doppler · ⚠️ Render | Removido do Doppler. **Ainda no Render:** o MCP só faz merge, remover exige `replace: true` com a lista completa (todos os valores passariam pelo chat). Pendente: apagar as duas chaves no dashboard do Render, ou aceitar o desvio até o próximo `replace` |
| A5 espelho + deploy | 🟡 | 3 envs escritas no Render às 16:25 UTC → deploy `dep-dacpunrl550s73d7o2r0` disparado sobre o commit `ebd4cd8` (PR #13). Aguardando boot |
| B3 URLs Supabase | ⏳ Rafael | — |
| B2 login real | ⏳ | depende de A5 + B3 |

Lições operacionais desta rodada:
- `doppler secrets delete` **imprime a tabela dos segredos restantes** (valores
  truncados) — sempre `--silent`. Idem para `set`.
- O classificador do Claude Code bloqueia `doppler secrets get` por padrão. Liberado
  nesta máquina via `.claude/settings.local.json` (`Bash(doppler secrets get:*)`,
  gitignored). Decisão do Rafael: preferir isso a criar um cofre paralelo para uma
  API key do Render — **uma fonte de verdade**, mesmo que o valor passe pelo contexto
  do Claude na hora do espelho.

---

## Parte C — Features que vão degradar mesmo com o app de pé

Não bloqueiam login, mas o Rafael vai "ver quebrado" e precisa saber o que é esperado.

### C1. `GOOGLE_PLACES_KEY=placeholder` — POI/restaurantes do roteiro sem enriquecimento

- Confirmado no Doppler `prd`: valor literal `placeholder` (11 chars).
- Efeito: todo item do roteiro sai com `placeId/lat/lng/rating = null` e
  `needsReview = true`; o job `places.enrich` reprocessa e falha de novo; `swap_restaurant`
  no chat não acha nada. Roteiro "funciona" mas fica sem mapa, nota, endereço real.
- **Ação (humana):** chave real do Google Places (Google Cloud Console, Places API (New)
  habilitada, billing ligado — tem free tier). → Doppler → Render.
- **Sem a chave:** aceitar como degradação conhecida durante o QA, marcar no checklist.

### C2. LLM via Groq — deve funcionar, mas com teto

- `LLM_PROVIDER=groq` confirmado no Doppler. Descoberta, roteiro e chat dependem dele.
- Free tier Groq: 30 RPM / 1000 RPD / 8000 TPM. Um roteiro consome ~23k tokens → cabe,
  mas um QA intenso pode bater em 429 no meio da tarde. Se bater: `llm_not_configured`
  não, é 503 do provider — reconhecer e esperar, não caçar bug.

### C3. Voo/hotel são cache do parceiro, não busca ao vivo

- Travelpayouts Data API devolve preço agregado ("custou X no dia Y"), não oferta
  reservável. UI já diz "preço aproximado". LiteAPI sandbox devolve tarifa de teste.
- **Esperado no QA:** rota sem cobertura (origem pequena, destino raro) volta seção vazia
  com `error: "unavailable"` — é comportamento correto, não bug. Testar com GRU→LIS,
  GRU→MIA, que têm dado.

### C4. Render free dorme após 15 min

- Primeiro acesso do dia: cold start >30 s, a landing demora, o consumidor de fila
  (`RUN_JOB_HANDLERS=true` no mesmo processo) estava parado. Gerar roteiro logo após
  acordar pode levar mais que o normal. Não é bug.

### C5. Clima e tempo de voo — sempre vazios

- `climate.expectedC = null`, `flightTimeHours = null`. Sem fonte no MVP, já documentado
  em CLAUDE.md. Cards de destino não mostram. Esperado.

---

## Parte D — Roteiro de QA (ordem de um usuário real)

Marcar ✅ / ❌ / ⚠️ (funciona com degradação conhecida) em cada linha. Anotar o que viu.

| # | Tela / ação | Esperado | Depende de |
|---|---|---|---|
| D1 | `/` landing — contador da waitlist carrega | número vindo da API, sem erro no console | A5 |
| D2 | `/` cadastrar e-mail na waitlist | "cadastrado" + e-mail de boas-vindas chega (só para o dono da conta Resend, domínio não verificado) | já ✅ (2026-09-03) |
| D3 | `/login` → "Enviar link mágico" com o próprio e-mail | "Link enviado", e-mail do Supabase chega | B2 |
| D4 | Clicar no link do e-mail | cai em `/onboarding` **no domínio do Render**, logado | B3 |
| D5 | `/onboarding` preencher gosto (interesses, ritmo, tipo de grupo, orçamento) | salva, avança | B4 |
| D6 | `/trips/new` criar viagem (origem, datas/mês, pessoas, orçamento) | trip criada, redireciona para descoberta | — |
| D7 | `/trips/:id/discovery` — descoberta roda | 3+ destinos ranqueados com score, justificativa, preço estimado (real do Travelpayouts quando a rota tem dado) e escalas | A2, C2 |
| D8 | Escolher um destino | `chosen`, avança para roteiro | — |
| D9 | `/trips/:id/itinerary` — gerar roteiro | status `pending` → polling → roteiro dia a dia | C2, C4 |
| D10 | Itens do roteiro têm lugar/nota/endereço | ⚠️ esperado vazio até C1 | C1 |
| D11 | `/trips/:id/booking` — aba Voos | ofertas + aeroportos vizinhos + contexto de preço (quando ir, melhor dia, faixa recente) | A2 |
| D12 | Clicar numa oferta de voo | abre Aviasales com `marker=` nosso na URL | A2 |
| D13 | Aba Hotéis | lista com nome/estrelas/nota/foto/preço (tarifa de teste do sandbox) | A3 |
| D14 | Selecionar voo e hotel | `flight_selections` / `hotel_selections` gravados, sidebar reflete | — |
| D15 | Chat do assessor — "troca o restaurante do dia 2" | tool `swap_restaurant` roda; ⚠️ sem C1 não acha alternativa | C1, C2 |
| D16 | Chat — "muda para 5 dias" / "orçamento menor" | trip atualizada, roteiro regenerado | C2 |
| D17 | `/auto` fluxo autônomo (datas + origem + orçamento + 3 gostos) | um plano fechado, sem seletor de destino | A2, C2 |
| D18 | Logout / relogin | sessão persiste entre reloads; logout limpa | B2 |

---

## Ordem de execução

1. **Humano:** A2 (Travelpayouts) + A3 (LiteAPI) + B3 (URLs do Supabase). Opcional agora: C1 (Google Places).
2. **Claude:** A4 (limpar Amadeus) → gravar A2/A3 no Doppler via stdin → espelhar no Render → A5 (deploy + ler log).
3. **Rafael:** Parte D, de cima para baixo. Cada ❌ vira um item novo neste arquivo com o que apareceu na tela e no log do Render.
4. Só depois de D verde (ou com ⚠️ aceitos): Passo 11.

## Fora de escopo — de propósito

- Habilitar Google OAuth (B1). Feature nova.
- Domínio próprio, e-mail transacional em domínio verificado.
- Passo 11 (pagamento).
- Qualquer melhoria de UI vista durante o QA — anotar, não implementar.

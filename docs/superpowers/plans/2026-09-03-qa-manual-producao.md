# QA manual em produção — o que falta para o dono testar o app como usuário

Objetivo único: Rafael abre `https://farol-ekk3.onrender.com`, entra com a própria conta e
testa feature por feature, na ordem em que um usuário real passaria. **Nenhuma feature
nova.** Só o que está quebrado, ausente ou nunca foi verificado.

Estado em 2026-09-03: **nunca foi possível fazer login e testar uma feature sequer em
produção.** Os motivos estão abaixo, do mais grave para o menos.

---

## Parte A — Bloqueios de deploy (sem isso o app nem sobe no código atual)

### A1. Deploy do Passo 10 caiu e o Render fez rollback silencioso

- O merge do PR #13 (Travelpayouts + LiteAPI) disparou deploy às 14:38 UTC. Falhou:
  ```
  Error: Env inválida: TRAVELPAYOUTS_TOKEN, TRAVELPAYOUTS_MARKER, LITEAPI_KEY
  ```
- O Render manteve a instância anterior viva (`965a3a2`, de 2026-09-03 00:22 — **anterior
  ao Passo 10**). `/api/health` responde 200, o que engana: a produção está rodando código
  Amadeus, que já estava morto (Self-Service descontinuado). Voo e hotel nunca funcionaram
  em produção, nem antes nem depois.
- **Fix:** A2 + A3 + A4 → redeploy manual → confirmar boot pelo log, não pelo health.

### A2. Credenciais do Travelpayouts — não existem em nenhum cofre

- `TRAVELPAYOUTS_TOKEN` e `TRAVELPAYOUTS_MARKER` são **obrigatórias** no `env.schema.ts`
  (`z.string().min(1)`, sem default). Não estão no Doppler `farol/prd` nem no Render.
- Spec de migração já dizia: "(felippe) criar conta Travelpayouts → token + marker". Não
  entrou no cofre.
- **Ação (humana):** criar/recuperar conta em travelpayouts.com → Token da conta (header
  `X-Access-Token`) e Marker de afiliado. Entregar ao Claude por `doppler secrets set`
  via stdin — nunca colado no chat.
- **Depende de:** Rafael ou Felipe.

### A3. Credencial do LiteAPI (hotel) — idem

- `LITEAPI_KEY` obrigatória, ausente. Chave de **sandbox** (`sand_*`) é self-serve, sem
  cartão, e devolve conteúdo real com tarifa de teste — suficiente para QA.
- **Ação (humana):** criar conta em liteapi.travel → copiar chave sandbox → Doppler.
- **Depende de:** Rafael ou Felipe.

### A4. Doppler `prd` está com lixo do Amadeus

- `AMADEUS_CLIENT_ID` e `AMADEUS_CLIENT_SECRET` seguem no `farol/prd`. O código não lê
  mais. Invariante do projeto: "só entra no Doppler o que algum código lê".
- **Fix (Claude, CLI):** `doppler secrets delete AMADEUS_CLIENT_ID AMADEUS_CLIENT_SECRET
  --project farol --config prd`, e espelhar a remoção no Render.

### A5. Redeploy + verificação real

Depois de A2–A4 no Doppler e espelhados no Render:
1. `trigger_deploy` no Render (ou push vazio).
2. **Ler o log de boot** — a linha que importa é a ausência de `Env inválida` e a
   presença de `Nest application successfully started`. Health 200 não prova nada (A1).
3. `GET /api/health` com `checks.db: up`.
4. `GET /` renderiza a landing com contador da waitlist vindo da API.

---

## Parte B — Login (o que impede o Rafael de entrar)

### B1. Botão "Entrar com Google" não funciona — provider desligado

- Settings públicos do Supabase Auth do projeto `vvmnkqgdtgvdhheoqvjt` (lidos com a anon
  key): `external: { email: true }` e **nada mais**. Google OAuth não está habilitado.
- Clicar no botão devolve erro do Supabase. Não é bug do nosso código.
- **Decisão:** para o QA, **não habilitar Google agora** (exige criar OAuth client no
  Google Cloud, consent screen, redirect URI — trabalho novo). Usar só o link mágico.
  Registrar como débito: ou habilitar depois, ou esconder o botão até então.

### B2. Link mágico — único caminho de login, nunca testado de verdade

- `signInWithOtp` está no código. Signup aberto (`disable_signup: false`), confirmação
  por e-mail exigida (`mailer_autoconfirm: false`). O e-mail sai do serviço embutido do
  Supabase (não do nosso Resend) — funciona para qualquer destinatário, mas com rate
  limit baixo (algumas mensagens por hora). Suficiente para um testador.
- **Nunca verificado ponta a ponta.** O E2E do Playwright (`e2e/fixtures/test-session.ts`)
  injeta um JWT falso direto no `localStorage` e **pula o Supabase Auth inteiro**. Passo 8
  ficou "✅" sem ninguém ter logado de verdade.
- **Verificar:** enviar link mágico para `rafa.ignaulin@gmail.com`, clicar, cair em
  `/onboarding` autenticado.

### B3. Site URL e Redirect URLs do Supabase Auth — provavelmente apontando errado

- O link mágico redireciona para `emailRedirectTo: ${window.location.origin}/onboarding`.
  O Supabase **só honra** redirects que estejam na allowlist (Authentication → URL
  Configuration). Se a lista só tiver `localhost:3000`, o link volta para localhost e o
  login "parece quebrado sem erro" — o deploy spec já alertava (verificação #4), nunca
  foi confirmado.
- Não há tool de MCP para ler/escrever isso; é no dashboard.
- **Ação (humana, dashboard):** Site URL = `https://farol-ekk3.onrender.com`; Redirect
  URLs incluir `https://farol-ekk3.onrender.com/**` (manter `http://localhost:3000/**`
  para dev).

### B4. Primeiro login cria o `users` row?

- `AuthModule` faz upsert em `users` a partir do JWT. Verificar após B2 que a linha
  existe (`select id, email from users`) — sem ela, `/me` e o onboarding falham.

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

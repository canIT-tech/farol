# Farol — contexto do projeto

Assessor de viagem que leva a pessoa do "não sei para onde ir" a um roteiro pronto:
descobre o destino pelo gosto, acha a melhor forma de chegar (dinheiro ou milhas),
monta o dia a dia e ajusta tudo por conversa.

- **Nome:** Farol — marca pública **Farol Viagens**, domínio **`farolviagens.com`** (definido 2026-08-31; falta registrar)
- **Codinome antigo:** trip
- **Repo:** `git@github.com:canIT-tech/farol.git`
- **Status:** fase de definição — PRD, design técnico e identidade prontos. Sem código de app ainda.

---

## Onde está cada coisa

| Documento | Caminho |
|---|---|
| PRD (visão, escopo faseado, personas, monetização) | `PRD.md` |
| Design técnico do MVP (arquitetura, módulos, dados) | `docs/superpowers/specs/2026-08-27-mvp-trip-design.md` |
| Opções de provider de hotel (sem virar canal de reserva) | `docs/negocio/2026-09-03-opcoes-provider-hotel.md` |
| Curadoria do catálogo de destinos (como levantar candidatos) | `docs/negocio/2026-09-03-curadoria-do-catalogo.md` |
| Controle de sessão (guard global, CORS, inatividade, o que ficou de fora) | `docs/superpowers/specs/2026-09-04-controle-de-sessao-design.md` |
| Pagamento por viagem — Stripe "modo Levels" (saldo no usuário, 1º roteiro grátis, webhook, telas, legal) | `docs/superpowers/specs/2026-09-15-pagamento-stripe-design.md` · plano `docs/superpowers/plans/2026-09-15-pagamento-stripe.md` |
| Google Flights como fonte primária de voo (scraping, riscos, fallback) | `docs/negocio/2026-09-03-google-flights-como-fonte-de-voo.md` |
| Specs de produto (pagamento, plano grátis, migração de provider, custo de LLM, métricas) | `docs/negocio/2026-08-31-spec-pagamento.md` · `docs/negocio/2026-08-31-spec-plano-gratuito.md` · `docs/negocio/2026-08-31-spec-migracao-travelpayouts.md` · `docs/negocio/2026-08-31-custo-llm-por-roteiro.md` · `docs/negocio/2026-08-31-plano-de-metricas.md` |
| Legal (Termos + Privacidade/LGPD — rascunhos, pré-jurídico) | `docs/legal/` |
| Design system (tokens + specs de componentes) | `docs/design-system.md` |
| Manual de marca (fontes) | `docs/design/brand/*.dc.html` + `docs/design/brand/canvas.json` |
| Telas do app (fontes) | `docs/design/app/*.dc.html` + `docs/design/app/canvas.json` |
| Backoffice / hub da documentação | `docs/index.html` (shell local: sidebar + iframe; aponta para os `.html` de `docs/`. Vai virar backoffice com dados de assinatura) |
| **Setup do ambiente (pessoa nova no time)** — Doppler, banco local, rodar, testar, credenciais dev/prd, Render | `docs/SETUP.md` |

Canvases publicados (Claude Artifacts):
- App / telas hi-fi: https://claude.ai/code/artifact/0086b95c-831f-40d6-8310-a54b0a5974cd
- Manual de marca Farol: https://claude.ai/code/artifact/c677b6a3-2ac6-47c8-aadd-c561eb8bc41b

---

## Decisões já tomadas (não reabrir sem motivo)

**Produto**
- Escopo é produto completo, mas execução **faseada**: MVP (gosto → roteiro) → v1 (milhas + alertas + premium) → v2 (consultoria, grupo, reserva, mobile, B2B) → v3 (gerenciador de viagem: salvar, avaliar, editar ao vivo, notas aos lugares — PRD §4/§5.11).
- Motor de milhas fica no **v1** — é o diferencial, mas tem o maior risco de viabilidade (sem API oficial dos programas BR).
- Monetização: **pagamento por viagem** (R$ 39 avulso / R$ 89 pacote de 3; spec `docs/negocio/2026-08-31-spec-pagamento.md`) + afiliado de voo/hotel via `marker` do Travelpayouts (deep-link) + assinatura premium (v1) + consultoria/B2B (v2).
- **Freemium (2026-09-15): o 1º roteiro da conta é grátis, em qualquer modo** (`users.free_itinerary_used_at`); do 2º em diante, 1 crédito por viagem (`users.credits`). A API não distingue "modo autônomo" — é só o front encadeando as mesmas rotas — então a regra é por conta, não por modo. Regenerar, chat e trocar restaurante numa viagem já destravada (`trips.unlocked_at`) nunca recobram.

**Arquitetura (do design técnico)**
- Monorepo **Turborepo**: `apps/web` (Next.js, só frontend) · `apps/api` (**NestJS**) · `apps/worker` (2º processo NestJS, jobs).
- `packages/`: `db` (Drizzle) · `domain` (lógica pura) · `providers` (Travelpayouts + Google Places) · `shared` (DTOs/zod).
- **Supabase**: Auth + Postgres + Storage. **Drizzle** ORM, migrations versionadas.
- Fila: **pg-boss** no próprio Postgres (sem Redis no MVP).
- Providers reais: **Travelpayouts** (voo via Aviasales — data + deep-link com afiliado) + **LiteAPI/Nuitée** (hotel) + **Google Places** (POI/restaurantes). A Amadeus saiu do projeto: Self-Service descontinuado. O Hotellook também (encerrado em 20/10/2025).
- **LiteAPI — provider de hotel.** `GET /v3.0/data/hotels` (conteúdo: nome, estrelas, nota, avaliações, foto, endereço, geo) + `POST /v3.0/hotels/min-rates` (preço para as datas). Os dois são **gratuitos**; a receita é por margem na reserva. Chave de sandbox é self-serve (`sand_*`); produção só exige cartão cadastrado, sem contrato. **Busca por coordenada, não por nome** — "Lisboa" acha 2 hotéis e "Lisbon" acha 6.748. A coordenada vem do dump `/data/{locale}/cities.json` do Travelpayouts, exposto pelo `TravelpayoutsGeoProvider.city()`, que resolve IATA de cidade direto e IATA de aeroporto pelo `city_code` (GRU → centro de São Paulo, não o terminal). Hotel sem tarifa para as datas sai da lista.
- **Travelpayouts, 9 endpoints em uso** (`packages/providers/src/travelpayouts/`, fixtures gravadas da API real): `/v1/prices/cheap` (tarifa da rota no mês) · `/v1/prices/monthly` ("quando ir") · `/v1/city-directions` (destinos baratos saindo da origem) · `/v2/prices/latest` (faixa de preço recente) · `/v2/prices/month-matrix` (melhor dia do mês) · `/v2/prices/nearest-places-matrix` (aeroportos vizinhos, com link direto da tarifa) · `/whereami` (origem pelo IP, JSONP) · `/data/{locale}/airports.json` e `airlines.json` (dumps, cache de 24 h em memória). Preço é **cache do parceiro, não busca ao vivo** — a UI e o chat dizem "preço aproximado". Busca live (Aviasales Search API) exige 50 k MAU.
- **Google Flights — fonte primária de oferta de voo** (2026-09-03). Lê a página
  pública: a busca vai numa mensagem protobuf em base64 (`tfs`) e a resposta sai
  de um `<script class="ds:1">`. Dá preço e horário **reais**, que o
  Travelpayouts não dá (ele serve cache do parceiro). Sem chave, sem cadastro e
  sem dependência nova — o protobuf é codificado à mão. Roda sempre atrás do
  `FallbackFlightProvider`, que cai no Travelpayouts quando o layout muda; os
  insights e o `marker` de afiliado seguem no Travelpayouts. Deep link da oferta
  do Google aponta para o próprio Google: mandar a pessoa ao afiliado com um
  preço vindo de outra fonte seria vender número que o destino pode não honrar.
  `GOOGLE_FLIGHTS_ENABLED=false` volta ao comportamento anterior. Detalhe e
  riscos em `docs/negocio/2026-09-03-google-flights-como-fonte-de-voo.md`.
- LLM: **Claude**, roteamento de modelo por tarefa.
- `api` stateless; autorização na camada de serviço (RLS desligada nas tabelas de app).
- **Sessão: protegido por padrão** (2026-09-04). `AuthGuard` é `APP_GUARD` global —
  rota nova nasce fechada, e abrir é um `@Public()` explícito. Abertos só
  `health` e `waitlist`. O JWT é verificado com `audience` (`SUPABASE_JWT_AUD`,
  default `authenticated`); `issuer` não, de propósito — o JWKS só tem a chave
  deste projeto, então a checagem não somaria segurança. CORS por
  `CORS_ORIGINS`, zerado em produção (api e web são a mesma origem lá). No web,
  o `AuthGate` assina `onAuthStateChange` em vez de fotografar o token, e
  encerra a sessão após 30 min de inatividade. **Revogação imediata de access
  token ficou fora**: exigiria consulta a lista de revogados em toda rota. Quem
  fecha essa janela é a validade curta do token no Supabase. Detalhe em
  `docs/superpowers/specs/2026-09-04-controle-de-sessao-design.md`.
- **Pagamento: Stripe Checkout hospedado, "modo Levels"** (2026-09-15). Uma conta
  Stripe (da isTech) com o Farol como produto; saldo é `users.credits` — **sem ledger**,
  o histórico fino mora no painel da Stripe. `PaymentsModule`: `POST /payments/checkout`
  (cria `orders` pending + Session), `POST /payments/webhook` (`@Public`, corpo cru via
  `rawBody: true`, idempotente por `webhook_events.id`, cada transição "só se estava no
  estado anterior"), `GET /payments/me`. Gate em `ItineraryService.chooseDestination`
  (`CreditsService.unlock`: `UPDATE … WHERE credits >= 1` é o lock); devolução no
  dead-letter do pg-boss (`queue.work(name, handler, onDeadLetter)`). Porta
  `PAYMENT_PROVIDER=stripe|fake`, opcional — sem ela a compra responde 503 e o gate segue.
  **Sandbox sempre em dev/teste**; conta live só no lançamento. Web: `/credits`,
  `/payment/success` (polling em `/payments/me`), `/payment/cancelled`, selo no header,
  402 → `/credits?returnTo=`. Termos e Privacidade publicados em `/terms` e `/privacy`
  (markdown de `docs/legal` importado em build). Rotas novas em **inglês**; `/rotas` é
  legado a renomear.
- Hospedagem: agnóstica (container + Postgres + env).
- **`apps/worker` reusa a `api`**: `apps/api/src/worker-exports.ts` é um barrel exposto pelo campo `exports` do `package.json` (path `@farol/api` no `tsconfig.base` aponta pro `dist/worker-exports.d.ts`). O `WorkerModule` importa `ConfigModule`/`DbModule`/`LlmModule`/`JobsModule` + declara `ItineraryRepository` e os handlers como providers — **sem** `ItineraryModule`/`TripsModule` (esses têm controllers com `AuthGuard`, que o worker não tem).
- **Testes de integração compartilham um único Postgres.** `turbo.json` serializa `@farol/db#test → @farol/api#test → @farol/worker#test` (o `client.spec` do `db` dropa tabelas). pg-boss usa schema isolado por teste (`pgboss_*_<rnd>`, dropado no `afterAll`). Se o banco ficar sujo (run interrompido): `docker compose exec db psql -U postgres -d farol -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE"` + `db:migrate` + `db:seed`.

**Marca / design**
- Direção visual: híbrido — shell fixo (sidebar da viagem + miolo + trilho de chat sempre presente).
- Tipografia: **Bricolage Grotesque** (títulos) + **Instrument Sans** (texto).
- Cor: neutro quente; acento **terracota `#c25a38`**; verde `#3d7a67` só em indicador de match.
- Personalidade: "assessor calmo e confiável" — específico, honesto sobre incerteza, assume o trabalho, sem euforia. Ver `docs/design/brand/Voice.dc.html`.
- Tokens completos em `docs/design-system.md` (fonte da verdade para `packages/ui`).

**Modos de produto**
- **B2C padrão:** onboarding de gosto → descoberta (input + resultados) → roteiro → voo/hotel.
- **B2C autônomo:** entrada mínima (datas + origem + orçamento + até 3 gostos) → UM plano fechado, sem seletor de destino, ajustável só pelo chat.
- **B2B (v2):** landing de vendas + console do consultor (carteira de clientes → novo cliente → montar roteiro com markup e alternativa em milhas → revisar e enviar proposta com a marca da agência). Farol não aparece na proposta enviada.

**Qualidade / testes** (baseline — ver seção "Baseline de testes")
- Cobertura **100%** (statements/branches/functions/lines) em back e front, gate no CI.
- Testes de **unidade, integração, e2e e mutação** obrigatórios. Mutation score alvo **≥ 90%**.

---

## Como trabalhar em conjunto

- **Credenciais: Doppler, sem `.env`.** Projeto `farol`, configs `dev` (local) e `prd`
  (Render). Uma vez: `doppler login` + `doppler setup --no-interactive` (lê o `doppler.yaml`).
  Depois: `doppler run -- pnpm dev` / `doppler run -- pnpm test`. `.env.example` é só a lista
  de nomes. Deploy: o Claude lê do Doppler por MCP e escreve nas envs do Render — nunca editar
  a env do Render à mão. **Invariante: env do Render == `farol/prd`, chave a chave.** Só entra no
  Doppler o que algum código lê (`apps/api/src/config/env.schema.ts`, `NEXT_PUBLIC_*` do web,
  `DATABASE_URL` dos CLIs do db); valor igual ao default do schema não entra. Design em
  `docs/superpowers/specs/2026-09-02-deploy-render-doppler-design.md`.
- **Uma branch por pessoa/frente:** `git switch -c <nome>/<frente>`. Merge por PR. Nunca commitar direto na `main`.
- Para frentes paralelas na mesma máquina, usar `git worktree`.
- Ao concluir uma decisão/descoberta relevante, registrar em `docs/` (não em vault pessoal) para o contexto ficar no repo.
- Canvas de design (`docs/design/app/` telas · `docs/design/brand/` marca): editar as fontes `.dc.html` + `canvas.json`, re-seedar e republicar no mesmo artifact (ver histórico da sessão). Não editar os `.html` gerados (estão no `.gitignore`).

---

<!-- ship:start — gerido pelo skill `ship` (~/.claude/skills/ship). Só fatos deste projeto; o método mora no skill. -->
## Shipping (deploy, CI, release)

Desenvolvimento: Superpowers. Do teste verde até produção: skill **`ship`**.

**Recursos fixados** — os únicos em que uma sessão pode escrever:
- Repo `canIT-tech/farol` · Render workspace `tea-dac2m3ou01pc73fjhhq0`, serviço `srv-dacanevavr4c73fpn8tg` (https://farol-ekk3.onrender.com)
- Supabase `vvmnkqgdtgvdhheoqvjt` (**compartilhado** com o felippebutland — migração só com autorização explícita)
- Doppler `farol` (`dev`, `prd`; `stg` e `dev_personal` existem, sem uso no deploy) · Sentry `canit/farol`

**Gates** (local == CI): `pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e`, mais o boot smoke. Rodar local com Postgres do `docker compose`, **nunca** com o `DATABASE_URL` do Doppler.
- Todo fix/mudança de comportamento vem com teste de regressão que falha no código antigo.
- Mudança visível ao usuário → entrada em `## [Unreleased]` do `CHANGELOG.md`, no mesmo PR.

**`main` só por PR** — inclusive o commit de release —, sem revisor obrigatório. Proteção ligada por API (2026-09-23): checks `check` e `secrets` obrigatórios, vale para admin, sem force-push. Repo **público** desde 2026-09-23, com secret scanning + push protection, Dependabot e reporte privado de vulnerabilidade.

**Deploy:** merge na `main` → Render deploya. `autoDeployTrigger: checksPass` está no `render.yaml`, mas o serviço foi criado pelo dashboard e ainda não lê o arquivo (ver `docs/SETUP.md`/skill `ship`).

**Pronto** = merge → deploy → `/api/health` mostra o SHA → Sentry recebeu evento → `bin/release` numa branch `release/vX.Y.Z`, PR com merge commit, e só então `git push origin vX.Y.Z`.
<!-- ship:end -->

## Baseline de testes

**Regra:** nenhum passo do backlog é dado como concluído sem testes. Todo PR passa
por CI que falha se qualquer limiar abaixo não for atingido.

### Cobertura

- **100%** de `statements`, `branches`, `functions` e `lines` — em `apps/api`,
  `apps/worker`, `apps/web` e em cada `packages/*`.
- Medida por pacote (não média do monorepo). O gate é por pacote.
- **Exclusões permitidas** (só estas, e cada uma comentada no config):
  arquivos de bootstrap (`main.ts`, `main.worker.ts`), CLIs (`*-cli.ts` — `migrate-cli`, `seed-catalog-cli`),
  migrations do Drizzle, `*.config.*`, `*.stories.tsx`, tipos puros (`*.d.ts`), barrels só de re-export
  (`index.ts`, `worker-exports.ts`), `apps/api/src/**/prompts/**` (texto de prompt, não lógica; segue em coverage),
  `apps/web/src/lib/supabase.ts` (wrapper de SDK do browser, coberto pelo e2e).
  Qualquer outra exclusão precisa de aprovação no PR.
- **Break de mutação por pacote:** 90 em quase todos; **`@farol/db` = 85** (`client.ts`/`migrate.ts` são glue
  de I/O — pool/timeout/caminho de migração — sem efeito observável em teste unitário; `schema.ts` e `seed-catalog.ts`
  ficam ~100 e dominam a agregada).

### Tipos de teste (todos obrigatórios)

| Tipo | Escopo | Ferramenta |
|---|---|---|
| **Unidade** | função/serviço isolado, dependências mockadas. `domain/` é 100% puro, sem mock. `.spec.ts` primeiro (TDD). | Vitest |
| **Integração** | módulo Nest com DB real (Postgres de teste efêmero) + providers/LLM em fake determinístico. Fluxos: descoberta, geração de roteiro, mutação de trip via chat. | Vitest + Testcontainers (ou Supabase local) |
| **Contrato de provider** | Travelpayouts / Google Places contra fixtures gravadas em `__fixtures__`, sem rede no CI. | Vitest |
| **E2E — API** | `apps/api` de pé + Postgres de teste, chamadas HTTP reais ponta a ponta. | Vitest + Supertest |
| **E2E — Web** | fluxo real no browser: login → onboarding → descoberta → destino → roteiro; e o fluxo B2B (novo cliente → montar → proposta). | Playwright |
| **Mutação** | back e front. Mutation score **≥ 90%** por pacote; meta é matar todos os mutantes. Mutante sobrevivente sem teste = corrigir ou justificar no PR. | StrykerJS |

### Convenção

- Arquivos: `*.spec.ts` (unidade/integração), `*.e2e-spec.ts` (e2e API), `*.spec.ts` em `e2e/` (Playwright).
- `pnpm test` roda unidade + integração; `pnpm test:e2e`; `pnpm test:mutation`.
- CI: cobertura e mutação rodam em todo PR e no merge para `main`. PR vermelho não entra.
- LLM em teste sempre via fake determinístico (retorna JSON fixo por chave de prompt) — nunca chamada real.

O **Passo 1** monta esse harness (Vitest, Playwright, Stryker) e liga os gates no CI antes de qualquer feature.

## Débito técnico conhecido (Passos 2–5)

Ordenado por risco. Detalhe e plano em `docs/superpowers/plans/2026-08-29-correcao-debito-tecnico.md`.

**Bloqueiam / arriscam o CI**
- ~~`.github/workflows/ci.yml` — trocar `AMADEUS_*` por `TRAVELPAYOUTS_*`~~ Resolvido no Passo 10 (`ci.yml`, `nightly-mutation.yml`, `.env.example`, `render.yaml`).
- ~~Hotel sem provider~~ — resolvido com a **LiteAPI** (o Hotellook foi encerrado em 20/10/2025; `engine.hotellook.com` responde 404 até na raiz, é CloudFront sem origem — não adianta pedir liberação). **Aberto:** a chave em uso é de **sandbox**, que devolve conteúdo real mas tarifa de teste. Produção exige cadastrar um cartão no painel da Nuitée, e a reserva passaria a acontecer no Farol (somos o canal) — decisão comercial, não técnica. Alternativas sem essa amarra estão levantadas em `docs/negocio/2026-09-03-opcoes-provider-hotel.md`.
- ~~**CI roda `db:migrate` mas não `db:seed`.**~~ Resolvido no Passo 6: `db:seed` entrou como step explícito.
- **O provider do Google Flights é scraping.** Fere os ToS do Google, não tem SLA
  e lê um payload posicional — mudança de layout quebra sem aviso. Mitigado pelo
  `FallbackFlightProvider`, pelo circuit breaker e pelo
  `.github/workflows/nightly-google-flights.yml`, que é a única coisa que prova
  que a busca real ainda funciona (as fixtures congelam o layout do dia da
  gravação). Falha no noturno = rodar
  `pnpm --filter @farol/providers record:google-flights` e revisar
  `normalize-flight`.
- **Ida e volta pelo Google traz só o trecho de ida** (`returnAt` nulo). O preço
  já é o total; o itinerário da volta só existe depois de escolher a ida no
  próprio Google. Buscar o segundo passo exigiria um token opaco de sessão.
- **JWT expiry do Supabase ainda em 1h.** O design de sessão conta com 15min para
  fechar a janela entre o logout e a expiração do access token — é ajuste de
  painel (Authentication → Sessions), não de código, e segue pendente.
- **`GOOGLE_PLACES_KEY` do `farol/dev` é um placeholder de 11 caracteres**, não uma
  chave real (`AIza…`, ~39). Toda busca do Places responde
  `400 API_KEY_INVALID`, então todo item de roteiro sai sem `placeId`,
  coordenada e nota, marcado `needsReview` — o roteiro fica pronto, mas sem
  mapa. Degrada em silêncio: o `PlacesService` engole a falha por design
  (§7.3) e só o log `places_search_failed` acusa.
- **Worker morre em silêncio no `pnpm dev`.** O `tsx watch` observa
  `apps/api/dist` (o worker importa `@farol/api` de lá), então um `pnpm build`
  dispara vários reinícios em sequência; se um deles falha, o supervisor fica
  sem filho e só volta com uma nova mudança de arquivo. O turbo segue verde e a
  api e o web continuam de pé — o único sintoma é o roteiro parado em `pending`.
  Diagnóstico: `pgrep -P <pid do tsx>` vazio, e `pgboss.job` com
  `itinerary.generate` acumulando em `created`.
- **`pnpm test:mutation` no CI roda tudo** (api grande + worker + db + pg-boss real dentro da mutação). Lento e potencialmente instável. Avaliar rodar mutação só nos pacotes tocados no PR, ou mover pra job separado/nightly.
- **Testes de integração e o Postgres único.** A serialização no `turbo.json` resolve o CI (Postgres novo a cada run), mas localmente exige banco limpo. Opção definitiva: `DATABASE_URL_TEST` apontando pra um banco `farol_test` dedicado (docker-compose cria; specs já preferem `DATABASE_URL_TEST`).

**Placeholders da pipeline**
- `discovery`: `climate.expectedC` nulo e `flightTimeHours = null` (sem fonte de clima/tempo de voo no MVP). **Segue aberto.**
- ~~`estCost.flight` sempre da média `avgFlightCostFromGru` do catálogo~~ — resolvido no Passo 10: a descoberta consulta `/v1/city-directions` a partir da origem real da viagem e usa o preço do provider quando o destino aparece na lista; sem cobertura (ou provider fora do ar) cai na média do catálogo.
- ~~`itinerary_items.placeId/lat/lng/rating = null`~~ — preenchidos pelo enrich do Passo 6; item sem match fica `needsReview = true` e é reprocessado pelo job `places.enrich`.
- **Contexto de preço do Google não está exposto na API nem na tela.** O
  `GoogleFlightsProvider.searchWithContext()` já devolve `FlightPriceContext`
  (mais barato, típico, faixa e série histórica), mas o `FlightsService` só
  consome `search()`. Falta rota e cartão de "está barato comprar agora".
- `prefilterDestinations({ excludeIata })` existe mas não é usado (não há conceito de "destino rejeitado" no schema).

**Qualidade / precisão**
- `apps/api/src/llm/llm.types.ts` — `MODEL_PRICING` são valores **aproximados** (comentados como "revisar"); ligados ao "teto de custo de LLM por roteiro" ainda em aberto.
- `packages/providers/**/__fixtures__/*.json` — escritas à mão (ver Pendências).
- ~~`apps/web` sem as telas de roteiro/voo/hotel ligadas à api~~ — resolvido nos Passos 8 e 10. A tela **5 · Voo & hotel** do hi-fi está completa na parte de voos (cartão, abas, subtítulo, idade do preço, aeroportos vizinhos, contexto de preço). A metade de **hotel** ainda é lista simples: o hi-fi pede cartão com foto, bairro e distância a pé do roteiro — e não há provider de hotel (ver débito).
- `packages/ui/src/AdvisorChat/AdvisorChat.tsx:26` — warning de `Unused eslint-disable directive` (pré-existente, Passo 9). Não quebra o CI (`eslint` sem `--max-warnings 0`).
- Mutação medida em 2026-09-03, com voo e hotel completos: `@farol/shared` **97,22%** · `@farol/providers` **95,87%** · `@farol/ui` **93,61%** · `@farol/api` **92,11%** · `@farol/web` **91,99%**. Sobreviventes da api são equivalentes de `extractJson*` (`start === -1` vs `end <= start`) e strings de erro/prompt; documentado, dentro do break 90.

## Pendências abertas (do PRD / design técnico)

- Teto de custo de LLM por roteiro (`LLM_ROUTE_BUDGET_USD`) — planilha em `docs/negocio/2026-08-31-custo-llm-por-roteiro.md` (proposta: 0,60 pago / 0,15 grátis, chat no tier barato). Falta felippe cravar.
- Catálogo de destinos: CSV curado em `packages/db/data/destinations.csv` (23 cidades no Passo 3; `pnpm --filter @farol/db db:seed`). Expandir para ~200 é curadoria contínua — o levantamento de candidatos é automatizado (`pnpm --filter @farol/db research:destinations` consulta o `/v1/city-directions` de 12 origens BR e escreve um rascunho); `tags`, `bestMonths` e os custos de hospedagem seguem sendo humanos, porque a API não os tem e deixar o LLM preencher seria inventar preço. Processo em `docs/negocio/2026-09-03-curadoria-do-catalogo.md`.
- ~~Site parceiro para o deep-link de voo/hotel~~ — resolvido pela migração para Travelpayouts: o parceiro é Aviasales / Hotellook, o `marker` no deep-link já rende comissão.
- Re-gravar as fixtures do **Google Places** (`packages/providers/src/google/__fixtures__/*.json`) a partir da API real — ainda escritas à mão. ~~Travelpayouts~~ ✅ gravadas da API real no Passo 10.
- ~~Confirmar domínio~~ ✅ **`farolviagens.com`** (2026-08-31, sobre `faroltravel.com.br`). Falta: registrar (+ defensivos `farolviagens.com.br`, `faroltravel.com.br`), apontar DNS, geo-targeting BR no Search Console, e-mail transacional (SPF/DKIM/DMARC).
- Escolher lib base de componentes (recomendação: Radix para overlays).
- ~~Gateway de pagamento~~ — implementado no Passo 11 (Stripe, sandbox). **Falta:** ativar a conta live da isTech (CNPJ, banco, site com Termos/Privacidade/reembolso), trocar as chaves no Doppler `prd`, preencher os `[ENTRE COLCHETES]` de `docs/legal/`, e a revisão jurídica dos textos.

## Landing / waitlist (fora do backlog numerado)

- Rota `/` do `apps/web` **é a landing pública** (captura de e-mail pré-lançamento). O header
  mostra "Entrar" (→ `/login`) ou, com sessão, "Minhas viagens" (→ `/trips`). **`/trips` é a casa
  da área logada** (lista de viagens + Nova viagem / Modo autônomo / Meu perfil / Sair); sem
  perfil de gosto ela redireciona para `/onboarding`, que volta para `/trips` ao salvar. Login
  (magic link e Google) também cai em `/trips`. Etapas da sidebar = hi-fi: Perfil de gosto →
  Escolher destino → Roteiro → Voo & hotel (ids = segmentos de rota; `profile` → `/onboarding`).
  Contexto: `docs/superpowers/plans/2026-09-03-qa-manual-producao.md` Parte E.
- `POST /waitlist` (público, sem `AuthGuard`) + `GET /waitlist/count` no `WaitlistModule`. Tabela `waitlist` (migration `0005`). `app.enableCors()` ligado no `main.ts` por causa disso.
- Deploy exige `NEXT_PUBLIC_API_URL` do `apps/web` apontando para a API pública e a `0005` aplicada no banco.
- **E-mail de boas-vindas** via porta neutra `EmailModule` (`apps/api/src/email/`, mesmo desenho do LLM: `EMAIL_PROVIDER=resend|fake`, opcional; sem env o envio fica desligado e o cadastro segue). Adapter atual: **Resend** (REST puro, free 3.000/mês). `waitlist.welcome_sent_at` (migration `0008`) marca quem recebeu; nulo = reenviar depois. Falha no envio é logada (`waitlist_welcome_failed`), nunca falha o `POST`.
- Débito: sem rate-limit no `POST /waitlist` (guard por IP depois). Resend sem domínio verificado só entrega para o e-mail da própria conta (`onboarding@resend.dev`) — precisa de `farolviagens.com` (ou outro domínio) verificado para valer para usuários.

## Próximos passos

Backlog de implementação. Ordem = dependência. Puxe pelo número.

| # | Passo | Status | Responsável | Branch | Depende de |
|---|---|---|---|---|---|
| 1 | Fundação do monorepo — scaffold Turborepo, `packages/shared` + `packages/db` (Drizzle), `apps/api` NestJS boot + `ConfigModule` + `/health`, `apps/web` Next.js boot, 1 migration no Supabase, **harness de testes (Vitest, Playwright, Stryker) + gates de cobertura 100% / mutação no CI** | ✅ concluído | felippebutland | — | — | (2026-08-28) |
| 2 | Auth + Perfil de gosto — `AuthModule` (JWT Supabase via JWKS), upsert `users`, `ProfileModule` CRUD, login + onboarding no web | ✅ concluído | felippebutland | — | 1 | (2026-08-29) |
| 3 | Viagens + Descoberta de destino — `TripsModule`, catálogo seed (~200 cidades), `LlmModule`, `DiscoveryModule` (pré-filtro + ranking Claude) | ✅ concluído | felippebutland | — | 2 | (2026-08-29) |
| 4 | Roteiro + Jobs — `JobsModule` (pg-boss), `apps/worker`, `ItineraryModule`, job `itinerary.generate`, polling no web | ✅ concluído | felippebutland | — | 3 | (2026-08-29) |
| 5 | Providers voo/hotel — `packages/providers`, `provider_cache`, resiliência, `FlightsModule` / `HotelsModule` | ✅ concluído · voo migrado no Passo 10 · ⚠️ hotel sem provider (ver débito) | felippebutland | — | 3 | (2026-08-29) |
| 6 | Google Places + enrich — `GooglePlacesProvider`, `PlacesModule`, passo de enrich no job do roteiro, `swap_restaurant` | ✅ concluído | rafaignaulin | `rafaignaulin/passo-6-places-enrich` | 4 | (2026-08-31) |
| 7 | Chat IA — `ChatModule`, loop de tool-calling, as 11 tools mapeadas para serviços, `chat_messages` | ✅ concluído | felippebutland | — | 4, 5, 6 | (2026-08-31) |
| 8 | UI web + E2E — telas ligadas ao `apps/api`, fluxo Playwright login→onboarding→descoberta→destino→roteiro | ✅ concluído | rafaignaulin | — | 7 | (2026-09-02) |
| 9 | `packages/ui` — implementar tokens (`docs/design-system.md`) + componentes base (`Button`, `TextField`, `Chip`, `MatchBadge`, `DestinationCard`, `AppShell`, `StepNav`, `AdvisorChat`) | ✅ concluído | felippebutland | — | 1 | (2026-08-28) |
| 10 | Migração do provider voo/hotel — Amadeus (descontinuado) → **Travelpayouts**. Trocar `Amadeus*Provider` por `Travelpayouts*Provider`, sem OAuth, `marker` de afiliado no deep-link, regravar fixtures, envs. Spec: `docs/negocio/2026-08-31-spec-migracao-travelpayouts.md` | ✅ concluído | felippebutland | `felippebutland/passo-10-travelpayouts` | 5 | (2026-09-02) |
| 11 | Pagamento — `PaymentsModule` + webhook Stripe, saldo de crédito no usuário (modo Levels, sem ledger), 1º roteiro grátis, gate no `chooseDestination`. Spec: `docs/superpowers/specs/2026-09-15-pagamento-stripe-design.md` | ✅ concluído | rafaignaulin | `rafaignaulin/passo-11-pagamento` | 4 | (2026-09-16) |

Legenda de status: 🟢 livre · 🟡 em andamento · ✅ concluído · 🔴 bloqueado.

Fora da numeração, já na `main`: **refactor de LLM provider-agnóstico** (2026-08-31,
rafaignaulin — porta neutra + Vercel AI SDK, IA opcional no boot, troca de provider e de
modelo só por env; spec `docs/superpowers/specs/2026-08-31-llm-provider-agnostico-design.md`)
e o **fix de boot** (2026-09-01, rafaignaulin — os `packages/*` publicavam TypeScript com
import sem extensão e a aplicação não subia; `apps/api/test/boot-smoke.mjs` + `pnpm build`
no CI). Débito consolidado dos Passos 1–9 em
`docs/superpowers/plans/2026-09-01-consolidacao-passos-1-9.md`.

Detalhe de cada passo vem do design técnico (`docs/superpowers/specs/2026-08-27-mvp-trip-design.md`).
Passos 4 e 5 podem rodar em paralelo depois do 3. Passo 9 pode começar em paralelo a partir do 1.

**Definition of Done de todo passo:** cobertura 100% + testes de unidade, integração, e2e e
mutação passando (ver "Baseline de testes"). PR que não bate os gates de CI não entra.

---

## Guideline — modo gerenciador de tarefas

Quando alguém disser **"puxar o próximo passo N"** (ou "pego o passo N", "vou no passo N"),
o Claude age como gerenciador de tarefas, nesta ordem, **antes de escrever qualquer código**:

1. **Identifica quem puxou.** Usa `git config user.name`. Se a pessoa disser um nome
   diferente na mensagem, usa esse.
2. **Valida o passo.** Confere na tabela **Próximos passos** que o passo N está `🟢 livre`
   e que todos os passos em "Depende de" estão `✅ concluído`. Se estiver ocupado ou
   bloqueado, **avisa e para** — não implementa.
3. **Sincroniza.** `git checkout main && git pull` para pegar claims recentes de outra pessoa.
   Revalida o passo N depois do pull.
4. **Marca o claim** editando a linha do passo N na tabela:
   - Status → `🟡 em andamento`
   - Responsável → nome de quem puxou
   - Branch → `<nome>/passo-N-<slug-curto>`
   - Acrescenta a data no fim da linha entre parênteses.
5. **Commita só o CLAUDE.md** e dá push na `main`:
   `git add CLAUDE.md && git commit -m "chore(tasks): <nome> puxou o passo N — <título curto>" && git push`
   - Fechar com as linhas `Co-Authored-By` / `Claude-Session` de sempre.
   - Se o push for rejeitado (alguém commitou antes), `git pull --rebase`, revalidar o
     passo N na tabela, e repetir. Se nesse meio-tempo o passo foi tomado, avisar e parar.
6. **Cria a branch** `<nome>/passo-N-<slug>` a partir da `main` atualizada.
7. **Implementa** o passo nessa branch, seguindo o pipeline TDD do projeto
   (spec primeiro). Commits pequenos e frequentes na branch.
8. **Ao concluir:** abre PR para a `main`. Quando o PR entrar, numa mensagem seguinte
   o Claude atualiza a tabela: Status → `✅ concluído`, Responsável fica como quem
   entregou, e commita essa atualização do CLAUDE.md (pode ir junto no PR).

Regras:
- Uma pessoa pode ter no máximo **um passo `🟡 em andamento`** por vez.
- Nunca implementar um passo sem antes ter feito o commit de claim na `main`.
- Se pedirem "próximo passo" sem número, pegar o menor `#` que esteja `🟢 livre`
  com dependências `✅`.
- O commit de claim mexe **só no CLAUDE.md** — nada de código junto.

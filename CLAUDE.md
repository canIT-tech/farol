# Farol — contexto do projeto

Assessor de viagem que leva a pessoa do "não sei para onde ir" a um roteiro pronto:
descobre o destino pelo gosto, acha a melhor forma de chegar (dinheiro ou milhas),
monta o dia a dia e ajusta tudo por conversa.

- **Nome:** Farol (nome de trabalho — domínio `farol.app` a confirmar)
- **Codinome antigo:** trip
- **Repo:** `git@github.com:canIT-tech/farol.git`
- **Status:** fase de definição — PRD, design técnico e identidade prontos. Sem código de app ainda.

---

## Onde está cada coisa

| Documento | Caminho |
|---|---|
| PRD (visão, escopo faseado, personas, monetização) | `PRD.md` |
| Design técnico do MVP (arquitetura, módulos, dados) | `docs/superpowers/specs/2026-08-27-mvp-trip-design.md` |
| Design system (tokens + specs de componentes) | `docs/design-system.md` |
| Manual de marca (fontes) | `brand/*.dc.html` + `brand/canvas.json` |
| Telas do app (fontes) | `*.dc.html` + `canvas.json` na raiz |

Canvases publicados (Claude Artifacts):
- App / telas hi-fi: https://claude.ai/code/artifact/0086b95c-831f-40d6-8310-a54b0a5974cd
- Manual de marca Farol: https://claude.ai/code/artifact/c677b6a3-2ac6-47c8-aadd-c561eb8bc41b

---

## Decisões já tomadas (não reabrir sem motivo)

**Produto**
- Escopo é produto completo, mas execução **faseada**: MVP (gosto → roteiro) → v1 (milhas + alertas + premium) → v2 (consultoria, grupo, reserva, mobile, B2B).
- Motor de milhas fica no **v1** — é o diferencial, mas tem o maior risco de viabilidade (sem API oficial dos programas BR).
- Monetização: afiliados (principal no MVP) + assinatura premium (v1) + consultoria/B2B (v2). Amadeus Self-Service é data-only → MVP faz deep-link, sem afiliado.

**Arquitetura (do design técnico)**
- Monorepo **Turborepo**: `apps/web` (Next.js, só frontend) · `apps/api` (**NestJS**) · `apps/worker` (2º processo NestJS, jobs).
- `packages/`: `db` (Drizzle) · `domain` (lógica pura) · `providers` (Amadeus + Google Places) · `shared` (DTOs/zod).
- **Supabase**: Auth + Postgres + Storage. **Drizzle** ORM, migrations versionadas.
- Fila: **pg-boss** no próprio Postgres (sem Redis no MVP).
- Providers reais desde já: **Amadeus Self-Service** (voo + hotel) + **Google Places** (POI/restaurantes).
- LLM: **Claude**, roteamento de modelo por tarefa.
- `api` stateless; autorização na camada de serviço (RLS desligada nas tabelas de app).
- Hospedagem: agnóstica (container + Postgres + env).

**Marca / design**
- Direção visual: híbrido — shell fixo (sidebar da viagem + miolo + trilho de chat sempre presente).
- Tipografia: **Bricolage Grotesque** (títulos) + **Instrument Sans** (texto).
- Cor: neutro quente; acento **terracota `#c25a38`**; verde `#3d7a67` só em indicador de match.
- Personalidade: "assessor calmo e confiável" — específico, honesto sobre incerteza, assume o trabalho, sem euforia. Ver `brand/Voice.dc.html`.
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

- **Uma branch por pessoa/frente:** `git switch -c <nome>/<frente>`. Merge por PR. Nunca commitar direto na `main`.
- Para frentes paralelas na mesma máquina, usar `git worktree`.
- Ao concluir uma decisão/descoberta relevante, registrar em `docs/` (não em vault pessoal) para o contexto ficar no repo.
- Canvas de design: editar as fontes `.dc.html` + `canvas.json`, re-seedar e republicar no mesmo artifact (ver histórico da sessão). Não editar os `.html` gerados (estão no `.gitignore`).

---

## Baseline de testes

**Regra:** nenhum passo do backlog é dado como concluído sem testes. Todo PR passa
por CI que falha se qualquer limiar abaixo não for atingido.

### Cobertura

- **100%** de `statements`, `branches`, `functions` e `lines` — em `apps/api`,
  `apps/worker`, `apps/web` e em cada `packages/*`.
- Medida por pacote (não média do monorepo). O gate é por pacote.
- **Exclusões permitidas** (só estas, e cada uma comentada no config):
  arquivos de bootstrap (`main.ts`, `main.worker.ts`), migrations do Drizzle,
  `*.config.*`, `*.stories.tsx`, tipos puros (`*.d.ts`), barrels (`index.ts` só de re-export).
  Qualquer outra exclusão precisa de aprovação no PR.

### Tipos de teste (todos obrigatórios)

| Tipo | Escopo | Ferramenta |
|---|---|---|
| **Unidade** | função/serviço isolado, dependências mockadas. `domain/` é 100% puro, sem mock. `.spec.ts` primeiro (TDD). | Vitest |
| **Integração** | módulo Nest com DB real (Postgres de teste efêmero) + providers/LLM em fake determinístico. Fluxos: descoberta, geração de roteiro, mutação de trip via chat. | Vitest + Testcontainers (ou Supabase local) |
| **Contrato de provider** | Amadeus / Google Places contra fixtures gravadas em `__fixtures__`, sem rede no CI. | Vitest |
| **E2E — API** | `apps/api` de pé + Postgres de teste, chamadas HTTP reais ponta a ponta. | Vitest + Supertest |
| **E2E — Web** | fluxo real no browser: login → onboarding → descoberta → destino → roteiro; e o fluxo B2B (novo cliente → montar → proposta). | Playwright |
| **Mutação** | back e front. Mutation score **≥ 90%** por pacote; meta é matar todos os mutantes. Mutante sobrevivente sem teste = corrigir ou justificar no PR. | StrykerJS |

### Convenção

- Arquivos: `*.spec.ts` (unidade/integração), `*.e2e-spec.ts` (e2e API), `*.spec.ts` em `e2e/` (Playwright).
- `pnpm test` roda unidade + integração; `pnpm test:e2e`; `pnpm test:mutation`.
- CI: cobertura e mutação rodam em todo PR e no merge para `main`. PR vermelho não entra.
- LLM em teste sempre via fake determinístico (retorna JSON fixo por chave de prompt) — nunca chamada real.

O **Passo 1** monta esse harness (Vitest, Playwright, Stryker) e liga os gates no CI antes de qualquer feature.

## Pendências abertas (do PRD / design técnico)

- Teto de custo de LLM por roteiro (definir número).
- Catálogo de destinos: CSV curado em `packages/db/data/destinations.csv` (23 cidades no Passo 3; `pnpm --filter @farol/db db:seed`). Expandir para ~200 é curadoria contínua.
- Site parceiro para o deep-link de voo/hotel no MVP (template configurável via `FLIGHT_/HOTEL_DEEPLINK_TEMPLATE` desde o Passo 5).
- Re-gravar as fixtures Amadeus (`packages/providers/**/__fixtures__/*.json`) a partir do sandbox real — hoje são escritas à mão (Passo 5, sem credenciais).
- Confirmar domínio `farol.app` e travar o nome antes de produção.
- Escolher lib base de componentes (recomendação: Radix para overlays).

## Próximos passos

Backlog de implementação. Ordem = dependência. Puxe pelo número.

| # | Passo | Status | Responsável | Branch | Depende de |
|---|---|---|---|---|---|
| 1 | Fundação do monorepo — scaffold Turborepo, `packages/shared` + `packages/db` (Drizzle), `apps/api` NestJS boot + `ConfigModule` + `/health`, `apps/web` Next.js boot, 1 migration no Supabase, **harness de testes (Vitest, Playwright, Stryker) + gates de cobertura 100% / mutação no CI** | ✅ concluído | felippebutland | — | — | (2026-08-28) |
| 2 | Auth + Perfil de gosto — `AuthModule` (JWT Supabase via JWKS), upsert `users`, `ProfileModule` CRUD, login + onboarding no web | ✅ concluído | felippebutland | — | 1 | (2026-08-29) |
| 3 | Viagens + Descoberta de destino — `TripsModule`, catálogo seed (~200 cidades), `LlmModule`, `DiscoveryModule` (pré-filtro + ranking Claude) | ✅ concluído | felippebutland | — | 2 | (2026-08-29) |
| 4 | Roteiro + Jobs — `JobsModule` (pg-boss), `apps/worker`, `ItineraryModule`, job `itinerary.generate`, polling no web | 🟡 em andamento | felippebutland | `felippebutland/passo-4-roteiro-jobs` | 3 | (2026-08-29) |
| 5 | Providers Amadeus — `packages/providers`, auth OAuth2, `AmadeusFlightProvider` / `AmadeusHotelProvider`, `provider_cache`, resiliência, `FlightsModule` / `HotelsModule` | ✅ concluído | felippebutland | — | 3 | (2026-08-29) |
| 6 | Google Places + enrich — `GooglePlacesProvider`, `PlacesModule`, passo de enrich no job do roteiro, `swap_restaurant` | 🟢 livre | — | — | 4 |
| 7 | Chat IA — `ChatModule`, loop de tool-calling, as 9 tools mapeadas para serviços, `chat_messages` | 🟢 livre | — | — | 4, 5, 6 |
| 8 | UI web + E2E — telas ligadas ao `apps/api`, fluxo Playwright login→onboarding→descoberta→destino→roteiro | 🟢 livre | — | — | 7 |
| 9 | `packages/ui` — implementar tokens (`docs/design-system.md`) + componentes base (`Button`, `TextField`, `Chip`, `MatchBadge`, `DestinationCard`, `AppShell`, `StepNav`, `AdvisorChat`) | ✅ concluído | felippebutland | — | 1 | (2026-08-28) |

Legenda de status: 🟢 livre · 🟡 em andamento · ✅ concluído · 🔴 bloqueado.

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

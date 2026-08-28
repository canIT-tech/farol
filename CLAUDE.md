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

---

## Como trabalhar em conjunto

- **Uma branch por pessoa/frente:** `git switch -c <nome>/<frente>`. Merge por PR. Nunca commitar direto na `main`.
- Para frentes paralelas na mesma máquina, usar `git worktree`.
- Ao concluir uma decisão/descoberta relevante, registrar em `docs/` (não em vault pessoal) para o contexto ficar no repo.
- Canvas de design: editar as fontes `.dc.html` + `canvas.json`, re-seedar e republicar no mesmo artifact (ver histórico da sessão). Não editar os `.html` gerados (estão no `.gitignore`).

## Pendências abertas (do PRD / design técnico)

- Teto de custo de LLM por roteiro (definir número).
- Catálogo de destinos: começar com CSV curado (~200 cidades).
- Site parceiro para o deep-link de voo/hotel no MVP.
- Confirmar domínio `farol.app` e travar o nome antes de produção.
- Escolher lib base de componentes (recomendação: Radix para overlays).

## Próximo passo planejado

Plano de implementação **Fase 1 — Fundação do monorepo** (scaffold Turborepo, `packages/shared` + `packages/db`, `apps/api` NestJS boot, `apps/web` Next.js boot, 1 migration Drizzle no Supabase, `/health` verde).

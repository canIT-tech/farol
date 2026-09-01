# Custo de LLM por roteiro — planilha para cravar o teto

- **Status:** planilha de apoio à decisão. **Falta:** felippe cravar `LLM_ROUTE_BUDGET_USD`.
- **Data:** 2026-08-31
- **Dono (produto):** felippe
- **Alimenta:** `docs/negocio/2026-08-31-spec-pagamento.md` (margem por viagem) ·
  débito `apps/api/src/llm/llm.types.ts` (`MODEL_PRICING` "revisar")
- **Fonte de preço:** `MODEL_PRICING` no código + tabelas públicas (revisar antes de fechar).

---

## 1. Que chamadas de LLM entram num roteiro

| Chamada | `kind` | Tier | Quantas por roteiro |
|---|---|---|---|
| Ranquear destinos | `rank_destinations` | `capable` | 1 |
| Montar o roteiro dia a dia | `build_itinerary` | `capable` | 1 (+1 a cada regeneração) |
| Chat de ajuste (loop de tool-calling) | `chat` | `capable` | N turnos — pago: ilimitado · grátis: 3 |

O teto `LLM_ROUTE_BUDGET_USD` soma o `estimatedUsd` de **todas as chamadas com o mesmo
`tripId`**. Quando estoura, o chat degrada (ver §6). `rank` + `build` acontecem uma vez
e não são o risco — o risco é chat em loop.

---

## 2. Tokens por chamada (estimativa — viagem de 7 dias)

| Chamada | Input (tok) | Output (tok) | Nota |
|---|---:|---:|---|
| `rank_destinations` | 1.000 | 500 | shortlist de ~25 destinos + perfil + contexto → lista ranqueada com motivo curto |
| `build_itinerary` | 400 | 3.500 | prompt curto; saída é 7 dias × ~4 slots × (título + descrição + números). 5 dias ≈ 2.500 · 10 dias ≈ 5.000 |
| `chat` (por turno) | 7.500 | 1.200 | roteiro no contexto (~1.500) + histórico crescente + specs das 9 tools (~600) + ~2 rodadas do loop de tool-calling |

Ajuste os números na §7 se a realidade divergir dos logs (`event: "llm_call"`).

---

## 3. Preços por modelo (`MODEL_PRICING`, USD por 1M tokens)

| `provider:model` | Input | Output |
|---|---:|---:|
| `anthropic:claude-sonnet-5` | 3,00 | 15,00 |
| `anthropic:claude-haiku-4-5` | 0,80 | 4,00 |
| `groq:llama-3.3-70b-versatile` | 0 | 0 |
| `groq:llama-3.1-8b-instant` | 0 | 0 |

Hoje **as três chamadas usam `tier: "capable"`** (`llm.service.ts`). O tier resolve para
`LLM_MODEL_CAPABLE` / `LLM_MODEL_CHEAP` por env.

---

## 4. Custo por roteiro pago (7 dias + 6 turnos de chat)

| Cenário | rank | build | chat (6 turnos) | **Total USD** | **≈ BRL** (5,30) |
|---|---:|---:|---:|---:|---:|
| **A — tudo Sonnet 5** | 0,011 | 0,054 | 0,243 | **≈ 0,31** | **≈ R$ 1,65** |
| **B — rank+build Sonnet, chat Haiku** | 0,011 | 0,054 | 0,065 | **≈ 0,13** | **≈ R$ 0,69** |
| **C — tudo Haiku 4.5** | 0,003 | 0,014 | 0,065 | **≈ 0,08** | **≈ R$ 0,43** |
| **D — tudo Groq llama (grátis)** | 0 | 0 | 0 | **0** | **R$ 0** |

*Chat: assume ~6 turnos, ~7.500 in + ~1.200 out cada, com 2 rodadas de tool-calling em
metade dos turnos. Um usuário que conversa muito (20 turnos) triplica a linha de chat.*

---

## 5. Margem na viagem avulsa (R$ 39) — cenário B (realista)

| Linha | Valor |
|---|---:|
| Receita | R$ 39,00 |
| − Taxa de pagamento (Stripe BR ~4,5% + R$ 0,39) | − R$ 2,15 |
| − LLM (cenário B) | − R$ 0,69 |
| − Google Places (enrich: ~1 text search + ~20 place details, com cache) | − R$ 2,20 |
| − Travelpayouts (voo/hotel) | R$ 0 *(afiliado — é receita, não custo)* |
| **= Margem de contribuição** | **≈ R$ 34,00 (87%)** |

Mesmo no **cenário A** (tudo Sonnet), a margem cai só para ~R$ 33 (85%). **O teto não
existe para proteger a margem** — existe para **cortar chat em loop / abuso**.

---

## 6. O que o teto faz e recomendação

`LLM_ROUTE_BUDGET_USD` = teto de custo acumulado de LLM por `tripId`. Ao estourar:

- **chat** responde erro suave (`route_budget_exceeded` → 402/429) com CTA — "você já fez
  muitos ajustes nesta viagem; abra outra viagem para continuar" *(texto = decisão de copy)*;
- `rank` e `build` **não** são bloqueados (acontecem uma vez, antes do chat).

| Perfil | Recomendação |
|---|---|
| **Viagem paga** | **`LLM_ROUTE_BUDGET_USD = 0.60`** (≈ R$ 3,20 · ~8% do preço). No cenário B cobre ~55 turnos de chat; no cenário A, ~14. Generoso para uso real, corta abuso. |
| **Viagem gratuita** | teto separado **`LLM_ROUTE_BUDGET_FREE_USD = 0.15`** — o grátis já trava em 3 mensagens de chat, então isto é só cinto de segurança. |
| **Roteamento** | mandar `chat` para `tier: "cheap"` (Haiku ou Groq) e deixar `rank`/`build` em `capable`. Muda 1 linha em `llm.service.ts`. Derruba o custo de chat ~4×. |

**Decisão a cravar:** o número do `LLM_ROUTE_BUDGET_USD` (proposta: **0,60**), o do grátis
(proposta: **0,15**), e se o `chat` vai para o tier barato (proposta: **sim**).

---

## 7. Premissas a validar (mexer aqui muda tudo acima)

- **Câmbio:** R$ 5,30 / USD.
- **Turnos de chat médios por roteiro pago:** 6. *(medir nos logs após o lançamento.)*
- **Tokens de chat por turno:** 7.500 in / 1.200 out. *(depende de quanto do roteiro
  entra no contexto — se mandar só o diff, cai bastante.)*
- **Google Places por roteiro:** ~R$ 2,20 com cache. *(SKU Place Details Pro ~US$ 17/1k;
  Text Search ~US$ 32/1k. Confirmar cota grátis mensal.)*
- **Taxa Stripe BR:** 4,5% + R$ 0,39. *(cartão à vista doméstico; parcelado e internacional
  custam mais — confirmar no cadastro.)*
- **`MODEL_PRICING`** está marcado como "revisar" no código — bater com a tabela oficial
  do fornecedor escolhido antes de fechar.
- **Modelo de produção:** `.env.example` sugere Groq llama (grátis) como opção; se o
  lançamento for com Groq, o custo de LLM por roteiro é ~R$ 0 e o teto vira só proteção
  de rate-limit. Decisão do Rafinha (frente 5 do checklist).

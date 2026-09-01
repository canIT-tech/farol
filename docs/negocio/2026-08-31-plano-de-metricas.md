# Plano de métricas de produto — Farol

- **Status:** rascunho para alinhar com o time (produto + GTM + tech)
- **Data:** 2026-08-31
- **Dono (produto):** felippe · **Consome:** Xandinho (GTM), Rafinha (instrumentação)
- **Relacionado:** `docs/marketing/2026-08-31-plano-go-to-market.md` (funil e KPIs de canal) ·
  `docs/negocio/2026-08-31-custo-llm-por-roteiro.md` (margem por roteiro) ·
  specs de pagamento e plano gratuito

Toda meta numérica está marcada **(H)** — hipótese a validar com dado real. O objetivo
deste doc é **cravar as definições** (o que conta como o quê) antes de instrumentar.

---

## 1. North Star

> **NSM — Roteiros pagos concluídos por mês.**
> Um roteiro em que um **crédito foi consumido** e o job `itinerary.generate`
> **concluiu com sucesso**.

Por que essa: num produto transacional por viagem, esse único número junta aquisição,
ativação e monetização. Não é vaidade (waitlist, cadastros) nem receita bruta (que
esconde reembolso e mix de produto).

**NSM = f(entradas):**

| Entrada | Definição | Meta inicial |
|---|---|---|
| Novos ativados / mês | usuários que geraram o **1º roteiro** (grátis ou pago) | — |
| Conversão grátis → pago | % dos ativados no grátis que compram ≥ 1 crédito em 30 dias | **10% (H)** |
| Roteiros pagos por comprador | créditos consumidos ÷ compradores, em 90 dias | **1,6 (H)** |
| Receita de afiliado por roteiro pago | comissão Travelpayouts ÷ roteiros pagos (mensal) | **R$ 10 (H)** |

---

## 2. Funil (fonte da verdade = eventos de servidor)

```
Visitante da landing
      │  waitlist_joined
Inscrito na waitlist ───────────────► (pré-lançamento: fim do funil por ora)
      │  signup_completed
Conta criada
      │  onboarding_completed
Perfil de gosto pronto
      │  itinerary_generated  (mode = autonomous_free)   ◄── ATIVAÇÃO
Roteiro gratuito entregue
      │  upgrade_wall_viewed
Parede de upgrade vista
      │  checkout_started → payment_succeeded
Compra
      │  credit_consumed + itinerary_generated (pago)     ◄── NSM
Roteiro pago entregue
      │  chat_message_sent · flight_deeplink_clicked · hotel_deeplink_clicked
Uso e saída para o parceiro
      │  payment_succeeded (2ª vez) OU 2º credit_consumed
Recompra
```

**Taxas a acompanhar** (cada seta ÷ a anterior):

| Passo | Meta (H) |
|---|---|
| signup → onboarding | 85% |
| onboarding → 1º roteiro (ativação) | 65% |
| ativação grátis → parede vista | 55% |
| parede vista → checkout | 25% |
| checkout → pagamento | 80% |
| comprador → recompra em 90d | 20% |
| roteiro entregue → clique em deep-link (voo ou hotel) | 40% |

---

## 3. Métricas por fase

### Pré-lançamento (waitlist)
- Inscritos totais e por semana; **origem por canal** (UTM — ver §5 do GTM).
- Taxa de confirmação de e-mail (se houver double opt-in).
- Custo por inscrito por canal (mídia paga).

### Lançamento (beta fechado → early access → público)
- **Ativação:** % de contas que geram o 1º roteiro; **tempo mediano até o 1º roteiro**.
- **Conversão grátis → pago** (7d e 30d).
- **CAC por canal** = gasto ÷ compradores atribuídos.
- Qualidade: % de roteiros com `needsReview` alto no enrich; taxa de
  `itinerary_generation_failed`.

### Operação contínua
- **NSM** (roteiros pagos/mês) + as 4 entradas da §1.
- **Retenção / recompra:** curva de recompra por coorte de 1ª compra.
- **Receita:** pagamento (avulso vs pacote) + afiliado (Travelpayouts, mensal).
- **Margem por roteiro:** receita − Stripe − LLM − Places (liga na planilha de custo).
- **CSAT / NPS** pós-roteiro (1 pergunta no fim do fluxo).

---

## 4. Definições precisas (para não haver ambiguidade)

| Termo | Definição operacional |
|---|---|
| **Usuário ativado** | disparou ≥ 1 `itinerary_generated` (job concluído), grátis ou pago |
| **Roteiro pago** | `credit_consumed` + `itinerary_generated` na mesma trip |
| **Conversão grátis → pago** | ativados no grátis com ≥ 1 `payment_succeeded` em 30 dias ÷ ativados no grátis |
| **Recompra** | comprador com 2º `payment_succeeded` (avulso) **ou** 2º `credit_consumed` (pacote) |
| **Ativação de afiliado** | `flight_deeplink_clicked` **ou** `hotel_deeplink_clicked` na trip |
| **Comissão** | valor confirmado no painel Travelpayouts (fecha mensal; não atribuído por trip no MVP) |
| **Coorte** | mês do `signup_completed` (para ativação) ou da 1ª compra (para recompra) |
| **Usuário** | `distinct_id` = id do usuário no Supabase Auth |

---

## 5. Tabela de eventos a instrumentar

`distinct_id` = id do usuário Supabase. Todo evento com escopo de viagem carrega
`trip_id`. **Eventos de `api`/`worker` são a fonte da verdade** para funil e receita;
os de `web` servem para UX e CTA.

| Evento | Quando dispara | Origem | Propriedades |
|---|---|---|---|
| `waitlist_joined` | POST /waitlist ok | web→api | `source`, `utm_source/medium/campaign` |
| `signup_completed` | 1ª sessão autenticada | api | `method` |
| `onboarding_completed` | perfil de gosto salvo | api | `interests_count`, `pace` |
| `trip_created` | trip criada | api | `mode` = `autonomous_free\|autonomous_paid\|assessor` |
| `discovery_ranked` | ranking Claude retornou | api | `shortlist_size`, `shown_count` |
| `itinerary_requested` | job `itinerary.generate` enfileirado | api | `trip_id`, `mode`, `is_free` |
| `itinerary_generated` | job concluiu com sucesso | worker | `trip_id`, `days`, `mode`, `is_free`, `duration_ms`, `llm_usd` |
| `itinerary_generation_failed` | job em dead-letter | worker | `trip_id`, `reason` |
| `itinerary_viewed` | tela do roteiro aberta | web | `trip_id`, `day_count` |
| `chat_message_sent` | turno de chat do usuário | api | `trip_id`, `is_free`, `remaining` |
| `chat_limit_hit` | 4ª msg grátis ou teto de custo | api | `trip_id`, `kind` = `free_3\|route_budget` |
| `upgrade_wall_viewed` | parede exibida | web | `wall` = `free_trip_used\|trip_limit\|chat_exhausted\|assessor` |
| `checkout_started` | POST /payments/checkout ok | api | `product` = `single\|pack3` |
| `payment_succeeded` | webhook `checkout.session.completed` | api | `product`, `credits`, `amount_cents` |
| `payment_refunded` | webhook de refund | api | `product`, `amount_cents`, `reason` |
| `credit_consumed` | `CreditsService.consume` | api | `trip_id` |
| `flight_deeplink_clicked` | clique no link de voo | web | `trip_id` |
| `hotel_deeplink_clicked` | clique no link de hotel | web | `trip_id` |
| `csat_submitted` | pergunta pós-roteiro respondida | web | `trip_id`, `score` |

**Ferramenta:** recomendação **PostHog** (funis, coortes e retenção prontos, tier grátis
generoso, opção de hospedagem na UE para LGPD). Alternativas: GA4 (grátis, funil mais
pobre), Plausible (sem cookie, mas sem funil de produto). Entra como operador na
Política de Privacidade e **só carrega após o opt-in** no banner de cookies (analytics =
não essencial).

---

## 6. Guardrails (não otimizar o NSM às custas destes)

- **Taxa de reembolso** ≤ 5% (H) das compras.
- **CSAT do roteiro** ≥ 4,0 / 5 (H).
- **Custo de LLM por roteiro** dentro do teto (`LLM_ROUTE_BUDGET_USD`).
- **% de roteiros com `needsReview` alto** no enrich ≤ 10% (H) — qualidade do dado de POI.
- **Tempo até o 1º roteiro** ≤ 3 min (H).

---

## 7. Cadência

- **Semanal:** NSM + funil + as 5 taxas principais + guardrails. 30 min com produto + GTM.
- **Mensal:** receita (pagamento + afiliado), margem por roteiro, coortes de recompra.
- O **backoffice** (`docs/index.html`, hoje shell local) evolui para mostrar assinatura /
  receita — os dados de pagamento vêm de `orders` / `credit_ledger` (spec de pagamento).

---

## 8. Decisões a fechar

1. **NSM:** "roteiros pagos concluídos / mês" — confirmar. Alternativa: incluir os grátis
   ("roteiros entregues"), o que mede valor mas não saúde do negócio.
2. **Ferramenta de analytics:** PostHog *(proposto)* · GA4 · Plausible.
3. **CSAT no fluxo:** 1 pergunta pós-roteiro (score 1–5) — topa? Onde exatamente?
4. **Janela de conversão grátis → pago:** 30 dias *(proposto)*.
5. **Double opt-in na waitlist:** sim/não (afeta a métrica de confirmação e a base legal).

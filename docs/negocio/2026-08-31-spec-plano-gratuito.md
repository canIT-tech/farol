# Spec — limites do plano gratuito

- **Status:** rascunho para implementação (revisar antes de abrir PR)
- **Data:** 2026-08-31
- **Dono (produto):** felippe · **Implementação (tech):** rafinha
- **Complementa:** `docs/negocio/2026-08-31-spec-pagamento.md` (§2, §5 — `users.free_autonomous_used_at`, gate no `itinerary.generate`)
- **Consome:** `DiscoveryModule` (Passo 3), `ItineraryModule` + job `itinerary.generate` (Passo 4)

---

## 1. O que o plano gratuito é

**Uma (1) viagem gratuita por conta, para sempre** (não renova por mês nem por período).
Serve para a pessoa provar o valor do Farol antes de pagar.

A viagem gratuita roda **só no modo autônomo restrito**:

| | Grátis (autônomo restrito) | Pago (1 crédito / viagem) |
|---|---|---|
| Entrada | mínima: origem, datas, orçamento, até 3 gostos | completa |
| Destino | **1**, escolhido pelo Farol — sem seletor, sem lista de alternativas | descoberta com seleção entre vários |
| Roteiro dia a dia | sim (1 plano fechado) | sim |
| Indicação de voo/hotel (deep-link) | sim | sim |
| Chat de ajuste | **não** | sim, ilimitado na viagem |
| Regenerar / trocar destino | **não** | por chat, sem custo extra |
| Nº de viagens | **1 ativa** (ver §4) | 1 por crédito |

---

## 2. Como é marcado

Coluna já prevista na spec de pagamento: `users.free_autonomous_used_at timestamptz NULL`.

- `NULL` → a conta ainda tem a viagem gratuita.
- **Setado para `now()` quando o job `itinerary.generate` da viagem autônoma gratuita
  conclui com sucesso** — não na criação da trip, não ao enfileirar o job.
- **Job falhou em definitivo** (dead-letter do pg-boss): **não marca**. A pessoa pode
  tentar de novo sem gastar a viagem grátis.
- Nunca volta a `NULL` por conta do usuário. Só suporte manual.
- **Comprar crédito não devolve a viagem grátis** — o grátis é único; créditos são
  adicionais e independentes.

---

## 3. Elegibilidade (camada de serviço)

Um `EntitlementsService` (ou métodos no serviço que já existe) centraliza:

```ts
canGenerateFreeAutonomous(user): boolean   // free_autonomous_used_at == null
canUseAssessorMode(user): boolean          // saldo de créditos >= 1
canChat(trip, user): boolean               // a trip foi desbloqueada por crédito (trips.unlocked_at != null)
canRegenerate(trip, user): boolean         // idem canChat
```

- `canUseAssessorMode` e o consumo de crédito continuam como na spec de pagamento
  (`CreditsService.consume`, gate no `itinerary.generate`, HTTP **402** quando falta).
- A viagem gratuita **não** passa pelo `CreditsService` — passa só pelo check de
  `free_autonomous_used_at`.

---

## 4. Gates (onde o backend barra)

| Ação | Conta sem crédito, `free_autonomous_used_at == null` | Conta sem crédito, `free_autonomous_used_at != null` |
|---|---|---|
| Criar 1ª viagem (autônoma) | ✅ permitido | — |
| `itinerary.generate` da viagem autônoma | ✅ gera e marca `free_autonomous_used_at` | ❌ **402** `free_trip_used` → tela de compra |
| Criar 2ª viagem | ❌ **402** — só com crédito (máx **1 viagem ativa** no grátis) | ❌ **402** |
| Entrar no modo assessor (descoberta com seletor) | ❌ bloqueado — grátis nunca vê o seletor | ❌ bloqueado |
| `POST /chat` numa viagem gratuita | ❌ **402** `chat_requires_paid` | ❌ |
| Regenerar / `swap_restaurant` / trocar destino numa viagem gratuita | ❌ **402** | ❌ |

Códigos de erro seguem o padrão do projeto (`DomainError` → `STATUS_BY_CODE`): novos
códigos `free_trip_used`, `chat_requires_paid`, `assessor_requires_paid` → **402**.

---

## 5. Fluxo da viagem gratuita (modo autônomo restrito)

1. Usuário loga, `free_autonomous_used_at == null`, saldo 0 → cai **direto** no fluxo
   autônomo (sem tela de escolha de modo).
2. Entrada mínima: origem, datas, orçamento, até 3 gostos.
3. `DiscoveryModule` roda o pré-filtro + ranking Claude e **pega o top 1
   automaticamente** — a lista não é devolvida ao usuário.
4. `itinerary.generate` para esse destino (flag `mode: 'autonomous'`), + enrich Places,
   + indicação de voo/hotel (deep-link Travelpayouts com `marker`).
5. Job conclui com sucesso → `free_autonomous_used_at = now()`.
6. Usuário vê o plano fechado. Chat e botões de ajuste **aparecem desabilitados** com CTA.

Sem `provider_cache` especial, sem tabela nova, sem migration — reusa Discovery +
Itinerary. A única diferença é não expor o seletor e não devolver alternativas.

---

## 6. O que a UI mostra (Passo 8 — web)

- **Antes de gerar:** aviso curto no fluxo autônomo — "Sua viagem gratuita: 1 plano
  fechado, escolhido pelo Farol. Para comparar destinos e ajustar por conversa, cada
  viagem custa R$ 39." (voz assessor calmo, sem euforia).
- **Depois de usar:** ao tentar criar outra viagem ou abrir o modo assessor → tela
  "Você já usou sua viagem gratuita" + dois cards (Avulsa R$ 39 · Pacote R$ 89).
- **Na viagem gratuita já gerada:** trilho de chat e botões de ajuste visíveis porém
  desabilitados, com tooltip/CTA "disponível nas viagens pagas".
- **Header (logado):** selo "Plano grátis · 1 viagem" enquanto `free_autonomous_used_at
  == null`; depois "0 créditos" com link para comprar; com saldo, "X créditos".

---

## 7. Anti-abuso (MVP — leve)

- 1 conta = 1 e-mail (Supabase Auth). Contas novas com e-mails diferentes ganham novo
  grátis — **aceitável no MVP**, só monitorar. Sem device fingerprint agora.
- **1 job `itinerary.generate` pendente por conta por vez** (se o Passo 4 ainda não
  impõe isso, impor aqui) — evita fila de jobs de contas grátis.
- Rate limit no endpoint de criação de viagem por conta (reusar o guard por IP/conta
  quando existir).

---

## 8. Testes (baseline do projeto)

**Unidade** — `EntitlementsService`: `canGenerateFreeAutonomous` (null vs setado),
`canUseAssessorMode` (saldo 0 vs ≥1), `canChat` / `canRegenerate` (trip com/sem
`unlocked_at`).

**Integração (Postgres real)**
- 1º `generate` autônomo conclui → `free_autonomous_used_at` setado.
- 2º `generate` → 402 `free_trip_used`.
- Job falho **não** seta o flag; retry funciona.
- Comprar crédito **não** zera o flag; com crédito, o modo assessor abre.
- Criar 2ª viagem sem crédito → 402.

**E2E — API**
- Fluxo grátis ponta a ponta: entrada mínima → plano fechado → `free_autonomous_used_at`
  setado → 2ª viagem barrada → `POST /chat` na viagem grátis → 402.

**E2E — Web (Passo 8):** onboarding grátis → plano → tela "já usou" com os dois cards.

**Mutação:** ≥ 90 no pacote tocado.

---

## 9. Decisões a confirmar

1. **Chat no grátis:** proposta = **0 mensagens** (chat é diferencial pago). Alternativa:
   liberar 3 mensagens para provar. — *decisão de produto.*
2. **Viagens no grátis:** proposta = **1 viagem ativa** (criar outra exige crédito).
   Alternativa: N viagens criáveis, mas só 1 geração. — *proposta: 1 ativa.*
3. **Mostrar alternativas de destino no grátis** (as "também bateram", só como texto):
   proposta = **não mostrar** — é "1 plano fechado". — *proposta: não.*
4. **Comprar crédito reativa o grátis?** proposta = **não**. — *proposta: não.*
5. **Modo autônomo pago:** quem tem crédito e escolhe o autônomo (plano fechado) —
   consome **1 crédito** igual ao assessor; a diferença é ter chat e poder trocar
   destino por conversa. — *proposta: sim, 1 crédito.*

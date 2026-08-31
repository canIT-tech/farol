# Spec — limites do plano gratuito

- **Status:** decisões de produto travadas (2026-08-31) — pronta para implementação
- **Data:** 2026-08-31
- **Dono (produto):** felippe · **Implementação (tech):** rafinha
- **Complementa:** `docs/negocio/2026-08-31-spec-pagamento.md` (§2, §5 — `users.free_autonomous_used_at`, gate no `itinerary.generate`)
- **Consome:** `DiscoveryModule` (Passo 3), `ItineraryModule` + job `itinerary.generate` (Passo 4)

---

## 1. O que o plano gratuito é

**Uma (1) geração gratuita de roteiro por conta, para sempre** (não renova por mês nem
por período). Serve para a pessoa provar o valor do Farol antes de pagar.

A viagem gratuita roda **só no modo autônomo restrito**:

| | Grátis (autônomo restrito) | Pago (1 crédito / viagem) |
|---|---|---|
| Entrada | mínima: origem, datas, orçamento, até 3 gostos | completa |
| Destino | **1**, escolhido pelo Farol — sem seletor, **sem lista de alternativas nem texto** | descoberta com seleção entre vários |
| Roteiro dia a dia | sim (1 plano fechado) | sim |
| Indicação de voo/hotel (deep-link) | sim | sim |
| Chat de ajuste | **3 mensagens** do usuário, depois trava | ilimitado na viagem |
| Regenerar / trocar destino | **não** | por chat, sem custo extra |
| Nº de viagens (registros de trip) | **até 5 criáveis** por conta; só **1** gera roteiro de graça | 1 por crédito |

**Modo autônomo pago:** quem tem crédito e escolhe o plano fechado (autônomo) consome
**1 crédito**, igual ao modo assessor. A diferença do pago é ter chat ilimitado e poder
trocar o destino por conversa.

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
canCreateTrip(user): boolean               // saldo >= 1  OU  nº de trips da conta < 5
canUseAssessorMode(user): boolean          // saldo de créditos >= 1
freeChatRemaining(trip): number            // trip gratuita: 3 - (msgs do usuário nessa trip); trip paga: Infinity
canChat(trip, user): boolean               // trip paga (unlocked_at != null)  OU  freeChatRemaining(trip) > 0
canRegenerate(trip, user): boolean         // só trip paga (unlocked_at != null)
```

- `canUseAssessorMode` e o consumo de crédito continuam como na spec de pagamento
  (`CreditsService.consume`, gate no `itinerary.generate`, HTTP **402** quando falta).
  O **modo autônomo pago** passa pelo mesmo `consume` (1 crédito).
- A viagem gratuita **não** passa pelo `CreditsService` — passa pelo check de
  `free_autonomous_used_at` (geração) e por `freeChatRemaining` (chat).
- **`freeChatRemaining`** = `3 − COUNT(chat_messages WHERE trip_id = ? AND role = 'user')`.
  Sem coluna nova — conta as mensagens do usuário na própria trip. Vale só enquanto a
  trip for gratuita (`unlocked_at IS NULL`).

---

## 4. Gates (onde o backend barra)

| Ação | Conta sem crédito, `free_autonomous_used_at == null` | Conta sem crédito, `free_autonomous_used_at != null` |
|---|---|---|
| Criar viagem (registro de trip) | ✅ até **5 trips** na conta; a 6ª → **402** `trip_limit_reached` | ✅ até 5; a 6ª → **402** |
| `itinerary.generate` (autônomo, 1ª geração) | ✅ gera e marca `free_autonomous_used_at` | ❌ **402** `free_trip_used` → tela de compra |
| `itinerary.generate` numa 2ª trip | ❌ **402** `free_trip_used` — só com crédito | ❌ **402** |
| Entrar no modo assessor (descoberta com seletor) | ❌ **402** `assessor_requires_paid` — grátis nunca vê o seletor | ❌ |
| `POST /chat` numa trip gratuita, ≤ 3 msgs do usuário | ✅ permitido (`freeChatRemaining` decrementa) | ✅ (idem — vale por trip) |
| `POST /chat` numa trip gratuita, 4ª mensagem | ❌ **402** `free_chat_exhausted` → CTA de compra | ❌ |
| Regenerar / `swap_restaurant` / trocar destino numa trip gratuita | ❌ **402** `regenerate_requires_paid` | ❌ |

Códigos de erro seguem o padrão do projeto (`DomainError` → `STATUS_BY_CODE`): novos
códigos `trip_limit_reached`, `free_trip_used`, `assessor_requires_paid`,
`free_chat_exhausted`, `regenerate_requires_paid` → **402**.

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
6. Usuário vê o plano fechado. O trilho de chat funciona com **3 mensagens** (contador
   visível); os botões de regenerar / trocar destino ficam **desabilitados** com CTA.

Sem `provider_cache` especial, sem tabela nova, sem migration — reusa Discovery +
Itinerary. A única diferença é não expor o seletor e não devolver alternativas.

---

## 6. O que a UI mostra (Passo 8 — web)

Telas hi-fi de referência no canvas de design (página **"Plano gratuito"**,
artifact `0086b95c`): `FreeAutonomousInput` · `FreePlan` · `FreeChatLimit` ·
`FreeTripUsedWall` · `FreeTripLimitWall`.

- **Antes de gerar (`FreeAutonomousInput`):** aviso curto no fluxo autônomo — "Sua
  viagem gratuita: um plano fechado, escolhido pelo Farol. Para comparar destinos e
  conversar à vontade, cada viagem custa R$ 39." (voz assessor calmo, sem euforia).
- **Plano gerado (`FreePlan`):** roteiro fechado + trilho de chat com contador
  "3 mensagens grátis nesta viagem". Botões de regenerar / trocar destino desabilitados
  com CTA "disponível nas viagens pagas".
- **Chat esgotado (`FreeChatLimit`):** após a 3ª resposta — "Você usou suas 3 mensagens
  desta viagem. Continue ajustando à vontade nas viagens pagas." + CTA de compra.
- **Viagem grátis já usada (`FreeTripUsedWall`):** ao pedir o roteiro de uma 2ª viagem
  ou abrir o modo assessor → "Você já usou sua geração gratuita" + dois cards
  (Avulsa R$ 39 · Pacote R$ 89).
- **Limite de viagens (`FreeTripLimitWall`):** ao criar a 6ª trip → "Você chegou a 5
  viagens salvas. Compre um crédito para começar mais uma."
- **Header (logado):** selo "Plano grátis" enquanto `free_autonomous_used_at == null`;
  depois "0 créditos" com link para comprar; com saldo, "X créditos".

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
`canCreateTrip` (nº de trips < 5 vs = 5, com/sem saldo), `canUseAssessorMode`
(saldo 0 vs ≥1), `freeChatRemaining` (0/1/2/3 msgs; trip paga → Infinity),
`canChat` / `canRegenerate` (trip com/sem `unlocked_at`).

**Integração (Postgres real)**
- 1º `generate` autônomo conclui → `free_autonomous_used_at` setado.
- 2º `generate` → 402 `free_trip_used`.
- Job falho **não** seta o flag; retry funciona.
- Comprar crédito **não** zera o flag; com crédito, o modo assessor abre.
- Criar a 6ª trip sem crédito → 402 `trip_limit_reached`; com crédito → passa.
- Chat na trip grátis: 3 mensagens do usuário passam; a 4ª → 402 `free_chat_exhausted`.
- Modo autônomo **pago** consome 1 crédito (mesmo caminho do assessor).

**E2E — API**
- Fluxo grátis ponta a ponta: entrada mínima → plano fechado → `free_autonomous_used_at`
  setado → 3 mensagens de chat OK → 4ª → 402 → 2ª geração barrada.

**E2E — Web (Passo 8):** onboarding grátis → plano → 3 mensagens → parede de chat →
parede "já usou" com os dois cards.

**Mutação:** ≥ 90 no pacote tocado.

---

## 9. Decisões de produto (travadas 2026-08-31)

1. **Chat no grátis:** **3 mensagens** do usuário por viagem gratuita, depois trava.
2. **Viagens no grátis:** **até 5 trips criáveis** por conta; só **1** gera roteiro de graça.
3. **Alternativas de destino no grátis:** **não mostrar** — nem lista, nem texto. É um plano fechado.
4. **Comprar crédito não reativa** a geração gratuita — o grátis é único.
5. **Modo autônomo pago consome 1 crédito**, igual ao assessor. Diferença do pago:
   chat ilimitado + troca de destino por conversa.

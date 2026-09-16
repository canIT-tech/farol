# Pagamento Stripe — testes de borda e correções (2026-09-16)

Complemento da spec `2026-09-15-pagamento-stripe-design.md`. Registra o que foi
testado depois do merge do PR #19 (sandbox "farol sandbox", conta BR) e o que
ficou para corrigir. Regra: **produção não tem espaço para erro** — tudo que
falhou vira item aqui e é implementado logo em seguida, com teste.

## 1. Resultado dos testes

### Produção (`https://farol-ekk3.onrender.com`, sem login)

| Caso | Esperado | Resultado |
|---|---|---|
| `GET /api/health` | 200 | ✅ |
| `GET /api/payments/me` sem token | 401 | ✅ |
| `POST /api/payments/checkout` sem token | 401 | ✅ |
| `POST /api/payments/webhook` assinatura inválida | 400, nada gravado | ✅ |
| `/terms`, `/privacy`, `/credits` | 200 | ✅ |

### Local, Postgres real + provider fake (`apps/api/test/credits-edge.e2e-spec.ts`, 11 casos)

| Caso | Resultado |
|---|---|
| 2 `chooseDestination` simultâneos na mesma viagem → debita 1 | ✅ |
| saldo 1, 2 viagens simultâneas → uma 202, outra 402, saldo 0 | ✅ |
| reescolher viagem já destravada não cobra | ✅ |
| 2 webhooks `paid` concorrentes (ids diferentes, mesma session) → credita 1 | ✅ |
| `expired` depois de `paid` não regride | ✅ |
| `paid` depois de `expired` não credita | ✅ |
| `refunded` antes de `paid` → o `paid` seguinte credita (documentado; a Stripe não emite nessa ordem) | ✅ |
| estorno com crédito já gasto → saldo para em 0 | ✅ |
| `refunded` duplicado → desconta 1 vez | ✅ |
| webhook de session desconhecida → 200, no-op | ✅ |
| outro usuário não destrava viagem alheia | ✅ |

### Sandbox Stripe, ponta a ponta com usuário logado

Pendente de acesso (ver §3). Casos a rodar:

1. 1ª viagem grátis (202) → 2ª 402.
2. `checkout` single → cartão `4242` → `checkout.session.completed` → saldo 1 → 2ª viagem gera.
3. `checkout` pack3 → **Pix** ("Simulate scan") → `completed` com `unpaid` (no-op) → `async_payment_succeeded` → saldo 3.
4. Pix expirado → `async_payment_failed` → pedido `expired`, saldo intacto.
5. Cartão recusado (`4000 0000 0000 0002`) → pedido segue `pending`, saldo intacto.
6. 3DS (`4000 0025 0000 3155`) → autentica → credita.
7. Cancelar no Checkout → `/payment/cancelled`; expirar a session pela API → `expired`.
8. Estorno **total** no painel → `charge.refunded` → desconta.
9. Estorno **parcial** no painel → comportamento atual: desconta tudo (item 2.2).
10. Reenvio de evento pelo painel → replay 200, sem duplicar.

## 2. Correções a implementar (ordem)

### 2.1 Config da conta Stripe — URL dos Termos (bloqueia o checkout)

`checkout.sessions.create` com `consent_collection.terms_of_service = "required"`
responde `400 You cannot collect consent to your terms of service unless a URL is
set in the Stripe Dashboard`. **Hoje o checkout em produção falha com 500.**
Ação (painel, não código): Settings → Public details → Terms of service URL =
`https://farol-ekk3.onrender.com/terms` e Privacy policy URL = `/privacy`. Vale
para o sandbox agora e para a conta live no lançamento. Registrar em
`docs/SETUP.md` §7.5 como pré-requisito.

Defesa em código: `createCheckout` deve traduzir esse erro para
`PaymentNotConfiguredError` (503 com mensagem clara) em vez de 500 genérico,
para o front mostrar "pagamento indisponível" e o log acusar a causa.

### 2.2 Estorno parcial revoga todos os créditos

`charge.refunded` dispara também em estorno parcial. `normalizeStripeEvent`
trata qualquer um como total. Correção: só emitir `refunded` quando
`charge.refunded === true` (estorno integral); parcial → `ignored` + log.
Estorno parcial de crédito é decisão manual do painel, sem efeito no saldo.
Teste unitário no `stripe.provider.spec.ts`.

### 2.3 `safeReturnTo` aceita `/\evil.com`

Browser normaliza `\` para `/`, virando `//evil.com` (open redirect pós-checkout).
Correção: rejeitar qualquer valor que contenha `\` ou não case com
`^/[A-Za-z0-9/_\-?=&.%]*$`. Teste em `return-to.spec.ts`.

### 2.4 Modo autônomo perde a viagem no 402

`apps/web/src/app/auto/page.tsx` redireciona para `creditsRoute("/trips")`;
deveria ser `creditsRoute(\`/trips/${trip.id}/discovery\`)` para voltar onde
parou depois de comprar. Teste no spec da página.

### 2.5 Descartado após verificação

- "Dois `chooseDestination` debitam 2" (revisão Gemini): **não reproduziu** —
  o teste de concorrência debita 1. Mantido como teste de regressão.
- "`refunded` antes de `paid` deixa crédito indevido": a Stripe só emite
  `charge.refunded` depois do pagamento existir; estorno é ação manual
  posterior. Documentado, sem correção.

## 3. Bloqueio de acesso para o teste ponta a ponta

Não há service_role do Supabase no Doppler (correto: nenhum código lê), o token
de management não tem privilégio para revelar chaves, e o signup por senha exige
confirmação de e-mail (rate limit de envio atingido). Caminho: confirmar o
usuário de teste no SQL editor do Supabase e rodar o fluxo com senha. Sem
mudança de código.

# Stripe — ativação da conta live isTech (checklist)

Uma conta Stripe = uma empresa. A isTech é a conta; Farol e os próximos apps
são **produtos** dentro dela (cada app com seu webhook e seu sufixo de fatura).
Sandboxes são cópias de teste penduradas na conta — nada feito nelas afeta a
live. Só a live recebe dinheiro, e ela só existe depois do KYC do CNPJ.

Regra de segurança que vale para tudo abaixo: **nenhuma chave passa pelo chat**.
Chave nasce no painel → vai para o Doppler (`doppler secrets set … --silent`,
valor no prompt) → o Claude espelha no Render por MCP. Em produção só entra
chave **restrita** (`rk_live_`), nunca a `sk_live_`.

## 1. O que só o Rafael faz (painel, KYC)

| # | Onde | O quê |
|---|---|---|
| 1.1 | dashboard.stripe.com → conta live isTech → **Ativar** | CNPJ, razão social, endereço, CNAE/descrição ("software de planejamento de viagens, cobrança por roteiro"), site, representante legal (CPF, data de nascimento, endereço), conta bancária PJ (agência/conta) |
| 1.2 | Settings → Team and security | **2FA com passkey** no seu login. Ninguém mais com senha compartilhada; convidar por e-mail com papel mínimo |
| 1.3 | Settings → Business → Public details | Nome público `isTech`, site, e-mail de suporte, telefone; **Terms of service URL** e **Privacy policy URL** do produto (hoje `https://farol-ekk3.onrender.com/terms` e `/privacy`; trocar para `farolviagens.com` quando o domínio entrar) |
| 1.4 | Settings → Business → Public details | **Statement descriptor** = `ISTECH` (prefixo curto ≤ 10; o app põe o sufixo `FAROL` → `ISTECH* FAROL`, 13 chars) |
| 1.5 | Settings → Payments → Payment methods | Ligar **Pix**, **Boleto** e cartão (Pix precisa da conta ativada) |
| 1.6 | Settings → Payouts | Frequência de repasse (padrão diário; semanal reduz ruído no extrato) |
| 1.7 | Settings → Communication preferences | E-mail para **pagamento bem-sucedido** e **disputa** ligados |
| 1.8 | Settings → Customer emails | **Recibo** automático ligado (o Farol não manda recibo próprio) |
| 1.9 | Settings → Checkout | Ligar "Display agreement to legal terms" e "Contact information" |
| 1.10 | Developers → API keys → **Create restricted key** | Nome `farol-api`, permissões: Checkout Sessions **write**, Products **read**, Prices **read**, Webhook Endpoints **none**, resto **none**. Copiar → `doppler secrets set STRIPE_SECRET_KEY --project farol --config prd --silent` |
| 1.11 | Developers → Webhooks → Add endpoint | URL `https://<dominio>/api/payments/webhook`, eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`. Signing secret → `doppler secrets set STRIPE_WEBHOOK_SECRET … prd --silent` |
| 1.12 | Radar → Rules | Manter as regras padrão; ligar "Block if CVC fails" e "Block if postal code fails" quando o cartão trouxer |

Alternativa para 1.11: dar ao Claude uma chave restrita **temporária** com
Webhook Endpoints write + Products write, ele cria endpoint e produtos por
script (como fez no sandbox) e você **revoga a chave** em seguida.

## 2. O que o Claude faz depois (sem chave nova no chat)

1. Cria produtos `Farol · 1 viagem` (R$ 39) e `Farol · 3 viagens` (R$ 89) na live
   e grava `STRIPE_PRICE_SINGLE/PACK3` no Doppler `prd` (precisa da chave
   temporária do item 1.11, ou você cria no painel e cola os `price_…`, que não
   são segredo).
2. Espelha `STRIPE_*` + `PAYMENT_PROVIDER=stripe` no Render por MCP.
3. Primeira compra real com cartão próprio de R$ 39 → confere webhook, crédito e
   recibo → **estorna** no painel → confere que o crédito volta a 0.
4. Só então anuncia.

## 3. Fora da Stripe, mas obrigatório para vender no Brasil

- **Nota fiscal (NFS-e)**: a Stripe não emite. Cada venda precisa de NFS-e da
  isTech (município de Chapecó). Manual no início; automatizar depois
  (webhook `paid` → emissor via API, ex. NFE.io/eNotas).
- **Termos e Privacidade** revisados por advogado antes da live (hoje "em revisão
  jurídica" no rodapé).
- **Direito de arrependimento (CDC art. 49)**: 7 dias para serviço digital não
  consumido. Os Termos §6 já dizem que crédito **não usado** é estornado — o
  fluxo é o estorno no painel → `charge.refunded` → saldo desconta.
- **Domínio**: `farolviagens.com` antes de anunciar — o descriptor, os recibos e
  os Termos apontam para ele.

## 4. Sandbox atual (já feito, 2026-09-16)

"farol sandbox" (`acct_1UG6KR…`, BR): produtos, prices, webhook com os 5
eventos, Pix/boleto ligados; chaves e ids no Doppler `prd`/`dev` e no Render.
Falta só a URL dos Termos nos Public details **da sandbox** para o checkout
de teste funcionar.

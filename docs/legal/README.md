# Documentos legais — Farol

- **Status:** rascunho para revisão jurídica, **publicado** em `/terms` e `/privacy` desde
  2026-09-15 (Passo 11 — a Stripe exige as páginas para ativar a conta e registrar o aceite no
  checkout). Revisão de advogado(a) segue pendente; o banner no topo de cada texto diz isso.
- **Data:** 2026-08-31
- **Dono (produto):** felippe

## Arquivos

| Documento | Arquivo | Onde publica |
|---|---|---|
| Termos de Uso | `termos-de-uso.md` | `apps/web` rota `/terms` |
| Política de Privacidade (inclui Cookies) | `politica-de-privacidade.md` | `apps/web` rota `/privacy` |

Ambos linkados no rodapé da landing e no formulário da waitlist (checkbox de aceite +
link), e no fluxo de cadastro/checkout do app.

## Placeholders a preencher antes de publicar

Todo `[ENTRE COLCHETES]` nos dois documentos é fato que só o time tem. Lista:

- **Razão social + CNPJ** do operador (canIT — confirmar nome jurídico completo).
- **Endereço** da sede.
- **E-mail do encarregado (DPO)** pela proteção de dados — ex.: `privacidade@farolviagens.com`.
- **E-mail de contato / suporte** — ex.: `contato@farolviagens.com`.
- **Comarca do foro** (cidade/UF da sede).
- **Provedor de e-mail transacional** (Resend / SendGrid / Amazon SES / …) — entra na lista de operadores.
- ~~Ferramenta de analytics~~ — **fora do MVP** (decisão 2026-08-31: instrumentação de produto é pós-milhas). Quando entrar, será **PostHog** e volta à lista de operadores + seção de cookies.
- **Data de vigência** de cada documento (data da publicação).
- ~~Gateway de pagamento~~ — **Stripe**, decidido no Passo 11 (spec `docs/superpowers/specs/2026-09-15-pagamento-stripe-design.md`). Operadora da conta = isTech.

## Pendência de conformidade — script do Travelpayouts

O script de afiliado do Travelpayouts (`tp-em.com/NTY4OTQz.js`) hoje está no `<head>`
do `apps/web` **sem gate de consentimento** (`apps/web/src/app/layout.tsx`). Para LGPD,
um script de monetização/rastreamento não essencial deve:

- **Opção A:** só carregar depois do opt-in no banner de cookies (recomendado). Exige o
  banner implementado (Passo 8 / UI web) antes do lançamento.
- **Opção B:** o jurídico classifica como legítimo interesse e dispensa consentimento
  prévio — decisão a registrar.

Enquanto não resolvido, a Política de Privacidade descreve o script como cookie de
**afiliado/monetização (não essencial)** e diz que ele passará a respeitar o banner.

## Fora de escopo destes rascunhos

- Contrato B2B (agências) — v2.
- DPA (Data Processing Agreement) com cada operador — assinar os padrões de Supabase /
  Anthropic / Stripe / Google / Travelpayouts na configuração das contas de produção.
- Registro do documento em cartório / RIPD (Relatório de Impacto) — avaliar com jurídico
  se o volume/sensibilidade exige.

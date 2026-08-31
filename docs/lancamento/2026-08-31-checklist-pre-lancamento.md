# Farol — Checklist de pré-lançamento

> **O que é:** o que falta entre "planos prontos" e "produto no ar e vendendo".
> Complementa `PRD.md`, o design técnico, o débito técnico
> (`docs/superpowers/plans/2026-08-29-correcao-debito-tecnico.md`) e o plano de
> go-to-market (`docs/marketing/2026-08-31-plano-go-to-market.md`).
> **Living doc.** Atualizar status a cada avanço.

Legenda: 🔴 não começou · 🟡 em andamento · ✅ feito · ⬜ opcional/depois

---

## Visão geral

| # | Frente | Dono(s) | Status | Bloqueia |
|---|---|---|---|---|
| 1 | Terminar de codar e testar | rafinha | 🔴 | lançamento do produto |
| 2 | Domínio — **`farolviagens.com`** definido, falta registrar + DNS | rafinha · xandinho · felippe | 🟡 | tudo que é público (site, e-mail, DNS) |
| 3 | Cadastro na Stripe | felippe *(a confirmar)* | 🔴 | pagamento no código · abertura |
| 4 | Termos de uso + Privacidade | felippe | 🔴 | captar e-mail com tranquilidade · pagamento |
| 5 | LLM — setup da API | rafinha | 🔴 | descoberta, roteiro, chat |
| 6 | Infra de produção (hosting + DB) | rafinha · felippe *(a definir)* | 🔴 | produto no ar |
| 7 | GTM operacional | felippe | 🟡 | — (roda em paralelo, não depende do produto) |

---

## 1. Terminar de codar e testar — **rafinha**

Backlog de implementação (ver `CLAUDE.md` › "Próximos passos"). Ordem = dependência.

- **Passo 6 — Google Places + enrich** ✅ concluído (rafinha, 2026-08-31).
- **Passo 10 — Migração do provider voo/hotel: Amadeus → Travelpayouts** 🟢. Amadeus
  descontinuou o Self-Service. Trocar `Amadeus*Provider` por `Travelpayouts*Provider`
  (sem OAuth, `marker` de afiliado no deep-link), regravar fixtures, envs.
  **Spec pronta:** `docs/negocio/2026-08-31-spec-migracao-travelpayouts.md`. Depende do Passo 5.
- **Passo 7 — Chat IA** 🟢. `ChatModule`, loop de tool-calling, as 9 tools → serviços,
  `chat_messages`. Depende de 4 + 5 + 6. **Maior bloco de código restante.**
- **Passo 8 — UI web + E2E**. Ligar as telas do `apps/web` ao `apps/api` + fluxo
  Playwright login → onboarding → descoberta → destino → roteiro. Depende do 7.
- **Passo 11 — Pagamento:** `PaymentModule` + webhook Stripe. **Spec pronta:**
  `docs/negocio/2026-08-31-spec-pagamento.md` — modelo de crédito (avulso = 1, pacote = 3,
  sem expiração), conta primeiro, gate no `itinerary.generate`, reembolso CDC.
  Depende do item 3 (cadastro Stripe).
- **Débito técnico** (`docs/superpowers/plans/2026-08-29-correcao-debito-tecnico.md`):
  pelo menos A2 (envs no CI) e C3 (warning de eslint) antes de abrir PRs de produção.
  Placeholders da pipeline fecham junto do Passo 6.

**Definition of Done de cada passo:** cobertura 100% + unidade/integração/e2e/mutação
verdes (baseline de testes do projeto). PR que não bate os gates não entra.

---

## 2. Domínio — **rafinha · xandinho · felippe**

- ✅ **Decidido: `farolviagens.com`** (2026-08-31). Escolhido sobre `faroltravel.com.br`:
  "viagens" é o termo que o brasileiro busca (melhor CTR/recall), `.com` não tem teto
  geográfico, e a marca fica coerente em português.
- **Registrar** `farolviagens.com` + os defensivos `farolviagens.com.br` e `faroltravel.com.br`.
- Apontar DNS para o hosting (item 6) e ligar HTTPS.
- Como é gTLD (`.com`): configurar geo-targeting p/ Brasil no Search Console + `hreflang` pt-BR.
- Configurar e-mail transacional em `@farolviagens.com` (SPF/DKIM/DMARC) para não cair em spam.
- Trocar as URLs de trabalho (`NEXT_PUBLIC_API_URL` e refs no PRD) por `farolviagens.com`.
  Telas de marca/B2B (`docs/design/**`) já atualizadas — falta reseed + republish dos canvases.

---

## 3. Cadastro na Stripe — **felippe** *(a confirmar dono)*

- Criar conta Stripe com os dados da **canIT** (CNPJ, conta bancária, representante).
  Stripe opera no Brasil; se o onboarding emperrar, alternativas: **Mercado Pago** ou
  **Pagar.me**. Decidir por uma — não manter duas.
- **Começar já:** ativação/verificação de conta pode levar dias.
- Configurar:
  - Produtos e preços: **Viagem R$ 39** (pagamento único) · **Pacote 3 viagens R$ 89**.
  - Chaves de **test** e **live** + **webhook secret**.
  - Modo de checkout: **Stripe Checkout hospedado** (mais rápido de integrar) para o MVP.
  - Página de recibo, política de reembolso (casar com os Termos, item 4).
- Saída: chaves e IDs de preço entram no `.env` de produção e destravam o
  `PaymentModule` (item 1).

---

## 4. Termos de uso + Política de privacidade — **felippe**

### 4.1 Termos de uso
- **Escopo honesto** (casa com a voz da marca): o Farol **não reserva** voo/hotel, **não
  garante preço**, o roteiro é **sugestão** — o usuário confere antes de comprar.
- Conteúdo gerado por IA pode conter erros; responsabilidade do usuário na conferência.
- Pagamento por viagem, regras de reembolso/estorno/cancelamento.
- Propriedade do conteúdo do roteiro, licença de uso.
- Lei aplicável e foro (Brasil).

### 4.2 Política de privacidade / LGPD
- **Já é necessária agora** — a waitlist coleta e-mail.
- Dados coletados: e-mail, perfil de gosto, dados de viagem, pagamento (via Stripe).
- Terceiros com quem os dados trafegam: **Travelpayouts**, **Google Places**, **Anthropic
  (Claude)**, **Stripe**, provedor de e-mail, analytics.
- Base legal, direitos do titular, opt-out, contato do encarregado.
- Consentimento explícito no formulário da waitlist + link para a política.

### 4.3 Cookies / consentimento ⬜
- Com **Plausible** (sem cookie): aviso mínimo.
- Com **GA4 / Meta Pixel**: banner de consentimento obrigatório.

---

## 5. LLM — setup da API — **rafinha**

- Configurar acesso à **API da Anthropic** (Claude): conta, créditos iniciais / tier de
  desenvolvimento, chave `ANTHROPIC_API_KEY` para **dev** e para **produção** (chaves
  separadas).
- Confirmar o roteamento de modelo já no código: `LLM_MODEL_CAPABLE` (sonnet) /
  `LLM_MODEL_CHEAP` (haiku) e revisar `MODEL_PRICING` (hoje são valores aproximados —
  débito técnico C1).
- **Definir o teto de custo de LLM por roteiro** (`LLM_ROUTE_BUDGET_USD`) — pendência
  aberta do PRD; sem número, não dá para prever margem.
- Em teste, LLM sempre via fake determinístico (já é regra do projeto) — a chave real só
  em dev/prod.

---

## 6. Infra de produção — **rafinha · felippe** *(a definir)*

- **Hosting:** container para `apps/api` + `apps/worker`, deploy do `apps/web` (Next),
  Postgres gerenciado. Hospedagem é agnóstica (container + Postgres + env).
- **Supabase de produção:** projeto **separado do dev** (Auth + Postgres + Storage).
- Rodar `db:migrate` (0000–0006+) + `db:seed` (catálogo) no banco de produção.
- Preencher **todas** as envs de produção (base em `.env.example`): `DATABASE_URL`,
  `SUPABASE_*`, `ANTHROPIC_API_KEY`, `TRAVELPAYOUTS_TOKEN` / `TRAVELPAYOUTS_MARKER`,
  `GOOGLE_PLACES_KEY`, `JOBS_SCHEMA`, `*_DEEPLINK_TEMPLATE`, `NEXT_PUBLIC_API_URL`,
  chaves da Stripe.
- **CI:** fechar o débito A2 (adicionar as envs novas ao `ci.yml`) antes dos PRs de prod.
- DNS do domínio (item 2) apontando para o hosting; HTTPS.

---

## 7. GTM operacional — **felippe** (roda em paralelo, não espera o produto)

Backlog do plano de go-to-market (`docs/marketing/2026-08-31-plano-go-to-market.md` §14):

1. Criar a **Sala do Farol** (WhatsApp + Telegram) + regras; convidar a waitlist.
2. Montar **perfil do Instagram** (bio, destaques, 6 posts).
3. Instrumentar **UTM + PostHog + Pixel** na landing.
4. **9 criativos** para o primeiro teste de Meta Ads.
5. Ligar **Meta Ads pré-lançamento** (R$ 40–80/dia).
6. Configurar a **newsletter "Para onde ir em [mês]"**.
7. Listar **20 comunidades de terceiros**.
8. Rascunhar **10 páginas de roteiro** para SEO.
9. Definir a mecânica de **referral** com produto.
10. Fechar as **metas (H)** do plano.

---

## Caminho crítico sugerido

```
Domínio ─┬─► DNS + e-mail transacional ─► Infra de produção ─► Produto no ar
         │
Termos + Privacidade ──────────────────────────────► libera captar e-mail e vender
         │
Stripe (cadastro) ──► PaymentModule no código ─────► checkout funcionando
         │
LLM API (dev+prod) ──► fecha Passos 6/7/8 ─────────► produto completo
         │
GTM (Sala do Farol, IG, Ads) ─────────────────────► roda desde já, em paralelo
```

**Ordem prática:**
1. **Domínio** e **Termos + Privacidade** — começam hoje, destravam o resto.
2. **Stripe** e **LLM API** — cadastros que demoram; abrir já.
3. **Infra de produção** + **CI (débito A2)**.
4. **Código:** Passo 6 → 7 → 8 + `PaymentModule`.
5. **GTM** em paralelo o tempo todo.

## Riscos

- **Stripe onboarding BR** pode levar dias — não deixar para o fim.
- **`farolviagens.com`** ainda não registrado — registrar antes de comunicar o nome publicamente.
- **Passo 7 (chat)** é o maior bloco de código restante e depende de 5 + 6.
- **Teto de custo de LLM** ainda indefinido — sem ele, a margem por viagem é chute.

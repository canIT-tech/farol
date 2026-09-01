# Farol — Plano de Go-to-Market (comunidade, conteúdo e mídia paga)

> **Status:** rascunho de trabalho — fase pré-lançamento (waitlist no ar).
> **Dono:** felippebutland / canIT.
> **Como usar:** todo número aqui é **hipótese a validar**, marcado com `(H)`. Ajustar
> conforme os primeiros dados reais entrarem. Revisar a cada fase.

---

## 1. Contexto e o que muda no marketing

Farol é **pagamento por viagem**, não assinatura (R$ 39 a viagem · R$ 89 pacote de 3 ·
grátis com 1 destino e sem chat). Isso muda o funil:

- **Não existe** "trial de 14 dias → converte pra assinatura". O **plano grátis é o topo
  do funil**: serve para a pessoa sentir o produto com uma viagem simples.
- O jogo é: **atrair → cadastro no grátis → primeira viagem paga → recompra**.
- Hoje não há produto aberto. A fase atual é **construir audiência e lista de espera**
  com comunidade + conteúdo, para ter demanda no dia da abertura.

**Cunha de posicionamento:** "não sei para onde ir" + "odeio planejar". O gatilho
emocional é as *trinta abas abertas*. O diferencial de marca é a **honestidade** (o
Farol não reserva por você, o roteiro é ponto de partida) num mercado de influencer
eufórico e de "planejadores de IA" genéricos.

**Voz em todo material:** assessor calmo e confiável — específico, honesto sobre
incerteza, assume o trabalho, sem euforia, sem ponto de exclamação. Ver
`docs/design/brand/Voice.dc.html`.

---

## 2. Objetivos e métricas

> Definições operacionais, funil de servidor e tabela de eventos a instrumentar:
> `docs/negocio/2026-08-31-plano-de-metricas.md`. As metas aqui são a leitura de GTM;
> as definições de "ativado", "roteiro pago", "recompra" moram naquele doc.

### North Star

| Fase | North Star | Meta `(H)` |
|---|---|---|
| Pré-lançamento (M0–M2) | Cadastros qualificados na waitlist | 1.000 e-mails · 150 na comunidade |
| Lançamento (M2–M4) | Viagens **pagas** concluídas / mês | 60/mês ao fim do M4 |
| Crescimento (M4+) | Viagens pagas / mês + taxa de recompra 90d | 300/mês · recompra ≥ 20% |

### Funil e KPIs de apoio

```
Impressão → Clique → Cadastro grátis → Viagem paga → Recompra
```

- **CTR de anúncio** ≥ 1,2% `(H)` (Meta) · ≥ 4% `(H)` (Search)
- **Custo por cadastro (CPL)** ≤ R$ 4 `(H)` no pré-lançamento
- **Cadastro grátis → viagem paga** ≥ 8% `(H)` nos primeiros 30 dias
- **CAC de viagem paga** ≤ R$ 25 `(H)` → payback na 1ª compra (ticket R$ 39)
- **LTV** = R$ 39 × (1 + recompra) → com recompra 20% ≈ R$ 47 `(H)`
- **Ativação:** % de cadastros que geram ≥ 1 roteiro na 1ª semana ≥ 40% `(H)`

Instrumentar tudo com UTM padronizado (seção 10) e eventos de funil no PostHog.

---

## 3. Público-alvo

**Segmento primário — "o indeciso sobrecarregado"**
25–45 anos, classe média urbana BR, viaja 1–3× por ano, tem verba mas não tempo nem
paciência para pesquisar. Já usa Skyscanner / Booking / Google Flights. Sente culpa das
abas abertas. Compra conveniência.

**Segmento secundário — "o casal/família planejando as férias"**
Decisão conjunta, orçamento mais firme, quer um roteiro pronto para ajustar. Alta
sazonalidade (jan, jul, feriados longos).

**Segmento terciário (v1+) — "o caçador de milhas"**
Espera o motor de milhas. Não é foco de aquisição agora; é lista de espera segmentada.

**Não é público agora:** mochileiro hardcore (quer planejar), viajante de luxo com
agência, corporativo.

**Onde essa gente está:** Instagram e YouTube salvos de viagem, grupos de Facebook e
WhatsApp de viagem, Reddit (r/turismo, r/viagem), buscas do Google em alta intenção,
newsletters de passagem barata (Melhores Destinos, Passagens Imperdíveis).

---

## 4. Posicionamento e mensagens

**Frase-âncora:** *Você não precisa saber para onde ir.*

**Promessa:** do "não sei" a um roteiro pronto, ajustável por conversa — em minutos, não
em trinta abas.

**Provas:** a demo interativa da landing (gosto → destino), o roteiro dia a dia, o "por
quê" de cada destino (clima, custo, tempo de voo).

**Mensagens por ângulo (para criativos e conteúdo):**

| Ângulo | Gancho | Para quem |
|---|---|---|
| Dor do planejamento | "31 abas, 3 planilhas, e a viagem continua no 'quem sabe'." | Primário |
| Descoberta por gosto | "Diz 3 coisas que você curte. Recebe um destino com o porquê." | Primário |
| Honestidade | "Não reserva por você. Leva até a página de compra e explica a escolha." | Todos (diferencial) |
| Ajuste por conversa | "'Menos museu, mais praia' e o roteiro se refaz na hora." | Secundário |
| Preço | "Sem assinatura. Você paga a viagem que montar — R$ 39." | Todos |
| Autônomo | "Sem tempo? Datas + orçamento + 3 gostos → um plano fechado." | Secundário |

**O que NÃO dizer:** "a IA que planeja tudo por você", "viagem perfeita", "melhores
destinos de 2026", nada com "revolucionário". Não prometer reserva, não prometer preço
garantido.

---

## 5. Comunidade

Duas frentes: **comunidade própria** (dá para controlar, vira loop de feedback e base de
beta) e **comunidades de terceiros** (alcance, mas com regras).

### 5.1 Comunidade própria — "Sala do Farol"

**Plataforma:** **Comunidade do WhatsApp** (padrão BR, abertura de mensagem alta) +
espelho no **Telegram** para quem prefere. Discord só se o público early puxar pra lá.

**Propósito:**
1. Loop de feedback com quem entrou na waitlist (o que falta, o que confunde).
2. Recrutar e organizar **beta testers**.
3. Conteúdo com troca real: "para onde ir em [mês]", "alguém já foi pra [destino]?",
   revisão de roteiros que o Farol montou.
4. Primeiros defensores da marca → sementes de indicação.

**Rituais (cadência):**

| Ritual | Frequência | Formato |
|---|---|---|
| "Para onde ir em [mês]" | Mensal | Post com 3 destinos + enquete |
| Bastidores do produto | Quinzenal | Print / vídeo curto do que mudou |
| Roteiro em revisão | Semanal | Farol monta um roteiro real, comunidade critica |
| Pergunta aberta | Semanal | 1 pergunta de descoberta ("praia calma ou agitada?") |
| Chamada de beta | Por onda | Convite + vagas limitadas |

**Regras da sala:** sem spam de agência, sem link de afiliado de terceiros, feedback
direto é bem-vindo. Moderação: 1 pessoa do time + 2 voluntários early.

**Meta `(H)`:** 150 membros no fim do M2, 30% ativos/semana.

### 5.2 Comunidades de terceiros

**Onde:** r/turismo, r/viagem, r/brasil (com parcimônia), grupos de Facebook
("Mochileiros", "Viajantes pelo Mundo", "Mulheres que Viajam Sozinhas", grupos regionais),
grupos de WhatsApp de viagem, Quora BR.

**Como (regra de ouro — contribuir, não spammar):**
- Responder perguntas reais de "para onde ir" com uma resposta útil de verdade; mencionar
  o Farol só quando fizer sentido e com transparência ("trabalho num projeto que faz
  isso, link no perfil").
- Ratio 9:1 — nove contribuições sem link para cada uma com link.
- Ler as regras de cada grupo. Vários proíbem autopromoção; nesses, só valor + perfil
  bem montado.
- AMA / post de bastidores quando a comunidade permitir ("estou construindo um assessor
  de viagem, perguntem o que quiserem").

**Meta `(H)`:** 300 cliques/mês vindos de comunidade orgânica no M2.

---

## 6. Canais orgânicos

### 6.1 Instagram (canal principal)

**Bio:** o que é + para quem + link (waitlist agora, produto depois). Destaques: "Como
funciona", "Para onde ir", "Bastidores".

**Pilares de conteúdo (rodízio):**

| Pilar | % | Exemplos |
|---|---|---|
| Descoberta / "para onde ir" | 35% | "3 destinos para quem curte X e tem R$ Y" · carrossel com o porquê |
| Dor do planejamento | 20% | Reels "POV: 30 abas abertas" · "o roteiro que a planilha não te dá" |
| Produto em ação | 20% | Screen-recording da demo · antes/depois de um ajuste no chat |
| Bastidores / honestidade | 15% | "o que o Farol ainda NÃO faz" · decisões de produto |
| Prova social / comunidade | 10% | roteiros da Sala do Farol · depoimentos de beta |

**Formatos:** Reels (alcance), carrossel (salvamento — sinaliza intenção), Stories
(comunidade + enquetes de descoberta que alimentam o produto).

**Cadência inicial `(H)`:** 3 Reels + 2 carrosséis + Stories diários por semana.
Reavaliar em 4 semanas pelo alcance/salvamento, não por likes.

**Calendário das 4 primeiras semanas (esqueleto):**

| Semana | Reels | Carrossel | Stories |
|---|---|---|---|
| 1 | "30 abas" · "diz 3 gostos" | "Para onde ir em [mês+1]" | Enquete: praia calma vs agitada |
| 2 | Demo gosto→destino · "o que NÃO faz" | "Roteiro de 7 dias em [destino]" | Bastidor: por que sem assinatura |
| 3 | Ajuste no chat (antes/depois) · POV planejamento | "Quanto custa 7 dias em 4 destinos" | Caixinha: "sua maior dúvida ao planejar" |
| 4 | Depoimento beta · "como o Farol escolhe" | "Melhor época para 5 destinos BR" | Chamada de beta |

### 6.2 Outros orgânicos

- **TikTok / Reels cross-post:** mesmo material curto. Ângulo "escolhi 3 gostos e o app
  me mandou pra [destino]".
- **YouTube (médio prazo):** roteiros em vídeo ("7 dias em Cartagena — roteiro completo").
  Evergreen, casa com SEO.
- **SEO / blog (o jogo longo):** páginas de roteiro e de "melhor época para [destino]".
  Cada roteiro que o Farol gera bem = candidato a página. Começar com 10 destinos do
  catálogo. Meta: tráfego orgânico de cauda longa a partir do M4.
- **Pinterest:** destinos + roteiros como pins. Baixo esforço, público de planejamento.
- **Newsletter própria:** "Para onde ir em [mês]" — 1×/mês, começa com a waitlist.
  Ferramenta na seção 10.
- **Parcerias com newsletters de viagem:** patrocínio pontual em Melhores Destinos /
  similares quando houver produto e verba.

---

## 7. Mídia paga (ADS)

### 7.1 Princípios

- Não escalar antes de o CAC fechar. Pré-lançamento = **aprender**, não crescer.
- 1 variável por teste. Nomear tudo com UTM (seção 10).
- Orçamento em **faixas**, subindo só quando o CPL/CAC validar.

### 7.2 Meta Ads (Instagram + Facebook) — canal principal

**Fase pré-lançamento (objetivo: cadastro na waitlist)**
- Campanha: *Leads* (formulário nativo) **e** *Tráfego* para a landing — testar as duas.
- Públicos:
  - Interesses: viagem, Skyscanner, Booking.com, Airbnb, Hotéis.com, 123milhas, Lonely
    Planet, "planejamento de viagem", cruzado com "compras online".
  - Retarget: quem visitou a landing e não cadastrou (pixel).
  - Lookalike 1–3% dos cadastros (quando houver ≥ 100).
- Criativos (3–5 por conjunto, 1 ângulo cada — ver seção 4):
  - Reel da demo gosto→destino.
  - Estático "30 abas".
  - Vídeo "o que o Farol NÃO faz" (ângulo honestidade).
- Orçamento `(H)`: **R$ 40–80/dia** dividido em 2 conjuntos, 2 semanas de aprendizado.
- Meta: CPL ≤ R$ 4 · CTR ≥ 1,2%.

**Fase lançamento (objetivo: cadastro grátis → primeira viagem paga)**
- Campanha de *Conversão* otimizada para o evento "cadastro grátis".
- Retarget agressivo: visitou → cadastrou mas não gerou roteiro → gerou roteiro mas não
  comprou. Criativo específico por etapa.
- Orçamento `(H)`: **R$ 100–200/dia**, escala 20%/semana enquanto CAC ≤ R$ 25.

### 7.3 Google Ads

**Search (alta intenção — ligar já no lançamento):**
- Grupos de palavra-chave:
  - "para onde viajar" / "não sei para onde viajar" / "destino de viagem [mês]"
  - "roteiro [cidade] [n] dias" / "o que fazer em [cidade]"
  - "planejador de viagem" / "montar roteiro de viagem" / "assistente de viagem"
  - "melhor época para [destino]"
- Negativar: "emprego", "curso", "agência", "trabalhar com".
- Landing dedicada por grupo quando valer a pena (ex.: /roteiro).
- Orçamento `(H)`: **R$ 30–60/dia**, CPC alvo ≤ R$ 1,50.

**Performance Max / Demand Gen:** só depois de ter dados de conversão e criativos que
já performaram no orgânico e no Meta. Não abrir no dia 1.

### 7.4 TikTok Ads

Testar depois do Meta validar. Mesmo criativo de Reels, público amplo, orçamento
pequeno (**R$ 20–40/dia `(H)`**). Bom para topo de funil barato se o criativo "nativo"
funcionar.

### 7.5 Criativos — pipeline

- Produzir em lote: 6–8 peças por sprint quinzenal, 1 ângulo cada.
- Sempre 1 versão "feia/nativa" (celular, sem produção) e 1 "caprichada".
- Legenda na voz do Farol, sem euforia.
- Matar criativo com CTR < 0,8% após R$ 50 gastos `(H)`.

---

## 8. Influenciadores e parcerias

- **Alvo:** micro creators de viagem BR (10k–100k), nicho de "viagem real / sem luxo",
  casais, viagem-sozinha, bate-volta, road trip.
- **Modelo:** permuta + cupom/afiliado ("planejei com o Farol, link na bio, código X dá
  a primeira viagem"). Pagamento fixo só para quem já converteu bem.
- **Formato:** o creator usa o Farol de verdade para a própria viagem e mostra o
  processo (descoberta → roteiro → ajuste). Autenticidade > roteiro publicitário.
- **Meta `(H)`:** 5 parcerias no trimestre de lançamento, medir por cupom.
- **Parcerias não-influencer:** newsletters de passagem barata, podcasts de viagem,
  comunidades de nômade digital, blogs de roteiro (guest post que casa com SEO).

---

## 9. Lançamento — sequência

1. **Waitlist (agora):** landing no ar. Foco: encher a lista e a Sala do Farol.
2. **Beta fechado (M2):** convite em ondas de 50–100 pessoas da waitlist, priorizando
   quem está ativo na comunidade. Objetivo: consertar ativação, não vender.
3. **Early access (M3):** abre para toda a waitlist. Liga o **referral**: "convide e
   ganhe 1 viagem" (o convidado também ganha). Rastrear por link único.
4. **Abertura pública (M4):** liga Search + escala Meta. Push de PR leve (Product Hunt
   BR, posts em comunidades de produto, newsletters de tech BR).
5. **Pós-abertura:** ciclo mensal de "Para onde ir em [mês]" alimentando orgânico +
   pago + newsletter.

**Gatilho de cada fase:** só avança quando a métrica da fase anterior bate a meta `(H)`
(ex.: não abre público antes de ativação ≥ 40% no early access).

---

## 10. Retenção e recompra

O modelo por viagem vive de **recompra** e **sazonalidade**.

- **Fim do roteiro:** CTA "planeje a próxima" + salvar como rascunho.
- **E-mail pós-viagem (D+3 da data de volta estimada):** "como foi [destino]?" + convite
  para avaliar + gancho para a próxima.
- **Sazonalidade:** disparo 6–8 semanas antes de feriados longos e alta temporada
  (jan, jul, carnaval, semana santa, feriados de nov).
- **Newsletter mensal "Para onde ir em [mês]":** principal canal de recompra barata.
- **Programa de indicação permanente:** 1 viagem grátis por indicação que compra.
- **Reativação:** quem gerou roteiro e não comprou em 30d → sequência de 3 e-mails
  (lembrete do roteiro salvo → um destino novo pelo gosto dele → oferta do pacote).

---

## 11. Orçamento e cronograma

| Fase | Período `(H)` | Foco | ADS/mês `(H)` | Produção/ferramentas/mês `(H)` |
|---|---|---|---|---|
| Pré-lançamento | M0–M2 | Waitlist + comunidade + orgânico | R$ 1.500–2.500 | R$ 300–600 |
| Lançamento | M2–M4 | Beta → early access → abertura | R$ 3.000–6.000 | R$ 500–900 |
| Crescimento | M4+ | Escala do que validou | R$ 6.000+ (só se CAC ≤ R$ 25) | R$ 800+ |

Regra de corte: se no fim do M4 o CAC de viagem paga estiver acima de R$ 39 (ticket),
**parar de escalar** e voltar para orgânico + comunidade até o produto melhorar a
conversão.

---

## 12. Stack de ferramentas

| Função | Ferramenta sugerida `(H)` | Observação |
|---|---|---|
| Analytics de produto / funil | PostHog | eventos: cadastro, roteiro gerado, viagem paga, recompra |
| Analytics de site | Plausible ou GA4 | Plausible = leve e sem banner de cookie |
| E-mail + automação | Resend (transacional) + Loops ou Brevo (marketing) | waitlist, newsletter, sequências |
| Agendador social | Metricool ou Buffer | calendário + relatórios IG/TikTok |
| Pixel / conversões | Meta Pixel + CAPI · Google Tag | conversões server-side quando der |
| UTM / links | Planilha padrão + encurtador próprio | ver convenção abaixo |
| Comunidade | Comunidade do WhatsApp + Telegram | moderação com 1 do time + 2 voluntários |
| Referral | link único por usuário (feature de produto) | rastrear no PostHog |

**Convenção de UTM (obrigatória em todo link):**

```
utm_source   = instagram | meta_ads | google_ads | tiktok | newsletter | comunidade | creator
utm_medium   = organic | cpc | email | referral | bio
utm_campaign = prelancamento | beta | early_access | abertura | sazonal_<mes>
utm_content  = <slug-do-criativo-ou-post>
```

---

## 13. Riscos e o que não fazer

- **Prometer o que o produto não faz** (reserva, preço garantido, milhas antes da v1).
  Quebra a marca. Todo criativo passa pelo filtro da voz.
- **Comprar seguidores / engajamento.** Envenena o lookalike e a métrica.
- **Escalar ADS antes do CAC fechar.** Queima caixa de bootstrap.
- **Spam em comunidade.** Ban + reputação. Ratio 9:1, ler regras.
- **LGPD:** consentimento explícito no cadastro da waitlist, opt-out em todo e-mail,
  não vender base, não usar e-mail para fim diferente do informado.
- **Depender de um canal só.** Se 80% vier de Meta, um bloqueio de conta trava tudo —
  manter orgânico + comunidade + Search como base.
- **Clickbait de destino ("melhores lugares 2026").** Traz audiência errada e fere a voz.

---

## 14. Backlog priorizado — próximas 2–4 semanas

1. Criar a **Sala do Farol** (Comunidade do WhatsApp + Telegram) e as regras. Convidar a
   waitlist atual.
2. Montar **perfil do Instagram** (bio, 3 destaques, primeiros 6 posts prontos).
3. Instrumentar **UTM + PostHog + Pixel** na landing (eventos de funil).
4. Escrever **9 criativos** (3 ângulos × 3 formatos) para o primeiro teste de Meta Ads.
5. Ligar **Meta Ads pré-lançamento** (R$ 40–80/dia, 2 conjuntos, 2 semanas).
6. Definir e configurar a **newsletter "Para onde ir em [mês]"** (ferramenta + template).
7. Listar **20 comunidades de terceiros** (Reddit, Facebook, WhatsApp) + regras de cada.
8. Rascunhar as **10 primeiras páginas de roteiro** para SEO (a partir do catálogo).
9. Definir a mecânica de **referral** com o time de produto (link único, recompensa).
10. Fechar as **metas `(H)` desta doc** com números que o time topa perseguir.

---

## Ligações

- Modelo de custo e pricing: artifact "Custo do Farol"
  (`https://claude.ai/code/artifact/a93aaa41-decb-4557-85bc-079195ade808`) e
  `scratchpad/farol-cost-model.html`.
- Landing / waitlist: `apps/web` rota `/` (ver `CLAUDE.md` › "Landing / waitlist").
- Voz e marca: `docs/design/brand/Voice.dc.html`, `docs/design-system.md`.
- PRD (personas, monetização, fases): `PRD.md`.

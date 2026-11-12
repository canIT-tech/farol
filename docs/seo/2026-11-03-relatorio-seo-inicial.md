# Relatório de SEO — inicial (2026-11-03)

Alvo: `https://farol.butland.sbs/` (produção, atrás do Cloudflare).
Ferramenta: Lighthouse 12 local (Chrome headless), mais inspeção do HTML servido.
O PageSpeed Insights estava sem cota no dia.

## Notas Lighthouse

| Categoria | Mobile | Desktop |
|---|---|---|
| Performance | **68** | 99 |
| Acessibilidade | 95 | 95 |
| Boas práticas | 96 | 96 |
| SEO | **91** | **91** |

Métricas mobile: LCP 4,1 s · FCP 3,2 s · TBT 470 ms · CLS 0 · Speed Index 3,2 s.

## Achados

### Críticos (impedem ranquear)

| # | Problema | Evidência |
|---|---|---|
| C1 | **Sem `sitemap.xml`** | `/sitemap.xml` → 404 |
| C2 | **robots.txt sem `Sitemap:`** e com diretiva inválida (`Content-Signal`, injetada pelo Cloudflare). Lighthouse marca erro. | auditoria `robots-txt` |
| C3 | **Cloudflare bloqueia buscadores de IA e o Applebot**: `OAI-SearchBot` (busca do ChatGPT), `PerplexityBot`, `Claude-SearchBot`, `Applebot` (Siri/Spotlight/Safari), `Google-Extended`, etc. Quem pergunta "planejador de viagem" a uma IA nunca vê o Farol. | robots.txt "Cloudflare Managed content" |
| C4 | **Sem canonical, sem `metadataBase`, sem Open Graph / Twitter Card.** Link compartilhado no WhatsApp/Instagram sai sem imagem nem título. | `<head>` |
| C5 | **Sem dados estruturados (JSON-LD)**: nem `Organization`, `WebSite`, `SoftwareApplication`/oferta, nem `FAQPage`. | sem `application/ld+json` |
| C6 | **Palavra-chave ausente.** "planejador de viagem" não aparece em título, H1, description nem no texto. Título atual: "Farol — assessor de viagem". | HTML |
| C7 | **Uma única página indexável com conteúdo** (≈570 palavras). Nenhuma página para buscas de cauda longa ("roteiro em Lisboa", "quando ir a Bariloche"). | inventário de rotas |

### Altos

| # | Problema | Evidência |
|---|---|---|
| A1 | **Erro de hidratação React #418** em toda visita: o Cloudflare (Email Obfuscation) reescreve o e-mail do rodapé e o HTML deixa de bater com o React. O React re-renderiza a página inteira no cliente, o que piora TBT e LCP. | `errors-in-console` |
| A2 | **Fonte do Google bloqueia a renderização**: ~1,1 s no mobile. | `render-blocking-resources` |
| A3 | **Script Travelpayouts (`tp-em.com`) trava a main thread por 680 ms.** | `third-party-summary` |
| A4 | **Área logada indexável**: `/login`, `/trips`, `/onboarding`, `/credits`, `/payment/*` respondem 200 sem `noindex` e com o título e a descrição da home (conteúdo duplicado). | `curl` |
| A5 | **Mesma meta description em todas as páginas**, inclusive `/terms` e `/privacy`. | `curl` |

### Médios / baixos

| # | Problema |
|---|---|
| M1 | Sem `manifest.webmanifest`, sem `apple-touch-icon`, `/favicon.ico` → 404 |
| M2 | Contraste: terracota `#c25a38` sobre branco = 4,36 (mínimo 4,5); cinza `#9b9992` = 2,85 (rodapé, "Sem spam") |
| M3 | Ordem de títulos: `h4` direto depois de `h2` (Screens, Modes) |
| M4 | A home inteira é Client Component (`"use client"`): mais JS do que precisa (94 KiB de JS sem uso) |
| M5 | Sem verificação do Google Search Console / Bing Webmaster |
| M6 | O domínio de marca (`farolviagens.com`) não está registrado. O site roda num subdomínio de `butland.sbs`, que não tem autoridade e não sinaliza Brasil. |

## Expectativa honesta

A primeira página do Google para "viagens" ou "planejador de viagem" é disputada por
Decolar, Booking, TripAdvisor, Mundi, Wanderlog, Melhores Destinos e outros com
domínios de 10 a 20 anos. Código resolve a parte **técnica** (nota 100, indexação
correta, rich results, páginas de cauda longa). Ranquear em termo genérico depende do
que está fora do código:

1. domínio próprio (`farolviagens.com`), com redirect 301 deste subdomínio;
2. Search Console com o sitemap enviado;
3. backlinks (imprensa, blogs de viagem, diretórios de IA);
4. conteúdo publicado com regularidade, que hoje cresce a partir do catálogo de destinos.

O caminho realista: cauda longa primeiro ("roteiro de 5 dias em Lisboa", "quando ir para
Bariloche", "planejador de viagem com IA"), e o termo genérico vem com a autoridade.

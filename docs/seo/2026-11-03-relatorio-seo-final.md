# Relatório de SEO — final (2026-11-03)

Comparação com o [relatório inicial](./2026-11-03-relatorio-seo-inicial.md).
Medição "depois": Lighthouse 12, build de produção (`next build && next start`) local.
Produção só muda quando o PR entrar e o deploy rodar. Medir de novo em
`https://farol.butland.sbs/` depois do deploy.

## Notas Lighthouse

| Categoria | Antes (mobile / desktop) | Depois: home | Depois: `/destinations/lisboa` |
|---|---|---|---|
| Performance | 68 / 99 | **98 / 100** | **99 / 100** |
| Acessibilidade | 95 / 95 | **100 / 100** | **100 / 100** |
| Boas práticas | 96 / 96 | 100* | 100* |
| SEO | 91 / 91 | **100 / 100** | **100 / 100** |

\* 100 com o script da Travelpayouts bloqueado. No localhost ele roda num domínio não
verificado e gera erros de console (403, `config is not valid`) que derrubam a nota
para 79. Em produção, com o domínio verificado, esses erros não aparecem.

Métricas mobile da home: LCP 4,1 s → **2,4 s** · FCP 3,2 s → **0,8 s** · TBT 470 ms → **60 ms** · CLS 0 → 0.
JS inicial da home: 191 kB → **128 kB**.

## O que foi feito (por achado do relatório inicial)

| # | Achado | Status | Como |
|---|---|---|---|
| C1 | Sem sitemap | ✅ | `app/sitemap.ts`: home, `/destinations`, 23 guias, termos e privacidade |
| C2 | robots sem sitemap | ✅ código / ⚠️ painel | `app/robots.ts` com `Sitemap:`. A diretiva `Content-Signal` é injetada pelo Cloudflare e só sai pelo painel (ver pendências) |
| C3 | Cloudflare bloqueia buscadores de IA e Applebot | ⚠️ painel | Zona `butland.sbs`: `ai_search=block`, `ai_user=block`. Precisa de decisão (afeta todos os subdomínios) |
| C4 | Sem canonical / OG / Twitter | ✅ | `metadataBase`, canonical por página, OG + Twitter Card, imagem 1200×630 gerada (`opengraph-image.tsx`) |
| C5 | Sem JSON-LD | ✅ | `Organization`, `WebSite`, `WebApplication` com as 3 ofertas, `FAQPage`; nos guias, `TouristDestination` + `BreadcrumbList` + `FAQPage` |
| C6 | Palavra-chave ausente | ✅ | Título "Farol: planejador de viagem com IA e roteiro pronto"; H1 com "Planejador de viagem com IA"; descrição; FAQ que responde "O que é um planejador de viagem com IA?" |
| C7 | Uma página só | ✅ | `/destinations` + 23 guias estáticos ("Roteiro em Lisboa: quando ir e quanto custa"), gerados do CSV curado do catálogo; links internos entre destinos parecidos |
| A1 | Erro de hidratação #418 | ✅ | E-mail do rodapé em pedaços (`CompanyIdentification`): o Cloudflare não reescreve e o React para de refazer a página |
| A2 | Fonte bloqueando render | ✅ | `next/font` (fonte servida pelo próprio site, fallback ajustado) |
| A3 | Travelpayouts trava 680 ms | ✅ | Script carregado depois do `load`, em `requestIdleCallback`. A URL segue no HTML para a verificação do domínio |
| A4 | Área logada indexável | ✅ | `noindex` + título próprio em login, trips, onboarding, credits, auto, payment, rotas, status. Ficam rastreáveis, para o Google conseguir ler o noindex |
| A5 | Description repetida | ✅ | Descrição própria em termos, privacidade, destinos e cada guia |
| M1 | Manifest / ícones | ✅ | `manifest.webmanifest`, `apple-icon` PNG, `/favicon.ico` (rewrite para o PNG) |
| M2 | Contraste | ✅ | Terracota forte em texto pequeno e botões, cinza mais escuro, chip ativo da faixa escura com texto escuro. Animação de entrada sem opacidade |
| M3 | Ordem de títulos | ✅ | `h4` → `h3` nas demos |
| M4 | Home toda client-side | ✅ | Home virou Server Component; só demos, formulário e entrada do app hidratam. SDK do Supabase carregado sob demanda |
| M5 | Search Console / Bing | 🟡 pronto no código | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` e `NEXT_PUBLIC_BING_SITE_VERIFICATION` geram as meta tags |
| M6 | Domínio de marca | ⏳ fora do código | `NEXT_PUBLIC_SITE_URL` troca canonical, sitemap, OG e JSON-LD de uma vez |

Também: `X-Powered-By` removido; `theme-color`; `formatDetection` desligado.

## Testes

- Unidade: 464 passando, cobertura 100% (`lib/seo.ts`, `lib/destination-guides.ts`, `CompanyIdentification`).
- Mutação (Stryker) nos arquivos novos: **99,7%** (`seo.ts` 100%, `CompanyIdentification` 100%,
  `destination-guides.ts` 99,5%). O único sobrevivente é equivalente: sem o `.slice(1)`, o
  cabeçalho do CSV cai do mesmo jeito na validação numérica.
- E2E (Playwright): 53 passando, 17 novos em `e2e/seo.spec.ts`: meta, OG (inclusive nas páginas
  filhas), JSON-LD, robots, sitemap, manifest, ícones, guias, 404 de slug inexistente, noindex e
  ausência de erro de hidratação.

### Achados da revisão

- O `openGraph` de uma página substitui o da raiz inteiro (o Next não mescla). Os guias saíam
  sem `og:image`, `og:site_name` e `og:locale`. Corrigido com `pageOpenGraph()`.
- O spec que lê o CSV real usava caminho relativo fixo e quebrava no sandbox do Stryker.
  Isso derrubaria a mutação do CI. Agora ele sobe a árvore até achar o arquivo.

## O que falta (fora do código)

Em ordem de impacto para aparecer em buscas por "viagens" e "planejador de viagem":

1. **Liberar buscadores de IA no Cloudflare.** Em *AI Crawl Control*, `ai_search` e `ai_user`
   passam de `block` para `allow` (o treino pode seguir bloqueado). Sem isso, ChatGPT Search,
   Perplexity e Siri/Spotlight (Applebot) não citam o Farol. A mudança vale para a zona inteira.
2. **Google Search Console.** Verificar a propriedade (meta tag via env ou DNS), enviar
   `/sitemap.xml` e pedir indexação da home e de `/destinations`. Fazer o mesmo no Bing Webmaster,
   que também alimenta o ChatGPT.
3. **Registrar `farolviagens.com`**, apontar `NEXT_PUBLIC_SITE_URL` para ele e fazer 301 de
   `farol.butland.sbs`. Subdomínio de `.sbs` não acumula autoridade de marca.
4. **Backlinks e menções**: diretórios de ferramentas de IA, blogs e newsletters de viagem,
   Product Hunt, imprensa de startup.
5. **Conteúdo contínuo**: cada cidade nova no catálogo vira uma página. Expandir de 23 para
   ~200 (curadoria já documentada) multiplica as entradas de cauda longa.

## Expectativa

Tecnicamente o site está no teto: SEO 100, Core Web Vitals no verde, rich results válidos.
A primeira página para termos genéricos como "viagens" depende de autoridade de domínio,
que se constrói com os itens 1–5, não com código. Termos de cauda longa ("planejador de
viagem com IA", "roteiro em Bariloche quando ir") são alcançáveis em semanas depois da
indexação.

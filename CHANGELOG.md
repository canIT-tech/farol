# Changelog

Mudanças visíveis ao usuário. Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versão: [SemVer](https://semver.org/spec/v2.0.0.html). Os títulos em `Unreleased` decidem a
próxima versão: só Fixed/Security → patch, qualquer Added/Changed → minor, algo marcado
BREAKING → major. `bin/release` faz o corte; o processo está no skill `ship`.

## [Unreleased]

### Added
- Guias públicos de destino em `/destinations` e `/destinations/<cidade>` (23 cidades do
  catálogo): melhor época, custo estimado de 7 dias saindo de SP e destinos parecidos.
- Seção "Perguntas frequentes" e vitrine de destinos na landing.
- Imagem de compartilhamento (WhatsApp, redes sociais), ícone para iPhone, `manifest`,
  `sitemap.xml` e `robots.txt` com sitemap.

### Changed
- Landing com título e descrição de busca para "planejador de viagem com IA", dados
  estruturados (organização, app com preços, FAQ, trilha) e canonical.
- Landing mais rápida no celular: fontes servidas pelo próprio site, script de afiliado
  carregado depois da página, SDK de login fora do carregamento inicial (JS inicial de
  191 kB para 128 kB).
- Área logada (`/login`, `/trips`, `/onboarding`, `/credits`, `/auto`, `/payment`) fora
  do índice do Google, com título próprio na aba.
- Contraste de textos e botões ajustado ao mínimo WCAG AA.
- Termos e Privacidade publicados com os dados da isTech (IGNAULIN SOLUCOES TECNOLOGICAS
  LTDA, CNPJ 49.181.911/0001-51), `contato@ignaulin.com` e `privacidade@ignaulin.com`;
  provedor de IA corrigido para Groq; uso e compra só para maiores de 18.
- Arrependimento conforme o CDC art. 49: reembolso integral em até 7 dias, sem a condição
  de "crédito não usado" (cláusula nula pelo art. 51). Rodapé da landing e da página de
  compra identifica o fornecedor (Decreto 7.962/2013, art. 2º).

### Fixed
- Googlebot não era mais barrado: o bloqueio de robôs de treino de IA saiu da borda do
  Cloudflare (pegava o próprio Googlebot) e virou regra do `robots.txt`.
- Erro de hidratação em toda visita à landing: o e-mail do rodapé, reescrito pelo
  Cloudflare, forçava o React a refazer a página inteira no navegador.
- Queda de conexão com o banco não derruba mais o app: o erro é logado e a fila reconecta.
- App deixa de dormir no plano free (ping a cada 10 min), sem a espera de ~1 min na
  primeira visita, e o banco não pausa mais por inatividade.

## [0.1.1] - 2026-09-23

### Security
- NestJS 10 → 11 (Express 5, multer 2.4, file-type 21.3), drizzle-orm 0.33 → 0.45.3 e
  qs/postcss/ajv em versões corrigidas: zera as CVEs moderadas e altas das dependências
  de produção. O CI passa a barrar dependência de produção com CVE moderada ou pior.

## [0.1.0] - 2026-09-23

### Added
- MVP do Farol no ar: perfil de gosto, descoberta de destino, roteiro dia a dia gerado em
  background, ajuste por chat, voos (Google Flights com fallback Travelpayouts), hotéis
  (LiteAPI, sandbox), lugares (Google Places), busca por rota, landing com waitlist.
- Pagamento por viagem com Stripe (sandbox): 1º roteiro grátis, créditos avulso e pacote,
  Pix/boleto, Termos e Privacidade publicados (#19).
- Monitoramento de erro com Sentry e `GET /api/health` com o commit em execução; a rota
  responde 503 quando o banco cai, para o Render tirar a instância do tráfego.

# Changelog

Mudanças visíveis ao usuário. Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versão: [SemVer](https://semver.org/spec/v2.0.0.html). Os títulos em `Unreleased` decidem a
próxima versão: só Fixed/Security → patch, qualquer Added/Changed → minor, algo marcado
BREAKING → major. `bin/release` faz o corte; o processo está no skill `ship`.

## [Unreleased]

## [0.1.0] - 2026-09-23

### Added
- MVP do Farol no ar: perfil de gosto, descoberta de destino, roteiro dia a dia gerado em
  background, ajuste por chat, voos (Google Flights com fallback Travelpayouts), hotéis
  (LiteAPI, sandbox), lugares (Google Places), busca por rota, landing com waitlist.
- Pagamento por viagem com Stripe (sandbox): 1º roteiro grátis, créditos avulso e pacote,
  Pix/boleto, Termos e Privacidade publicados (#19).
- Monitoramento de erro com Sentry e `GET /api/health` com o commit em execução; a rota
  responde 503 quando o banco cai, para o Render tirar a instância do tráfego.

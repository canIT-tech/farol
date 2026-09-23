import * as Sentry from "@sentry/nestjs";

// Monitoramento de erro. Precisa rodar antes de qualquer outro import no
// main.ts, senão a instrumentação não enxerga os módulos já carregados.
// Sem SENTRY_DSN (desenvolvimento, CI, testes) o init é no-op: nada sai da
// máquina. `release` é o commit que o Render injeta, para o Sentry apontar o
// deploy que introduziu um erro.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.RENDER_GIT_COMMIT,
  environment: process.env.SENTRY_ENVIRONMENT ?? "production",
  tracesSampleRate: 0
});

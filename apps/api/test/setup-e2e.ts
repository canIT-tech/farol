// Os specs abrem o banco por DATABASE_URL_TEST; o AppModule lê DATABASE_URL.
// Sem alinhar os dois, a api escreve num banco e o teste confere no outro.
// Checagem por valor, não `??`: definida e vazia é o caso que quebra.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

// Default de env para os e2e que sobem o AppModule inteiro.
// auth.e2e-spec.ts sobrescreve SUPABASE_JWKS_URL com a URL do JWKS fake antes de compilar o módulo.
process.env.SUPABASE_JWKS_URL ??= "https://example.com/auth/v1/.well-known/jwks.json";
process.env.JOBS_SCHEMA ??= "pgboss_e2e";
process.env.TRAVELPAYOUTS_TOKEN ??= "travelpayouts-e2e";
process.env.TRAVELPAYOUTS_MARKER ??= "farol-e2e";
process.env.LITEAPI_KEY ??= "sand_e2e";
process.env.GOOGLE_PLACES_KEY ??= "google-places-e2e";
process.env.PAYMENT_PROVIDER ??= "fake";

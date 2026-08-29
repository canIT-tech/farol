// Default de env para os e2e que sobem o AppModule inteiro.
// auth.e2e-spec.ts sobrescreve SUPABASE_JWKS_URL com a URL do JWKS fake antes de compilar o módulo.
process.env.SUPABASE_JWKS_URL ??= "https://example.com/auth/v1/.well-known/jwks.json";

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Porta própria e servidor próprio, sempre. A sessão falsa é gravada em
  // "sb-localhost-auth-token", chave derivada de NEXT_PUBLIC_SUPABASE_URL —
  // reaproveitar um `pnpm dev` apontado para o Supabase real muda essa chave e
  // todo teste com sessão cai no login.
  webServer: {
    command: "pnpm --filter @farol/web exec next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      NEXT_PUBLIC_API_URL: "http://localhost:3333/api"
    }
  },
  use: { baseURL: "http://localhost:3100" }
});

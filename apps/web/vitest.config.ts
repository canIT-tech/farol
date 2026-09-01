import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    coverage: {
      provider: "v8",
      // As páginas de src/app/** são cobertas pelo E2E do Playwright, não aqui.
      include: ["src/lib/**/*.ts", "src/hooks/**/*.ts", "src/hooks/**/*.tsx", "src/components/**/*.tsx", "src/providers/**/*.tsx"],
      // supabase.ts: wrapper de SDK do browser, coberto pelo e2e.
      exclude: ["src/**/*.spec.*", "src/lib/supabase.ts"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});

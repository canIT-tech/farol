import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      // supabase.ts: wrapper de SDK do browser, coberto pelo e2e (Task 6).
      exclude: ["src/**/*.spec.*", "src/lib/supabase.ts"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});

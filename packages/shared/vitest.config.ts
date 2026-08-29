import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // src/index.ts: barrel só de re-export. src/auth.ts: tipo puro (some no build).
      exclude: ["src/index.ts", "src/auth.ts", "src/**/*.spec.ts"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});

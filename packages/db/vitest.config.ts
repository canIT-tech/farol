import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // specs de @farol/db compartilham o mesmo Postgres; serializa para não
    // colidir (seed do catálogo vs. drop/migrate de outros specs).
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/migrate-cli.ts",
        "src/seed-catalog-cli.ts",
        "src/**/*.spec.ts"
      ],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});

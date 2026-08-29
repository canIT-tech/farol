// @ts-nocheck
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx", "test/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/index.ts",
        "src/**/*.stories.tsx",
        "src/**/*.spec.*",
        "src/tokens/tokens.css",
        "src/tokens/tokens.ts"
      ],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});

import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts", "src/instrument.ts", "src/worker-exports.ts", "src/**/*.module.ts", "src/**/*.spec.ts"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});

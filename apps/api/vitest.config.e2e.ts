import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: "node",
    include: ["test/**/*.e2e-spec.ts"],
    setupFiles: ["test/setup-e2e.ts"],
    coverage: { enabled: false }
  }
});

import { readFileSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";

describe("scaffold do monorepo", () => {
  it("declara pnpm workspaces para apps e packages", () => {
    const ws = readFileSync("pnpm-workspace.yaml", "utf8");
    expect(ws).toContain("apps/*");
    expect(ws).toContain("packages/*");
  });

  it("fixa o packageManager como pnpm e Node 22", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.packageManager).toMatch(/^pnpm@/);
    expect(pkg.engines.node).toContain("22");
    expect(readFileSync(".nvmrc", "utf8").trim()).toBe("22");
  });

  it("expõe os scripts de pipeline na raiz", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    for (const s of ["build", "dev", "test", "test:e2e", "test:mutation", "lint"]) {
      expect(pkg.scripts[s]).toBeDefined();
    }
  });

  it("mapeia os aliases @farol/* no tsconfig base", () => {
    const ts = JSON.parse(readFileSync("tsconfig.base.json", "utf8"));
    expect(ts.compilerOptions.paths["@farol/shared"]).toEqual(["packages/shared/src"]);
    expect(ts.compilerOptions.paths["@farol/db"]).toEqual(["packages/db/src"]);
  });

  it("nao versiona .env", () => {
    const ig = readFileSync(".gitignore", "utf8");
    expect(ig).toMatch(/^\.env$/m);
    expect(existsSync(".env.example")).toBe(true);
  });
});

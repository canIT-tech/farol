import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

/**
 * Guarda: nenhum valor cromático ou de espaçamento hard-coded nos CSS de
 * componente. Tudo via var(--token). tokens.css é a única exceção.
 */
const componentCss = globSync("src/**/*.css", { cwd: process.cwd() }).filter(
  (f) => !f.endsWith("tokens.css")
);

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const PX = /(?<![\w-])(\d+(?:\.\d+)?)px/g;
const PX_ALLOW = new Set(["0px", "1px", "1.5px", "2px"]);

describe("no-magic-values nos CSS de componente", () => {
  it("não usa cores hex fora de tokens.css", () => {
    const offenders: string[] = [];
    for (const file of componentCss) {
      const src = readFileSync(file, "utf8");
      const hits = src.match(HEX);
      if (hits) offenders.push(`${file}: ${hits.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("não usa px cru (exceto bordas finas) fora de tokens.css", () => {
    const offenders: string[] = [];
    for (const file of componentCss) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(PX)) {
        if (!PX_ALLOW.has(m[0])) offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

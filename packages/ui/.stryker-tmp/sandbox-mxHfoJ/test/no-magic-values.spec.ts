// @ts-nocheck
import { describe, it, expect } from "vitest";
import { readFileSync, globSync } from "node:fs";

/**
 * Guarda: nos CSS de componente, cor sempre via var(--token); e espaçamento /
 * raio / posicionamento nunca em px cru (via token). Dimensões (font-size,
 * width, height, border) podem usar px. tokens.css é a única exceção.
 */
const componentCss = globSync("src/**/*.css", { cwd: process.cwd() }).filter(
  (f) => !f.endsWith("tokens.css")
);

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
// props onde px cru é proibido — devem usar --space-* / --radius-*
const SPACING_PROPS =
  /(?:^|[;{])\s*(padding|padding-[a-z]+|margin|margin-[a-z]+|gap|row-gap|column-gap|border-radius|top|left|right|bottom|inset)\s*:\s*([^;}]+)/gi;
const RAW_PX = /(?<![\w-])\d+(?:\.\d+)?px/;

describe("no-magic-values nos CSS de componente", () => {
  it("não usa cores hex fora de tokens.css", () => {
    const offenders: string[] = [];
    for (const file of componentCss) {
      const hits = readFileSync(file, "utf8").match(HEX);
      if (hits) offenders.push(`${file}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("não usa px cru em espaçamento / raio / posição", () => {
    const offenders: string[] = [];
    for (const file of componentCss) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(SPACING_PROPS)) {
        if (RAW_PX.test(m[2])) offenders.push(`${file}: ${m[1]}: ${m[2].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

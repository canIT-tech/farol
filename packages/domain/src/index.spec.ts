import { describe, it, expect } from "vitest";
import { withinBudget } from "./index.js";

describe("withinBudget", () => {
  it("true quando o custo estimado cabe no orçamento", () => {
    expect(withinBudget(3000, 5000)).toBe(true);
  });

  it("false quando estoura", () => {
    expect(withinBudget(6000, 5000)).toBe(false);
  });

  it("true no limite exato", () => {
    expect(withinBudget(5000, 5000)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { INTEREST_OPTIONS } from "./onboarding";
import { FALLBACK_ICON, interestIcon } from "./interest-icons";

describe("interestIcon", () => {
  it("todo interesse do catálogo tem traço próprio", () => {
    for (const interest of INTEREST_OPTIONS) {
      expect(interestIcon(interest)).not.toBe(FALLBACK_ICON);
    }
  });

  it("cada traço é diferente do outro", () => {
    const paths = INTEREST_OPTIONS.map(interestIcon);
    expect(new Set(paths).size).toBe(INTEREST_OPTIONS.length);
  });

  it("interesse desconhecido cai no marcador neutro", () => {
    expect(interestIcon("paraquedismo")).toBe(FALLBACK_ICON);
  });
});

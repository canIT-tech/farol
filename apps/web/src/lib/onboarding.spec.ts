import { describe, it, expect } from "vitest";
import {
  INTEREST_OPTIONS,
  MIN_INTERESTS,
  EMPTY_ONBOARDING,
  toggleInterest,
  canSubmit,
  fromTasteProfile,
  toTasteProfileInput,
  type OnboardingState
} from "./onboarding";

describe("INTEREST_OPTIONS", () => {
  it("tem pelo menos MIN_INTERESTS opções não vazias", () => {
    expect(INTEREST_OPTIONS.length).toBeGreaterThanOrEqual(MIN_INTERESTS);
    expect(INTEREST_OPTIONS.every((s) => s.length > 0)).toBe(true);
    expect(INTEREST_OPTIONS).toContain("praia");
  });

  it("MIN_INTERESTS é 3", () => {
    expect(MIN_INTERESTS).toBe(3);
  });
});

describe("EMPTY_ONBOARDING", () => {
  it("começa sem interesses e sem seletores", () => {
    expect(EMPTY_ONBOARDING).toEqual({
      interests: [],
      pace: null,
      partyType: null,
      budgetBand: null
    });
  });
});

describe("toggleInterest", () => {
  it("adiciona um interesse ausente ao fim", () => {
    expect(toggleInterest(["praia"], "vinhos")).toEqual(["praia", "vinhos"]);
  });

  it("remove um interesse já presente", () => {
    expect(toggleInterest(["praia", "vinhos"], "praia")).toEqual(["vinhos"]);
  });

  it("não muta o array original", () => {
    const original = ["praia"];
    toggleInterest(original, "vinhos");
    expect(original).toEqual(["praia"]);
  });
});

describe("canSubmit", () => {
  const full: OnboardingState = {
    interests: ["praia", "gastronomia", "vinhos"],
    pace: "moderado",
    partyType: "casal",
    budgetBand: "medio"
  };

  it("true quando há 3+ interesses e os três seletores preenchidos", () => {
    expect(canSubmit(full)).toBe(true);
  });

  it("false com menos de 3 interesses", () => {
    expect(canSubmit({ ...full, interests: ["praia", "vinhos"] })).toBe(false);
  });

  it("false sem pace", () => {
    expect(canSubmit({ ...full, pace: null })).toBe(false);
  });

  it("false sem partyType", () => {
    expect(canSubmit({ ...full, partyType: null })).toBe(false);
  });

  it("false sem budgetBand", () => {
    expect(canSubmit({ ...full, budgetBand: null })).toBe(false);
  });

  it("false para o estado inicial vazio", () => {
    expect(canSubmit(EMPTY_ONBOARDING)).toBe(false);
  });
});

describe("toTasteProfileInput", () => {
  it("converte o estado em um TasteProfileInput válido", () => {
    const out = toTasteProfileInput({
      interests: ["praia", "gastronomia", "vinhos"],
      pace: "intenso",
      partyType: "amigos",
      budgetBand: "conforto"
    });
    expect(out).toEqual({
      interests: ["praia", "gastronomia", "vinhos"],
      pace: "intenso",
      partyType: "amigos",
      budgetBand: "conforto",
      constraints: {}
    });
  });

  it("lança quando o estado ainda está incompleto", () => {
    expect(() => toTasteProfileInput(EMPTY_ONBOARDING)).toThrow();
  });
});

describe("fromTasteProfile", () => {
  const saved = {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    interests: ["praia", "gastronomia", "vinhos"],
    pace: "intenso" as const,
    partyType: "amigos" as const,
    budgetBand: "conforto" as const,
    constraints: {},
    updatedAt: "2026-09-01T00:00:00.000Z"
  };

  it("traz as escolhas do perfil salvo", () => {
    expect(fromTasteProfile(saved)).toEqual({
      interests: ["praia", "gastronomia", "vinhos"],
      pace: "intenso",
      partyType: "amigos",
      budgetBand: "conforto"
    });
  });

  it("copia a lista de interesses, sem compartilhar a referência", () => {
    const state = fromTasteProfile(saved);
    state.interests.push("praia");
    expect(saved.interests).toHaveLength(3);
  });

  it("o estado devolvido já pode ser enviado de volta", () => {
    expect(canSubmit(fromTasteProfile(saved))).toBe(true);
  });
});

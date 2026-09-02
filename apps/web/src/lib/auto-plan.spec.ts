import { describe, it, expect } from "vitest";
import type { DestinationCandidate } from "@farol/shared";
import {
  EMPTY_AUTO_FORM,
  MAX_AUTO_INTERESTS,
  bestCandidate,
  canSubmitAuto,
  toAutoTasteProfile,
  toAutoTripInput,
  toggleAutoInterest,
  type AutoFormState
} from "./auto-plan";

const valido: AutoFormState = {
  originIata: "GRU",
  dateStart: "2026-09-10",
  dateEnd: "2026-09-17",
  budgetTotal: 12000,
  interests: ["praia", "gastronomia", "natureza"]
};

function candidate(iata: string, score: number): DestinationCandidate {
  return {
    iata,
    city: "Cidade",
    country: "Portugal",
    score,
    rationale: "Justificativa longa o suficiente para passar no schema de candidato.",
    estCost: { flight: 3000, lodgingPerNight: 200, dailyLocal: 100, currency: "BRL" },
    climate: { expectedC: 22, summary: "ameno", bestMonths: [9] },
    flightTimeHours: null
  };
}

describe("toggleAutoInterest", () => {
  it("adiciona e remove", () => {
    expect(toggleAutoInterest([], "praia")).toEqual(["praia"]);
    expect(toggleAutoInterest(["praia"], "praia")).toEqual([]);
  });

  it("passar do teto descarta o mais antigo", () => {
    const cheio = ["praia", "gastronomia", "natureza"];
    expect(toggleAutoInterest(cheio, "vinhos")).toEqual(["gastronomia", "natureza", "vinhos"]);
    expect(toggleAutoInterest(cheio, "vinhos")).toHaveLength(MAX_AUTO_INTERESTS);
  });
});

describe("toAutoTripInput", () => {
  it("monta a viagem com datas exatas", () => {
    const input = toAutoTripInput(valido)!;
    expect(input.dateStart).toBe("2026-09-10");
    expect(input.originIata).toBe("GRU");
    expect(input.targetMonth).toBeUndefined();
  });

  it("devolve null sem datas", () => {
    expect(toAutoTripInput({ ...valido, dateStart: "", dateEnd: "" })).toBeNull();
  });
});

describe("toAutoTasteProfile", () => {
  it("completa ritmo, companhia e faixa com o meio-termo", () => {
    const profile = toAutoTasteProfile(valido)!;
    expect(profile).toMatchObject({ pace: "moderado", partyType: "casal", budgetBand: "medio" });
    expect(profile.interests).toHaveLength(3);
  });

  it("devolve null com menos de três gostos", () => {
    expect(toAutoTasteProfile({ ...valido, interests: ["praia", "vinhos"] })).toBeNull();
  });
});

describe("canSubmitAuto", () => {
  it("libera o formulário completo", () => {
    expect(canSubmitAuto(valido)).toBe(true);
  });

  it("bloqueia o vazio", () => {
    expect(canSubmitAuto(EMPTY_AUTO_FORM)).toBe(false);
  });

  it("bloqueia com gostos de menos", () => {
    expect(canSubmitAuto({ ...valido, interests: ["praia"] })).toBe(false);
  });
});

describe("bestCandidate", () => {
  it("pega o de maior score", () => {
    expect(bestCandidate([candidate("LIS", 0.7), candidate("REC", 0.9)])!.iata).toBe("REC");
  });

  it("mantém o primeiro em caso de empate", () => {
    expect(bestCandidate([candidate("LIS", 0.8), candidate("REC", 0.8)])!.iata).toBe("LIS");
  });

  it("lista vazia devolve null", () => {
    expect(bestCandidate([])).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { FakeLlmService } from "./fake-llm.service";
import type { RankDestinationsInput } from "./llm.types";

const input: RankDestinationsInput = {
  shortlist: [
    { iata: "LIS", city: "Lisboa", country: "Portugal", tags: ["gastronomia"] },
    { iata: "OPO", city: "Porto", country: "Portugal", tags: ["vinhos"] },
    { iata: "MAD", city: "Madri", country: "Espanha", tags: ["cultura"] },
    { iata: "BCN", city: "Barcelona", country: "Espanha", tags: ["praia"] }
  ],
  profile: {
    interests: ["gastronomia", "vinhos", "cultura"],
    pace: "moderado",
    partyType: "casal",
    budgetBand: "medio",
    constraints: {}
  },
  trip: { originIata: "GRU", budgetTotal: 18000, currency: "BRL", party: { adults: 2 } }
};

describe("FakeLlmService", () => {
  it("devolve os 3 primeiros iata da shortlist com score decrescente", async () => {
    const ranking = await new FakeLlmService().rankDestinations(input);
    expect(ranking.map((r) => r.iata)).toEqual(["LIS", "OPO", "MAD"]);
    expect(ranking.map((r) => r.score)).toEqual([0.9, 0.8, 0.7]);
    expect(ranking.every((r) => r.rationale.length >= 10)).toBe(true);
  });

  it("todo iata devolvido está na shortlist", async () => {
    const ranking = await new FakeLlmService().rankDestinations(input);
    const allowed = new Set(input.shortlist.map((s) => s.iata));
    expect(ranking.every((r) => allowed.has(r.iata))).toBe(true);
  });
});

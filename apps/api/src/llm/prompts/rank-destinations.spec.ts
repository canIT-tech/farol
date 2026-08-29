import { describe, it, expect } from "vitest";
import { RANK_SYSTEM, buildRankUserPrompt } from "./rank-destinations";
import type { RankDestinationsInput } from "../llm.types";

const input: RankDestinationsInput = {
  shortlist: [
    { iata: "LIS", city: "Lisboa", country: "Portugal", tags: ["gastronomia", "história"] },
    { iata: "OPO", city: "Porto", country: "Portugal", tags: ["vinhos"] }
  ],
  profile: {
    interests: ["gastronomia", "história", "vinhos"],
    pace: "moderado",
    partyType: "casal",
    budgetBand: "medio",
    constraints: {}
  },
  trip: { originIata: "GRU", budgetTotal: 18000, currency: "BRL", party: { adults: 2 } }
};

describe("RANK_SYSTEM", () => {
  it("instrui a escolher da lista e responder só JSON", () => {
    expect(RANK_SYSTEM).toMatch(/3 a 5/);
    expect(RANK_SYSTEM).toMatch(/JSON/);
    expect(RANK_SYSTEM.toLowerCase()).toContain("nunca invente");
  });
});

describe("buildRankUserPrompt", () => {
  it("inclui origem, orçamento, perfil, interesses e cada destino da shortlist", () => {
    const prompt = buildRankUserPrompt(input);
    expect(prompt).toContain("Origem: GRU");
    expect(prompt).toContain("18000 BRL");
    expect(prompt).toContain("ritmo moderado");
    expect(prompt).toContain("gastronomia, história, vinhos");
    expect(prompt).toContain("LIS Lisboa/Portugal [gastronomia, história]");
    expect(prompt).toContain("OPO Porto/Portugal [vinhos]");
  });

  it("não menciona erro anterior quando não há", () => {
    expect(buildRankUserPrompt(input)).not.toContain("rejeitada");
  });

  it("acrescenta o erro anterior quando informado", () => {
    const prompt = buildRankUserPrompt(input, "iata fora da shortlist: XXX");
    expect(prompt).toContain("rejeitada: iata fora da shortlist: XXX");
  });

  it("mostra 'não informado' quando o orçamento é nulo", () => {
    const prompt = buildRankUserPrompt({ ...input, trip: { ...input.trip, budgetTotal: null } });
    expect(prompt).toContain("Orçamento total: não informado BRL");
  });
});

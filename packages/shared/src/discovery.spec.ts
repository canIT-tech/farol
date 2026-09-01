import { describe, it, expect } from "vitest";
import {
  destinationCandidateSchema,
  llmRankingItemSchema,
  llmRankingSchema
} from "./discovery.js";

const candidate = {
  iata: "LIS",
  city: "Lisboa",
  country: "Portugal",
  score: 0.82,
  rationale: "Combina gastronomia, história e ritmo tranquilo dentro do orçamento.",
  estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
  climate: { expectedC: 24, summary: "ameno e seco", bestMonths: [5, 6, 9, 10] },
  flightTimeHours: 9.5
};

describe("destinationCandidateSchema", () => {
  it("aceita um candidato completo", () => {
    expect(destinationCandidateSchema.parse(candidate).iata).toBe("LIS");
  });

  it("aceita clima sem temperatura — não há fonte no MVP", () => {
    const semTemp = { ...candidate, climate: { ...candidate.climate, expectedC: null } };
    expect(destinationCandidateSchema.parse(semTemp).climate.expectedC).toBeNull();
  });

  it("aceita flightTimeHours nulo", () => {
    expect(destinationCandidateSchema.parse({ ...candidate, flightTimeHours: null }).flightTimeHours).toBeNull();
  });

  it("rejeita score fora de 0..1", () => {
    expect(() => destinationCandidateSchema.parse({ ...candidate, score: 1.5 })).toThrow();
    expect(() => destinationCandidateSchema.parse({ ...candidate, score: -0.1 })).toThrow();
  });

  it("aceita os limites de score (0 e 1)", () => {
    expect(destinationCandidateSchema.parse({ ...candidate, score: 0 }).score).toBe(0);
    expect(destinationCandidateSchema.parse({ ...candidate, score: 1 }).score).toBe(1);
  });

  it("rejeita rationale curta demais ou longa demais", () => {
    expect(() => destinationCandidateSchema.parse({ ...candidate, rationale: "curto" })).toThrow();
    expect(() =>
      destinationCandidateSchema.parse({ ...candidate, rationale: "x".repeat(401) })
    ).toThrow();
  });

  it("rejeita iata sem 3 caracteres", () => {
    expect(() => destinationCandidateSchema.parse({ ...candidate, iata: "LI" })).toThrow();
  });

  it("rejeita custos negativos", () => {
    expect(() =>
      destinationCandidateSchema.parse({ ...candidate, estCost: { ...candidate.estCost, flight: -1 } })
    ).toThrow();
  });

  it("rejeita bestMonths fora de 1..12", () => {
    expect(() =>
      destinationCandidateSchema.parse({ ...candidate, climate: { ...candidate.climate, bestMonths: [0] } })
    ).toThrow();
    expect(() =>
      destinationCandidateSchema.parse({ ...candidate, climate: { ...candidate.climate, bestMonths: [13] } })
    ).toThrow();
  });
});

describe("llmRankingSchema", () => {
  const item = { iata: "LIS", score: 0.9, rationale: "Justificativa longa o suficiente para passar." };

  it("aceita entre 3 e 5 itens", () => {
    expect(llmRankingSchema.parse([item, item, item])).toHaveLength(3);
    expect(llmRankingSchema.parse([item, item, item, item, item])).toHaveLength(5);
  });

  it("rejeita menos de 3 itens", () => {
    expect(() => llmRankingSchema.parse([item, item])).toThrow();
  });

  it("rejeita mais de 5 itens", () => {
    expect(() => llmRankingSchema.parse([item, item, item, item, item, item])).toThrow();
  });

  it("item: rejeita score 1.5 e rationale de 3 chars", () => {
    expect(() => llmRankingItemSchema.parse({ ...item, score: 1.5 })).toThrow();
    expect(() => llmRankingItemSchema.parse({ ...item, rationale: "abc" })).toThrow();
  });

  it("item: rejeita iata com tamanho errado", () => {
    expect(() => llmRankingItemSchema.parse({ ...item, iata: "LISB" })).toThrow();
  });
});

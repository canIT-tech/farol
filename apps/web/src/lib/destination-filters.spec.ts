import { describe, it, expect } from "vitest";
import type { DestinationCandidate } from "@farol/shared";
import { arrangeDestinations, isDomestic, totalEstimate } from "./destination-filters";

function candidate(
  over: Partial<DestinationCandidate> & Pick<DestinationCandidate, "iata">
): DestinationCandidate {
  return {
    city: "Cidade",
    country: "Portugal",
    score: 0.5,
    rationale: "Justificativa longa o suficiente para passar no schema de candidato.",
    estCost: { flight: 3000, lodgingPerNight: 200, dailyLocal: 100, currency: "BRL" },
    climate: { expectedC: 22, summary: "ameno", bestMonths: [9] },
    flightTimeHours: null,
    ...over
  };
}

const lisboa = candidate({ iata: "LIS", score: 0.9 });
const recife = candidate({
  iata: "REC",
  country: "Brasil",
  score: 0.7,
  estCost: { flight: 900, lodgingPerNight: 150, dailyLocal: 80, currency: "BRL" }
});
const toquio = candidate({
  iata: "HND",
  country: "Japão",
  score: 0.8,
  estCost: { flight: 7000, lodgingPerNight: 400, dailyLocal: 200, currency: "BRL" }
});

describe("isDomestic", () => {
  it("reconhece destino no Brasil", () => {
    expect(isDomestic(recife)).toBe(true);
    expect(isDomestic(lisboa)).toBe(false);
  });
});

describe("totalEstimate", () => {
  it("soma voo, diária e gasto local", () => {
    expect(totalEstimate(recife)).toBe(1130);
  });
});

describe("arrangeDestinations", () => {
  const todos = [recife, lisboa, toquio];

  it("por padrão ordena por match, do maior para o menor", () => {
    const out = arrangeDestinations(todos, { domesticOnly: false, sort: "match" });
    expect(out.map((c) => c.iata)).toEqual(["LIS", "HND", "REC"]);
  });

  it("ordena por preço total quando pedido", () => {
    const out = arrangeDestinations(todos, { domesticOnly: false, sort: "price" });
    expect(out.map((c) => c.iata)).toEqual(["REC", "LIS", "HND"]);
  });

  it("filtra só nacionais", () => {
    const out = arrangeDestinations(todos, { domesticOnly: true, sort: "match" });
    expect(out.map((c) => c.iata)).toEqual(["REC"]);
  });

  it("não muta a lista recebida", () => {
    const entrada = [recife, lisboa];
    arrangeDestinations(entrada, { domesticOnly: false, sort: "price" });
    expect(entrada.map((c) => c.iata)).toEqual(["REC", "LIS"]);
  });

  it("lista vazia continua vazia", () => {
    expect(arrangeDestinations([], { domesticOnly: true, sort: "price" })).toEqual([]);
  });
});

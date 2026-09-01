import { describe, it, expect } from "vitest";
import type { TasteProfileInput, TripInput } from "@farol/shared";
import type { CatalogEntry } from "./types.js";
import {
  prefilterDestinations,
  nightsOf,
  targetMonthOf,
  affinityScore
} from "./prefilter.js";

function entry(over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    city: "Cidade",
    country: "País",
    iata: over.iata ?? "AAA",
    tags: ["praia", "gastronomia"],
    bestMonths: [9],
    avgFlightCostFromGru: 1000,
    avgLodgingNight: 200,
    avgDailyLocal: 100,
    region: "south-america",
    visaFreeBr: true,
    ...over
  };
}

const profile: TasteProfileInput = {
  interests: ["praia", "gastronomia", "natureza", "vinhos"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: {}
};

// 7 diárias, mês alvo 9, orçamento 20000 p/ 2 adultos => 10000 por pessoa.
const trip: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 20000,
  currency: "BRL",
  durationDays: 7,
  targetMonth: "2026-09"
};

describe("nightsOf", () => {
  it("usa durationDays quando presente", () => {
    expect(nightsOf(trip)).toBe(7);
  });

  it("calcula a diferença de datas quando não há durationDays", () => {
    expect(
      nightsOf({
        ...trip,
        durationDays: undefined,
        targetMonth: undefined,
        dateStart: "2026-09-10",
        dateEnd: "2026-09-17"
      })
    ).toBe(7);
  });
});

describe("targetMonthOf", () => {
  it("extrai o mês do targetMonth", () => {
    expect(targetMonthOf(trip)).toBe(9);
  });

  it("extrai o mês de dateStart quando não há targetMonth", () => {
    expect(
      targetMonthOf({
        ...trip,
        durationDays: undefined,
        targetMonth: undefined,
        dateStart: "2026-11-02",
        dateEnd: "2026-11-09"
      })
    ).toBe(11);
  });
});

describe("affinityScore", () => {
  it("é a fração dos interesses presente nas tags", () => {
    expect(affinityScore(["praia", "gastronomia", "natureza", "vinhos"], ["praia", "gastronomia"])).toBe(
      0.5
    );
  });

  it("é 1 quando todos os interesses estão nas tags", () => {
    expect(affinityScore(["praia"], ["praia", "x"])).toBe(1);
  });

  it("é 0 quando não há interesses", () => {
    expect(affinityScore([], ["praia"])).toBe(0);
  });

  it("é 0 quando nenhum interesse casa", () => {
    expect(affinityScore(["montanha"], ["praia"])).toBe(0);
  });
});

describe("prefilterDestinations", () => {
  it("mantém um destino dentro de todas as regras", () => {
    const out = prefilterDestinations({ catalog: [entry({ iata: "OKK" })], trip, profile });
    expect(out.map((e) => e.iata)).toEqual(["OKK"]);
  });

  it("descarta destino acima do orçamento por pessoa", () => {
    // 5000 + (2000+1500)*7 = 29500 > 10000
    const caro = entry({ iata: "CAR", avgFlightCostFromGru: 5000, avgLodgingNight: 2000, avgDailyLocal: 1500 });
    expect(prefilterDestinations({ catalog: [caro], trip, profile })).toEqual([]);
  });

  it("mantém destino exatamente no limite do orçamento", () => {
    // flight + (lodging+daily)*7 = 10000  => flight = 10000 - 300*7 = 7900
    const noLimite = entry({ iata: "LIM", avgFlightCostFromGru: 7900, avgLodgingNight: 200, avgDailyLocal: 100 });
    expect(prefilterDestinations({ catalog: [noLimite], trip, profile }).map((e) => e.iata)).toEqual([
      "LIM"
    ]);
  });

  it("estoura o orçamento só pela hospedagem (lodging * nights)", () => {
    // flight 0, daily 0, lodging 1500 * 7 = 10500 > 10000
    const e = entry({ iata: "LDG", avgFlightCostFromGru: 0, avgLodgingNight: 1500, avgDailyLocal: 0 });
    expect(prefilterDestinations({ catalog: [e], trip, profile })).toEqual([]);
  });

  it("estoura o orçamento só pelo gasto diário (dailyLocal * nights)", () => {
    const e = entry({ iata: "DLY", avgFlightCostFromGru: 0, avgLodgingNight: 0, avgDailyLocal: 1500 });
    expect(prefilterDestinations({ catalog: [e], trip, profile })).toEqual([]);
  });

  it("soma a passagem ao custo em vez de subtrair", () => {
    // flight 8000 + lodging 1000*7 = 15000 > 10000 (com subtração daria 1000 e passaria)
    const e = entry({ iata: "FLT", avgFlightCostFromGru: 8000, avgLodgingNight: 1000, avgDailyLocal: 0 });
    expect(prefilterDestinations({ catalog: [e], trip, profile })).toEqual([]);
  });

  it("descarta destino fora da melhor época", () => {
    const foraDeEpoca = entry({ iata: "EPC", bestMonths: [1, 2, 12] });
    expect(prefilterDestinations({ catalog: [foraDeEpoca], trip, profile })).toEqual([]);
  });

  it("descarta destino internacional sem visto para BR", () => {
    const semVisto = entry({ iata: "USA", region: "north-america", visaFreeBr: false });
    expect(prefilterDestinations({ catalog: [semVisto], trip, profile })).toEqual([]);
  });

  it("mantém destino nacional mesmo com visaFreeBr false", () => {
    const nacional = entry({ iata: "BRA", region: "brasil", visaFreeBr: false });
    expect(prefilterDestinations({ catalog: [nacional], trip, profile }).map((e) => e.iata)).toEqual([
      "BRA"
    ]);
  });

  it("respeita excludeIata", () => {
    const out = prefilterDestinations({
      catalog: [entry({ iata: "AAA" }), entry({ iata: "BBB" })],
      trip,
      profile,
      excludeIata: ["AAA"]
    });
    expect(out.map((e) => e.iata)).toEqual(["BBB"]);
  });

  it("ordena por aderência de tags (desc)", () => {
    const baixa = entry({ iata: "LOW", tags: ["compras"] });
    const alta = entry({ iata: "HIGH", tags: ["praia", "gastronomia", "natureza", "vinhos"] });
    const media = entry({ iata: "MID", tags: ["praia", "gastronomia"] });
    const out = prefilterDestinations({ catalog: [baixa, alta, media], trip, profile });
    expect(out.map((e) => e.iata)).toEqual(["HIGH", "MID", "LOW"]);
  });

  it("desempata por passagem mais barata (asc)", () => {
    const caro = entry({ iata: "EXP", tags: ["praia"], avgFlightCostFromGru: 2000 });
    const barato = entry({ iata: "CHP", tags: ["praia"], avgFlightCostFromGru: 800 });
    const out = prefilterDestinations({ catalog: [caro, barato], trip, profile });
    expect(out.map((e) => e.iata)).toEqual(["CHP", "EXP"]);
  });

  it("corta em limit", () => {
    const catalog = Array.from({ length: 5 }, (_, i) =>
      entry({ iata: `C${i}`, avgFlightCostFromGru: 100 + i })
    );
    const out = prefilterDestinations({ catalog, trip, profile, limit: 2 });
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.iata)).toEqual(["C0", "C1"]);
  });

  it("usa limite padrão de 20", () => {
    const catalog = Array.from({ length: 25 }, (_, i) =>
      entry({ iata: `D${String(i).padStart(2, "0")}`, avgFlightCostFromGru: 100 + i })
    );
    expect(prefilterDestinations({ catalog, trip, profile })).toHaveLength(20);
  });
});

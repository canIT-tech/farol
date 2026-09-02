import { describe, it, expect } from "vitest";
import { tripSchema, tripStateSchema } from "./trip-state.js";

const trip = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  status: "draft",
  title: null,
  originIata: "GRU",
  dateStart: null,
  dateEnd: null,
  durationDays: 7,
  targetMonth: "2026-09",
  party: { adults: 2, children: 0 },
  budgetTotal: 12000,
  currency: "BRL",
  chosenDestinationId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z"
};

const candidate = {
  iata: "LIS",
  city: "Lisboa",
  country: "Portugal",
  score: 0.82,
  rationale: "Justificativa longa o suficiente para passar no schema de candidato.",
  estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
  climate: { expectedC: 24, summary: "ameno", bestMonths: [9] },
  flightTimeHours: null
};

describe("tripSchema", () => {
  it("aceita uma viagem com duração + mês alvo", () => {
    expect(tripSchema.parse(trip).originIata).toBe("GRU");
  });

  it("aceita uma viagem com datas exatas", () => {
    const comDatas = { ...trip, dateStart: "2026-09-10", dateEnd: "2026-09-17", durationDays: null, targetMonth: null };
    expect(tripSchema.parse(comDatas).dateEnd).toBe("2026-09-17");
  });

  it("aceita budgetTotal nulo", () => {
    expect(tripSchema.parse({ ...trip, budgetTotal: null }).budgetTotal).toBeNull();
  });

  it("rejeita status fora do enum", () => {
    expect(() => tripSchema.parse({ ...trip, status: "cancelada" })).toThrow();
  });

  it("rejeita originIata que não tem 3 letras", () => {
    expect(() => tripSchema.parse({ ...trip, originIata: "GR" })).toThrow();
  });

  it("rejeita id que não é uuid", () => {
    expect(() => tripSchema.parse({ ...trip, id: "nao-e-uuid" })).toThrow();
  });

  it("rejeita party sem adults", () => {
    expect(() => tripSchema.parse({ ...trip, party: { children: 1 } })).toThrow();
  });
});

describe("tripStateSchema", () => {
  it("aceita estado sem destinos", () => {
    const parsed = tripStateSchema.parse({ ...trip, destinations: [], chosenDestination: null });
    expect(parsed.destinations).toEqual([]);
    expect(parsed.chosenDestination).toBeNull();
  });

  it("aceita estado com candidatos e um escolhido", () => {
    const parsed = tripStateSchema.parse({
      ...trip,
      destinations: [candidate],
      chosenDestination: candidate
    });
    expect(parsed.destinations).toHaveLength(1);
    expect(parsed.chosenDestination?.iata).toBe("LIS");
  });

  it("herda a validação de tripSchema", () => {
    expect(() =>
      tripStateSchema.parse({ ...trip, status: "cancelada", destinations: [], chosenDestination: null })
    ).toThrow();
  });

  it("rejeita destino fora do schema de candidato", () => {
    expect(() =>
      tripStateSchema.parse({
        ...trip,
        destinations: [{ ...candidate, iata: "LISBOA" }],
        chosenDestination: null
      })
    ).toThrow();
  });

  it("exige destinations e chosenDestination", () => {
    expect(() => tripStateSchema.parse(trip)).toThrow();
  });
});

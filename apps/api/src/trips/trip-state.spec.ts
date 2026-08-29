import { describe, it, expect } from "vitest";
import type { trips, tripDestinations } from "@farol/db";
import { toTrip, toDestinationCandidate, buildTripState } from "./trip-state";

type TripRow = typeof trips.$inferSelect;
type DestRow = typeof tripDestinations.$inferSelect;

const tripRow: TripRow = {
  id: "t-1",
  userId: "u-1",
  status: "draft",
  title: null,
  originIata: "GRU",
  dateStart: "2026-09-10",
  dateEnd: "2026-09-17",
  durationDays: null,
  targetMonth: null,
  party: { adults: 2, children: 1 },
  budgetTotal: "15000.00",
  currency: "BRL",
  chosenDestinationId: null,
  createdAt: new Date("2026-08-29T10:00:00.000Z"),
  updatedAt: new Date("2026-08-29T11:00:00.000Z")
};

function destRow(over: Partial<DestRow> = {}): DestRow {
  return {
    id: "d-1",
    tripId: "t-1",
    city: "Lisboa",
    country: "Portugal",
    iata: "LIS",
    score: "0.82",
    rationale: "Combina gastronomia, história e ritmo tranquilo no orçamento.",
    estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
    climate: { expectedC: 24, summary: "ameno", bestMonths: [5, 6, 9] },
    flightTimeHours: "9.5",
    chosen: false,
    createdAt: new Date("2026-08-29T10:30:00.000Z"),
    ...over
  };
}

describe("toTrip", () => {
  it("converte a linha para o DTO (numéricos viram number, datas ISO)", () => {
    expect(toTrip(tripRow)).toEqual({
      id: "t-1",
      userId: "u-1",
      status: "draft",
      title: null,
      originIata: "GRU",
      dateStart: "2026-09-10",
      dateEnd: "2026-09-17",
      durationDays: null,
      targetMonth: null,
      party: { adults: 2, children: 1 },
      budgetTotal: 15000,
      currency: "BRL",
      chosenDestinationId: null,
      createdAt: "2026-08-29T10:00:00.000Z",
      updatedAt: "2026-08-29T11:00:00.000Z"
    });
  });

  it("mantém budgetTotal nulo quando a coluna é nula", () => {
    expect(toTrip({ ...tripRow, budgetTotal: null }).budgetTotal).toBeNull();
  });
});

describe("toDestinationCandidate", () => {
  it("converte score/flightTimeHours para number e valida pelo schema", () => {
    const dto = toDestinationCandidate(destRow());
    expect(dto.score).toBe(0.82);
    expect(dto.flightTimeHours).toBe(9.5);
    expect(dto.city).toBe("Lisboa");
  });

  it("mantém flightTimeHours nulo", () => {
    expect(toDestinationCandidate(destRow({ flightTimeHours: null })).flightTimeHours).toBeNull();
  });
});

describe("buildTripState", () => {
  it("sem destinos: lista vazia e chosenDestination nulo", () => {
    const state = buildTripState(tripRow, []);
    expect(state.destinations).toEqual([]);
    expect(state.chosenDestination).toBeNull();
    expect(state.id).toBe("t-1");
  });

  it("com destinos: expõe todos e destaca o escolhido (chosen=true)", () => {
    const state = buildTripState(tripRow, [
      destRow({ id: "d-1", iata: "LIS", chosen: false }),
      destRow({ id: "d-2", iata: "OPO", chosen: true })
    ]);
    expect(state.destinations.map((d) => d.iata)).toEqual(["LIS", "OPO"]);
    expect(state.chosenDestination?.iata).toBe("OPO");
  });
});

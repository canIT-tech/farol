import { describe, it, expect } from "vitest";
import { isDomainError } from "@farol/shared";
import { addDays, resolveTripDates, buildFlightParams, buildHotelParams } from "./trip-search";
import type { TripState } from "../trips/trip-state";

function tripState(over: Partial<TripState> = {}): TripState {
  return {
    id: "t-1",
    userId: "u-1",
    status: "planned",
    title: null,
    originIata: "GRU",
    dateStart: null,
    dateEnd: null,
    durationDays: null,
    targetMonth: null,
    party: { adults: 2, children: 1 },
    budgetTotal: 15000,
    currency: "BRL",
    chosenDestinationId: null,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
    destinations: [],
    chosenDestination: {
      iata: "LIS",
      city: "Lisboa",
      country: "Portugal",
      score: 0.8,
      rationale: "Justificativa longa o suficiente para o schema.",
      estCost: { flight: 3000, lodgingPerNight: 200, dailyLocal: 150, currency: "BRL" },
      climate: { expectedC: 22, summary: "ameno", bestMonths: [9] },
      flightTimeHours: null
    },
    ...over
  };
}

describe("addDays", () => {
  it("soma dias mantendo o formato YYYY-MM-DD", () => {
    expect(addDays("2026-09-01", 7)).toBe("2026-09-08");
    expect(addDays("2026-09-28", 5)).toBe("2026-10-03");
  });
});

describe("resolveTripDates", () => {
  it("usa dateStart/dateEnd quando presentes", () => {
    const trip = tripState({ dateStart: "2026-09-10", dateEnd: "2026-09-17" });
    expect(resolveTripDates(trip)).toEqual({ depart: "2026-09-10", return: "2026-09-17" });
  });

  it("deriva do targetMonth + durationDays quando não há datas", () => {
    const trip = tripState({ targetMonth: "2026-09", durationDays: 6 });
    expect(resolveTripDates(trip)).toEqual({ depart: "2026-09-01", return: "2026-09-07" });
  });

  it("usa 7 noites por padrão quando durationDays é nulo", () => {
    const trip = tripState({ targetMonth: "2026-11", durationDays: null });
    expect(resolveTripDates(trip)).toEqual({ depart: "2026-11-01", return: "2026-11-08" });
  });

  it("com só uma das datas cai no ramo de duração (precisa das duas)", () => {
    const trip = tripState({ dateStart: "2026-09-10", dateEnd: null, targetMonth: "2026-12", durationDays: 4 });
    expect(resolveTripDates(trip)).toEqual({ depart: "2026-12-01", return: "2026-12-05" });
  });
});

describe("buildFlightParams", () => {
  it("monta os params a partir do trip com destino escolhido", () => {
    const trip = tripState({ dateStart: "2026-09-10", dateEnd: "2026-09-17" });
    expect(buildFlightParams(trip)).toEqual({
      originIata: "GRU",
      destinationIata: "LIS",
      departDate: "2026-09-10",
      returnDate: "2026-09-17",
      adults: 2,
      children: 1
    });
  });

  it("lança no_destination_chosen quando não há destino escolhido", () => {
    const trip = tripState({ chosenDestination: null, dateStart: "2026-09-10", dateEnd: "2026-09-17" });
    try {
      buildFlightParams(trip);
      expect.unreachable("deveria lançar");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("no_destination_chosen");
    }
  });
});

describe("buildHotelParams", () => {
  it("usa o iata do destino como cityCode e as datas resolvidas", () => {
    const trip = tripState({ targetMonth: "2026-09", durationDays: 5 });
    expect(buildHotelParams(trip)).toEqual({
      cityCode: "LIS",
      checkIn: "2026-09-01",
      checkOut: "2026-09-06",
      adults: 2
    });
  });

  it("lança no_destination_chosen sem destino", () => {
    const trip = tripState({ chosenDestination: null, targetMonth: "2026-09", durationDays: 5 });
    expect(() => buildHotelParams(trip)).toThrow(/destino/);
  });
});

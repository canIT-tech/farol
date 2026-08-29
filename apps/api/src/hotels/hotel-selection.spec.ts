import { describe, it, expect } from "vitest";
import type { hotelSelections } from "@farol/db";
import { toHotelSelection } from "./hotel-selection";

type Row = typeof hotelSelections.$inferSelect;

const offer = {
  id: "hot-1",
  name: "Hotel do Chiado",
  region: "Chiado",
  pricePerNight: 180,
  priceTotal: 1260,
  currency: "BRL",
  rating: 4.5,
  deepLink: "https://parceiro.example.com/hoteis?c=LIS"
};

function row(over: Partial<Row> = {}): Row {
  return {
    id: "sel-1",
    tripId: "t-1",
    offer,
    name: "Hotel do Chiado",
    region: "Chiado",
    pricePerNight: "180.00",
    priceTotal: "1260.00",
    currency: "BRL",
    rating: "4.5",
    deepLink: "https://parceiro.example.com/hoteis?c=LIS",
    selectedAt: new Date("2026-08-29T12:00:00.000Z"),
    ...over
  };
}

describe("toHotelSelection", () => {
  it("converte a linha para o DTO", () => {
    expect(toHotelSelection(row())).toEqual({
      id: "sel-1",
      tripId: "t-1",
      offer,
      name: "Hotel do Chiado",
      region: "Chiado",
      pricePerNight: 180,
      priceTotal: 1260,
      currency: "BRL",
      rating: 4.5,
      deepLink: "https://parceiro.example.com/hoteis?c=LIS",
      selectedAt: "2026-08-29T12:00:00.000Z"
    });
  });

  it("mantém region/priceTotal/rating nulos", () => {
    const dto = toHotelSelection(row({ region: null, priceTotal: null, rating: null }));
    expect(dto.region).toBeNull();
    expect(dto.priceTotal).toBeNull();
    expect(dto.rating).toBeNull();
  });
});

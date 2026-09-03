import { describe, it, expect } from "vitest";
import type { HotelOffer, ItineraryItem } from "@farol/shared";
import { WALKABLE_METERS, distanceMeters, walkingNote } from "./walking-distance";

const hotel = (lat: number | null, lng: number | null): HotelOffer =>
  ({ id: "h1", name: "Hotel", lat, lng }) as unknown as HotelOffer;

const parada = (lat: number | null, lng: number | null): ItineraryItem =>
  ({ id: `i-${lat}-${lng}`, lat, lng }) as unknown as ItineraryItem;

describe("distanceMeters", () => {
  it("dá zero para o mesmo ponto", () => {
    expect(distanceMeters({ lat: 38.71, lng: -9.14 }, { lat: 38.71, lng: -9.14 })).toBe(0);
  });

  it("aproxima uma distância conhecida — Lisboa a Porto, ~275 km", () => {
    const d = distanceMeters({ lat: 38.7223, lng: -9.1393 }, { lat: 41.1579, lng: -8.6291 });
    expect(d).toBeGreaterThan(270_000);
    expect(d).toBeLessThan(285_000);
  });

  it("é simétrica", () => {
    const a = { lat: 38.71, lng: -9.14 };
    const b = { lat: 38.72, lng: -9.15 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });
});

describe("walkingNote", () => {
  const base = hotel(38.7107, -9.1401);

  it("conta as paradas dentro da distância caminhável", () => {
    expect(
      walkingNote(base, [parada(38.7108, -9.1402), parada(38.7112, -9.1405), parada(38.9, -9.5)])
    ).toBe("2 paradas a pé");
  });

  it("usa o singular para uma parada", () => {
    expect(walkingNote(base, [parada(38.7108, -9.1402), parada(38.9, -9.5)])).toBe(
      "1 parada a pé"
    );
  });

  it("devolve null quando nenhuma parada está a pé", () => {
    expect(walkingNote(base, [parada(38.9, -9.5)])).toBeNull();
    expect(walkingNote(base, [])).toBeNull();
  });

  it("devolve null quando o hotel não tem coordenada", () => {
    expect(walkingNote(hotel(null, -9.14), [parada(38.7108, -9.1402)])).toBeNull();
    expect(walkingNote(hotel(38.71, null), [parada(38.7108, -9.1402)])).toBeNull();
  });

  it("ignora parada sem coordenada em vez de contá-la", () => {
    expect(walkingNote(base, [parada(null, -9.1402), parada(38.7108, null)])).toBeNull();
  });

  it("o limite é o raio caminhável, não uma distância qualquer", () => {
    const longe = { lat: base.lat! + WALKABLE_METERS / 111_000 + 0.005, lng: base.lng! };
    expect(walkingNote(base, [parada(longe.lat, longe.lng)])).toBeNull();
  });
});

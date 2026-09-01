import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  normalizePlace,
  normalizePlaceDetails,
  normalizePlaceList,
  toPriceLevel,
  toPriceLevelEnum
} from "./normalize-place.js";

function loadFixture(name: string): never {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8")
  ) as never;
}
const search = loadFixture("text-search.json");
const details = loadFixture("details.json");

describe("toPriceLevel", () => {
  it("mapeia cada enum do Places para 0..4", () => {
    expect(toPriceLevel("PRICE_LEVEL_FREE")).toBe(0);
    expect(toPriceLevel("PRICE_LEVEL_INEXPENSIVE")).toBe(1);
    expect(toPriceLevel("PRICE_LEVEL_MODERATE")).toBe(2);
    expect(toPriceLevel("PRICE_LEVEL_EXPENSIVE")).toBe(3);
    expect(toPriceLevel("PRICE_LEVEL_VERY_EXPENSIVE")).toBe(4);
  });

  it("devolve null para ausente, unspecified e valor desconhecido", () => {
    expect(toPriceLevel(undefined)).toBeNull();
    expect(toPriceLevel("PRICE_LEVEL_UNSPECIFIED")).toBeNull();
    expect(toPriceLevel("PRICE_LEVEL_MARTE")).toBeNull();
  });
});

describe("toPriceLevelEnum", () => {
  it("volta de 0..4 para o enum do Places", () => {
    expect(toPriceLevelEnum(0)).toBe("PRICE_LEVEL_FREE");
    expect(toPriceLevelEnum(4)).toBe("PRICE_LEVEL_VERY_EXPENSIVE");
  });

  it("devolve undefined fora da faixa", () => {
    expect(toPriceLevelEnum(5)).toBeUndefined();
    expect(toPriceLevelEnum(-1)).toBeUndefined();
  });
});

describe("normalizePlace", () => {
  it("traduz um lugar cru para Place", () => {
    expect(normalizePlace(search.places[0])).toEqual({
      placeId: "ChIJZ3VqNbc0GQ0RRfCB8ZKQPqE",
      name: "Museu Nacional do Azulejo",
      lat: 38.7247,
      lng: -9.1146,
      rating: 4.6,
      priceLevel: 1,
      types: ["museum", "tourist_attraction", "point_of_interest"]
    });
  });

  it("rating e priceLevel viram null quando o cru não traz", () => {
    const place = normalizePlace(search.places[2]);
    expect(place.rating).toBeNull();
    expect(place.priceLevel).toBeNull();
  });

  it("types ausente vira lista vazia", () => {
    const raw = { ...(search.places[0] as object), types: undefined };
    expect(normalizePlace(raw).types).toEqual([]);
  });

  it("rejeita cru sem location", () => {
    const raw = { ...(search.places[0] as object), location: undefined };
    expect(() => normalizePlace(raw)).toThrow();
  });
});

describe("normalizePlaceList", () => {
  it("traduz a lista inteira da fixture", () => {
    const places = normalizePlaceList(search);
    expect(places).toHaveLength(3);
    expect(places.map((p) => p.name)).toEqual([
      "Museu Nacional do Azulejo",
      "Time Out Market Lisboa",
      "Miradouro da Senhora do Monte"
    ]);
  });

  it("resposta sem o campo places vira lista vazia", () => {
    expect(normalizePlaceList({})).toEqual([]);
  });

  it("descarta lugares que não passam no schema em vez de derrubar a lista", () => {
    const raw = { places: [search.places[0], { id: "quebrado" }, search.places[1]] };
    expect(normalizePlaceList(raw).map((p) => p.placeId)).toEqual([
      "ChIJZ3VqNbc0GQ0RRfCB8ZKQPqE",
      "ChIJq0dQGrY0GQ0RSjNZ0-uNJ2s"
    ]);
  });
});

describe("normalizePlaceDetails", () => {
  it("acrescenta address e openingHours", () => {
    expect(normalizePlaceDetails(details)).toMatchObject({
      placeId: "ChIJZ3VqNbc0GQ0RRfCB8ZKQPqE",
      address: "R. Me. Deus 4, 1900-312 Lisboa, Portugal",
      openingHours: [
        "segunda-feira: Encerrado",
        "terça-feira: 10:00 – 18:00",
        "quarta-feira: 10:00 – 18:00",
        "quinta-feira: 10:00 – 18:00",
        "sexta-feira: 10:00 – 18:00",
        "sábado: 10:00 – 18:00",
        "domingo: 10:00 – 18:00"
      ]
    });
  });

  it("address e openingHours viram null quando ausentes", () => {
    const result = normalizePlaceDetails(search.places[2]);
    expect(result.address).toBeNull();
    expect(result.openingHours).toBeNull();
  });

  it("regularOpeningHours sem weekdayDescriptions vira null", () => {
    const raw = { ...(details as object), regularOpeningHours: {} };
    expect(normalizePlaceDetails(raw).openingHours).toBeNull();
  });
});

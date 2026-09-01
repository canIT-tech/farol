import { describe, it, expect } from "vitest";
import { placesTextSearchParamsSchema, placeSchema, placeDetailsSchema } from "./places.js";

const baseParams = { query: "museu do azulejo Lisboa" };

const basePlace = {
  placeId: "ChIJ-place-1",
  name: "Museu Nacional do Azulejo",
  lat: 38.7247,
  lng: -9.1146,
  rating: 4.6,
  priceLevel: 2,
  types: ["museum", "tourist_attraction"]
};

describe("placesTextSearchParamsSchema", () => {
  it("aceita só a query", () => {
    expect(placesTextSearchParamsSchema.parse(baseParams)).toEqual(baseParams);
  });

  it("aceita near, type e faixa de preço", () => {
    const params = {
      ...baseParams,
      near: { lat: 38.7, lng: -9.1 },
      type: "restaurant" as const,
      minPrice: 1,
      maxPrice: 3
    };
    expect(placesTextSearchParamsSchema.parse(params)).toEqual(params);
  });

  it("rejeita query com menos de 2 caracteres", () => {
    expect(() => placesTextSearchParamsSchema.parse({ query: "a" })).toThrow();
  });

  it("rejeita query com mais de 200 caracteres", () => {
    expect(() => placesTextSearchParamsSchema.parse({ query: "a".repeat(201) })).toThrow();
  });

  it("rejeita type fora do enum", () => {
    expect(() => placesTextSearchParamsSchema.parse({ ...baseParams, type: "bar" })).toThrow();
  });

  it("rejeita near sem lng", () => {
    expect(() =>
      placesTextSearchParamsSchema.parse({ ...baseParams, near: { lat: 38.7 } })
    ).toThrow();
  });

  it("rejeita minPrice fora de 0..4", () => {
    expect(() => placesTextSearchParamsSchema.parse({ ...baseParams, minPrice: -1 })).toThrow();
    expect(() => placesTextSearchParamsSchema.parse({ ...baseParams, minPrice: 5 })).toThrow();
  });

  it("rejeita maxPrice fora de 0..4", () => {
    expect(() => placesTextSearchParamsSchema.parse({ ...baseParams, maxPrice: -1 })).toThrow();
    expect(() => placesTextSearchParamsSchema.parse({ ...baseParams, maxPrice: 5 })).toThrow();
  });

  it("aceita as pontas 0 e 4 da faixa de preço", () => {
    expect(
      placesTextSearchParamsSchema.parse({ ...baseParams, minPrice: 0, maxPrice: 4 })
    ).toMatchObject({ minPrice: 0, maxPrice: 4 });
  });

  it("rejeita preço não inteiro", () => {
    expect(() => placesTextSearchParamsSchema.parse({ ...baseParams, minPrice: 1.5 })).toThrow();
  });
});

describe("placeSchema", () => {
  it("aceita um lugar completo", () => {
    expect(placeSchema.parse(basePlace)).toEqual(basePlace);
  });

  it("aceita rating e priceLevel nulos", () => {
    const place = { ...basePlace, rating: null, priceLevel: null };
    expect(placeSchema.parse(place)).toEqual(place);
  });

  it("exige lat e lng numéricos", () => {
    expect(() => placeSchema.parse({ ...basePlace, lat: "38.7" })).toThrow();
    expect(() => placeSchema.parse({ ...basePlace, lng: undefined })).toThrow();
  });

  it("rejeita placeId vazio", () => {
    expect(() => placeSchema.parse({ ...basePlace, placeId: "" })).toThrow();
  });

  it("rejeita name vazio", () => {
    expect(() => placeSchema.parse({ ...basePlace, name: "" })).toThrow();
  });

  it("rejeita rating fora de 0..5", () => {
    expect(() => placeSchema.parse({ ...basePlace, rating: 5.1 })).toThrow();
    expect(() => placeSchema.parse({ ...basePlace, rating: -0.1 })).toThrow();
  });

  it("rejeita priceLevel fora de 0..4", () => {
    expect(() => placeSchema.parse({ ...basePlace, priceLevel: 5 })).toThrow();
  });

  it("aceita types vazio", () => {
    expect(placeSchema.parse({ ...basePlace, types: [] }).types).toEqual([]);
  });
});

describe("placeDetailsSchema", () => {
  it("estende placeSchema com address e openingHours", () => {
    const details = {
      ...basePlace,
      address: "R. Me. Deus 4, 1900-312 Lisboa",
      openingHours: ["Terça a domingo: 10:00–18:00"]
    };
    expect(placeDetailsSchema.parse(details)).toEqual(details);
  });

  it("aceita address e openingHours nulos", () => {
    const details = { ...basePlace, address: null, openingHours: null };
    expect(placeDetailsSchema.parse(details)).toEqual(details);
  });

  it("exige os campos de address/openingHours presentes", () => {
    expect(() => placeDetailsSchema.parse(basePlace)).toThrow();
  });
});

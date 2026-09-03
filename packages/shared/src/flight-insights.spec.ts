import { describe, it, expect } from "vitest";
import {
  airlineSchema,
  airportSchema,
  geoLocationSchema,
  routeDealSchema,
  routePriceSampleSchema
} from "./flight-insights.js";

const sample = {
  origin: "SAO",
  destination: "RIO",
  departDate: "2026-10-22",
  returnDate: null,
  price: 337,
  currency: "brl",
  transfers: 0,
  durationMinutes: 65,
  gate: "Trip.com",
  foundAt: "2026-08-29T04:34:14Z",
  deepLink: "https://www.aviasales.com/search/SAO2210RIO1?marker=1"
};

const deal = {
  key: "2026-09",
  origin: "SAO",
  destination: "BSB",
  airline: "G3",
  departAt: "2026-09-26T08:40:00-03:00",
  returnAt: "2026-09-29T11:30:00-03:00",
  price: 760,
  currency: "BRL",
  flightNumber: "1456",
  transfers: 0,
  deepLink: "https://www.aviasales.com/search/SAO2609BSB29091?marker=1"
};

const geo = {
  iata: "XAP",
  name: "Chapeco",
  countryName: "Brazil",
  countryCode: "BR",
  lat: -27.1,
  lon: -52.61
};

const airport = {
  iata: "GRU",
  name: "Guarulhos",
  cityCode: "SAO",
  countryCode: "BR",
  timeZone: "America/Sao_Paulo",
  lat: -23.43,
  lon: -46.47,
  flightable: true
};

const airline = { code: "LA", name: "LATAM", isLowcost: false };

describe("routePriceSampleSchema", () => {
  it("aceita uma amostra só de ida", () => {
    expect(routePriceSampleSchema.parse(sample).returnDate).toBeNull();
  });

  it("aceita returnDate, gate e foundAt preenchidos", () => {
    const parsed = routePriceSampleSchema.parse({ ...sample, returnDate: "2026-10-30" });
    expect(parsed.returnDate).toBe("2026-10-30");
    expect(parsed.gate).toBe("Trip.com");
  });

  it("aceita gate e foundAt nulos (item sem agência)", () => {
    const parsed = routePriceSampleSchema.parse({ ...sample, gate: null, foundAt: null });
    expect(parsed.gate).toBeNull();
    expect(parsed.foundAt).toBeNull();
  });

  it("aceita durationMinutes zero (item sem duração no cache)", () => {
    expect(routePriceSampleSchema.parse({ ...sample, durationMinutes: 0 }).durationMinutes).toBe(0);
  });

  it("rejeita price não-positivo, transfers negativo e deepLink inválido", () => {
    expect(() => routePriceSampleSchema.parse({ ...sample, price: 0 })).toThrow();
    expect(() => routePriceSampleSchema.parse({ ...sample, transfers: -1 })).toThrow();
    expect(() => routePriceSampleSchema.parse({ ...sample, deepLink: "x" })).toThrow();
  });

  it("rejeita iata fora de 3 letras", () => {
    expect(() => routePriceSampleSchema.parse({ ...sample, origin: "SA" })).toThrow();
    expect(() => routePriceSampleSchema.parse({ ...sample, destination: "RIOX" })).toThrow();
  });
});

describe("routeDealSchema", () => {
  it("aceita um achado completo", () => {
    expect(routeDealSchema.parse(deal).key).toBe("2026-09");
  });

  it("aceita returnAt e flightNumber nulos (só ida)", () => {
    const parsed = routeDealSchema.parse({ ...deal, returnAt: null, flightNumber: null });
    expect(parsed.returnAt).toBeNull();
    expect(parsed.flightNumber).toBeNull();
  });

  it("rejeita key vazia, airline vazia e price zero", () => {
    expect(() => routeDealSchema.parse({ ...deal, key: "" })).toThrow();
    expect(() => routeDealSchema.parse({ ...deal, airline: "" })).toThrow();
    expect(() => routeDealSchema.parse({ ...deal, price: 0 })).toThrow();
  });
});

describe("geoLocationSchema", () => {
  it("aceita uma localização completa", () => {
    expect(geoLocationSchema.parse(geo).iata).toBe("XAP");
  });

  it("aceita coordenadas nulas", () => {
    const parsed = geoLocationSchema.parse({ ...geo, lat: null, lon: null });
    expect(parsed.lat).toBeNull();
    expect(parsed.lon).toBeNull();
  });

  it("rejeita countryCode fora de 2 letras", () => {
    expect(() => geoLocationSchema.parse({ ...geo, countryCode: "BRA" })).toThrow();
  });
});

describe("airportSchema", () => {
  it("aceita um aeroporto completo", () => {
    expect(airportSchema.parse(airport).flightable).toBe(true);
  });

  it("aceita cityCode, timeZone e coordenadas nulos", () => {
    const parsed = airportSchema.parse({
      ...airport,
      cityCode: null,
      timeZone: null,
      lat: null,
      lon: null
    });
    expect(parsed.cityCode).toBeNull();
    expect(parsed.timeZone).toBeNull();
  });

  it("rejeita flightable que não é boolean", () => {
    expect(() => airportSchema.parse({ ...airport, flightable: "sim" })).toThrow();
  });
});

describe("airlineSchema", () => {
  it("aceita uma companhia", () => {
    expect(airlineSchema.parse(airline).name).toBe("LATAM");
  });

  it("rejeita code com menos de 2 caracteres", () => {
    expect(() => airlineSchema.parse({ ...airline, code: "L" })).toThrow();
  });

  it("rejeita isLowcost que não é boolean", () => {
    expect(() => airlineSchema.parse({ ...airline, isLowcost: "não" })).toThrow();
  });
});

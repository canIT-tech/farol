import { describe, it, expect, vi } from "vitest";
import { searchAirports, whereami } from "./geo-api";

function jsonFetch(payload: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" }
    })
  ) as unknown as typeof fetch;
}

function lastUrl(f: typeof fetch): string {
  return (f as unknown as { mock: { calls: [string][] } }).mock.calls[0]![0];
}

const chapeco = {
  iata: "XAP",
  name: "Chapeco",
  countryName: "Brazil",
  countryCode: "BR",
  lat: -27.100935,
  lon: -52.6157
};

const gru = {
  iata: "GRU",
  name: "Guarulhos",
  cityCode: "SAO",
  countryCode: "BR",
  timeZone: "America/Sao_Paulo",
  lat: -23.43,
  lon: -46.47,
  flightable: true
};

describe("whereami", () => {
  it("devolve a localização do IP", async () => {
    const f = jsonFetch(chapeco);
    await expect(whereami(f)).resolves.toEqual(chapeco);
    expect(lastUrl(f)).toContain("/geo/whereami");
  });

  it("aceita null quando o IP não resolve", async () => {
    await expect(whereami(jsonFetch(null))).resolves.toBeNull();
  });

  it("propaga erro HTTP", async () => {
    await expect(whereami(jsonFetch({}, 503))).rejects.toThrow(/503/);
  });
});

describe("searchAirports", () => {
  it("escapa o termo na query e devolve a lista", async () => {
    const f = jsonFetch([gru]);
    await expect(searchAirports("são paulo", f)).resolves.toEqual([gru]);
    expect(lastUrl(f)).toContain("/geo/airports?q=s%C3%A3o%20paulo");
  });

  it("rejeita payload fora do schema", async () => {
    await expect(searchAirports("gru", jsonFetch([{ iata: "GRU" }]))).rejects.toThrow();
  });
});

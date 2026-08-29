import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AmadeusFlightProvider } from "./amadeus-flight-provider";
import type { AmadeusHttp } from "./http";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/flight-offers.json", import.meta.url)), "utf8")
) as unknown;

const TEMPLATE = "https://parceiro.example.com/voos?o={origin}&d={destination}";

function providerWith(getImpl: AmadeusHttp["get"]) {
  const http: AmadeusHttp = { get: vi.fn(getImpl) };
  const provider = new AmadeusFlightProvider({
    baseUrl: "https://x",
    clientId: "c",
    clientSecret: "s",
    deepLinkTemplate: TEMPLATE,
    http
  });
  return { provider, http };
}

const baseParams = {
  originIata: "GRU",
  destinationIata: "LIS",
  departDate: "2026-09-10",
  adults: 2,
  children: 1
};

describe("AmadeusFlightProvider.search", () => {
  it("traduz os params, chama o endpoint certo e devolve ofertas por preço asc", async () => {
    const { provider, http } = providerWith(() => Promise.resolve(fixture));

    const offers = await provider.search({ ...baseParams, returnDate: "2026-09-20" });

    expect(offers.map((o) => o.id)).toEqual(["2", "1", "4", "3"]); // 3980 < 4210.55 < 5555 < 6120.9
    const [path, query] = (http.get as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(path).toBe("/v2/shopping/flight-offers");
    expect(query).toMatchObject({
      originLocationCode: "GRU",
      destinationLocationCode: "LIS",
      departureDate: "2026-09-10",
      adults: "2",
      children: "1",
      returnDate: "2026-09-20",
      currencyCode: "BRL"
    });
    expect(query.nonStop).toBeUndefined();
  });

  it("com maxStops 0 pede nonStop=true e filtra ofertas com escala", async () => {
    const { provider, http } = providerWith(() => Promise.resolve(fixture));

    const offers = await provider.search({ ...baseParams, maxStops: 0 });

    expect(offers.every((o) => o.stops === 0)).toBe(true);
    expect(offers.map((o) => o.id).sort()).toEqual(["1", "3", "4"]);
    const [, query] = (http.get as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(query.nonStop).toBe("true");
  });

  it("sem children não inclui o parâmetro children", async () => {
    const { provider, http } = providerWith(() => Promise.resolve(fixture));
    await provider.search({ ...baseParams, children: 0 });
    const [, query] = (http.get as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(query.children).toBeUndefined();
    expect(query.returnDate).toBeUndefined();
  });

  it("rejeita params inválidos antes de chamar o provider", async () => {
    const { provider, http } = providerWith(() => Promise.resolve(fixture));
    await expect(provider.search({ ...baseParams, originIata: "GR" })).rejects.toThrow();
    expect(http.get).not.toHaveBeenCalled();
  });

  it("monta o cliente HTTP interno quando não recebe um http", () => {
    expect(
      () =>
        new AmadeusFlightProvider({
          baseUrl: "https://x",
          clientId: "c",
          clientSecret: "s",
          deepLinkTemplate: TEMPLATE
        })
    ).not.toThrow();
  });
});

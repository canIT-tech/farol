import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AmadeusHotelProvider } from "./amadeus-hotel-provider";
import type { AmadeusHttp } from "./http";

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8")
  ) as unknown;
}
const list = loadFixture("hotel-list.json");
const offers = loadFixture("hotel-offers.json");
const TEMPLATE = "https://parceiro.example.com/hoteis?c={cityCode}";

function providerWith(routes: Record<string, unknown>) {
  const get = vi.fn(async (path: string) => {
    const key = Object.keys(routes).find((k) => path.includes(k));
    return routes[key ?? ""] ?? {};
  });
  const http: AmadeusHttp = { get };
  const provider = new AmadeusHotelProvider({
    baseUrl: "https://x",
    clientId: "c",
    clientSecret: "s",
    deepLinkTemplate: TEMPLATE,
    http
  });
  return { provider, get };
}

const params = { cityCode: "LIS", checkIn: "2026-09-10", checkOut: "2026-09-17", adults: 2 };

describe("AmadeusHotelProvider.search", () => {
  it("busca a lista da cidade, depois as ofertas, e ordena por pricePerNight asc", async () => {
    const { provider, get } = providerWith({ "by-city": list, "hotel-offers": offers });

    const result = await provider.search({ ...params, radiusKm: 5 });

    expect(result.map((h) => h.id)).toEqual(["OFFER-IN-1", "OFFER-AC-1", "OFFER-MC-1"]); // 200 < 450 < 1000

    const [listPath, listQuery] = get.mock.calls[0]!;
    expect(listPath).toBe("/v1/reference-data/locations/hotels/by-city");
    expect(listQuery).toMatchObject({ cityCode: "LIS", radius: "5", radiusUnit: "KM" });

    const [offersPath, offersQuery] = get.mock.calls[1]!;
    expect(offersPath).toBe("/v3/shopping/hotel-offers");
    expect(offersQuery).toMatchObject({
      hotelIds: "MCLISABC,ACLISDEF,INLISGHI",
      checkInDate: "2026-09-10",
      checkOutDate: "2026-09-17",
      adults: "2"
    });
  });

  it("sem radiusKm não manda radius/radiusUnit", async () => {
    const { provider, get } = providerWith({ "by-city": list, "hotel-offers": offers });
    await provider.search(params);
    const [, listQuery] = get.mock.calls[0]!;
    expect(listQuery.radius).toBeUndefined();
    expect(listQuery.radiusUnit).toBeUndefined();
  });

  it("cidade sem hotéis (data vazio) devolve lista vazia e não chama hotel-offers", async () => {
    const { provider, get } = providerWith({ "by-city": { data: [] } });
    await expect(provider.search(params)).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("resposta da lista sem o campo data também devolve lista vazia", async () => {
    const { provider, get } = providerWith({ "by-city": {} });
    await expect(provider.search(params)).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("rejeita params inválidos antes de qualquer chamada", async () => {
    const { provider, get } = providerWith({ "by-city": list });
    await expect(provider.search({ ...params, cityCode: "" })).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });

  it("monta o cliente HTTP interno quando não recebe um http", () => {
    expect(
      () =>
        new AmadeusHotelProvider({
          baseUrl: "https://x",
          clientId: "c",
          clientSecret: "s",
          deepLinkTemplate: TEMPLATE
        })
    ).not.toThrow();
  });
});

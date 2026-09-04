import { describe, expect, it, vi } from "vitest";
import type { FlightOffer, RouteDeal, RoutePriceSample } from "@farol/shared";
import { FallbackFlightProvider } from "./fallback-flight-provider.js";
import type { FlightInsightsProvider, FlightProvider } from "./flight-provider.js";

const offer = (id: string, price: number): FlightOffer => ({
  id,
  price,
  currency: "BRL",
  carrier: "AT",
  carrierName: null,
  originIata: "GRU",
  originName: null,
  destinationIata: "LIS",
  destinationName: null,
  stops: 1,
  departAt: "2026-11-15T00:25:00",
  arriveAt: "2026-11-15T16:55:00",
  returnAt: null,
  durationMinutes: 810,
  deepLink: "https://exemplo.test/voo"
});

const params = {
  originIata: "GRU",
  destinationIata: "LIS",
  departDate: "2026-11-15",
  adults: 1,
  children: 0
};

function insights(offers: FlightOffer[]): FlightInsightsProvider {
  return {
    search: vi.fn(async () => offers),
    nearbyOptions: vi.fn(async () => offers),
    priceCalendar: vi.fn(async () => [] as RoutePriceSample[]),
    latestPrices: vi.fn(async () => [] as RoutePriceSample[]),
    monthlyPrices: vi.fn(async () => [] as RouteDeal[]),
    cityDirections: vi.fn(async () => [] as RouteDeal[])
  };
}

describe("FallbackFlightProvider", () => {
  it("usa o primário quando ele responde", async () => {
    const fallback = insights([offer("tp", 3000)]);
    const primary: FlightProvider = { search: vi.fn(async () => [offer("gf", 1997)]) };
    const provider = new FallbackFlightProvider({ primary, fallback });
    expect((await provider.search(params))[0]!.id).toBe("gf");
    expect(fallback.search).not.toHaveBeenCalled();
  });

  it("cai no fallback quando o primário falha", async () => {
    const fallback = insights([offer("tp", 3000)]);
    const primary: FlightProvider = {
      search: vi.fn(async () => {
        throw new Error("layout mudou");
      })
    };
    const provider = new FallbackFlightProvider({ primary, fallback });
    expect((await provider.search(params))[0]!.id).toBe("tp");
  });

  // Lista vazia é resposta, não falha: quer dizer "essa rota não tem voo nessa
  // data". Tratar como falha faria voltar preço de cache do parceiro para uma
  // rota que não existe — pior que não mostrar nada.
  it("não cai no fallback quando o primário responde vazio", async () => {
    const fallback = insights([offer("tp", 3000)]);
    const primary: FlightProvider = { search: vi.fn(async () => []) };
    const provider = new FallbackFlightProvider({ primary, fallback });
    expect(await provider.search(params)).toEqual([]);
    expect(fallback.search).not.toHaveBeenCalled();
  });

  it("avisa quem observa quando cai no fallback", async () => {
    const onFallback = vi.fn();
    const erro = new Error("bloqueado");
    const primary: FlightProvider = {
      search: vi.fn(async () => {
        throw erro;
      })
    };
    await new FallbackFlightProvider({ primary, fallback: insights([]), onFallback }).search(params);
    expect(onFallback).toHaveBeenCalledWith(erro);
  });

  it("segue funcionando sem observador", async () => {
    const primary: FlightProvider = {
      search: vi.fn(async () => {
        throw new Error("bloqueado");
      })
    };
    await expect(
      new FallbackFlightProvider({ primary, fallback: insights([offer("tp", 1)]) }).search(params)
    ).resolves.toHaveLength(1);
  });

  // Os insights não têm equivalente no primário: são endpoints próprios do
  // Travelpayouts. Passam direto, sem tentativa nem fallback.
  it("delega os insights ao provider de insights", async () => {
    const fallback = insights([]);
    const primary: FlightProvider = { search: vi.fn(async () => []) };
    const provider = new FallbackFlightProvider({ primary, fallback });
    const route = { originIata: "GRU", destinationIata: "LIS" };

    await provider.nearbyOptions(params);
    await provider.priceCalendar(route, 2);
    await provider.latestPrices({ ...route, limit: 5 }, 2);
    await provider.monthlyPrices(route, 2);
    await provider.cityDirections("GRU", 2);

    expect(fallback.nearbyOptions).toHaveBeenCalledWith(params);
    expect(fallback.priceCalendar).toHaveBeenCalledWith(route, 2);
    expect(fallback.latestPrices).toHaveBeenCalledWith({ ...route, limit: 5 }, 2);
    expect(fallback.monthlyPrices).toHaveBeenCalledWith(route, 2);
    expect(fallback.cityDirections).toHaveBeenCalledWith("GRU", 2);
    expect(primary.search).not.toHaveBeenCalled();
  });
});

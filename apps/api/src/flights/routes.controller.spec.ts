import { describe, it, expect, vi } from "vitest";
import {
  RoutesController,
  routeMonthsQuerySchema,
  routeOffersQuerySchema
} from "./routes.controller";
import type { FlightsService } from "./flights.service";

const emptySection = { offers: [], stale: false, fetchedAt: null, error: null };

type Method = "monthsByRoute" | "offersByRoute";

function controllerWith(over: Partial<Record<Method, ReturnType<typeof vi.fn>>> = {}) {
  const service = {
    monthsByRoute: over.monthsByRoute ?? vi.fn().mockResolvedValue(emptySection),
    offersByRoute: over.offersByRoute ?? vi.fn().mockResolvedValue(emptySection)
  };
  return {
    controller: new RoutesController(service as unknown as FlightsService),
    service
  };
}

describe("routeMonthsQuerySchema", () => {
  // A query string chega como texto: sem o coerce, `adults=2` reprovaria por
  // não ser número.
  it("converte os números que chegam como texto", () => {
    expect(
      routeMonthsQuerySchema.parse({
        origin: "FLN",
        destination: "SYD",
        adults: "2",
        children: "1"
      })
    ).toEqual({ origin: "FLN", destination: "SYD", adults: 2, children: 1 });
  });

  it("assume um adulto e nenhuma criança", () => {
    const parsed = routeMonthsQuerySchema.parse({ origin: "FLN", destination: "SYD" });
    expect(parsed.adults).toBe(1);
    expect(parsed.children).toBe(0);
  });

  it("recusa IATA fora de três letras", () => {
    expect(() => routeMonthsQuerySchema.parse({ origin: "FL", destination: "SYD" })).toThrow();
  });

  it("recusa zero adultos", () => {
    expect(() =>
      routeMonthsQuerySchema.parse({ origin: "FLN", destination: "SYD", adults: "0" })
    ).toThrow();
  });

  it("recusa criança em número negativo", () => {
    expect(() =>
      routeMonthsQuerySchema.parse({ origin: "FLN", destination: "SYD", children: "-1" })
    ).toThrow();
  });
});

describe("routeOffersQuerySchema", () => {
  const base = { origin: "FLN", destination: "SYD", depart: "2027-02-11" };

  it("aceita ida só", () => {
    expect(routeOffersQuerySchema.parse(base).return).toBeUndefined();
  });

  it("aceita ida e volta", () => {
    expect(routeOffersQuerySchema.parse({ ...base, return: "2027-02-25" }).return).toBe(
      "2027-02-25"
    );
  });

  it("exige a data de ida", () => {
    expect(() => routeOffersQuerySchema.parse({ origin: "FLN", destination: "SYD" })).toThrow();
  });

  it("recusa data que não é ISO", () => {
    expect(() => routeOffersQuerySchema.parse({ ...base, depart: "11/02/2027" })).toThrow();
  });
});

describe("RoutesController", () => {
  it("months soma adultos e crianças em passageiros", async () => {
    const { controller, service } = controllerWith();
    await controller.months({ origin: "FLN", destination: "SYD", adults: 2, children: 1 });
    expect(service.monthsByRoute).toHaveBeenCalledWith(
      { originIata: "FLN", destinationIata: "SYD" },
      3
    );
  });

  it("months devolve a seção que o serviço deu", async () => {
    const { controller } = controllerWith();
    await expect(
      controller.months({ origin: "FLN", destination: "SYD", adults: 1, children: 0 })
    ).resolves.toEqual(emptySection);
  });

  it("offers repassa a rota, as datas e os passageiros", async () => {
    const { controller, service } = controllerWith();
    await controller.offers({
      origin: "FLN",
      destination: "SYD",
      depart: "2027-02-11",
      return: "2027-02-25",
      adults: 1,
      children: 0
    });
    expect(service.offersByRoute).toHaveBeenCalledWith({
      originIata: "FLN",
      destinationIata: "SYD",
      departDate: "2027-02-11",
      returnDate: "2027-02-25",
      adults: 1,
      children: 0
    });
  });

  it("offers sem volta manda returnDate undefined", async () => {
    const { controller, service } = controllerWith();
    await controller.offers({
      origin: "FLN",
      destination: "SYD",
      depart: "2027-02-11",
      adults: 1,
      children: 0
    });
    expect(service.offersByRoute.mock.calls[0]![0].returnDate).toBeUndefined();
  });

  it("offers devolve a seção que o serviço deu", async () => {
    const { controller } = controllerWith();
    await expect(
      controller.offers({
        origin: "FLN",
        destination: "SYD",
        depart: "2027-02-11",
        adults: 1,
        children: 0
      })
    ).resolves.toEqual(emptySection);
  });
});

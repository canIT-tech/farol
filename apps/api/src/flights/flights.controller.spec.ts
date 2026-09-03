import { describe, it, expect, vi } from "vitest";
import { FlightsController, flightSelectBodySchema } from "./flights.controller";
import type { FlightsService } from "./flights.service";

const user = { id: "u-1", email: "a@b.com" };

type Method =
  | "search"
  | "select"
  | "nearbyOptions"
  | "priceCalendar"
  | "latestPrices"
  | "monthlyPrices"
  | "cityDirections";

function controllerWith(over: Partial<Record<Method, ReturnType<typeof vi.fn>>> = {}) {
  const methods: Method[] = [
    "search",
    "select",
    "nearbyOptions",
    "priceCalendar",
    "latestPrices",
    "monthlyPrices",
    "cityDirections"
  ];
  const service = Object.fromEntries(
    methods.map((m) => [m, over[m] ?? vi.fn().mockResolvedValue({ offers: [], stale: false, error: null })])
  ) as Record<Method, ReturnType<typeof vi.fn>>;
  return {
    controller: new FlightsController(service as unknown as FlightsService),
    service
  };
}

describe("FlightsController", () => {
  it("GET delega para search com o id do usuário e da viagem", async () => {
    const { controller, service } = controllerWith({
      search: vi.fn().mockResolvedValue({ offers: [], stale: false, error: null })
    });
    await expect(controller.search(user, "t-1")).resolves.toEqual({
      offers: [],
      stale: false,
      error: null
    });
    expect(service.search).toHaveBeenCalledWith("u-1", "t-1");
  });

  it("POST select delega para select com o offerId do body", async () => {
    const { controller, service } = controllerWith({
      select: vi.fn().mockResolvedValue({ id: "sel-1" })
    });
    await expect(controller.select(user, "t-1", { offerId: "off-9" })).resolves.toEqual({
      id: "sel-1"
    });
    expect(service.select).toHaveBeenCalledWith("u-1", "t-1", "off-9");
  });

  it("GET nearby delega para nearbyOptions", async () => {
    const { controller, service } = controllerWith();
    await controller.nearby(user, "t-1");
    expect(service.nearbyOptions).toHaveBeenCalledWith("u-1", "t-1");
  });

  it("GET calendar delega para priceCalendar", async () => {
    const { controller, service } = controllerWith();
    await controller.calendar(user, "t-1");
    expect(service.priceCalendar).toHaveBeenCalledWith("u-1", "t-1");
  });

  it("GET latest delega para latestPrices", async () => {
    const { controller, service } = controllerWith();
    await controller.latest(user, "t-1");
    expect(service.latestPrices).toHaveBeenCalledWith("u-1", "t-1");
  });

  it("GET months delega para monthlyPrices", async () => {
    const { controller, service } = controllerWith();
    await controller.months(user, "t-1");
    expect(service.monthlyPrices).toHaveBeenCalledWith("u-1", "t-1");
  });

  it("GET directions delega para cityDirections", async () => {
    const { controller, service } = controllerWith();
    await controller.directions(user, "t-1");
    expect(service.cityDirections).toHaveBeenCalledWith("u-1", "t-1");
  });

  it("flightSelectBodySchema exige offerId não-vazio", () => {
    expect(flightSelectBodySchema.safeParse({ offerId: "x" }).success).toBe(true);
    expect(flightSelectBodySchema.safeParse({ offerId: "" }).success).toBe(false);
    expect(flightSelectBodySchema.safeParse({}).success).toBe(false);
  });
});

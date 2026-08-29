import { describe, it, expect, vi } from "vitest";
import { FlightsController, flightSelectBodySchema } from "./flights.controller";
import type { FlightsService } from "./flights.service";

const user = { id: "u-1", email: "a@b.com" };

function controllerWith(over: Partial<Record<"search" | "select", ReturnType<typeof vi.fn>>>) {
  const service = { search: over.search ?? vi.fn(), select: over.select ?? vi.fn() };
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

  it("flightSelectBodySchema exige offerId não-vazio", () => {
    expect(flightSelectBodySchema.safeParse({ offerId: "x" }).success).toBe(true);
    expect(flightSelectBodySchema.safeParse({ offerId: "" }).success).toBe(false);
    expect(flightSelectBodySchema.safeParse({}).success).toBe(false);
  });
});

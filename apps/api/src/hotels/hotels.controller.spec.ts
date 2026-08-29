import { describe, it, expect, vi } from "vitest";
import { HotelsController, hotelSelectBodySchema } from "./hotels.controller";
import type { HotelsService } from "./hotels.service";

const user = { id: "u-1", email: "a@b.com" };

function controllerWith(over: Partial<Record<"search" | "select", ReturnType<typeof vi.fn>>>) {
  const service = { search: over.search ?? vi.fn(), select: over.select ?? vi.fn() };
  return {
    controller: new HotelsController(service as unknown as HotelsService),
    service
  };
}

describe("HotelsController", () => {
  it("GET delega para search", async () => {
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

  it("POST select delega para select com o offerId", async () => {
    const { controller, service } = controllerWith({
      select: vi.fn().mockResolvedValue({ id: "sel-1" })
    });
    await expect(controller.select(user, "t-1", { offerId: "hot-9" })).resolves.toEqual({
      id: "sel-1"
    });
    expect(service.select).toHaveBeenCalledWith("u-1", "t-1", "hot-9");
  });

  it("hotelSelectBodySchema exige offerId não-vazio", () => {
    expect(hotelSelectBodySchema.safeParse({ offerId: "x" }).success).toBe(true);
    expect(hotelSelectBodySchema.safeParse({ offerId: "" }).success).toBe(false);
  });
});

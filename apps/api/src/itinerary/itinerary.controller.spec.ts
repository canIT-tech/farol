import { describe, it, expect, vi } from "vitest";
import { ItineraryController } from "./itinerary.controller";
import type { ItineraryService } from "./itinerary.service";

const user = { id: "u-1", email: "a@b.com" };

describe("ItineraryController", () => {
  it("POST /destination delega para chooseDestination", async () => {
    const chooseDestination = vi.fn().mockResolvedValue({ itineraryId: "it-1" });
    const controller = new ItineraryController({ chooseDestination } as unknown as ItineraryService);
    await expect(controller.choose(user, "t-1", { iata: "LIS" })).resolves.toEqual({
      itineraryId: "it-1"
    });
    expect(chooseDestination).toHaveBeenCalledWith("u-1", "t-1", "LIS");
  });

  it("GET /itinerary delega para getLatest", async () => {
    const getLatest = vi.fn().mockResolvedValue({ id: "it-1", status: "pending" });
    const controller = new ItineraryController({ getLatest } as unknown as ItineraryService);
    await expect(controller.latest(user, "t-1")).resolves.toMatchObject({ status: "pending" });
    expect(getLatest).toHaveBeenCalledWith("u-1", "t-1");
  });

  it("POST .../days/:dayIndex/regenerate delega convertendo dayIndex para número", async () => {
    const regenerateDay = vi.fn().mockResolvedValue(undefined);
    const controller = new ItineraryController({ regenerateDay } as unknown as ItineraryService);
    await controller.regenerateDay(user, "t-1", "2");
    expect(regenerateDay).toHaveBeenCalledWith("u-1", "t-1", 2);
  });

  it("POST .../items/:itemId/swap-restaurant delega para swapRestaurant", async () => {
    const swapRestaurant = vi.fn().mockResolvedValue({ id: "i-1", title: "Tasca" });
    const controller = new ItineraryController({ swapRestaurant } as unknown as ItineraryService);
    await expect(
      controller.swapRestaurant(user, "t-1", "i-1", { cuisine: "japonesa" })
    ).resolves.toMatchObject({ title: "Tasca" });
    expect(swapRestaurant).toHaveBeenCalledWith("u-1", "t-1", "i-1", { cuisine: "japonesa" });
  });
});

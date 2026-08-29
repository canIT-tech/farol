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
});

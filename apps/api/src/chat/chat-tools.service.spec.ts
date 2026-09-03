import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatToolService } from "./chat-tools.service";
import type { TripsService } from "../trips/trips.service";
import type { ItineraryService } from "../itinerary/itinerary.service";
import type { ProfileService } from "../profile/profile.service";
import type { HotelsService } from "../hotels/hotels.service";
import type { FlightsService } from "../flights/flights.service";
import { CHAT_TOOLS } from "./chat-tools.types";

describe("ChatToolService", () => {
  let service: ChatToolService;
  let mockTrips: any;
  let mockItinerary: any;
  let mockProfile: any;
  let mockHotels: any;
  let mockFlights: any;

  beforeEach(() => {
    mockTrips = {
      updateDates: vi.fn().mockResolvedValue(undefined),
      updateBudget: vi.fn().mockResolvedValue(undefined)
    };
    mockItinerary = {
      chooseDestination: vi.fn().mockResolvedValue({ itineraryId: "it-1" }),
      regenerateDay: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
      pinItem: vi.fn().mockResolvedValue(undefined),
      swapRestaurant: vi.fn().mockResolvedValue({ id: "item-1", title: "Novo Restaurante" })
    };
    mockProfile = {
      addInterest: vi.fn().mockResolvedValue({ interests: ["praia"] }),
      removeInterest: vi.fn().mockResolvedValue({ interests: [] })
    };
    mockHotels = {
      search: vi.fn().mockResolvedValue({ offers: [{ id: "h1", name: "Hotel Sol" }], error: null })
    };
    mockFlights = {
      search: vi.fn().mockResolvedValue({ offers: [{ id: "f1", price: 500 }], error: null }),
      priceCalendar: vi.fn().mockResolvedValue({ offers: [{ departDate: "2026-11-04" }], error: null }),
      monthlyPrices: vi.fn().mockResolvedValue({ offers: [{ key: "2026-11" }], error: null }),
      latestPrices: vi.fn().mockResolvedValue({ offers: [{ price: 3198 }], error: null }),
      nearbyOptions: vi.fn().mockResolvedValue({ offers: [{ id: "np:SAO:LIS" }], error: null }),
      cityDirections: vi.fn().mockResolvedValue({ offers: [{ destination: "RIO" }], error: null })
    };


    service = new ChatToolService(
      mockTrips as unknown as TripsService,
      mockItinerary as unknown as ItineraryService,
      mockProfile as unknown as ProfileService,
      mockHotels as unknown as HotelsService,
      mockFlights as unknown as FlightsService
    );
  });

  it("returns all tool definitions", () => {
    expect(service.getToolDefinitions()).toEqual(CHAT_TOOLS);
  });

  it("executes set_destination", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "set_destination",
      args: { iata: "FOR" }
    });
    expect(mockItinerary.chooseDestination).toHaveBeenCalledWith("u1", "t1", "FOR");
    expect(res.success).toBe(true);
  });

  it("executes shift_dates", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "shift_dates",
      args: { dateStart: "2026-10-01", dateEnd: "2026-10-10" }
    });
    expect(mockTrips.updateDates).toHaveBeenCalledWith("u1", "t1", {
      dateStart: "2026-10-01",
      dateEnd: "2026-10-10",
      durationDays: undefined
    });
    expect(res.success).toBe(true);
  });

  it("executes set_budget", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "set_budget",
      args: { budgetTotal: 5000 }
    });
    expect(mockTrips.updateBudget).toHaveBeenCalledWith("u1", "t1", 5000);
    expect(res.success).toBe(true);
  });

  it("executes add_interest", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "add_interest",
      args: { tag: "praia" }
    });
    expect(mockProfile.addInterest).toHaveBeenCalledWith("u1", "praia");
    expect(res.success).toBe(true);
  });

  it("executes remove_interest", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "remove_interest",
      args: { tag: "museus" }
    });
    expect(mockProfile.removeInterest).toHaveBeenCalledWith("u1", "museus");
    expect(res.success).toBe(true);
  });

  it("executes regenerate_day", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "regenerate_day",
      args: { dayIndex: 2 }
    });
    expect(mockItinerary.regenerateDay).toHaveBeenCalledWith("u1", "t1", 2);
    expect(res.success).toBe(true);
  });

  it("executes remove_item", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "remove_item",
      args: { itemId: "item-1" }
    });
    expect(mockItinerary.removeItem).toHaveBeenCalledWith("u1", "t1", "item-1");
    expect(res.success).toBe(true);
  });

  it("executes pin_item", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "pin_item",
      args: { itemId: "item-1", pinned: true }
    });
    expect(mockItinerary.pinItem).toHaveBeenCalledWith("u1", "t1", "item-1", true);
    expect(res.success).toBe(true);
  });

  it("executes find_hotel", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "find_hotel",
      args: { near: "beira-mar" }
    });
    expect(mockHotels.search).toHaveBeenCalledWith("u1", "t1");
    expect(res.success).toBe(true);
  });

  it("executes swap_restaurant", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "swap_restaurant",
      args: { itemId: "item-1", cuisine: "italiana" }
    });
    expect(mockItinerary.swapRestaurant).toHaveBeenCalledWith("u1", "t1", "item-1", {
      cuisine: "italiana"
    });
    expect(res.success).toBe(true);
  });

  it("executes search_flights", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "search_flights",
      args: {}
    });
    expect(mockFlights.search).toHaveBeenCalledWith("u1", "t1");
    expect(res.success).toBe(true);
  });

  it("executes shift_dates with durationDays", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "shift_dates",
      args: { durationDays: 5 }
    });
    expect(mockTrips.updateDates).toHaveBeenCalledWith("u1", "t1", {
      dateStart: undefined,
      dateEnd: undefined,
      durationDays: 5
    });
    expect(res.success).toBe(true);
  });

  it("executes pin_item with default pinned", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "pin_item",
      args: { itemId: "item-1" }
    });
    expect(mockItinerary.pinItem).toHaveBeenCalledWith("u1", "t1", "item-1", true);
    expect(res.success).toBe(true);
  });

  it("executes swap_restaurant without cuisine", async () => {
    const res = await service.executeTool("u1", "t1", {
      name: "swap_restaurant",
      args: { itemId: "item-1" }
    });
    expect(mockItinerary.swapRestaurant).toHaveBeenCalledWith("u1", "t1", "item-1", {
      cuisine: undefined
    });
    expect(res.success).toBe(true);
  });

  it("handles unknown tool gracefully", async () => {

    const res = await service.executeTool("u1", "t1", {
      name: "unknown_tool",
      args: {}
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Ferramenta desconhecida: unknown_tool");
  });

  it("catches domain errors thrown during tool execution", async () => {
    mockItinerary.removeItem.mockRejectedValueOnce(new Error("item não existe"));
    const res = await service.executeTool("u1", "t1", {
      name: "remove_item",
      args: { itemId: "item-bad" }
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("item não existe");
  });
  it.each([
    ["price_calendar", "priceCalendar"],
    ["best_months", "monthlyPrices"],
    ["price_range", "latestPrices"],
    ["nearby_airports", "nearbyOptions"],
    ["cheap_destinations", "cityDirections"]
  ])("executa a tool %s no FlightsService.%s", async (tool, method) => {
    const res = await service.executeTool("u1", "t1", { name: tool, args: {} });
    expect(mockFlights[method]).toHaveBeenCalledWith("u1", "t1");
    expect(res.success).toBe(true);
    expect(res.data).toEqual(await mockFlights[method].mock.results[0]!.value);
  });

});

describe("CHAT_TOOLS", () => {
  it("expõe as 16 tools com parameters em zod", () => {
    expect(CHAT_TOOLS).toHaveLength(16);
    for (const spec of CHAT_TOOLS) {
      expect(typeof spec.name).toBe("string");
      expect(spec.description.length).toBeGreaterThan(0);
      expect(typeof spec.parameters.parse).toBe("function");
    }
  });

  it("set_destination valida iata", () => {
    const spec = CHAT_TOOLS.find((t) => t.name === "set_destination")!;
    expect(spec.parameters.safeParse({ iata: "LIS" }).success).toBe(true);
    expect(spec.parameters.safeParse({}).success).toBe(false);
  });

  it("set_budget exige número", () => {
    const spec = CHAT_TOOLS.find((t) => t.name === "set_budget")!;
    expect(spec.parameters.safeParse({ budgetTotal: 5000 }).success).toBe(true);
    expect(spec.parameters.safeParse({ budgetTotal: "muito" }).success).toBe(false);
  });

  it("campos fora de required seguem opcionais", () => {
    const spec = CHAT_TOOLS.find((t) => t.name === "swap_restaurant")!;
    expect(spec.parameters.safeParse({ itemId: "i-1" }).success).toBe(true);
    expect(spec.parameters.safeParse({}).success).toBe(false);
  });

  it("search_flights não tem parâmetro", () => {
    const spec = CHAT_TOOLS.find((t) => t.name === "search_flights")!;
    expect(spec.parameters.safeParse({}).success).toBe(true);
  });
});

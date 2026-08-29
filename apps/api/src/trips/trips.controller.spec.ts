import { describe, it, expect, vi } from "vitest";
import { TripsController } from "./trips.controller";
import type { TripsService } from "./trips.service";
import type { TripInput } from "@farol/shared";

const user = { id: "u-1", email: "a@b.com" };
const input: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 15000,
  currency: "BRL",
  durationDays: 7,
  targetMonth: "2026-09"
};

function controllerWith(over: Partial<Record<"create" | "list" | "get", ReturnType<typeof vi.fn>>>) {
  const service = {
    create: over.create ?? vi.fn(),
    list: over.list ?? vi.fn(),
    get: over.get ?? vi.fn()
  };
  return { controller: new TripsController(service as unknown as TripsService), service };
}

describe("TripsController", () => {
  it("POST delega para create com o id do usuário e o body", async () => {
    const { controller, service } = controllerWith({ create: vi.fn().mockResolvedValue({ id: "t-1" }) });
    await expect(controller.create(user, input)).resolves.toEqual({ id: "t-1" });
    expect(service.create).toHaveBeenCalledWith("u-1", input);
  });

  it("GET / delega para list com o id do usuário", async () => {
    const { controller, service } = controllerWith({ list: vi.fn().mockResolvedValue([]) });
    await expect(controller.list(user)).resolves.toEqual([]);
    expect(service.list).toHaveBeenCalledWith("u-1");
  });

  it("GET /:id delega para get com o id do usuário e o id da viagem", async () => {
    const { controller, service } = controllerWith({ get: vi.fn().mockResolvedValue({ id: "t-9" }) });
    await expect(controller.get(user, "t-9")).resolves.toEqual({ id: "t-9" });
    expect(service.get).toHaveBeenCalledWith("u-1", "t-9");
  });
});

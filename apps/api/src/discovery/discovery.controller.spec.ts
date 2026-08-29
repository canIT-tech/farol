import { describe, it, expect, vi } from "vitest";
import { DiscoveryController } from "./discovery.controller";
import type { DiscoveryService } from "./discovery.service";

describe("DiscoveryController", () => {
  it("delega para DiscoveryService.run com o id do usuário e da viagem", async () => {
    const run = vi.fn().mockResolvedValue([{ iata: "LIS" }]);
    const controller = new DiscoveryController({ run } as unknown as DiscoveryService);
    await expect(controller.run({ id: "u-1", email: "a@b.com" }, "t-1")).resolves.toEqual([
      { iata: "LIS" }
    ]);
    expect(run).toHaveBeenCalledWith("u-1", "t-1");
  });
});

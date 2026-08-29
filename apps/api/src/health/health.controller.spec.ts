import { describe, it, expect, vi } from "vitest";
import { HealthController } from "./health.controller";
import type { HealthService } from "./health.service";

describe("HealthController", () => {
  it("delega para HealthService.check", async () => {
    const payload = { status: "ok" as const, checks: { db: "up" as const }, version: "1.0.0" };
    const service = { check: vi.fn().mockResolvedValue(payload) };
    const controller = new HealthController(service as unknown as HealthService);
    await expect(controller.get()).resolves.toEqual(payload);
    expect(service.check).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect, vi } from "vitest";
import { HealthController } from "./health.controller";
import type { HealthService } from "./health.service";

function setup(status: "ok" | "degraded") {
  const payload = {
    status,
    checks: { db: status === "ok" ? ("up" as const) : ("down" as const) },
    version: "1.0.0",
    sha: "abc123"
  };
  const service = { check: vi.fn().mockResolvedValue(payload) };
  const res = { status: vi.fn() };
  const controller = new HealthController(service as unknown as HealthService);
  return { payload, service, res, controller };
}

describe("HealthController", () => {
  it("delega para HealthService.check e responde 200 quando ok", async () => {
    const { payload, service, res, controller } = setup("ok");
    await expect(controller.get(res)).resolves.toEqual(payload);
    expect(service.check).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("responde 503 quando degraded, com o mesmo corpo", async () => {
    const { payload, res, controller } = setup("degraded");
    await expect(controller.get(res)).resolves.toEqual(payload);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});

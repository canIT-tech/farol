import { describe, it, expect, vi } from "vitest";
import type { WaitlistService } from "./waitlist.service";
import { WaitlistController } from "./waitlist.controller";

describe("WaitlistController", () => {
  it("POST delega para WaitlistService.signup com o body", async () => {
    const signup = vi.fn().mockResolvedValue({ ok: true, created: true });
    const controller = new WaitlistController({ signup } as unknown as WaitlistService);
    const body = { email: "ana@farol.app", source: "landing-hero" };
    await expect(controller.signup(body)).resolves.toEqual({ ok: true, created: true });
    expect(signup).toHaveBeenCalledWith(body);
  });

  it("GET count delega para WaitlistService.count", async () => {
    const count = vi.fn().mockResolvedValue({ count: 7 });
    const controller = new WaitlistController({ count } as unknown as WaitlistService);
    await expect(controller.count()).resolves.toEqual({ count: 7 });
    expect(count).toHaveBeenCalledOnce();
  });
});

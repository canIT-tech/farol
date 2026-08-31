import { describe, it, expect, vi } from "vitest";
import type { WaitlistRepository } from "./waitlist.repository";
import { WaitlistService } from "./waitlist.service";

function make(repo: Partial<WaitlistRepository>) {
  return new WaitlistService(repo as WaitlistRepository);
}

describe("WaitlistService", () => {
  it("signup repassa e-mail e source ao repo e devolve created=true", async () => {
    const add = vi.fn().mockResolvedValue(true);
    const service = make({ add });
    await expect(service.signup({ email: "ana@farol.app", source: "landing-hero" })).resolves.toEqual({
      ok: true,
      created: true
    });
    expect(add).toHaveBeenCalledWith("ana@farol.app", "landing-hero");
  });

  it("signup sem source manda null ao repo", async () => {
    const add = vi.fn().mockResolvedValue(true);
    const service = make({ add });
    await service.signup({ email: "ana@farol.app" });
    expect(add).toHaveBeenCalledWith("ana@farol.app", null);
  });

  it("signup devolve created=false quando o repo diz que já existia", async () => {
    const service = make({ add: vi.fn().mockResolvedValue(false) });
    await expect(service.signup({ email: "ana@farol.app" })).resolves.toEqual({
      ok: true,
      created: false
    });
  });

  it("count envelopa o número do repo", async () => {
    const service = make({ count: vi.fn().mockResolvedValue(42) });
    await expect(service.count()).resolves.toEqual({ count: 42 });
  });
});

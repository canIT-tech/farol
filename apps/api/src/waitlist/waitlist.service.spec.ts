import { describe, it, expect, vi, afterEach } from "vitest";
import { FakeEmailProvider } from "../email/fake-email.provider";
import type { EmailPort } from "../email/email.types";
import type { WaitlistRepository } from "./waitlist.repository";
import { WaitlistService } from "./waitlist.service";

function make(repo: Partial<WaitlistRepository>, email: EmailPort = new FakeEmailProvider()) {
  return new WaitlistService({ markWelcomeSent: vi.fn(), ...repo } as WaitlistRepository, email);
}

afterEach(() => vi.restoreAllMocks());

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

  it("cadastro novo manda o e-mail de boas-vindas e marca welcome_sent_at", async () => {
    const fake = new FakeEmailProvider();
    const markWelcomeSent = vi.fn().mockResolvedValue(undefined);
    const service = make({ add: vi.fn().mockResolvedValue(true), markWelcomeSent }, fake);

    await service.signup({ email: "ana@farol.app" });

    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]!.to).toBe("ana@farol.app");
    expect(fake.sent[0]!.subject).toBe("Você está na lista do Farol");
    expect(markWelcomeSent).toHaveBeenCalledWith("ana@farol.app");
  });

  it("e-mail repetido não reenvia boas-vindas", async () => {
    const fake = new FakeEmailProvider();
    const markWelcomeSent = vi.fn();
    const service = make({ add: vi.fn().mockResolvedValue(false), markWelcomeSent }, fake);

    await service.signup({ email: "ana@farol.app" });

    expect(fake.sent).toEqual([]);
    expect(markWelcomeSent).not.toHaveBeenCalled();
  });

  it("falha no envio não falha o cadastro: loga e não marca", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const markWelcomeSent = vi.fn();
    const failing: EmailPort = { send: vi.fn().mockRejectedValue(new Error("resend caiu")) };
    const service = make({ add: vi.fn().mockResolvedValue(true), markWelcomeSent }, failing);

    await expect(service.signup({ email: "ana@farol.app" })).resolves.toEqual({ ok: true, created: true });

    expect(markWelcomeSent).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    expect(JSON.parse(error.mock.calls[0]![0] as string)).toEqual({
      event: "waitlist_welcome_failed",
      message: "resend caiu"
    });
  });

  it("falha ao marcar welcome_sent_at também é engolida e logada", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const markWelcomeSent = vi.fn().mockRejectedValue(new Error("db fora"));
    const service = make({ add: vi.fn().mockResolvedValue(true), markWelcomeSent });

    await expect(service.signup({ email: "ana@farol.app" })).resolves.toEqual({ ok: true, created: true });
    expect(JSON.parse(error.mock.calls[0]![0] as string).message).toBe("db fora");
  });

  it("count envelopa o número do repo", async () => {
    const service = make({ count: vi.fn().mockResolvedValue(42) });
    await expect(service.count()).resolves.toEqual({ count: 42 });
  });
});

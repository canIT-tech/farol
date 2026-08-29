import { describe, it, expect, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import type { JwtVerifier } from "./jwt-verifier";
import type { UserUpsertService } from "./user-upsert.service";

function makeCtx(authorization?: string): { ctx: ExecutionContext; req: Record<string, unknown> } {
  const req: Record<string, unknown> = { headers: authorization === undefined ? {} : { authorization } };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req })
  } as unknown as ExecutionContext;
  return { ctx, req };
}

function makeGuard(overrides?: {
  verify?: ReturnType<typeof vi.fn>;
  ensure?: ReturnType<typeof vi.fn>;
}) {
  const verify = overrides?.verify ?? vi.fn().mockResolvedValue({ sub: "u-1", email: "a@b.com" });
  const ensure = overrides?.ensure ?? vi.fn().mockResolvedValue(undefined);
  const guard = new AuthGuard(
    { verify } as unknown as JwtVerifier,
    { ensure } as unknown as UserUpsertService
  );
  return { guard, verify, ensure };
}

describe("AuthGuard", () => {
  it("libera e injeta currentUser quando o token é válido", async () => {
    const { guard, verify, ensure } = makeGuard();
    const { ctx, req } = makeCtx("Bearer tok-123");

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith("tok-123");
    expect(ensure).toHaveBeenCalledWith({ id: "u-1", email: "a@b.com" });
    expect(req.currentUser).toEqual({ id: "u-1", email: "a@b.com" });
  });

  it("rejeita quando não há header Authorization", async () => {
    const { guard, verify } = makeGuard();
    const { ctx } = makeCtx(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow("token ausente");
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejeita quando o header não começa com 'Bearer '", async () => {
    const { guard, verify } = makeGuard();
    const { ctx } = makeCtx("Basic abc123");
    await expect(guard.canActivate(ctx)).rejects.toThrow("token ausente");
    expect(verify).not.toHaveBeenCalled();
  });

  it("propaga o erro do verifier (token inválido)", async () => {
    const verify = vi.fn().mockRejectedValue(new Error("token inválido"));
    const { guard, ensure } = makeGuard({ verify });
    const { ctx } = makeCtx("Bearer ruim");
    await expect(guard.canActivate(ctx)).rejects.toThrow("token inválido");
    expect(ensure).not.toHaveBeenCalled();
  });

  it("não define currentUser quando o upsert falha", async () => {
    const ensure = vi.fn().mockRejectedValue(new Error("db down"));
    const { guard } = makeGuard({ ensure });
    const { ctx, req } = makeCtx("Bearer tok");
    await expect(guard.canActivate(ctx)).rejects.toThrow("db down");
    expect(req.currentUser).toBeUndefined();
  });
});

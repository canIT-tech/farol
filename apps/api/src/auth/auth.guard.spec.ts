import { describe, it, expect, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC } from "./public.decorator";
import { AuthGuard } from "./auth.guard";
import type { JwtVerifier } from "./jwt-verifier";
import type { UserUpsertService } from "./user-upsert.service";

function makeCtx(authorization?: string): { ctx: ExecutionContext; req: Record<string, unknown> } {
  const req: Record<string, unknown> = { headers: authorization === undefined ? {} : { authorization } };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handlerRef,
    getClass: () => classRef
  } as unknown as ExecutionContext;
  return { ctx, req };
}

// Alvos estáveis para o Reflector: o guard pergunta pelo handler e pela classe,
// então os testes só precisam de duas referências distintas.
const handlerRef = function livre() {};
const classRef = class Controller {};

function makeGuard(overrides?: {
  verify?: ReturnType<typeof vi.fn>;
  ensure?: ReturnType<typeof vi.fn>;
}) {
  const verify = overrides?.verify ?? vi.fn().mockResolvedValue({ sub: "u-1", email: "a@b.com" });
  const ensure = overrides?.ensure ?? vi.fn().mockResolvedValue(undefined);
  const guard = new AuthGuard(
    { verify } as unknown as JwtVerifier,
    { ensure } as unknown as UserUpsertService,
    new Reflector()
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

describe("AuthGuard e rotas públicas", () => {
  function guardComPublico(alvo: "handler" | "classe") {
    // makeGuard só serve para reaproveitar os dublês; o guard vem montado
    // abaixo, com um Reflector que responde pelo alvo marcado.
    const { verify, ensure } = makeGuard();
    const reflector = new Reflector();
    vi.spyOn(reflector, "get").mockImplementation((key: unknown, target: unknown) => {
      const marcado = alvo === "handler" ? handlerRef : classRef;
      return key === IS_PUBLIC && target === marcado ? true : undefined;
    });
    return {
      guard: new AuthGuard(
        { verify } as unknown as JwtVerifier,
        { ensure } as unknown as UserUpsertService,
        reflector
      ),
      verify,
      ensure
    };
  }

  it("libera uma rota marcada no método, sem token", async () => {
    const { guard, verify } = guardComPublico("handler");
    const { ctx } = makeCtx();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it("libera um controller inteiro marcado", async () => {
    const { guard, verify } = guardComPublico("classe");
    const { ctx } = makeCtx();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  // Aberta não quer dizer anônima à força: quem manda um token válido numa rota
  // pública continua sendo identificado, sem virar erro.
  it("não recusa quem manda token válido numa rota pública", async () => {
    const { guard } = guardComPublico("handler");
    const { ctx } = makeCtx("Bearer bom");
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("segue exigindo credencial em rota não marcada", async () => {
    const { guard } = makeGuard();
    const { ctx } = makeCtx();
    await expect(guard.canActivate(ctx)).rejects.toThrow(/token ausente/);
  });
});

import { describe, it, expect } from "vitest";
import { CircuitBreaker, CircuitOpenError } from "./circuit-breaker.js";

const ok = () => Promise.resolve("ok");
const fail = () => Promise.reject(new Error("boom"));

describe("CircuitBreaker", () => {
  it("no estado closed executa e devolve o resultado", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 });
    await expect(cb.exec(ok)).resolves.toBe("ok");
    expect(cb.currentState).toBe("closed");
  });

  it("propaga o erro de fn e só abre ao atingir failureThreshold", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 });
    await expect(cb.exec(fail)).rejects.toThrow("boom");
    expect(cb.currentState).toBe("closed");
    await expect(cb.exec(fail)).rejects.toThrow("boom");
    expect(cb.currentState).toBe("open");
  });

  it("abre exatamente no limite (>=), não antes", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000 });
    await expect(cb.exec(fail)).rejects.toThrow();
    await expect(cb.exec(fail)).rejects.toThrow();
    expect(cb.currentState).toBe("closed");
    await expect(cb.exec(fail)).rejects.toThrow();
    expect(cb.currentState).toBe("open");
  });

  it("um sucesso zera o contador de falhas", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 });
    await expect(cb.exec(fail)).rejects.toThrow();
    await expect(cb.exec(ok)).resolves.toBe("ok");
    await expect(cb.exec(fail)).rejects.toThrow();
    expect(cb.currentState).toBe("closed");
  });

  it("enquanto aberto e dentro do cooldown rejeita rápido sem chamar fn", async () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: () => now });
    await expect(cb.exec(fail)).rejects.toThrow("boom");
    expect(cb.currentState).toBe("open");

    let called = false;
    now = 999;
    await expect(
      cb.exec(() => {
        called = true;
        return Promise.resolve("x");
      })
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(called).toBe(false);
  });

  it("CircuitOpenError tem name e mensagem próprios", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: () => 0 });
    await expect(cb.exec(fail)).rejects.toThrow();
    await cb.exec(ok).then(
      () => expect.unreachable("deveria rejeitar"),
      (err: unknown) => {
        expect(err).toBeInstanceOf(CircuitOpenError);
        expect((err as Error).name).toBe("CircuitOpenError");
        expect((err as Error).message).toBe("circuito aberto — provider indisponível");
      }
    );
  });

  it("passado o cooldown deixa uma chamada passar; sucesso fecha", async () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: () => now });
    await expect(cb.exec(fail)).rejects.toThrow();

    now = 1000; // cooldown vencido (>=)
    await expect(cb.exec(ok)).resolves.toBe("ok");
    expect(cb.currentState).toBe("closed");
  });

  it("no limite exato do cooldown ainda rejeita (< estrito)", async () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: () => now });
    await expect(cb.exec(fail)).rejects.toThrow();
    now = 999;
    await expect(cb.exec(ok)).rejects.toBeInstanceOf(CircuitOpenError);
    now = 1000;
    await expect(cb.exec(ok)).resolves.toBe("ok");
  });

  it("passado o cooldown, se a chamada falha, reabre com novo cooldown", async () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: () => now });
    await expect(cb.exec(fail)).rejects.toThrow();

    now = 1000;
    await expect(cb.exec(fail)).rejects.toThrow("boom");
    expect(cb.currentState).toBe("open");

    // novo cooldown a partir de now=1000 → em now=1500 ainda rejeita rápido
    now = 1500;
    let called = false;
    await expect(
      cb.exec(() => {
        called = true;
        return Promise.resolve("x");
      })
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(called).toBe(false);
  });

  it("usa Date.now real quando now não é injetado", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 10_000 });
    await expect(cb.exec(fail)).rejects.toThrow();
    // aberto agora mesmo → cooldown de 10s ainda válido → rejeita rápido
    await expect(cb.exec(ok)).rejects.toBeInstanceOf(CircuitOpenError);
  });
});

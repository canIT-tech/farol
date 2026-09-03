import pRetry from "p-retry";
import { CircuitBreaker, type CircuitBreakerConfig } from "./circuit-breaker.js";

export interface ResilientCallConfig extends Partial<CircuitBreakerConfig> {
  retries?: number;
  retryMinTimeoutMs?: number;
}

// CircuitBreaker + p-retry, mesma política nos dois providers HTTP (Travelpayouts
// e LiteAPI): p-retry em erro transitório, tudo dentro de um breaker compartilhado.
export function createResilientCall(cfg: ResilientCallConfig): {
  run: <T>(fn: () => Promise<T>, isRetryable: (error: unknown) => boolean) => Promise<T>;
} {
  const breaker = new CircuitBreaker({
    failureThreshold: cfg.failureThreshold ?? 5,
    cooldownMs: cfg.cooldownMs ?? 30_000,
    now: cfg.now
  });
  const retries = cfg.retries ?? 3;
  const minTimeout = cfg.retryMinTimeoutMs ?? 300;

  return {
    run<T>(fn: () => Promise<T>, isRetryable: (error: unknown) => boolean): Promise<T> {
      return breaker.exec(() =>
        pRetry(fn, {
          retries,
          minTimeout,
          factor: 2,
          shouldRetry: ({ error }) => isRetryable(error)
        })
      );
    }
  };
}

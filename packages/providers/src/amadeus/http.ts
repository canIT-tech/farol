import pRetry from "p-retry";
import { AmadeusAuth } from "./amadeus-auth";
import { CircuitBreaker } from "../http/circuit-breaker";

export interface AmadeusHttpConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  retries?: number;
  retryMinTimeoutMs?: number;
  failureThreshold?: number;
  cooldownMs?: number;
}

export class AmadeusHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`Amadeus respondeu ${status}`);
    this.name = "AmadeusHttpError";
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

export interface AmadeusHttp {
  get<T>(path: string, query: Record<string, string>): Promise<T>;
}

// Cliente GET do Amadeus (design §7.2): Bearer do AmadeusAuth, p-retry em
// 429/5xx e erro de rede, tudo dentro de um CircuitBreaker.
export function createAmadeusHttp(cfg: AmadeusHttpConfig): AmadeusHttp {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const auth = new AmadeusAuth(cfg);
  const breaker = new CircuitBreaker({
    failureThreshold: cfg.failureThreshold ?? 5,
    cooldownMs: cfg.cooldownMs ?? 30_000,
    now: cfg.now
  });
  const retries = cfg.retries ?? 3;
  const minTimeout = cfg.retryMinTimeoutMs ?? 300;

  async function doGet<T>(path: string, query: Record<string, string>): Promise<T> {
    const token = await auth.getToken();
    const qs = new URLSearchParams(query).toString();
    const res = await fetchImpl(`${cfg.baseUrl}${path}?${qs}`, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      return (await res.json()) as T;
    }
    throw new AmadeusHttpError(res.status, await res.text());
  }

  return {
    get<T>(path: string, query: Record<string, string>): Promise<T> {
      return breaker.exec(() =>
        pRetry(() => doGet<T>(path, query), {
          retries,
          minTimeout,
          factor: 2,
          shouldRetry: ({ error }) =>
            error instanceof AmadeusHttpError && isRetryableStatus(error.status)
        })
      );
    }
  };
}

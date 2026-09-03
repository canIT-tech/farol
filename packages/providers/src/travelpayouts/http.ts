import pRetry from "p-retry";
import { CircuitBreaker } from "../http/circuit-breaker.js";
import { isRetryableStatus } from "../http/retry.js";

export interface TravelpayoutsHttpConfig {
  /** Base da Data API. Default: https://api.travelpayouts.com */
  baseUrl?: string;
  /** Token da conta. Vai no header X-Access-Token. */
  token: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  retries?: number;
  retryMinTimeoutMs?: number;
  failureThreshold?: number;
  cooldownMs?: number;
}

export const TRAVELPAYOUTS_BASE_URL = "https://api.travelpayouts.com";

export class TravelpayoutsHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`Travelpayouts respondeu ${status}`);
    this.name = "TravelpayoutsHttpError";
  }
}

export type Query = Record<string, string | number | boolean | undefined>;

// Query string do Travelpayouts: chave com valor undefined é omitida (os
// endpoints tratam param vazio como filtro, não como ausência).
export function buildQuery(query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export interface TravelpayoutsHttp {
  /** JSON de um path relativo à baseUrl, ou de uma URL absoluta. */
  get<T>(path: string, query?: Query): Promise<T>;
  /** Corpo cru — o /whereami devolve JSONP, não JSON. */
  getText(path: string, query?: Query): Promise<string>;
}

// Cliente GET do Travelpayouts (spec de migração §6). Sem OAuth: o token vai no
// header X-Access-Token. p-retry em 429/5xx e erro de rede, tudo dentro de um
// CircuitBreaker compartilhado entre os endpoints.
export function createTravelpayoutsHttp(cfg: TravelpayoutsHttpConfig): TravelpayoutsHttp {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const baseUrl = cfg.baseUrl ?? TRAVELPAYOUTS_BASE_URL;
  const breaker = new CircuitBreaker({
    failureThreshold: cfg.failureThreshold ?? 5,
    cooldownMs: cfg.cooldownMs ?? 30_000,
    now: cfg.now
  });
  const retries = cfg.retries ?? 3;
  const minTimeout = cfg.retryMinTimeoutMs ?? 300;

  function resolve(path: string, query: Query): string {
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    const qs = buildQuery(query);
    return qs === "" ? url : `${url}?${qs}`;
  }

  async function doGet(path: string, query: Query): Promise<Response> {
    const res = await fetchImpl(resolve(path, query), {
      headers: { "x-access-token": cfg.token }
    });
    if (res.ok) {
      return res;
    }
    throw new TravelpayoutsHttpError(res.status, await res.text());
  }

  function run<T>(path: string, query: Query, read: (res: Response) => Promise<T>): Promise<T> {
    return breaker.exec(() =>
      pRetry(async () => read(await doGet(path, query)), {
        retries,
        minTimeout,
        factor: 2,
        shouldRetry: ({ error }) =>
          error instanceof TravelpayoutsHttpError && isRetryableStatus(error.status)
      })
    );
  }

  return {
    get<T>(path: string, query: Query = {}): Promise<T> {
      return run(path, query, (res) => res.json() as Promise<T>);
    },
    getText(path: string, query: Query = {}): Promise<string> {
      return run(path, query, (res) => res.text());
    }
  };
}

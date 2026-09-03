import { createResilientCall } from "../http/resilient-call.js";
import { isRetryableStatus } from "../http/retry.js";
import { buildQuery, type Query } from "../http/query.js";

export const LITEAPI_BASE_URL = "https://api.liteapi.travel/v3.0";

export interface LiteApiHttpConfig {
  baseUrl?: string;
  /** Chave da conta. Vai no header X-API-Key. Sandbox começa com "sand_". */
  apiKey: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  retries?: number;
  retryMinTimeoutMs?: number;
  failureThreshold?: number;
  cooldownMs?: number;
}

export class LiteApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`LiteAPI respondeu ${status}`);
    this.name = "LiteApiHttpError";
  }
}

export interface LiteApiHttp {
  get<T>(path: string, query?: Query): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

// Cliente da LiteAPI. Mesma política dos outros providers: p-retry em 429/5xx e
// erro de rede, tudo dentro de um CircuitBreaker. O sandbox limita a 5 req/s,
// então 429 é um caso esperado, não excepcional.
export function createLiteApiHttp(cfg: LiteApiHttpConfig): LiteApiHttp {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const baseUrl = cfg.baseUrl ?? LITEAPI_BASE_URL;
  const resilient = createResilientCall(cfg);

  async function send<T>(path: string, init: RequestInit, query: Query): Promise<T> {
    const qs = buildQuery(query);
    const url = qs === "" ? `${baseUrl}${path}` : `${baseUrl}${path}?${qs}`;
    const res = await fetchImpl(url, {
      ...init,
      headers: { ...init.headers, "x-api-key": cfg.apiKey }
    });
    if (!res.ok) {
      throw new LiteApiHttpError(res.status, await res.text());
    }
    return (await res.json()) as T;
  }

  function run<T>(path: string, init: RequestInit, query: Query): Promise<T> {
    return resilient.run(
      () => send<T>(path, init, query),
      (error) => error instanceof LiteApiHttpError && isRetryableStatus(error.status)
    );
  }

  return {
    get<T>(path: string, query: Query = {}): Promise<T> {
      return run<T>(path, { method: "GET" }, query);
    },
    post<T>(path: string, body: unknown): Promise<T> {
      return run<T>(
        path,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        },
        {}
      );
    }
  };
}

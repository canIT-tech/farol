import { createResilientCall } from "../http/resilient-call.js";
import { isRetryableStatus } from "../http/retry.js";
import type { ResilientCallConfig } from "../http/resilient-call.js";

export const GOOGLE_FLIGHTS_URL = "https://www.google.com/travel/flights";

/** Chrome recente em macOS. O Google serve uma página degradada, sem o script
 *  de dados, para clientes que não se apresentam como browser. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const DEFAULT_LOCALE = "pt-BR";

export interface GoogleFlightsHttpConfig extends ResilientCallConfig {
  fetchImpl?: typeof fetch;
  /** Vai no accept-language; o Google usa para os nomes de aeroporto. */
  locale?: string;
}

export class GoogleFlightsHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`Google Flights respondeu ${status}`);
    this.name = "GoogleFlightsHttpError";
  }
}

export interface GoogleFlightsHttp {
  getHtml(url: string): Promise<string>;
}

// GET da página de busca do Google Flights, com a mesma política de resiliência
// dos outros providers: p-retry no que é transitório, dentro de um circuit
// breaker. O breaker importa mais aqui que nos outros: insistir contra o Google
// depois de uma sequência de falhas é o caminho mais curto para ser bloqueado.
export function createGoogleFlightsHttp(cfg: GoogleFlightsHttpConfig = {}): GoogleFlightsHttp {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const resilient = createResilientCall(cfg);
  const locale = cfg.locale ?? DEFAULT_LOCALE;

  return {
    getHtml(url: string): Promise<string> {
      return resilient.run(
        async () => {
          const res = await fetchImpl(url, {
            headers: {
              "user-agent": USER_AGENT,
              "accept-language": `${locale},en;q=0.8`,
              accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
          });
          if (!res.ok) {
            throw new GoogleFlightsHttpError(res.status, await res.text());
          }
          return res.text();
        },
        (error) => error instanceof GoogleFlightsHttpError && isRetryableStatus(error.status)
      );
    }
  };
}

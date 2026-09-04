import type { FlightOffer, FlightPriceContext, FlightSearchParams } from "@farol/shared";
import type { FlightProvider } from "../flight-provider.js";
import { GOOGLE_FLIGHTS_URL, createGoogleFlightsHttp, type GoogleFlightsHttp } from "./http.js";
import { extractPayload } from "./payload.js";
import { normalizeOffers, normalizePriceContext } from "./normalize-flight.js";
import { searchUrl } from "./query.js";

const DEFAULT_CURRENCY = "BRL";
const DEFAULT_LOCALE = "pt-BR";

export interface GoogleFlightsProviderConfig {
  http?: GoogleFlightsHttp;
  baseUrl?: string;
  /** Moeda dos preços. Aceita minúscula: o Google só entende em maiúscula. */
  currency?: string;
  locale?: string;
}

export interface GoogleFlightsSearchResult {
  offers: FlightOffer[];
  /** Nulo quando o Google não publica referência de preço para a rota. */
  priceContext: FlightPriceContext | null;
}

/**
 * Ofertas de voo lidas da página pública do Google Flights.
 *
 * Não é uma API: a busca vai num parâmetro protobuf e a resposta é raspada de
 * um <script> da página. Isso significa preço real e horário real — o que o
 * Travelpayouts não dá, porque serve cache do parceiro — em troca de nenhuma
 * garantia de estabilidade. Use sempre atrás do FallbackFlightProvider.
 */
export class GoogleFlightsProvider implements FlightProvider {
  private readonly http: GoogleFlightsHttp;
  private readonly baseUrl: string;
  private readonly currency: string;
  private readonly locale: string;

  constructor(cfg: GoogleFlightsProviderConfig = {}) {
    this.http = cfg.http ?? createGoogleFlightsHttp({ locale: cfg.locale });
    this.baseUrl = cfg.baseUrl ?? GOOGLE_FLIGHTS_URL;
    this.currency = (cfg.currency ?? DEFAULT_CURRENCY).toUpperCase();
    this.locale = cfg.locale ?? DEFAULT_LOCALE;
  }

  async search(params: FlightSearchParams): Promise<FlightOffer[]> {
    return (await this.searchWithContext(params)).offers;
  }

  /** Ofertas e contexto de preço de uma vez: os dois saem da mesma página. */
  async searchWithContext(params: FlightSearchParams): Promise<GoogleFlightsSearchResult> {
    const url = searchUrl(this.baseUrl, params, {
      locale: this.locale,
      currency: this.currency
    });
    const payload = extractPayload(await this.http.getHtml(url));
    return {
      offers: normalizeOffers(payload, { currency: this.currency, searchUrl: url }),
      priceContext: normalizePriceContext(payload, this.currency)
    };
  }
}

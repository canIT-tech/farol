import type { FlightOffer, FlightSearchParams, RouteDeal, RoutePriceSample } from "@farol/shared";
import type {
  FlightInsightsProvider,
  FlightProvider,
  LatestPricesQuery,
  RouteQuery
} from "./flight-provider.js";

export interface FallbackFlightProviderConfig {
  /** Fonte preferida das ofertas — hoje o Google Flights. */
  primary: FlightProvider;
  /** Fonte de reserva e única fonte dos insights — hoje o Travelpayouts. */
  fallback: FlightInsightsProvider;
  /** Chamado quando a busca cai no fallback, para registro. */
  onFallback?: (error: unknown) => void;
}

/**
 * Compõe duas fontes de voo: as ofertas vêm do primário e caem no fallback se
 * ele falhar; os insights ("quando ir", "melhor dia", aeroportos vizinhos) vêm
 * sempre do fallback, porque são endpoints que só ele tem.
 *
 * Existe porque o primário é um scraper sem SLA: uma mudança de layout do
 * Google não pode deixar a tela de voos vazia.
 */
export class FallbackFlightProvider implements FlightInsightsProvider {
  constructor(private readonly cfg: FallbackFlightProviderConfig) {}

  async search(params: FlightSearchParams): Promise<FlightOffer[]> {
    try {
      return await this.cfg.primary.search(params);
    } catch (error) {
      // Lista vazia não passa por aqui, e é de propósito: "não há voo nessa
      // data" é uma resposta correta, e substituí-la por preço de cache do
      // parceiro inventaria oferta para uma rota que não voa.
      this.cfg.onFallback?.(error);
      return this.cfg.fallback.search(params);
    }
  }

  nearbyOptions(params: FlightSearchParams): Promise<FlightOffer[]> {
    return this.cfg.fallback.nearbyOptions(params);
  }

  priceCalendar(query: RouteQuery, passengers?: number): Promise<RoutePriceSample[]> {
    return this.cfg.fallback.priceCalendar(query, passengers);
  }

  latestPrices(query: LatestPricesQuery, passengers?: number): Promise<RoutePriceSample[]> {
    return this.cfg.fallback.latestPrices(query, passengers);
  }

  monthlyPrices(query: RouteQuery, passengers?: number): Promise<RouteDeal[]> {
    return this.cfg.fallback.monthlyPrices(query, passengers);
  }

  cityDirections(originIata: string, passengers?: number): Promise<RouteDeal[]> {
    return this.cfg.fallback.cityDirections(originIata, passengers);
  }
}

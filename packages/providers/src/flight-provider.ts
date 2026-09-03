import type {
  FlightOffer,
  FlightSearchParams,
  RouteDeal,
  RoutePriceSample
} from "@farol/shared";

export type { FlightOffer, FlightSearchParams };

// Contrato de provider de voo (design §7.1). Implementação em travelpayouts/.
export interface FlightProvider {
  search(params: FlightSearchParams): Promise<FlightOffer[]>;
}

export interface RouteQuery {
  originIata: string;
  destinationIata: string;
}

export interface LatestPricesQuery extends RouteQuery {
  /** Janela que o provider varre. */
  periodType?: "year" | "month";
  page?: number;
  limit?: number;
}

// Contexto de preço além da busca: responde "quando ir", "qual o melhor dia",
// "quanto costuma custar" e "vale sair de outro aeroporto" — o que o assessor
// precisa para explicar a recomendação, não só listar ofertas.
export interface FlightInsightsProvider extends FlightProvider {
  nearbyOptions(params: FlightSearchParams): Promise<FlightOffer[]>;
  priceCalendar(query: RouteQuery, passengers?: number): Promise<RoutePriceSample[]>;
  latestPrices(query: LatestPricesQuery, passengers?: number): Promise<RoutePriceSample[]>;
  monthlyPrices(query: RouteQuery, passengers?: number): Promise<RouteDeal[]>;
  cityDirections(originIata: string, passengers?: number): Promise<RouteDeal[]>;
}

export function isFlightProvider(x: unknown): x is FlightProvider {
  return (
    typeof x === "object" && x !== null && typeof (x as FlightProvider).search === "function"
  );
}

const INSIGHT_METHODS = [
  "nearbyOptions",
  "priceCalendar",
  "latestPrices",
  "monthlyPrices",
  "cityDirections"
] as const;

export function isFlightInsightsProvider(x: unknown): x is FlightInsightsProvider {
  return (
    isFlightProvider(x) &&
    INSIGHT_METHODS.every(
      (method) => typeof (x as unknown as Record<string, unknown>)[method] === "function"
    )
  );
}

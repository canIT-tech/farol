import {
  flightOfferSchema,
  providerSectionSchema,
  routeDealSchema,
  type FlightOffer,
  type ProviderSection,
  type RouteDeal
} from "@farol/shared";
import { apiFetch } from "./api-client";

export interface RouteMonthsInput {
  origin: string;
  destination: string;
  adults: number;
  children: number;
}

export interface RouteOffersInput extends RouteMonthsInput {
  depart: string;
  /** Ausente = ida só. */
  return?: string;
}

// URLSearchParams com um valor undefined escreveria "return=undefined", e a api
// reprovaria a data. O parâmetro precisa sumir, não virar texto.
function queryString(input: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

/** Melhor preço mês a mês da rota — "quando ir". Não exige data. */
export function getRouteMonths(
  token: string,
  input: RouteMonthsInput,
  f?: typeof fetch
): Promise<ProviderSection<RouteDeal>> {
  return apiFetch(
    {
      path: `/routes/months?${queryString({ ...input })}`,
      schema: providerSectionSchema(routeDealSchema),
      token
    },
    f
  );
}

/** Ofertas reais numa data. Sem `return`, é ida só. */
export function getRouteOffers(
  token: string,
  input: RouteOffersInput,
  f?: typeof fetch
): Promise<ProviderSection<FlightOffer>> {
  return apiFetch(
    {
      path: `/routes/offers?${queryString({ ...input })}`,
      schema: providerSectionSchema(flightOfferSchema),
      token
    },
    f
  );
}

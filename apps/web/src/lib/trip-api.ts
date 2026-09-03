import { z } from "zod";
import {
  ChatResponseDtoSchema,
  destinationCandidateSchema,
  flightOfferSchema,
  hotelOfferSchema,
  routeDealSchema,
  routePriceSampleSchema,
  itineraryItemSchema,
  itinerarySchema,
  providerSectionSchema,
  tripSchema,
  tripStateSchema,
  type ChatResponseDto,
  type DestinationCandidate,
  type FlightOffer,
  type HotelOffer,
  type RouteDeal,
  type RoutePriceSample,
  type Itinerary,
  type ItineraryItem,
  type ProviderSection,
  type SwapRestaurantInput,
  type Trip,
  type TripInput,
  type TripState
} from "@farol/shared";
import { apiFetch, apiSend } from "./api-client";

const chooseDestinationResponseSchema = z.object({ itineraryId: z.string().uuid() });

export function getTrip(token: string, tripId: string, f?: typeof fetch): Promise<TripState> {
  return apiFetch({ path: `/trips/${tripId}`, schema: tripStateSchema, token }, f);
}

export function listTrips(token: string, f?: typeof fetch): Promise<Trip[]> {
  return apiFetch({ path: "/trips", schema: z.array(tripSchema), token }, f);
}

export function createTrip(token: string, input: TripInput, f?: typeof fetch): Promise<Trip> {
  return apiFetch({ path: "/trips", schema: tripSchema, token, method: "POST", body: input }, f);
}

export function runDiscovery(
  token: string,
  tripId: string,
  f?: typeof fetch
): Promise<DestinationCandidate[]> {
  return apiFetch(
    {
      path: `/trips/${tripId}/discovery`,
      schema: z.array(destinationCandidateSchema),
      token,
      method: "POST"
    },
    f
  );
}

export function chooseDestination(
  token: string,
  tripId: string,
  iata: string,
  f?: typeof fetch
): Promise<{ itineraryId: string }> {
  return apiFetch(
    {
      path: `/trips/${tripId}/destination`,
      schema: chooseDestinationResponseSchema,
      token,
      method: "POST",
      body: { iata }
    },
    f
  );
}

export function getItinerary(
  token: string,
  tripId: string,
  f?: typeof fetch
): Promise<Itinerary> {
  return apiFetch({ path: `/trips/${tripId}/itinerary`, schema: itinerarySchema, token }, f);
}

export function regenerateDay(
  token: string,
  tripId: string,
  dayIndex: number,
  f?: typeof fetch
): Promise<void> {
  return apiSend(
    { path: `/trips/${tripId}/itinerary/days/${dayIndex}/regenerate`, token, method: "POST" },
    f
  );
}

export function swapRestaurant(
  token: string,
  tripId: string,
  itemId: string,
  body: SwapRestaurantInput,
  f?: typeof fetch
): Promise<ItineraryItem> {
  return apiFetch(
    {
      path: `/trips/${tripId}/itinerary/items/${itemId}/swap-restaurant`,
      schema: itineraryItemSchema,
      token,
      method: "POST",
      body
    },
    f
  );
}

export function getFlights(
  token: string,
  tripId: string,
  f?: typeof fetch
): Promise<ProviderSection<FlightOffer>> {
  return apiFetch(
    { path: `/trips/${tripId}/flights`, schema: providerSectionSchema(flightOfferSchema), token },
    f
  );
}

// Os recortes de contexto de preço do Travelpayouts: melhor dia, melhor mês,
// faixa recente, aeroporto vizinho e destinos baratos saindo da origem.
function flightSection<T>(
  path: string,
  schema: Parameters<typeof providerSectionSchema>[0],
  token: string,
  tripId: string,
  f?: typeof fetch
): Promise<ProviderSection<T>> {
  return apiFetch(
    { path: `/trips/${tripId}/flights/${path}`, schema: providerSectionSchema(schema), token },
    f
  ) as Promise<ProviderSection<T>>;
}

export function getFlightNearby(
  token: string,
  tripId: string,
  f?: typeof fetch
): Promise<ProviderSection<FlightOffer>> {
  return flightSection("nearby", flightOfferSchema, token, tripId, f);
}

export function getFlightCalendar(
  token: string,
  tripId: string,
  f?: typeof fetch
): Promise<ProviderSection<RoutePriceSample>> {
  return flightSection("calendar", routePriceSampleSchema, token, tripId, f);
}

export function getFlightLatest(
  token: string,
  tripId: string,
  f?: typeof fetch
): Promise<ProviderSection<RoutePriceSample>> {
  return flightSection("latest", routePriceSampleSchema, token, tripId, f);
}

export function getFlightMonths(
  token: string,
  tripId: string,
  f?: typeof fetch
): Promise<ProviderSection<RouteDeal>> {
  return flightSection("months", routeDealSchema, token, tripId, f);
}

export function getFlightDirections(
  token: string,
  tripId: string,
  f?: typeof fetch
): Promise<ProviderSection<RouteDeal>> {
  return flightSection("directions", routeDealSchema, token, tripId, f);
}

// O corpo da seleção não é usado pela UI — depois de selecionar, a tela relê a
// viagem. Por isso não há schema aqui.
export function selectFlight(
  token: string,
  tripId: string,
  offerId: string,
  f?: typeof fetch
): Promise<void> {
  return apiSend(
    { path: `/trips/${tripId}/flights/select`, token, method: "POST", body: { offerId } },
    f
  );
}

export function getHotels(
  token: string,
  tripId: string,
  f?: typeof fetch
): Promise<ProviderSection<HotelOffer>> {
  return apiFetch(
    { path: `/trips/${tripId}/hotels`, schema: providerSectionSchema(hotelOfferSchema), token },
    f
  );
}

export function selectHotel(
  token: string,
  tripId: string,
  offerId: string,
  f?: typeof fetch
): Promise<void> {
  return apiSend(
    { path: `/trips/${tripId}/hotels/select`, token, method: "POST", body: { offerId } },
    f
  );
}

export function sendChat(
  token: string,
  tripId: string,
  message: string,
  f?: typeof fetch
): Promise<ChatResponseDto> {
  return apiFetch(
    {
      path: `/trips/${tripId}/chat`,
      schema: ChatResponseDtoSchema,
      token,
      method: "POST",
      body: { message }
    },
    f
  );
}

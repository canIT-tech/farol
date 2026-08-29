import { flightOfferSchema, type FlightOffer } from "@farol/shared";

// ISO-8601 de duração (ex.: "PT12H30M", "P1DT2H") → minutos.
export function parseIsoDurationMinutes(iso: string): number {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(iso);
  if (match === null) {
    return 0;
  }
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return days * 1440 + hours * 60 + minutes;
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_whole, key: string) => values[key] ?? "");
}

interface AmadeusSegment {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
}
interface AmadeusItinerary {
  duration: string;
  segments: AmadeusSegment[];
}
interface AmadeusFlightOffer {
  id: string;
  itineraries: AmadeusItinerary[];
  price: { total: string; grandTotal?: string; currency: string };
}
interface AmadeusFlightResponse {
  data?: AmadeusFlightOffer[];
}

// Traduz a resposta do Amadeus flight-offers para FlightOffer[] (design §7.2).
export function normalizeFlight(raw: unknown, deepLinkTemplate: string): FlightOffer[] {
  const offers = (raw as AmadeusFlightResponse).data ?? [];

  return offers.map((offer) => {
    const outbound = offer.itineraries[0]!;
    const segments = outbound.segments;
    const first = segments[0]!;
    const last = segments[segments.length - 1]!;
    const returnItinerary = offer.itineraries[1];

    const departAt = first.departure.at;
    const arriveAt = last.arrival.at;
    const returnAt = returnItinerary ? returnItinerary.segments[0]!.departure.at : null;

    const deepLink = fillTemplate(deepLinkTemplate, {
      origin: first.departure.iataCode,
      destination: last.arrival.iataCode,
      departDate: departAt.slice(0, 10),
      returnDate: returnAt === null ? "" : returnAt.slice(0, 10)
    });

    return flightOfferSchema.parse({
      id: offer.id,
      price: Number(offer.price.grandTotal ?? offer.price.total),
      currency: offer.price.currency,
      carrier: first.carrierCode,
      stops: segments.length - 1,
      departAt,
      arriveAt,
      returnAt,
      durationMinutes: parseIsoDurationMinutes(outbound.duration),
      deepLink
    });
  });
}

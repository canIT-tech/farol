import {
  flightSearchParamsSchema,
  type FlightOffer,
  type FlightSearchParams
} from "@farol/shared";
import type { FlightProvider } from "../flight-provider";
import { createAmadeusHttp, type AmadeusHttp, type AmadeusHttpConfig } from "./http";
import { normalizeFlight } from "./normalize-flight";

export interface AmadeusFlightProviderConfig extends AmadeusHttpConfig {
  deepLinkTemplate: string;
  http?: AmadeusHttp;
}

const FLIGHT_OFFERS_PATH = "/v2/shopping/flight-offers";

export class AmadeusFlightProvider implements FlightProvider {
  private readonly http: AmadeusHttp;

  constructor(private readonly cfg: AmadeusFlightProviderConfig) {
    this.http = cfg.http ?? createAmadeusHttp(cfg);
  }

  async search(params: FlightSearchParams): Promise<FlightOffer[]> {
    const p = flightSearchParamsSchema.parse(params);

    const query: Record<string, string> = {
      originLocationCode: p.originIata,
      destinationLocationCode: p.destinationIata,
      departureDate: p.departDate,
      adults: String(p.adults),
      currencyCode: "BRL",
      max: "20"
    };
    if (p.returnDate !== undefined) {
      query.returnDate = p.returnDate;
    }
    if (p.children > 0) {
      query.children = String(p.children);
    }
    if (p.maxStops === 0) {
      query.nonStop = "true";
    }

    const raw = await this.http.get(FLIGHT_OFFERS_PATH, query);
    let offers = normalizeFlight(raw, this.cfg.deepLinkTemplate);
    if (p.maxStops !== undefined) {
      offers = offers.filter((offer) => offer.stops <= p.maxStops!);
    }
    return offers.sort((a, b) => a.price - b.price);
  }
}

import { hotelSearchParamsSchema, type HotelOffer, type HotelSearchParams } from "@farol/shared";
import type { HotelProvider } from "../hotel-provider.js";
import { createLiteApiHttp, type LiteApiHttp, type LiteApiHttpConfig } from "./http.js";
import {
  normalizeHotels,
  type LiteApiHotelsResponse,
  type LiteApiMinRatesResponse
} from "./normalize-hotel.js";

export const HOTELS_PATH = "/data/hotels";
export const MIN_RATES_PATH = "/hotels/min-rates";

export interface LiteApiHotelProviderConfig extends LiteApiHttpConfig {
  deepLinkTemplate: string;
  currency?: string;
  /** Nacionalidade do hóspede, que muda tarifa e imposto. Default BR. */
  guestNationality?: string;
  /** Quantos hotéis buscar antes de pedir tarifa. Default 25. */
  limit?: number;
  defaultRadiusMeters?: number;
  http?: LiteApiHttp;
}

const DEFAULT_CURRENCY = "BRL";
const DEFAULT_NATIONALITY = "BR";
const DEFAULT_LIMIT = 25;
const DEFAULT_RADIUS_METERS = 5000;

// Provider de hotel sobre a LiteAPI (Nuitée). Duas chamadas: /data/hotels traz
// o conteúdo (nome, foto, nota, coordenada) e /hotels/min-rates traz o preço
// para as datas. As duas são gratuitas no plano de conteúdo + reserva.
// Substitui o Hotellook, encerrado em 20/10/2025.
export class LiteApiHotelProvider implements HotelProvider {
  private readonly http: LiteApiHttp;
  private readonly currency: string;

  constructor(private readonly cfg: LiteApiHotelProviderConfig) {
    this.http = cfg.http ?? createLiteApiHttp(cfg);
    this.currency = cfg.currency ?? DEFAULT_CURRENCY;
  }

  async search(params: HotelSearchParams): Promise<HotelOffer[]> {
    const p = hotelSearchParamsSchema.parse(params);

    // Coordenada é o caminho preferido; nome de cidade depende do idioma.
    const byCoordinates = p.latitude !== undefined && p.longitude !== undefined;
    const hotels = await this.http.get<LiteApiHotelsResponse>(HOTELS_PATH, {
      countryCode: p.countryCode,
      latitude: byCoordinates ? p.latitude : undefined,
      longitude: byCoordinates ? p.longitude : undefined,
      radius: byCoordinates
        ? (p.radiusMeters ?? this.cfg.defaultRadiusMeters ?? DEFAULT_RADIUS_METERS)
        : undefined,
      cityName: byCoordinates ? undefined : p.cityName,
      limit: this.cfg.limit ?? DEFAULT_LIMIT
    });

    const hotelIds = (hotels.data ?? []).map((hotel) => hotel.id);
    if (hotelIds.length === 0) {
      return [];
    }

    const rates = await this.http.post<LiteApiMinRatesResponse>(MIN_RATES_PATH, {
      hotelIds,
      occupancies: [{ adults: p.adults }],
      checkin: p.checkIn,
      checkout: p.checkOut,
      currency: this.currency,
      guestNationality: this.cfg.guestNationality ?? DEFAULT_NATIONALITY
    });

    return normalizeHotels(
      hotels,
      rates,
      {
        template: this.cfg.deepLinkTemplate,
        cityCode: p.cityCode,
        cityName: p.cityName ?? p.cityCode,
        checkIn: p.checkIn,
        checkOut: p.checkOut,
        adults: p.adults
      },
      this.currency
    );
  }
}

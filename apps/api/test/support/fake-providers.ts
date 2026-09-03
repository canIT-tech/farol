import type { FlightInsightsProvider, HotelProvider, PlacesProvider } from "@farol/providers";
import type {
  FlightOffer,
  HotelOffer,
  HotelSearchParams,
  Place,
  PlaceDetails,
  RouteDeal,
  RoutePriceSample
} from "@farol/shared";

export const FAKE_FLIGHT_OFFERS: FlightOffer[] = [
  {
    id: "flt-cheap",
    price: 3980,
    currency: "BRL",
    carrier: "AF",
    carrierName: "Air France",
    originIata: "GRU",
    originName: "Sao Paulo-Guarulhos International Airport",
    destinationIata: "LIS",
    destinationName: "Lisbon Airport",
    stops: 1,
    departAt: "2026-09-10T18:30:00",
    arriveAt: "2026-09-11T14:10:00",
    returnAt: "2026-09-20T08:00:00",
    durationMinutes: 880,
    deepLink: "https://parceiro.example.com/voos?id=flt-cheap"
  },
  {
    id: "flt-direct",
    price: 4600,
    currency: "BRL",
    carrier: "TP",
    carrierName: "TAP Air Portugal",
    originIata: "GRU",
    originName: "Sao Paulo-Guarulhos International Airport",
    destinationIata: "LIS",
    destinationName: "Lisbon Airport",
    stops: 0,
    departAt: "2026-09-10T23:05:00",
    arriveAt: "2026-09-11T13:20:00",
    returnAt: "2026-09-20T10:45:00",
    durationMinutes: 615,
    deepLink: "https://parceiro.example.com/voos?id=flt-direct"
  },
  {
    id: "flt-oneway",
    price: 2300,
    currency: "BRL",
    carrier: "LA",
    carrierName: null,
    originIata: "VCP",
    originName: null,
    destinationIata: "LIS",
    destinationName: "Lisbon Airport",
    stops: 0,
    departAt: "2026-09-10T09:00:00",
    arriveAt: "2026-09-10T21:00:00",
    returnAt: null,
    durationMinutes: 720,
    deepLink: "https://parceiro.example.com/voos?id=flt-oneway"
  }
];

export const FAKE_HOTEL_OFFERS: HotelOffer[] = [
  {
    id: "htl-hostel",
    name: "Independente Hostel",
    region: "Bairro Alto",
    address: "R. de São Pedro de Alcântara 81",
    pricePerNight: 200,
    priceTotal: 1400,
    currency: "BRL",
    rating: null,
    reviewCount: null,
    stars: null,
    photoUrl: null,
    lat: 38.7156,
    lng: -9.1444,
    deepLink: "https://parceiro.example.com/hoteis?id=htl-hostel"
  },
  {
    id: "htl-marriott",
    name: "Marriott Lisbon",
    region: null,
    address: null,
    pricePerNight: 1000,
    priceTotal: 7000,
    currency: "BRL",
    rating: 5,
    reviewCount: 4210,
    stars: 5,
    photoUrl: "https://static.cupid.travel/hotels/1.jpg",
    lat: null,
    lng: null,
    deepLink: "https://parceiro.example.com/hoteis?id=htl-marriott"
  }
];

export const FAKE_PRICE_SAMPLES: RoutePriceSample[] = [
  {
    origin: "SAO",
    destination: "LIS",
    departDate: "2026-09-10",
    returnDate: "2026-09-17",
    price: 3980,
    currency: "brl",
    transfers: 1,
    durationMinutes: 880,
    gate: "Trip.com",
    foundAt: "2026-08-29T04:34:14Z",
    deepLink: "https://www.aviasales.com/search/SAO1009LIS17092?marker=555"
  },
  {
    origin: "SAO",
    destination: "LIS",
    departDate: "2026-09-14",
    returnDate: null,
    price: 4600,
    currency: "brl",
    transfers: 0,
    durationMinutes: 615,
    gate: null,
    foundAt: null,
    deepLink: "https://www.aviasales.com/search/SAO1409LIS2?marker=555"
  }
];

export const FAKE_ROUTE_DEALS: RouteDeal[] = [
  {
    key: "2026-09",
    origin: "SAO",
    destination: "LIS",
    airline: "TP",
    departAt: "2026-09-10T18:30:00-03:00",
    returnAt: "2026-09-17T09:20:00Z",
    price: 3198,
    currency: "brl",
    flightNumber: "748",
    transfers: 0,
    deepLink: "https://www.aviasales.com/search/SAO1009LIS17092?marker=555"
  },
  {
    key: "2026-10",
    origin: "SAO",
    destination: "LIS",
    airline: "LA",
    departAt: "2026-10-04T18:05:00-03:00",
    returnAt: null,
    price: 4210,
    currency: "brl",
    flightNumber: null,
    transfers: 1,
    deepLink: "https://www.aviasales.com/search/SAO0410LIS2?marker=555"
  }
];

interface FakeFlightBehaviour {
  offers?: FlightOffer[];
  samples?: RoutePriceSample[];
  deals?: RouteDeal[];
  fail?: boolean;
}

export class FakeFlightProvider implements FlightInsightsProvider {
  constructor(private readonly behaviour: FakeFlightBehaviour = {}) {}

  private guard<T>(value: T): Promise<T> {
    if (this.behaviour.fail === true) {
      return Promise.reject(new Error("travelpayouts indisponível"));
    }
    return Promise.resolve(value);
  }

  search(): Promise<FlightOffer[]> {
    return this.guard(this.behaviour.offers ?? FAKE_FLIGHT_OFFERS);
  }
  nearbyOptions(): Promise<FlightOffer[]> {
    return this.guard(this.behaviour.offers ?? FAKE_FLIGHT_OFFERS);
  }
  priceCalendar(): Promise<RoutePriceSample[]> {
    return this.guard(this.behaviour.samples ?? FAKE_PRICE_SAMPLES);
  }
  latestPrices(): Promise<RoutePriceSample[]> {
    return this.guard(this.behaviour.samples ?? FAKE_PRICE_SAMPLES);
  }
  monthlyPrices(): Promise<RouteDeal[]> {
    return this.guard(this.behaviour.deals ?? FAKE_ROUTE_DEALS);
  }
  cityDirections(): Promise<RouteDeal[]> {
    return this.guard(this.behaviour.deals ?? FAKE_ROUTE_DEALS);
  }
}

export class FakeHotelProvider implements HotelProvider {
  constructor(private readonly behaviour: { offers?: HotelOffer[]; fail?: boolean } = {}) {}
  /** Guarda o último params recebido: é o que prova, no teste, que país e
   *  coordenada chegaram no provider. */
  lastParams: HotelSearchParams | null = null;

  search(params: HotelSearchParams): Promise<HotelOffer[]> {
    this.lastParams = params;
    if (this.behaviour.fail === true) {
      return Promise.reject(new Error("liteapi indisponível"));
    }
    return Promise.resolve(this.behaviour.offers ?? FAKE_HOTEL_OFFERS);
  }
}

export const FAKE_PLACES: Place[] = [
  {
    placeId: "place-museu",
    name: "Museu Nacional do Azulejo",
    lat: 38.7247,
    lng: -9.1146,
    rating: 4.6,
    priceLevel: 1,
    types: ["museum", "tourist_attraction"]
  },
  {
    placeId: "place-mercado",
    name: "Time Out Market Lisboa",
    lat: 38.7071,
    lng: -9.1459,
    rating: 4.4,
    priceLevel: 2,
    types: ["restaurant"]
  }
];

export const FAKE_PLACE_DETAILS: PlaceDetails = {
  ...FAKE_PLACES[0]!,
  address: "R. Me. Deus 4, 1900-312 Lisboa",
  openingHours: ["terça-feira: 10:00 – 18:00"]
};

export class FakePlacesProvider implements PlacesProvider {
  constructor(private readonly behaviour: { places?: Place[]; fail?: boolean } = {}) {}
  textSearch(): Promise<Place[]> {
    if (this.behaviour.fail === true) {
      return Promise.reject(new Error("places indisponível"));
    }
    return Promise.resolve(this.behaviour.places ?? FAKE_PLACES);
  }
  details(): Promise<PlaceDetails> {
    if (this.behaviour.fail === true) {
      return Promise.reject(new Error("places indisponível"));
    }
    return Promise.resolve(FAKE_PLACE_DETAILS);
  }
}

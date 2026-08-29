import type { FlightProvider, HotelProvider } from "@farol/providers";
import type { FlightOffer, HotelOffer } from "@farol/shared";

export const FAKE_FLIGHT_OFFERS: FlightOffer[] = [
  {
    id: "flt-cheap",
    price: 3980,
    currency: "BRL",
    carrier: "AF",
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
    pricePerNight: 200,
    priceTotal: 1400,
    currency: "BRL",
    rating: null,
    deepLink: "https://parceiro.example.com/hoteis?id=htl-hostel"
  },
  {
    id: "htl-marriott",
    name: "Marriott Lisbon",
    region: null,
    pricePerNight: 1000,
    priceTotal: 7000,
    currency: "BRL",
    rating: 5,
    deepLink: "https://parceiro.example.com/hoteis?id=htl-marriott"
  }
];

export class FakeFlightProvider implements FlightProvider {
  constructor(private readonly behaviour: { offers?: FlightOffer[]; fail?: boolean } = {}) {}
  search(): Promise<FlightOffer[]> {
    if (this.behaviour.fail === true) {
      return Promise.reject(new Error("amadeus indisponível"));
    }
    return Promise.resolve(this.behaviour.offers ?? FAKE_FLIGHT_OFFERS);
  }
}

export class FakeHotelProvider implements HotelProvider {
  constructor(private readonly behaviour: { offers?: HotelOffer[]; fail?: boolean } = {}) {}
  search(): Promise<HotelOffer[]> {
    if (this.behaviour.fail === true) {
      return Promise.reject(new Error("amadeus indisponível"));
    }
    return Promise.resolve(this.behaviour.offers ?? FAKE_HOTEL_OFFERS);
  }
}

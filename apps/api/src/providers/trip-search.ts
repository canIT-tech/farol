import { DomainError, type FlightSearchParams, type HotelSearchParams } from "@farol/shared";
import type { TripState } from "../trips/trip-state";

const MS_PER_DAY = 86_400_000;
const DEFAULT_NIGHTS = 7;

export function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(isoDate) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

// Datas concretas para a busca: dateStart/dateEnd quando existem; senão o
// primeiro dia do targetMonth + durationDays. tripInputSchema garante um dos dois.
export function resolveTripDates(trip: TripState): { depart: string; return: string } {
  if (trip.dateStart !== null && trip.dateEnd !== null) {
    return { depart: trip.dateStart, return: trip.dateEnd };
  }
  const depart = `${trip.targetMonth as string}-01`;
  return { depart, return: addDays(depart, trip.durationDays ?? DEFAULT_NIGHTS) };
}

function chosenIata(trip: TripState): string {
  const iata = trip.chosenDestination?.iata;
  if (iata === undefined) {
    throw new DomainError(
      "no_destination_chosen",
      "escolha um destino antes de buscar voo ou hotel"
    );
  }
  return iata;
}

export function buildFlightParams(trip: TripState): FlightSearchParams {
  const dates = resolveTripDates(trip);
  return {
    originIata: trip.originIata,
    destinationIata: chosenIata(trip),
    departDate: dates.depart,
    returnDate: dates.return,
    adults: trip.party.adults,
    children: trip.party.children
  };
}

export function buildHotelParams(trip: TripState): HotelSearchParams {
  const dates = resolveTripDates(trip);
  return {
    cityCode: chosenIata(trip),
    checkIn: dates.depart,
    checkOut: dates.return,
    adults: trip.party.adults
  };
}

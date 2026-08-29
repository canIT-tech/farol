import type { flightSelections } from "@farol/db";
import type { FlightOffer } from "@farol/shared";

type Row = typeof flightSelections.$inferSelect;

export interface FlightSelection {
  id: string;
  tripId: string;
  offer: FlightOffer;
  price: number;
  currency: string;
  carrier: string | null;
  stops: number | null;
  departAt: string | null;
  returnAt: string | null;
  deepLink: string;
  selectedAt: string;
}

export function toFlightSelection(row: Row): FlightSelection {
  return {
    id: row.id,
    tripId: row.tripId,
    offer: row.offer as FlightOffer,
    price: Number(row.price),
    currency: row.currency,
    carrier: row.carrier,
    stops: row.stops,
    departAt: row.departAt === null ? null : row.departAt.toISOString(),
    returnAt: row.returnAt === null ? null : row.returnAt.toISOString(),
    deepLink: row.deepLink,
    selectedAt: row.selectedAt.toISOString()
  };
}

import type { hotelSelections } from "@farol/db";
import type { HotelOffer } from "@farol/shared";

type Row = typeof hotelSelections.$inferSelect;

export interface HotelSelection {
  id: string;
  tripId: string;
  offer: HotelOffer;
  name: string;
  region: string | null;
  pricePerNight: number;
  priceTotal: number | null;
  currency: string;
  rating: number | null;
  deepLink: string;
  selectedAt: string;
}

export function toHotelSelection(row: Row): HotelSelection {
  return {
    id: row.id,
    tripId: row.tripId,
    offer: row.offer as HotelOffer,
    name: row.name,
    region: row.region,
    pricePerNight: Number(row.pricePerNight),
    priceTotal: row.priceTotal === null ? null : Number(row.priceTotal),
    currency: row.currency,
    rating: row.rating === null ? null : Number(row.rating),
    deepLink: row.deepLink,
    selectedAt: row.selectedAt.toISOString()
  };
}

import { destinationCandidateSchema, type DestinationCandidate, type TripStatus } from "@farol/shared";
import type { trips, tripDestinations } from "@farol/db";

type TripRow = typeof trips.$inferSelect;
type TripDestinationRow = typeof tripDestinations.$inferSelect;

export interface Trip {
  id: string;
  userId: string;
  status: TripStatus;
  title: string | null;
  originIata: string;
  dateStart: string | null;
  dateEnd: string | null;
  durationDays: number | null;
  targetMonth: string | null;
  party: { adults: number; children: number };
  budgetTotal: number | null;
  currency: string;
  chosenDestinationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripState extends Trip {
  destinations: DestinationCandidate[];
  chosenDestination: DestinationCandidate | null;
}

export function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as TripStatus,
    title: row.title,
    originIata: row.originIata,
    dateStart: row.dateStart,
    dateEnd: row.dateEnd,
    durationDays: row.durationDays,
    targetMonth: row.targetMonth,
    party: row.party,
    budgetTotal: row.budgetTotal === null ? null : Number(row.budgetTotal),
    currency: row.currency,
    chosenDestinationId: row.chosenDestinationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toDestinationCandidate(row: TripDestinationRow): DestinationCandidate {
  return destinationCandidateSchema.parse({
    iata: row.iata,
    city: row.city,
    country: row.country,
    score: Number(row.score),
    rationale: row.rationale,
    estCost: row.estCost,
    climate: row.climate,
    flightTimeHours: row.flightTimeHours === null ? null : Number(row.flightTimeHours)
  });
}

export function buildTripState(tripRow: TripRow, destinationRows: TripDestinationRow[]): TripState {
  const destinations = destinationRows.map(toDestinationCandidate);
  const chosenRow = destinationRows.find((row) => row.chosen);
  return {
    ...toTrip(tripRow),
    destinations,
    chosenDestination: chosenRow ? toDestinationCandidate(chosenRow) : null
  };
}

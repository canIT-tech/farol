import {
  destinationCandidateSchema,
  type DestinationCandidate,
  type Trip,
  type TripState,
  type TripStatus
} from "@farol/shared";
import type { trips, tripDestinations } from "@farol/db";

type TripRow = typeof trips.$inferSelect;
type TripDestinationRow = typeof tripDestinations.$inferSelect;

// Trip e TripState são de @farol/shared: o apps/web valida a resposta com os
// mesmos schemas, então o contrato tem que ter um dono só.
export type { Trip, TripState };

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

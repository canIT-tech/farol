import type { Trip } from "@farol/shared";

// Onde a viagem "parou": sem destino escolhido a pessoa volta para a descoberta;
// com destino, o roteiro (que já leva para voo & hotel pela sidebar).
export function tripResumeRoute(trip: Pick<Trip, "id" | "chosenDestinationId">): string {
  return `/trips/${trip.id}/${trip.chosenDestinationId === null ? "discovery" : "itinerary"}`;
}

// A viagem só ganha título depois; antes disso o card mostra de onde sai.
export function tripCardTitle(trip: Pick<Trip, "title" | "originIata">): string {
  return trip.title ?? `Saindo de ${trip.originIata}`;
}

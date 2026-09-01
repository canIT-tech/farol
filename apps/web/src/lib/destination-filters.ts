import type { DestinationCandidate } from "@farol/shared";

export type DestinationSort = "match" | "price";

export const HOME_COUNTRY = "Brasil";

export function isDomestic(candidate: DestinationCandidate): boolean {
  return candidate.country === HOME_COUNTRY;
}

export function totalEstimate(candidate: DestinationCandidate): number {
  return candidate.estCost.flight + candidate.estCost.lodgingPerNight + candidate.estCost.dailyLocal;
}

// Filtro e ordenação são client-side: a descoberta já devolveu de 3 a 5
// candidatos, não vale uma ida ao back para reordenar cinco cartões.
export function arrangeDestinations(
  candidates: DestinationCandidate[],
  options: { domesticOnly: boolean; sort: DestinationSort }
): DestinationCandidate[] {
  const filtered = options.domesticOnly ? candidates.filter(isDomestic) : [...candidates];
  return filtered.sort((a, b) =>
    options.sort === "price" ? totalEstimate(a) - totalEstimate(b) : b.score - a.score
  );
}

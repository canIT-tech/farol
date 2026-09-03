import type { DestinationCandidate } from "@farol/shared";

export type DestinationSort = "match" | "price";

export const HOME_COUNTRY = "Brasil";

export function isDomestic(candidate: DestinationCandidate): boolean {
  return candidate.country === HOME_COUNTRY;
}

// Só conta como direto quando o provider confirmou zero escalas. Sem cobertura
// (flightStops nulo) o destino fica de fora do filtro — não dá para prometer
// voo direto por falta de dado.
export function isNonStop(candidate: DestinationCandidate): boolean {
  return candidate.flightStops === 0;
}

export function totalEstimate(candidate: DestinationCandidate): number {
  return candidate.estCost.flight + candidate.estCost.lodgingPerNight + candidate.estCost.dailyLocal;
}

// Filtro e ordenação são client-side: a descoberta já devolveu de 3 a 5
// candidatos, não vale uma ida ao back para reordenar cinco cartões.
export function arrangeDestinations(
  candidates: DestinationCandidate[],
  options: { domesticOnly: boolean; nonStopOnly?: boolean; sort: DestinationSort }
): DestinationCandidate[] {
  let filtered = options.domesticOnly ? candidates.filter(isDomestic) : [...candidates];
  if (options.nonStopOnly === true) {
    filtered = filtered.filter(isNonStop);
  }
  return filtered.sort((a, b) =>
    options.sort === "price" ? totalEstimate(a) - totalEstimate(b) : b.score - a.score
  );
}

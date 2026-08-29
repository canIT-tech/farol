import type { TasteProfileInput, TripInput } from "@farol/shared";
import { BRAZIL_REGION, type CatalogEntry } from "./types";

const MS_PER_DAY = 86_400_000;
const DEFAULT_LIMIT = 20;

// Número de diárias da viagem: usa durationDays quando informado, senão a
// diferença entre dateEnd e dateStart. tripInputSchema garante um dos dois.
export function nightsOf(trip: TripInput): number {
  if (trip.durationDays !== undefined) {
    return trip.durationDays;
  }
  return Math.round((Date.parse(trip.dateEnd!) - Date.parse(trip.dateStart!)) / MS_PER_DAY);
}

// Mês alvo (1..12): do targetMonth ou do mês de dateStart.
export function targetMonthOf(trip: TripInput): number {
  const source = trip.targetMonth ?? trip.dateStart!;
  return Number(source.slice(5, 7));
}

// Aderência do destino ao perfil: fração dos interesses presente nas tags (0..1).
export function affinityScore(interests: string[], tags: string[]): number {
  if (interests.length === 0) {
    return 0;
  }
  const tagSet = new Set(tags);
  const hits = interests.filter((interest) => tagSet.has(interest)).length;
  return hits / interests.length;
}

export interface PrefilterArgs {
  catalog: CatalogEntry[];
  trip: TripInput;
  profile: TasteProfileInput;
  excludeIata?: string[];
  limit?: number;
}

// Pré-filtro determinístico (design §6.2): orçamento, época, visto, exclusões;
// ordena por aderência (desc) e desempata por passagem mais barata.
export function prefilterDestinations(args: PrefilterArgs): CatalogEntry[] {
  const { catalog, trip, profile } = args;
  const excluded = new Set(args.excludeIata);
  const limit = args.limit ?? DEFAULT_LIMIT;

  const nights = nightsOf(trip);
  const month = targetMonthOf(trip);
  const budgetPerPerson = trip.budgetTotal / trip.party.adults;

  const eligible = catalog.filter((entry) => {
    if (excluded.has(entry.iata)) {
      return false;
    }
    if (entry.region !== BRAZIL_REGION && !entry.visaFreeBr) {
      return false;
    }
    if (!entry.bestMonths.includes(month)) {
      return false;
    }
    const estimate =
      entry.avgFlightCostFromGru + entry.avgLodgingNight * nights + entry.avgDailyLocal * nights;
    return estimate <= budgetPerPerson;
  });

  return eligible
    .map((entry) => ({ entry, score: affinityScore(profile.interests, entry.tags) }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.entry.avgFlightCostFromGru - b.entry.avgFlightCostFromGru;
    })
    .slice(0, limit)
    .map((ranked) => ranked.entry);
}

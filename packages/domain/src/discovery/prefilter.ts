import type { TasteProfileInput } from "@farol/shared";
import { BRAZIL_REGION, type CatalogEntry } from "./types.js";

const MS_PER_DAY = 86_400_000;
const DEFAULT_LIMIT = 20;

// Critério de viagem que o pré-filtro precisa. Tanto TripInput (@farol/shared)
// quanto o TripState da api satisfazem esta forma estruturalmente.
export interface TripCriteria {
  party: { adults: number };
  budgetTotal: number;
  durationDays?: number | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  targetMonth?: string | null;
}

// Número de diárias: usa durationDays quando presente, senão a diferença de datas.
export function nightsOf(trip: TripCriteria): number {
  if (trip.durationDays != null) {
    return trip.durationDays;
  }
  return Math.round((Date.parse(trip.dateEnd!) - Date.parse(trip.dateStart!)) / MS_PER_DAY);
}

// Mês alvo (1..12): do targetMonth ou do mês de dateStart.
export function targetMonthOf(trip: TripCriteria): number {
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

/**
 * Custo total estimado da viagem, para todo o grupo.
 *
 * A passagem e o gasto diário são por pessoa; a diária é do quarto, não de
 * cada hóspede. O cálculo anterior tratava os três como per capita e comparava
 * com `budgetTotal / adults`, o que cobrava a hospedagem uma vez por viajante
 * — com dois adultos, uma viagem de 14 noites não cabia em orçamento nenhum e
 * o catálogo inteiro era descartado.
 */
export function estimateTripCost(
  entry: Pick<CatalogEntry, "avgFlightCostFromGru" | "avgLodgingNight" | "avgDailyLocal">,
  nights: number,
  adults: number
): number {
  return (
    entry.avgFlightCostFromGru * adults +
    entry.avgLodgingNight * nights +
    entry.avgDailyLocal * nights * adults
  );
}

export interface PrefilterArgs {
  catalog: CatalogEntry[];
  trip: TripCriteria;
  profile: TasteProfileInput;
  limit?: number;
}

// Pré-filtro determinístico (design §6.2): orçamento, época, visto;
// ordena por aderência (desc) e desempata por passagem mais barata.
export function prefilterDestinations(args: PrefilterArgs): CatalogEntry[] {
  const { catalog, trip, profile } = args;
  const limit = args.limit ?? DEFAULT_LIMIT;

  const nights = nightsOf(trip);
  const month = targetMonthOf(trip);
  const adults = trip.party.adults;

  const eligible = catalog.filter((entry) => {
    if (entry.region !== BRAZIL_REGION && !entry.visaFreeBr) {
      return false;
    }
    if (!entry.bestMonths.includes(month)) {
      return false;
    }
    return estimateTripCost(entry, nights, adults) <= trip.budgetTotal;
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

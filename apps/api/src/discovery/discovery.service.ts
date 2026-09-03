import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { tripDestinations, type Database } from "@farol/db";
import { prefilterDestinations, type CatalogEntry, type TripCriteria } from "@farol/domain";
import {
  DomainError,
  NotFoundError,
  destinationCandidateSchema,
  isDomainError,
  type DestinationCandidate,
  type LlmRankingItem,
  type TasteProfileInput
} from "@farol/shared";
import { DB } from "../db/db.module";
import { LLM, type LlmPort } from "../llm/llm.types";
import { ProfileService } from "../profile/profile.service";
import { TripsService } from "../trips/trips.service";
import type { TripState } from "../trips/trip-state";
import { FlightsService } from "../flights/flights.service";
import { CatalogRepository } from "./catalog.repository";

const MIN_SHORTLIST = 3;

function tripCriteria(trip: TripState): TripCriteria {
  return {
    party: { adults: trip.party.adults },
    budgetTotal: trip.budgetTotal ?? 0,
    durationDays: trip.durationDays,
    dateStart: trip.dateStart,
    dateEnd: trip.dateEnd,
    targetMonth: trip.targetMonth
  };
}

@Injectable()
export class DiscoveryService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly catalog: CatalogRepository,
    private readonly trips: TripsService,
    private readonly profiles: ProfileService,
    private readonly flights: FlightsService,
    @Inject(LLM) private readonly llm: LlmPort
  ) {}

  // Preço real de voo por destino a partir da origem da viagem
  // (/v1/city-directions). Substitui a média do catálogo, que é sempre "saindo
  // de GRU" e não sabe nada sobre quem está buscando. Provider fora do ar
  // devolve mapa vazio e a estimativa do catálogo continua valendo.
  private async realFlightPrices(userId: string, tripId: string): Promise<Map<string, number>> {
    const section = await this.flights.cityDirections(userId, tripId);
    return new Map(section.offers.map((deal) => [deal.destination, deal.price]));
  }

  async run(userId: string, tripId: string): Promise<DestinationCandidate[]> {
    const trip = await this.trips.get(userId, tripId);
    const profile = await this.loadProfile(userId);
    const catalog = await this.catalog.all();

    const shortlist = prefilterDestinations({ catalog, trip: tripCriteria(trip), profile });
    if (shortlist.length < MIN_SHORTLIST) {
      throw new DomainError(
        "no_destinations_in_budget",
        "nenhum destino do catálogo cabe no orçamento e nas datas informadas"
      );
    }

    const ranking = await this.llm.rankDestinations({
      shortlist: shortlist.map((entry) => ({
        iata: entry.iata,
        city: entry.city,
        country: entry.country,
        tags: entry.tags
      })),
      profile,
      trip: {
        originIata: trip.originIata,
        budgetTotal: trip.budgetTotal,
        currency: trip.currency,
        party: { adults: trip.party.adults }
      }
    });

    const byIata = new Map(catalog.map((entry) => [entry.iata, entry]));
    const realPrices = await this.realFlightPrices(userId, tripId);
    const candidates = ranking.map((item) =>
      toCandidate(item, byIata.get(item.iata)!, trip.currency, realPrices.get(item.iata))
    );

    await this.db.transaction(async (tx) => {
      await tx.delete(tripDestinations).where(eq(tripDestinations.tripId, tripId));
      await tx.insert(tripDestinations).values(
        candidates.map((candidate) => ({
          id: crypto.randomUUID(),
          tripId,
          city: candidate.city,
          country: candidate.country,
          iata: candidate.iata,
          score: String(candidate.score),
          rationale: candidate.rationale,
          estCost: candidate.estCost,
          climate: candidate.climate,
          // sem fonte de tempo de voo no MVP — sempre null (ver toCandidate)
          flightTimeHours: null,
          chosen: false
        }))
      );
    });

    return candidates;
  }

  private async loadProfile(userId: string): Promise<TasteProfileInput> {
    try {
      return await this.profiles.get(userId);
    } catch (err) {
      if (isDomainError(err) && err.code === "not_found") {
        throw new NotFoundError("taste_profile_required");
      }
      throw err;
    }
  }
}

function toCandidate(
  item: LlmRankingItem,
  entry: CatalogEntry,
  currency: string,
  realFlightPrice?: number
): DestinationCandidate {
  return destinationCandidateSchema.parse({
    iata: item.iata,
    city: entry.city,
    country: entry.country,
    score: item.score,
    rationale: item.rationale,
    estCost: {
      flight: realFlightPrice ?? entry.avgFlightCostFromGru,
      lodgingPerNight: entry.avgLodgingNight,
      dailyLocal: entry.avgDailyLocal,
      currency
    },
    climate: {
      // sem fonte de clima no MVP; bestMonths e summary saem do catalogo
      expectedC: null,
      summary: `melhor época nos meses ${entry.bestMonths.join(", ")}`,
      bestMonths: entry.bestMonths
    },
    flightTimeHours: null
  });
}

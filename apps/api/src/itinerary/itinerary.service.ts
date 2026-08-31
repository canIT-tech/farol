import { Inject, Injectable } from "@nestjs/common";
import {
  DomainError,
  NotFoundError,
  type Itinerary,
  type ItineraryItem,
  type SwapRestaurantInput
} from "@farol/shared";
import { JOB_NAMES } from "../jobs/job-names";
import { JOB_QUEUE, type JobQueue } from "../jobs/job-queue";
import { PlacesService } from "../places/places.service";
import { TripsService } from "../trips/trips.service";
import { ItineraryRepository, toItineraryItem } from "./itinerary.repository";

const DEFAULT_CUISINE = "restaurante";

@Injectable()
export class ItineraryService {
  constructor(
    private readonly repo: ItineraryRepository,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    private readonly trips: TripsService,
    private readonly places: PlacesService
  ) {}

  // Escolhe o destino, cria a próxima versão pendente e enfileira a geração.
  async chooseDestination(
    userId: string,
    tripId: string,
    iata: string
  ): Promise<{ itineraryId: string }> {
    const trip = await this.trips.get(userId, tripId);
    if (!trip.destinations.some((destination) => destination.iata === iata)) {
      throw new NotFoundError("destino não está entre os candidatos da viagem");
    }

    await this.repo.markChosen(tripId, iata);
    const version = (await this.repo.maxVersion(tripId)) + 1;
    const itineraryId = await this.repo.createPending(tripId, version);
    await this.queue.publish(JOB_NAMES.itineraryGenerate, { itineraryId });
    return { itineraryId };
  }

  async getLatest(userId: string, tripId: string): Promise<Itinerary> {
    await this.trips.get(userId, tripId);
    return this.requireLatest(tripId);
  }

  // Enfileira a regeneração de um único dia do roteiro pronto.
  async regenerateDay(userId: string, tripId: string, dayIndex: number): Promise<void> {
    await this.trips.get(userId, tripId);
    const latest = await this.requireLatest(tripId);
    if (latest.status !== "ready") {
      throw new DomainError("itinerary_not_ready", "o roteiro ainda não está pronto");
    }
    if (!latest.days.some((day) => day.dayIndex === dayIndex)) {
      throw new NotFoundError("esse dia não existe no roteiro");
    }
    await this.queue.publish(JOB_NAMES.itineraryRegenerateDay, { itineraryId: latest.id, dayIndex });
  }

  // Troca o restaurante de um item de refeição por outro perto dele (design §6.4).
  async swapRestaurant(
    userId: string,
    tripId: string,
    itemId: string,
    opts: SwapRestaurantInput = {}
  ): Promise<ItineraryItem> {
    await this.trips.get(userId, tripId);

    const item = await this.repo.itemOfTrip(tripId, itemId);
    if (item === null) {
      throw new NotFoundError("item não encontrado neste roteiro");
    }
    if (item.type !== "meal") {
      throw new DomainError("item_not_swappable", "só dá para trocar um item de refeição");
    }

    const near =
      item.lat === null || item.lng === null
        ? undefined
        : { lat: Number(item.lat), lng: Number(item.lng) };
    const cuisine = opts.cuisine ?? DEFAULT_CUISINE;
    const query = near === undefined ? cuisine : `${cuisine} perto de ${near.lat},${near.lng}`;

    const place = await this.places.findFirst(query, {
      ...(near === undefined ? {} : { near }),
      type: "restaurant"
    });
    if (place === null) {
      throw new NotFoundError("nenhum restaurante encontrado para essa troca");
    }

    return toItineraryItem(await this.repo.applyPlaceToItem(itemId, place));
  }

  private async requireLatest(tripId: string): Promise<Itinerary> {
    const itinerary = await this.repo.latest(tripId);
    if (!itinerary) {
      throw new NotFoundError("roteiro ainda não foi iniciado para esta viagem");
    }
    return itinerary;
  }
}

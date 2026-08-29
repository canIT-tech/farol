import { Inject, Injectable } from "@nestjs/common";
import { DomainError, NotFoundError, type Itinerary } from "@farol/shared";
import { JOB_NAMES } from "../jobs/job-names";
import { JOB_QUEUE, type JobQueue } from "../jobs/job-queue";
import { TripsService } from "../trips/trips.service";
import { ItineraryRepository } from "./itinerary.repository";

@Injectable()
export class ItineraryService {
  constructor(
    private readonly repo: ItineraryRepository,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    private readonly trips: TripsService
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

  private async requireLatest(tripId: string): Promise<Itinerary> {
    const itinerary = await this.repo.latest(tripId);
    if (!itinerary) {
      throw new NotFoundError("roteiro ainda não foi iniciado para esta viagem");
    }
    return itinerary;
  }
}

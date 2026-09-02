import type { INestApplicationContext } from "@nestjs/common";
import { ItineraryGenerateHandler } from "../itinerary/itinerary-generate.handler";
import { ItineraryRegenerateDayHandler } from "../itinerary/itinerary-regenerate-day.handler";
import { PlacesEnrichHandler } from "../itinerary/places-enrich.handler";
import { JOB_NAMES } from "./job-names";
import { JOB_QUEUE, type JobQueue } from "./job-queue";
import type { ItineraryGenerateData } from "../itinerary/itinerary-generate.handler";
import type { ItineraryRegenerateDayData } from "../itinerary/itinerary-regenerate-day.handler";
import type { PlacesEnrichData } from "../itinerary/places-enrich.handler";

// Liga cada nome de fila ao seu handler. Mora na api porque os handlers sao
// classes dela; o apps/worker e o proprio bootstrap da api chamam a mesma
// funcao, cada um uma vez.
export async function registerHandlers(app: INestApplicationContext): Promise<void> {
  const queue = app.get<JobQueue>(JOB_QUEUE);
  const generate = app.get(ItineraryGenerateHandler);
  const regenerateDay = app.get(ItineraryRegenerateDayHandler);
  const placesEnrich = app.get(PlacesEnrichHandler);

  await queue.work<ItineraryGenerateData>(JOB_NAMES.itineraryGenerate, (data) =>
    generate.handle(data)
  );
  await queue.work<ItineraryRegenerateDayData>(JOB_NAMES.itineraryRegenerateDay, (data) =>
    regenerateDay.handle(data)
  );
  await queue.work<PlacesEnrichData>(JOB_NAMES.placesEnrich, (data) => placesEnrich.handle(data));
}

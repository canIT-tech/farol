// Superfície que o apps/worker consome para montar o processo de jobs (sem HTTP).
export { ConfigModule } from "./config/config.module";
export { DbModule } from "./db/db.module";
export { LlmModule } from "./llm/llm.module";
export { JobsModule } from "./jobs/jobs.module";
// O worker precisa do Places para o enrich do roteiro (Passo 6). ProvidersModule
// é @Global mas ainda tem que ser importado uma vez pelo módulo raiz do processo.
export { ProvidersModule, PLACES_PROVIDER } from "./providers/providers.module";
export { PlacesModule } from "./places/places.module";
export { PlacesService } from "./places/places.service";
export { ItineraryRepository } from "./itinerary/itinerary.repository";
export { JOB_QUEUE, type JobQueue } from "./jobs/job-queue";
export { JOB_NAMES } from "./jobs/job-names";
export { LLM, type LlmPort } from "./llm/llm.types";
export { FakeLlmService } from "./llm/fake-llm.service";
export {
  ItineraryGenerateHandler,
  type ItineraryGenerateData
} from "./itinerary/itinerary-generate.handler";
export {
  ItineraryRegenerateDayHandler,
  type ItineraryRegenerateDayData
} from "./itinerary/itinerary-regenerate-day.handler";
export { PlacesEnrichHandler, type PlacesEnrichData } from "./itinerary/places-enrich.handler";
export { registerHandlers } from "./jobs/register-handlers";

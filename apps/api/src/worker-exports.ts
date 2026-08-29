// Superfície que o apps/worker consome para montar o processo de jobs (sem HTTP).
export { ConfigModule } from "./config/config.module";
export { DbModule } from "./db/db.module";
export { LlmModule } from "./llm/llm.module";
export { JobsModule } from "./jobs/jobs.module";
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

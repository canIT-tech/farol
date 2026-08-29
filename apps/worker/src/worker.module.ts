import { Module } from "@nestjs/common";
import {
  ConfigModule,
  DbModule,
  LlmModule,
  JobsModule,
  ItineraryRepository,
  ItineraryGenerateHandler
} from "@farol/api";

// Processo de jobs: só a infra + os handlers, sem HTTP (nada de controllers/guards).
@Module({
  imports: [ConfigModule, DbModule, LlmModule, JobsModule],
  providers: [ItineraryRepository, ItineraryGenerateHandler],
  exports: [ItineraryGenerateHandler]
})
export class WorkerModule {}

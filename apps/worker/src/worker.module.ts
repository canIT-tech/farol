import { Module } from "@nestjs/common";
import {
  ConfigModule,
  DbModule,
  LlmModule,
  JobsModule,
  ItineraryRepository,
  ItineraryGenerateHandler,
  ItineraryRegenerateDayHandler
} from "@farol/api";

// Processo de jobs: só a infra + os handlers, sem HTTP (nada de controllers/guards).
@Module({
  imports: [ConfigModule, DbModule, LlmModule, JobsModule],
  providers: [ItineraryRepository, ItineraryGenerateHandler, ItineraryRegenerateDayHandler],
  exports: [ItineraryGenerateHandler, ItineraryRegenerateDayHandler]
})
export class WorkerModule {}

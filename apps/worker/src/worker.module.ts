import { Module } from "@nestjs/common";
import {
  ConfigModule,
  DbModule,
  LlmModule,
  JobsModule,
  ProvidersModule,
  PlacesModule,
  ItineraryRepository,
  CreditsService,
  ItineraryGenerateHandler,
  ItineraryRegenerateDayHandler,
  PlacesEnrichHandler
} from "@farol/api";

// Processo de jobs: só a infra + os handlers, sem HTTP (nada de controllers/guards).
// ProvidersModule/PlacesModule entram porque o enrich do roteiro (Passo 6) roda aqui.
// CreditsService entra porque o handler do roteiro devolve o crédito no dead-letter.
@Module({
  imports: [ConfigModule, DbModule, LlmModule, JobsModule, ProvidersModule, PlacesModule],
  providers: [
    ItineraryRepository,
    CreditsService,
    ItineraryGenerateHandler,
    ItineraryRegenerateDayHandler,
    PlacesEnrichHandler
  ],
  exports: [ItineraryGenerateHandler, ItineraryRegenerateDayHandler, PlacesEnrichHandler]
})
export class WorkerModule {}

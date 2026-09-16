import { Global, Module } from "@nestjs/common";
import { CreditsService } from "./credits.service";

// Global: ItineraryModule, PaymentsModule e o worker usam o mesmo serviço.
@Global()
@Module({ providers: [CreditsService], exports: [CreditsService] })
export class CreditsModule {}

import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { CreditsModule } from "./credits/credits.module";
import { HealthModule } from "./health/health.module";
import { AuthGuard } from "./auth/auth.guard";
import { AuthModule } from "./auth/auth.module";
import { MeModule } from "./me/me.module";
import { ProfileModule } from "./profile/profile.module";
import { LlmModule } from "./llm/llm.module";
import { TripsModule } from "./trips/trips.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { JobsModule } from "./jobs/jobs.module";
import { ItineraryModule } from "./itinerary/itinerary.module";
import { ProvidersModule } from "./providers/providers.module";
import { FlightsModule } from "./flights/flights.module";
import { GeoModule } from "./geo/geo.module";
import { HotelsModule } from "./hotels/hotels.module";
import { WaitlistModule } from "./waitlist/waitlist.module";
import { ChatModule } from "./chat/chat.module";
import { EmailModule } from "./email/email.module";
import { PaymentsModule } from "./payments/payments.module";

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule,
    DbModule,
    CreditsModule,
    HealthModule,
    AuthModule,
    MeModule,
    ProfileModule,
    LlmModule,
    TripsModule,
    DiscoveryModule,
    JobsModule,
    ItineraryModule,
    ProvidersModule,
    FlightsModule,
    GeoModule,
    HotelsModule,
    EmailModule,
    WaitlistModule,
    ChatModule,
    PaymentsModule
  ],
  // Guard global: toda rota exige credencial, e abrir uma vira um @Public()
  // explícito no controller. O arranjo anterior era o inverso — cada controller
  // lembrava do @UseGuards, e esquecer publicava a rota sem que nada acusasse.
  // SentryGlobalFilter reporta ao Sentry só o que não é HttpException (erro de
  // verdade, não 4xx esperado) e devolve a resposta padrão do Nest. Filtros
  // mais específicos, como o DomainExceptionFilter do ProfileModule, continuam
  // valendo para os erros que eles declaram.
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: AuthGuard }
  ]
})
export class AppModule {}


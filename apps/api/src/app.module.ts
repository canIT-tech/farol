import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { MeModule } from "./me/me.module";
import { ProfileModule } from "./profile/profile.module";
import { LlmModule } from "./llm/llm.module";
import { TripsModule } from "./trips/trips.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { JobsModule } from "./jobs/jobs.module";
import { ProvidersModule } from "./providers/providers.module";
import { FlightsModule } from "./flights/flights.module";
import { HotelsModule } from "./hotels/hotels.module";

@Module({
  imports: [
    ConfigModule,
    DbModule,
    HealthModule,
    AuthModule,
    MeModule,
    ProfileModule,
    LlmModule,
    TripsModule,
    DiscoveryModule,
    JobsModule,
    ProvidersModule,
    FlightsModule,
    HotelsModule
  ]
})
export class AppModule {}

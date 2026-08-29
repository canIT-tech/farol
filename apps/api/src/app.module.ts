import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { MeModule } from "./me/me.module";
import { ProfileModule } from "./profile/profile.module";
import { LlmModule } from "./llm/llm.module";
import { TripsModule } from "./trips/trips.module";

@Module({
  imports: [
    ConfigModule,
    DbModule,
    HealthModule,
    AuthModule,
    MeModule,
    ProfileModule,
    LlmModule,
    TripsModule
  ]
})
export class AppModule {}

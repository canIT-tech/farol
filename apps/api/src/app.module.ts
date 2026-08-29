import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { MeModule } from "./me/me.module";

@Module({ imports: [ConfigModule, DbModule, HealthModule, AuthModule, MeModule] })
export class AppModule {}

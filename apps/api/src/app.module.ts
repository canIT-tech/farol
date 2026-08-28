import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { HealthModule } from "./health/health.module";

@Module({ imports: [ConfigModule, DbModule, HealthModule] })
export class AppModule {}

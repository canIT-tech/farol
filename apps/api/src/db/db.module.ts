import { Global, Module } from "@nestjs/common";
import { createDbClient } from "@farol/db";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";

export const DB = Symbol("DB");

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ENV],
      useFactory: (env: Env) => createDbClient(env.DATABASE_URL).db
    }
  ],
  exports: [DB]
})
export class DbModule {}

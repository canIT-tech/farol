import { Global, Module } from "@nestjs/common";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { JOB_QUEUE } from "./job-queue";
import { PgBossQueue } from "./pgboss-queue";

@Global()
@Module({
  providers: [
    {
      provide: JOB_QUEUE,
      inject: [ENV],
      useFactory: (env: Env) => new PgBossQueue({ url: env.DATABASE_URL, schema: env.JOBS_SCHEMA })
    }
  ],
  exports: [JOB_QUEUE]
})
export class JobsModule {}

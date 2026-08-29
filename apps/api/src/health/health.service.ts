import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { HealthResponse } from "@farol/shared";
import { DB } from "../db/db.module";

type Queryable = { execute: (q: unknown) => Promise<unknown> };

@Injectable()
export class HealthService {
  constructor(@Inject(DB) private readonly db: Queryable) {}

  async check(): Promise<HealthResponse> {
    const version = process.env.npm_package_version ?? "0.0.0";
    try {
      await this.db.execute(sql`select 1`);
      return { status: "ok", checks: { db: "up" }, version };
    } catch {
      return { status: "degraded", checks: { db: "down" }, version };
    }
  }
}

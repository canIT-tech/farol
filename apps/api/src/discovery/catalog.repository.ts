import { Inject, Injectable } from "@nestjs/common";
import { destinationCatalog, type Database } from "@farol/db";
import type { CatalogEntry } from "@farol/domain";
import { DB } from "../db/db.module";

@Injectable()
export class CatalogRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async all(): Promise<CatalogEntry[]> {
    const rows = await this.db.select().from(destinationCatalog);
    return rows.map((row) => ({
      city: row.city,
      country: row.country,
      iata: row.iata,
      tags: row.tags,
      bestMonths: row.bestMonths,
      avgFlightCostFromGru: Number(row.avgFlightCostFromGru),
      avgLodgingNight: Number(row.avgLodgingNight),
      avgDailyLocal: Number(row.avgDailyLocal),
      region: row.region,
      visaFreeBr: row.visaFreeBr
    }));
  }
}

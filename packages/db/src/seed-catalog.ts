import { readFileSync } from "node:fs";
import { createDbClient } from "./client.js";
import { destinationCatalog } from "./schema.js";

export interface CatalogRow {
  city: string;
  country: string;
  iata: string;
  tags: string[];
  bestMonths: number[];
  avgFlightCostFromGru: string;
  avgLodgingNight: string;
  avgDailyLocal: string;
  region: string;
  visaFreeBr: boolean;
}

const HEADER = [
  "city",
  "country",
  "iata",
  "tags",
  "bestMonths",
  "avgFlightCostFromGru",
  "avgLodgingNight",
  "avgDailyLocal",
  "region",
  "visaFreeBr"
] as const;

function splitList(cell: string): string[] {
  return cell
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function parseCatalogCsv(text: string): CatalogRow[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const headerLine = lines[0];
  if (headerLine !== HEADER.join(",")) {
    throw new Error(`cabeçalho do CSV inesperado: ${String(headerLine)}`);
  }

  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    if (cells.length !== HEADER.length) {
      throw new Error(`linha com ${cells.length} campos (esperado ${HEADER.length}): ${line}`);
    }
    const at = (name: (typeof HEADER)[number]): string => cells[HEADER.indexOf(name)]!.trim();
    return {
      city: at("city"),
      country: at("country"),
      iata: at("iata"),
      tags: splitList(at("tags")),
      bestMonths: splitList(at("bestMonths")).map((month) => Number(month)),
      avgFlightCostFromGru: at("avgFlightCostFromGru"),
      avgLodgingNight: at("avgLodgingNight"),
      avgDailyLocal: at("avgDailyLocal"),
      region: at("region"),
      visaFreeBr: at("visaFreeBr") === "true"
    };
  });
}

// Idempotente: upsert por iata. Retorna quantas linhas o CSV trouxe.
export async function seedCatalog(url: string, csvPath: string): Promise<{ inserted: number }> {
  const rows = parseCatalogCsv(readFileSync(csvPath, "utf8"));
  const { db, close } = createDbClient(url);
  try {
    for (const row of rows) {
      await db
        .insert(destinationCatalog)
        .values({ id: crypto.randomUUID(), ...row })
        .onConflictDoUpdate({
          target: destinationCatalog.iata,
          set: {
            city: row.city,
            country: row.country,
            tags: row.tags,
            bestMonths: row.bestMonths,
            avgFlightCostFromGru: row.avgFlightCostFromGru,
            avgLodgingNight: row.avgLodgingNight,
            avgDailyLocal: row.avgDailyLocal,
            region: row.region,
            visaFreeBr: row.visaFreeBr
          }
        });
    }
    return { inserted: rows.length };
  } finally {
    await close();
  }
}

export const DEFAULT_CATALOG_CSV = new URL("../data/destinations.csv", import.meta.url);

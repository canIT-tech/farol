import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { createDbClient } from "./client";
import { runMigrations } from "./migrate";
import { parseCatalogCsv, seedCatalog, DEFAULT_CATALOG_CSV } from "./seed-catalog";
import { destinationCatalog } from "./schema";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/db");

const csvPath = fileURLToPath(DEFAULT_CATALOG_CSV);
const { db, close } = createDbClient(url);

beforeAll(async () => {
  await runMigrations(url);
  await db.delete(destinationCatalog);
});
afterAll(() => close());

const HEADER =
  "city,country,iata,tags,bestMonths,avgFlightCostFromGru,avgLodgingNight,avgDailyLocal,region,visaFreeBr";

describe("parseCatalogCsv", () => {
  it("parseia uma linha em tipos ricos", () => {
    const text = `${HEADER}\nLisboa,Portugal,LIS,cultura;vinhos,4;5;10,3200,180,140,europe,true`;
    const [row] = parseCatalogCsv(text);
    expect(row).toEqual({
      city: "Lisboa",
      country: "Portugal",
      iata: "LIS",
      tags: ["cultura", "vinhos"],
      bestMonths: [4, 5, 10],
      avgFlightCostFromGru: "3200",
      avgLodgingNight: "180",
      avgDailyLocal: "140",
      region: "europe",
      visaFreeBr: true
    });
  });

  it("ignora linhas em branco e trata visaFreeBr diferente de 'true' como false", () => {
    const text = `${HEADER}\n\nOrlando,Estados Unidos,MCO,familia,3;4,2400,260,200,north-america,false\n`;
    const rows = parseCatalogCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.visaFreeBr).toBe(false);
  });

  it("descarta itens vazios em tags/bestMonths (`;` duplicado ou no fim)", () => {
    const text = `${HEADER}\nLisboa,Portugal,LIS,praia ; ; relaxar ;, 4 ;; 5 ;,3200,180,140,europe,true`;
    const [row] = parseCatalogCsv(text);
    expect(row!.tags).toEqual(["praia", "relaxar"]);
    expect(row!.bestMonths).toEqual([4, 5]);
  });

  it("rejeita cabeçalho inesperado", () => {
    expect(() => parseCatalogCsv("cidade,pais\nLisboa,Portugal")).toThrow(/cabeçalho/);
  });

  it("rejeita linha com número de campos errado", () => {
    expect(() => parseCatalogCsv(`${HEADER}\nLisboa,Portugal,LIS`)).toThrow(/campos/);
  });
});

describe("seedCatalog", () => {
  it("insere as cidades do CSV e é idempotente", async () => {
    const first = await seedCatalog(url, csvPath);
    expect(first.inserted).toBeGreaterThanOrEqual(20);

    const second = await seedCatalog(url, csvPath);
    expect(second.inserted).toBe(first.inserted);

    const rows = await db.select().from(destinationCatalog);
    expect(rows.length).toBe(first.inserted);
  });

  it("cada linha tem tags e bestMonths não-vazios e iata de 3 letras", async () => {
    const rows = await db.select().from(destinationCatalog);
    for (const row of rows) {
      expect(row.tags.length).toBeGreaterThan(0);
      expect(row.bestMonths.length).toBeGreaterThan(0);
      expect(row.bestMonths.every((m) => m >= 1 && m <= 12)).toBe(true);
      expect(row.iata).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("atualiza uma linha existente em vez de duplicar (upsert por iata)", async () => {
    await db
      .update(destinationCatalog)
      .set({ avgLodgingNight: "1" })
      .where(sql`${destinationCatalog.iata} = 'LIS'`);
    await seedCatalog(url, csvPath);
    const [lis] = await db
      .select()
      .from(destinationCatalog)
      .where(sql`${destinationCatalog.iata} = 'LIS'`);
    expect(lis!.avgLodgingNight).not.toBe("1");
  });
});

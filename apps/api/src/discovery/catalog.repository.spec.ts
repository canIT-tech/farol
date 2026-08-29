import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { createDbClient, runMigrations, seedCatalog, DEFAULT_CATALOG_CSV } from "@farol/db";
import { CatalogRepository } from "./catalog.repository";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const repo = new CatalogRepository(db);

beforeAll(async () => {
  await runMigrations(url);
  await seedCatalog(url, fileURLToPath(DEFAULT_CATALOG_CSV));
});
afterAll(() => close());

describe("CatalogRepository.all", () => {
  it("lê o catálogo com os campos de custo já em number", async () => {
    const all = await repo.all();
    expect(all.length).toBeGreaterThanOrEqual(20);
    const lisbon = all.find((entry) => entry.iata === "LIS");
    expect(lisbon).toBeDefined();
    expect(typeof lisbon!.avgFlightCostFromGru).toBe("number");
    expect(typeof lisbon!.avgLodgingNight).toBe("number");
    expect(typeof lisbon!.avgDailyLocal).toBe("number");
    expect(Array.isArray(lisbon!.tags)).toBe(true);
    expect(Array.isArray(lisbon!.bestMonths)).toBe(true);
    expect(typeof lisbon!.visaFreeBr).toBe("boolean");
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";

process.env.SUPABASE_JWKS_URL ??= "https://example.com/jwks.json";
process.env.ANTHROPIC_API_KEY ??= "sk-ant-worker-enrich";
process.env.AMADEUS_CLIENT_ID ??= "amadeus-worker-id";
process.env.AMADEUS_CLIENT_SECRET ??= "amadeus-worker-secret";
process.env.GOOGLE_PLACES_KEY ??= "google-places-worker";
process.env.JOBS_SCHEMA = `pgboss_enrich_${Math.random().toString(36).slice(2, 8)}`;

import { Test, type TestingModule } from "@nestjs/testing";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  users,
  trips,
  tripDestinations,
  itineraries,
  itineraryDays,
  itineraryItems
} from "@farol/db";
import { PLACES_PROVIDER } from "@farol/api";
import type { Place } from "@farol/shared";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para o e2e do worker");

const { db, close } = createDbClient(url);
let app: TestingModule;

const ACHADO: Place = {
  placeId: "place-achado",
  name: "Lugar Achado",
  lat: 38.72,
  lng: -9.14,
  rating: 4.5,
  priceLevel: 2,
  types: ["tourist_attraction"]
};

// Provider que agora acha tudo — é o cenário do reprocessamento.
const provider = {
  textSearch: () => Promise.resolve([ACHADO]),
  details: () => Promise.resolve({ ...ACHADO, address: null, openingHours: null })
};

async function waitFor(predicate: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("timeout esperando a condição");
}

beforeAll(async () => {
  await runMigrations(url);
  const { WorkerModule } = await import("../src/worker.module");
  const { registerHandlers } = await import("../src/register-handlers");
  app = await Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(PLACES_PROVIDER)
    .useValue(provider)
    .compile();
  await app.init();
  await registerHandlers(app);
});

afterAll(async () => {
  await app.close();
  const client = postgres(url, { max: 1 });
  try {
    await client.unsafe(`drop schema if exists "${process.env.JOBS_SCHEMA}" cascade`);
  } finally {
    await client.end({ timeout: 5 });
  }
  await close();
});

describe("worker — places.enrich ponta a ponta", () => {
  it("reprocessa os itens needsReview e preenche o lugar", async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({ id: userId, email: `${userId}@farol.test` });
    const tripId = crypto.randomUUID();
    await db.insert(trips).values({
      id: tripId,
      userId,
      status: "planned",
      originIata: "GRU",
      durationDays: 1,
      targetMonth: "2026-09",
      party: { adults: 2, children: 0 },
      budgetTotal: "30000",
      currency: "BRL"
    });
    await db.insert(tripDestinations).values({
      id: crypto.randomUUID(),
      tripId,
      city: "Lisboa",
      country: "Portugal",
      iata: "LIS",
      score: "0.8",
      rationale: "Justificativa longa o suficiente para o schema aqui.",
      estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
      climate: { expectedC: 24, summary: "ameno", bestMonths: [9] },
      flightTimeHours: null,
      chosen: true
    });

    const itineraryId = crypto.randomUUID();
    await db.insert(itineraries).values({ id: itineraryId, tripId, version: 1, status: "ready" });
    const dayId = crypto.randomUUID();
    await db.insert(itineraryDays).values({ id: dayId, itineraryId, dayIndex: 1 });
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    await db.insert(itineraryItems).values([
      {
        id: first,
        dayId,
        slot: "morning",
        type: "activity",
        title: "Museu do Azulejo",
        sortOrder: 0,
        needsReview: true
      },
      {
        id: second,
        dayId,
        slot: "afternoon",
        type: "meal",
        title: "Almoço no bairro",
        sortOrder: 1,
        needsReview: true
      }
    ]);

    const { JOB_NAMES, JOB_QUEUE } = await import("@farol/api");
    const queue = app.get(JOB_QUEUE);
    await queue.publish(JOB_NAMES.placesEnrich, { itineraryId });

    await waitFor(async () => {
      const rows = await db.select().from(itineraryItems).where(eq(itineraryItems.dayId, dayId));
      return rows.length >= 2 && rows.every((row) => !row.needsReview && row.placeId !== null);
    }, 20_000);

    const rows = await db.select().from(itineraryItems).where(eq(itineraryItems.id, first));
    expect(rows[0]!.placeId).toBe("place-achado");
    expect(Number(rows[0]!.lat)).toBeCloseTo(38.72);

    await db.delete(users).where(eq(users.id, userId));
  });
});

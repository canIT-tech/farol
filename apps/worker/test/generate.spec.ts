import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Os specs abrem o banco por DATABASE_URL_TEST; o WorkerModule le DATABASE_URL.
// Sem alinhar os dois, o worker escreve num banco e o teste confere no outro.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

process.env.SUPABASE_JWKS_URL ??= "https://example.com/jwks.json";
process.env.TRAVELPAYOUTS_TOKEN ??= "travelpayouts-worker-token";
process.env.TRAVELPAYOUTS_MARKER ??= "farol-worker";
process.env.GOOGLE_PLACES_KEY ??= "google-places-worker";
process.env.JOBS_SCHEMA = `pgboss_worker_${Math.random().toString(36).slice(2, 8)}`;

import { Test, type TestingModule } from "@nestjs/testing";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  users,
  trips,
  tripDestinations,
  tasteProfiles,
  itineraries,
  itineraryDays
} from "@farol/db";
import { LLM, FakeLlmService } from "@farol/api";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para o e2e do worker");

const { db, close } = createDbClient(url);
let app: TestingModule;

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
  const { registerHandlers } = await import("@farol/api");
  app = await Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(LLM)
    .useClass(FakeLlmService)
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

describe("worker — itinerary.generate ponta a ponta", () => {
  it("processa o job publicado e deixa o itinerary ready com dias", async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({ id: userId, email: `${userId}@farol.test` });
    await db.insert(tasteProfiles).values({
      id: crypto.randomUUID(),
      userId,
      interests: ["praia", "gastronomia", "cultura e museus"],
      pace: "moderado",
      partyType: "casal",
      budgetBand: "medio"
    });
    const tripId = crypto.randomUUID();
    await db.insert(trips).values({
      id: tripId,
      userId,
      status: "draft",
      originIata: "GRU",
      durationDays: 2,
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
    await db.insert(itineraries).values({ id: itineraryId, tripId, version: 1, status: "pending" });

    const { JOB_NAMES, JOB_QUEUE } = await import("@farol/api");
    const queue = app.get(JOB_QUEUE);
    await queue.publish(JOB_NAMES.itineraryGenerate, { itineraryId });

    await waitFor(async () => {
      const [row] = await db.select().from(itineraries).where(eq(itineraries.id, itineraryId));
      return row?.status === "ready";
    }, 20_000);

    const days = await db
      .select()
      .from(itineraryDays)
      .where(eq(itineraryDays.itineraryId, itineraryId));
    expect(days).toHaveLength(2);

    // ---- regenerate-day ponta a ponta ----
    const { itineraryItems } = await import("@farol/db");
    const [day1] = await db
      .select()
      .from(itineraryDays)
      .where(eq(itineraryDays.itineraryId, itineraryId))
      .orderBy(itineraryDays.dayIndex)
      .limit(1);
    const day1Items = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.dayId, day1!.id));
    const pinnedItem = day1Items[0]!;
    const swappable = day1Items[1]!;
    await db.update(itineraryItems).set({ pinned: true }).where(eq(itineraryItems.id, pinnedItem.id));
    await db
      .update(itineraryItems)
      .set({ title: "TITULO ANTIGO PARA TROCAR" })
      .where(eq(itineraryItems.id, swappable.id));

    await queue.publish(JOB_NAMES.itineraryRegenerateDay, { itineraryId, dayIndex: day1!.dayIndex });

    await waitFor(async () => {
      const now = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.dayId, day1!.id));
      return (
        now.some((i) => i.pinned && i.title === pinnedItem.title) &&
        !now.some((i) => i.title === "TITULO ANTIGO PARA TROCAR")
      );
    }, 20_000);

    await db.delete(users).where(eq(users.id, userId));
  });
});

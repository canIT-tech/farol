import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  users,
  tripDestinations,
  tasteProfiles,
  itineraries,
  itineraryDays,
  itineraryItems
} from "@farol/db";
import type { TripInput } from "@farol/shared";
import { ItineraryGenerateHandler } from "./itinerary-generate.handler";
import { ItineraryRepository } from "./itinerary.repository";
import { TripsService } from "../trips/trips.service";
import { FakeLlmService } from "../llm/fake-llm.service";
import type { LlmPort } from "../llm/llm.types";
import type { PlacesService } from "../places/places.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const repo = new ItineraryRepository(db);
const tripsService = new TripsService(db);

// O enrich do Places é exercido em enrich-itinerary.spec.ts; aqui um fake que
// nunca acha lugar mantém o foco do spec na geração em si.
const places = { findFirst: () => Promise.resolve(null) } as unknown as PlacesService;
const handler = new ItineraryGenerateHandler(repo, new FakeLlmService(), db, places);

const userIds: string[] = [];

const tripInput: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 1 },
  budgetTotal: 30000,
  currency: "BRL",
  durationDays: 3,
  targetMonth: "2026-09"
};

async function scenario(): Promise<{ tripId: string; itineraryId: string }> {
  const userId = crypto.randomUUID();
  userIds.push(userId);
  await db.insert(users).values({ id: userId, email: `${userId}@farol.test` });
  await db.insert(tasteProfiles).values({
    id: crypto.randomUUID(),
    userId,
    interests: ["praia", "gastronomia", "cultura e museus"],
    pace: "moderado",
    partyType: "casal",
    budgetBand: "medio"
  });
  const trip = await tripsService.create(userId, tripInput);
  await db.insert(tripDestinations).values({
    id: crypto.randomUUID(),
    tripId: trip.id,
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
  const itineraryId = await repo.createPending(trip.id, 1);
  return { tripId: trip.id, itineraryId };
}

async function itemsOf(itineraryId: string) {
  return db
    .select()
    .from(itineraryItems)
    .innerJoin(itineraryDays, eq(itineraryItems.dayId, itineraryDays.id))
    .where(eq(itineraryDays.itineraryId, itineraryId));
}

beforeAll(async () => {
  await runMigrations(url);
});
afterEach(async () => {
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("ItineraryGenerateHandler.handle", () => {
  it("gera os dias e itens, marca ready e seta generatedAt", async () => {
    const { itineraryId } = await scenario();
    await handler.handle({ itineraryId });

    const [it] = await db.select().from(itineraries).where(eq(itineraries.id, itineraryId));
    expect(it!.status).toBe("ready");
    expect(it!.generatedAt).not.toBeNull();

    const days = await db
      .select()
      .from(itineraryDays)
      .where(eq(itineraryDays.itineraryId, itineraryId));
    expect(days).toHaveLength(3); // durationDays
    const items = await itemsOf(itineraryId);
    expect(items.length).toBeGreaterThan(0);
  });

  it("reprocessar o mesmo itineraryId não duplica dias (idempotente)", async () => {
    const { itineraryId } = await scenario();
    await handler.handle({ itineraryId });
    await handler.handle({ itineraryId });
    const days = await db
      .select()
      .from(itineraryDays)
      .where(eq(itineraryDays.itineraryId, itineraryId));
    expect(days).toHaveLength(3);
  });

  it("recoloca um item pinned da versão anterior", async () => {
    const { tripId, itineraryId } = await scenario();
    // v1 gerada e com um item pinned
    await handler.handle({ itineraryId });
    const firstItems = await itemsOf(itineraryId);
    const target = firstItems[0]!.itinerary_items;
    await db
      .update(itineraryItems)
      .set({ pinned: true })
      .where(eq(itineraryItems.id, target.id));

    // v2
    const v2 = await repo.createPending(tripId, 2);
    await handler.handle({ itineraryId: v2 });
    const v2Items = await itemsOf(v2);
    const pinnedBack = v2Items.filter((row) => row.itinerary_items.pinned);
    expect(pinnedBack.length).toBeGreaterThanOrEqual(1);
    expect(pinnedBack.map((row) => row.itinerary_items.title)).toContain(target.title);
  });

  it("em erro do LLM marca failed, preenche error e relança", async () => {
    const { itineraryId } = await scenario();
    const boom = {
      rankDestinations: () => Promise.reject(new Error("x")),
      buildItinerary: () => Promise.reject(new Error("modelo fora do ar"))
    } as unknown as LlmPort;
    const failing = new ItineraryGenerateHandler(repo, boom, db, places);

    await expect(failing.handle({ itineraryId })).rejects.toThrow("modelo fora do ar");
    const [it] = await db.select().from(itineraries).where(eq(itineraries.id, itineraryId));
    expect(it!.status).toBe("failed");
    expect(it!.error).toBe("modelo fora do ar");
  });

  it("serializa erro não-Error na coluna error", async () => {
    const { itineraryId } = await scenario();
    const boom = {
      rankDestinations: () => Promise.reject(new Error("x")),
      buildItinerary: () => Promise.reject("string crua")
    } as unknown as LlmPort;
    const failing = new ItineraryGenerateHandler(repo, boom, db, places);
    await expect(failing.handle({ itineraryId })).rejects.toBe("string crua");
    const [it] = await db.select().from(itineraries).where(eq(itineraries.id, itineraryId));
    expect(it!.status).toBe("failed");
    expect(it!.error).toBe("string crua");
  });

  it("lança quando o itineraryId não existe", async () => {
    await expect(handler.handle({ itineraryId: crypto.randomUUID() })).rejects.toThrow(/não existe/);
  });

  it("enriquece os itens usando cidade e país do destino escolhido", async () => {
    const { itineraryId } = await scenario();
    const findFirst = vi.fn((_query: string) => Promise.resolve(null));
    const enriching = new ItineraryGenerateHandler(repo, new FakeLlmService(), db, {
      findFirst
    } as unknown as PlacesService);

    await enriching.handle({ itineraryId });

    expect(findFirst).toHaveBeenCalled();
    expect(findFirst.mock.calls.every(([query]) => String(query).endsWith("Lisboa, Portugal"))).toBe(
      true
    );
    const items = await itemsOf(itineraryId);
    expect(items.every((row) => row.itinerary_items.needsReview)).toBe(true);
  });

  it("falha do enrich não derruba a geração: fica ready e loga o evento", async () => {
    const { itineraryId } = await scenario();
    // db quebrado só para o enrich; o repo continua usando o db real.
    const brokenDb = {
      select: () => {
        throw new Error("db fora do ar");
      }
    } as never;
    const resilient = new ItineraryGenerateHandler(repo, new FakeLlmService(), brokenDb, places);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await resilient.handle({ itineraryId });
      expect(errSpy.mock.calls[0]![0]).toContain("itinerary_enrich_failed");
    } finally {
      errSpy.mockRestore();
    }

    const [it] = await db.select().from(itineraries).where(eq(itineraries.id, itineraryId));
    expect(it!.status).toBe("ready");
  });
});


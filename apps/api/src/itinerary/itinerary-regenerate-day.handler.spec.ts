import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  users,
  tripDestinations,
  tasteProfiles,
  itineraryDays,
  itineraryItems
} from "@farol/db";
import type { TripInput } from "@farol/shared";
import { ItineraryRegenerateDayHandler } from "./itinerary-regenerate-day.handler";
import { ItineraryGenerateHandler } from "./itinerary-generate.handler";
import { ItineraryRepository } from "./itinerary.repository";
import { TripsService } from "../trips/trips.service";
import { FakeLlmService } from "../llm/fake-llm.service";
import type { LlmPort } from "../llm/llm.types";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const repo = new ItineraryRepository(db);
const tripsService = new TripsService(db);
const fake = new FakeLlmService();
const generate = new ItineraryGenerateHandler(repo, fake);
const handler = new ItineraryRegenerateDayHandler(repo, fake);
const userIds: string[] = [];

const tripInput: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 30000,
  currency: "BRL",
  durationDays: 3,
  targetMonth: "2026-09"
};

async function readyItinerary(): Promise<{ tripId: string; itineraryId: string }> {
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
  await generate.handle({ itineraryId });
  return { tripId: trip.id, itineraryId };
}

async function itemsOfDay(itineraryId: string, dayIndex: number) {
  const rows = await db
    .select()
    .from(itineraryItems)
    .innerJoin(itineraryDays, eq(itineraryItems.dayId, itineraryDays.id))
    .where(eq(itineraryDays.dayIndex, dayIndex));
  return rows
    .filter((row) => row.itinerary_days.itineraryId === itineraryId)
    .map((row) => row.itinerary_items);
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

describe("ItineraryRegenerateDayHandler.handle", () => {
  it("preserva os itens pinned do dia e troca os não-pinned; outros dias intactos", async () => {
    const { itineraryId } = await readyItinerary();

    const day1 = await itemsOfDay(itineraryId, 1);
    const keep = day1[0]!;
    await db.update(itineraryItems).set({ pinned: true }).where(eq(itineraryItems.id, keep.id));
    // renomeia os não-pinned do dia 2 para detectar que não mudam
    const day2Before = await itemsOfDay(itineraryId, 2);

    await handler.handle({ itineraryId, dayIndex: 1 });

    const day1After = await itemsOfDay(itineraryId, 1);
    expect(day1After.some((i) => i.pinned && i.title === keep.title)).toBe(true);
    // o item pinned continua exatamente um
    expect(day1After.filter((i) => i.pinned)).toHaveLength(1);

    const day2After = await itemsOfDay(itineraryId, 2);
    expect(day2After.map((i) => i.title).sort()).toEqual(day2Before.map((i) => i.title).sort());
  });

  it("lança quando o itinerary não existe", async () => {
    await expect(
      handler.handle({ itineraryId: crypto.randomUUID(), dayIndex: 1 })
    ).rejects.toThrow(/não existe/);
  });

  it("lança quando o dia não existe no roteiro", async () => {
    const { itineraryId } = await readyItinerary();
    await expect(handler.handle({ itineraryId, dayIndex: 99 })).rejects.toThrow(/dia 99/);
  });

  it("relança erro do LLM", async () => {
    const { itineraryId } = await readyItinerary();
    const boom = {
      rankDestinations: () => Promise.reject(new Error("x")),
      buildItinerary: () => Promise.reject(new Error("modelo caiu"))
    } as unknown as LlmPort;
    const failing = new ItineraryRegenerateDayHandler(repo, boom);
    await expect(failing.handle({ itineraryId, dayIndex: 1 })).rejects.toThrow("modelo caiu");
  });
});

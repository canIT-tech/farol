import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  users,
  tripDestinations,
  hotelSelections,
  providerCache
} from "@farol/db";
import { isDomainError, type TripInput } from "@farol/shared";
import { HotelsService } from "./hotels.service";
import { ProviderCacheRepository, cacheKey } from "../providers/provider-cache.repository";
import { buildHotelParams } from "../providers/trip-search";
import { TripsService } from "../trips/trips.service";
import { FakeHotelProvider, FAKE_HOTEL_OFFERS } from "../../test/support/fake-providers";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const trips = new TripsService(db);
const cache = new ProviderCacheRepository(db);
const env = { FLIGHT_CACHE_TTL_SECONDS: 600, HOTEL_CACHE_TTL_SECONDS: 3600 } as never;

const userIds: string[] = [];

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  userIds.push(id);
  await db.insert(users).values({ id, email: `${id}@farol.test` });
  return id;
}

const tripInput: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 20000,
  currency: "BRL",
  durationDays: 7,
  targetMonth: "2026-09"
};

async function tripWithChosenDestination(userId: string): Promise<string> {
  const trip = await trips.create(userId, tripInput);
  await db.insert(tripDestinations).values({
    id: crypto.randomUUID(),
    tripId: trip.id,
    city: "Lisboa",
    country: "Portugal",
    iata: "LIS",
    score: "0.8",
    rationale: "Justificativa longa o suficiente para o schema aqui.",
    estCost: { flight: 4000, lodgingPerNight: 200, dailyLocal: 150, currency: "BRL" },
    climate: { expectedC: 22, summary: "ameno", bestMonths: [9] },
    flightTimeHours: null,
    chosen: true
  });
  return trip.id;
}

beforeAll(() => runMigrations(url));
afterEach(async () => {
  await db.delete(providerCache).where(eq(providerCache.provider, "amadeus-hotel"));
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("HotelsService", () => {
  it("search devolve as ofertas e cacheia a 2a chamada", async () => {
    const provider = new FakeHotelProvider();
    const spy = vi.spyOn(provider, "search");
    const service = new HotelsService(db, provider, env, cache, trips);

    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);

    await expect(service.search(userId, tripId)).resolves.toMatchObject({
      offers: FAKE_HOTEL_OFFERS,
      stale: false,
      error: null
    });
    await service.search(userId, tripId);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("degrada para 'unavailable' e loga o evento quando o provider falha", async () => {
    const service = new HotelsService(db, new FakeHotelProvider({ fail: true }), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(service.search(userId, tripId)).resolves.toEqual({ offers: [], stale: false, fetchedAt: null, error: "unavailable" });
      expect(errSpy.mock.calls[0]![0]).toContain("hotel_search_failed");
    } finally {
      errSpy.mockRestore();
    }
  });

  it("grava o provider 'amadeus-hotel' no cache", async () => {
    const service = new HotelsService(db, new FakeHotelProvider(), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);
    await service.search(userId, tripId);
    const trip = await trips.get(userId, tripId);
    const key = cacheKey("amadeus-hotel", "hotel-offers", { ...buildHotelParams(trip) });
    const cached = await db.select().from(providerCache).where(eq(providerCache.key, key));
    expect(cached[0]?.provider).toBe("amadeus-hotel");
  });

  it("lança no_destination_chosen sem destino escolhido", async () => {
    const service = new HotelsService(db, new FakeHotelProvider(), env, cache, trips);
    const userId = await makeUser();
    const trip = await trips.create(userId, tripInput);
    try {
      await service.search(userId, trip.id);
      expect.unreachable("deveria lançar");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("no_destination_chosen");
    }
  });

  it("select persiste a oferta de hotel com rating nulo tratado", async () => {
    const service = new HotelsService(db, new FakeHotelProvider(), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);

    const selection = await service.select(userId, tripId, "htl-hostel");
    expect(selection.offer.id).toBe("htl-hostel");
    expect(selection.rating).toBeNull();
    expect(selection.pricePerNight).toBe(200);

    const rows = await db.select().from(hotelSelections).where(eq(hotelSelections.tripId, tripId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rating).toBeNull();
    expect(rows[0]!.name).toBe("Independente Hostel");
  });

  it("select com rating preenchido persiste o número como texto", async () => {
    const service = new HotelsService(db, new FakeHotelProvider(), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);
    const selection = await service.select(userId, tripId, "htl-marriott");
    expect(selection.rating).toBe(5);
  });

  it("select lança NotFoundError quando o offerId é desconhecido", async () => {
    const service = new HotelsService(db, new FakeHotelProvider(), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);
    await expect(service.select(userId, tripId, "xxx")).rejects.toMatchObject({
      code: "not_found",
      message: "oferta de hotel não encontrada"
    });
  });
});

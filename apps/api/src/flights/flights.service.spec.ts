import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  users,
  tripDestinations,
  flightSelections,
  providerCache
} from "@farol/db";
import { isDomainError, type TripInput } from "@farol/shared";
import { FlightsService } from "./flights.service";
import { ProviderCacheRepository, cacheKey } from "../providers/provider-cache.repository";
import { buildFlightParams } from "../providers/trip-search";
import { TripsService } from "../trips/trips.service";
import {
  FakeFlightProvider,
  FAKE_FLIGHT_OFFERS,
  FAKE_PRICE_SAMPLES,
  FAKE_ROUTE_DEALS
} from "../../test/support/fake-providers";

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
  dateStart: "2026-09-10",
  dateEnd: "2026-09-17"
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
  // só o cache deste provider — o spec de hotéis usa "amadeus-hotel", sem corrida
  await db.delete(providerCache).where(eq(providerCache.provider, "travelpayouts-flight"));
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("FlightsService", () => {
  it("search devolve as ofertas do provider e cacheia a 2a chamada", async () => {
    const provider = new FakeFlightProvider();
    const spy = vi.spyOn(provider, "search");
    const service = new FlightsService(db, provider, env, cache, trips);

    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);

    const first = await service.search(userId, tripId);
    expect(first).toEqual({ offers: FAKE_FLIGHT_OFFERS, stale: false, error: null });

    const second = await service.search(userId, tripId);
    expect(second.offers).toEqual(FAKE_FLIGHT_OFFERS);
    expect(spy).toHaveBeenCalledOnce();

    const trip = await trips.get(userId, tripId);
    const key = cacheKey("travelpayouts-flight", "search", { ...buildFlightParams(trip) });
    const cached = await db.select().from(providerCache).where(eq(providerCache.key, key));
    expect(cached[0]?.provider).toBe("travelpayouts-flight");
  });

  it("search degrada para { offers: [], error: 'unavailable' } e loga o evento quando o provider falha", async () => {
    const service = new FlightsService(db, new FakeFlightProvider({ fail: true }), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expect(service.search(userId, tripId)).resolves.toEqual({
        offers: [],
        stale: false,
        error: "unavailable"
      });
      expect(errSpy).toHaveBeenCalledOnce();
      expect(errSpy.mock.calls[0]![0]).toContain("flight_provider_failed");
    } finally {
      errSpy.mockRestore();
    }
  });

  it("search lança no_destination_chosen quando a viagem não tem destino escolhido", async () => {
    const service = new FlightsService(db, new FakeFlightProvider(), env, cache, trips);
    const userId = await makeUser();
    const trip = await trips.create(userId, tripInput); // sem trip_destinations

    try {
      await service.search(userId, trip.id);
      expect.unreachable("deveria lançar");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("no_destination_chosen");
    }
  });

  it("select persiste a oferta escolhida com deepLink e offer crua", async () => {
    const service = new FlightsService(db, new FakeFlightProvider(), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);

    const selection = await service.select(userId, tripId, "flt-direct");

    expect(selection.offer.id).toBe("flt-direct");
    expect(selection.deepLink).toBe("https://parceiro.example.com/voos?id=flt-direct");
    expect(selection.price).toBe(4600);

    const rows = await db.select().from(flightSelections).where(eq(flightSelections.tripId, tripId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.deepLink).toBe("https://parceiro.example.com/voos?id=flt-direct");
    expect(selection.returnAt).toBe(new Date("2026-09-20T10:45:00").toISOString());
    expect(rows[0]!.returnAt).toEqual(new Date("2026-09-20T10:45:00"));
  });

  it("select de uma oferta só-ida grava returnAt nulo", async () => {
    const service = new FlightsService(db, new FakeFlightProvider(), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);

    const selection = await service.select(userId, tripId, "flt-oneway");
    expect(selection.returnAt).toBeNull();

    const rows = await db.select().from(flightSelections).where(eq(flightSelections.tripId, tripId));
    expect(rows[0]!.returnAt).toBeNull();
  });

  it("select lança NotFoundError quando o offerId não está nas ofertas", async () => {
    const service = new FlightsService(db, new FakeFlightProvider(), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);

    await expect(service.select(userId, tripId, "nao-existe")).rejects.toMatchObject({
      code: "not_found",
      message: "oferta de voo não encontrada"
    });
  });

  it("nearbyOptions devolve as alternativas de aeroporto vizinho", async () => {
    const provider = new FakeFlightProvider();
    const spy = vi.spyOn(provider, "nearbyOptions");
    const service = new FlightsService(db, provider, env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);

    await expect(service.nearbyOptions(userId, tripId)).resolves.toEqual({
      offers: FAKE_FLIGHT_OFFERS,
      stale: false,
      error: null
    });
    await service.nearbyOptions(userId, tripId);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("priceCalendar e latestPrices devolvem amostras de preço da rota", async () => {
    const service = new FlightsService(db, new FakeFlightProvider(), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);

    await expect(service.priceCalendar(userId, tripId)).resolves.toEqual({
      offers: FAKE_PRICE_SAMPLES,
      stale: false,
      error: null
    });
    await expect(service.latestPrices(userId, tripId)).resolves.toEqual({
      offers: FAKE_PRICE_SAMPLES,
      stale: false,
      error: null
    });
  });

  it("monthlyPrices e cityDirections devolvem os melhores achados por chave", async () => {
    const service = new FlightsService(db, new FakeFlightProvider(), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);

    await expect(service.monthlyPrices(userId, tripId)).resolves.toEqual({
      offers: FAKE_ROUTE_DEALS,
      stale: false,
      error: null
    });
    await expect(service.cityDirections(userId, tripId)).resolves.toEqual({
      offers: FAKE_ROUTE_DEALS,
      stale: false,
      error: null
    });
  });

  it("cityDirections funciona sem destino escolhido — é o que ajuda a escolher", async () => {
    const provider = new FakeFlightProvider();
    const spy = vi.spyOn(provider, "cityDirections");
    const service = new FlightsService(db, provider, env, cache, trips);
    const userId = await makeUser();
    const trip = await trips.create(userId, tripInput); // sem trip_destinations

    await expect(service.cityDirections(userId, trip.id)).resolves.toMatchObject({
      offers: FAKE_ROUTE_DEALS,
      error: null
    });
    expect(spy).toHaveBeenCalledWith("GRU", 2);
  });

  it("cada recorte degrada sozinho quando o provider falha", async () => {
    const service = new FlightsService(db, new FakeFlightProvider({ fail: true }), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const degraded = { offers: [], stale: false, error: "unavailable" };
      await expect(service.nearbyOptions(userId, tripId)).resolves.toEqual(degraded);
      await expect(service.priceCalendar(userId, tripId)).resolves.toEqual(degraded);
      await expect(service.latestPrices(userId, tripId)).resolves.toEqual(degraded);
      await expect(service.monthlyPrices(userId, tripId)).resolves.toEqual(degraded);
      await expect(service.cityDirections(userId, tripId)).resolves.toEqual(degraded);
      expect(errSpy).toHaveBeenCalledTimes(5);
    } finally {
      errSpy.mockRestore();
    }
  });

  it("os recortes têm chaves de cache distintas — um não sobrepõe o outro", async () => {
    const service = new FlightsService(db, new FakeFlightProvider(), env, cache, trips);
    const userId = await makeUser();
    const tripId = await tripWithChosenDestination(userId);

    await service.search(userId, tripId);
    await service.nearbyOptions(userId, tripId);
    await service.priceCalendar(userId, tripId);
    await service.latestPrices(userId, tripId);
    await service.monthlyPrices(userId, tripId);
    await service.cityDirections(userId, tripId);

    const rows = await db
      .select()
      .from(providerCache)
      .where(eq(providerCache.provider, "travelpayouts-flight"));
    expect(new Set(rows.map((r) => r.key)).size).toBe(6);
  });
});

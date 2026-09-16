import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  users,
  trips,
  tripDestinations,
  itineraries,
  itineraryDays
} from "@farol/db";
import { isDomainError, type TripInput } from "@farol/shared";
import { ItineraryService } from "./itinerary.service";
import { ItineraryRepository } from "./itinerary.repository";
import { TripsService } from "../trips/trips.service";
import { JOB_NAMES } from "../jobs/job-names";
import type { JobQueue } from "../jobs/job-queue";
import type { PlacesService } from "../places/places.service";
import { CreditsService } from "../credits/credits.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const tripsService = new TripsService(db);
const repo = new ItineraryRepository(db);
const publish = vi.fn((): Promise<string> => Promise.resolve("job-1"));
const queue = { publish, work: vi.fn() } as unknown as JobQueue;
// swapRestaurant tem spec próprio (swap-restaurant.spec.ts); aqui o Places não é usado.
const places = { findFirst: () => Promise.resolve(null) } as unknown as PlacesService;
const credits = new CreditsService(db);
const service = new ItineraryService(repo, queue, tripsService, places, credits);

const userIds: string[] = [];

const tripInput: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 30000,
  currency: "BRL",
  durationDays: 3,
  targetMonth: "2026-09"
};

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  userIds.push(id);
  await db.insert(users).values({ id, email: `${id}@farol.test` });
  return id;
}

async function tripWithCandidate(userId: string, iata = "LIS"): Promise<string> {
  const trip = await tripsService.create(userId, tripInput);
  await db.insert(tripDestinations).values({
    id: crypto.randomUUID(),
    tripId: trip.id,
    city: "Lisboa",
    country: "Portugal",
    iata,
    score: "0.8",
    rationale: "Justificativa longa o suficiente para o schema aqui.",
    estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
    climate: { expectedC: 24, summary: "ameno", bestMonths: [9] },
    flightTimeHours: null,
    chosen: false
  });
  return trip.id;
}

beforeAll(async () => {
  await runMigrations(url);
});
afterEach(async () => {
  publish.mockClear();
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("ItineraryService.chooseDestination", () => {
  it("cria itinerary pending version 1 e publica o job", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId);

    const { itineraryId } = await service.chooseDestination(userId, tripId, "LIS");

    const rows = await db.select().from(itineraries).where(inArray(itineraries.id, [itineraryId]));
    expect(rows[0]!.status).toBe("pending");
    expect(rows[0]!.version).toBe(1);
    expect(publish).toHaveBeenCalledWith(JOB_NAMES.itineraryGenerate, { itineraryId });

    const [dest] = await db
      .select()
      .from(tripDestinations)
      .where(inArray(tripDestinations.tripId, [tripId]));
    expect(dest!.chosen).toBe(true);
    const [trip] = await db.select().from(trips).where(inArray(trips.id, [tripId]));
    expect(trip!.chosenDestinationId).toBe(dest!.id);
  });

  it("segunda escolha cria a version 2", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId);
    await service.chooseDestination(userId, tripId, "LIS");
    const { itineraryId } = await service.chooseDestination(userId, tripId, "LIS");
    const rows = await db.select().from(itineraries).where(inArray(itineraries.id, [itineraryId]));
    expect(rows[0]!.version).toBe(2);
  });

  it("rejeita iata que não está entre os candidatos", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId, "LIS");
    try {
      await service.chooseDestination(userId, tripId, "ZZZ");
      expect.unreachable("deveria ter lançado");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("not_found");
      expect((err as Error).message).toBe("destino não está entre os candidatos da viagem");
    }
    expect(publish).not.toHaveBeenCalled();
  });

  it("propaga ForbiddenError quando a viagem é de outro usuário", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const tripId = await tripWithCandidate(owner);
    await expect(service.chooseDestination(intruder, tripId, "LIS")).rejects.toMatchObject({
      code: "forbidden"
    });
  });
});

describe("ItineraryService.getLatest", () => {
  it("lança NotFoundError quando não há roteiro", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId);
    await expect(service.getLatest(userId, tripId)).rejects.toMatchObject({
      code: "not_found",
      message: "roteiro ainda não foi iniciado para esta viagem"
    });
  });

  it("devolve a última versão (pending, sem dias)", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId);
    const { itineraryId } = await service.chooseDestination(userId, tripId, "LIS");
    const latest = await service.getLatest(userId, tripId);
    expect(latest.id).toBe(itineraryId);
    expect(latest.status).toBe("pending");
    expect(latest.days).toEqual([]);
  });
});

describe("ItineraryService.regenerateDay", () => {
  it("lança NotFoundError quando não há roteiro", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId);
    await expect(service.regenerateDay(userId, tripId, 1)).rejects.toMatchObject({
      code: "not_found"
    });
  });

  it("lança itinerary_not_ready quando a versão ainda está pending", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId);
    await service.chooseDestination(userId, tripId, "LIS");
    await expect(service.regenerateDay(userId, tripId, 1)).rejects.toMatchObject({
      code: "itinerary_not_ready"
    });
  });

  it("lança NotFoundError quando o dia não existe e publica quando existe", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId);
    const { itineraryId } = await service.chooseDestination(userId, tripId, "LIS");
    // marca ready + insere 1 dia direto
    await db
      .update(itineraries)
      .set({ status: "ready", generatedAt: new Date() })
      .where(inArray(itineraries.id, [itineraryId]));
    await db.insert(itineraryDays).values({ id: crypto.randomUUID(), itineraryId, dayIndex: 1 });
    publish.mockClear();

    await expect(service.regenerateDay(userId, tripId, 5)).rejects.toMatchObject({
      code: "not_found"
    });
    expect(publish).not.toHaveBeenCalled();

    await service.regenerateDay(userId, tripId, 1);
    expect(publish).toHaveBeenCalledWith(JOB_NAMES.itineraryRegenerateDay, { itineraryId, dayIndex: 1 });
  });

  it("propaga ForbiddenError de outro usuário", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const tripId = await tripWithCandidate(owner);
    await expect(service.regenerateDay(intruder, tripId, 1)).rejects.toMatchObject({
      code: "forbidden"
    });
  });
});

describe("ItineraryService.requestEnrich", () => {
  it("enfileira places.enrich para a versão atual do roteiro", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId);
    const { itineraryId } = await service.chooseDestination(userId, tripId, "LIS");
    publish.mockClear();

    await service.requestEnrich(userId, tripId);

    expect(publish).toHaveBeenCalledWith(JOB_NAMES.placesEnrich, { itineraryId });
  });

  it("sem roteiro ainda responde not_found e não enfileira", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId);
    publish.mockClear();

    await expect(service.requestEnrich(userId, tripId)).rejects.toMatchObject({
      code: "not_found"
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("propaga ForbiddenError de outro usuário", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const tripId = await tripWithCandidate(owner);
    await expect(service.requestEnrich(intruder, tripId)).rejects.toMatchObject({
      code: "forbidden"
    });
  });
});

describe("chooseDestination — gate de crédito", () => {
  it("a 1ª viagem passa de graça; a 2ª sem saldo responde payment_required e não enfileira", async () => {
    const userId = await makeUser();
    const first = await tripWithCandidate(userId);
    await service.chooseDestination(userId, first, "LIS");

    const second = await tripWithCandidate(userId);
    publish.mockClear();
    await expect(service.chooseDestination(userId, second, "LIS")).rejects.toMatchObject({
      code: "payment_required"
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("com saldo, a 2ª viagem debita 1 crédito e enfileira", async () => {
    const userId = await makeUser();
    await db.update(users).set({ credits: 1 }).where(eq(users.id, userId));
    await service.chooseDestination(userId, await tripWithCandidate(userId), "LIS");

    publish.mockClear();
    await service.chooseDestination(userId, await tripWithCandidate(userId), "LIS");
    expect(publish).toHaveBeenCalledTimes(1);
    const [row] = await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId));
    expect(row!.credits).toBe(0);
  });

  it("trocar o destino da mesma viagem não cobra de novo", async () => {
    const userId = await makeUser();
    const tripId = await tripWithCandidate(userId);
    await service.chooseDestination(userId, tripId, "LIS");
    await expect(service.chooseDestination(userId, tripId, "LIS")).resolves.toHaveProperty(
      "itineraryId"
    );
  });
});


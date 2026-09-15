import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  users,
  itineraries,
  itineraryDays,
  itineraryItems
} from "@farol/db";
import type { Place, TripInput } from "@farol/shared";
import { ItineraryService } from "./itinerary.service";
import { ItineraryRepository } from "./itinerary.repository";
import { TripsService } from "../trips/trips.service";
import type { PlacesService } from "../places/places.service";
import type { JobQueue } from "../jobs/job-queue";
import { CreditsService } from "../credits/credits.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const repo = new ItineraryRepository(db);
const trips = new TripsService(db);
const queue = { publish: () => Promise.resolve(), work: () => Promise.resolve() } as unknown as JobQueue;
const userIds: string[] = [];

const tripInput: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 20000,
  currency: "BRL",
  durationDays: 2,
  targetMonth: "2026-09"
};

const TASCA: Place = {
  placeId: "place-tasca",
  name: "Tasca da Esquina",
  lat: 38.72,
  lng: -9.15,
  rating: 4.3,
  priceLevel: 2,
  types: ["restaurant"]
};

function serviceWith(findFirst: PlacesService["findFirst"]): ItineraryService {
  return new ItineraryService(
    repo,
    queue,
    trips,
    { findFirst } as unknown as PlacesService,
    new CreditsService(db)
  );
}

interface Seeded {
  userId: string;
  tripId: string;
  mealId: string;
  activityId: string;
  mealSemCoordId: string;
}

async function seed(): Promise<Seeded> {
  const userId = crypto.randomUUID();
  userIds.push(userId);
  await db.insert(users).values({ id: userId, email: `${userId}@farol.test` });
  const trip = await trips.create(userId, tripInput);

  const itineraryId = crypto.randomUUID();
  await db
    .insert(itineraries)
    .values({ id: itineraryId, tripId: trip.id, version: 1, status: "ready" });
  const dayId = crypto.randomUUID();
  await db.insert(itineraryDays).values({ id: dayId, itineraryId, dayIndex: 1 });

  const mealId = crypto.randomUUID();
  const activityId = crypto.randomUUID();
  const mealSemCoordId = crypto.randomUUID();
  await db.insert(itineraryItems).values([
    {
      id: mealId,
      dayId,
      slot: "evening",
      type: "meal",
      title: "Jantar genérico",
      placeId: "place-antigo",
      lat: "38.70",
      lng: "-9.10",
      rating: "3.9",
      sortOrder: 0
    },
    {
      id: activityId,
      dayId,
      slot: "morning",
      type: "activity",
      title: "Museu",
      sortOrder: 1
    },
    {
      id: mealSemCoordId,
      dayId,
      slot: "afternoon",
      type: "meal",
      title: "Almoço sem lugar",
      sortOrder: 2,
      needsReview: true
    }
  ]);

  return { userId, tripId: trip.id, mealId, activityId, mealSemCoordId };
}

beforeAll(() => runMigrations(url));
afterEach(async () => {
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("ItineraryService.swapRestaurant", () => {
  it("troca o restaurante do item e devolve o item atualizado", async () => {
    const { userId, tripId, mealId } = await seed();
    const service = serviceWith(() => Promise.resolve(TASCA));

    const updated = await service.swapRestaurant(userId, tripId, mealId);

    expect(updated).toMatchObject({
      id: mealId,
      title: "Tasca da Esquina",
      placeId: "place-tasca",
      lat: 38.72,
      lng: -9.15,
      rating: 4.3,
      type: "meal"
    });

    const [row] = await db.select().from(itineraryItems).where(eq(itineraryItems.id, mealId));
    expect(row!.title).toBe("Tasca da Esquina");
    expect(row!.needsReview).toBe(false);
  });

  it("busca perto das coordenadas do item, filtrando por restaurante", async () => {
    const { userId, tripId, mealId } = await seed();
    const findFirst = vi.fn<PlacesService["findFirst"]>(() => Promise.resolve(TASCA));
    await serviceWith(findFirst as unknown as PlacesService["findFirst"]).swapRestaurant(
      userId,
      tripId,
      mealId
    );

    expect(findFirst).toHaveBeenCalledWith("restaurante perto de 38.7,-9.1", {
      near: { lat: 38.7, lng: -9.1 },
      type: "restaurant"
    });
  });

  it("usa a cozinha pedida na busca", async () => {
    const { userId, tripId, mealId } = await seed();
    const findFirst = vi.fn<PlacesService["findFirst"]>(() => Promise.resolve(TASCA));
    await serviceWith(findFirst as unknown as PlacesService["findFirst"]).swapRestaurant(
      userId,
      tripId,
      mealId,
      { cuisine: "japonesa" }
    );

    expect(findFirst.mock.calls[0]![0]).toBe("japonesa perto de 38.7,-9.1");
  });

  it("item sem coordenadas busca só pela cozinha, sem near", async () => {
    const { userId, tripId, mealSemCoordId } = await seed();
    const findFirst = vi.fn<PlacesService["findFirst"]>(() => Promise.resolve(TASCA));
    await serviceWith(findFirst as unknown as PlacesService["findFirst"]).swapRestaurant(
      userId,
      tripId,
      mealSemCoordId,
      { cuisine: "italiana" }
    );

    expect(findFirst).toHaveBeenCalledWith("italiana", { type: "restaurant" });
  });

  it("rating nulo do novo lugar é gravado como nulo", async () => {
    const { userId, tripId, mealId } = await seed();
    const service = serviceWith(() => Promise.resolve({ ...TASCA, rating: null }));
    await expect(service.swapRestaurant(userId, tripId, mealId)).resolves.toMatchObject({
      rating: null
    });
  });

  it("item que não é refeição é 422 (item_not_swappable)", async () => {
    const { userId, tripId, activityId } = await seed();
    const service = serviceWith(() => Promise.resolve(TASCA));
    await expect(service.swapRestaurant(userId, tripId, activityId)).rejects.toMatchObject({
      code: "item_not_swappable"
    });
  });

  it("item inexistente é not_found", async () => {
    const { userId, tripId } = await seed();
    const service = serviceWith(() => Promise.resolve(TASCA));
    await expect(
      service.swapRestaurant(userId, tripId, crypto.randomUUID())
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("item de outra viagem não é alcançável", async () => {
    const first = await seed();
    const second = await seed();
    const service = serviceWith(() => Promise.resolve(TASCA));
    await expect(
      service.swapRestaurant(second.userId, second.tripId, first.mealId)
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("Places sem resultado é not_found", async () => {
    const { userId, tripId, mealId } = await seed();
    const service = serviceWith(() => Promise.resolve(null));
    await expect(service.swapRestaurant(userId, tripId, mealId)).rejects.toMatchObject({
      code: "not_found",
      message: "nenhum restaurante encontrado para essa troca"
    });
  });

  it("viagem de outro usuário não é alcançável", async () => {
    const { tripId, mealId } = await seed();
    const other = await seed();
    const service = serviceWith(() => Promise.resolve(TASCA));
    await expect(service.swapRestaurant(other.userId, tripId, mealId)).rejects.toBeTruthy();
  });
});

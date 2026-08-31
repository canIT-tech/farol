import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  users,
  tripDestinations,
  itineraries,
  itineraryDays,
  itineraryItems
} from "@farol/db";
import type { Place, TripInput } from "@farol/shared";
import { PlacesEnrichHandler } from "./places-enrich.handler";
import { ItineraryRepository } from "./itinerary.repository";
import { TripsService } from "../trips/trips.service";
import type { PlacesService } from "../places/places.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const repo = new ItineraryRepository(db);
const trips = new TripsService(db);
const userIds: string[] = [];

const tripInput: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 20000,
  currency: "BRL",
  durationDays: 2,
  targetMonth: "2026-09"
};

const MUSEU: Place = {
  placeId: "place-museu",
  name: "Museu Nacional do Azulejo",
  lat: 38.7247,
  lng: -9.1146,
  rating: 4.6,
  priceLevel: 1,
  types: ["museum"]
};

function handlerWith(findFirst: PlacesService["findFirst"]): PlacesEnrichHandler {
  return new PlacesEnrichHandler(repo, db, { findFirst } as unknown as PlacesService);
}

interface Seeded {
  itineraryId: string;
  pendenteId: string;
  jaResolvidoId: string;
}

async function seed(options: { chosen?: boolean } = {}): Promise<Seeded> {
  const userId = crypto.randomUUID();
  userIds.push(userId);
  await db.insert(users).values({ id: userId, email: `${userId}@farol.test` });
  const trip = await trips.create(userId, tripInput);
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
    chosen: options.chosen ?? true
  });

  const itineraryId = crypto.randomUUID();
  await db
    .insert(itineraries)
    .values({ id: itineraryId, tripId: trip.id, version: 1, status: "ready" });
  const dayId = crypto.randomUUID();
  await db.insert(itineraryDays).values({ id: dayId, itineraryId, dayIndex: 1 });

  const pendenteId = crypto.randomUUID();
  const jaResolvidoId = crypto.randomUUID();
  await db.insert(itineraryItems).values([
    {
      id: pendenteId,
      dayId,
      slot: "morning",
      type: "activity",
      title: "Museu do Azulejo",
      sortOrder: 0,
      needsReview: true
    },
    {
      id: jaResolvidoId,
      dayId,
      slot: "evening",
      type: "meal",
      title: "Jantar já resolvido",
      placeId: "place-antigo",
      lat: "38.70",
      lng: "-9.10",
      sortOrder: 1,
      needsReview: false
    }
  ]);

  return { itineraryId, pendenteId, jaResolvidoId };
}

beforeAll(() => runMigrations(url));
afterEach(async () => {
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("PlacesEnrichHandler.handle", () => {
  it("resolve o item needsReview e não rebusca o que já tem lugar", async () => {
    const { itineraryId, pendenteId, jaResolvidoId } = await seed();
    const findFirst = vi.fn<PlacesService["findFirst"]>(() => Promise.resolve(MUSEU));

    await handlerWith(findFirst as unknown as PlacesService["findFirst"]).handle({ itineraryId });

    const [pendente] = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.id, pendenteId));
    expect(pendente!.placeId).toBe("place-museu");
    expect(pendente!.needsReview).toBe(false);

    const [resolvido] = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.id, jaResolvidoId));
    expect(resolvido!.placeId).toBe("place-antigo");
    expect(resolvido!.title).toBe("Jantar já resolvido");

    expect(findFirst).toHaveBeenCalledWith("Museu do Azulejo Lisboa, Portugal");
  });

  it("item que segue sem match continua needsReview", async () => {
    const { itineraryId, pendenteId } = await seed();

    await handlerWith(() => Promise.resolve(null)).handle({ itineraryId });

    const [pendente] = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.id, pendenteId));
    expect(pendente!.needsReview).toBe(true);
    expect(pendente!.placeId).toBeNull();
  });

  it("lança quando a viagem não tem destino escolhido", async () => {
    const { itineraryId } = await seed({ chosen: false });
    await expect(
      handlerWith(() => Promise.resolve(MUSEU)).handle({ itineraryId })
    ).rejects.toThrow(/não tem destino escolhido/);
  });

  it("lança quando o itinerary não existe", async () => {
    await expect(
      handlerWith(() => Promise.resolve(MUSEU)).handle({ itineraryId: crypto.randomUUID() })
    ).rejects.toThrow(/não tem destino escolhido/);
  });
});

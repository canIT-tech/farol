import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDbClient, runMigrations, users, itineraries, itineraryDays, itineraryItems } from "@farol/db";
import type { Place } from "@farol/shared";
import { enrichItinerary } from "./enrich-itinerary";
import type { PlacesService } from "../places/places.service";
import { TripsService } from "../trips/trips.service";
import type { TripInput } from "@farol/shared";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
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
const RESTAURANTE: Place = {
  placeId: "place-tasca",
  name: "Tasca da Esquina",
  lat: 38.72,
  lng: -9.15,
  rating: 4.3,
  priceLevel: 2,
  types: ["restaurant"]
};

// PlacesService fake: uma função por chamada, tipada como o serviço real.
function fakePlaces(findFirst: PlacesService["findFirst"]): PlacesService {
  return { findFirst } as unknown as PlacesService;
}
const alwaysMuseu = () => Promise.resolve(MUSEU);
const alwaysNull = () => Promise.resolve(null);

interface ItemSeed {
  slot: string;
  type: string;
  title: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

async function seedItinerary(days: ItemSeed[][]): Promise<string> {
  const userId = crypto.randomUUID();
  userIds.push(userId);
  await db.insert(users).values({ id: userId, email: `${userId}@farol.test` });
  const trip = await trips.create(userId, tripInput);
  const itineraryId = crypto.randomUUID();
  await db.insert(itineraries).values({ id: itineraryId, tripId: trip.id, version: 1, status: "pending" });

  for (const [index, items] of days.entries()) {
    const dayId = crypto.randomUUID();
    await db.insert(itineraryDays).values({ id: dayId, itineraryId, dayIndex: index + 1 });
    if (items.length > 0) {
      await db.insert(itineraryItems).values(
        items.map((item, order) => ({
          id: crypto.randomUUID(),
          dayId,
          slot: item.slot,
          type: item.type,
          title: item.title,
          placeId: item.placeId ?? null,
          lat: item.lat === undefined ? null : String(item.lat),
          lng: item.lng === undefined ? null : String(item.lng),
          sortOrder: order
        }))
      );
    }
  }
  return itineraryId;
}

async function itemsOf(itineraryId: string) {
  return db
    .select({ item: itineraryItems, dayIndex: itineraryDays.dayIndex })
    .from(itineraryItems)
    .innerJoin(itineraryDays, eq(itineraryItems.dayId, itineraryDays.id))
    .where(eq(itineraryDays.itineraryId, itineraryId))
    .orderBy(itineraryDays.dayIndex, itineraryItems.sortOrder);
}

beforeAll(() => runMigrations(url));
afterEach(async () => {
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("enrichItinerary — itens", () => {
  it("preenche placeId/lat/lng/rating e zera needsReview quando acha o lugar", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Museu do Azulejo" }]
    ]);

    await enrichItinerary({ db, places: fakePlaces(alwaysMuseu) }, itineraryId, "Lisboa, Portugal");

    const item = (await itemsOf(itineraryId))[0]!.item;
    expect(item.placeId).toBe("place-museu");
    expect(Number(item.lat)).toBeCloseTo(38.7247);
    expect(Number(item.lng)).toBeCloseTo(-9.1146);
    expect(Number(item.rating)).toBeCloseTo(4.6);
    expect(item.needsReview).toBe(false);
  });

  it("busca pelo título mais a dica da cidade", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Museu do Azulejo" }]
    ]);
    const findFirst = vi.fn(alwaysMuseu);

    await enrichItinerary({ db, places: fakePlaces(findFirst) }, itineraryId, "Lisboa, Portugal");

    expect(findFirst).toHaveBeenCalledWith("Museu do Azulejo Lisboa, Portugal");
  });

  it("marca needsReview quando não acha o lugar", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Lugar inexistente" }]
    ]);

    await enrichItinerary({ db, places: fakePlaces(alwaysNull) }, itineraryId, "Lisboa, Portugal");

    const item = (await itemsOf(itineraryId))[0]!.item;
    expect(item.placeId).toBeNull();
    expect(item.needsReview).toBe(true);
  });

  it("rating nulo do lugar é gravado como nulo", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Miradouro" }]
    ]);
    const semRating = () => Promise.resolve({ ...MUSEU, rating: null });

    await enrichItinerary({ db, places: fakePlaces(semRating) }, itineraryId, "Lisboa, Portugal");

    const item = (await itemsOf(itineraryId))[0]!.item;
    expect(item.rating).toBeNull();
    expect(item.needsReview).toBe(false);
  });

  it("não toca em itens transfer/free nem em item que já tem placeId", async () => {
    const itineraryId = await seedItinerary([
      [
        { slot: "morning", type: "transfer", title: "Aeroporto → hotel" },
        { slot: "afternoon", type: "free", title: "Tempo livre" },
        { slot: "evening", type: "meal", title: "Jantar", placeId: "ja-tinha", lat: 38.7, lng: -9.1 }
      ]
    ]);
    const findFirst = vi.fn(alwaysMuseu);

    await enrichItinerary({ db, places: fakePlaces(findFirst) }, itineraryId, "Lisboa, Portugal");

    expect(findFirst).not.toHaveBeenCalled();
    const rows = await itemsOf(itineraryId);
    expect(rows.map((r) => r.item.placeId)).toEqual([null, null, "ja-tinha"]);
  });

  it("busca que lança é tratada como 'não achei' e marca needsReview", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Museu do Azulejo" }]
    ]);
    const explode = () => Promise.reject(new Error("places fora do ar"));

    await expect(
      enrichItinerary({ db, places: fakePlaces(explode) }, itineraryId, "Lisboa, Portugal")
    ).resolves.toBeUndefined();

    const item = (await itemsOf(itineraryId))[0]!.item;
    expect(item.needsReview).toBe(true);
    expect(item.placeId).toBeNull();
  });

  it("itinerário sem dias não faz nada", async () => {
    const itineraryId = await seedItinerary([]);
    const findFirst = vi.fn(alwaysMuseu);
    await enrichItinerary({ db, places: fakePlaces(findFirst) }, itineraryId, "Lisboa, Portugal");
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("dia sem nenhum item não quebra", async () => {
    const itineraryId = await seedItinerary([[]]);
    await expect(
      enrichItinerary({ db, places: fakePlaces(alwaysMuseu) }, itineraryId, "Lisboa, Portugal")
    ).resolves.toBeUndefined();
  });
});

describe("enrichItinerary — refeição faltando", () => {
  it("insere um restaurante perto do centroide quando o dia não tem refeição", async () => {
    const itineraryId = await seedItinerary([
      [
        { slot: "morning", type: "activity", title: "Museu", placeId: "p1", lat: 38.72, lng: -9.14 },
        { slot: "afternoon", type: "activity", title: "Passeio", placeId: "p2", lat: 38.74, lng: -9.16 }
      ]
    ]);
    const findFirst = vi.fn(() => Promise.resolve(RESTAURANTE));

    await enrichItinerary({ db, places: fakePlaces(findFirst) }, itineraryId, "Lisboa, Portugal");

    expect(findFirst).toHaveBeenCalledWith("restaurante", {
      near: { lat: 38.73, lng: -9.15 },
      type: "restaurant",
      minPrice: 1,
      maxPrice: 3
    });

    const rows = await itemsOf(itineraryId);
    expect(rows).toHaveLength(3);
    const meal = rows.find((r) => r.item.type === "meal")!.item;
    expect(meal.title).toBe("Tasca da Esquina");
    expect(meal.slot).toBe("evening"); // afternoon já está ocupado
    expect(meal.placeId).toBe("place-tasca");
    expect(meal.sortOrder).toBe(2);
    expect(meal.needsReview).toBe(false);
  });

  it("usa o primeiro slot livre entre afternoon e evening", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Museu", placeId: "p1", lat: 38.72, lng: -9.14 }]
    ]);

    await enrichItinerary(
      { db, places: fakePlaces(() => Promise.resolve(RESTAURANTE)) },
      itineraryId,
      "Lisboa, Portugal"
    );

    const meal = (await itemsOf(itineraryId)).find((r) => r.item.type === "meal")!.item;
    expect(meal.slot).toBe("afternoon");
  });

  it("cai em evening quando afternoon e evening já têm item (sem refeição)", async () => {
    const itineraryId = await seedItinerary([
      [
        { slot: "afternoon", type: "activity", title: "A", placeId: "p1", lat: 38.72, lng: -9.14 },
        { slot: "evening", type: "activity", title: "B", placeId: "p2", lat: 38.74, lng: -9.16 }
      ]
    ]);

    await enrichItinerary(
      { db, places: fakePlaces(() => Promise.resolve(RESTAURANTE)) },
      itineraryId,
      "Lisboa, Portugal"
    );

    const meal = (await itemsOf(itineraryId)).find((r) => r.item.type === "meal")!.item;
    expect(meal.slot).toBe("evening");
  });

  it("dia sem nenhuma coordenada não ganha refeição", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "transfer", title: "Aeroporto → hotel" }]
    ]);

    await enrichItinerary({ db, places: fakePlaces(alwaysNull) }, itineraryId, "Lisboa, Portugal");

    const rows = await itemsOf(itineraryId);
    expect(rows).toHaveLength(1);
  });

  it("dia que já tem refeição no afternoon/evening não ganha outra", async () => {
    const itineraryId = await seedItinerary([
      [
        { slot: "morning", type: "activity", title: "Museu", placeId: "p1", lat: 38.72, lng: -9.14 },
        { slot: "evening", type: "meal", title: "Jantar", placeId: "p2", lat: 38.74, lng: -9.16 }
      ]
    ]);
    const findFirst = vi.fn(() => Promise.resolve(RESTAURANTE));

    await enrichItinerary({ db, places: fakePlaces(findFirst) }, itineraryId, "Lisboa, Portugal");

    expect(findFirst).not.toHaveBeenCalled();
    expect(await itemsOf(itineraryId)).toHaveLength(2);
  });

  it("refeição só no morning ainda conta como dia sem almoço/jantar", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "meal", title: "Café", placeId: "p1", lat: 38.72, lng: -9.14 }]
    ]);

    await enrichItinerary(
      { db, places: fakePlaces(() => Promise.resolve(RESTAURANTE)) },
      itineraryId,
      "Lisboa, Portugal"
    );

    expect(await itemsOf(itineraryId)).toHaveLength(2);
  });

  it("busca de restaurante que lança não insere nada", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Museu", placeId: "p1", lat: 38.72, lng: -9.14 }]
    ]);
    const explode = () => Promise.reject(new Error("places fora do ar"));

    await enrichItinerary({ db, places: fakePlaces(explode) }, itineraryId, "Lisboa, Portugal");

    expect(await itemsOf(itineraryId)).toHaveLength(1);
  });

  it("Places sem restaurante não insere nada", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Museu", placeId: "p1", lat: 38.72, lng: -9.14 }]
    ]);

    await enrichItinerary({ db, places: fakePlaces(alwaysNull) }, itineraryId, "Lisboa, Portugal");

    expect(await itemsOf(itineraryId)).toHaveLength(1);
  });

  it("usa as coordenadas recém-enriquecidas para o centroide", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Museu do Azulejo" }]
    ]);
    const findFirst = vi.fn((query: string) =>
      Promise.resolve(query === "restaurante" ? RESTAURANTE : MUSEU)
    ) as unknown as PlacesService["findFirst"];

    await enrichItinerary({ db, places: fakePlaces(findFirst) }, itineraryId, "Lisboa, Portugal");

    expect(findFirst).toHaveBeenCalledWith("restaurante", {
      near: { lat: MUSEU.lat, lng: MUSEU.lng },
      type: "restaurant",
      minPrice: 1,
      maxPrice: 3
    });
  });
});

describe("enrichItinerary — idempotência", () => {
  it("rodar duas vezes não muda nada nem rebusca o que já tem lugar", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Museu do Azulejo" }]
    ]);
    const findFirst = vi.fn((query: string) =>
      Promise.resolve(query === "restaurante" ? RESTAURANTE : MUSEU)
    ) as unknown as PlacesService["findFirst"];

    await enrichItinerary({ db, places: fakePlaces(findFirst) }, itineraryId, "Lisboa, Portugal");
    const first = await itemsOf(itineraryId);
    const callsAfterFirst = (findFirst as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;

    await enrichItinerary({ db, places: fakePlaces(findFirst) }, itineraryId, "Lisboa, Portugal");
    const second = await itemsOf(itineraryId);

    expect(second).toEqual(first);
    expect((findFirst as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(
      callsAfterFirst
    );
  });

  it("item que ficou needsReview é tentado de novo na rodada seguinte", async () => {
    const itineraryId = await seedItinerary([
      [{ slot: "morning", type: "activity", title: "Museu do Azulejo" }]
    ]);

    await enrichItinerary({ db, places: fakePlaces(alwaysNull) }, itineraryId, "Lisboa, Portugal");
    expect((await itemsOf(itineraryId))[0]!.item.needsReview).toBe(true);

    await enrichItinerary({ db, places: fakePlaces(alwaysMuseu) }, itineraryId, "Lisboa, Portugal");
    const item = (await itemsOf(itineraryId))[0]!.item;
    expect(item.needsReview).toBe(false);
    expect(item.placeId).toBe("place-museu");
  });
});

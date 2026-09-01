// Cobre os métodos que o Passo 7 adicionou para as tools do chat e que
// nunca tiveram teste: TripsService.updateDates/updateBudget,
// ProfileService.addInterest/removeInterest, ItineraryService.removeItem/pinItem
// e ItineraryRepository.removeItem/setPinned.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  users,
  trips,
  itineraries,
  itineraryDays,
  itineraryItems
} from "@farol/db";
import type { TripInput } from "@farol/shared";
import { TripsService } from "../trips/trips.service";
import { ProfileService } from "../profile/profile.service";
import { ItineraryService } from "../itinerary/itinerary.service";
import { ItineraryRepository } from "../itinerary/itinerary.repository";
import type { PlacesService } from "../places/places.service";
import type { JobQueue } from "../jobs/job-queue";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const tripsService = new TripsService(db);
const profileService = new ProfileService(db);
const repo = new ItineraryRepository(db);
const queue = {
  publish: () => Promise.resolve(),
  work: () => Promise.resolve()
} as unknown as JobQueue;
const places = { findFirst: () => Promise.resolve(null) } as unknown as PlacesService;
const itineraryService = new ItineraryService(repo, queue, tripsService, places);

const userIds: string[] = [];

const tripInput: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 20000,
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

async function tripWithItem(
  userId: string
): Promise<{ tripId: string; itemId: string; dayId: string }> {
  const trip = await tripsService.create(userId, tripInput);
  const itineraryId = crypto.randomUUID();
  await db
    .insert(itineraries)
    .values({ id: itineraryId, tripId: trip.id, version: 1, status: "ready" });
  const dayId = crypto.randomUUID();
  await db.insert(itineraryDays).values({ id: dayId, itineraryId, dayIndex: 1 });
  const itemId = crypto.randomUUID();
  await db.insert(itineraryItems).values({
    id: itemId,
    dayId,
    slot: "morning",
    type: "activity",
    title: "Museu",
    sortOrder: 0
  });
  return { tripId: trip.id, itemId, dayId };
}

beforeAll(() => runMigrations(url));
afterEach(async () => {
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("TripsService.updateDates", () => {
  it("grava datas explícitas", async () => {
    const userId = await makeUser();
    const trip = await tripsService.create(userId, tripInput);

    await tripsService.updateDates(userId, trip.id, {
      dateStart: "2026-09-10",
      dateEnd: "2026-09-17"
    });

    const [row] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(row!.dateStart).toBe("2026-09-10");
    expect(row!.dateEnd).toBe("2026-09-17");
  });

  it("grava durationDays", async () => {
    const userId = await makeUser();
    const trip = await tripsService.create(userId, tripInput);

    await tripsService.updateDates(userId, trip.id, { durationDays: 9 });

    const [row] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(row!.durationDays).toBe(9);
  });

  it("campo ausente não sobrescreve o que já estava", async () => {
    const userId = await makeUser();
    const trip = await tripsService.create(userId, tripInput);
    await tripsService.updateDates(userId, trip.id, { durationDays: 5 });

    await tripsService.updateDates(userId, trip.id, { dateStart: "2026-10-01" });

    const [row] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(row!.durationDays).toBe(5);
    expect(row!.dateStart).toBe("2026-10-01");
  });

  it("aceita null para limpar o campo", async () => {
    const userId = await makeUser();
    const trip = await tripsService.create(userId, tripInput);

    await tripsService.updateDates(userId, trip.id, { durationDays: null });

    const [row] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(row!.durationDays).toBeNull();
  });

  it("viagem de outro usuário é rejeitada", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const trip = await tripsService.create(owner, tripInput);

    await expect(
      tripsService.updateDates(intruder, trip.id, { durationDays: 4 })
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("TripsService.updateBudget", () => {
  it("grava o orçamento como texto numérico", async () => {
    const userId = await makeUser();
    const trip = await tripsService.create(userId, tripInput);

    await tripsService.updateBudget(userId, trip.id, 12345);

    const [row] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(Number(row!.budgetTotal)).toBe(12345);
  });

  it("viagem de outro usuário é rejeitada", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const trip = await tripsService.create(owner, tripInput);

    await expect(tripsService.updateBudget(intruder, trip.id, 1)).rejects.toMatchObject({
      code: "forbidden"
    });
  });
});

describe("ProfileService.addInterest / removeInterest", () => {
  // tasteProfileInputSchema exige no mínimo 3 interesses.
  const profileInput = {
    interests: ["praia", "gastronomia", "cultura"],
    pace: "moderado" as const,
    partyType: "casal" as const,
    budgetBand: "medio" as const,
    constraints: {}
  };

  it("acrescenta uma tag nova", async () => {
    const userId = await makeUser();
    await profileService.upsert(userId, profileInput);

    const updated = await profileService.addInterest(userId, "vinhos");

    expect(updated.interests).toEqual(["praia", "gastronomia", "cultura", "vinhos"]);
  });

  it("tag repetida não duplica e devolve o perfil como está", async () => {
    const userId = await makeUser();
    await profileService.upsert(userId, profileInput);

    const updated = await profileService.addInterest(userId, "praia");

    expect(updated.interests).toEqual(["praia", "gastronomia", "cultura"]);
  });

  it("remove a tag pedida", async () => {
    const userId = await makeUser();
    await profileService.upsert(userId, {
      ...profileInput,
      interests: ["praia", "montanha", "cultura", "vinhos"]
    });

    const updated = await profileService.removeInterest(userId, "praia");

    expect(updated.interests).toEqual(["montanha", "cultura", "vinhos"]);
  });

  it("remover abaixo de 3 interesses é rejeitado pelo schema", async () => {
    const userId = await makeUser();
    await profileService.upsert(userId, profileInput);

    // Consequência do min(3) do tasteProfileInputSchema: a tool remove_interest
    // não consegue esvaziar o perfil. Comportamento atual, documentado aqui.
    await expect(profileService.removeInterest(userId, "praia")).rejects.toThrow();
  });

  it("remover tag que não existe deixa a lista igual", async () => {
    const userId = await makeUser();
    await profileService.upsert(userId, profileInput);

    const updated = await profileService.removeInterest(userId, "inexistente");

    expect(updated.interests).toEqual(["praia", "gastronomia", "cultura"]);
  });
});

describe("ItineraryService.removeItem", () => {
  it("apaga o item do roteiro", async () => {
    const userId = await makeUser();
    const { tripId, itemId } = await tripWithItem(userId);

    await itineraryService.removeItem(userId, tripId, itemId);

    const rows = await db.select().from(itineraryItems).where(eq(itineraryItems.id, itemId));
    expect(rows).toHaveLength(0);
  });

  it("item inexistente é not_found", async () => {
    const userId = await makeUser();
    const { tripId } = await tripWithItem(userId);

    await expect(
      itineraryService.removeItem(userId, tripId, crypto.randomUUID())
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("item de outra viagem é not_found", async () => {
    const first = await makeUser();
    const second = await makeUser();
    const a = await tripWithItem(first);
    const b = await tripWithItem(second);

    await expect(
      itineraryService.removeItem(second, b.tripId, a.itemId)
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("ItineraryService.pinItem", () => {
  it("fixa e desfixa o item", async () => {
    const userId = await makeUser();
    const { tripId, itemId } = await tripWithItem(userId);

    await itineraryService.pinItem(userId, tripId, itemId, true);
    let [row] = await db.select().from(itineraryItems).where(eq(itineraryItems.id, itemId));
    expect(row!.pinned).toBe(true);

    await itineraryService.pinItem(userId, tripId, itemId, false);
    [row] = await db.select().from(itineraryItems).where(eq(itineraryItems.id, itemId));
    expect(row!.pinned).toBe(false);
  });

  it("item inexistente é not_found", async () => {
    const userId = await makeUser();
    const { tripId } = await tripWithItem(userId);

    await expect(
      itineraryService.pinItem(userId, tripId, crypto.randomUUID(), true)
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("ItineraryRepository.removeItem / setPinned", () => {
  it("removeItem lança quando o item não pertence à viagem", async () => {
    const userId = await makeUser();
    const { tripId } = await tripWithItem(userId);

    await expect(repo.removeItem(tripId, crypto.randomUUID())).rejects.toThrow(
      /não encontrado/
    );
  });

  it("setPinned lança quando o item não pertence à viagem", async () => {
    const userId = await makeUser();
    const { tripId } = await tripWithItem(userId);

    await expect(repo.setPinned(tripId, crypto.randomUUID(), true)).rejects.toThrow(
      /não encontrado/
    );
  });
});

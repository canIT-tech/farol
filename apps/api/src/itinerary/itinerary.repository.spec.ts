import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
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
import type { BuildItineraryOutput, TripInput } from "@farol/shared";
import { ItineraryRepository } from "./itinerary.repository";
import { TripsService } from "../trips/trips.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const repo = new ItineraryRepository(db);
const trips = new TripsService(db);
const userIds: string[] = [];

const tripInput: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 30000,
  currency: "BRL",
  durationDays: 2,
  targetMonth: "2026-09"
};

async function makeUser(withProfile = true): Promise<string> {
  const id = crypto.randomUUID();
  userIds.push(id);
  await db.insert(users).values({ id, email: `${id}@farol.test` });
  if (withProfile) {
    await db.insert(tasteProfiles).values({
      id: crypto.randomUUID(),
      userId: id,
      interests: ["praia", "gastronomia", "cultura e museus"],
      pace: "intenso",
      partyType: "casal",
      budgetBand: "medio"
    });
  }
  return id;
}

async function chosenTrip(userId: string): Promise<string> {
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
    chosen: true
  });
  return trip.id;
}

const richOutput: BuildItineraryOutput = {
  days: [
    {
      dayIndex: 1,
      slots: [
        {
          slot: "morning",
          type: "activity",
          title: "Passeio pelo centro histórico",
          description: "caminhada guiada",
          durationMin: 120,
          estCost: 0
        },
        { slot: "evening", type: "meal", title: "Jantar típico" }
      ]
    }
  ]
};

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

describe("ItineraryRepository", () => {
  it("maxVersion é 0 quando a viagem não tem itinerary", async () => {
    const userId = await makeUser();
    const tripId = await chosenTrip(userId);
    expect(await repo.maxVersion(tripId)).toBe(0);
  });

  it("replaceDays grava descrição/duração/custo e latest devolve number nesses campos", async () => {
    const userId = await makeUser();
    const tripId = await chosenTrip(userId);
    const itineraryId = await repo.createPending(tripId, 1);
    await repo.replaceDays(itineraryId, richOutput.days, []);
    await repo.markReady(itineraryId);

    // simula enrich de Places numa linha para exercitar o mapeamento numérico
    const [row] = await db
      .select()
      .from(itineraryItems)
      .innerJoin(itineraryDays, eq(itineraryItems.dayId, itineraryDays.id))
      .where(eq(itineraryDays.itineraryId, itineraryId))
      .limit(1);
    await db
      .update(itineraryItems)
      .set({ lat: "38.7", lng: "-9.14", rating: "4.5" })
      .where(eq(itineraryItems.id, row!.itinerary_items.id));

    const latest = await repo.latest(tripId);
    expect(latest!.status).toBe("ready");
    expect(latest!.generatedAt).not.toBeNull();
    const first = latest!.days[0]!.items[0]!;
    expect(first.description).toBe("caminhada guiada");
    expect(first.durationMin).toBe(120);
    expect(first.estCost).toBe(0);
    expect(first.lat).toBe(38.7);
    expect(first.lng).toBe(-9.14);
    expect(first.rating).toBe(4.5);
    const second = latest!.days[0]!.items[1]!;
    expect(second.description).toBeNull();
    expect(second.durationMin).toBeNull();
    expect(second.estCost).toBeNull();
    expect(second.lat).toBeNull();
  });

  it("latest é null quando a viagem não tem itinerary", async () => {
    const userId = await makeUser();
    const tripId = await chosenTrip(userId);
    expect(await repo.latest(tripId)).toBeNull();
  });

  it("replaceDays aceita um dia sem slots", async () => {
    const userId = await makeUser();
    const tripId = await chosenTrip(userId);
    const itineraryId = await repo.createPending(tripId, 1);
    await repo.replaceDays(itineraryId, [{ dayIndex: 1, slots: [] }], []);
    await repo.markReady(itineraryId);
    const latest = await repo.latest(tripId);
    expect(latest!.days).toHaveLength(1);
    expect(latest!.days[0]!.items).toEqual([]);
  });

  it("markFailed grava status failed e a mensagem", async () => {
    const userId = await makeUser();
    const tripId = await chosenTrip(userId);
    const itineraryId = await repo.createPending(tripId, 1);
    await repo.markFailed(itineraryId, "erro X");
    const [it] = await db.select().from(itineraries).where(eq(itineraries.id, itineraryId));
    expect(it!.status).toBe("failed");
    expect(it!.error).toBe("erro X");
  });

  it("generationContext monta destino/nights/pace/pinned", async () => {
    const userId = await makeUser();
    const tripId = await chosenTrip(userId);
    const ctx = await repo.generationContext(tripId, 1);
    expect(ctx.destination).toEqual({ city: "Lisboa", country: "Portugal" });
    expect(ctx.nights).toBe(2);
    expect(ctx.pace).toBe("intenso");
    expect(ctx.party).toEqual({ adults: 2, children: 0 });
    expect(ctx.pinned).toEqual([]);
  });

  it("generationContext lança quando a viagem não existe", async () => {
    await expect(repo.generationContext(crypto.randomUUID(), 1)).rejects.toThrow(/não existe/);
  });

  it("generationContext lança quando não há destino escolhido", async () => {
    const userId = await makeUser();
    const trip = await trips.create(userId, tripInput);
    await expect(repo.generationContext(trip.id, 1)).rejects.toThrow(/destino escolhido/);
  });

  it("generationContext lança quando o usuário não tem perfil de gosto", async () => {
    const userId = await makeUser(false);
    const tripId = await chosenTrip(userId);
    await expect(repo.generationContext(tripId, 1)).rejects.toThrow(/perfil de gosto/);
  });

  it("replaceDayItems grava estCost/descrição de um dia e respeita os pinned; aceita lista vazia", async () => {
    const userId = await makeUser();
    const tripId = await chosenTrip(userId);
    const itineraryId = await repo.createPending(tripId, 1);
    await repo.replaceDays(itineraryId, [{ dayIndex: 1, slots: [] }], []);
    const day = (await repo.latest(tripId))!.days[0]!;

    await repo.replaceDayItems(
      day.id,
      [
        {
          slot: "morning",
          type: "activity",
          title: "Museu",
          description: "manhã no museu",
          durationMin: 90,
          estCost: 45
        },
        { slot: "evening", type: "meal", title: "Jantar fixo" }
      ],
      new Set(["evening|meal|Jantar fixo"])
    );

    const after = (await repo.latest(tripId))!.days[0]!.items;
    const museu = after.find((i) => i.title === "Museu")!;
    expect(museu.estCost).toBe(45);
    expect(museu.description).toBe("manhã no museu");
    expect(museu.durationMin).toBe(90);
    expect(after.find((i) => i.title === "Jantar fixo")!.pinned).toBe(true);

    await repo.replaceDayItems(day.id, [], new Set());
    expect((await repo.latest(tripId))!.days[0]!.items).toEqual([]);
  });
});

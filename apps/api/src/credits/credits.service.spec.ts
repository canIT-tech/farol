import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDbClient, runMigrations, users, trips } from "@farol/db";
import { PaymentRequiredError } from "@farol/shared";
import { CreditsService } from "./credits.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const service = new CreditsService(db);
const userIds: string[] = [];

async function makeUser(credits = 0): Promise<string> {
  const id = crypto.randomUUID();
  userIds.push(id);
  await db.insert(users).values({ id, email: `${id}@farol.test`, credits });
  return id;
}

async function makeTrip(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(trips).values({ id, userId, originIata: "GRU" });
  return id;
}

async function userRow(id: string) {
  return (await db.select().from(users).where(eq(users.id, id)))[0]!;
}

async function tripRow(id: string) {
  return (await db.select().from(trips).where(eq(trips.id, id)))[0]!;
}

beforeAll(async () => {
  await runMigrations(url);
});

afterEach(async () => {
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds.splice(0)));
  }
});

afterAll(async () => {
  await close();
});

describe("unlock", () => {
  it("primeira viagem da conta é grátis e marca free_itinerary_used_at", async () => {
    const userId = await makeUser();
    const tripId = await makeTrip(userId);

    expect(await service.unlock(userId, tripId)).toBe("free");

    const user = await userRow(userId);
    expect(user.freeItineraryUsedAt).not.toBeNull();
    expect(user.credits).toBe(0);
    const trip = await tripRow(tripId);
    expect(trip.unlockedVia).toBe("free");
    expect(trip.unlockedAt).not.toBeNull();
  });

  it("segunda viagem debita 1 crédito", async () => {
    const userId = await makeUser(2);
    await service.unlock(userId, await makeTrip(userId));
    const tripId = await makeTrip(userId);

    expect(await service.unlock(userId, tripId)).toBe("credit");

    expect((await userRow(userId)).credits).toBe(1);
    const trip = await tripRow(tripId);
    expect(trip.unlockedVia).toBe("credit");
    expect(trip.unlockedAt).not.toBeNull();
  });

  it("sem grátis e sem saldo lança PaymentRequiredError e não toca em nada", async () => {
    const userId = await makeUser(0);
    await service.unlock(userId, await makeTrip(userId));
    const tripId = await makeTrip(userId);

    await expect(service.unlock(userId, tripId)).rejects.toBeInstanceOf(PaymentRequiredError);

    const trip = await tripRow(tripId);
    expect(trip.unlockedAt).toBeNull();
    expect(trip.unlockedVia).toBeNull();
    expect((await userRow(userId)).credits).toBe(0);
  });

  it("viagem já destravada não cobra de novo", async () => {
    const userId = await makeUser(1);
    const tripId = await makeTrip(userId);
    await service.unlock(userId, tripId);

    expect(await service.unlock(userId, tripId)).toBe("already");

    expect((await userRow(userId)).credits).toBe(1);
    expect((await userRow(userId)).freeItineraryUsedAt).not.toBeNull();
  });

  it("dois unlock simultâneos com saldo 1: um debita, o outro leva 402", async () => {
    const userId = await makeUser(1);
    await service.unlock(userId, await makeTrip(userId));
    const [tripA, tripB] = [await makeTrip(userId), await makeTrip(userId)];

    const results = await Promise.allSettled([
      service.unlock(userId, tripA),
      service.unlock(userId, tripB)
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(PaymentRequiredError);
    expect((await userRow(userId)).credits).toBe(0);
  });
});

describe("release", () => {
  it("devolve o crédito e limpa a viagem quando foi por crédito", async () => {
    const userId = await makeUser(1);
    await service.unlock(userId, await makeTrip(userId));
    const tripId = await makeTrip(userId);
    await service.unlock(userId, tripId);

    await service.release(tripId);

    expect((await userRow(userId)).credits).toBe(1);
    const trip = await tripRow(tripId);
    expect(trip.unlockedAt).toBeNull();
    expect(trip.unlockedVia).toBeNull();
  });

  it("devolve o grátis quando foi por grátis", async () => {
    const userId = await makeUser();
    const tripId = await makeTrip(userId);
    await service.unlock(userId, tripId);

    await service.release(tripId);

    const user = await userRow(userId);
    expect(user.freeItineraryUsedAt).toBeNull();
    expect(user.credits).toBe(0);
    expect((await tripRow(tripId)).unlockedAt).toBeNull();
  });

  it("viagem não destravada ou inexistente é no-op", async () => {
    const userId = await makeUser(3);
    const tripId = await makeTrip(userId);

    await service.release(tripId);
    await service.release(crypto.randomUUID());

    expect((await userRow(userId)).credits).toBe(3);
  });
});

describe("summary", () => {
  it("reflete saldo e se o grátis já foi usado", async () => {
    const userId = await makeUser(2);
    expect(await service.summary(userId)).toEqual({ credits: 2, freeItineraryUsed: false });

    await service.unlock(userId, await makeTrip(userId));
    expect(await service.summary(userId)).toEqual({ credits: 2, freeItineraryUsed: true });
  });

  it("usuário inexistente é saldo zero", async () => {
    expect(await service.summary(crypto.randomUUID())).toEqual({
      credits: 0,
      freeItineraryUsed: false
    });
  });
});

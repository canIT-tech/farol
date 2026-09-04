import { describe, it, expect, afterAll, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDbClient, users, trips, tripDestinations } from "@farol/db";
import { isDomainError, type TripInput } from "@farol/shared";
import { TripsService } from "./trips.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const service = new TripsService(db);
const userIds: string[] = [];

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  userIds.push(id);
  await db.insert(users).values({ id, email: `${id}@farol.test` });
  return id;
}

const input: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 15000,
  currency: "BRL",
  durationDays: 7,
  targetMonth: "2026-09"
};

afterEach(async () => {
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("TripsService", () => {
  it("create grava a viagem com status draft e devolve o DTO", async () => {
    const userId = await makeUser();
    const trip = await service.create(userId, input);
    expect(trip.status).toBe("draft");
    expect(trip.userId).toBe(userId);
    expect(trip.budgetTotal).toBe(15000);
    expect(trip.durationDays).toBe(7);

    const rows = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(rows).toHaveLength(1);
  });

  it("create aceita a variante com datas exatas e título", async () => {
    const userId = await makeUser();
    const trip = await service.create(userId, {
      originIata: "GRU",
      party: { adults: 1, children: 0 },
      budgetTotal: 9000,
      currency: "BRL",
      title: "Setembro no Nordeste",
      dateStart: "2026-09-10",
      dateEnd: "2026-09-17"
    });
    expect(trip.title).toBe("Setembro no Nordeste");
    expect(trip.dateStart).toBe("2026-09-10");
    expect(trip.dateEnd).toBe("2026-09-17");
    expect(trip.durationDays).toBeNull();
    expect(trip.targetMonth).toBeNull();
  });

  it("list devolve as viagens do usuário, mais recentes primeiro", async () => {
    const userId = await makeUser();
    const a = await service.create(userId, { ...input, title: "A" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await service.create(userId, { ...input, title: "B" });
    const list = await service.list(userId);
    expect(list.map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it("get monta o TripState com destinations vazio quando não houve descoberta", async () => {
    const userId = await makeUser();
    const trip = await service.create(userId, input);
    const state = await service.get(userId, trip.id);
    expect(state.destinations).toEqual([]);
    expect(state.chosenDestination).toBeNull();
  });

  it("get inclui os trip_destinations e o escolhido", async () => {
    const userId = await makeUser();
    const trip = await service.create(userId, input);
    await db.insert(tripDestinations).values([
      {
        id: crypto.randomUUID(),
        tripId: trip.id,
        city: "Lisboa",
        country: "Portugal",
        iata: "LIS",
        score: "0.8",
        rationale: "Justificativa longa o suficiente para o schema aqui.",
        estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
        climate: { expectedC: 24, summary: "ameno", bestMonths: [9] },
        flightTimeHours: "9.5",
        chosen: true
      }
    ]);
    const state = await service.get(userId, trip.id);
    expect(state.destinations.map((d) => d.iata)).toEqual(["LIS"]);
    expect(state.chosenDestination?.iata).toBe("LIS");
  });

  it("get lança NotFoundError quando a viagem não existe", async () => {
    const userId = await makeUser();
    try {
      await service.get(userId, crypto.randomUUID());
      expect.unreachable("deveria ter lançado");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("not_found");
      expect((err as Error).message).toBe("viagem não encontrada");
    }
  });

  it("get lança ForbiddenError quando a viagem é de outro usuário", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const trip = await service.create(owner, input);
    try {
      await service.get(intruder, trip.id);
      expect.unreachable("deveria ter lançado");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("forbidden");
      expect((err as Error).message).toBe("essa viagem pertence a outro usuário");
    }
  });

  it("remove apaga a viagem e ela some da lista", async () => {
    const userId = await makeUser();
    const alvo = await service.create(userId, input);
    const outra = await service.create(userId, input);

    await service.remove(userId, alvo.id);

    const restantes = await service.list(userId);
    expect(restantes.map((t) => t.id)).toEqual([outra.id]);
  });

  it("remove leva junto o que pendurava na viagem", async () => {
    const userId = await makeUser();
    const trip = await service.create(userId, input);
    await db.insert(tripDestinations).values({
      id: crypto.randomUUID(),
      tripId: trip.id,
      city: "Lisboa",
      country: "Portugal",
      iata: "LIS",
      score: "0.9",
      rationale: "Justificativa longa o suficiente para o schema aqui.",
      estCost: { flight: 4000, lodgingPerNight: 200, dailyLocal: 150, currency: "BRL" },
      climate: { expectedC: 22, summary: "ameno", bestMonths: [9] },
      flightTimeHours: null,
      chosen: true
    });

    await service.remove(userId, trip.id);

    const sobrou = await db
      .select()
      .from(tripDestinations)
      .where(eq(tripDestinations.tripId, trip.id));
    expect(sobrou).toEqual([]);
  });

  it("remove lança NotFoundError quando a viagem não existe", async () => {
    const userId = await makeUser();
    try {
      await service.remove(userId, crypto.randomUUID());
      expect.unreachable("deveria lançar");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("not_found");
    }
  });

  it("remove lança ForbiddenError, e não apaga, quando a viagem é de outro", async () => {
    const dono = await makeUser();
    const intruso = await makeUser();
    const trip = await service.create(dono, input);

    try {
      await service.remove(intruso, trip.id);
      expect.unreachable("deveria lançar");
    } catch (err) {
      expect((err as { code: string }).code).toBe("forbidden");
    }

    expect(await service.list(dono)).toHaveLength(1);
  });
});

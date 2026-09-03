import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import {
  createDbClient,
  runMigrations,
  seedCatalog,
  DEFAULT_CATALOG_CSV,
  users,
  tripDestinations
} from "@farol/db";
import { isDomainError, type TasteProfileInput, type TripInput } from "@farol/shared";
import { DiscoveryService } from "./discovery.service";
import { CatalogRepository } from "./catalog.repository";
import { TripsService } from "../trips/trips.service";
import type { FlightsService } from "../flights/flights.service";
import { ProfileService } from "../profile/profile.service";
import { FakeLlmService } from "../llm/fake-llm.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const tripsService = new TripsService(db);
const profileService = new ProfileService(db);
// city-directions com preço real fica fora deste spec de integração — a rota
// depende da rede. O comportamento com e sem preço real está no .unit.spec.
const noRealPrices = {
  cityDirections: () => Promise.resolve({ offers: [], stale: false, error: null })
} as unknown as FlightsService;

const service = new DiscoveryService(
  db,
  new CatalogRepository(db),
  tripsService,
  profileService,
  noRealPrices,
  new FakeLlmService()
);

const userIds: string[] = [];

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  userIds.push(id);
  await db.insert(users).values({ id, email: `${id}@farol.test` });
  return id;
}

const profileInput: TasteProfileInput = {
  interests: ["praia", "gastronomia", "cultura e museus"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: {}
};

const tripInput: TripInput = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 60000,
  currency: "BRL",
  durationDays: 5,
  targetMonth: "2026-09"
};

beforeAll(async () => {
  await runMigrations(url);
  await seedCatalog(url, fileURLToPath(DEFAULT_CATALOG_CSV));
});

afterEach(async () => {
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("DiscoveryService.run", () => {
  it("persiste 3 trip_destinations (chosen=false) e devolve os candidatos", async () => {
    const userId = await makeUser();
    await profileService.upsert(userId, profileInput);
    const trip = await tripsService.create(userId, tripInput);

    const candidates = await service.run(userId, trip.id);

    expect(candidates).toHaveLength(3);
    expect(candidates.every((c) => c.rationale.length >= 10)).toBe(true);
    expect(candidates.every((c) => c.estCost.currency === "BRL")).toBe(true);

    const rows = await db
      .select()
      .from(tripDestinations)
      .where(eq(tripDestinations.tripId, trip.id));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.chosen === false)).toBe(true);
  });

  it("lança NotFoundError('taste_profile_required') quando não há perfil", async () => {
    const userId = await makeUser();
    const trip = await tripsService.create(userId, tripInput);
    try {
      await service.run(userId, trip.id);
      expect.unreachable("deveria ter lançado");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("not_found");
      expect((err as Error).message).toBe("taste_profile_required");
    }
  });

  it("lança DomainError('no_destinations_in_budget') com orçamento minúsculo", async () => {
    const userId = await makeUser();
    await profileService.upsert(userId, profileInput);
    const trip = await tripsService.create(userId, { ...tripInput, budgetTotal: 100 });
    try {
      await service.run(userId, trip.id);
      expect.unreachable("deveria ter lançado");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("no_destinations_in_budget");
      expect((err as Error).message).toContain("orçamento");
    }
  });

  it("rodar de novo substitui os destinos, não acumula", async () => {
    const userId = await makeUser();
    await profileService.upsert(userId, profileInput);
    const trip = await tripsService.create(userId, tripInput);

    await service.run(userId, trip.id);
    await service.run(userId, trip.id);

    const rows = await db
      .select()
      .from(tripDestinations)
      .where(eq(tripDestinations.tripId, trip.id));
    expect(rows).toHaveLength(3);
  });

  it("propaga ForbiddenError quando a viagem é de outro usuário", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    await profileService.upsert(intruder, profileInput);
    const trip = await tripsService.create(owner, tripInput);
    await expect(service.run(intruder, trip.id)).rejects.toMatchObject({ code: "forbidden" });
  });
});

import { describe, it, expect, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@farol/shared";
import type { CatalogEntry } from "@farol/domain";
import { DiscoveryService } from "./discovery.service";
import type { CatalogRepository } from "./catalog.repository";
import type { ProfileService } from "../profile/profile.service";
import type { TripsService } from "../trips/trips.service";
import type { LlmPort } from "../llm/llm.types";
import type { TripState } from "../trips/trip-state";

const tripState = {
  id: "t-1",
  userId: "u-1",
  status: "draft",
  title: null,
  originIata: "GRU",
  dateStart: null,
  dateEnd: null,
  durationDays: 5,
  targetMonth: "2026-09",
  party: { adults: 2, children: 0 },
  budgetTotal: 60000,
  currency: "BRL",
  chosenDestinationId: null,
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
  destinations: [],
  chosenDestination: null
} satisfies TripState;

const validProfile = {
  interests: ["praia", "gastronomia", "cultura e museus"],
  pace: "moderado" as const,
  partyType: "casal" as const,
  budgetBand: "medio" as const,
  constraints: {}
};

function catalogEntry(over: Partial<CatalogEntry>): CatalogEntry {
  return {
    city: "Cidade",
    country: "País",
    iata: "AAA",
    tags: ["praia"],
    bestMonths: [9, 10],
    avgFlightCostFromGru: 1000,
    avgLodgingNight: 100,
    avgDailyLocal: 50,
    region: "south-america",
    visaFreeBr: true,
    ...over
  };
}

function makeService(opts: {
  profileGet?: () => Promise<unknown>;
  trip?: TripState;
  catalog?: CatalogEntry[];
  rank?: ReturnType<typeof vi.fn>;
}) {
  const tx = {
    delete: () => ({ where: () => Promise.resolve() }),
    insert: () => ({ values: () => Promise.resolve() })
  };
  const db = {
    transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx))
  } as unknown as ConstructorParameters<typeof DiscoveryService>[0];
  const catalog = {
    all: vi.fn().mockResolvedValue(opts.catalog ?? [])
  } as unknown as CatalogRepository;
  const trips = {
    get: vi.fn().mockResolvedValue(opts.trip ?? tripState)
  } as unknown as TripsService;
  const profiles = {
    get: vi.fn(opts.profileGet ?? (() => Promise.resolve(validProfile)))
  } as unknown as ProfileService;
  const rankDestinations = opts.rank ?? vi.fn();
  const llm = { rankDestinations } as unknown as LlmPort;
  return {
    service: new DiscoveryService(db, catalog, trips, profiles, llm),
    catalog,
    rankDestinations
  };
}

describe("DiscoveryService.run — casos de borda", () => {
  it("converte NotFound do ProfileService em 'taste_profile_required'", async () => {
    const { service } = makeService({
      profileGet: () => Promise.reject(new NotFoundError("perfil de gosto não encontrado"))
    });
    await expect(service.run("u-1", "t-1")).rejects.toMatchObject({
      code: "not_found",
      message: "taste_profile_required"
    });
  });

  it("repassa erros que não são de domínio", async () => {
    const { service, catalog } = makeService({
      profileGet: () => Promise.reject(new Error("conexão caiu"))
    });
    await expect(service.run("u-1", "t-1")).rejects.toThrow("conexão caiu");
    expect(catalog.all).not.toHaveBeenCalled();
  });

  it("trata budgetTotal nulo como zero (nada cabe no orçamento)", async () => {
    const { service } = makeService({ trip: { ...tripState, budgetTotal: null } });
    await expect(service.run("u-1", "t-1")).rejects.toMatchObject({
      code: "no_destinations_in_budget"
    });
  });

  it("repassa ForbiddenError do perfil sem convertê-lo", async () => {
    const { service } = makeService({
      profileGet: () => Promise.reject(new ForbiddenError("nao pode"))
    });
    await expect(service.run("u-1", "t-1")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("com exatamente 3 destinos na shortlist não lança e persiste os 3", async () => {
    const catalog = [
      catalogEntry({ iata: "AAA", tags: ["praia", "gastronomia", "cultura e museus"] }),
      catalogEntry({ iata: "BBB", tags: ["praia", "gastronomia"] }),
      catalogEntry({ iata: "CCC", tags: ["praia"] })
    ];
    const rank = vi.fn().mockResolvedValue([
      { iata: "AAA", score: 0.9, rationale: "Justificativa longa o suficiente para o schema." },
      { iata: "BBB", score: 0.8, rationale: "Justificativa longa o suficiente para o schema." },
      { iata: "CCC", score: 0.7, rationale: "Justificativa longa o suficiente para o schema." }
    ]);
    const { service, rankDestinations } = makeService({ catalog, rank });

    const candidates = await service.run("u-1", "t-1");

    expect(candidates.map((c) => c.iata)).toEqual(["AAA", "BBB", "CCC"]);
    // trip enviado ao modelo carrega os adultos do party
    expect(rankDestinations.mock.calls[0]![0].trip).toEqual({
      originIata: "GRU",
      budgetTotal: 60000,
      currency: "BRL",
      party: { adults: 2 }
    });
    // summary do clima lista os meses separados por vírgula
    expect(candidates[0]!.climate.summary).toBe("melhor época nos meses 9, 10");
  });
});

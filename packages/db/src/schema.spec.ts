import { describe, it, expect } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  users,
  tasteProfiles,
  trips,
  tripDestinations,
  destinationCatalog,
  providerCache,
  flightSelections,
  hotelSelections,
  itineraries,
  itineraryDays,
  itineraryItems
} from "./schema";

type ColSpec = {
  name: string;
  sqlType: string;
  notNull: boolean;
  hasDefault?: boolean;
  default?: unknown;
};

type AnyTable = Parameters<typeof getTableColumns>[0];

function checkColumns(table: AnyTable, dbName: string, specs: Record<string, ColSpec>): void {
  it(`${dbName}: nome da tabela e mapeamento completo de colunas`, () => {
    expect(getTableName(table)).toBe(dbName);
    const cols = getTableColumns(table);
    expect(Object.keys(cols).sort()).toEqual(Object.keys(specs).sort());

    for (const [prop, spec] of Object.entries(specs)) {
      const col = cols[prop];
      expect(col, prop).toBeDefined();
      expect(col.name, `${prop}.name`).toBe(spec.name);
      expect(col.getSQLType(), `${prop}.sqlType`).toBe(spec.sqlType);
      expect(col.notNull, `${prop}.notNull`).toBe(spec.notNull);
      if (spec.hasDefault !== undefined) {
        expect(col.hasDefault, `${prop}.hasDefault`).toBe(spec.hasDefault);
      }
      if ("default" in spec) {
        expect(col.default, `${prop}.default`).toEqual(spec.default);
      }
    }
  });
}

function indexColumnNames(table: Parameters<typeof getTableConfig>[0], indexName: string): string[] {
  const idx = getTableConfig(table).indexes.find((i) => i.config.name === indexName);
  expect(idx, indexName).toBeDefined();
  return idx!.config.columns.map((col) => (col as { name: string }).name);
}

const TS = "timestamp with time zone";

describe("schema.users", () => {
  checkColumns(users, "users", {
    id: { name: "id", sqlType: "uuid", notNull: true },
    email: { name: "email", sqlType: "text", notNull: true },
    displayName: { name: "display_name", sqlType: "text", notNull: false },
    createdAt: { name: "created_at", sqlType: TS, notNull: true, hasDefault: true }
  });

  it("id é primary key", () => {
    expect(getTableColumns(users).id.primary).toBe(true);
  });
});

describe("schema.tasteProfiles", () => {
  checkColumns(tasteProfiles, "taste_profiles", {
    id: { name: "id", sqlType: "uuid", notNull: true },
    userId: { name: "user_id", sqlType: "uuid", notNull: true },
    interests: { name: "interests", sqlType: "jsonb", notNull: true, hasDefault: true, default: [] },
    pace: { name: "pace", sqlType: "text", notNull: true },
    partyType: { name: "party_type", sqlType: "text", notNull: true },
    budgetBand: { name: "budget_band", sqlType: "text", notNull: true },
    constraints: {
      name: "constraints",
      sqlType: "jsonb",
      notNull: true,
      hasDefault: true,
      default: {}
    },
    updatedAt: { name: "updated_at", sqlType: TS, notNull: true, hasDefault: true }
  });

  it("userId é unique", () => {
    expect(getTableColumns(tasteProfiles).userId.isUnique).toBe(true);
  });

  it("referencia users.id com ON DELETE cascade", () => {
    const fk = getTableConfig(tasteProfiles).foreignKeys[0]!;
    const ref = fk.reference();
    expect(ref.foreignTable).toBe(users);
    expect(ref.foreignColumns[0]!.name).toBe("id");
    expect(fk.onDelete).toBe("cascade");
  });
});

describe("schema.trips", () => {
  checkColumns(trips, "trips", {
    id: { name: "id", sqlType: "uuid", notNull: true },
    userId: { name: "user_id", sqlType: "uuid", notNull: true },
    status: { name: "status", sqlType: "text", notNull: true, hasDefault: true, default: "draft" },
    title: { name: "title", sqlType: "text", notNull: false },
    originIata: { name: "origin_iata", sqlType: "text", notNull: true },
    dateStart: { name: "date_start", sqlType: "date", notNull: false },
    dateEnd: { name: "date_end", sqlType: "date", notNull: false },
    durationDays: { name: "duration_days", sqlType: "integer", notNull: false },
    targetMonth: { name: "target_month", sqlType: "text", notNull: false },
    party: {
      name: "party",
      sqlType: "jsonb",
      notNull: true,
      hasDefault: true,
      default: { adults: 1, children: 0 }
    },
    budgetTotal: { name: "budget_total", sqlType: "numeric", notNull: false },
    currency: { name: "currency", sqlType: "text", notNull: true, hasDefault: true, default: "BRL" },
    chosenDestinationId: { name: "chosen_destination_id", sqlType: "uuid", notNull: false },
    createdAt: { name: "created_at", sqlType: TS, notNull: true, hasDefault: true },
    updatedAt: { name: "updated_at", sqlType: TS, notNull: true, hasDefault: true }
  });

  it("referencia users.id com ON DELETE cascade", () => {
    const fk = getTableConfig(trips).foreignKeys[0]!;
    const ref = fk.reference();
    expect(ref.foreignTable).toBe(users);
    expect(ref.foreignColumns[0]!.name).toBe("id");
    expect(fk.onDelete).toBe("cascade");
  });

  it("indexa (userId, status)", () => {
    expect(indexColumnNames(trips, "trips_user_status_idx")).toEqual(["user_id", "status"]);
  });
});

describe("schema.tripDestinations", () => {
  checkColumns(tripDestinations, "trip_destinations", {
    id: { name: "id", sqlType: "uuid", notNull: true },
    tripId: { name: "trip_id", sqlType: "uuid", notNull: true },
    city: { name: "city", sqlType: "text", notNull: true },
    country: { name: "country", sqlType: "text", notNull: true },
    iata: { name: "iata", sqlType: "text", notNull: true },
    score: { name: "score", sqlType: "numeric", notNull: true },
    rationale: { name: "rationale", sqlType: "text", notNull: true },
    estCost: { name: "est_cost", sqlType: "jsonb", notNull: true },
    climate: { name: "climate", sqlType: "jsonb", notNull: true },
    flightTimeHours: { name: "flight_time_hours", sqlType: "numeric", notNull: false },
    chosen: {
      name: "chosen",
      sqlType: "boolean",
      notNull: true,
      hasDefault: true,
      default: false
    },
    createdAt: { name: "created_at", sqlType: TS, notNull: true, hasDefault: true }
  });

  it("referencia trips.id com ON DELETE cascade", () => {
    const fk = getTableConfig(tripDestinations).foreignKeys[0]!;
    const ref = fk.reference();
    expect(ref.foreignTable).toBe(trips);
    expect(ref.foreignColumns[0]!.name).toBe("id");
    expect(fk.onDelete).toBe("cascade");
  });

  it("indexa tripId", () => {
    expect(indexColumnNames(tripDestinations, "trip_destinations_trip_idx")).toEqual(["trip_id"]);
  });
});

describe("schema.destinationCatalog", () => {
  checkColumns(destinationCatalog, "destination_catalog", {
    id: { name: "id", sqlType: "uuid", notNull: true },
    city: { name: "city", sqlType: "text", notNull: true },
    country: { name: "country", sqlType: "text", notNull: true },
    iata: { name: "iata", sqlType: "text", notNull: true },
    tags: { name: "tags", sqlType: "jsonb", notNull: true },
    bestMonths: { name: "best_months", sqlType: "jsonb", notNull: true },
    avgFlightCostFromGru: { name: "avg_flight_cost_from_gru", sqlType: "numeric", notNull: true },
    avgLodgingNight: { name: "avg_lodging_night", sqlType: "numeric", notNull: true },
    avgDailyLocal: { name: "avg_daily_local", sqlType: "numeric", notNull: true },
    region: { name: "region", sqlType: "text", notNull: true },
    visaFreeBr: { name: "visa_free_br", sqlType: "boolean", notNull: true }
  });

  it("iata é unique", () => {
    expect(getTableColumns(destinationCatalog).iata.isUnique).toBe(true);
  });

  it("indexa iata", () => {
    expect(indexColumnNames(destinationCatalog, "destination_catalog_iata_idx")).toEqual(["iata"]);
  });
});

describe("schema.providerCache", () => {
  checkColumns(providerCache, "provider_cache", {
    key: { name: "key", sqlType: "text", notNull: true },
    provider: { name: "provider", sqlType: "text", notNull: true },
    payload: { name: "payload", sqlType: "jsonb", notNull: true },
    fetchedAt: { name: "fetched_at", sqlType: TS, notNull: true, hasDefault: true },
    expiresAt: { name: "expires_at", sqlType: TS, notNull: true }
  });

  it("key é primary key", () => {
    expect(getTableColumns(providerCache).key.primary).toBe(true);
  });

  it("indexa expiresAt", () => {
    expect(indexColumnNames(providerCache, "provider_cache_expires_idx")).toEqual(["expires_at"]);
  });
});

describe("schema.flightSelections", () => {
  checkColumns(flightSelections, "flight_selections", {
    id: { name: "id", sqlType: "uuid", notNull: true },
    tripId: { name: "trip_id", sqlType: "uuid", notNull: true },
    offer: { name: "offer", sqlType: "jsonb", notNull: true },
    price: { name: "price", sqlType: "numeric", notNull: true },
    currency: { name: "currency", sqlType: "text", notNull: true },
    carrier: { name: "carrier", sqlType: "text", notNull: false },
    stops: { name: "stops", sqlType: "integer", notNull: false },
    departAt: { name: "depart_at", sqlType: TS, notNull: false },
    returnAt: { name: "return_at", sqlType: TS, notNull: false },
    deepLink: { name: "deep_link", sqlType: "text", notNull: true },
    selectedAt: { name: "selected_at", sqlType: TS, notNull: true, hasDefault: true }
  });

  it("referencia trips.id com ON DELETE cascade", () => {
    const fk = getTableConfig(flightSelections).foreignKeys[0]!;
    const ref = fk.reference();
    expect(ref.foreignTable).toBe(trips);
    expect(ref.foreignColumns[0]!.name).toBe("id");
    expect(fk.onDelete).toBe("cascade");
  });
});

describe("schema.hotelSelections", () => {
  checkColumns(hotelSelections, "hotel_selections", {
    id: { name: "id", sqlType: "uuid", notNull: true },
    tripId: { name: "trip_id", sqlType: "uuid", notNull: true },
    offer: { name: "offer", sqlType: "jsonb", notNull: true },
    name: { name: "name", sqlType: "text", notNull: true },
    region: { name: "region", sqlType: "text", notNull: false },
    pricePerNight: { name: "price_per_night", sqlType: "numeric", notNull: true },
    priceTotal: { name: "price_total", sqlType: "numeric", notNull: false },
    currency: { name: "currency", sqlType: "text", notNull: true },
    rating: { name: "rating", sqlType: "numeric", notNull: false },
    deepLink: { name: "deep_link", sqlType: "text", notNull: true },
    selectedAt: { name: "selected_at", sqlType: TS, notNull: true, hasDefault: true }
  });

  it("referencia trips.id com ON DELETE cascade", () => {
    const fk = getTableConfig(hotelSelections).foreignKeys[0]!;
    const ref = fk.reference();
    expect(ref.foreignTable).toBe(trips);
    expect(ref.foreignColumns[0]!.name).toBe("id");
    expect(fk.onDelete).toBe("cascade");
  });
});

describe("schema.itineraries", () => {
  checkColumns(itineraries, "itineraries", {
    id: { name: "id", sqlType: "uuid", notNull: true },
    tripId: { name: "trip_id", sqlType: "uuid", notNull: true },
    version: { name: "version", sqlType: "integer", notNull: true },
    status: { name: "status", sqlType: "text", notNull: true, hasDefault: true, default: "pending" },
    error: { name: "error", sqlType: "text", notNull: false },
    generatedAt: { name: "generated_at", sqlType: TS, notNull: false },
    createdAt: { name: "created_at", sqlType: TS, notNull: true, hasDefault: true }
  });

  it("referencia trips.id com ON DELETE cascade", () => {
    const fk = getTableConfig(itineraries).foreignKeys[0]!;
    const ref = fk.reference();
    expect(ref.foreignTable).toBe(trips);
    expect(ref.foreignColumns[0]!.name).toBe("id");
    expect(fk.onDelete).toBe("cascade");
  });

  it("indexa (tripId, version)", () => {
    expect(indexColumnNames(itineraries, "itineraries_trip_version_idx")).toEqual([
      "trip_id",
      "version"
    ]);
  });
});

describe("schema.itineraryDays", () => {
  checkColumns(itineraryDays, "itinerary_days", {
    id: { name: "id", sqlType: "uuid", notNull: true },
    itineraryId: { name: "itinerary_id", sqlType: "uuid", notNull: true },
    dayIndex: { name: "day_index", sqlType: "integer", notNull: true },
    date: { name: "date", sqlType: "date", notNull: false },
    notes: { name: "notes", sqlType: "text", notNull: false }
  });

  it("referencia itineraries.id com ON DELETE cascade", () => {
    const fk = getTableConfig(itineraryDays).foreignKeys[0]!;
    const ref = fk.reference();
    expect(ref.foreignTable).toBe(itineraries);
    expect(ref.foreignColumns[0]!.name).toBe("id");
    expect(fk.onDelete).toBe("cascade");
  });

  it("indexa (itineraryId, dayIndex)", () => {
    expect(indexColumnNames(itineraryDays, "itinerary_days_itinerary_day_idx")).toEqual([
      "itinerary_id",
      "day_index"
    ]);
  });
});

describe("schema.itineraryItems", () => {
  checkColumns(itineraryItems, "itinerary_items", {
    id: { name: "id", sqlType: "uuid", notNull: true },
    dayId: { name: "day_id", sqlType: "uuid", notNull: true },
    slot: { name: "slot", sqlType: "text", notNull: true },
    type: { name: "type", sqlType: "text", notNull: true },
    title: { name: "title", sqlType: "text", notNull: true },
    description: { name: "description", sqlType: "text", notNull: false },
    placeId: { name: "place_id", sqlType: "text", notNull: false },
    lat: { name: "lat", sqlType: "numeric", notNull: false },
    lng: { name: "lng", sqlType: "numeric", notNull: false },
    rating: { name: "rating", sqlType: "numeric", notNull: false },
    durationMin: { name: "duration_min", sqlType: "integer", notNull: false },
    estCost: { name: "est_cost", sqlType: "numeric", notNull: false },
    sortOrder: { name: "sort_order", sqlType: "integer", notNull: true },
    pinned: { name: "pinned", sqlType: "boolean", notNull: true, hasDefault: true, default: false }
  });

  it("referencia itinerary_days.id com ON DELETE cascade", () => {
    const fk = getTableConfig(itineraryItems).foreignKeys[0]!;
    const ref = fk.reference();
    expect(ref.foreignTable).toBe(itineraryDays);
    expect(ref.foreignColumns[0]!.name).toBe("id");
    expect(fk.onDelete).toBe("cascade");
  });

  it("indexa (dayId, sortOrder)", () => {
    expect(indexColumnNames(itineraryItems, "itinerary_items_day_sort_idx")).toEqual([
      "day_id",
      "sort_order"
    ]);
  });
});

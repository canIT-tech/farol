import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  date,
  integer,
  numeric,
  boolean,
  index
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const tasteProfiles = pgTable("taste_profiles", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  interests: jsonb("interests").$type<string[]>().notNull().default([]),
  pace: text("pace").notNull(),
  partyType: text("party_type").notNull(),
  budgetBand: text("budget_band").notNull(),
  constraints: jsonb("constraints").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

// Viagem em construção (design §5.1). status: draft | planned | done.
export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"),
    title: text("title"),
    originIata: text("origin_iata").notNull(),
    dateStart: date("date_start"),
    dateEnd: date("date_end"),
    durationDays: integer("duration_days"),
    targetMonth: text("target_month"),
    party: jsonb("party")
      .$type<{ adults: number; children: number }>()
      .notNull()
      .default({ adults: 1, children: 0 }),
    budgetTotal: numeric("budget_total"),
    currency: text("currency").notNull().default("BRL"),
    chosenDestinationId: uuid("chosen_destination_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    userStatusIdx: index("trips_user_status_idx").on(t.userId, t.status)
  })
);

// Destinos candidatos de uma viagem, gerados pela descoberta (design §5).
export const tripDestinations = pgTable(
  "trip_destinations",
  {
    id: uuid("id").primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    city: text("city").notNull(),
    country: text("country").notNull(),
    iata: text("iata").notNull(),
    score: numeric("score").notNull(),
    rationale: text("rationale").notNull(),
    estCost: jsonb("est_cost").$type<Record<string, unknown>>().notNull(),
    climate: jsonb("climate").$type<Record<string, unknown>>().notNull(),
    flightTimeHours: numeric("flight_time_hours"),
    chosen: boolean("chosen").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    tripIdx: index("trip_destinations_trip_idx").on(t.tripId)
  })
);

// Catálogo curado de destinos (design §6.1). Base determinística da descoberta.
export const destinationCatalog = pgTable(
  "destination_catalog",
  {
    id: uuid("id").primaryKey(),
    city: text("city").notNull(),
    country: text("country").notNull(),
    iata: text("iata").notNull().unique(),
    tags: jsonb("tags").$type<string[]>().notNull(),
    bestMonths: jsonb("best_months").$type<number[]>().notNull(),
    avgFlightCostFromGru: numeric("avg_flight_cost_from_gru").notNull(),
    avgLodgingNight: numeric("avg_lodging_night").notNull(),
    avgDailyLocal: numeric("avg_daily_local").notNull(),
    region: text("region").notNull(),
    visaFreeBr: boolean("visa_free_br").notNull()
  },
  (t) => ({
    iataIdx: index("destination_catalog_iata_idx").on(t.iata)
  })
);

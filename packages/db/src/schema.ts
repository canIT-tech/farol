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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Saldo de créditos (spec pagamento 2026-09-15 §3). Nunca negativo: o débito
  // é `WHERE credits >= 1` e o estorno usa greatest(0, …). Sem ledger de
  // propósito — o histórico fino mora na Stripe.
  credits: integer("credits").notNull().default(0),
  // Nulo = o roteiro grátis da conta ainda não foi usado.
  freeItineraryUsedAt: timestamp("free_itinerary_used_at", { withTimezone: true })
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
    // A viagem já destravou o roteiro (grátis ou 1 crédito). Regenerar, chat e
    // trocar restaurante nunca recobram. unlockedVia diz o que devolver se o
    // job falhar em definitivo: 'free' | 'credit'.
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    unlockedVia: text("unlocked_via"),
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

// Roteiro versionado de uma viagem (design §5.1). status: pending | ready | failed.
export const itineraries = pgTable(
  "itineraries",
  {
    id: uuid("id").primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    tripVersionIdx: index("itineraries_trip_version_idx").on(t.tripId, t.version)
  })
);

// Um dia do roteiro (design §5.1).
export const itineraryDays = pgTable(
  "itinerary_days",
  {
    id: uuid("id").primaryKey(),
    itineraryId: uuid("itinerary_id")
      .notNull()
      .references(() => itineraries.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    date: date("date"),
    notes: text("notes")
  },
  (t) => ({
    itineraryDayIdx: index("itinerary_days_itinerary_day_idx").on(t.itineraryId, t.dayIndex)
  })
);

// Item de um dia (design §5.1). placeId/lat/lng/rating vêm do enrich do Passo 6.
export const itineraryItems = pgTable(
  "itinerary_items",
  {
    id: uuid("id").primaryKey(),
    dayId: uuid("day_id")
      .notNull()
      .references(() => itineraryDays.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    placeId: text("place_id"),
    lat: numeric("lat"),
    lng: numeric("lng"),
    rating: numeric("rating"),
    durationMin: integer("duration_min"),
    estCost: numeric("est_cost"),
    sortOrder: integer("sort_order").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    // true quando o enrich do Places não achou lugar para o item (design §7.3).
    // O job places.enrich reprocessa só esses.
    needsReview: boolean("needs_review").notNull().default(false)
  },
  (t) => ({
    daySortIdx: index("itinerary_items_day_sort_idx").on(t.dayId, t.sortOrder)
  })
);
// Cache de respostas de provider (design §5.1). key = hash(provider+endpoint+params).
export const providerCache = pgTable(
  "provider_cache",
  {
    key: text("key").primaryKey(),
    provider: text("provider").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (t) => ({
    expiresIdx: index("provider_cache_expires_idx").on(t.expiresAt)
  })
);

// Seleção de voo do usuário (design §5.1). Guarda a oferta crua + deep link.
export const flightSelections = pgTable("flight_selections", {
  id: uuid("id").primaryKey(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  offer: jsonb("offer").$type<unknown>().notNull(),
  price: numeric("price").notNull(),
  currency: text("currency").notNull(),
  carrier: text("carrier"),
  stops: integer("stops"),
  departAt: timestamp("depart_at", { withTimezone: true }),
  returnAt: timestamp("return_at", { withTimezone: true }),
  deepLink: text("deep_link").notNull(),
  selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow()
});

// Seleção de hotel do usuário (design §5.1). Guarda a oferta crua + deep link.
export const hotelSelections = pgTable("hotel_selections", {
  id: uuid("id").primaryKey(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  offer: jsonb("offer").$type<unknown>().notNull(),
  name: text("name").notNull(),
  region: text("region"),
  pricePerNight: numeric("price_per_night").notNull(),
  priceTotal: numeric("price_total"),
  currency: text("currency").notNull(),
  rating: numeric("rating"),
  deepLink: text("deep_link").notNull(),
  selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow()
});

// Lista de espera da landing pública (sem login). email único, source = origem do cadastro.
export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Quando o e-mail de boas-vindas saiu. Nulo = ainda não (falhou ou provider desligado).
  welcomeSentAt: timestamp("welcome_sent_at", { withTimezone: true })
});

// Uma linha por tentativa de compra (spec pagamento 2026-09-15 §3). O histórico
// fino (recibo, estorno, disputa) mora na Stripe; aqui só o que liga a Session
// ao usuário e diz quantos créditos entregar.
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerSessionId: text("provider_session_id").notNull().unique(),
    // Preenchido no pago; é a chave que liga charge.refunded à order.
    providerPaymentIntent: text("provider_payment_intent"),
    product: text("product").notNull(),
    credits: integer("credits").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true })
  },
  (t) => ({
    userCreatedIdx: index("orders_user_created_idx").on(t.userId, t.createdAt)
  })
);

// Só existe para o replay de webhook ser no-op: id = event.id da Stripe.
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow()
});

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

// Histórico de mensagens do chat conversacional (design §6.4)
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content"),
    toolCalls: jsonb("tool_calls").$type<unknown>(),
    toolCallId: text("tool_call_id"),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    tripIdx: index("chat_messages_trip_idx").on(t.tripId, t.createdAt)
  })
);


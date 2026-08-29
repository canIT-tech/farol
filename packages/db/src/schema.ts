import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

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

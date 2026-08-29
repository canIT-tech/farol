CREATE TABLE IF NOT EXISTS "itineraries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "itinerary_days" (
	"id" uuid PRIMARY KEY NOT NULL,
	"itinerary_id" uuid NOT NULL,
	"day_index" integer NOT NULL,
	"date" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "itinerary_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"day_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"place_id" text,
	"lat" numeric,
	"lng" numeric,
	"rating" numeric,
	"duration_min" integer,
	"est_cost" numeric,
	"sort_order" integer NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_day_id_itinerary_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."itinerary_days"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itineraries_trip_version_idx" ON "itineraries" USING btree ("trip_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itinerary_days_itinerary_day_idx" ON "itinerary_days" USING btree ("itinerary_id","day_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "itinerary_items_day_sort_idx" ON "itinerary_items" USING btree ("day_id","sort_order");
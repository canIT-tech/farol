CREATE TABLE IF NOT EXISTS "flight_selections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"offer" jsonb NOT NULL,
	"price" numeric NOT NULL,
	"currency" text NOT NULL,
	"carrier" text,
	"stops" integer,
	"depart_at" timestamp with time zone,
	"return_at" timestamp with time zone,
	"deep_link" text NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hotel_selections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"offer" jsonb NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"price_per_night" numeric NOT NULL,
	"price_total" numeric,
	"currency" text NOT NULL,
	"rating" numeric,
	"deep_link" text NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_selections" ADD CONSTRAINT "flight_selections_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hotel_selections" ADD CONSTRAINT "hotel_selections_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_cache_expires_idx" ON "provider_cache" USING btree ("expires_at");
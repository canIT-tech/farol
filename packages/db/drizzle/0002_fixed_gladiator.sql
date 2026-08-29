CREATE TABLE IF NOT EXISTS "destination_catalog" (
	"id" uuid PRIMARY KEY NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"iata" text NOT NULL,
	"tags" jsonb NOT NULL,
	"best_months" jsonb NOT NULL,
	"avg_flight_cost_from_gru" numeric NOT NULL,
	"avg_lodging_night" numeric NOT NULL,
	"avg_daily_local" numeric NOT NULL,
	"region" text NOT NULL,
	"visa_free_br" boolean NOT NULL,
	CONSTRAINT "destination_catalog_iata_unique" UNIQUE("iata")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_destinations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"iata" text NOT NULL,
	"score" numeric NOT NULL,
	"rationale" text NOT NULL,
	"est_cost" jsonb NOT NULL,
	"climate" jsonb NOT NULL,
	"flight_time_hours" numeric,
	"chosen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text,
	"origin_iata" text NOT NULL,
	"date_start" date,
	"date_end" date,
	"duration_days" integer,
	"target_month" text,
	"party" jsonb DEFAULT '{"adults":1,"children":0}'::jsonb NOT NULL,
	"budget_total" numeric,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"chosen_destination_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_destinations" ADD CONSTRAINT "trip_destinations_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "destination_catalog_iata_idx" ON "destination_catalog" USING btree ("iata");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_destinations_trip_idx" ON "trip_destinations" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_user_status_idx" ON "trips" USING btree ("user_id","status");
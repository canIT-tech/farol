CREATE TABLE IF NOT EXISTS "taste_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pace" text NOT NULL,
	"party_type" text NOT NULL,
	"budget_band" text NOT NULL,
	"constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taste_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "taste_profiles" ADD CONSTRAINT "taste_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

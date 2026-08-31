CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);

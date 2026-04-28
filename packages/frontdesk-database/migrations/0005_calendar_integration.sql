-- Remove deprecated Cal.com API key column
ALTER TABLE "businesses" DROP COLUMN IF EXISTS "calcom_api_key";--> statement-breakpoint

-- Calendar provider enum (extensible: add 'outlook', 'apple', 'caldav' later as new enum values)
CREATE TYPE "public"."calendar_provider" AS ENUM('google', 'outlook', 'apple', 'caldav');--> statement-breakpoint

-- Provider-agnostic calendar connections table (one row per provider per business)
CREATE TABLE "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"provider" "calendar_provider" NOT NULL,
	"provider_account_id" text,
	"provider_email" text,
	"access_token" text,
	"refresh_token" text,
	"token_expiry" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "uq_calendar_connections" ON "calendar_connections" USING btree ("business_id","provider");

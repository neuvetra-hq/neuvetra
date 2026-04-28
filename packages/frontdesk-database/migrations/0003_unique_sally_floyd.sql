ALTER TABLE "businesses" ADD COLUMN "twilio_number_sid" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_twilio_number_sid_unique" UNIQUE("twilio_number_sid");
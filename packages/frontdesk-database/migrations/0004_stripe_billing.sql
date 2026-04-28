ALTER TABLE "businesses" ADD COLUMN "stripe_customer_id" text UNIQUE;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "stripe_subscription_id" text UNIQUE;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "stripe_plan_id" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "stripe_metered_item_id" text;

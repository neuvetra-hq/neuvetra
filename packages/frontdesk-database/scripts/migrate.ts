import postgres from "postgres"

const sql = postgres(process.env.DATABASE_URL!)

await sql.unsafe(`
  ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
  ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;
  ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_plan_id" text;
  ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_metered_item_id" text;
`)

// Add unique constraints separately (IF NOT EXISTS not supported for constraints in older PG)
try {
  await sql`ALTER TABLE "businesses" ADD CONSTRAINT "businesses_stripe_customer_id_unique" UNIQUE("stripe_customer_id")`
} catch { /* already exists */ }
try {
  await sql`ALTER TABLE "businesses" ADD CONSTRAINT "businesses_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")`
} catch { /* already exists */ }

console.log("✅ Stripe billing columns added to businesses table")
await sql.end()

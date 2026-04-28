/**
 * Programmatic migration runner.
 * Applies all pending SQL migrations in ./migrations/ to the database.
 *
 * Usage:
 *   bun run db:migrate
 */
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

const url = Bun.env.DATABASE_URL

if (!url) {
  console.error("❌ DATABASE_URL is not set")
  process.exit(1)
}

console.log("🚀 Running migrations...")

const sql = postgres(url, { max: 1 })
const db = drizzle(sql)

await migrate(db, { migrationsFolder: "./migrations" })

console.log("✅ All migrations applied successfully.")

await sql.end()

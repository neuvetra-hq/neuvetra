import { db } from "@frontdesk/database"
import { sql } from "drizzle-orm"

console.log("🔌 Connecting to database...")

try {
  const result = await db.execute(sql`SELECT current_database() AS db, now() AS time`)
  const row = result[0] as { db: string; time: string }
  console.log("✅ Connected successfully!")
  console.log(`   Database    : ${row.db}`)
  console.log(`   Server time : ${row.time}`)
} catch (err) {
  console.error("❌ Connection failed:")
  console.error(err)
  process.exit(1)
}

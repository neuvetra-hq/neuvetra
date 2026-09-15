import { extractDatabaseUrl } from "../cloud/database-inventory"
import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import { loadStagingDatabaseCa } from "../../packages/neuvetra-database/src/staging-tls"
import { planLegacyStagingContainment } from "../../packages/neuvetra-database/src/staging-audit"

// Explicit read-only operator command; only DATABASE_URL is selected from the supplied export.
const [source, output] = process.argv.slice(2)
let db: ReturnType<typeof createPostgresConnection> | undefined
try {
  if (!source || !output || await Bun.file(output).exists()) throw new Error()
  const url = new URL(extractDatabaseUrl(await Bun.file(source).text()))
  if (url.hostname !== "aws-1-us-west-1.pooler.supabase.com" || url.port !== "5432" || url.username !== "postgres.icockcoguyadhryzydvl" || url.pathname !== "/postgres") throw new Error()
  url.search = ""
  const tlsCaPem = await loadStagingDatabaseCa({ caFile: "tools/cloud/fixtures/supabase-prod-ca-2021.crt" })
  db = createPostgresConnection(url.toString(), { maxConnections: 1, tlsCaPem })
  const receipt = await db.transaction(async tx => {
    await tx.exec("SET TRANSACTION READ ONLY")
    return await planLegacyStagingContainment(tx)
  })
  await Bun.write(output, JSON.stringify(receipt, null, 2) + "\n")
  console.log(JSON.stringify({ status: "read_only_plan_saved", output }))
} catch { console.error("Existing target plan unavailable."); process.exitCode = 1 }
finally { await db?.close() }

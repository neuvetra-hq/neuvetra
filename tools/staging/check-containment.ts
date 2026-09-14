import { extractDatabaseUrl } from "../cloud/database-inventory"
import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import { loadStagingDatabaseCa } from "../../packages/neuvetra-database/src/staging-tls"
import { auditLegacyStagingExposure, planLegacyStagingContainment } from "../../packages/neuvetra-database/src/staging-audit"
const [source, reviewedPlan] = process.argv.slice(2)
let db: ReturnType<typeof createPostgresConnection> | undefined
let stage = "validate", statementIndex = -1
const rollback = new Error("intentional rollback")
let verified = false
try {
  if (!source || !reviewedPlan) throw new Error()
  const url = new URL(extractDatabaseUrl(await Bun.file(source).text()))
  if (url.hostname !== "aws-1-us-west-1.pooler.supabase.com" || url.port !== "5432" || url.username !== "postgres.icockcoguyadhryzydvl" || url.pathname !== "/postgres") throw new Error()
  url.search = ""
  const tlsCaPem = await loadStagingDatabaseCa({ caFile: "tools/cloud/fixtures/supabase-prod-ca-2021.crt" })
  db = createPostgresConnection(url.toString(), {maxConnections:1,tlsCaPem})
  const plan = await Bun.file(reviewedPlan).json()
  stage = "transactional rehearsal"
  await db.transaction(async tx => {
    const current = await planLegacyStagingContainment(tx)
    if (JSON.stringify(current.statements) !== JSON.stringify(plan.statements)) throw new Error("plan drift")
    for (const statement of current.statements) { statementIndex++; await tx.exec(statement) }
    verified = (await auditLegacyStagingExposure(tx)).legacyContainmentVerified
    throw rollback
  })
} catch (error) {
  if (error === rollback) console.log(JSON.stringify({status:"rehearsal_rolled_back", containmentVerified:verified}))
  else {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
    console.error(JSON.stringify({status:"rehearsal_failed_rolled_back",stage,statementIndex,sqlstate:/^[0-9A-Z]{5}$/.test(code)?code:null})); process.exitCode=1
  }
} finally { await db?.close() }

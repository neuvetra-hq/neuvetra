import { loadStagingDatabaseCa } from "./staging-tls"
import { createPostgresConnection } from "./hosted"
import { auditLegacyStagingExposure, planLegacyStagingContainment, EXISTING_PROJECT_REF } from "./staging-audit"
import { migratePrivateStaging, provisionStagingRoster, revokeStagingAccess, type ApprovedStagingRoster } from "./staging-migrations"

// Explicit CLI only: no HTTP entrypoint imports this file. Credentials never appear in arguments/output.
async function main(): Promise<void> {
  const action = process.argv[2]
  if (!action || !["audit","containment-plan","migrate","provision","revoke"].includes(action)) throw new Error("Select audit, containment-plan, migrate, provision, or revoke.")
  const connectionString = process.env.NEUVETRA_STAGING_MIGRATION_DATABASE_URL
  const expectedProjectRef = process.env.NEUVETRA_STAGING_PROJECT_REF
  if (!connectionString || !expectedProjectRef || !/^[a-z]{20}$/.test(expectedProjectRef)) throw new Error("Explicit operator target required.")
  const url = new URL(connectionString)
  const direct = url.hostname === `db.${expectedProjectRef}.supabase.co` && url.username === "postgres" && (!url.port || url.port === "5432")
  const pool = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && url.username === `postgres.${expectedProjectRef}` && url.port === "5432"
  if (!["postgres:","postgresql:"].includes(url.protocol) || (!direct && !pool) || !url.password || url.pathname !== "/postgres" || url.search || url.hash) throw new Error("Operator connection must match the reviewed Supabase target.")
  const reuseExistingProject = process.env.NEUVETRA_STAGING_REUSE_EXISTING === "confirmed"
  if (expectedProjectRef === EXISTING_PROJECT_REF && !reuseExistingProject) throw new Error("Explicit existing project reuse required.")
  if (["migrate","provision","revoke"].includes(action) && process.env.NEUVETRA_STAGING_TARGET_CONFIRMED !== "synthetic-test-data") throw new Error("Explicit synthetic target confirmation required.")
  const tlsCaPem=await loadStagingDatabaseCa({caPem:process.env.NEUVETRA_STAGING_DB_CA_PEM,caFile:process.env.NEUVETRA_STAGING_DB_CA_FILE})
  const db = createPostgresConnection(connectionString, {maxConnections:1,tlsCaPem})
  try {
    if (action === "audit") console.log(JSON.stringify(await auditLegacyStagingExposure(db)))
    if (action === "containment-plan") console.log(JSON.stringify(await planLegacyStagingContainment(db)))
    if (action === "migrate") console.log(JSON.stringify(await migratePrivateStaging(db,{expectedProjectRef,syntheticTargetConfirmed:true,reuseExistingProject})))
    if (action === "provision") {
      const path = process.argv[3]
      if (!path) throw new Error("Approved roster file required.")
      const roster = await Bun.file(path).json() as ApprovedStagingRoster
      if (roster.expectedProjectRef !== expectedProjectRef) throw new Error("Roster target mismatch.")
      console.log(JSON.stringify(await provisionStagingRoster(db,roster)))
    }
    if (action === "revoke") {
      const userId = process.argv[3]
      if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Approved subject required.")
      await revokeStagingAccess(db,userId)
      console.log(JSON.stringify({revoked:true}))
    }
  } finally { await db.close() }
}

if (import.meta.main) main().catch(() => { console.error("Staging operator command failed; inspect target, authorization and sanitized catalog receipt."); process.exitCode=1 })

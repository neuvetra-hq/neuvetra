/** Explicit operator-only additive upgrade of the already approved synthetic project. */
import { extractDatabaseUrl } from "../cloud/database-inventory"
import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import { loadStagingDatabaseCa } from "../../packages/neuvetra-database/src/staging-tls"
import { migratePrivateStaging, readMigrationManifest } from "../../packages/neuvetra-database/src/staging-migrations"
import { open, type FileHandle } from "node:fs/promises"

const [source, reviewedMigrationHash, output] = process.argv.slice(2)
let db: ReturnType<typeof createPostgresConnection> | undefined
let stage = "validate"
let receipt: FileHandle | undefined
let committed = false
try {
  if (!source || !/^[a-f0-9]{64}$/.test(reviewedMigrationHash ?? "") || !output || await Bun.file(output).exists()) throw new Error()
  const manifest = await readMigrationManifest()
  if (manifest.length !== 11 || manifest[10]?.sha256 !== reviewedMigrationHash) throw new Error()
  const url = new URL(extractDatabaseUrl(await Bun.file(source).text()))
  if (url.hostname !== "aws-1-us-west-1.pooler.supabase.com" || url.port !== "5432" || url.username !== "postgres.icockcoguyadhryzydvl" || url.pathname !== "/postgres") throw new Error()
  url.search = ""
  const tlsCaPem = await loadStagingDatabaseCa({ caFile: "tools/cloud/fixtures/supabase-prod-ca-2021.crt" })
  db = createPostgresConnection(url.toString(), { maxConnections: 1, tlsCaPem })
  stage = "baseline"
  const before = await db.query<{ name: string; sha256: string }>("select name,sha256 from neuvetra.schema_migrations order by name")
  if (before.rows.length !== 10 || before.rows.some((row, i) => row.name !== manifest[i]?.name || row.sha256 !== manifest[i]?.sha256)) throw new Error()
  stage = "reserve_receipt"
  receipt = await open(output, "wx")
  await receipt.writeFile(JSON.stringify({ status: "m65_upgrade_started", createdAt: new Date().toISOString(), reviewedMigrationHash }) + "\n")
  await receipt.sync()
  stage = "migration"
  const result = await migratePrivateStaging(db, { expectedProjectRef: "icockcoguyadhryzydvl", syntheticTargetConfirmed: true, reuseExistingProject: true })
  committed = true; stage = "committed_receipt"
  const bytes = Buffer.from(JSON.stringify({ status: "m65_migration_committed", createdAt: new Date().toISOString(), project: "icockcoguyadhryzydvl", beforeVersion: 10, ...result, reviewedMigrationHash, clientTls: "verified CA and hostname", scope: "additive immutable worksheet report tables; M63 and M64 records retained" }, null, 2) + "\n")
  await receipt.truncate(0); await receipt.write(bytes, 0, bytes.length, 0); await receipt.sync()
  console.log(JSON.stringify({ status: "m65_migration_committed", schemaVersion: result.schemaVersion, output }))
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
  console.error(JSON.stringify({ status: committed ? "m65_committed_receipt_failed_do_not_reapply" : "m65_upgrade_failed_verify_database_before_retry", stage, sqlstate: /^[0-9A-Z]{5}$/.test(code) ? code : null })); process.exitCode = 1
} finally { await receipt?.close(); await db?.close() }

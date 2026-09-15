import { extractDatabaseUrl } from "../cloud/database-inventory"
import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import { loadStagingDatabaseCa } from "../../packages/neuvetra-database/src/staging-tls"
import { auditLegacyStagingExposure, planLegacyStagingContainment } from "../../packages/neuvetra-database/src/staging-audit"
import { migratePrivateStaging } from "../../packages/neuvetra-database/src/staging-migrations"
const [source, reviewedPlan, expectedHash, output] = process.argv.slice(2)
let db: ReturnType<typeof createPostgresConnection> | undefined
let stage = "validate"
try {
  if (!source || !reviewedPlan || !/^[a-f0-9]{64}$/.test(expectedHash ?? "") || !output || await Bun.file(output).exists()) throw new Error()
  const planBytes = await Bun.file(reviewedPlan).bytes()
  if (new Bun.CryptoHasher("sha256").update(planBytes).digest("hex") !== expectedHash) throw new Error()
  const plan = JSON.parse(new TextDecoder().decode(planBytes))
  const url = new URL(extractDatabaseUrl(await Bun.file(source).text()))
  if (url.hostname !== "aws-1-us-west-1.pooler.supabase.com" || url.port !== "5432" || url.username !== "postgres.icockcoguyadhryzydvl" || url.pathname !== "/postgres") throw new Error()
  url.search = ""
  const tlsCaPem = await loadStagingDatabaseCa({ caFile: "tools/cloud/fixtures/supabase-prod-ca-2021.crt" })
  db = createPostgresConnection(url.toString(), {maxConnections:1,tlsCaPem})
  stage = "containment"
  const audit = await db.transaction(async tx => {
    const current = await planLegacyStagingContainment(tx)
    if (JSON.stringify(current.statements) !== JSON.stringify(plan.statements) || JSON.stringify(current.providerAdminStatements) !== JSON.stringify(plan.providerAdminStatements)) throw new Error("plan drift")
    for (const statement of current.statements) await tx.exec(statement)
    const result = await auditLegacyStagingExposure(tx)
    if (!result.legacyContainmentVerified) throw new Error("containment failed")
    return result
  })
  await Bun.write(output, JSON.stringify({stage:"containment_committed",reviewedPlanSha256:expectedHash,audit},null,2)+"\n")
  stage = "migration"
  const migration = await migratePrivateStaging(db,{expectedProjectRef:"icockcoguyadhryzydvl",syntheticTargetConfirmed:true,reuseExistingProject:true})
  await Bun.write(output, JSON.stringify({stage:"containment_and_migrations_committed",reviewedPlanSha256:expectedHash,audit,migration},null,2)+"\n")
  console.log(JSON.stringify({status:"containment_and_migrations_committed",output}))
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
  console.error(JSON.stringify({status:"apply_failed",stage,sqlstate:/^[0-9A-Z]{5}$/.test(code)?code:null})); process.exitCode=1
} finally { await db?.close() }

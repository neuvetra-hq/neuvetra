import { extractDatabaseUrl } from "../cloud/database-inventory"
import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import { loadStagingDatabaseCa } from "../../packages/neuvetra-database/src/staging-tls"
import { auditLegacyStagingExposure, containmentAndStorageGuardsVerified, planLegacyStagingContainment } from "../../packages/neuvetra-database/src/staging-audit"
import { migratePrivateStaging } from "../../packages/neuvetra-database/src/staging-migrations"
import { StagingApplyRefusal, stagingApplyFailure } from "../../packages/neuvetra-database/src/staging-apply-failure"
const [source, reviewedPlan, expectedHash, output] = process.argv.slice(2)
let db: ReturnType<typeof createPostgresConnection> | undefined
let stage = "validate"
try {
  const invalid = () => new StagingApplyRefusal("inputs_invalid")
  if (!source || !reviewedPlan || !/^[a-f0-9]{64}$/.test(expectedHash ?? "") || !output || await Bun.file(output).exists()) throw invalid()
  const planBytes = await Bun.file(reviewedPlan).bytes()
  if (new Bun.CryptoHasher("sha256").update(planBytes).digest("hex") !== expectedHash) throw invalid()
  const plan = JSON.parse(new TextDecoder().decode(planBytes))
  const url = new URL(extractDatabaseUrl(await Bun.file(source).text()))
  if (url.hostname !== "aws-1-us-west-1.pooler.supabase.com" || url.port !== "5432" || url.username !== "postgres.icockcoguyadhryzydvl" || url.pathname !== "/postgres") throw invalid()
  url.search = ""
  const tlsCaPem = await loadStagingDatabaseCa({ caFile: "tools/cloud/fixtures/supabase-prod-ca-2021.crt" })
  db = createPostgresConnection(url.toString(), {maxConnections:1,tlsCaPem})
  // BF-18 (QA F-2): the migration backfills and reads its receipts through forced row-level security; refuse a role that does
  // not bypass it before anything is run, with its own reason (before this it surfaced later as a receipt mismatch).
  stage = "role"
  const role = await db.query<{ bypass: boolean }>("select rolsuper or rolbypassrls bypass from pg_roles where rolname=current_user")
  if (role.rows[0]?.bypass !== true) throw new StagingApplyRefusal("role_without_bypassrls")
  stage = "containment"
  const audit = await db.transaction(async tx => {
    const current = await planLegacyStagingContainment(tx)
    if (JSON.stringify(current.statements) !== JSON.stringify(plan.statements) || JSON.stringify(current.providerAdminStatements) !== JSON.stringify(plan.providerAdminStatements)) throw new StagingApplyRefusal("plan_drift")
    for (const statement of current.statements) await tx.exec(statement)
    const result = await auditLegacyStagingExposure(tx)
    if (!containmentAndStorageGuardsVerified(result)) throw new StagingApplyRefusal("containment_not_verified")
    return result
  })
  await Bun.write(output, JSON.stringify({stage:"containment_committed",reviewedPlanSha256:expectedHash,audit},null,2)+"\n")
  stage = "migration"
  const migration = await migratePrivateStaging(db,{expectedProjectRef:"icockcoguyadhryzydvl",syntheticTargetConfirmed:true,reuseExistingProject:true})
  await Bun.write(output, JSON.stringify({stage:"containment_and_migrations_committed",reviewedPlanSha256:expectedHash,audit,migration},null,2)+"\n")
  console.log(JSON.stringify({status:"containment_and_migrations_committed",output}))
} catch (error) {
  // BF-18 (QA F-2): a fixed reason and sentence for every failure, never the error's own message.
  const failure = stagingApplyFailure(error)
  console.error(JSON.stringify({status:"apply_failed",stage,sqlstate:failure.sqlstate,reason:failure.reason,detail:failure.detail})); process.exitCode=1
} finally { await db?.close() }

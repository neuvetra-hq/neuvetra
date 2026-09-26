import type { WorkspaceConnection } from "./workspace"
import { readMigrationManifest } from "./staging-migrations"
import { BETA_ACCESS_PROFILE, BETA_ACCESS_SCHEMA_VERSION } from "./beta-access-contract"

export const BETA_ACCESS_MIGRATIONS = ["0001_access.sql"] as const

export async function readBetaAccessMigrationManifest() {
  return Promise.all(BETA_ACCESS_MIGRATIONS.map(async name => {
    const sql = (await Bun.file(new URL(`./beta-access-migrations/${name}`, import.meta.url)).text()).replace(/\r\n/g, "\n")
    return { name, sql, sha256: new Bun.CryptoHasher("sha256").update(sql).digest("hex") }
  }))
}

/** The isolated M80 rehearsal intentionally starts from the frozen schema-22 prefix. */
export async function readBetaAccessBaselineManifest() {
  const baseline = (await readMigrationManifest()).slice(0, 22)
  if (baseline.length !== 22
    || baseline[20]?.name !== "0021_scope1_inventory.sql"
    || baseline[20]?.sha256 !== "546673470c33da80dc1e0b377646fa09b921e1231535da7c1af43ec866d48736"
    || baseline[21]?.name !== "0022_scope1_beta_foundation.sql"
    || baseline[21]?.sha256 !== "0ee148b366e803e8cf28187393f9e5a6f19b29f5bb54578e359db7cbcd795e35") throw new Error("Exact schema 22 source baseline required.")
  return baseline
}

const safeName = /^[a-z][a-z0-9_]{7,62}$/
function quoteIdentifier(value: string): string { if (!safeName.test(value)) throw new Error("Unsafe local identifier."); return `"${value}"` }
const betaTables = ["target", "schema_migrations", "baseline_receipts", "tenant_admissions", "invitations", "memberships", "requests", "audit"] as const
const entrypointStart = "-- beta-owner-entrypoints-begin"
const entrypointEnd = "-- beta-owner-entrypoints-end"

function splitMigration(sql: string) {
  const starts = sql.split(entrypointStart)
  if (starts.length !== 2) throw new Error("Beta owner migration boundary is invalid.")
  const ends = starts[1]!.split(entrypointEnd)
  if (ends.length !== 2) throw new Error("Beta owner migration boundary is invalid.")
  return { operatorPrelude: starts[0]!, ownerEntrypoints: ends[0]!, operatorEpilogue: ends[1]! }
}

async function requireInstalledOwnership(db: Pick<WorkspaceConnection, "query">, ownerRole: string, operatorRole: string, runtimeRole: string): Promise<void> {
  const result = await db.query<{ safe: boolean }>(`select
    (select pg_get_userbyid(nspowner)=$1 from pg_namespace where nspname='neuvetra_beta')
    and (select count(*)=8 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra_beta' and c.relkind='r' and pg_get_userbyid(c.relowner)=$1)
    and (select count(*)=8 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra_beta' and c.relkind='r')
    and (select count(*)=5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra_beta')
    and not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='neuvetra_beta' and (
        (p.proname in ('assert_runtime_target','require_identity') and pg_get_userbyid(p.proowner)<>$2)
        or (p.proname in ('redeem_invitation','read_session','read_workspace') and pg_get_userbyid(p.proowner)<>$1)
        or p.proname not in ('assert_runtime_target','require_identity','redeem_invitation','read_session','read_workspace')
      )
    )
    and not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where n.nspname='neuvetra_beta' and a.grantee=0 and a.privilege_type='EXECUTE'
    )
    and (select count(*)=1 from pg_default_acl d join pg_roles r on r.oid=d.defaclrole where r.rolname=$1)
    and exists (
      select 1 from pg_default_acl d join pg_roles r on r.oid=d.defaclrole
      where r.rolname=$1 and d.defaclnamespace=0 and d.defaclobjtype='f'
        and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee=0 and a.privilege_type='EXECUTE')
    )
    and has_function_privilege($1,'neuvetra_beta.assert_runtime_target()','EXECUTE')
    and has_function_privilege($1,'neuvetra_beta.require_identity(text)','EXECUTE')
    and not has_function_privilege($3,'neuvetra_beta.assert_runtime_target()','EXECUTE')
    and not has_function_privilege($3,'neuvetra_beta.require_identity(text)','EXECUTE')
    and (select count(*)=3 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra_beta' and has_function_privilege($3,p.oid,'EXECUTE'))
    and not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='neuvetra_beta' and has_function_privilege($3,p.oid,'EXECUTE')
        and (p.proname,pg_get_function_identity_arguments(p.oid)) not in (('redeem_invitation','token_digest text, request_id uuid, verified_email text'),('read_session',''),('read_workspace','requested_company_id uuid'))
    )
    and not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      join pg_roles grantee on grantee.oid=a.grantee
      where n.nspname='neuvetra_beta' and (
        (p.proname in ('assert_runtime_target','require_identity') and grantee.rolname not in ($1,$2))
        or (p.proname in ('redeem_invitation','read_session','read_workspace') and grantee.rolname not in ($1,$3))
      )
    )
    and not has_schema_privilege($1,'auth','USAGE') and not has_schema_privilege($1,'neuvetra','USAGE')
    and not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('auth','neuvetra') and c.relkind in ('r','p','v','m','f')
        and has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    )
    and not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('auth','neuvetra') and has_function_privilege($1,p.oid,'EXECUTE')
    ) safe`, [ownerRole, operatorRole, runtimeRole])
  if (result.rows.length !== 1 || result.rows[0]?.safe !== true) throw new Error("Beta access ownership or privilege boundary differs.")
}

export interface BetaAccessInstallApproval {
  databaseName: string
  runtimeRole: string
  ownerRole: string
  fixtureManifestSha256: string
  syntheticTargetConfirmed: true
}

/** Explicit local operator action. The application never calls this function. */
export async function installBetaAccess(db: WorkspaceConnection, approval: BetaAccessInstallApproval) {
  if (approval.syntheticTargetConfirmed !== true || !approval.databaseName.startsWith("m80_beta_access_") || !approval.runtimeRole.startsWith("m80_beta_access_runtime_") || !approval.ownerRole.startsWith("m80_beta_access_owner_") || !safeName.test(approval.databaseName) || !safeName.test(approval.runtimeRole) || !safeName.test(approval.ownerRole) || approval.ownerRole === approval.runtimeRole || !/^[0-9a-f]{64}$/.test(approval.fixtureManifestSha256)) throw new Error("Exact synthetic beta target required.")
  const baseline = await readBetaAccessBaselineManifest()
  const module = await readBetaAccessMigrationManifest()
  await db.transaction(async tx => {
    await tx.query("select pg_advisory_xact_lock(802530001)")
    const target = await tx.query<{ database_name: string; current_user: string }>("select current_database() database_name,current_user")
    const operatorRole = target.rows[0]?.current_user
    if (target.rows[0]?.database_name !== approval.databaseName || !operatorRole || operatorRole === approval.runtimeRole || operatorRole === approval.ownerRole) throw new Error("Operator target mismatch.")
    const receipts = await tx.query<{ name: string; sha256: string }>("select name,sha256 from neuvetra.schema_migrations order by name")
    if (receipts.rows.length !== baseline.length || receipts.rows.some((row, index) => row.name !== baseline[index]?.name || row.sha256 !== baseline[index]?.sha256)) throw new Error("Unknown or changed schema 22 baseline.")
    const role = await tx.query<{ runtime_safe: boolean; owner_safe: boolean }>(`select
      exists(select 1 from pg_roles r where r.rolname=$1 and r.rolcanlogin and not r.rolsuper and not r.rolinherit and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and not r.rolbypassrls and not exists(select 1 from pg_auth_members where member=r.oid or roleid=r.oid)) runtime_safe,
      exists(select 1 from pg_roles r where r.rolname=$2 and not r.rolcanlogin and not r.rolsuper and not r.rolinherit and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and not r.rolbypassrls and not exists(select 1 from pg_auth_members where member=r.oid or roleid=r.oid)) owner_safe`, [approval.runtimeRole, approval.ownerRole])
    if (role.rows.length !== 1 || role.rows[0]?.runtime_safe !== true || role.rows[0]?.owner_safe !== true) throw new Error("Restricted beta roles required.")
    const present = await tx.query<{ present: boolean }>("select exists(select 1 from pg_namespace where nspname='neuvetra_beta') present")
    if (!present.rows[0]?.present) {
      const owner = quoteIdentifier(approval.ownerRole)
      const sections = splitMigration(module[0]!.sql)
      await tx.exec(`alter default privileges for role ${owner} revoke execute on functions from public`)
      await tx.exec(sections.operatorPrelude)
      await tx.exec(`alter schema neuvetra_beta owner to ${owner}; ${betaTables.map(name => `alter table neuvetra_beta.${name} owner to ${owner}`).join(";")}; revoke all on function neuvetra_beta.assert_runtime_target(),neuvetra_beta.require_identity(text) from public; grant execute on function neuvetra_beta.assert_runtime_target(),neuvetra_beta.require_identity(text) to ${owner}`)
      await tx.exec(`set local role ${owner}`)
      await tx.exec(sections.ownerEntrypoints)
      await tx.exec("reset role")
      await tx.exec(sections.operatorEpilogue)
      await tx.query("insert into neuvetra_beta.target(profile,database_name,runtime_role,owner_role,operator_role,module_name,module_sha256,fixture_manifest_sha256) values($1,$2,$3,$4,$5,$6,$7,$8)", [BETA_ACCESS_PROFILE, approval.databaseName, approval.runtimeRole, approval.ownerRole, operatorRole, module[0]!.name, module[0]!.sha256, approval.fixtureManifestSha256])
      for (const receipt of baseline) await tx.query("insert into neuvetra_beta.baseline_receipts(name,sha256) values($1,$2)", [receipt.name, receipt.sha256])
      await tx.query("insert into neuvetra_beta.schema_migrations(name,sha256) values($1,$2)", [module[0]!.name, module[0]!.sha256])
      const runtime = quoteIdentifier(approval.runtimeRole)
      await tx.exec(`grant usage on schema neuvetra_beta to ${runtime}; grant execute on function neuvetra_beta.redeem_invitation(text,uuid,text),neuvetra_beta.read_session(),neuvetra_beta.read_workspace(uuid) to ${runtime};`)
    } else {
      const existing = await tx.query<{ profile: string; database_name: string; runtime_role: string; owner_role: string; operator_role: string; module_name: string; module_sha256: string; fixture_manifest_sha256: string }>("select profile,database_name,runtime_role,owner_role,operator_role,module_name,module_sha256,fixture_manifest_sha256 from neuvetra_beta.target")
      const moduleReceipts = await tx.query<{ name: string; sha256: string }>("select name,sha256 from neuvetra_beta.schema_migrations order by name")
      const copiedBaseline = await tx.query<{ name: string; sha256: string }>("select name,sha256 from neuvetra_beta.baseline_receipts order by name")
      const e = existing.rows[0]
      if (existing.rows.length !== 1 || e?.profile !== BETA_ACCESS_PROFILE || e.database_name !== approval.databaseName || e.runtime_role !== approval.runtimeRole || e.owner_role !== approval.ownerRole || e.operator_role !== operatorRole || e.module_name !== module[0]!.name || e.module_sha256 !== module[0]!.sha256 || e.fixture_manifest_sha256 !== approval.fixtureManifestSha256
        || moduleReceipts.rows.length !== 1 || moduleReceipts.rows[0]?.name !== module[0]!.name || moduleReceipts.rows[0]?.sha256 !== module[0]!.sha256
        || copiedBaseline.rows.length !== baseline.length || copiedBaseline.rows.some((row, index) => row.name !== baseline[index]?.name || row.sha256 !== baseline[index]?.sha256)) throw new Error("Unknown or changed beta access module.")
    }
    await requireInstalledOwnership(tx, approval.ownerRole, operatorRole, approval.runtimeRole)
  })
  return { profile: BETA_ACCESS_PROFILE, schemaVersion: BETA_ACCESS_SCHEMA_VERSION, migrations: module.map(({ name, sha256 }) => ({ name, sha256 })) }
}

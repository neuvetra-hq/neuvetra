import type { WorkspaceConnection, WorkspaceSql } from "./workspace"
import { auditLegacyStagingExposure, EXISTING_PROJECT_REF } from "./staging-audit"

export const STAGING_MIGRATIONS = [
  "0001_company_workspace.sql", "0002_synthetic_bill_intake.sql", "0003_synthetic_bill_calculation.sql",
  "0004_inventory_review.sql", "0005_annual_electricity_register.sql", "0006_inventory_evidence_pack.sql",
  "0007_inventory_draft_report.sql", "0008_inventory_draft_report_review.sql", "0009_private_staging.sql", "0010_manual_electricity_worksheet.sql", "0011_worksheet_reports.sql",
] as const

export async function readMigrationManifest() {
  return Promise.all(STAGING_MIGRATIONS.map(async name => {
    const sql = await Bun.file(new URL(`./migrations/${name}`, import.meta.url)).text()
    // Normalize checkout newline differences, preserving every SQL token.
    const canonical = sql.replace(/\r\n/g, "\n")
    return { name, sha256: new Bun.CryptoHasher("sha256").update(canonical).digest("hex"), sql: canonical }
  }))
}

async function validateExisting(tx: WorkspaceSql, expectedProjectRef: string, manifest: Awaited<ReturnType<typeof readMigrationManifest>>) {
  const receipts = await tx.query<{ name: string; sha256: string }>("select name,sha256 from neuvetra.schema_migrations order by name")
  const target = await tx.query<{ project_ref: string; profile: string }>("select project_ref,profile from neuvetra.staging_target")
  if (target.rows.length !== 1 || target.rows[0]?.project_ref !== expectedProjectRef || target.rows[0]?.profile !== "neuvetra.private-synthetic-staging.v1" || receipts.rows.length !== manifest.length || receipts.rows.some((r, i) => r.name !== manifest[i]?.name || r.sha256 !== manifest[i]?.sha256)) throw new Error("Unknown or changed staging migration baseline.")
}

/** Explicit operator call. Requires a reviewed synthetic target; never called by HTTP startup. */
export async function migratePrivateStaging(db: WorkspaceConnection, approval: { expectedProjectRef: string; syntheticTargetConfirmed: true; reuseExistingProject?: boolean }) {
  if (approval.syntheticTargetConfirmed !== true || !/^[a-z]{20}$/.test(approval.expectedProjectRef)) throw new Error("Reviewed synthetic staging target required.")
  if (approval.expectedProjectRef === EXISTING_PROJECT_REF && (approval.reuseExistingProject !== true || !(await auditLegacyStagingExposure(db)).legacyContainmentVerified)) throw new Error("Confirmed existing project reuse and verified legacy containment required.")
  const manifest = await readMigrationManifest()
  await db.transaction(async tx => {
    await tx.query("select pg_advisory_xact_lock(630009)")
    const existing = await tx.query<{ present: boolean }>("select exists(select 1 from pg_namespace where nspname='neuvetra') present")
    if (existing.rows[0]?.present) {
      const receipts = await tx.query<{ name: string; sha256: string }>("select name,sha256 from neuvetra.schema_migrations order by name")
      if (receipts.rows.length !== 9 && receipts.rows.length !== 10 && receipts.rows.length !== manifest.length) throw new Error("Unknown staging migration baseline.")
      await validateExisting(tx, approval.expectedProjectRef, manifest.slice(0,receipts.rows.length))
      for (const migration of manifest.slice(receipts.rows.length)) {
        await tx.exec(migration.sql)
        await tx.query("insert into neuvetra.schema_migrations(name,sha256) values($1,$2)",[migration.name,migration.sha256])
      }
      return
    }
    // Supabase must provide real Auth; no fake users, auth function or role creation here.
    await tx.query("select auth.uid()")
    const auth = await tx.query<{ present: boolean }>("select to_regclass('auth.users') is not null and exists(select 1 from pg_roles where rolname='authenticated') present")
    if (!auth.rows[0]?.present) throw new Error("Real Auth baseline required.")
    for (const migration of manifest) await tx.exec(migration.sql)
    await tx.exec(`create table neuvetra.schema_migrations(name text primary key,sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),applied_at timestamptz not null default now());
      create table neuvetra.staging_target(singleton boolean primary key default true check(singleton),project_ref text not null,profile text not null);
      alter table neuvetra.schema_migrations enable row level security; alter table neuvetra.schema_migrations force row level security;
      alter table neuvetra.staging_target enable row level security; alter table neuvetra.staging_target force row level security;
      create policy m63_receipts_read on neuvetra.schema_migrations for select to neuvetra_runtime using(true);
      create policy m63_target_read on neuvetra.staging_target for select to neuvetra_runtime using(true);
      grant select on neuvetra.schema_migrations,neuvetra.staging_target to neuvetra_runtime;`)
    for (const migration of manifest) await tx.query("insert into neuvetra.schema_migrations(name,sha256) values($1,$2)", [migration.name, migration.sha256])
    await tx.query("insert into neuvetra.staging_target(project_ref,profile) values($1,'neuvetra.private-synthetic-staging.v1')", [approval.expectedProjectRef])
  })
  return { schemaVersion: manifest.length, migrations: manifest.map(({ name, sha256 }) => ({ name, sha256 })) }
}

export interface ApprovedStagingRoster {
  expectedProjectRef: string
  workspaceId: string
  ownerUserId: string
  members: ReadonlyArray<{ userId: string; role: "admin" | "member" }>
}

/** Trusted operator-only provisioning of explicitly approved existing real Auth UUIDs. */
export async function provisionStagingRoster(db: WorkspaceConnection, roster: ApprovedStagingRoster): Promise<{ workspaceId: string }> {
  const ids = [roster.ownerUserId, ...roster.members.map(m => m.userId)]
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuid.test(roster.workspaceId) || ids.some(id => !uuid.test(id)) || new Set(ids).size !== ids.length || roster.members.some(m => !["admin", "member"].includes(m.role))) throw new Error("Explicit distinct approved Auth subjects required.")
  const manifest = await readMigrationManifest()
  await db.transaction(async tx => {
    await tx.query("select pg_advisory_xact_lock(630009)")
    await validateExisting(tx, roster.expectedProjectRef, manifest)
    for (const id of ids) {
      const subject = await tx.query<{ id: string }>("select id from auth.users where id=$1", [id])
      if (subject.rows.length !== 1) throw new Error("Approved subject does not exist in target Auth.")
      const previous = await tx.query<{ company_id: string | null }>("select company_id from neuvetra.staging_access where user_id=$1", [id])
      if (previous.rows.length && previous.rows[0]?.company_id !== roster.workspaceId) throw new Error("Subject already belongs to another staging roster.")
    }
    const existing = await tx.query<{ created_by: string }>("select created_by from neuvetra.companies where id=$1", [roster.workspaceId])
    if (existing.rows.length && existing.rows[0]?.created_by !== roster.ownerUserId) throw new Error("Staging workspace owner mismatch.")
    if (!existing.rows.length) {
      await tx.query("insert into neuvetra.staging_access(user_id,active) values($1,true)", [roster.ownerUserId])
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [roster.ownerUserId])
      await tx.query("select neuvetra.create_company_workspace($1,'Synthetic Acme, Inc.',$2,'Synthetic California office',$3,2023,$4)", [roster.workspaceId, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()])
    }
    // Exact replacement revokes absent users for this workspace; no stale JWT override.
    await tx.query("update neuvetra.staging_access set active=false where company_id=$1", [roster.workspaceId])
    for (const member of [{ userId: roster.ownerUserId, role: "owner" }, ...roster.members]) {
      await tx.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,$3) on conflict(company_id,user_id) do update set role=excluded.role", [roster.workspaceId, member.userId, member.role])
      await tx.query("insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true) on conflict(user_id) do update set company_id=excluded.company_id,active=true,approved_at=now()", [member.userId, roster.workspaceId])
    }
  })
  return { workspaceId: roster.workspaceId }
}

/** Explicit revocation is independent of Auth JWT lifetime and preserves domain history. */
export async function revokeStagingAccess(db: WorkspaceConnection, userId: string): Promise<void> {
  await db.query("update neuvetra.staging_access set active=false where user_id=$1", [userId])
}


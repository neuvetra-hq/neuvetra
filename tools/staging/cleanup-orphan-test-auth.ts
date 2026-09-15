/**
 * Explicit operator helper. Imports perform no IO or authentication.
 * Feed the CURRENT decrypted provisioning configuration through stdin only.
 * Set M63_CLEANUP_EXPORT_PATH to the explicitly approved credential export.
 * Default: read-only discovery, emitting only status, candidate UUIDs and count.
 * After reviewing that output, set M63_CLEANUP_EXECUTE_BAN=confirmed and
 * M63_CLEANUP_REVIEWED_IDS to its exact JSON UUID array. No deletion is supported.
 * Ban API: https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
 * A separately authorized admin can reverse a ban with ban_duration="none".
 */
import { extractDatabaseUrl } from "../cloud/database-inventory"
import { fileURLToPath } from "node:url"
import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import { loadStagingDatabaseCa } from "../../packages/neuvetra-database/src/staging-tls"
import { REVIEWED_APPLICATION_SCHEMAS, SUPABASE_MANAGED_SCHEMAS } from "../../packages/neuvetra-database/src/staging-audit"
import type { WorkspaceConnection, WorkspaceSql } from "../../packages/neuvetra-database/src/workspace"

const REF = "icockcoguyadhryzydvl"
const AUTH = `https://${REF}.supabase.co`
const PROFILE = "neuvetra.private-synthetic-staging.v1"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const EMAIL = /^m63-([0-9a-z]+)-(manager1|manager2|member|outsider)@example\.invalid$/
const ROLES = ["manager1", "manager2", "member", "outsider"]
type Subject = { id: string; email: string; raw_app_meta_data: { neuvetra_m63_synthetic?: unknown } | null; created_at: string; last_sign_in_at: string | null; banned_until: string | null }
type Configuration = { ownerId: string; workspaceId: string; accounts: { id: string; email: string; role: string }[] }
type ForeignKey = { schema_name: string; table_name: string; column_name: string; key_count: number; target_column: string }
function valid(value: unknown): asserts value { if (!value) throw new Error("Cleanup validation failed.") }
function uuid(value: unknown): string { valid(typeof value === "string" && UUID.test(value)); return value }
function stamp(email: string): number {
  const match = EMAIL.exec(email)
  valid(match)
  const value = Number.parseInt(match[1]!, 36)
  valid(Number.isSafeInteger(value) && value > 0 && value.toString(36) === match[1] && value <= Date.now())
  return value
}
export function parseCleanupConfiguration(value: unknown): Configuration {
  const input = value as any
  valid(input?.env?.SUPABASE_URL === AUTH && input.env.NEUVETRA_STAGING_PROJECT_REF === REF && input.roster?.expectedProjectRef === REF)
  valid(Array.isArray(input.accounts) && input.accounts.length === 4)
  const accounts = input.accounts.map((account: any) => {
    valid(typeof account.email === "string" && EMAIL.exec(account.email)?.[2] === account.role && ROLES.includes(account.role))
    stamp(account.email)
    return { id: uuid(account.id), email: account.email, role: account.role }
  }) as Configuration["accounts"]
  const ownerId = uuid(input.roster.ownerUserId), workspaceId = uuid(input.roster.workspaceId)
  valid(new Set(accounts.map(account => account.role)).size === 4 && new Set([ownerId, ...accounts.map(account => account.id)]).size === 5)
  valid(new Set(accounts.map(account => stamp(account.email))).size === 1)
  return { ownerId, workspaceId, accounts }
}
/** Exact generated QA identities only, created before the protected current batch. */
export function isOrphanCandidate(subject: Subject, configuration: Configuration): boolean {
  try {
    if (!UUID.test(subject.id) || subject.id === configuration.ownerId || configuration.accounts.some(account => account.id === subject.id)) return false
    if (subject.raw_app_meta_data?.neuvetra_m63_synthetic !== true || !EMAIL.test(subject.email) || subject.last_sign_in_at !== null) return false
    if (subject.banned_until && Date.parse(subject.banned_until) > Date.now()) return false
    const generatedAt = stamp(subject.email), createdAt = Date.parse(subject.created_at)
    return Number.isFinite(createdAt) && Math.abs(createdAt - generatedAt) <= 3_600_000 && generatedAt < stamp(configuration.accounts[0]!.email)
  } catch { return false }
}
export function extractCleanupServiceKey(raw: string): string {
  valid(Buffer.byteLength(raw) <= 1_048_576)
  const values = raw.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*(?:export\s+)?SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*?)\s*$/) ?? line.match(/^\s*"SUPABASE_SERVICE_ROLE_KEY"\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/)
    if (!match) return []
    const value = match[1]!
    return [value.startsWith('"') ? JSON.parse(value) : value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1) : value]
  })
  valid(values.length === 1 && typeof values[0] === "string" && values[0].length <= 8192)
  if (/^sb_secret_[A-Za-z0-9_-]{20,200}$/.test(values[0])) return values[0]
  const parts = values[0].split(".")
  const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8"))
  valid(parts.length === 3 && payload.role === "service_role" && (payload.ref === REF || (payload.ref === undefined && payload.iss === "supabase")))
  return values[0]
}
async function verifyTargetAndProtectedAccounts(tx: WorkspaceSql, config: Configuration) {
  // Bypass RLS is required for this operator inventory: hidden rows cannot prove absence.
  // pg_stat_ssl describes the pooler-to-database connection, not our verified
  // client-to-pooler TLS connection. The operator driver enforces CA/hostname TLS.
  const session = await tx.query<{ safe: boolean }>("select current_database()='postgres' and (r.rolsuper or r.rolbypassrls) and current_setting('transaction_read_only')='on' safe from pg_roles r where r.rolname=current_user")
  valid(session.rows.length === 1 && session.rows[0]!.safe === true)
  const target = await tx.query<{ project_ref: string; profile: string }>("select project_ref,profile from neuvetra.staging_target")
  valid(target.rows.length === 1 && target.rows[0]!.project_ref === REF && target.rows[0]!.profile === PROFILE)
  const workspace = await tx.query<{ created_by: string }>("select created_by from neuvetra.companies where id=$1", [config.workspaceId])
  valid(workspace.rows.length === 1 && workspace.rows[0]!.created_by === config.ownerId)
  const subjects = await tx.query<Subject>("select id,email,raw_app_meta_data,created_at,last_sign_in_at,banned_until from auth.users where id=any($1::uuid[])", [[config.ownerId, ...config.accounts.map(account => account.id)]])
  valid(subjects.rows.length === 5)
  for (const account of config.accounts) {
    const found = subjects.rows.find(subject => subject.id === account.id)
    valid(found?.email === account.email && found.raw_app_meta_data?.neuvetra_m63_synthetic === true)
  }
  const roster = await tx.query<{ user_id: string; active: boolean; company_id: string; role: string }>("select a.user_id,a.active,a.company_id,m.role from neuvetra.staging_access a left join neuvetra.company_members m on m.user_id=a.user_id and m.company_id=a.company_id where a.user_id=any($1::uuid[])", [[config.ownerId, ...config.accounts.map(account => account.id)]])
  valid(roster.rows.length === 4)
  for (const account of [{ id: config.ownerId, role: "owner" }, ...config.accounts.filter(account => account.role !== "outsider")]) {
    const found = roster.rows.find(row => row.user_id === account.id)
    valid(found?.active === true && found.company_id === config.workspaceId && found.role === (account.role === "owner" ? "owner" : account.role === "member" ? "member" : "admin"))
  }
}
async function candidates(tx: WorkspaceSql, config: Configuration): Promise<string[]> {
  const inventory = await tx.query<{ schema_name: string }>("select nspname schema_name from pg_namespace where nspname !~ '^pg_' and nspname <> 'information_schema' order by nspname")
  const managed = new Set<string>(SUPABASE_MANAGED_SCHEMAS), reviewed = new Set<string>(REVIEWED_APPLICATION_SCHEMAS)
  const applicationSchemas = inventory.rows.filter(row => !managed.has(row.schema_name)).map(row => row.schema_name)
  valid(applicationSchemas.includes("neuvetra") && applicationSchemas.every(schema => reviewed.has(schema)))
  const subjects = await tx.query<Subject>("select id,email,raw_app_meta_data,created_at,last_sign_in_at,banned_until from auth.users where raw_app_meta_data->'neuvetra_m63_synthetic'='true'::jsonb and email ~ '^m63-[0-9a-z]+-(manager1|manager2|member|outsider)@example[.]invalid$' order by id limit 101")
  valid(subjects.rows.length <= 100)
  const possible = subjects.rows.filter(subject => isOrphanCandidate(subject, config)).map(subject => subject.id).sort()
  const keys = await tx.query<ForeignKey>(`select n.nspname schema_name,c.relname table_name,a.attname column_name,cardinality(k.conkey) key_count,ra.attname target_column
    from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1]
    join pg_attribute ra on ra.attrelid=k.confrelid and ra.attnum=k.confkey[1]
    where k.contype='f' and n.nspname=any($1::text[]) and k.confrelid='auth.users'::regclass order by n.nspname,c.relname,a.attname`, [applicationSchemas])
  valid(keys.rows.length > 0 && keys.rows.length <= 100)
  for (const expected of ["staging_access.user_id", "company_members.user_id", "companies.created_by"]) valid(keys.rows.some(key => key.schema_name === "neuvetra" && `${key.table_name}.${key.column_name}` === expected))
  const referenced = new Set<string>()
  for (const key of keys.rows) {
    valid(key.key_count === 1 && key.target_column === "id" && applicationSchemas.includes(key.schema_name) && /^[a-z_][a-z0-9_]*$/.test(key.schema_name) && /^[a-z_][a-z0-9_]*$/.test(key.table_name) && /^[a-z_][a-z0-9_]*$/.test(key.column_name))
    if (!possible.length) continue
    const result = await tx.query<{ id: string }>(`select distinct "${key.column_name}"::text id from "${key.schema_name}"."${key.table_name}" where "${key.column_name}"=any($1::uuid[])`, [possible])
    for (const row of result.rows) referenced.add(row.id)
  }
  return possible.filter(id => !referenced.has(id))
}

export async function cleanupOrphanTestAuth(db: WorkspaceConnection, config: Configuration, key: string, reviewedIds: string[] | null, transport: typeof fetch = fetch) {
  let stage = "target_and_protected_accounts", httpStatus: number | null = null
  let uncertainId: string | null = null
  const bannedIds: string[] = []
  try {
    const result = await db.transaction(async tx => {
      await tx.query("set transaction read only")
      // Serializes with the only approved roster provisioning path; no row locks
      // on auth.users are held across Auth requests, avoiding provider deadlocks.
      await tx.query("select pg_advisory_xact_lock(630009)")
      await verifyTargetAndProtectedAccounts(tx, config)
      stage = "orphan_discovery"
      const ids = await candidates(tx, config)
      if (reviewedIds === null) return { status: "dry_run", count: ids.length, ids }
      stage = "reviewed_ids_validation"
      valid(reviewedIds.length > 0 && reviewedIds.length <= 100 && reviewedIds.every(id => UUID.test(id)) && new Set(reviewedIds).size === reviewedIds.length)
      valid(JSON.stringify([...reviewedIds].sort()) === JSON.stringify(ids))
      for (const id of ids) {
        stage = "pre_ban_recheck"; httpStatus = null
        await verifyTargetAndProtectedAccounts(tx, config)
        valid((await candidates(tx, config)).includes(id))
        stage = "ban_orphan"
        uncertainId = id
        const response = await transport(`${AUTH}/auth/v1/admin/users/${id}`, { method: "PUT", redirect: "error", signal: AbortSignal.timeout(15_000), headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ ban_duration: "876000h" }) })
        httpStatus = response.status
        valid(response.status === 200)
        const updated = await response.json() as { id?: unknown; banned_until?: unknown }
        valid(updated.id === id && typeof updated.banned_until === "string" && Date.parse(updated.banned_until) > Date.now())
        bannedIds.push(id)
        uncertainId = null
      }
      return { status: "orphan_accounts_banned", count: bannedIds.length, ids: bannedIds }
    })
    return result
  } catch {
    // Auth changes do not roll back with this read-only SQL transaction.
    return { status: "cleanup_failed", stage, httpStatus, count: bannedIds.length, ids: bannedIds, uncertainIds: uncertainId ? [uncertainId] : [] }
  }
}

if (import.meta.main) {
  let db: WorkspaceConnection | undefined, stage = "input_validation"
  try {
    const text = await Bun.stdin.text(); valid(Buffer.byteLength(text) <= 128_000)
    const config = parseCleanupConfiguration(JSON.parse(text))
    const source = process.env.M63_CLEANUP_EXPORT_PATH
    valid(typeof source === "string" && source.length > 0)
    const execute = process.env.M63_CLEANUP_EXECUTE_BAN
    valid(execute === undefined || execute === "confirmed")
    const reviewed = process.env.M63_CLEANUP_REVIEWED_IDS
    valid(execute === "confirmed" ? typeof reviewed === "string" : reviewed === undefined)
    const reviewedIds: unknown = reviewed === undefined ? null : JSON.parse(reviewed)
    valid(reviewedIds === null || (Array.isArray(reviewedIds) && reviewedIds.every(id => typeof id === "string")))
    stage = "named_export_read"
    const raw = await Bun.file(source).text()
    stage = "service_key_validation"
    const key = extractCleanupServiceKey(raw)
    stage = "database_url_validation"
    const url = new URL(extractDatabaseUrl(raw))
    valid(["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "aws-1-us-west-1.pooler.supabase.com" && url.port === "5432" && url.username === `postgres.${REF}` && Boolean(url.password) && url.pathname === "/postgres" && !url.hash)
    // Match the provisioning parser: ignore export URL options, applying only
    // the fixed driver options below (including strict CA/hostname verification).
    url.search = ""
    stage = "database_connection"
    db = createPostgresConnection(url.toString(), { maxConnections: 1, tlsCaPem: await loadStagingDatabaseCa({ caFile: fileURLToPath(new URL("../cloud/fixtures/supabase-prod-ca-2021.crt", import.meta.url)) }) })
    const result = await cleanupOrphanTestAuth(db, config, key, reviewedIds as string[] | null)
    console.info(JSON.stringify(result))
    if (result.status === "cleanup_failed") process.exitCode = 1
  } catch { console.info(JSON.stringify({ status: "cleanup_failed", stage, httpStatus: null, count: 0, ids: [] })); process.exitCode = 1 }
  finally { try { await db?.close() } catch { /* Never print driver diagnostics. */ } }
}

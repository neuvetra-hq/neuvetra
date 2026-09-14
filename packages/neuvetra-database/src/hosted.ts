import postgres from "postgres"
import { validateDatabaseCaPem } from "./staging-tls"
import { WorkspaceDatabase, type WorkspaceConnection, type WorkspaceSql, type CompanyWorkspaceRecord, type SyntheticWorkspaceInput } from "./workspace"
import { auditLegacyStagingExposure, EXISTING_PROJECT_REF } from "./staging-audit"
import { readMigrationManifest } from "./staging-migrations"

export const STAGING_PROFILE = "neuvetra.private-synthetic-staging.v1" as const
export const STAGING_SCHEMA_VERSION = 9
export interface HostedWorkspaceOptions {
  connectionString: string
  expectedProjectRef: string
  maxConnections?: number
  reuseExistingProject?: boolean
  tlsCaPem?: string
}

/** Parameterized SQL only. No user input may supply SQL text or verified identity. */
function wrapSql(sql: Pick<postgres.Sql, "unsafe">): WorkspaceSql {
  return {
    async query<T>(statement: string, params: unknown[] = []) {
      // bytea uses an explicit Buffer; JSON and numeric text stay untouched.
      const rows = await sql.unsafe<T[]>(statement, params.map(value => value instanceof Uint8Array ? Buffer.from(value) : value) as postgres.ParameterOrJSON<never>[])
      return { rows: Array.from(rows) }
    },
    async exec(statement: string) { await sql.unsafe(statement).simple() },
  }
}

/** Low-level driver shared with explicit operator tooling; never migrates. */
export function createPostgresConnection(connectionString: string, options: { maxConnections?: number; tls?: boolean; tlsCaPem?:string } = {}): WorkspaceConnection {
  const ca = options.tlsCaPem === undefined ? undefined : validateDatabaseCaPem(options.tlsCaPem)
  if(options.tls===false && ca!==undefined) throw new Error("A database CA requires verified TLS.")
  const sql = postgres(connectionString, {
    max: options.maxConnections ?? 4,
    ssl: options.tls === false ? false : { rejectUnauthorized: true, ...(ca===undefined ? {} : {ca}) },
    connect_timeout: 10, idle_timeout: 30, max_lifetime: 300,
    prepare: false,
    onnotice: () => {},
    connection: { application_name: "neuvetra-m63", statement_timeout: 15000, lock_timeout: 5000, idle_in_transaction_session_timeout: 30000, timezone: "UTC" },
  })
  return {
    ...wrapSql(sql),
    async transaction<T>(operation: (tx: WorkspaceSql) => Promise<T>): Promise<T> {
      return await sql.begin(async (tx) => operation(wrapSql(tx))) as T
    },
    async close() { await sql.end({ timeout: 5 }) },
  }
}

export function validateHostedTarget(options: HostedWorkspaceOptions): void {
  let url: URL
  try { url = new URL(options.connectionString) } catch { throw new Error("Invalid staging database target.") }
  const ref = options.expectedProjectRef
  if (ref === EXISTING_PROJECT_REF && options.reuseExistingProject !== true) throw new Error("Explicit existing project reuse confirmation required.")
  const user = decodeURIComponent(url.username)
  const direct = url.hostname === `db.${ref}.supabase.co` && user === "neuvetra_runtime" && (!url.port || url.port === "5432")
  const pooled = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && user === `neuvetra_runtime.${ref}` && (url.port === "5432" || url.port === "6543")
  if (!/^[a-z]{20}$/.test(ref) || !["postgres:", "postgresql:"].includes(url.protocol) || (!direct && !pooled) || !url.password || url.pathname !== "/postgres" || url.search || url.hash || (options.maxConnections !== undefined && (!Number.isInteger(options.maxConnections) || options.maxConnections < 1 || options.maxConnections > 8))) {
    throw new Error("Staging database target must match the isolated Auth project and dedicated runtime login.")
  }
}

function requireSubject(userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error("Verified authentication subject required.")
}

export class HostedWorkspaceDatabase extends WorkspaceDatabase {
  private constructor(db: WorkspaceConnection, private readonly expectedProjectRef: string, private readonly reuseExistingProject = false) { super(db) }

  static async create(options: HostedWorkspaceOptions): Promise<HostedWorkspaceDatabase> {
    validateHostedTarget(options)
    const db = createPostgresConnection(options.connectionString, { maxConnections: options.maxConnections, tlsCaPem:options.tlsCaPem })
    const workspace = new HostedWorkspaceDatabase(db, options.expectedProjectRef, options.reuseExistingProject)
    try { await workspace.checkReadiness(); return workspace } catch { await db.close(); throw new Error("Staging database readiness validation failed.") }
  }

  async checkReadiness(): Promise<{ profile: typeof STAGING_PROFILE; schemaVersion: number; legacyContainmentVerified?: true }> {
    if (this.expectedProjectRef === EXISTING_PROJECT_REF) {
      if (!this.reuseExistingProject || !(await auditLegacyStagingExposure(this.db)).legacyContainmentVerified) throw new Error("Legacy project containment is not verified.")
    }
    const manifest = await readMigrationManifest()
    await this.db.transaction(async tx => {
      const role = await tx.query<{ safe: boolean }>(`select
        current_user='neuvetra_runtime' and session_user='neuvetra_runtime'
        and not r.rolsuper and not r.rolbypassrls and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and not r.rolinherit
        and not exists(select 1 from pg_auth_members where member=r.oid)
        and not exists(select 1 from pg_namespace where nspname='neuvetra' and nspowner=r.oid)
        and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and p.proowner=r.oid)
        and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and (c.relowner=r.oid or (c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity))))
        and not has_schema_privilege(current_user,'neuvetra','CREATE')
        and not has_schema_privilege(current_user,'public','CREATE')
        and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind in('r','p','v','m','f') and has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
        as safe from pg_roles r where r.rolname=current_user`)
      if (role.rows[0]?.safe !== true) throw new Error("Unsafe staging runtime role.")
      const metadata = await tx.query<{ project_ref: string; profile: string }>("select project_ref,profile from neuvetra.staging_target")
      if (metadata.rows.length !== 1 || metadata.rows[0]?.project_ref !== this.expectedProjectRef || metadata.rows[0]?.profile !== STAGING_PROFILE) throw new Error("Staging target mismatch.")
      const receipts = await tx.query<{ name: string; sha256: string }>("select name,sha256 from neuvetra.schema_migrations order by name")
      if (receipts.rows.length !== manifest.length || receipts.rows.some((r, i) => r.name !== manifest[i]?.name || r.sha256 !== manifest[i]?.sha256)) throw new Error("Staging schema receipt mismatch.")
    })
    return { profile: STAGING_PROFILE, schemaVersion: STAGING_SCHEMA_VERSION, ...(this.expectedProjectRef === EXISTING_PROJECT_REF ? {legacyContainmentVerified:true as const} : {}) }
  }

  protected override async asUser<T>(userId: string, operation: (tx: WorkspaceSql) => Promise<T>): Promise<T> {
    requireSubject(userId)
    return this.db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [userId])
      const access = await tx.query<{ allowed: boolean }>("select neuvetra.has_staging_access() allowed")
      if (access.rows[0]?.allowed !== true) throw new Error("Private staging access required.")
      return operation(tx)
    })
  }

  protected override asTrustedUser<T>(userId: string, operation: (tx: WorkspaceSql) => Promise<T>): Promise<T> {
    // Hosted writes use the same non-owner role and per-transaction gate as reads.
    return this.asUser(userId, operation)
  }

  async hasStagingAccess(userId: string): Promise<boolean> {
    requireSubject(userId)
    return this.db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [userId])
      return (await tx.query<{ allowed: boolean }>("select neuvetra.has_staging_access() allowed")).rows[0]?.allowed === true
    })
  }

  async findStagingWorkspaceForUser(userId: string): Promise<{ workspace: CompanyWorkspaceRecord; role: "owner" | "admin" | "member"; evidenceId: string | null } | null> {
    const result = await this.asUser(userId, async tx => {
      const memberships = await tx.query<{ company_id: string; role: "owner" | "admin" | "member" }>("select company_id,role from neuvetra.company_members where user_id=$1", [userId])
      if (memberships.rows.length !== 1) return null
      const member = memberships.rows[0]!
      const evidence = await tx.query<{ id: string }>("select id from neuvetra.bill_evidence where company_id=$1 order by created_at,id limit 1", [member.company_id])
      return { ...member, evidenceId: evidence.rows[0]?.id ?? null }
    })
    if (!result) return null
    const workspace = await this.findWorkspace(userId, result.company_id)
    return workspace ? { workspace, role: result.role, evidenceId: result.evidenceId } : null
  }

  override async createWorkspace(userId: string, _input: SyntheticWorkspaceInput): Promise<CompanyWorkspaceRecord> {
    const current = await this.findStagingWorkspaceForUser(userId)
    if (!current || current.role === "member") throw new Error("Approved staging workspace required.")
    return current.workspace
  }

  override async createWorkspaceWithSyntheticMembers(): Promise<CompanyWorkspaceRecord> {
    throw new Error("Staging memberships require explicit operator provisioning.")
  }
}

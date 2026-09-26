import { Pool, types, type PoolClient, type QueryResult } from "pg"
import { validateDatabaseCaPem } from "./staging-tls"
import { WorkspaceDatabase, type WorkspaceConnection, type WorkspaceSql, type CompanyWorkspaceRecord, type SyntheticWorkspaceInput } from "./workspace"
import { auditLegacyStagingExposure, EXISTING_PROJECT_REF } from "./staging-audit"
import { readMigrationManifest } from "./staging-migrations"

export const STAGING_PROFILE = "neuvetra.private-synthetic-staging.v1" as const
export const STAGING_SCHEMA_VERSION = 23
/** Temporary image-activation bridge for the pinned existing synthetic project; never migrates. */
export const STAGING_SCHEMA_BRIDGE_VERSION = 22
export interface HostedWorkspaceOptions {
  connectionString: string
  expectedProjectRef: string
  maxConnections?: number
  reuseExistingProject?: boolean
  tlsCaPem?: string
}

/** Low-level driver shared with explicit operator tooling; never migrates. */
export function createPostgresConnection(connectionString: string, options: { maxConnections?: number; tls?: boolean; tlsCaPem?:string } = {}): WorkspaceConnection {
  const ca = options.tlsCaPem === undefined ? undefined : validateDatabaseCaPem(options.tlsCaPem)
  if (options.tls === false && ca !== undefined) throw new Error("A database CA requires verified TLS.")
  // pg connection-string SSL fields override its ssl option. Refuse that override
  // rather than allow a URL to weaken certificate/hostname verification.
  const url = new URL(connectionString)
  if ([...url.searchParams.keys()].some(key => /^(ssl|uselibpqcompat)/i.test(key))) throw new Error("Database TLS overrides are forbidden.")
  const pool = new Pool({
    connectionString,
    max: options.maxConnections ?? 4,
    ssl: options.tls === false ? false : { rejectUnauthorized: true, ...(ca === undefined ? {} : { ca }) },
    connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, maxLifetimeSeconds: 300,
    application_name: "neuvetra-m63", statement_timeout: 15000, idle_in_transaction_session_timeout: 30000,
    options: "-c lock_timeout=5000 -c timezone=UTC",
    // Match postgres.js date-only strings; keep native bigint/numeric text,
    // JSON objects, timestamps and bytea without global parser changes.
    types: { getTypeParser: (oid, format) => oid === 1082 && format !== "binary" ? (value: string) => value : types.getTypeParser(oid, format) },
  })
  // Idle client failures are removed by pg-pool. Error listeners never throw or
  // expose server messages/parameters through a process-level uncaught error.
  pool.on("error", () => {})
  pool.on("connect", client => { client.on("error", () => {}) })
  let closing = false
  let closePromise: Promise<void> | undefined
  const active = new Set<() => void>()

  async function acquire() {
    if (closing) throw new Error("Database connection is closed.")
    const client = await pool.connect()
    if (closing) { client.release(true); throw new Error("Database connection is closed.") }
    let failed = false, released = false
    let rejectFailure!: (error: unknown) => void
    const failure = new Promise<never>((_, reject) => { rejectFailure = reject })
    // A fatal event can occur while the caller is in JavaScript, with no SQL await.
    void failure.catch(() => {})
    const fail = (error: unknown) => { failed = true; rejectFailure(error) }
    const onEnd = () => fail(new Error("Database client disconnected."))
    const onClose = () => fail(new Error("Database connection is closed."))
    client.on("error", fail)
    client.on("end", onEnd)
    active.add(onClose)
    return {
      client, failure,
      get failed() { return failed },
      release(destroy: boolean) {
        if (released) return
        released = true
        active.delete(onClose)
        client.removeListener("error", fail)
        client.removeListener("end", onEnd)
        client.release(destroy || failed || closing)
      },
    }
  }
  function query(client: PoolClient, statement: string, params: unknown[] = []) {
    // Explicit Buffer preserves binary parameters; pg preserves JSON and array
    // parameters. A fresh params array also prevents caller mutation of its slots.
    return client.query(statement, params.map(value => value instanceof Uint8Array ? Buffer.from(value) : value))
  }
  function rows<T>(result: QueryResult | QueryResult[]): { rows: T[] } {
    if (Array.isArray(result)) throw new Error("Multiple SQL results require exec().")
    return { rows: result.rows as T[] }
  }
  async function standalone<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const lease = await acquire()
    let succeeded = false
    try {
      const result = await Promise.race([operation(lease.client), lease.failure])
      succeeded = true
      return result
    } finally { lease.release(!succeeded) }
  }
  return {
    query<T>(statement: string, params: unknown[] = []) { return standalone(async client => rows<T>(await query(client, statement, params))) },
    exec(statement: string) { return standalone(async client => { await query(client, statement) }) },
    async transaction<T>(operation: (tx: WorkspaceSql) => Promise<T>): Promise<T> {
      // Exclusive checkout happens BEFORE BEGIN and ends only after confirmed
      // completion. No transaction statement ever uses pool.query().
      const lease = await acquire()
      let usable = true, committed = false, began = false
      let firstError: unknown
      const pending = new Set<Promise<unknown>>()
      const dispatch = <R>(run: () => Promise<R>): Promise<R> => {
        if (!usable || lease.failed || closing) return Promise.reject(new Error("Transaction SQL capability has expired."))
        const promise = run()
        pending.add(promise)
        void promise.then(() => pending.delete(promise), error => { pending.delete(promise); firstError ??= error; usable = false })
        return promise
      }
      const tx: WorkspaceSql = Object.freeze({
        query<R>(statement: string, params: unknown[] = []) { return dispatch(async () => rows<R>(await query(lease.client, statement, params))) },
        exec(statement: string) { return dispatch(async () => { await query(lease.client, statement) }) },
      })
      try {
        await Promise.race([query(lease.client, "BEGIN"), lease.failure])
        began = true
        const value = await Promise.race([Promise.resolve().then(() => operation(tx)), lease.failure])
        // Revoke before draining already-dispatched SQL. A retained callback may
        // finish later, but cannot dispatch onto this or a future tenant's lease.
        usable = false
        await Promise.race([Promise.allSettled([...pending]), lease.failure])
        if (firstError !== undefined) throw firstError
        if (lease.failed || closing) throw new Error("Transaction client is unavailable.")
        const result = await Promise.race([query(lease.client, "COMMIT"), lease.failure])
        if (Array.isArray(result) || result.command !== "COMMIT") throw new Error("Transaction did not commit.")
        committed = true
        return value
      } catch (error) {
        usable = false
        // The original physical client is the only cleanup target. Fatal/close
        // paths destroy it directly; an uncertain COMMIT is never retried.
        if (began && !lease.failed && !closing) {
          try { await Promise.race([query(lease.client, "ROLLBACK"), lease.failure]) } catch {}
        }
        throw error
      } finally {
        usable = false
        // Conservatively destroy on every error, even a successful rollback.
        lease.release(!committed)
      }
    },
    close() {
      if (!closePromise) {
        closing = true
        for (const cancel of active) cancel()
        closePromise = pool.end()
      }
      return closePromise
    },
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

export function validateHostedSchemaReceipts(
  receipts: ReadonlyArray<{ name: string; sha256: string }>,
  manifest: ReadonlyArray<{ name: string; sha256: string }>,
  options: Pick<HostedWorkspaceOptions, "expectedProjectRef" | "reuseExistingProject">,
): number {
  const current = receipts.length === STAGING_SCHEMA_VERSION
  const existingProjectBridge = options.expectedProjectRef === EXISTING_PROJECT_REF
    && options.reuseExistingProject === true
    && receipts.length === STAGING_SCHEMA_BRIDGE_VERSION
  if (manifest.length !== STAGING_SCHEMA_VERSION || (!current && !existingProjectBridge)
    || receipts.some((receipt, index) => receipt.name !== manifest[index]?.name || receipt.sha256 !== manifest[index]?.sha256)) {
    throw new Error("Staging schema receipt mismatch.")
  }
  return receipts.length
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
    const schemaVersion = await this.db.transaction(async tx => {
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
      return validateHostedSchemaReceipts(receipts.rows, manifest, { expectedProjectRef: this.expectedProjectRef, reuseExistingProject: this.reuseExistingProject })
    })
    return { profile: STAGING_PROFILE, schemaVersion, ...(this.expectedProjectRef === EXISTING_PROJECT_REF ? {legacyContainmentVerified:true as const} : {}) }
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

  /** General membership lookup: new companies need no legacy synthetic facility/boundary. */
  async findStagingMembershipForUser(userId: string): Promise<{ companyId: string; role: "owner" | "admin" | "member"; evidenceId: string | null } | null> {
    return this.asUser(userId, async tx => {
      // The membership helper verifies current staging admission. Runtime RLS covers company and evidence rows.
      const result = await tx.query<{ company_id: string; role: "owner" | "admin" | "member"; evidence_id: string | null }>(`select m.company_id,m.role,
        (select e.id from neuvetra.bill_evidence e where e.company_id=m.company_id order by e.created_at,e.id limit 1) evidence_id
        from neuvetra.company_members m join neuvetra.companies c on c.id=m.company_id
        where m.user_id=$1 and neuvetra.is_company_member(m.company_id)`, [userId])
      if (result.rows.length !== 1) return null
      const row=result.rows[0]!
      const locked=await tx.query<{allowed:boolean}>('select neuvetra.m71_lock($1,false) allowed',[row.company_id])
      if(locked.rows[0]?.allowed!==true) return null
      return { companyId: row.company_id, role: row.role, evidenceId: row.evidence_id }
    })
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

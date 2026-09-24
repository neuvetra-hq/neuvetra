import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import {
  HostedWorkspaceDatabase,
  M80_FIXTURE_PROFILE,
  M80_FIXTURE_SHA256,
  M80_FIXTURE_VERSION,
  M80_RUNTIME_PROFILE,
  createM80FixtureSetup,
  createPostgresConnection,
  m80HashCanonical,
  readM80Foundation,
  type M80FoundationView,
  type WorkspaceConnection,
} from "@neuvetra/database"
import { createM80BetaRoutes } from "./m80-beta-routes"

const testUrl = process.env.M80_TEST_DATABASE_URL
if (testUrl) {
  const url = new URL(testUrl)
  if (url.hostname !== "127.0.0.1" || url.port !== "55472" || url.pathname !== "/m80_foundation_author_20260924" || url.username !== "supabase_admin" || url.password || url.search || url.hash) throw new Error("M80 tests require the named disposable loopback clone.")
}
const pg = testUrl ? describe : describe.skip

pg("M80 actual PostgreSQL and HTTP boundary", () => {
  let operator: WorkspaceConnection
  let runtime: WorkspaceConnection
  let anotherRuntime: WorkspaceConnection
  let database: HostedWorkspaceDatabase
  let anotherDatabase: HostedWorkspaceDatabase
  let runtimeConnectionString = ""
  let company = "", owner = "", admin = "", member = ""
  const origin = "http://127.0.0.1:48080"
  const token = (actor: string) => `test-${actor}`
  const construct = (connection: WorkspaceConnection) => new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string, reuse: boolean) => HostedWorkspaceDatabase)(connection, "icockcoguyadhryzydvl", true)
  const post = (actor: string, body: unknown) => new Request(`${origin}/workspace/${company}/scope1-beta-setup`, { method: "POST", headers: { origin, authorization: `Bearer ${token(actor)}` }, body: JSON.stringify(body) })
  const get = (actor: string, suffix = "") => new Request(`${origin}/workspace/${company}/scope1-beta-setup${suffix}`, { headers: { authorization: `Bearer ${token(actor)}` } })
  const input = (expected: M80FoundationView["currentVersion"], key = crypto.randomUUID(), setup = createM80FixtureSetup(company)) => ({
    idempotencyKey: key,
    expectedRevision: expected?.revision ?? 0,
    expectedVersionId: expected?.id ?? null,
    expectedVersionSha256: expected?.versionSha256 ?? null,
    correctionReason: expected ? "synthetic_fact_correction" : null,
    setup,
  })
  const routeFor = (db: HostedWorkspaceDatabase) => createM80BetaRoutes({ database: db, origin, validateUser: async value => {
    const id = value.startsWith("test-") ? value.slice(5) : ""
    return [owner, admin, member].includes(id) ? { id, email: null, phone: null, fullName: null } : null
  } })

  beforeAll(async () => {
    operator = createPostgresConnection(testUrl!, { tls: false, maxConnections: 1 })
    const roster = await operator.query<{ company_id: string; user_id: string; role: string }>("select company_id,user_id,role from neuvetra.company_members order by case role when 'owner' then 0 when 'admin' then 1 else 2 end,user_id")
    company = roster.rows[0]!.company_id
    owner = roster.rows.find(row => row.role === "owner")!.user_id
    admin = roster.rows.find(row => row.role === "admin")!.user_id
    member = roster.rows.find(row => row.role === "member")!.user_id
    await operator.query(`insert into neuvetra.scope1_beta_fixture_admissions(company_id,fixture_profile_id,fixture_version,fixture_sha256,active,admitted_by)
      values($1,$2,$3,$4,true,$5) on conflict do nothing`, [company, M80_FIXTURE_PROFILE, M80_FIXTURE_VERSION, M80_FIXTURE_SHA256, owner])
    const runtimeUrl = new URL(testUrl!); runtimeUrl.username = "neuvetra_runtime"; runtimeConnectionString = runtimeUrl.toString()
    runtime = createPostgresConnection(runtimeConnectionString, { tls: false, maxConnections: 2 })
    anotherRuntime = createPostgresConnection(runtimeConnectionString, { tls: false, maxConnections: 2 })
    database = construct(runtime)
    anotherDatabase = construct(anotherRuntime)
  }, 30_000)

  afterAll(async () => { await anotherRuntime?.close(); await runtime?.close(); await operator?.close() })

  test("upgrades the exact schema-21 clone and exposes four held profiles without calculation output", async () => {
    expect(await database.checkReadiness()).toMatchObject({ schemaVersion: 22 })
    const tables = await operator.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(`select c.relname,c.relrowsecurity,c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='neuvetra' and c.relname=any($1::text[]) order by c.relname`, [[
      "scope1_beta_audit", "scope1_beta_fixture_admissions", "scope1_beta_release_records",
      "scope1_beta_requests", "scope1_beta_setup_heads", "scope1_beta_setup_versions",
    ]])
    expect(tables.rows).toHaveLength(6)
    expect(tables.rows.every(row => row.relrowsecurity && row.relforcerowsecurity)).toBe(true)
    const runtimePrivileges = await operator.query<{ table_name: string; privilege_type: string }>(`select table_name,privilege_type from information_schema.role_table_grants
      where grantee='neuvetra_runtime' and table_schema='neuvetra' and table_name like 'scope1_beta_%' order by table_name,privilege_type`)
    expect(runtimePrivileges.rows).toEqual(tables.rows.map(row => ({ table_name: row.relname, privilege_type: "SELECT" })))
    const directPrivileges = await operator.query<{ insert_allowed: boolean; update_allowed: boolean; delete_allowed: boolean; sequence_allowed: boolean }>(`select
      has_table_privilege('neuvetra_runtime','neuvetra.scope1_beta_setup_versions','insert') insert_allowed,
      has_table_privilege('neuvetra_runtime','neuvetra.scope1_beta_setup_versions','update') update_allowed,
      has_table_privilege('neuvetra_runtime','neuvetra.scope1_beta_setup_versions','delete') delete_allowed,
      has_sequence_privilege('neuvetra_runtime','neuvetra.scope1_beta_audit_sequence_seq','usage') sequence_allowed`)
    expect(directPrivileges.rows[0]).toEqual({ insert_allowed: false, update_allowed: false, delete_allowed: false, sequence_allowed: false })
    const ownerView = await database.findM80Foundation(owner, company)
    const memberView = await database.findM80Foundation(member, company)
    expect(ownerView?.canManage).toBe(true)
    expect(memberView?.canManage).toBe(false)
    expect(ownerView?.releaseRegistry).toHaveLength(4)
    expect(ownerView?.releaseRegistry.every(row => row.status === "held_candidate")).toBe(true)
    expect(ownerView?.eligibility.releasedSupportedCount).toBe(0)
    expect(JSON.stringify(ownerView)).not.toMatch(/calculation|subtotal|invite|documentBytes|released_supported/)
  })

  test("appends, replays and retrieves immutable history through the actual route", async () => {
    const route = routeFor(database)
    const initial = input(null)
    const created = await route(post(owner, initial))
    expect(created.status).toBe(201)
    const first = await created.json() as any
    expect(first.savedVersion.revision).toBe(1)
    const replay = await route(post(owner, initial))
    expect(replay.status).toBe(200)
    expect((await replay.json() as any).savedVersion.id).toBe(first.savedVersion.id)
    const current = await route(get(member))
    expect(current.status).toBe(200)
    expect((await current.json() as any).canManage).toBe(false)
    const detail = await route(get(member, `/versions/${first.savedVersion.id}`))
    expect(detail.status).toBe(200)
    expect((await detail.json() as any).versionSha256).toBe(first.savedVersion.versionSha256)
    expect((await route(post(member, input(first.foundation.currentVersion)))).status).toBe(403)
  })

  test("preserves predecessor bytes, rejects stale writes and old-key replay returns the original record", async () => {
    const route = routeFor(database)
    const before = await database.findM80Foundation(owner, company)
    const correctionSetup = structuredClone(before!.setup) as any
    delete correctionSetup.fixture
    for (const source of correctionSetup.sources) delete source.sourceIdentitySha256
    correctionSetup.evidenceRequirements[0].state = "synthetic_fixture_reference"
    const correction = input(before!.currentVersion, crypto.randomUUID(), correctionSetup)
    const saved = await route(post(admin, correction))
    expect(saved.status).toBe(201)
    const result = await saved.json() as any
    expect(result.foundation.history).toHaveLength(2)
    const stale = await route(post(owner, input(before!.currentVersion, crypto.randomUUID(), correctionSetup)))
    expect(stale.status).toBe(409)
    const replay = await route(post(admin, correction))
    expect(replay.status).toBe(200)
    expect((await replay.json() as any).savedVersion.id).toBe(result.savedVersion.id)
    const old = await route(get(member, `/versions/${before!.currentVersion!.id}`))
    expect((await old.json() as any).setup.evidenceRequirements[0].state).toBe("missing")
  })

  test("allows only one concurrent successor and denies direct runtime table mutation", async () => {
    const before = await database.findM80Foundation(owner, company)
    const a = structuredClone(before!.setup) as any, b = structuredClone(before!.setup) as any
    for (const value of [a, b]) { delete value.fixture; for (const source of value.sources) delete source.sourceIdentitySha256 }
    a.evidenceRequirements[1].state = "synthetic_fixture_reference"
    b.evidenceRequirements[2].state = "synthetic_fixture_reference"
    const results = await Promise.allSettled([
      database.saveM80Foundation(owner, company, input(before!.currentVersion, crypto.randomUUID(), a)),
      anotherDatabase.saveM80Foundation(owner, company, input(before!.currentVersion, crypto.randomUUID(), b)),
    ])
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1)
    const scoped = (sql: string) => runtime.transaction(async tx => { await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]); return tx.exec(sql) })
    for (const sql of [
      "update neuvetra.scope1_beta_release_records set status='released'",
      "delete from neuvetra.scope1_beta_setup_versions",
      "insert into neuvetra.scope1_beta_audit(id,company_id,record_id,event_type,record_sha256,actor_id,created_at) select gen_random_uuid(),company_id,id,'setup_saved',version_sha256,created_by,created_at from neuvetra.scope1_beta_setup_versions limit 1",
    ]) await expect(scoped(sql)).rejects.toBeTruthy()
  })

  test("the direct database entrypoint accepts one canonical write and rejects malformed setup, request and version metadata", async () => {
    const current = await database.findM80Foundation(owner, company)
    const raw = structuredClone(current!.setup) as any
    delete raw.fixture; for (const source of raw.sources) delete source.sourceIdentitySha256
    const baseRequest = { profile: M80_RUNTIME_PROFILE, idempotencyKey: crypto.randomUUID(), expectedRevision: current!.currentVersion!.revision, expectedVersionId: current!.currentVersion!.id, expectedVersionSha256: current!.currentVersion!.versionSha256, correctionReason: "synthetic_fact_correction" }
    const invoke = async (setup: any, alterRequest?: (value: any) => void, alterVersion?: (value: any) => void, readBack = false) => {
      const direct = createPostgresConnection(runtimeConnectionString, { tls: false, maxConnections: 1 })
      try { return await direct.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
        await tx.exec("set local statement_timeout='2000ms'")
        const request = { ...baseRequest, idempotencyKey: crypto.randomUUID() }
        const body = {
          profile: M80_RUNTIME_PROFILE,
          id: crypto.randomUUID(),
          companyId: company,
          reportingYear: 2025,
          revision: request.expectedRevision + 1,
          previousVersionId: request.expectedVersionId,
          previousVersionSha256: request.expectedVersionSha256,
          fixtureProfileId: M80_FIXTURE_PROFILE,
          fixtureVersion: M80_FIXTURE_VERSION,
          fixtureSha256: M80_FIXTURE_SHA256,
          payloadSha256: m80HashCanonical(setup),
          createdBy: owner,
          createdAt: new Date().toISOString(),
          dataClassification: "synthetic_rehearsal",
          completeness: "incomplete",
          releasedSupportedCount: 0,
        }
        alterRequest?.(request)
        alterVersion?.(body)
        const version = { ...body, versionSha256: m80HashCanonical(body) }
        const result = await tx.query("select * from neuvetra.save_scope1_beta_setup($1,$2::text::jsonb,$3::text::jsonb,$4::text::jsonb)", [company, JSON.stringify(request), JSON.stringify(setup), JSON.stringify(version)])
        if (readBack) {
          expect(result.rows).toHaveLength(1)
          expect((await readM80Foundation(tx, company))?.currentVersion?.id).toBe(body.id)
          throw new Error("M80_POSITIVE_ROLLBACK")
        }
        return result
      }) } finally { await direct.close() }
    }
    await expect(invoke(raw, undefined, undefined, true)).rejects.toThrow("M80_POSITIVE_ROLLBACK")
    const unknown = structuredClone(raw); unknown.releaseEligible = true
    const nullable = structuredClone(raw); nullable.sources[0].knownFacts.fuelOrGas = null
    const duplicate = structuredClone(raw); duplicate.locations[1] = structuredClone(duplicate.locations[0])
    for (const malformed of [unknown, nullable, duplicate]) await expect(invoke(malformed)).rejects.toBeTruthy()
    await expect(invoke(raw, request => { request.profile = null })).rejects.toBeTruthy()
    await expect(invoke(raw, request => { request.expectedRevision = String(request.expectedRevision) })).rejects.toBeTruthy()
    for (const field of ["profile", "fixtureProfileId", "fixtureVersion", "fixtureSha256", "dataClassification", "completeness", "releasedSupportedCount"]) {
      await expect(invoke(raw, undefined, version => { version[field] = null })).rejects.toBeTruthy()
    }
    for (const field of ["reportingYear", "revision", "fixtureVersion", "releasedSupportedCount"]) {
      await expect(invoke(raw, undefined, version => { version[field] = String(version[field]) })).rejects.toBeTruthy()
    }
    await expect(invoke(raw, undefined, version => { version.createdAt = version.createdAt.replace("Z", "+00:00") })).rejects.toBeTruthy()
  }, 20_000)
})

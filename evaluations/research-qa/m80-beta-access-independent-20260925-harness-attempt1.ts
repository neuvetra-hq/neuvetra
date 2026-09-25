/** Independent QA preparation. NO native work without --execute-frozen <snapshot> <sha256>.
 * Exact root-authorized targets only; no existing target reuse, deletion, hosted access or author edits.
 * Provider identity is mocked. Tokens/digests stay in memory and never enter result artifacts.
 */
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "../..")
const PREFIX = "evaluations/research-qa/m80-beta-access-independent-20260925-"
const DB = "m80_beta_access_qa_20260925a"
const RESTORE = "m80_beta_access_restore_qa_20260925a"
const ROLE = "m80_beta_access_runtime_qa_20260925a"
const BASE = "postgres://supabase_admin@127.0.0.1:55472"
const ORIGIN = "http://127.0.0.1:3080"
const DECISION = "M80-BETA-ACCESS-QA-20260925"
const sha = (v: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(v).digest("hex")
const uuid = (kind: string, n: number) => `${kind}000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const identities = Array.from({ length: 8 }, (_, i) => ({ id: uuid("9a", i + 1), email: `qa-${i + 1}@beta.invalid` }))
const fixtureSource = { companies: [uuid("9b", 1), uuid("9b", 2)], identities }
const fixtureHash = sha(JSON.stringify(fixtureSource))
const fixture = {
  sha256: fixtureHash,
  identities: identities.map(x => x.email),
  tenants: fixtureSource.companies.map((companyId, i) => ({ companyId, admissionId: uuid("9c", i + 1), displayLabel: `Synthetic QA ${i + 1}`, fixtureManifestSha256: fixtureHash })),
}
type Check = { id: string; result: "pass" | "fail"; details?: unknown }
const checks: Check[] = []
let phase = "execution_gate"
function check(id: string, condition: unknown, details?: unknown): asserts condition {
  checks.push({ id, result: condition ? "pass" : "fail", ...(details === undefined ? {} : { details }) })
  if (!condition) throw new Error(id)
}
async function verifyFrozen(path: string, expected: string) {
  const candidatePath = resolve(ROOT, path)
  if (!candidatePath.startsWith(ROOT + "\\") && !candidatePath.startsWith(ROOT + "/")) throw new Error("candidate_outside_workspace")
  const bytes = await readFile(candidatePath)
  check("freeze.snapshot", /^[a-f0-9]{64}$/.test(expected) && sha(bytes) === expected)
  const candidate = JSON.parse(bytes.toString("utf8")) as { files: { path: string; sha256: string; text?: string }[] }
  check("freeze.files", Array.isArray(candidate.files) && candidate.files.length > 0)
  for (const entry of candidate.files) {
    const target = resolve(ROOT, entry.path)
    check("freeze.path", target.startsWith(ROOT + "\\") || target.startsWith(ROOT + "/"))
    const current = await readFile(target)
    check(`freeze.${entry.path}`, sha(current) === entry.sha256 && (entry.text === undefined || Buffer.from(entry.text).equals(current)))
  }
  const required = ["apps/site-api/src/beta-access/server.ts", "apps/site-api/src/beta-access/routes.ts", "packages/neuvetra-database/src/beta-access.ts", "packages/neuvetra-database/src/beta-access-migrations.ts", "packages/neuvetra-database/src/beta-access-migrations/0001_access.sql"]
  check("freeze.required_boundaries", required.every(path => candidate.files.some(e => e.path === path)))
}

async function run(snapshot: string, snapshotSha: string) {
  await verifyFrozen(snapshot, snapshotSha)
  const { createPostgresConnection } = await import("../../packages/neuvetra-database/src/hosted")
  const api = await import("../../packages/neuvetra-database/src/beta-access")
  const { installBetaAccess } = await import("../../packages/neuvetra-database/src/beta-access-migrations")
  const { readMigrationManifest } = await import("../../packages/neuvetra-database/src/staging-migrations")
  const { createBetaAccessServer } = await import("../../apps/site-api/src/beta-access/server")
  const { BETA_ACCESS_PROFILE } = await import("../../packages/neuvetra-database/src/beta-access-contract")
  const baseline = await readMigrationManifest()
  check("bootstrap.22_migrations", baseline.length === 22)
  const pins = JSON.parse(await readFile(resolve(ROOT, PREFIX + "baseline-pins.json"), "utf8")) as { files: { path: string; sha256: string }[] }
  for (const file of pins.files) check("bootstrap.baseline_pin." + file.path, sha(await readFile(resolve(ROOT, file.path))) === file.sha256)
  // Strip only the known pre-existing legacy role CREATE. No other global role SQL is authorized.
  const sqls = baseline.map(m => {
    const needle = "create role neuvetra_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;\n"
    const sql = m.name === "0009_private_staging.sql" ? m.sql.replace(needle, "") : m.sql
    check("bootstrap.no_global_roles." + m.name, !/\b(create|alter|drop)\s+(role|user)\b/i.test(sql))
    if (m.name === "0009_private_staging.sql") check("bootstrap.exact_role_removal", m.sql.includes(needle) && sql !== m.sql)
    return sql
  })
  phase = "fresh_target_preflight"
  const cluster = createPostgresConnection(`${BASE}/postgres`, { tls: false, maxConnections: 1 })
  try {
    const targets = await cluster.query("select datname from pg_database where datname=any($1::text[])", [[DB, RESTORE]])
    const role = await cluster.query("select rolname from pg_roles where rolname=$1", [ROLE])
    check("bootstrap.targets_absent", targets.rows.length === 0 && role.rows.length === 0)
    const legacy = await cluster.query("select rolname from pg_roles where rolname in ('authenticated','anon','neuvetra_runtime','supabase_admin')")
    check("bootstrap.existing_roles", legacy.rows.length === 4)
    await cluster.exec(`create role "${ROLE}" login nosuperuser noinherit nocreatedb nocreaterole noreplication nobypassrls`)
    await cluster.exec(`create database "${DB}" owner supabase_admin template template0`)
  } finally { await cluster.close() }
  phase = "fresh_fixture_bootstrap"
  const operator = createPostgresConnection(`${BASE}/${DB}`, { tls: false, maxConnections: 4 })
  const runtimeUrl = `postgres://${ROLE}@127.0.0.1:55472/${DB}`
  let app: Awaited<ReturnType<typeof createBetaAccessServer>> | undefined
  let listener: ReturnType<typeof Bun.serve> | undefined
  const logs: unknown[] = []
  const secrets: string[] = []
  let clock = 0
  let endpoint = ""
  let authHook: (() => Promise<void>) | undefined
  let authCount = 0
  const config = { profile: BETA_ACCESS_PROFILE, origin: ORIGIN, databaseUrl: runtimeUrl, databaseName: DB, runtimeRole: ROLE, port: 3080 }
  const start = async () => {
    app = await createBetaAccessServer(config, { validateIdentity: async token => { authCount++; await authHook?.(); return identities[Number(token.slice(3))] ?? null }, log: e => logs.push(e), now: () => clock })
    // Larger listener bound makes the application's streamed 2 KiB limit observable.
    listener = Bun.serve({ hostname: "127.0.0.1", port: 0, maxRequestBodySize: 8192, fetch: app.fetch })
    endpoint = `http://127.0.0.1:${listener.port}`
  }
  const call = (actor: number, path: string, init: RequestInit = {}) => fetch(endpoint + path, { ...init, headers: { origin: ORIGIN, authorization: `Bearer qa-${actor}`, ...(init.headers ?? {}) } })
  const redeem = (actor: number, token: string, requestId: string = crypto.randomUUID()) => call(actor, "/beta-api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, requestId }) })
  const issue = async (actor: number, company = 0) => {
    const value = await api.issueBetaInvitation(operator, fixture, { companyId: fixture.tenants[company]!.companyId, recipientEmail: identities[actor]!.email, role: "member", decisionReference: DECISION })
    secrets.push(value.token, sha(value.token)); return value
  }
  const state = async () => (await operator.query("select jsonb_build_object('members',(select coalesce(jsonb_agg(to_jsonb(x) order by company_id,user_id),'[]') from neuvetra_beta.memberships x),'invitations',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from neuvetra_beta.invitations x),'requests',(select coalesce(jsonb_agg(to_jsonb(x) order by actor_id,request_id),'[]') from neuvetra_beta.requests x),'audit',(select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from neuvetra_beta.audit x))::text state")).rows
  const expired = (id: string) => operator.query("update neuvetra_beta.invitations set issued_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day' where id=$1", [id])
  try {
    await operator.transaction(async tx => {
      await tx.exec("create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; revoke all on schema auth from public; revoke all on table auth.users from public; revoke all on function auth.uid() from public; grant usage on schema auth to authenticated,neuvetra_runtime; grant execute on function auth.uid() to authenticated,neuvetra_runtime;")
      for (const sql of sqls) await tx.exec(sql)
      await tx.exec("create table neuvetra.schema_migrations(name text primary key,sha256 text not null,applied_at timestamptz not null default now()); create table neuvetra.staging_target(singleton boolean primary key default true check(singleton),project_ref text not null,profile text not null); alter table neuvetra.schema_migrations enable row level security; alter table neuvetra.schema_migrations force row level security; alter table neuvetra.staging_target enable row level security; alter table neuvetra.staging_target force row level security; create policy m63_receipts_read on neuvetra.schema_migrations for select to neuvetra_runtime using(true); create policy m63_target_read on neuvetra.staging_target for select to neuvetra_runtime using(true); grant select on neuvetra.schema_migrations,neuvetra.staging_target to neuvetra_runtime;")
      for (const m of baseline) await tx.query("insert into neuvetra.schema_migrations(name,sha256) values($1,$2)", [m.name, m.sha256])
      await tx.exec("insert into neuvetra.staging_target(project_ref,profile) values('m80independentqafixture','neuvetra.private-synthetic-staging.v1')")
      for (const identity of identities) await tx.query("insert into auth.users values($1,$2,clock_timestamp())", [identity.id, identity.email])
      for (const tenant of fixture.tenants) await tx.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,$2,'US','CA',$3)", [tenant.companyId, tenant.displayLabel, identities[0]!.id])
    })
    const approval = { databaseName: DB, runtimeRole: ROLE, fixtureManifestSha256: fixtureHash, syntheticTargetConfirmed: true as const }
    await installBetaAccess(operator, approval)
    await installBetaAccess(operator, approval)
    for (const tenant of fixture.tenants) await api.admitBetaTenant(operator, fixture, tenant, DECISION)
    await start()

    phase = "Q02_receipt_expiry_restart"
    const a = await issue(0), requestA = crypto.randomUUID()
    const first = await redeem(0, a.token, requestA)
    check("Q02.first201", first.status === 201)
    const receipt = await first.text()
    await expired(a.invitationId)
    const beforeReplay = JSON.stringify(await state())
    await listener!.stop(true); await app!.close(); await start()
    const replay = await redeem(0, a.token, requestA)
    check("Q02.expired_restart_replay", replay.status === 200 && await replay.text() === receipt)
    check("Q02.no_mutation", JSON.stringify(await state()) === beforeReplay)
    check("Q02.consumed_different_key", (await redeem(0, a.token)).status === 404)
    check("Q02.same_key_other_input", (await redeem(0, "f".repeat(64), requestA)).status === 409)

    phase = "Q01_db_identity_changes"
    const b = await issue(1, 1)
    authHook = async () => { authHook = undefined; await operator.query("update auth.users set email_confirmed_at=null where id=$1", [identities[1]!.id]) }
    const prior = JSON.stringify(await state())
    check("Q01.confirmation_changed_after_provider", (await redeem(1, b.token)).status === 404)
    check("Q01.no_partial_effects", JSON.stringify(await state()) === prior)
    await operator.query("update auth.users set email_confirmed_at=clock_timestamp(),email='changed@beta.invalid' where id=$1", [identities[1]!.id])
    check("Q01.current_email_mismatch", (await redeem(1, b.token)).status === 404)
    await operator.query("update auth.users set email=$1 where id=$2", [identities[1]!.email, identities[1]!.id])
    const rb = crypto.randomUUID()
    const twins = await Promise.all([redeem(1, b.token, rb), redeem(1, b.token, rb)])
    check("Q04.same_key_race", twins.map(r => r.status).sort().join() === "200,201")
    const bodies = await Promise.all(twins.map(r => r.text()))
    check("Q04.same_immutable_receipt", bodies[0] === bodies[1])

    phase = "Q05_write_rollback"
    clock += 60_001
    const c = await issue(2)
    for (const [table, event] of [["memberships", "insert"], ["invitations", "update"], ["requests", "insert"], ["audit", "insert"]] as const) {
      await operator.exec(`create function neuvetra_beta.qa_fault() returns trigger language plpgsql as $$begin raise exception 'qa injected'; end$$; revoke all on function neuvetra_beta.qa_fault() from public; create trigger qa_fault after ${event} on neuvetra_beta.${table} for each row execute function neuvetra_beta.qa_fault()`)
      const ready = await api.BetaAccessDatabase.create({ connectionString: runtimeUrl, databaseName: DB, runtimeRole: ROLE })
      await ready.close()
      const before = JSON.stringify(await state())
      const response = await redeem(2, c.token)
      await operator.exec(`drop trigger qa_fault on neuvetra_beta.${table}; drop function neuvetra_beta.qa_fault()`)
      check("Q05.failure." + table, response.status === 503)
      check("Q05.rollback." + table, JSON.stringify(await state()) === before)
    }
    check("Q05.token_still_usable", (await redeem(2, c.token)).status === 201)

    phase = "Q03_generation_and_tenant_fences"
    clock += 60_001
    await operator.query("update neuvetra_beta.memberships set generation=generation+1 where user_id=$1", [identities[0]!.id])
    check("Q03.generation_replay_denied", (await redeem(0, a.token, requestA)).status === 404)
    await api.revokeBetaMembership(operator, fixture.tenants[0]!.companyId, identities[0]!.id, DECISION)
    check("Q03.revocation_replay_denied", (await redeem(0, a.token, requestA)).status === 404)
    check("Q06.cross_tenant", (await call(1, `/beta-api/workspaces/${fixture.tenants[0]!.companyId}`)).status === 404)
    await api.disableBetaAdmission(operator, fixture.tenants[0]!.companyId, DECISION, true)
    check("Q03.tombstone_other_member", (await call(2, `/beta-api/workspaces/${fixture.tenants[0]!.companyId}`)).status === 404)
    let refused = false
    try { await issue(3) } catch { refused = true }
    check("Q03.tombstone_issue_refused", refused)
    await operator.query("update neuvetra_beta.tenant_admissions set fixture_manifest_sha256=$1 where company_id=$2", ["0".repeat(64), fixture.tenants[1]!.companyId])
    check("Q03.hash_tamper_read", (await call(1, `/beta-api/workspaces/${fixture.tenants[1]!.companyId}`)).status === 404)
    check("Q03.hash_tamper_replay", (await redeem(1, b.token, rb)).status === 404)
    await operator.query("update neuvetra_beta.tenant_admissions set fixture_manifest_sha256=$1 where company_id=$2", [fixtureHash, fixture.tenants[1]!.companyId])

    phase = "Q07_native_privileges"
    const native = createPostgresConnection(runtimeUrl, { tls: false, maxConnections: 1 })
    try {
      for (const [id, sql] of [
        ["invitation_authority", "select token_digest,recipient_email from neuvetra_beta.invitations"],
        ["auth_users", "select email from auth.users"],
        ["direct_insert", "insert into neuvetra_beta.audit default values"],
        ["old_helper", "select neuvetra.current_user_id()"],
        ["schema_create", "create table neuvetra_beta.qa_unauthorized(id int)"],
        ["set_owner", "set role supabase_admin"],
      ]) {
        let denied = false
        try { await native.exec(sql!) } catch { denied = true }
        check("Q07.denied." + id, denied)
      }
      const callable = await native.query<{ name: string }>("select p.proname name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra_beta' and has_function_privilege(current_user,p.oid,'EXECUTE') order by 1")
      check("Q07.only_three_entrypoints", callable.rows.map(r => r.name).join() === "read_session,read_workspace,redeem_invitation")
      const rls = await native.query<{ safe: boolean }>("select bool_and(c.relrowsecurity and c.relforcerowsecurity) safe from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra_beta' and c.relkind='r'")
      check("Q07.force_rls", rls.rows[0]?.safe === true)
    } finally { await native.close() }

    phase = "Q08_http_parser_and_limits"
    clock += 60_001
    const blank = "0".repeat(64), key = crypto.randomUUID()
    const duplicate = `{"token":"${blank}","requestId":"${key}","to\\u006ben":"${blank}"}`
    check("Q08.escaped_duplicate", (await call(4, "/beta-api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: duplicate })).status === 422)
    const raw = JSON.stringify({ token: blank, requestId: key })
    for (const size of [2048, 2049]) {
      const bytes = new TextEncoder().encode(raw + " ".repeat(size - raw.length))
      const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes.slice(0, 1000)); controller.enqueue(bytes.slice(1000)); controller.close() } })
      const response = await call(4, "/beta-api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit)
      check("Q08.stream_bytes." + size, response.status === (size === 2048 ? 404 : 413))
      check("Q08.failure_headers." + size, response.headers.get("cache-control") === "no-store" && response.headers.get("x-content-type-options") === "nosniff")
    }
    const forbidden = await call(4, "/beta-api/session", { headers: { origin: ORIGIN + ".invalid" } })
    check("Q08.origin", forbidden.status === 403)
    clock += 60_001
    const initialAuth = authCount
    for (let i = 0; i < 61; i++) {
      const response = await call(4, "/beta-api/session", { headers: { "x-forwarded-for": `192.0.2.${i}` } })
      check("Q08.global_before_auth." + i, response.status === (i < 60 ? 200 : 429))
    }
    check("Q08.auth_call_bound", authCount - initialAuth === 60)
    const logText = JSON.stringify(logs)
    check("Q08.no_sensitive_logs", !secrets.some(s => logText.includes(s)) && !identities.some(i => logText.includes(i.email)))
    phase = "post_execution_source_check"
    await verifyFrozen(snapshot, snapshotSha)
  } finally {
    await listener?.stop(true); await app?.close(); await operator.close()
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args[0] !== "--execute-frozen" || args.length !== 3) {
    console.info(JSON.stringify({ status: "prepared_not_executed", targets: { database: DB, restore: RESTORE, role: ROLE }, instruction: "Await root frozen snapshot and SHA256. No native connection attempted." }))
  } else {
    let verdict = "pass_executed_subset"
    try { await run(args[1]!, args[2]!) } catch { verdict = "fail_preserved" }
    const result = { task: DECISION, verdict, phase, checks, nativeTargets: { database: DB, restore: RESTORE, role: ROLE }, identityProvider: "mocked_getUser_response", frozenSnapshot: args[1], frozenSha256: args[2], actualCostUsd: null, limitations: ["Provisional prepared subset; Q04 ordered expiry/revocation races, Q09 complete catalog parity and Q10 native restore require additional review checks.", "No provider or customer-readiness verdict."] }
    const path = resolve(ROOT, PREFIX + `result-${Date.now()}.json`)
    await writeFile(path, JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
    console.info(JSON.stringify({ verdict, phase, checkCount: checks.length, resultPath: path }))
    if (verdict !== "pass_executed_subset") process.exitCode = 1
  }
}

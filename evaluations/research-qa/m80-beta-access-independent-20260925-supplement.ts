/** Candidate1 supplemental challenges; only the QA-created b fixture and new exact b restore. */
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import * as api from "../../packages/neuvetra-database/src/beta-access"
import { createBetaAccessServer, createBetaRateLimiter } from "../../apps/site-api/src/beta-access/server"
const root = resolve(import.meta.dir, "../..")
const prefix = "evaluations/research-qa/m80-beta-access-independent-20260925-"
const db = "m80_beta_access_qa_20260925b", restored = "m80_beta_access_restore_qa_20260925b", role = "m80_beta_access_runtime_qa_20260925b"
const expectedSha = "5385252e78342ddf3152060c5b6d12e16023f6f911e12f4a5325f8d1a3686cd5"
const snapshot = "operations/agent-improvement/snapshots/M80-BETA-ACCESS-IMPLEMENTATION-20260925-CANDIDATE1.json"
const hash = (v: Uint8Array | string) => new Bun.CryptoHasher("sha256").update(v).digest("hex")
const uuid = (kind: string, n: number) => `${kind}000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const users = Array.from({ length: 8 }, (_, i) => ({ id: uuid("9a", i + 1), email: `qa-${i + 1}@beta.invalid` }))
const tenants = [0, 1].map(i => ({ companyId: uuid("9b", i + 1), admissionId: uuid("9c", i + 1), displayLabel: `Synthetic QA ${i + 1}`, fixtureManifestSha256: "" }))
const manifest = { sha256: "", identities: users.map(u => u.email), tenants }
manifest.sha256 = api.syntheticBetaFixtureManifestSha256(manifest)
tenants.forEach(t => t.fixtureManifestSha256 = manifest.sha256)
const checks: { id: string; pass: boolean; details?: unknown }[] = []
const details: Record<string, unknown> = {}
let phase = "gate", completed = false
function check(id: string, pass: boolean, evidence?: unknown) { checks.push({ id, pass, ...(evidence === undefined ? {} : { details: evidence }) }) }
async function pins() {
  const bytes = await readFile(resolve(root, snapshot)); if (hash(bytes) !== expectedSha) throw new Error("snapshot_pin")
  for (const f of JSON.parse(bytes.toString()).files) if (hash(await readFile(resolve(root, f.path))) !== f.sha256) throw new Error("source_pin")
}
const operator = createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${db}`, { tls: false, maxConnections: 4 })
const native = createPostgresConnection(`postgres://${role}@127.0.0.1:55472/${db}`, { tls: false, maxConnections: 1 })
let clock = 0, authCalls = 0
const logs: unknown[] = [], secrets: string[] = []
let server: ReturnType<typeof Bun.serve> | undefined, app: Awaited<ReturnType<typeof createBetaAccessServer>> | undefined
const observed: { origin: string | null; status: number }[] = []
const origin = "http://127.0.0.1:3080"
const call = async (actor: number, path = "/beta-api/session", init: RequestInit = {}) => {
  const response = await fetch(`http://127.0.0.1:${server!.port}${path}`, { ...init, headers: { origin, authorization: `Bearer qa-${actor}`, ...(init.headers ?? {}) } })
  const body = await response.text()
  return { status: response.status, body, headers: response.headers }
}
const redeem = (actor: number, token: string, requestId = crypto.randomUUID()) => call(actor, "/beta-api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, requestId }) })
const issue = async (actor: number) => { const v = await api.issueBetaInvitation(operator, manifest, { companyId: tenants[1]!.companyId, recipientEmail: users[actor]!.email, role: "member", decisionReference: "QA-SUPPLEMENT" }); secrets.push(v.token, hash(v.token)); return v }
const betaState = async (conn = operator) => {
  const tables = ["tenant_admissions", "invitations", "memberships", "requests", "audit"]
  const result: Record<string, string> = {}
  for (const table of tables) {
    const rows = await conn.query<{ h: string }>(`select md5(coalesce(string_agg(j,'|' order by j),'')) h from (select to_jsonb(t)::text j from neuvetra_beta.${table} t) x`)
    result[table] = rows.rows[0]!.h
  }
  return result
}
const waitLock = async () => {
  const deadline = performance.now() + 2500
  while (performance.now() < deadline) {
    const r = await operator.query<{ n: number }>("select count(*)::int n from pg_stat_activity where datname=current_database() and usename=$1 and wait_event_type='Lock'", [role])
    if (r.rows[0]!.n > 0) return true
    await new Promise(r => setTimeout(r, 10))
  }
  return false
}
async function run() {
  if (process.argv[2] !== "--execute-frozen" || process.argv[3] !== expectedSha) throw new Error("explicit_gate")
  await pins()
  app = await createBetaAccessServer({ profile: "neuvetra.beta-access.synthetic-rehearsal.v1", databaseName: db, runtimeRole: role, databaseUrl: `postgres://${role}@127.0.0.1:55472/${db}`, origin, port: 3080 }, { now: () => clock, validateIdentity: async bearer => { authCalls++; return users[Number(bearer.slice(3))] ?? null }, log: e => logs.push(e) })
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, maxRequestBodySize: 8192, fetch: async req => { const r = await app!.fetch(req); observed.push({ origin: req.headers.get("origin"), status: r.status }); return r } })
  phase = "Q08_origin_sequence_diagnosis"
  const token = "0".repeat(64), key = crypto.randomUUID(), raw = JSON.stringify({ token, requestId: key })
  for (const size of [2048, 2049]) {
    const bytes = new TextEncoder().encode(raw + " ".repeat(size - raw.length))
    const body = new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 1000)); c.enqueue(bytes.slice(1000)); c.close() } })
    const r = await call(4, "/beta-api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half" } as RequestInit)
    check("Q08.stream_repeat." + size, r.status === (size === 2048 ? 404 : 413), { status: r.status })
  }
  const forbidden = await call(4, "/beta-api/session", { headers: { origin: origin + ".invalid" } })
  check("Q08.origin_repeat", forbidden.status === 403, { status: forbidden.status, observed: observed.slice(-3) })
  // Invalid UTF8 and 2049-byte multibyte whitespace/body are rejected before SQL.
  const multi = new TextEncoder().encode("é".repeat(1024) + " ")
  const multiResponse = await call(4, "/beta-api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: multi })
  check("Q08.multibyte_bytes", multiResponse.status === 413)
  clock += 60_001
  const authBefore = authCalls
  const statuses = []
  for (let i = 0; i < 61; i++) statuses.push((await call(4, "/beta-api/session", { headers: { "x-forwarded-for": `192.0.2.${i}` } })).status)
  check("Q08.global_limit", statuses.slice(0, 60).every(s => s === 200) && statuses[60] === 429, { statuses, authCalls: authCalls - authBefore })
  check("Q08.global_before_auth", authCalls - authBefore === 60)
  let tick = 0
  const limiter = createBetaRateLimiter(1, 60_000, 2, () => tick)
  check("Q08.bucket_capacity", limiter.check("a") && limiter.check("b") && !limiter.check("c") && !limiter.check("a"))
  tick = 60_001
  check("Q08.bucket_expiry", limiter.check("c") && limiter.check("a") && !limiter.check("b"))

  phase = "Q04_blocked_expiry"
  clock += 60_001
  const inv = await issue(4)
  let pending: Promise<Awaited<ReturnType<typeof redeem>>> | undefined
  await operator.transaction(async tx => {
    await tx.query("select 1 from neuvetra_beta.tenant_admissions where company_id=$1 for update", [tenants[1]!.companyId])
    pending = redeem(4, inv.token)
    check("Q04.redemption_observed_waiting", await waitLock())
    await tx.query("update neuvetra_beta.invitations set issued_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day' where id=$1", [inv.invitationId])
  })
  const waitingResult = await pending!
  check("Q04.expiry_rechecked_after_lock", waitingResult.status === 404, { status: waitingResult.status })
  check("Q04.expired_no_membership", (await operator.query("select 1 from neuvetra_beta.memberships where user_id=$1", [users[4]!.id])).rows.length === 0)

  phase = "Q04_revoke_serialization"
  const iv6 = await issue(5), request6 = crypto.randomUUID()
  const r6 = await redeem(5, iv6.token, request6)
  check("Q04.redeem_first", r6.status === 201)
  await api.revokeBetaMembership(operator, tenants[1]!.companyId, users[5]!.id, "QA-REVOKE-AFTER")
  check("Q04.redeem_then_revoke_no_access", (await call(5, `/beta-api/workspaces/${tenants[1]!.companyId}`)).status === 404)
  check("Q04.redeem_then_revoke_no_receipt", (await redeem(5, iv6.token, request6)).status === 404)
  const iv7 = await issue(6)
  await api.revokeBetaInvitation(operator, iv7.invitationId, "QA-REVOKE-FIRST")
  check("Q04.revoke_before_redeem", (await redeem(6, iv7.token)).status === 404)

  phase = "Q07_effective_default_acls"
  details.defaultAcls = (await operator.query("select pg_get_userbyid(defaclrole) owner,coalesce(n.nspname,'global') schema,defaclobjtype kind,defaclacl::text acl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclrole=(select oid from pg_roles where rolname='supabase_admin') order by 2,3")).rows
  const existing = await operator.query<{ name: string; config: string[] | null; definer: boolean; owner: string }>("select p.proname name,p.proconfig config,p.prosecdef definer,pg_get_userbyid(p.proowner) owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra_beta' order by 1")
  details.definers = existing.rows
  check("Q07.fixed_search_path", existing.rows.every(r => r.definer && r.config?.includes("search_path=pg_catalog, neuvetra_beta, auth, pg_temp")))
  await operator.exec("create function neuvetra_beta.qa_default_acl_probe() returns integer language sql security definer set search_path=pg_catalog as $$select 719$$")
  let helperCallable = false
  try { helperCallable = (await native.query<{ value: number }>("select neuvetra_beta.qa_default_acl_probe() value")).rows[0]?.value === 719 } catch { /* denied is expected */ }
  check("Q07.future_function_default_denied", !helperCallable, { restrictedRuntimeCalledUnlistedDefiner: helperCallable })
  await operator.exec("drop function neuvetra_beta.qa_default_acl_probe()")
  const roles = ["anon", "authenticated", "neuvetra_runtime"]
  for (const other of roles) {
    const priv = await operator.query<{ access: boolean }>("select has_schema_privilege($1,'neuvetra_beta','USAGE') access", [other])
    check("Q07.other_role_schema_denied." + other, priv.rows[0]?.access === false)
  }

  phase = "Q10_native_restore"
  const beforeRestore = await betaState()
  const cluster = createPostgresConnection("postgres://supabase_admin@127.0.0.1:55472/postgres", { tls: false, maxConnections: 1 })
  try {
    if ((await cluster.query("select 1 from pg_database where datname=$1", [restored])).rows.length) throw new Error("restore_must_be_new")
    await cluster.exec(`create database "${restored}" owner supabase_admin template template0`)
  } finally { await cluster.close() }
  // The dump has only this QA database's synthetic hashes/emails; tokens never enter storage.
  const dumpPath = resolve(root, prefix + "qa-b-synthetic.dump")
  const bin = "C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/"
  const baseArgs = ["--host=127.0.0.1", "--port=55472", "--username=supabase_admin", "--no-password"]
  for (const [tool, args] of [["pg_dump", [...baseArgs, "--format=custom", `--file=${dumpPath}`, db]], ["pg_restore", [...baseArgs, "--exit-on-error", `--dbname=${restored}`, dumpPath]]] as const) {
    const proc = Bun.spawn([bin + tool + ".exe", ...args], { stdout: "ignore", stderr: "pipe", env: { ...process.env, PGPASSWORD: "" } })
    await new Response(proc.stderr).text() // Never persist raw SQL/error text.
    if (await proc.exited !== 0) throw new Error("native_restore_tool_failed")
  }
  const restoreOperator = createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${restored}`, { tls: false, maxConnections: 1 })
  const options = { connectionString: `postgres://${role}@127.0.0.1:55472/${restored}`, databaseName: restored, runtimeRole: role }
  try {
    check("Q10.exact_access_state", JSON.stringify(await betaState(restoreOperator)) === JSON.stringify(beforeRestore))
    let refused = false
    try { const d = await api.BetaAccessDatabase.create(options); await d.close() } catch { refused = true }
    check("Q10.unrebound_target_denied", refused)
    await restoreOperator.query("update neuvetra_beta.target set database_name=$1 where database_name=$2", [restored, db])
    const d = await api.BetaAccessDatabase.create(options)
    try {
      check("Q10.active_member", (await d.readSession(users[1]!.id, users[1]!.email)).length === 1)
      check("Q10.revoked_member", (await d.readSession(users[5]!.id, users[5]!.email)).length === 0)
      check("Q10.tombstone_member", (await d.readSession(users[2]!.id, users[2]!.email)).length === 0)
      let replayDenied = false
      try { await d.redeem(users[5]!.id, users[5]!.email, hash(iv6.token), request6) } catch { replayDenied = true }
      check("Q10.revoked_receipt_denied", replayDenied)
    } finally { await d.close() }
  } finally { await restoreOperator.close() }
  check("Q10.source_preserved", JSON.stringify(await betaState()) === JSON.stringify(beforeRestore))
  check("Q08.no_secret_logs", !secrets.some(s => JSON.stringify(logs).includes(s)) && !users.some(u => JSON.stringify(logs).includes(u.email)))
  await pins(); completed = true
}
let errorCode: string | null = null
try { await run() } catch (error) { errorCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : null } finally { await server?.stop(true); await app?.close(); await native.close(); await operator.close() }
const path = resolve(root, prefix + `supplement-result-${Date.now()}.json`)
const verdict = completed && checks.every(c => c.pass) ? "pass_executed_supplement" : "fail_or_incomplete_preserved"
await writeFile(path, JSON.stringify({ verdict, phase, completed, errorCode, candidateSha256: expectedSha, checks, details, actualCostUsd: null }, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify({ verdict, phase, checkCount: checks.length, failures: checks.filter(c => !c.pass).map(c => c.id), resultPath: path }))

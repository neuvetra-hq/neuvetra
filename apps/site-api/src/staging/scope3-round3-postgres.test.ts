// Round 3, lane B (Claude, 31 October 2026): native PostgreSQL acceptance tests with explicit budgets.
// - EN-1: on a database with planner statistics (ANALYZE after another company's 2,000 imported lines), a new company's
//   2,000-line spend import saves inside the runtime's 15-second statement timeout, and the read-backs that run inside
//   the write transaction have no join the planner can turn quadratic (asserted on their plans).
// - Owner decision 6 (EN-2): preparing, approving and re-preparing a report at the line cap (3,000 worst-case ten-mode
//   commuting records) stays under 1.5 GB peak RSS in the API process and 768 MiB in any PostgreSQL backend (25% headroom).
// - Owner decision 7 (EN-3): the line cap is enforced in SQL (import and record saves), and "withdraw this import" is one
//   set-based action.
// Runs on the disposable loopback fixture hosted.test.ts migrates (verify.yml native step); any loopback port.
import { expect, test } from "bun:test"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createPostgresConnection, EXISTING_PROJECT_REF, HostedWorkspaceDatabase, provisionStagingRoster, SCOPE3_CAPACITY_TEXT, SCOPE3_REPORT_MAX_COMBINED_TEXT_BYTES, SCOPE3_REPORT_MAX_TEXT_BYTES, STAGING_SCHEMA_VERSION, validateCollectionSaveInput, type WorkspaceConnection, type WorkspaceSql } from "@neuvetra/database"
import { createStagingSchemaFixture } from "../../../../packages/neuvetra-database/src/staging-schema-fixture"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { SCOPE3_SPEND_IMPORT_READBACK_SQL } from "../../../../packages/neuvetra-database/src/scope3-spend-imports"
import { decodeScope3ReportVersion } from "../../../site-web/src/lib/scope3-report-api"
import { createStagingServer } from "./server"
import { readStagingConfig, STAGING_PROFILE } from "./config"

const target = process.env.M63_API_TEST_DATABASE_URL
if (target) {
  const parsed = new URL(target)
  if (parsed.hostname !== "127.0.0.1" || !/^\d{2,5}$/.test(parsed.port) || parsed.pathname !== "/m63_integration" || parsed.username !== "m63_test_admin" || parsed.password || parsed.search || parsed.hash) throw new Error("The Scope 3 round-3 native suite requires the named disposable loopback database.")
}
const integration = target ? test : test.skip
const REF = "abcdefghijklmnopqrst", ORIGIN = "http://127.0.0.1:3016"
const enc = (text: string) => new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>
const HEADER = "line_id,date,vendor,gl_account,gl_description,description,amount,currency,dollar_year,category,naics_code,margin_choice,capital_full_cost\n"
const NAICS = ["541611", "541512", "561320", "484121", "481111", "562111"], CAT = [1, 1, 1, 4, 6, 5]
/** `rows` coded spend lines (category and NAICS stated in the file, so every line calculates), many vendors and accounts. */
const ledger = (prefix: string, rows: number) => enc(HEADER + Array.from({ length: rows }, (_, i) => `${prefix}-${i + 1},2025-03-14,Vendor ${prefix} ${i % 97} Holdings LLC,61${i % 50},Services account ${i % 50},Invoice ${prefix}-${i + 1} for professional services,${1000 + i}.55,USD,2025,${CAT[i % 6]},${NAICS[i % 6]},with_margins,\n`).join(""))
/** EN-1 budget: the runtime's statement timeout is 15 s (hosted.ts); the whole import (several statements) must finish well inside it (4-6 s unloaded, about 10 s on a loaded 2-CPU host). */
const IMPORT_BUDGET_MS = 12_000

async function harness(options: { maxConnections?: number; readinessPool?: boolean } = {}) {
  const operator = createPostgresConnection(target!, { tls: false })
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const runtime = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: options.maxConnections ?? 6 })
  // BF-19: as HostedWorkspaceDatabase.create builds it in production: readiness on its own one-connection pool.
  const readiness = options.readinessPool ? createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 1 }) : undefined
  const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string, reuse: boolean, readiness?: WorkspaceConnection) => HostedWorkspaceDatabase)(runtime, REF, false, readiness)
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres` })
  const users = new Map<string, string>()
  const stored = new Map<string, Uint8Array<ArrayBuffer>>()
  const collectionEvidenceStorage = { put: async (_token: string, _bucket: string, key: string, bytes: Uint8Array<ArrayBuffer>) => { stored.set(key, bytes) }, get: async (_token: string, _bucket: string, key: string) => stored.get(key)! }
  const app = await createStagingServer(config, { database, collectionEvidenceStorage, validateUser: async token => users.has(token) ? { id: users.get(token)!, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {} })
  const call = (route: string, actor: string, init: { method?: string; body?: BodyInit; type?: string } = {}) => app.fetch(new Request(`${ORIGIN}/workspace-api${route}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"), body: init.body, headers: { origin: ORIGIN, authorization: `Bearer ${actor}`, ...(init.type ? { "content-type": init.type } : {}) } }))
  const json = (route: string, actor: string, body: unknown) => call(route, actor, { body: JSON.stringify(body), type: "application/json" })
  const company = async (name: string, included: number[]) => {
    const owner = crypto.randomUUID(), id = crypto.randomUUID()
    users.set(name, owner)
    await operator.query("insert into auth.users(id) values($1)", [owner])
    await provisionStagingRoster(operator, { expectedProjectRef: REF, workspaceId: id, ownerUserId: owner, members: [] })
    const base = createSyntheticCompanySetup()
    const setup = { ...base,
      boundary: { ...base.boundary, approach: "operational_control" as const },
      entities: base.entities.map(entity => ({ ...entity, inclusion: "included" as const, control: "operational_control" as const })),
      locations: [{ ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }],
      screening: included.map(category => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[category - 1]!, state: "yes" as const, reason: "", details: `Synthetic category ${category} activity.`, locationId: null })) }
    const saved = await json(`/workspace/${id}/setup`, name, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup })
    expect(saved.status).toBe(201)
    return { owner, id, root: `/workspace/${id}`, site: base.locations[0]!.id, setupVersionId: (await saved.json()).savedVersion.id as string, name }
  }
  const upload = async (root: string, actor: string, bytes: Uint8Array<ArrayBuffer>, file: string) => {
    const response = await app.fetch(new Request(`${ORIGIN}/workspace-api${root}/collection/evidence`, { method: "POST", body: bytes, headers: { origin: ORIGIN, authorization: `Bearer ${actor}`, "content-type": "text/csv", "x-neuvetra-original-name": file, "x-neuvetra-upload-id": crypto.randomUUID() } }))
    expect(response.status).toBe(201)
    return (await response.json()).receipt.evidenceId as string
  }
  const importFile = (c: { root: string; site: string; name: string }, bytes: Uint8Array<ArrayBuffer>, evidenceId: string) => call(`${c.root}/scope3/spend-imports?evidenceId=${evidenceId}&locationId=${c.site}`, c.name, { body: bytes, type: "text/csv" })
  /** EXPLAIN of `sql` as the runtime role with the company member's JWT subject (as the route runs it), rolled back. */
  const explain = async (owner: string, sql: string, args: unknown[]) => {
    let plan = ""
    const rollback = new Error("rollback")
    await runtime.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [owner])
      plan = (await tx.query<{ "QUERY PLAN": string }>(`explain ${sql}`, args)).rows.map(row => row["QUERY PLAN"]).join("\n")
      throw rollback
    }).catch((error: unknown) => { if (error !== rollback) throw error })
    return plan
  }
  const close = async () => { await app.close?.(); await database.close(); await operator.close() }
  /** Lets this harness's server authenticate a user another harness created (its bearer token is `name`). */
  const register = (name: string, owner: string) => { users.set(name, owner) }
  return { operator, runtime, database, app, call, json, company, upload, importFile, explain, close, register }
}

/**
 * BF-19 (BI-02, lead 5): the audit's J5 and K1 with production pool settings (4 request connections, readiness on its own
 * connection). Before BF-19 on a 2-CPU host: J5's six concurrent 2,000-line imports all ran (8-12 s each) and another
 * company's first read waited 8.5 s; K1's nine made another company's read and /ready fail with 503 after 10 s.
 */
const BF19_REFUSAL_MS = 1_000, BF19_READ_MS = 2_000, BF19_READY_MS = 1_000
async function bf19Burst(h: Awaited<ReturnType<typeof harness>>, label: string, importers: number) {
  const companies = [] as Array<Awaited<ReturnType<typeof h.company>>>
  for (let i = 0; i <= importers; i++) companies.push(await h.company(`bf19-${label}-${i}`, [1, 4, 5, 6]))
  const reader = companies[importers]!
  const files = await Promise.all(companies.slice(0, importers).map(async (c, i) => { const bytes = ledger(`${label}${i}`, 2000); return { c, bytes, evidence: await h.upload(c.root, c.name, bytes, `${label}-${i}.csv`) } }))
  const started = performance.now()
  const imports = files.map(({ c, bytes, evidence }) => h.importFile(c, bytes, evidence).then(async response => ({ c, bytes, evidence, status: response.status, ms: Math.round(performance.now() - started), retryAfter: response.headers.get("retry-after"), body: await response.json() })))
  await Bun.sleep(300)
  const probes = await Promise.all([
    (async () => { const s = performance.now(); const r = await h.call(`${reader.root}/collection`, reader.name); await r.arrayBuffer(); return { status: r.status, ms: Math.round(performance.now() - s) } })(),
    (async () => { const s = performance.now(); const r = await h.app.fetch(new Request(`${ORIGIN}/ready`)); return { status: r.status, ms: Math.round(performance.now() - s), body: await r.json() } })(),
    (async () => { const s = performance.now(); const r = await h.app.fetch(new Request(`${ORIGIN}/health`)); return { status: r.status, ms: Math.round(performance.now() - s) } })(),
  ])
  const done = await Promise.all(imports)
  console.info(`BF-19 native ${label}: ${importers} 2,000-line imports at once (pool 4) ${JSON.stringify(done.map(d => `${d.status}/${d.ms}ms/${d.body.code ?? ""}`))} | another company's read ${probes[0].status}/${probes[0].ms}ms | ready ${probes[1].status}/${probes[1].ms}ms | health ${probes[2].status}/${probes[2].ms}ms`)
  return { done, probes, companies }
}

integration("BF-19 natively (J5, K1): concurrent bulk imports are refused at once, other companies' reads and /ready stay fast, and a refused import retried later is a first attempt", async () => {
  const h = await harness({ maxConnections: 4, readinessPool: true })
  try {
    for (const [label, importers] of [["J5", 6], ["K1", 9]] as const) {
      const { done, probes } = await bf19Burst(h, label, importers)
      const admitted = done.filter(d => d.status === 201), refused = done.filter(d => d.status === 503)
      expect([admitted.length, refused.length]).toEqual([1, importers - 1])
      expect([admitted[0]!.body.saved, admitted[0]!.body.replayed]).toEqual([2000, false])
      for (const d of refused) {
        expect([d.body, d.retryAfter]).toEqual([{ code: "bulk_write_busy", error: "Another large spend change (an import, currency conversion, mapping or withdrawal) is in progress or next in line. Try again in a moment." }, "10"])
        expect(d.ms).toBeLessThan(BF19_REFUSAL_MS)
      }
      expect(probes[0].status).toBe(200)
      expect(probes[0].ms).toBeLessThan(BF19_READ_MS)
      expect([probes[1].status, probes[1].body]).toEqual([200, { status: "ready", profile: STAGING_PROFILE, schemaVersion: STAGING_SCHEMA_VERSION }])
      expect(probes[1].ms).toBeLessThan(BF19_READY_MS)
      expect(probes[2].status).toBe(200)
      // A refused import read and wrote nothing: no import, no line and no receipt for that company ...
      const late = refused[0]!
      const counts = async () => (await h.operator.query<{ imports: number; records: number }>("select (select count(*) from neuvetra.scope3_spend_imports where company_id=$1)::int imports,(select count(*) from neuvetra.collection_activity_records where company_id=$1)::int records", [late.c.id])).rows[0]
      expect(await counts()).toEqual({ imports: 0, records: 0 })
      // ... so the same request, sent again once the gate is free, is its first attempt (saved, not replayed).
      const retried = await h.importFile(late.c, late.bytes, late.evidence)
      const body = await retried.json()
      expect([retried.status, body.saved, body.replayed]).toEqual([201, 2000, false])
      expect(await counts()).toEqual({ imports: 1, records: 2000 })
    }
  } finally { await h.close() }
}, 900_000)

integration("round 3 EN-1 natively: on an ANALYZEd multi-company database a new company's 2,000-line import saves well inside the statement timeout", async () => {
  const h = await harness()
  try {
    // Another company's 2,000 lines, then planner statistics (what autoanalyze gives any database in use).
    const a = await h.company("en1-first", [1, 4, 5, 6])
    const first = ledger("A", 2000)
    let started = performance.now()
    const one = await h.importFile(a, first, await h.upload(a.root, a.name, first, "first-2000.csv"))
    console.info(`round 3 EN-1 native: first company's 2,000-line import ${one.status} in ${Math.round(performance.now() - started)} ms`)
    expect(one.status).toBe(201)
    await h.operator.exec("analyze")
    // A new company (not in the statistics): its first 2,000-line import.
    const b = await h.company("en1-second", [1, 4, 5, 6])
    const second = ledger("B", 2000)
    const evidence = await h.upload(b.root, b.name, second, "second-2000.csv")
    started = performance.now()
    const two = await h.importFile(b, second, evidence)
    const importMs = Math.round(performance.now() - started)
    const body = await two.json()
    console.info(`round 3 EN-1 native: new company's 2,000-line import on an analyzed database ${two.status} in ${importMs} ms`)
    expect([two.status, body.saved, body.import?.reconciliation?.reconciled]).toEqual([201, 2000, true])
    expect(importMs).toBeLessThan(IMPORT_BUDGET_MS)
    // The list read (GET) of the same company, in the same statistics state, inside the same budget.
    started = performance.now()
    const listed = await h.call(`${b.root}/scope3/spend-imports`, b.name)
    const listMs = Math.round(performance.now() - started)
    const list = await listed.json()
    console.info(`round 3 EN-1 native: spend-imports GET ${listed.status} in ${listMs} ms`)
    expect([listed.status, list.imports.length, list.imports[0].lines.length, list.lines.length]).toEqual([200, 1, 2000, 2000])
    expect(listMs).toBeLessThan(IMPORT_BUDGET_MS)
    // The read-back's plan: each line's first version is found by the unique (record_id, revision) key; never a join whose
    // inner side scans the company's versions per line (the round-2 plan: Join Filter on record_id).
    const plan = await h.explain(b.owner, SCOPE3_SPEND_IMPORT_READBACK_SQL.versions, [b.id, body.import.lines.slice(0, 5).map((line: { recordId: string }) => line.recordId)])
    console.info(`round 3 EN-1 native: read-back plan\n${plan}`)
    expect(plan).not.toMatch(/Join Filter/)
    expect(plan).toMatch(/record_id = ANY/)
  } finally { await h.close() }
}, 600_000)

// --- Owner decision 6 (EN-2): memory at the line cap, with explicit budgets ---------------------------------------------

/** Budgets (owner decision 6): peak RSS of the API process and of any PostgreSQL backend while preparing at the line cap. */
const API_BUDGET_MIB = 1536, BACKEND_BUDGET_MIB = 768
const kib = (text: string, key: string) => Number(new RegExp(`^${key}:\\s+(\\d+) kB`, "m").exec(text)?.[1] ?? Number.NaN)
type WindowsPeak = { pid: number; name: string; peakWorkingSetBytes: number; startUtc: string }
// PROCESS_MEMORY_COUNTERS.PeakWorkingSetSize is the OS lifetime peak, in bytes.
// https://learn.microsoft.com/en-us/windows/win32/api/psapi/ns-psapi-process_memory_counters
const WINDOWS_PEAK_SCRIPT = `
import ctypes, datetime, json, ntpath, sys
from ctypes import wintypes as w
class Counters(ctypes.Structure):
    _fields_ = [('cb',w.DWORD),('PageFaultCount',w.DWORD)] + [(k,ctypes.c_size_t) for k in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage']]
k=ctypes.WinDLL('kernel32',use_last_error=True)
p=ctypes.WinDLL('psapi',use_last_error=True)
k.OpenProcess.argtypes=[w.DWORD,w.BOOL,w.DWORD]; k.OpenProcess.restype=w.HANDLE
k.CloseHandle.argtypes=[w.HANDLE]; k.CloseHandle.restype=w.BOOL
k.QueryFullProcessImageNameW.argtypes=[w.HANDLE,w.DWORD,w.LPWSTR,ctypes.POINTER(w.DWORD)]; k.QueryFullProcessImageNameW.restype=w.BOOL
k.GetProcessTimes.argtypes=[w.HANDLE]+[ctypes.POINTER(w.FILETIME)]*4; k.GetProcessTimes.restype=w.BOOL
p.GetProcessMemoryInfo.argtypes=[w.HANDLE,ctypes.POINTER(Counters),w.DWORD]; p.GetProcessMemoryInfo.restype=w.BOOL
def checked(ok):
    if not ok: raise ctypes.WinError(ctypes.get_last_error())
rows=[]
for text in sys.argv[2].split(','):
    pid=int(text); handle=k.OpenProcess(0x1000,False,pid); checked(handle)
    try:
        image=ctypes.create_unicode_buffer(32768); length=w.DWORD(len(image))
        checked(k.QueryFullProcessImageNameW(handle,0,image,ctypes.byref(length)))
        name=ntpath.basename(image.value).lower().removesuffix('.exe')
        if name != sys.argv[1]: raise RuntimeError('Unexpected memory process identity')
        created,exited,kernel,user=w.FILETIME(),w.FILETIME(),w.FILETIME(),w.FILETIME()
        checked(k.GetProcessTimes(handle,ctypes.byref(created),ctypes.byref(exited),ctypes.byref(kernel),ctypes.byref(user)))
        ticks=(created.dwHighDateTime<<32)|created.dwLowDateTime
        start=(datetime.datetime(1601,1,1,tzinfo=datetime.timezone.utc)+datetime.timedelta(microseconds=ticks//10)).isoformat()
        count=Counters(); count.cb=ctypes.sizeof(count)
        checked(p.GetProcessMemoryInfo(handle,ctypes.byref(count),count.cb))
        rows.append(dict(pid=pid,name=name,peakWorkingSetBytes=count.PeakWorkingSetSize,startUtc=start))
    finally: checked(k.CloseHandle(handle))
print(json.dumps(rows))
`
/** Windows retains the lifetime peak: no reset or subtraction can hide an earlier allocation. */
async function windowsPeaks(pids: number[], name: "bun" | "postgres"): Promise<Map<number, number>> {
  if (pids.length === 0 || pids.some(pid => !Number.isSafeInteger(pid) || pid <= 0)) throw new Error("Memory measurement requires live process IDs")
  const child = Bun.spawn([process.env.NEUVETRA_PYTHON ?? "python", "-I", "-c", WINDOWS_PEAK_SCRIPT, name, pids.join(",")], { stdout: "pipe", stderr: "pipe" })
  const timer = setTimeout(() => child.kill(), 10_000)
  let rows: WindowsPeak[]
  try {
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    if (code !== 0) throw new Error(`Windows peak-memory observation failed: ${stderr}`)
    rows = JSON.parse(stdout) as WindowsPeak[]
  } finally { clearTimeout(timer) }
  if (!Array.isArray(rows) || rows.length !== pids.length || new Set(rows.map(row => row.pid)).size !== pids.length || rows.some(row => !pids.includes(row.pid) || row.name !== name || !Number.isFinite(row.peakWorkingSetBytes) || row.peakWorkingSetBytes <= 0 || !Number.isFinite(Date.parse(row.startUtc)))) throw new Error("Incomplete Windows peak-memory observation")
  console.info(`native Windows lifetime PeakWorkingSet64: ${JSON.stringify(rows)}`)
  return new Map(rows.map(row => [row.pid, row.peakWorkingSetBytes / 1048576]))
}
/** Linux resets VmHWM; Windows includes the API/test lifetime; browser decoding runs in a separate client process. */
const apiPeak = {
  reset: () => { Bun.gc(true); if (process.platform !== "win32") writeFileSync("/proc/self/clear_refs", "5") },
  mib: async () => process.platform === "win32" ? (await windowsPeaks([process.pid], "bun")).get(process.pid)! : kib(readFileSync("/proc/self/status", "utf8"), "VmHWM") / 1024,
}
/**
 * The peak RSS (VmHWM, MiB) of each runtime backend, by its PostgreSQL pid. A server in a container (CI's service) reports
 * pids of its own namespace, so each host process is matched by the last pid of its NSpid line (the host pid natively).
 */
async function backendPeaks(operator: { query<T>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> }): Promise<Map<number, number>> {
  const pids = new Set((await operator.query<{ pid: number }>("select pid from pg_stat_activity where datname=current_database() and usename='neuvetra_runtime'")).rows.map(row => Number(row.pid)))
  if (pids.size === 0) throw new Error("No runtime backend remains for peak-memory observation")
  if (process.platform === "win32") return windowsPeaks([...pids], "postgres")
  const out = new Map<number, number>()
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue
    let status: string
    try { status = readFileSync(`/proc/${entry}/status`, "utf8") } catch { continue }
    if (!/^Name:\s+postgres/m.test(status)) continue
    const ns = (/^NSpid:\s+(.+)$/m.exec(status)?.[1] ?? entry).trim().split(/\s+/).map(Number)
    const pid = ns[ns.length - 1]!
    if (pids.has(pid)) out.set(pid, kib(status, "VmHWM") / 1024)
  }
  if (out.size !== pids.size || [...out.values()].some(value => !Number.isFinite(value) || value <= 0)) throw new Error("Incomplete Linux peak-memory observation")
  return out
}

const WINDOWS_DECODE_SCRIPT = `
const [decoder, companyId, versionId, url] = process.argv.slice(1)
const { decodeScope3ReportVersion } = await import(decoder)
const response = await fetch(url)
if (response.status !== 200) throw new Error("Frozen report response failed")
const frozen = await decodeScope3ReportVersion(await response.json(), companyId, versionId)
console.log(JSON.stringify({ records: frozen.document.results.records.length, selfApproved: frozen.version.approval?.selfApproved ?? null,
  calculatedComplete: frozen.document.results.records.every(row => row.outcome === "calculated" && row.result?.status === "complete") }))
`
/** The real browser decoder runs outside the API process; Windows cannot reset its lifetime peak afterward. */
async function decodeFrozenInChild(response: Response, companyId: string, versionId: string) {
  if (!response.body) throw new Error("Frozen report response has no body")
  const path = `/${crypto.randomUUID()}`
  let served = false
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    if (served || request.method !== "GET" || new URL(request.url).pathname !== path) return new Response(null, { status: 404 })
    served = true
    return response
  } })
  try {
    const child = Bun.spawn([process.execPath, "--eval", WINDOWS_DECODE_SCRIPT, import.meta.resolve("../../../site-web/src/lib/scope3-report-api.ts"), companyId, versionId, `http://127.0.0.1:${server.port}${path}`],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe" })
    console.info(`native browser decoder child: ${child.pid}; loopback response port: ${server.port}`)
    const timer = setTimeout(() => child.kill(), 120_000)
    try {
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      if (code !== 0) throw new Error(`Frozen report browser decoding failed: ${stderr}`)
      return JSON.parse(stdout) as { records: number; selfApproved: boolean | null; calculatedComplete: boolean }
    } finally { clearTimeout(timer); if (child.exitCode === null) { child.kill(); await child.exited } }
  } finally { await server.stop(true) }
}

integration("round 3 owner decision 6 natively: preparing, approving and re-preparing at the line cap stay inside 1.5 GB (API) and 768 MiB (any backend); one prepare at a time", async () => {
  // The largest report a company at the line cap can freeze (DESIGN 13.8): 3,000 ten-mode average commuting records with every
  // free-text field at its maximum, 20 evidence files each and the longest numbers. Saved through the collection RPC with
  // a fixture pool, which is then closed, so the measured server's backends are new and their peaks are only its own.
  const fixture = await harness()
  const w = await fixture.company("cap-memory", [7])
  const files = Array.from({ length: 20 }, () => crypto.randomUUID())
  for (const [i, file] of files.entries()) await fixture.operator.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,$4,'application/pdf',1,$5,$6)",
    [file, w.id, `${w.id}/original/${file}`, `${String(i).padStart(4, "0")}${"E".repeat(247)}.pdf`, "f".repeat(62) + i.toString(16).padStart(2, "0"), w.owner])
  const vehicles = ["passenger_car", "light_duty_truck", "motorcycle"]
  const modes = [...vehicles, "intercity_rail_northeast_corridor", "intercity_rail_other_routes", "intercity_rail_national_average", "commuter_rail", "transit_rail", "bus", "non_motorized"]
    .map(mode => ({ mode, sharePercent: "10", oneWayDistance: "999999999999.999", distanceUnit: "km", occupancy: vehicles.includes(mode) ? "3.333" : null }))
  const dataQuality = { indicators: { technological: "very_good", temporal: "very_good", geographical: "very_good", completeness: "very_good", reliability: "very_good" }, activityDataOrigin: "value_chain_partner", basis: "D".repeat(500) }
  const records = Number(process.env.NEUVETRA_R3_CAP_RECORDS ?? 3000)
  let started = performance.now()
  for (let i = 0; i < records; i++) {
    const employees = `${999999999999 - i}.999`
    const activity = { locationId: w.site, setupVersionId: w.setupVersionId, state: "active", withdrawalReason: null, quality: "estimated", estimateBasis: "B".repeat(2000), period: { start: "2025-01-01", endExclusive: "2026-01-01" },
      reference: "R".repeat(1000), notes: "N".repeat(4000), evidenceIds: files, kind: "commuting_average", sourceId: `${String(i).padStart(6, "0")}${"S".repeat(114)}`,
      quantity: { originalValue: employees, originalUnit: "employee", normalizedValue: employees, normalizedUnit: "employee" },
      // PR22 bug hunt A-3: 365, the most working days a calendar-2025 profile can have (366 is now held as more than its period).
      payload: { workingDays: 365, modes, sharesBasis: "H".repeat(300), distanceBasis: "K".repeat(300), activityOverlap: "none_confirmed", dataQuality } }
    await fixture.database.saveCollectionActivity(w.owner, w.id, crypto.randomUUID(), { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity })
  }
  console.info(`round 3 decision 6 native: ${records} worst-case commuting records saved in ${Math.round(performance.now() - started)} ms`)
  await fixture.close()
  console.info(`round 3 decision 6 native: API lifetime peak after fixture ${Math.round(await apiPeak.mib())} MiB`)

  const h = await harness()
  h.register(w.name, w.owner)
  const peaks: Array<{ step: string; ms: number; status: number; api: number; backend: number; apiBefore: number }> = []
  const measured = async (step: string, run: () => Promise<Response | Response[]>) => {
    apiPeak.reset()
    // This process is the API and the test harness at once: its RSS before the step (after a full collection) is logged too.
    const apiBefore = Math.round(process.memoryUsage().rss / 1048576)
    const t = performance.now()
    const out = await run()
    const responses = Array.isArray(out) ? out : [out]
    const backend = Math.max(0, ...(await backendPeaks(h.operator)).values())
    const api = await apiPeak.mib()
    peaks.push({ step, ms: Math.round(performance.now() - t), status: responses[0]!.status, api: Math.round(api), backend: Math.round(backend), apiBefore })
    console.info(`round 3 decision 6 native: ${JSON.stringify(peaks.at(-1))}`)
    expect({ step, apiWithinBudget: api <= API_BUDGET_MIB, backendWithinBudget: backend <= BACKEND_BUDGET_MIB }).toEqual({ step, apiWithinBudget: true, backendWithinBudget: true })
    return responses
  }
  try {
    // 1. Prepare revision 1.
    const [prepared] = await measured("prepare r1", () => h.json(`${w.root}/scope3/reports`, w.name, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null }))
    const body = await prepared!.json()
    expect([prepared!.status, body.code ?? null]).toEqual([201, null])
    const size = (await h.operator.query<{ report: number; csv: number }>("select octet_length(report_text) report,octet_length(csv_text) csv from neuvetra.scope3_report_versions where id=$1", [body.version.id])).rows[0]!
    console.info(`round 3 decision 6 native: stored report ${size.report} bytes, CSV ${size.csv} bytes`)
    if (records === 3000) expect(Number(size.report)).toBeGreaterThan(67_108_864) // the cap's worst case (round 2c: 83.4 MB)
    // 2. Approve (the owner prepared it: a confirmed self-approval; open issues acknowledged if any).
    const [approved] = await measured("approve r1", () => h.json(`${w.root}/scope3/reports/${body.version.id}/approval`, w.name, { reportSha256: body.version.reportSha256, acknowledgeOpenIssues: body.version.openIssues.length > 0, confirmSelfApproval: true }))
    expect(approved!.status).toBe(201)
    // 3. Open the stored version (both texts in the response).
    // The full unchanged browser validator checks the exact response bytes. Windows isolates that client work because
    // its API lifetime peak cannot be reset; Linux keeps the original in-process decode followed by VmHWM reset.
    if (process.platform === "win32") {
      await measured("open and stream r1 to browser decoder", async () => {
        const opened = await h.call(`${w.root}/scope3/reports/${body.version.id}`, w.name)
        expect(opened.status).toBe(200)
        const frozen = await decodeFrozenInChild(opened, w.id, body.version.id)
        expect([frozen.records, frozen.selfApproved]).toEqual([records, true])
        expect(frozen.calculatedComplete).toBe(true)
        return opened
      }) // One measured request, with no collection or reset between headers and body.
    } else {
      const [opened] = await measured("open r1", () => h.call(`${w.root}/scope3/reports/${body.version.id}`, w.name))
      expect(opened!.status).toBe(200)
      const frozen = await decodeScope3ReportVersion(await opened!.json(), w.id, body.version.id)
      expect([frozen.document.results.records.length, frozen.version.approval?.selfApproved]).toEqual([records, true])
      expect(frozen.document.results.records.every(row => row.outcome === "calculated" && row.result?.status === "complete")).toBe(true)
    }
    // 4. Two prepares of revision 2 at once (its change log reads the approved revision 1): one runs, the other is told to
    // retry (503 report_prepare_busy with Retry-After) at once, before any results run.
    const second = (key: string) => h.json(`${w.root}/scope3/reports`, w.name, { idempotencyKey: key, expectedRevision: 1, reason: "Second version at the cap." })
    const pair = await measured("prepare r2 (two at once)", () => Promise.all([second(crypto.randomUUID()), second(crypto.randomUUID())]))
    const statuses = pair.map(response => response.status).sort()
    expect(statuses).toEqual([201, 503])
    const busy = pair.find(response => response.status === 503)!
    expect([(await busy.json()).code, busy.headers.get("retry-after")]).toEqual(["report_prepare_busy", "30"])
    // The budgets, for every step.
    for (const row of peaks) { expect([row.step, row.api <= API_BUDGET_MIB]).toEqual([row.step, true]); expect([row.step, row.backend <= BACKEND_BUDGET_MIB]).toEqual([row.step, true]) }
  } finally { await h.close() }
}, 1_800_000)

// --- Owner decision 7 (EN-3): the line cap in SQL, "withdraw this import", bulk corrections ------------------------------

integration("round 3 owner decision 7 natively: the line cap holds in SQL (import and record saves); a whole import is withdrawn in one action; bulk corrections", async () => {
  const h = await harness()
  try {
    const c = await h.company("cap-sql", [1, 4, 5, 6])
    const lines = async () => (await h.call(`${c.root}/results/scope3`, c.name).then(r => r.json())).lineBudget
    const imports = async () => Number((await h.operator.query<{ n: string }>("select count(*) n from neuvetra.scope3_spend_imports where company_id=$1", [c.id])).rows[0]!.n)
    // Exactly at the cap: 2,000 + 1,000 imported lines.
    const a = ledger("CA", 2000), b = ledger("CB", 1000)
    expect((await h.importFile(c, a, await h.upload(c.root, c.name, a, "a.csv"))).status).toBe(201)
    const second = await h.importFile(c, b, await h.upload(c.root, c.name, b, "b.csv"))
    expect(second.status).toBe(201)
    const secondImport = (await second.json()).import
    expect(await lines()).toEqual({ max: 3000, used: 3000, remaining: 0 })
    // SQL refuses past the cap even when the API's own pre-check is skipped (two imports racing past it would both pass that
    // check): 54N30, nothing saved.
    const one = ledger("CC", 1), oneEvidence = await h.upload(c.root, c.name, one, "c.csv")
    const { parseScope3SpendCsv } = await import("../../../../packages/neuvetra-database/src/scope3-spend-import")
    const { createHash } = await import("node:crypto")
    const parsed = parseScope3SpendCsv(one, { period: { start: "2025-01-01", endExclusive: "2026-01-01" } })
    const before = await imports()
    const direct = await h.database.importScope3Spend(c.owner, c.id, { parsed, fileSha256: createHash("sha256").update(one).digest("hex"), evidenceId: oneEvidence, locationId: c.site }).then(() => null, (error: { code?: string }) => error.code)
    expect([direct, await imports()]).toEqual(["54N30", before])
    // A record save that adds a Scope 3 line is refused by SQL too, with the line-budget error through the route.
    const waste = { locationId: c.site, setupVersionId: c.setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" },
      reference: "Synthetic native", notes: "", evidenceIds: [], kind: "waste", sourceId: "W-CAP", quantity: { originalValue: "1.5", originalUnit: "metric_ton", normalizedValue: "1.5", normalizedUnit: "metric_ton" }, payload: { category: 5, material: "asphalt_concrete", treatment: "recycled" } }
    const saveWaste = () => h.json(`${c.root}/collection/activities/${crypto.randomUUID()}`, c.name, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: waste })
    const refused = await saveWaste()
    const refusal = await refused.json()
    expect([refused.status, refusal.code]).toEqual([409, "line_budget_exceeded"])
    // BF-21: this fixture is at schema 32, where 0032 counts stored Scope 3 records only, and the answer says so.
    expect(refusal.error).toBe(SCOPE3_CAPACITY_TEXT.storedLineBudgetSaveRefused(3000))
    // "Withdraw this import": a member may not; the owner withdraws all 1,000 lines in one set-based statement.
    const withdraw = (actor: string, importId: string, reason = "Imported the wrong month's ledger.") => h.json(`${c.root}/scope3/spend-imports/${importId}/withdrawal`, actor, { reason })
    const started = performance.now()
    const withdrawn = await withdraw(c.name, secondImport.id)
    const withdrawMs = Math.round(performance.now() - started)
    const done = await withdrawn.json()
    console.info(`round 3 decision 7 native: 1,000-line import withdrawn in ${withdrawMs} ms`)
    expect([withdrawn.status, done.withdrawn, done.alreadyWithdrawn]).toEqual([201, 1000, 0])
    expect(withdrawMs).toBeLessThan(IMPORT_BUDGET_MS)
    expect(await lines()).toEqual({ max: 3000, used: 2000, remaining: 1000 })
    const again = await (await withdraw(c.name, secondImport.id)).json()
    expect([again.withdrawn, again.alreadyWithdrawn]).toEqual([0, 1000])
    expect((await withdraw(c.name, crypto.randomUUID())).status).toBe(404)
    expect((await h.json(`${c.root}/scope3/spend-imports/${secondImport.id}/withdrawal`, c.name, { reason: "no" })).status).toBe(422)
    const reasons = (await h.operator.query<{ state: string; reason: string; n: string }>(`select v.state,v.withdrawal_reason reason,count(*) n from neuvetra.scope3_spend_import_lines l join neuvetra.collection_activity_heads hd on hd.record_id=l.record_id
      join neuvetra.collection_activity_versions v on v.id=hd.version_id where l.import_id=$1 group by 1,2`, [secondImport.id])).rows
    expect(reasons.map(row => [row.state, row.reason, Number(row.n)])).toEqual([["withdrawn", "Imported the wrong month's ledger.", 1000]])
    // Room again: the record save goes through.
    expect((await saveWaste()).status).toBe(201)
    // Bulk corrections (the server-side path for lane C's bulk actions): two lines of the first import get a new amount in
    // one set-based statement; changing a line's identity is refused (22023), and a stale version (23505).
    const records: any[] = (await (await h.call(`${c.root}/collection/activities`, c.name)).json()).records
    const pick = records.filter(record => record.kind === "purchase_spend" && record.currentVersion.activity.state === "active").slice(0, 2)
    const corrected = (record: any, amount: string) => ({ ...record.currentVersion.activity, quantity: { originalValue: amount, originalUnit: "USD", normalizedValue: amount, normalizedUnit: "USD" } })
    const result = await h.database.saveScope3SpendCorrections(c.owner, c.id, { reason: "Converted at the stated rate.", corrections: pick.map(record => ({ recordId: record.id, expectedVersionId: record.currentVersion.id, activity: corrected(record, "123.45") })) })
    expect(result).toEqual({ corrected: 2, unchanged: 0 })
    const stale = await h.database.saveScope3SpendCorrections(c.owner, c.id, { reason: "Again.", corrections: [{ recordId: pick[0].id, expectedVersionId: pick[0].currentVersion.id, activity: corrected(pick[0], "1.00") }] }).then(() => null, (error: { code?: string }) => error.code)
    expect(stale).toBe("23505")
    const fresh: any[] = (await (await h.call(`${c.root}/collection/activities`, c.name)).json()).records
    const head = fresh.find(record => record.id === pick[0].id)
    const identity = { ...head.currentVersion.activity, sourceId: "CHANGED-1" }
    expect(await h.database.saveScope3SpendCorrections(c.owner, c.id, { reason: "Identity change.", corrections: [{ recordId: head.id, expectedVersionId: head.currentVersion.id, activity: identity }] }).then(() => null, (error: { code?: string }) => error.code)).toBe("22023")
    expect([head.currentVersion.revision, head.currentVersion.activity.quantity.originalValue, head.currentVersion.correctionReason]).toEqual([pick[0].currentVersion.revision + 1, "123.45", "Converted at the stated rate."])
  } finally { await h.close() }
}, 900_000)

// BF-20 (backend audit BI-02, lead 1): the currency conversion writes set-based (0030's save_scope3_spend_corrections in at
// most a few chunks) instead of one save_collection_activity round trip per line. Measured on main on a 2-CPU host: 3,000
// EUR lines took 9-11 s with the company lock held 8.6 s (a colleague's save failed after the 5 s lock_timeout); with 20 ms
// per round trip 79 s. Set-based: 3.5 s (lock about 2.9 s), 4.8 s with 20 ms per round trip (lock about 3.6 s).
/** Waits until the company row lock is held by another transaction (probed with NOWAIT as the operator), up to `ms`. */
async function companyLockHeld(operator: WorkspaceConnection, companyId: string, ms: number) {
  const until = performance.now() + ms
  while (performance.now() < until) {
    const held = await operator.transaction(tx => tx.query("select 1 from neuvetra.companies where id=$1 for update nowait", [companyId])).then(() => false, () => true)
    if (held) return true
    await Bun.sleep(20)
  }
  return false
}
/** Spans during which the company row lock was seen held (20 ms NOWAIT probes) until `done()`; returns the longest span in ms. */
async function companyLockSpan(operator: WorkspaceConnection, companyId: string, done: () => boolean) {
  let first = 0, last = 0
  while (!done()) {
    const held = await operator.transaction(tx => tx.query("select 1 from neuvetra.companies where id=$1 for update nowait", [companyId])).then(() => false, () => true)
    if (held) { last = performance.now(); first ||= last }
    await Bun.sleep(20)
  }
  return first ? Math.round(last - first + 20) : 0
}

integration("BF-20 natively: a 2,990-line EUR conversion through the route; a colleague's save in the same company waits for it (refused only if the lock outlasts lock_timeout); another company's reads are served", async () => {
  const h = await harness()
  try {
    const c = await h.company("bf20-convert", [1, 4, 5, 6]), other = await h.company("bf20-other", [1, 4, 5, 6])
    const eur = (prefix: string, rows: number) => enc(new TextDecoder().decode(ledger(prefix, rows)).replaceAll(",USD,", ",EUR,"))
    for (const [prefix, rows] of [["FA", 2000], ["FB", 990]] as const) { const bytes = eur(prefix, rows); expect((await h.importFile(c, bytes, await h.upload(c.root, c.name, bytes, `${prefix}.csv`))).status).toBe(201) }
    const theirs = ledger("FO", 200); expect((await h.importFile(other, theirs, await h.upload(other.root, other.name, theirs, "o.csv"))).status).toBe(201)
    await h.operator.exec("analyze")
    const theirBefore = (await h.operator.query<{ n: string; h: string }>("select count(*) n,md5(string_agg(v.id::text||v.payload_sha256,',' order by v.id)) h from neuvetra.collection_activity_versions v where v.company_id=$1", [other.id])).rows[0]
    const gas = { locationId: c.site, setupVersionId: c.setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" },
      reference: "Synthetic colleague", notes: "", evidenceIds: [], kind: "natural_gas", sourceId: "BF20-GAS", quantity: { originalValue: "120", originalUnit: "therm", normalizedValue: "120", normalizedUnit: "therm" }, payload: { heatContent: null } }
    const started = performance.now()
    const conversion = h.json(`${c.root}/scope3/spend-currency-conversions`, c.name, { currency: "EUR", rate: "1.0823", rateSource: "ECB euro reference rate", rateDate: "2025-06-30" })
    let finished = false
    void conversion.finally(() => { finished = true })
    // The colleague saves while the conversion holds the company lock; another company's member reads meanwhile.
    expect(await companyLockHeld(h.operator, c.id, 15_000)).toBe(true)
    const reads: number[] = []
    const reading = (async () => { while (!finished) { const s = performance.now(); const r = await h.call(`${other.root}/collection/activities`, other.name); await r.arrayBuffer(); reads.push(r.status === 200 ? Math.round(performance.now() - s) : -r.status); await Bun.sleep(50) } })()
    // QA F1: the lock span is measured, not bounded here (that is timing; the lead 1 test compares it with main's).
    const span = companyLockSpan(h.operator, c.id, () => finished)
    const colleagueStart = performance.now()
    const colleague = await h.json(`${c.root}/collection/activities/${crypto.randomUUID()}`, c.name, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: gas })
    const colleagueMs = Math.round(performance.now() - colleagueStart)
    await reading
    const lockMs = await span
    const response = await conversion
    const totalMs = Math.round(performance.now() - started)
    const body = await response.json()
    console.info(`BF-20 native: 2,990-line conversion ${response.status} in ${totalMs} ms; colleague save ${colleague.status} in ${colleagueMs} ms; company lock seen held about ${lockMs} ms; other company's reads ${JSON.stringify(reads)} ms`)
    expect([response.status, body.converted.length, body.skipped.length]).toEqual([201, 2990, 0])
    // The colleague waits for the conversion and saves. QA F1: on a loaded host the lock can still outlast the 5 s lock_timeout
    // (less often than on main, where it always did at this size); then, and only then, the colleague's save is refused with
    // 503 after waiting: never another refusal, never a lost or half-converted line (checked below).
    if (colleague.status !== 201) expect([colleague.status, colleagueMs >= 4500, lockMs >= 4500]).toEqual([503, true, true])
    // Another company's reads are served throughout (no wait on this company's lock; their times are logged above).
    expect(reads.length).toBeGreaterThan(0)
    expect(reads.every(ms => ms >= 0)).toBe(true)
    // Every converted line: one revision later, in US dollars at exactly the amount the TypeScript arithmetic gives, the shared reason.
    const { scope3SpendConvertAmount } = await import("../../../../packages/neuvetra-database/src/scope3-spend-currency")
    const rows = (await h.operator.query<{ source_id: string; revision: number; original_quantity: string; normalized_quantity: string; original_unit: string; correction_reason: string; prior: string }>(`select v.source_id,v.revision,v.original_quantity,v.normalized_quantity::text,v.original_unit,v.correction_reason,p.original_quantity prior
      from neuvetra.collection_activity_heads hd join neuvetra.collection_activity_versions v on v.id=hd.version_id join neuvetra.collection_activity_versions p on p.id=v.previous_version_id where hd.company_id=$1 and v.payload->>'kind'='purchase_spend'`, [c.id])).rows
    expect(rows.length).toBe(2990)
    expect(rows.filter(r => r.revision !== 2 || r.original_unit !== "USD" || r.original_quantity !== scope3SpendConvertAmount(r.prior, "1.0823") || Number(r.normalized_quantity) !== Number(r.original_quantity)
      || r.correction_reason !== "Converted from EUR to USD at 1.0823 USD per EUR (ECB euro reference rate, rate date 2025-06-30; rounded half-even to the cent).")).toEqual([])
    // The other company's rows are untouched.
    expect((await h.operator.query<{ n: string; h: string }>("select count(*) n,md5(string_agg(v.id::text||v.payload_sha256,',' order by v.id)) h from neuvetra.collection_activity_versions v where v.company_id=$1", [other.id])).rows[0]).toEqual(theirBefore)
  } finally { await h.close() }
}, 900_000)

integration("BF-20 natively (lead 1): with 20 ms per database round trip the set-based conversion makes 6 round trips (main: one per line) and holds the company lock a small fraction of main's time, measured on the same data in the same run", async () => {
  const h = await harness()
  // A loopback TCP proxy that delays every chunk 10 ms in each direction (order kept), in front of the same database.
  type Side = { peer?: { write(b: Uint8Array): number; end(): void }; queue: Promise<unknown>; pending?: Uint8Array[] }
  const delayed = (side: Side, to: { write(b: Uint8Array): number }, bytes: Uint8Array) => { const due = performance.now() + 10; side.queue = side.queue.then(() => Bun.sleep(Math.max(0, due - performance.now()))).then(() => to.write(bytes)) }
  const target = new URL(process.env.M63_API_TEST_DATABASE_URL!)
  const proxy = Bun.listen<Side>({ hostname: "127.0.0.1", port: 0, socket: {
    open(client) {
      client.data = { queue: Promise.resolve() }
      void Bun.connect<Side>({ hostname: target.hostname, port: Number(target.port), socket: {
        open(up) { up.data = { peer: client, queue: Promise.resolve() }; client.data.peer = up; for (const b of client.data.pending ?? []) delayed(client.data, up, b) },
        data(up, bytes) { delayed(up.data, client, new Uint8Array(bytes)) }, close() { client.end() }, error() { client.end() } } })
    },
    data(client, bytes) { const copy = new Uint8Array(bytes); if (client.data.peer) delayed(client.data, client.data.peer, copy); else (client.data.pending ??= []).push(copy) },
    close(client) { client.data.peer?.end() }, error(client) { client.data.peer?.end() } } })
  const slowUrl = new URL(target); slowUrl.username = "neuvetra_runtime"; slowUrl.port = String(proxy.port)
  const slow = createPostgresConnection(slowUrl.toString(), { tls: false, maxConnections: 2 })
  const { asActor } = await import("../../../../packages/neuvetra-database/src/scope3-currency-differential.fixture")
  const { convertScope3SpendCurrency } = await import("../../../../packages/neuvetra-database/src/scope3-spend-imports")
  const { convertScope3SpendCurrencyPerLineReference } = await import("../../../../packages/neuvetra-database/src/scope3-spend-currency-per-line.reference")
  const slowDb = { query: slow.query.bind(slow), exec: slow.exec.bind(slow), transaction: slow.transaction.bind(slow), close: () => slow.close() }
  try {
    // QA F1: no wall-clock bound (a loaded host stretches both). Main's per-line path and the set-based path run on the same
    // 1,000 lines through the same proxy (main's rolled back), and the test asserts what does not depend on load: the exact
    // round trips, and the set-based lock span as a small fraction of main's.
    const LINES = 1000
    const c = await h.company("bf20-latency", [1, 4, 5, 6])
    const bytes = enc(new TextDecoder().decode(ledger("LA", LINES)).replaceAll(",USD,", ",EUR,"))
    expect((await h.importFile(c, bytes, await h.upload(c.root, c.name, bytes, "LA.csv"))).status).toBe(201)
    // One round trip through the proxy takes at least 20 ms.
    const ping = performance.now(); await slow.query("select 1"); await slow.query("select 1")
    expect((performance.now() - ping) / 2).toBeGreaterThanOrEqual(19)
    const input = { currency: "EUR", rate: "1.0823", rateSource: "ECB euro reference rate", rateDate: "2025-06-30" }
    const measure = async (convert: (tx: WorkspaceSql, actor: string, company: string, input: unknown) => Promise<{ converted: Array<{ sourceId: string; usd: string }> }>, keep: boolean) => {
      let trips = 0, finished = false
      const counted = (tx: WorkspaceSql): WorkspaceSql => ({ query: (sql, args) => { trips++; return tx.query(sql, args) }, exec: sql => { trips++; return tx.exec(sql) } })
      const run = asActor(slowDb, c.owner, tx => convert(counted(tx), c.owner, c.id, input), { keep }).finally(() => { finished = true })
      const lockMs = await companyLockSpan(h.operator, c.id, () => finished)
      const { value } = await run
      return { trips, lockMs, converted: value.converted.map(line => `${line.sourceId}=${line.usd}`).sort() }
    }
    const main = await measure((tx, actor, company, body) => convertScope3SpendCurrencyPerLineReference(tx, actor, company, body), false)
    const setBased = await measure(convertScope3SpendCurrency, true)
    console.info(`BF-20 native lead 1: ${LINES} lines at 20 ms per round trip: main ${main.trips} round trips, lock about ${main.lockMs} ms; set-based ${setBased.trips} round trips, lock about ${setBased.lockMs} ms`)
    // The same lines converted to the same amounts.
    expect(setBased.converted).toEqual(main.converted)
    expect(setBased.converted.length).toBe(LINES)
    // Round trips: main 4 + one per line (actor, setup, read, N saves, read-back); set-based 6 (actor, setup, read, actor + one
    // save_scope3_spend_corrections for the single chunk, read-back).
    expect([main.trips, setBased.trips]).toEqual([LINES + 4, 6])
    // The lock: main holds it for every per-line round trip (at least LINES x 20 ms); set-based a small fraction of that.
    expect(main.lockMs).toBeGreaterThan(LINES * 20)
    expect(setBased.lockMs).toBeGreaterThan(0)
    expect(setBased.lockMs).toBeLessThan(main.lockMs * 0.25)
  } finally { await slow.close(); proxy.stop(true); await h.close() }
}, 900_000)

integration("BF-20 natively: differential at 3,000 lines (two chunks): the per-line reference of main and the set-based conversion store identical rows", async () => {
  const { seedCompany, differential } = await import("../../../../packages/neuvetra-database/src/scope3-currency-differential.fixture")
  const operator = createPostgresConnection(process.env.M63_API_TEST_DATABASE_URL!, { tls: false })
  const db = { query: operator.query.bind(operator), exec: operator.exec.bind(operator), transaction: operator.transaction.bind(operator), close: () => operator.close() }
  try {
    const hex = () => crypto.randomUUID().slice(0, 8)
    const other = await seedCompany(db, 11, [100, 100], { prefix: hex() })
    const fx = await seedCompany(db, 12, [2000, 1000], { prefix: hex(), currencies: ["EUR"], plain: true })
    const result = await differential(db, fx, other, { currency: "EUR", rate: "1.0823", rateSource: "ECB euro reference rate", rateDate: "2025-06-30" })
    console.info(`BF-20 native differential: ${result.converted} converted, ${result.skipped} skipped, ${result.chunks} chunks, ${result.rows} rows compared, ${result.mismatches} mismatches`)
    expect([result.converted, result.mismatches, result.refused]).toEqual([3000, 0, null])
    expect(result.chunks).toBeGreaterThan(1)
  } finally { await operator.close() }
}, 900_000)

// --- BF-21 (BI-03 option C; CEO decision and ruling, 13 November 2026) -----------------------------------------------------
// An existing-project database at schema 31 (hosted staging until the owner applies 0032) and at 32, through the real server.
// At 31 nothing changes: 0030's count, in which category 3 lines derived from Scope 1 and 2 records count. At 32 the API
// counts as 0032 does (stored Scope 3 records only), so a Scope 1 or 2 save never locks Scope 3 results or report versions;
// the save that would pass 3,000 stored lines is the one refused, saying so; a setup save that takes the count over is saved
// with a warning, and results then say why and how to recover. At both schemas a version whose two texts are too large to
// store within the backend's memory budget is refused before any call, saying what is too large and what to do.
async function bf21Server(schema: 31 | 32, name: string) {
  const fixture = await createStagingSchemaFixture(target!, name, schema, EXISTING_PROJECT_REF)
  const operator = fixture.operator
  const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string, reuse: boolean) => HostedWorkspaceDatabase)(createPostgresConnection(fixture.runtimeUrl, { tls: false, maxConnections: 4 }), EXISTING_PROJECT_REF, true)
  const ORIGIN = "http://127.0.0.1:3017", ref = EXISTING_PROJECT_REF
  const config = readStagingConfig({ NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: ref, NEUVETRA_STAGING_ORIGIN: ORIGIN, SUPABASE_URL: `https://${ref}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key", DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${ref}.supabase.co:5432/postgres`, NEUVETRA_STAGING_REUSE_EXISTING: "confirmed" })
  const users = new Map<string, string>(), stored = new Map<string, Uint8Array<ArrayBuffer>>()
  const app = await createStagingServer(config, { database, collectionEvidenceStorage: { put: async (_t: string, _b: string, key: string, bytes: Uint8Array<ArrayBuffer>) => { stored.set(key, bytes) }, get: async (_t: string, _b: string, key: string) => stored.get(key)! },
    validateUser: async token => users.has(token) ? { id: users.get(token)!, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, serveAsset: async () => null, log: () => {} })
  const raw = (actor: string, method: string, route: string, body?: BodyInit, type?: string, extra: Record<string, string> = {}) => app.fetch(new Request(`${ORIGIN}${route === "/ready" ? "" : "/workspace-api"}${route}`, { method, body, headers: { origin: ORIGIN, authorization: `Bearer ${actor}`, ...(type ? { "content-type": type } : {}), ...extra } }))
  const call = async (actor: string, method: string, route: string, body?: unknown) => { const r = await raw(actor, method, route, body === undefined ? undefined : JSON.stringify(body), body === undefined ? undefined : "application/json"); return { status: r.status, body: await r.json() as any } }
  /** A company whose setup includes Scope 3 categories 1, 4, 5 and 6, and category 3 when `category3`. */
  const company = async (actor: string, category3: boolean) => {
    const owner = crypto.randomUUID(), id = crypto.randomUUID()
    users.set(actor, owner)
    await operator.query("insert into auth.users(id) values($1)", [owner])
    await operator.transaction(async tx => {
      await tx.query("insert into neuvetra.staging_access(user_id,active) values($1,true)", [owner])
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
      await tx.query("select neuvetra.create_company_workspace($1,'Synthetic Acme, Inc.',$2,'Synthetic California office',$3,2023,$4)", [id, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()])
      await tx.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner') on conflict(company_id,user_id) do update set role=excluded.role", [id, owner])
      await tx.query("update neuvetra.staging_access set company_id=$2,active=true where user_id=$1", [owner, id])
    })
    const base = createSyntheticCompanySetup(), site = { ...base.locations[0]!, inclusion: "included" as const, control: "reporting_company" as const, startMode: "period_start" as const, endMode: "period_end" as const }
    const setupBody = (withCategory3: boolean) => ({ ...base, boundary: { ...base.boundary, approach: "operational_control" as const }, entities: base.entities.map(e => ({ ...e, inclusion: "included" as const, control: "operational_control" as const })), locations: [site],
      screening: [...base.screening.filter(s => s.scope !== 3), ...[1, 3, 4, 5, 6, 7].map(category => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[category - 1]!, state: category === 3 && !withCategory3 ? "no" as const : "yes" as const, reason: category === 3 && !withCategory3 ? "Not material this year." : "", details: `Synthetic category ${category}.`, locationId: null }))] })
    const first = await call(actor, "POST", `/workspace/${id}/setup`, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup: setupBody(category3) })
    expect(first.status).toBe(201)
    const c = { actor, owner, id, root: `/workspace/${id}`, site: site.id, setupVersionId: first.body.savedVersion.id as string, setupRevision: 1, setupBody }
    return c
  }
  const close = async () => { await app.close?.(); await database.close(); await fixture.close() }
  return { operator, database, app, raw, call, company, close, ORIGIN }
}
type Bf21 = Awaited<ReturnType<typeof bf21Server>>
type Bf21Company = Awaited<ReturnType<Bf21["company"]>>
const bf21Activities = (s: Bf21, c: Bf21Company) => {
  const common = () => ({ locationId: c.site, setupVersionId: c.setupVersionId, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic BF-21", notes: "", evidenceIds: [] })
  const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
  const save = (activity: unknown) => s.call(c.actor, "POST", `${c.root}/collection/activities/${crypto.randomUUID()}`, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity })
  return {
    save,
    gas: (id: string) => save({ ...common(), kind: "natural_gas", sourceId: id, quantity: q("1250", "therm"), payload: { heatContent: null } }),
    electricity: (id: string) => save({ ...common(), kind: "electricity", sourceId: id, quantity: q("25000", "kWh"), payload: { meterOrAccountNumber: id, utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } }),
    waste: (id: string) => save({ ...common(), kind: "waste", sourceId: id, quantity: q("1.5", "metric_ton"), payload: { category: 5, material: "asphalt_concrete", treatment: "recycled" } }),
    resold: (id: string) => save({ ...common(), kind: "energy_resold", sourceId: id, quantity: q("10", "MWh"), payload: { gridBasis: "subregion", zip: "94105", subregion: "CAMX", utilityEiaId: null, resoldEnergyNotInScope2: true } }),
    results: async () => { const r = await s.call(c.actor, "GET", `${c.root}/results/scope3`); return { status: r.status, code: r.body.code ?? null, lines: r.body.records?.length ?? null, lineBudget: r.body.lineBudget ?? null, error: r.body.error ?? null } },
    prepare: async (expectedRevision: number) => { const r = await s.call(c.actor, "POST", `${c.root}/scope3/reports`, { idempotencyKey: crypto.randomUUID(), expectedRevision, reason: expectedRevision ? "Again after a change." : null }); return { status: r.status, code: r.body.code ?? null, error: r.body.error ?? null, size: r.body.size ?? null } },
    importFile: async (bytes: Uint8Array<ArrayBuffer>, file: string) => {
      const up = await s.raw(c.actor, "POST", `${c.root}/collection/evidence`, bytes, "text/csv", { "x-neuvetra-original-name": file, "x-neuvetra-upload-id": crypto.randomUUID() })
      expect(up.status).toBe(201)
      const r = await s.raw(c.actor, "POST", `${c.root}/scope3/spend-imports?evidenceId=${(await up.json() as any).receipt.evidenceId}&locationId=${c.site}`, bytes, "text/csv")
      return { status: r.status, body: await r.json() as any }
    },
    withdrawImport: (importId: string) => s.call(c.actor, "POST", `${c.root}/scope3/spend-imports/${importId}/withdrawal`, { reason: "Imported the wrong ledger." }),
    withdrawKind: async (kind: string, n: number) => {
      const all = (await s.call(c.actor, "GET", `${c.root}/collection/activities`)).body.records as any[]
      for (const r of all.filter(r => r.kind === kind && r.currentVersion.activity.state === "active").slice(0, n))
        expect(await s.call(c.actor, "POST", `${c.root}/collection/activities/${r.id}`, { idempotencyKey: crypto.randomUUID(), expectedRevision: r.currentVersion.revision, expectedVersionId: r.currentVersion.id, correctionReason: "Not ours.", activity: { ...r.currentVersion.activity, setupVersionId: c.setupVersionId, state: "withdrawn", withdrawalReason: "Not ours." } })).toMatchObject({ status: 201 })
    },
    setup: async (withCategory3: boolean) => {
      const r = await s.call(c.actor, "POST", `${c.root}/setup`, { idempotencyKey: crypto.randomUUID(), expectedRevision: c.setupRevision, expectedVersionId: c.setupVersionId, correctionReason: "Screening changed.", setup: c.setupBody(withCategory3) })
      if (r.status === 201) { c.setupVersionId = r.body.savedVersion.id; c.setupRevision++ }
      return r
    },
    count: async () => Number((await s.operator.query<{ n: number }>("select neuvetra.scope3_active_line_count($1) n", [c.id])).rows[0]!.n),
  }
}
const BF21_LISTED_OVER = "More than 3,000 active Scope 3 lines. Withdraw lines you no longer need (withdrawn lines don’t count) to calculate again."
const BF21_LISTED_SAVE = "This would take Scope 3 past its limit of 3,000 active lines, so nothing was saved. Category 3 lines derived from electricity and fuel records count too. Withdraw lines or a whole import you no longer need (withdrawn lines don’t count), then try again."

integration("BF-21 at schema 31: the line budget answers exactly as before (0030's count; a Scope 1 or 2 save past 3,000 still locks Scope 3 results)", async () => {
  const s = await bf21Server(31, "m63_bf21_schema31")
  try {
    expect((await s.call("x", "GET", "/ready")).body.schemaVersion).toBe(31)
    const c = await s.company("bf21-31", true), a = bf21Activities(s, c)
    expect([(await a.importFile(ledger("A", 2000), "a.csv")).status, (await a.importFile(ledger("B", 1000), "b.csv")).status]).toEqual([201, 201])
    expect(await a.results()).toEqual({ status: 200, code: null, lines: 3000, lineBudget: { max: 3000, used: 3000, remaining: 0 }, error: null })
    // BI-03 as it is at 31 (fixed by 0032 with BF-21): the gas save is accepted and Scope 3 is refused until lines are withdrawn.
    expect((await a.gas("GAS-1")).status).toBe(201)
    expect([await a.count(), await a.results()]).toEqual([3001, { status: 422, code: "line_budget_exceeded", lines: null, lineBudget: null, error: BF21_LISTED_OVER }])
    expect(await a.prepare(0)).toEqual({ status: 422, code: "line_budget_exceeded", error: BF21_LISTED_OVER, size: null })
    expect(await a.waste("W-1")).toEqual({ status: 409, body: { code: "line_budget_exceeded", error: BF21_LISTED_SAVE } })
    const b = (await s.call(c.actor, "GET", `${c.root}/scope3/spend-imports`)).body.imports.find((item: any) => item.rowCount === 1000)
    expect((await a.withdrawImport(b.id)).status).toBe(201)
    expect((await a.waste("W-2")).status).toBe(201)
    // The import pre-check counts every listed line: 2,002 in use, so 999 more are refused.
    const c999 = await a.importFile(ledger("C", 999), "c.csv")
    expect([c999.status, c999.body.lineBudget, c999.body.error]).toEqual([409, { max: 3000, used: 2002, remaining: 998 }, "This would take Scope 3 past its limit of 3,000 active lines (2,002 in use, 999 more). Withdraw lines you no longer need, or import a smaller file. Nothing was saved."])
    // A setup save that includes category 3 carries no warning at 31 (the answer is exactly as before).
    expect(Object.keys((await a.setup(false)).body).sort()).toEqual(["foundation", "replayed", "savedVersion"])
    expect(Object.keys((await a.setup(true)).body).sort()).toEqual(["foundation", "replayed", "savedVersion"])
    expect((await a.prepare(0)).status).toBe(201)
  } finally { await s.close() }
}, 900_000)

integration("BF-21 at schema 32: Scope 1 and 2 saves never lock Scope 3; the save that would pass 3,000 stored lines is refused; a setup save that does is saved with a warning and results say how to recover", async () => {
  const s = await bf21Server(32, "m63_bf21_schema32")
  try {
    expect((await s.call("x", "GET", "/ready")).body.schemaVersion).toBe(32)
    const c = await s.company("bf21-32", true), a = bf21Activities(s, c)
    expect([(await a.importFile(ledger("A", 2000), "a.csv")).status, (await a.importFile(ledger("B", 1000), "b.csv")).status]).toEqual([201, 201])
    expect([await a.count(), await a.results()]).toEqual([3000, { status: 200, code: null, lines: 3000, lineBudget: { max: 3000, used: 3000, remaining: 0 }, error: null }])
    // BI-03: the Scope 1 gas and Scope 2 electricity saves at 3,000 stored lines change nothing in the count; results and a
    // report version are still produced (before BF-21: 422 line_budget_exceeded until Scope 3 lines were withdrawn).
    expect([(await a.gas("GAS-1")).status, (await a.electricity("M-1")).status]).toEqual([201, 201])
    expect([await a.count(), await a.results()]).toEqual([3000, { status: 200, code: null, lines: 3004, lineBudget: { max: 3004, used: 3004, remaining: 0 }, error: null }])
    expect(await a.prepare(0)).toEqual({ status: 201, code: null, error: null, size: null })
    // The Scope 3 save that would pass 3,000 stored lines is the one refused, saying what counts.
    expect(await a.waste("W-1")).toEqual({ status: 409, body: { code: "line_budget_exceeded", error: SCOPE3_CAPACITY_TEXT.storedLineBudgetSaveRefused(3000) } })
    const b = (await s.call(c.actor, "GET", `${c.root}/scope3/spend-imports`)).body.imports.find((item: any) => item.rowCount === 1000)
    expect((await a.withdrawImport(b.id)).status).toBe(201)
    expect((await a.waste("W-2")).status).toBe(201)
    // The import pre-check counts as 0032 does: 2,001 stored, so 999 more fit exactly (before BF-21: refused, "2,005 in use").
    const c999 = await a.importFile(ledger("C", 999), "c.csv")
    expect([c999.status, await a.count()]).toEqual([201, 3000])
    expect(await a.results()).toEqual({ status: 200, code: null, lines: 3004, lineBudget: { max: 3004, used: 3004, remaining: 0 }, error: null })
    const one = await a.importFile(ledger("D", 1), "d.csv")
    expect([one.status, one.body.lineBudget, one.body.error]).toEqual([409, { max: 3004, used: 3004, remaining: 0 }, SCOPE3_CAPACITY_TEXT.storedLineBudgetExceeded(3000, 3000, 1)])
    expect(await a.prepare(1)).toEqual({ status: 201, code: null, error: null, size: null })
    // The setup path: the 999-line import withdrawn (2,001 stored), category 3 excluded, four energy-resold records saved (one
    // line each) and a 995-line file imported: 3,000 stored. Category 3 included again (each energy-resold record then counts
    // twice): 3,004. Nothing refuses a setup save for Scope 3 volume; it is saved with a warning, which the web's own decoder
    // accepts.
    expect((await a.withdrawImport(c999.body.import.id)).status).toBe(201)
    expect(Object.keys((await a.setup(false)).body).sort()).toEqual(["foundation", "replayed", "savedVersion"])
    for (const i of [1, 2, 3, 4]) expect((await a.resold(`RES-${i}`)).status).toBe(201)
    expect((await a.importFile(ledger("E", 995), "e.csv")).status).toBe(201)
    expect(await a.count()).toBe(3000)
    const { saveCompanySetup } = await import("../../../site-web/src/lib/company-setup-api")
    const originalFetch = globalThis.fetch
    let warned: any = null
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await s.app.fetch(new Request(`${s.ORIGIN}${String(input)}`, { ...init, headers: { ...(init?.headers as Record<string, string>), origin: s.ORIGIN } }))
      warned = await response.clone().json()
      return response
    }) as typeof fetch
    let decoded: Awaited<ReturnType<typeof saveCompanySetup>>
    try {
      decoded = await saveCompanySetup(c.id, { idempotencyKey: crypto.randomUUID(), expectedRevision: c.setupRevision, expectedVersionId: c.setupVersionId, correctionReason: "Category 3 included again.", setup: c.setupBody(true) as never }, { accessToken: c.actor, userId: c.owner, role: "owner" })
    } finally { globalThis.fetch = originalFetch }
    c.setupVersionId = decoded.savedVersion.id; c.setupRevision++
    expect(warned.warnings).toEqual([{ code: "scope3_line_budget_exceeded", lineBudget: { max: 3000, used: 3004 }, message: SCOPE3_CAPACITY_TEXT.setupOverLineBudget(3000, 3004) }])
    expect(await a.count()).toBe(3004)
    // Results and report versions then say why and how to recover; Scope 1 and 2 saves still go through.
    const over = { status: 422, code: "line_budget_exceeded", lines: null, lineBudget: { max: 3000, used: 3004 }, error: SCOPE3_CAPACITY_TEXT.storedResultsOverBudget(3000, 3004) }
    expect(await a.results()).toEqual(over)
    expect(await a.prepare(2)).toEqual({ status: 422, code: "line_budget_exceeded", error: over.error, size: null })
    expect((await a.gas("GAS-2")).status).toBe(201)
    expect((await s.call(c.actor, "GET", `${c.root}/results`)).status).toBe(200)
    // Recovery, either way the answer names: excluding category 3 again, or withdrawing lines (two energy-resold records).
    expect((await a.setup(false)).status).toBe(201)
    expect((await a.results()).status).toBe(200)
    expect((await a.setup(true)).body.warnings).toHaveLength(1)
    await a.withdrawKind("energy_resold", 2)
    expect([await a.count(), (await a.results()).status, (await a.prepare(2)).status]).toEqual([3000, 200, 201])
  } finally { await s.close() }
}, 900_000)

// BF-21 (CEO ruling): the two texts together are refused before any call over SCOPE3_REPORT_MAX_COMBINED_TEXT_BYTES
// (158,000,000), which keeps the storing database backend near 650 MiB (measured), with a truthful, recoverable answer. At 31:
// 400 electricity records with 100 certificates each (category 3 included) and 700 worst-case commuting records come to about
// 163 MB; before BF-21 this prepared (each text under 128 MiB) with the backend near the 768 MiB budget.
const bf21Files = async (s: Bf21, c: Bf21Company) => {
  const files = Array.from({ length: 20 }, () => crypto.randomUUID())
  for (const [i, file] of files.entries()) await s.operator.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,$4,'application/pdf',1,$5,$6)",
    [file, c.id, `${c.id}/original/${file}`, `${String(i).padStart(4, "0")}${"E".repeat(247)}.pdf`, "f".repeat(62) + i.toString(16).padStart(2, "0"), c.owner])
  return files
}
/** `count` electricity records at the field maximums with `certificates` certificates each (identity keys at schema 32). */
async function bf21CertificateHeavy(s: Bf21, c: Bf21Company, files: string[], count: number, certificates: number, identity: boolean) {
  for (let i = 0; i < count; i++) {
    const meter = `${String(i).padStart(6, "0")}${"M".repeat(114)}`
    const instruments = Array.from({ length: certificates }, (_, k) => ({ type: "energy_attribute_certificate", mwh: "9".repeat(100), qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: files[k % 20], generationTechnology: "solar_photovoltaic",
      rateLbPerMwh: { co2: "9".repeat(100), ch4: "9".repeat(100), n2o: "9".repeat(100) }, ...(identity ? { instrumentId: `${String(k).padStart(4, "0")}${"I".repeat(116)}`, registry: "G".repeat(80), faceMwh: "999999999999.999" } : {}) }))
    const request = { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: { locationId: c.site, setupVersionId: c.setupVersionId, state: "active", withdrawalReason: null, quality: "estimated", estimateBasis: "B".repeat(2000), period: { start: "2025-01-01", endExclusive: "2026-01-01" },
      reference: "R".repeat(1000), notes: "N".repeat(4000), evidenceIds: files, kind: "electricity", sourceId: meter, quantity: { originalValue: String(250000 + i), originalUnit: "kWh", normalizedValue: String(250000 + i), normalizedUnit: "kWh" },
      payload: { meterOrAccountNumber: meter, utilityName: "U".repeat(200), site: "S".repeat(200), zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments } } }
    validateCollectionSaveInput(request) // the API's own contract accepts it
    await s.database.saveCollectionActivity(c.owner, c.id, crypto.randomUUID(), request as never)
  }
}
async function bf21Commuting(s: Bf21, c: Bf21Company, files: string[], count: number) {
  const vehicles = ["passenger_car", "light_duty_truck", "motorcycle"]
  const modes = [...vehicles, "intercity_rail_northeast_corridor", "intercity_rail_other_routes", "intercity_rail_national_average", "commuter_rail", "transit_rail", "bus", "non_motorized"]
    .map(mode => ({ mode, sharePercent: "10", oneWayDistance: "999999999999.999", distanceUnit: "km", occupancy: vehicles.includes(mode) ? "3.333" : null }))
  const dataQuality = { indicators: { technological: "very_good", temporal: "very_good", geographical: "very_good", completeness: "very_good", reliability: "very_good" }, activityDataOrigin: "value_chain_partner", basis: "D".repeat(500) }
  for (let i = 0; i < count; i++) {
    const employees = `${999999999999 - i}.999`
    await s.database.saveCollectionActivity(c.owner, c.id, crypto.randomUUID(), { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: { locationId: c.site, setupVersionId: c.setupVersionId, state: "active", withdrawalReason: null, quality: "estimated", estimateBasis: "B".repeat(2000), period: { start: "2025-01-01", endExclusive: "2026-01-01" },
      reference: "R".repeat(1000), notes: "N".repeat(4000), evidenceIds: files, kind: "commuting_average", sourceId: `${String(i).padStart(6, "0")}${"S".repeat(114)}`,
      quantity: { originalValue: employees, originalUnit: "employee", normalizedValue: employees, normalizedUnit: "employee" },
      payload: { workingDays: 365, modes, sharesBasis: "H".repeat(300), distanceBasis: "K".repeat(300), activityOverlap: "none_confirmed", dataQuality } } } as never)
  }
}

integration("BF-21 at schema 31: a version whose texts together pass 158,000,000 bytes is refused before any call, saying what is too large and what to do", async () => {
  const s = await bf21Server(31, "m63_bf21_size31")
  try {
    const c = await s.company("bf21-size31", true), a = bf21Activities(s, c), files = await bf21Files(s, c)
    await bf21CertificateHeavy(s, c, files, 400, 100, false)
    await bf21Commuting(s, c, files, 700)
    const before = Number((await s.operator.query<{ n: string }>("select count(*) n from neuvetra.scope3_report_versions where company_id=$1", [c.id])).rows[0]!.n)
    const refused = await a.prepare(0)
    console.info(`BF-21 native (31): ${JSON.stringify(refused.size)}`)
    expect([refused.status, refused.code]).toEqual([413, "report_too_large"])
    expect(refused.size.reportBytes + refused.size.csvBytes).toBeGreaterThan(SCOPE3_REPORT_MAX_COMBINED_TEXT_BYTES)
    expect(Math.max(refused.size.reportBytes, refused.size.csvBytes)).toBeLessThanOrEqual(SCOPE3_REPORT_MAX_TEXT_BYTES) // 0030 alone would have stored it
    expect(refused.error).toBe(SCOPE3_CAPACITY_TEXT.reportTooLarge(refused.size))
    expect(refused.size.lines).toBe(1900)
    expect(Number((await s.operator.query<{ n: string }>("select count(*) n from neuvetra.scope3_report_versions where company_id=$1", [c.id])).rows[0]!.n)).toBe(before)
    // The way back the answer names: excluding category 3 removes the 1,200 lines that repeat the certificates.
    expect((await a.setup(false)).status).toBe(201)
    expect((await a.prepare(0)).status).toBe(201)
  } finally { await s.close() }
}, 900_000)

// BF-21 (CEO ruling, item 4; the fix is BF-31): today's behaviour for a certificate-heavy company at schema 32. 400 electricity
// records with 100 certificates each, identity keys included, and category 3 included: each certificate is repeated on the
// three category 3 lines of its record, so the report text alone is about 139 MB with no Scope 3 record at all. Results are
// produced; a report version is refused before any call, with the truthful answer (before BF-21: "larger than a frozen
// version can store" and no way out).
integration("BF-21 at schema 32: a certificate-heavy company (400 electricity records x 100 certificates) is refused a report version with the truthful answer (BF-31 documents the fix)", async () => {
  const s = await bf21Server(32, "m63_bf21_size32")
  try {
    const c = await s.company("bf21-size32", true), a = bf21Activities(s, c), files = await bf21Files(s, c)
    await bf21CertificateHeavy(s, c, files, 400, 100, true)
    const results = await a.results()
    expect([results.status, results.lines, results.lineBudget]).toEqual([200, 1200, { max: 4200, used: 1200, remaining: 3000 }])
    const refused = await a.prepare(0)
    console.info(`BF-21 native (32): ${JSON.stringify(refused.size)}`)
    expect([refused.status, refused.code, refused.size.lines]).toEqual([413, "report_too_large", 1200])
    expect(refused.size.reportBytes).toBeGreaterThan(SCOPE3_REPORT_MAX_TEXT_BYTES)
    expect(refused.error).toBe(SCOPE3_CAPACITY_TEXT.reportTooLarge(refused.size))
    expect(refused.error).toContain("enter fewer certificates per electricity record, or exclude category 3 in company setup")
    expect((await a.setup(false)).status).toBe(201)
    expect((await a.prepare(0)).status).toBe(201)
  } finally { await s.close() }
}, 900_000)

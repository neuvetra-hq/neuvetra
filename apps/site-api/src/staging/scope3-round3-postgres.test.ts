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
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, type WorkspaceConnection } from "@neuvetra/database"
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

async function harness() {
  const operator = createPostgresConnection(target!, { tls: false })
  const runtimeUrl = new URL(target!); runtimeUrl.username = "neuvetra_runtime"
  const runtime = createPostgresConnection(runtimeUrl.toString(), { tls: false, maxConnections: 6 })
  const database = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(runtime, REF)
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
  return { operator, runtime, database, call, json, company, upload, importFile, explain, close, register }
}

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
    expect(refusal.error).toContain("3,000 active lines")
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
    const held = await operator.transaction(async tx => { try { await tx.query("select 1 from neuvetra.companies where id=$1 for update nowait", [companyId]); return false } catch { return true } })
    if (held) return true
    await Bun.sleep(20)
  }
  return false
}
/** Spans during which the company row lock was seen held (20 ms NOWAIT probes) until `done()`; returns the longest span in ms. */
async function companyLockSpan(operator: WorkspaceConnection, companyId: string, done: () => boolean) {
  let first = 0, last = 0
  while (!done()) {
    const held = await operator.transaction(async tx => { try { await tx.query("select 1 from neuvetra.companies where id=$1 for update nowait", [companyId]); return false } catch { return true } })
    if (held) { last = performance.now(); first ||= last }
    await Bun.sleep(20)
  }
  return first ? Math.round(last - first + 20) : 0
}

integration("BF-20 natively: a 2,990-line EUR conversion through the route is set-based; a colleague's save in the same company waits and succeeds; another company's reads stay fast", async () => {
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
    const colleagueStart = performance.now()
    const colleague = await h.json(`${c.root}/collection/activities/${crypto.randomUUID()}`, c.name, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: gas })
    const colleagueMs = Math.round(performance.now() - colleagueStart)
    await reading
    const response = await conversion
    const totalMs = Math.round(performance.now() - started)
    const body = await response.json()
    console.info(`BF-20 native: 2,990-line conversion ${response.status} in ${totalMs} ms; colleague save ${colleague.status} in ${colleagueMs} ms; other company's reads ${JSON.stringify(reads)} ms`)
    expect([response.status, body.converted.length, body.skipped.length]).toEqual([201, 2990, 0])
    // Main: a colleague's save failed after the 5 s lock_timeout (503); now it waits for the conversion and saves.
    expect(colleague.status).toBe(201)
    expect(colleagueMs).toBeLessThan(5000)
    expect(totalMs).toBeLessThan(IMPORT_BUDGET_MS)
    expect(reads.length).toBeGreaterThan(0)
    expect(reads.every(ms => ms >= 0 && ms < 2000)).toBe(true)
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

integration("BF-20 natively (lead 1): with 20 ms per database round trip a 2,990-line conversion holds the company lock well inside the 5 s lock_timeout", async () => {
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
  const slowDatabase = new (HostedWorkspaceDatabase as unknown as new (db: WorkspaceConnection, ref: string) => HostedWorkspaceDatabase)(slow, REF)
  try {
    const c = await h.company("bf20-latency", [1, 4, 5, 6])
    const eur = (prefix: string, rows: number) => enc(new TextDecoder().decode(ledger(prefix, rows)).replaceAll(",USD,", ",EUR,"))
    for (const [prefix, rows] of [["LA", 2000], ["LB", 990]] as const) { const bytes = eur(prefix, rows); expect((await h.importFile(c, bytes, await h.upload(c.root, c.name, bytes, `${prefix}.csv`))).status).toBe(201) }
    // One round trip through the proxy takes at least 20 ms.
    const ping = performance.now(); await slow.query("select 1"); await slow.query("select 1")
    expect((performance.now() - ping) / 2).toBeGreaterThanOrEqual(19)
    let finished = false
    const started = performance.now()
    const conversion = slowDatabase.convertScope3SpendCurrency(c.owner, c.id, { currency: "EUR", rate: "1.0823", rateSource: "ECB euro reference rate", rateDate: "2025-06-30" }).finally(() => { finished = true })
    const lockMs = await companyLockSpan(h.operator, c.id, () => finished)
    const done = await conversion
    const totalMs = Math.round(performance.now() - started)
    console.info(`BF-20 native lead 1: 2,990 lines at 20 ms per round trip converted in ${totalMs} ms, company lock held about ${lockMs} ms (main: 79 s, lock about 78 s)`)
    expect(done.converted.length).toBe(2990)
    expect(lockMs).toBeGreaterThan(0)
    expect(lockMs).toBeLessThan(5000)
    expect(totalMs).toBeLessThan(IMPORT_BUDGET_MS)
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

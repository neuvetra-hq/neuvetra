// BF-19 (BI-02): the per-instance bulk-write gate. One bulk spend write at a time (import, currency conversion, mapping
// correction, import withdrawal); a second is refused with 503 bulk_write_busy and Retry-After before any database call;
// the gate is released on every path (answer, refusal, thrown error, database timeout, client abort), and a hold that
// never ends frees itself.
import { afterEach, describe, expect, test } from "bun:test"
import type { CompanySetupView } from "@neuvetra/database"
import { BULK_WRITE_BUSY, BULK_WRITE_RETRY_SECONDS, createBulkWriteGate, type BulkWriteGate } from "./bulk-write-gate"
import { createScope3SpendImportRoutes, type Scope3SpendImportRouteDatabase } from "./scope3-spend-import-routes"

const company = "93910000-0000-4000-8000-000000000001", setupId = "93910000-0000-4000-8000-000000000002", owner = "93910000-0000-4000-8000-0000000000a1"
const location = "93910000-0000-4000-8000-0000000000b1", evidenceId = "93910000-0000-4000-8000-0000000000e1", importId = "93910000-0000-4000-8000-0000000000f1"
const ORIGIN = "https://staging.example.test"
const root = `/workspace/${company}/scope3`
const setup = (canManage = true) => ({ profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage, history: [], currentVersion: { id: setupId, companyId: company, revision: 1,
  setup: { reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: { approach: "operational_control" }, locations: [{ id: location, name: "HQ", inclusion: "included" }] } } }) as unknown as CompanySetupView
const deferred = <T,>() => { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const CSV = "line_id,date,vendor,gl_account,gl_description,description,amount,currency,dollar_year,category,naics_code,margin_choice,capital_full_cost\nL-1,2025-03-14,Vendor,6100,Services,Invoice,100.00,USD,2025,1,541611,with_margins,\n"

/** A stub database whose four bulk writes run `bulk` (the test decides how each ends); every call is recorded. */
function stub(bulk: (fn: string) => Promise<unknown>, options: { canManage?: boolean } = {}) {
  const calls: string[] = []
  const database: Scope3SpendImportRouteDatabase = {
    findCompanySetup: async () => { calls.push("setup"); return setup(options.canManage) },
    findCollectionContext: async () => { calls.push("context"); return null },
    findCollectionActivities: async () => { calls.push("activities"); return [] },
    findCollectionEvidence: async () => { calls.push("evidence"); return [] },
    findScope3SpendImports: async () => { calls.push("imports"); return [] },
    findScope3SpendMappings: async () => { calls.push("mappings"); return [] },
    importScope3Spend: async () => { calls.push("import"); return await bulk("import") as never },
    saveScope3SpendMapping: async () => { calls.push("mapping"); return await bulk("mapping") as never },
    withdrawScope3SpendImport: async () => { calls.push("withdraw"); return await bulk("withdraw") as never },
    convertScope3SpendCurrency: async () => { calls.push("convert"); return await bulk("convert") as never },
  }
  return { database, calls }
}
const requests = {
  import: () => new Request(`https://api.example.test${root}/spend-imports?evidenceId=${evidenceId}&locationId=${location}`, { method: "POST", body: CSV, headers: { origin: ORIGIN, authorization: "Bearer ok", "content-type": "text/csv" } }),
  convert: () => new Request(`https://api.example.test${root}/spend-currency-conversions`, { method: "POST", body: JSON.stringify({ currency: "EUR", rate: "1.08", rateSource: "ECB", rateDate: "2025-12-31" }), headers: { origin: ORIGIN, authorization: "Bearer ok", "content-type": "application/json" } }),
  mapping: () => new Request(`https://api.example.test${root}/spend-mappings`, { method: "POST", body: JSON.stringify({ expectedRevision: 0 }), headers: { origin: ORIGIN, authorization: "Bearer ok", "content-type": "application/json" } }),
  withdraw: () => new Request(`https://api.example.test${root}/spend-imports/${importId}/withdrawal`, { method: "POST", body: JSON.stringify({ reason: "Wrong file." }), headers: { origin: ORIGIN, authorization: "Bearer ok", "content-type": "application/json" } }),
}
const route = (database: Scope3SpendImportRouteDatabase, gate: BulkWriteGate) => createScope3SpendImportRoutes({ database, origin: ORIGIN, bulkWriteGate: gate, validateUser: async token => token === "ok" ? { id: owner, email: null, phone: null, fullName: null } : null })
const expectBusy = async (response: Response) => {
  expect(response.status).toBe(503)
  expect(response.headers.get("retry-after")).toBe(String(BULK_WRITE_RETRY_SECONDS))
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(await response.json()).toEqual({ code: "bulk_write_busy", error: "Another large import or conversion is running. Try again in a moment." })
}

describe("BF-19 bulk-write gate", () => {
  test("one hold at a time; a release is idempotent and frees only its own hold", () => {
    const gate = createBulkWriteGate()
    const first = gate.tryAcquire()!
    expect(gate.tryAcquire()).toBeNull()
    first(); first()
    expect(gate.held).toBe(0)
    const second = gate.tryAcquire()!
    first()
    expect([gate.held, gate.tryAcquire()]).toEqual([1, null])
    second()
    expect(gate.held).toBe(0)
    expect(BULK_WRITE_BUSY).toEqual({ code: "bulk_write_busy", error: "Another large import or conversion is running. Try again in a moment." })
  })

  test("a hold that is never released frees itself after its maximum, and a late release then changes nothing", async () => {
    const gate = createBulkWriteGate({ maxHoldMs: 30 })
    const stuck = gate.tryAcquire()!
    expect(gate.tryAcquire()).toBeNull()
    await Bun.sleep(60)
    const next = gate.tryAcquire()!
    expect(next).not.toBeNull()
    stuck()
    expect([gate.held, gate.tryAcquire()]).toEqual([1, null])
    next()
    expect(gate.held).toBe(0)
  })

  test("while an import runs, each of the four bulk writes is refused before any database call; reads are not gated", async () => {
    const running = deferred<unknown>()
    const gate = createBulkWriteGate()
    const { database, calls } = stub(fn => fn === "import" ? running.promise : Promise.resolve({}))
    const send = route(database, gate)
    const first = send(requests.import())
    while (!calls.includes("import")) await Bun.sleep(1)
    const before = calls.length
    for (const make of [requests.import, requests.convert, requests.mapping, requests.withdraw]) await expectBusy(await send(make()))
    expect(calls.length).toBe(before)
    // A read of the same route is answered (it is not a bulk write).
    expect((await send(new Request(`https://api.example.test${root}/spend-imports`, { headers: { authorization: "Bearer ok" } }))).status).not.toBe(503)
    // Refusals before the gate keep their own answers (origin, method, authentication).
    expect((await send(new Request(`https://api.example.test${root}/spend-mappings`, { method: "POST", headers: { origin: "https://evil.example", authorization: "Bearer ok" } }))).status).toBe(403)
    expect((await send(new Request(`https://api.example.test${root}/spend-mappings`, { method: "POST", headers: { origin: ORIGIN } }))).status).toBe(401)
    running.reject(Object.assign(new Error("stop"), { code: "57014" }))
    expect((await first).status).toBe(503)
    expect(gate.held).toBe(0)
  })

  // Every way a bulk write can end. After each, the gate is free and the next bulk write reaches the database.
  const endings: Array<[string, (fn: string) => Promise<unknown>, number, { canManage?: boolean }?]> = [
    ["success", fn => Promise.resolve(fn === "convert" ? { converted: [], skipped: [] } : fn === "withdraw" ? { importId, withdrawn: 1, alreadyWithdrawn: 0 } : fn === "mapping" ? { mapping: { revision: 1 }, corrected: [], unchanged: 0 } : null), 201],
    ["a thrown Error", () => Promise.reject(new Error("driver exploded")), 503],
    ["a thrown non-Error value", () => Promise.reject("plain string"), 503],
    ["a statement timeout (57014)", () => Promise.reject(Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" })), 503],
    ["a lock timeout (55P03)", () => Promise.reject(Object.assign(new Error("lock timeout"), { code: "55P03" })), 503],
    ["an invalid input refusal (22023)", () => Promise.reject(Object.assign(new Error("Invalid."), { code: "22023" })), 422],
    ["a member's refusal (403, no bulk call)", () => Promise.reject(new Error("unreachable")), 403, { canManage: false }],
  ]
  for (const [name, ending, status, options] of endings) for (const kind of ["convert", "mapping", "withdraw"] as const) {
    test(`${kind}: the gate is released after ${name}`, async () => {
      const gate = createBulkWriteGate()
      const { database } = stub(ending, options)
      const send = route(database, gate)
      expect((await send(requests[kind]())).status).toBe(status)
      expect(gate.held).toBe(0)
      const next = gate.tryAcquire()
      expect(next).not.toBeNull()
      next!()
    })
  }

  test("import: released after a refusal before the database write (wrong content type, unparseable file) and after a thrown import", async () => {
    const gate = createBulkWriteGate()
    const { database } = stub(() => Promise.reject(new Error("driver exploded")))
    const send = route(database, gate)
    const wrongType = new Request(requests.import(), { headers: { origin: ORIGIN, authorization: "Bearer ok", "content-type": "application/json" } })
    expect((await send(wrongType)).status).toBe(415)
    expect(gate.held).toBe(0)
    expect((await send(new Request(requests.import(), { body: "not,a,spend,file\n" }))).status).toBe(422)
    expect(gate.held).toBe(0)
    expect((await send(requests.import())).status).toBe(503)
    expect(gate.held).toBe(0)
  })

  test("a refused request wrote nothing, so retrying it once the gate is free is its first attempt", async () => {
    const running = deferred<unknown>()
    const gate = createBulkWriteGate()
    const writes: string[] = []
    const { database } = stub(fn => { writes.push(fn); return fn === "withdraw" ? running.promise : Promise.resolve({ converted: [], skipped: [] }) })
    const send = route(database, gate)
    const first = send(requests.withdraw())
    while (!writes.length) await Bun.sleep(1)
    await expectBusy(await send(requests.convert()))
    expect(writes).toEqual(["withdraw"])
    running.resolve({ importId, withdrawn: 2, alreadyWithdrawn: 0 })
    expect((await first).status).toBe(201)
    expect((await send(requests.convert())).status).toBe(201)
    expect(writes).toEqual(["withdraw", "convert"])
  })

  describe("through a real listener, the client going away", () => {
    let server: ReturnType<typeof Bun.serve> | null = null
    afterEach(() => { server?.stop(true); server = null })
    for (const outcome of ["completes", "fails"] as const) test(`does not keep the gate once the database work ${outcome}`, async () => {
      const running = deferred<unknown>()
      const gate = createBulkWriteGate()
      let finished = false
      const { database, calls } = stub(() => running.promise)
      const send = route(database, gate)
      server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 30, fetch: async request => { try { return await send(request) } finally { finished = true } } })
      const abort = new AbortController()
      const client = fetch(`http://127.0.0.1:${server.port}${root}/spend-currency-conversions`, { method: "POST", signal: abort.signal, body: requests.convert().body, headers: { origin: ORIGIN, authorization: "Bearer ok", "content-type": "application/json" } }).catch((error: Error) => error.name)
      while (!calls.includes("convert")) await Bun.sleep(1)
      abort.abort()
      expect(await client).toBe("AbortError")
      // The server-side work goes on (one transaction, as before); the gate is held until it ends ...
      expect(gate.held).toBe(1)
      if (outcome === "completes") running.resolve({ converted: [], skipped: [] }); else running.reject(Object.assign(new Error("terminated"), { code: "57P01" }))
      while (!finished) await Bun.sleep(1)
      // ... and released when it does, whichever way.
      expect(gate.held).toBe(0)
    })
  })
})

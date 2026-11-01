// Spend CSV import route (Scope 3 completion I-09; Claude, 30 October 2026; DESIGN 3.6, 7.3): authentication, origin,
// tenant scope, the owner/admin rule, the file checks (type, size, parameters, the shared parser's refusals) and every
// database refusal mapped to a status; an import through an in-memory database that builds the records with the shared
// builder, so the response's holds are the adapter's (non-USD, unmatched, out-of-period, possible duplicate), the r4 C1
// overlap line is held as a duplicate of import 1 row 3, and the same bytes replay with nothing new.
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import type { CollectionActivityRecord, CollectionContext, CollectionEvidenceMetadata, CompanySetupView } from "@neuvetra/database"
import { validateCollectionSaveInput } from "../../../../packages/neuvetra-database/src/collection-contract"
import { buildScope3SpendImportRequest, SCOPE3_SPEND_IMPORT_COLUMNS, SCOPE3_SPEND_IMPORT_MAX_BYTES, scope3SpendImportReconciliation } from "../../../../packages/neuvetra-database/src/scope3-spend-import"
import type { Scope3SpendImportRecord, Scope3SpendMappingRecord } from "../../../../packages/neuvetra-database/src/scope3-spend-imports"
import { createScope3SpendImportRoutes, SCOPE3_SPEND_IMPORTS_PROFILE, type Scope3SpendImportResponse, type Scope3SpendImportRouteDatabase, type Scope3SpendImportsResponse } from "./scope3-spend-import-routes"

const company = "93900000-0000-4000-8000-000000000001", setupId = "93900000-0000-4000-8000-000000000002", owner = "93900000-0000-4000-8000-0000000000a1"
const location = "93900000-0000-4000-8000-0000000000b1", excluded = "93900000-0000-4000-8000-0000000000b2"
const ORIGIN = "https://staging.example.test"
const HEADER = SCOPE3_SPEND_IMPORT_COLUMNS.join(",")
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")
// Round 2 ENG-1: the r4 pack's C1 spend files are committed fixtures (byte for byte), read relative to this file.
const R4_FILES: Record<string, string> = { "spend-import.csv": "spend-r4-c1.csv", "spend-import-overlap.csv": "spend-r4-c1-overlap.csv" }
const r4File = (name: string) => Bun.file(`${import.meta.dir}/../../../../packages/neuvetra-database/src/testdata/${R4_FILES[name]}`)

function setupView(canManage = true, saved = true): CompanySetupView {
  return { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage, history: [], currentVersion: saved ? { id: setupId, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
    setup: { reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01", firstInventory: "yes", priorInventoryReference: "" }, boundary: { approach: "operational_control" },
      locations: [{ id: location, name: "HQ", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }, { id: excluded, name: "Sold site", inclusion: "excluded", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] } } : null } as unknown as CompanySetupView
}
const context: CollectionContext = { companyId: company, setupVersionId: setupId, setupRevision: 1, sameContentSetupVersionIds: [setupId], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [{ id: location, name: "HQ", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }, { id: excluded, name: "Sold site", inclusion: "excluded", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] }

/** An in-memory database: imports build their records with the shared builder (as the SQL RPC saves them). */
function harness(overrides: Partial<Scope3SpendImportRouteDatabase> & { setup?: CompanySetupView | null } = {}) {
  const calls: Array<{ fn: string; args: unknown[] }> = []
  const records: CollectionActivityRecord[] = [], imports: Scope3SpendImportRecord[] = [], evidence: CollectionEvidenceMetadata[] = []
  const database: Scope3SpendImportRouteDatabase = {
    findCompanySetup: async (...args) => { calls.push({ fn: "setup", args }); return overrides.setup === undefined ? setupView() : overrides.setup },
    findCollectionContext: overrides.findCollectionContext ?? (async () => context),
    findCollectionActivities: async () => records,
    findCollectionEvidence: async () => evidence,
    findScope3SpendImports: async () => imports,
    findScope3SpendMappings: overrides.findScope3SpendMappings ?? (async () => []),
    withdrawScope3SpendImport: overrides.withdrawScope3SpendImport ?? (async (...args) => { calls.push({ fn: "withdraw", args }); return { importId: args[2], withdrawn: 0, alreadyWithdrawn: 0 } }),
    importScope3Spend: overrides.importScope3Spend ?? (async (...args) => {
      calls.push({ fn: "import", args })
      const [, , input] = args
      const existing = imports.find(item => item.fileSha256 === input.fileSha256)
      if (existing) return { import: existing, replayed: true, saved: 0 }
      if (!input.parsed.ok) throw new Error("parse")
      const built = buildScope3SpendImportRequest({ companyId: company, parsed: input.parsed, fileSha256: input.fileSha256, fileName: "ledger.csv", evidenceId: input.evidenceId, locationId: input.locationId, setupVersionId: setupId,
        reportingYear: 2025, reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, mappings: [], earlierLines: imports.flatMap(item => item.lines.map(line => ({ importId: item.id, row: line.row, fingerprint: line.lineFingerprint }))), sha256 })
      for (const row of built.request.rows) {
        const activity = validateCollectionSaveInput(row.request).activity
        records.push({ id: row.recordId, companyId: company, kind: "purchase_spend", history: [], currentVersion: { id: crypto.randomUUID(), recordId: row.recordId, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity, payloadSha256: "d".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z" } })
      }
      const saved: Scope3SpendImportRecord = { id: built.request.importId, companyId: company, reportingYear: 2025, fileSha256: input.fileSha256, fileName: "ledger.csv", evidenceId: input.evidenceId, locationId: input.locationId, setupVersionId: setupId,
        rowCount: built.request.rowCount, fileTotals: built.request.fileTotals, nonNumericRows: built.request.nonNumericRows, createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
        lines: built.request.rows.map((row, i) => ({ row: i + 1, recordId: row.recordId, lineFingerprint: row.lineFingerprint })),
        reconciliation: scope3SpendImportReconciliation(built.request.fileTotals, built.request.nonNumericRows, built.request.rows.map(row => { const a = validateCollectionSaveInput(row.request).activity; return { amount: a.quantity.originalValue, currency: a.quantity.originalUnit } })) }
      imports.push(saved)
      return { import: saved, replayed: false, saved: built.request.rowCount }
    }),
    saveScope3SpendMapping: overrides.saveScope3SpendMapping ?? (async (...args) => { calls.push({ fn: "mapping", args }); return { mapping: { revision: 1 } as Scope3SpendMappingRecord, corrected: [], unchanged: 0 } }),
    convertScope3SpendCurrency: overrides.convertScope3SpendCurrency ?? (async (...args) => { calls.push({ fn: "convert", args }); return { converted: [{ recordId: "r1", sourceId: "FX-1", versionId: "v2", revision: 2, from: "100", usd: "108.23" }], skipped: [] } }),
  }
  const route = createScope3SpendImportRoutes({ database, origin: ORIGIN, validateUser: async token => token === "ok" ? { id: owner, email: null, phone: null, fullName: null } : token === "down" ? (() => { throw new Error("auth down") })() : null })
  const send = (path: string, init: { method?: string; token?: string; origin?: string | null; body?: BodyInit; type?: string } = {}) => route(new Request(`https://api.example.test${path}`, {
    method: init.method ?? "GET", body: init.body, headers: { authorization: `Bearer ${init.token ?? "ok"}`, ...(init.type ? { "content-type": init.type } : {}), ...(init.origin === null ? {} : { origin: init.origin ?? ORIGIN }) } }))
  return { calls, send, records, imports }
}
const root = `/workspace/${company}/scope3/spend-imports`
const evidenceId = "93900000-0000-4000-8000-0000000000e1"
const importPath = (params = `evidenceId=${evidenceId}&locationId=${location}`) => `${root}?${params}`
const csv = (text: string) => ({ method: "POST", type: "text/csv", body: new TextEncoder().encode(text) })

describe("Scope 3 spend import route (I-09)", () => {
  test("refusals before any import: auth, origin, method, tenant, manager, content type, parameters, size, setup", async () => {
    const { send, calls } = harness()
    expect((await send(root, { token: "bad" })).status).toBe(401)
    expect((await send(root, { token: "down" })).status).toBe(503)
    expect((await send(root, { origin: "https://evil.example" })).status).toBe(403)
    expect((await send(importPath(), { ...csv("x"), origin: null })).status).toBe(403)
    expect((await send(root, { method: "PUT" })).status).toBe(405)
    expect((await send(`/workspace/${company}/scope3/spend-mappings`)).status).toBe(405)
    expect((await send(`/workspace/${company}/scope3/spend-other`)).status).toBe(404)
    expect((await harness({ setup: null }).send(root)).status).toBe(404)
    expect((await harness({ setup: setupView(false) }).send(importPath(), csv("x"))).status).toBe(403)
    expect((await send(importPath(), { ...csv("x"), type: "application/json" })).status).toBe(415)
    for (const params of ["", `evidenceId=${evidenceId}`, `evidenceId=nope&locationId=${location}`, `evidenceId=${evidenceId}&locationId=${location}&extra=1`]) expect((await send(importPath(params), csv("x"))).status).toBe(422)
    expect((await send(importPath(), csv("a".repeat(SCOPE3_SPEND_IMPORT_MAX_BYTES + 1)))).status).toBe(413)
    expect((await harness({ setup: setupView(true, false) }).send(importPath(), csv("x"))).status).toBe(409)
    expect(calls.filter(call => call.fn === "import")).toEqual([])
  })

  test("a file the shared parser refuses imports nothing and names every problem (category 9, structure)", async () => {
    const { send, calls } = harness()
    const response = await send(importPath(), csv(`${HEADER}\nA,,V,,,d,10,USD,,9,,,\nB,,V,,,d,10,USD,,1,1234,,\n`))
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.code).toBe("file_invalid")
    expect(body.problems.map((p: { message: string }) => p.message)).toEqual(["Row 1: category 9 is transport the company did not pay for; it cannot come from your ledger. Enter it by hand.", "Row 2: NAICS code must be six digits."])
    expect(calls.filter(call => call.fn === "import")).toEqual([])
  })

  test("an import: every line a record, calculated or held with the adapter's reasons, never zero; the same bytes replay", async () => {
    const { send, records } = harness()
    const text = `${HEADER}\nL1,2025-03-01,Acme,6100,Office,Toner,4820.50,USD,2025,1,339940,with_margins,\nL2,2025-03-02,Lisbon,6900,,Consulting,500,EUR,2025,1,541611,,\nL3,2025-03-03,Nobody,7000,,Mystery,10,USD,2025,,,,\nL4,2024-12-15,Harbor,6900,,Workshop,75,USD,2024,1,541611,,\nL5,2025-04-01,Neg,6100,,Credit,-20,USD,2025,1,339940,,\nL6,2025-05-01,Bad,6100,,Text,n/a,USD,2025,1,339940,,\n`
    const response = await send(importPath(), csv(text))
    expect(response.status).toBe(201)
    const body = await response.json() as Scope3SpendImportResponse
    expect(body.profile).toBe(SCOPE3_SPEND_IMPORTS_PROFILE)
    expect(body).toMatchObject({ replayed: false, saved: 6, calculable: 1 })
    expect(body.import.fileSha256).toBe(sha(new TextEncoder().encode(text)))
    expect(body.import.reconciliation).toMatchObject({ reconciled: true, currencies: [{ currency: "EUR", fileTotal: "500", importedTotal: "500" }, { currency: "USD", fileTotal: "4885.5", importedTotal: "4885.5" }], nonNumericRows: { file: 1, imported: 1 } })
    expect(body.holds).toEqual({ currency_not_supported: 1, naics_code_required: 1, spend_line_date_outside_reporting_period: 1, negative_amount_not_supported: 1, amount_not_a_number: 1 })
    expect(body.lines.map(line => [line.importRow, line.plan.action, line.plan.reasons])).toEqual([[1, "calculate", []], [2, "hold", ["currency_not_supported"]], [3, "hold", ["naics_code_required"]],
      [4, "hold", ["spend_line_date_outside_reporting_period"]], [5, "hold", ["negative_amount_not_supported"]], [6, "hold", ["amount_not_a_number"]]])
    expect(body.lines[2]).toMatchObject({ mappingSource: "unmatched", naicsCode: null, vendor: "Nobody", mappingKeySha256: sha256("7000\u001fnobody\u001fmystery") })
    expect(records).toHaveLength(6)
    const again = await send(importPath(), csv(text))
    expect(again.status).toBe(200)
    expect(await again.json()).toMatchObject({ replayed: true, saved: 0, import: { id: body.import.id } })
    expect(records).toHaveLength(6)
  })

  test("the r4 C1 files through the route: the overlap line is held as a possible duplicate of import 1 row 3; GET lists both imports and the queues' lines", async () => {
    const { send } = harness()
    const first = await (await send(importPath(), csv(await r4File("spend-import.csv").text()))).json() as Scope3SpendImportResponse
    expect(first).toMatchObject({ saved: 3, calculable: 3, holds: {} })
    const overlap = await (await send(importPath(), csv(await r4File("spend-import-overlap.csv").text()))).json() as Scope3SpendImportResponse
    expect(overlap.holds).toEqual({ possible_duplicate_spend_line: 1 })
    expect(overlap.lines[0]).toMatchObject({ sourceId: "INV-2025-0103", possibleDuplicateOf: { importId: first.import.id, row: 3 }, plan: { action: "hold", reasons: ["possible_duplicate_spend_line"] } })
    expect(overlap.lines[1]!.plan.action).toBe("calculate")
    const listed = await (await send(root, { origin: null })).json() as Scope3SpendImportsResponse
    expect(listed).toMatchObject({ profile: SCOPE3_SPEND_IMPORTS_PROFILE, companyId: company, canManage: true, setupVersionId: setupId, reportingYear: 2025, reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [{ id: location, name: "HQ" }] })
    expect(listed.imports.map(item => item.id)).toEqual([first.import.id, overlap.import.id])
    expect(listed.lines).toHaveLength(5)
    expect(listed.superseded).toEqual([])
    expect(listed.superseders).toEqual([])
  })

  test("round 2 UX-1: each line carries its GL account name for the grid and NAICS suggestions (empty when the description already is the GL name, or none was given)", async () => {
    const { send } = harness()
    await send(importPath(), csv(`${HEADER}\nL1,2025-03-01,Acme,6100,Office supplies,Toner,10,USD,2025,,,,\nL2,2025-03-02,Acme,6100,Office supplies,,20,USD,2025,,,,\nL3,2025-03-03,Acme,6100,,Pens,30,USD,2025,,,,\n`))
    const listed = await (await send(root, { origin: null })).json() as Scope3SpendImportsResponse
    expect(listed.lines.map(line => [line.description, line.glDescription])).toEqual([["Toner", "Office supplies"], ["Office supplies", ""], ["Pens", ""]])
  })

  test("round 2 ACC-16: each superseded spend line is listed with its amount beside the figure of the record that replaces it", async () => {
    const h = harness()
    await h.send(importPath(), csv(`${HEADER}\nL1,2025-03-01,Acme Metals,6100,,Steel,240000,USD,2025,1,331110,,\nL2,2025-03-02,Acme Metals,6100,,Steel freight,1000.5,USD,2025,1,331110,,\nL3,2025-03-03,Other,6100,,Pens,30,USD,2025,1,339940,,\n`))
    const supplierId = "93900000-0000-4000-8000-0000000000f1"
    const activity = { kind: "purchase_supplier", locationId: location, setupVersionId: setupId, sourceId: "SUP-1", state: "active", withdrawalReason: null, quantity: { originalValue: "12.4", originalUnit: "metric_ton CO2e", normalizedValue: "12.4", normalizedUnit: "metric_ton CO2e" },
      quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [],
      payload: { category: 1, supplierName: "Acme Metals", product: "Steel", basis: "allocated_total", factorValue: null, factorUnit: null, allocationBasis: "supplier_allocated", allocationNumerator: null, allocationDenominator: null, supersedesSpend: { supplierName: "Acme Metals", mappingKeys: [] } } }
    h.records.push({ id: supplierId, companyId: company, kind: "purchase_supplier", history: [], currentVersion: { id: crypto.randomUUID(), recordId: supplierId, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity, payloadSha256: "e".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z" } } as unknown as CollectionActivityRecord)
    const listed = await (await h.send(root, { origin: null })).json() as Scope3SpendImportsResponse
    expect(listed.superseded.map(entry => [entry.supersededBy, entry.spendSourceId, entry.spendDescription, entry.spendAmount, entry.spendCurrency])).toEqual([[supplierId, "L1", "Steel", "240000", "USD"], [supplierId, "L2", "Steel freight", "1000.5", "USD"]].sort((a, b) => listed.superseded.findIndex(e => e.spendSourceId === a[1]) - listed.superseded.findIndex(e => e.spendSourceId === b[1])))
    expect(listed.superseders).toEqual([{ recordId: supplierId, kind: "purchase_supplier", sourceId: "SUP-1", name: "Acme Metals", category: 1, quantity: "12.4", unit: "metric_ton CO2e", basis: "allocated_total", factorValue: null, factorUnit: null, allocationNumerator: null, allocationDenominator: null }])
    expect(listed.lines.filter(line => line.supersededBy === supplierId).map(line => line.sourceId)).toEqual(["L1", "L2"])
  })

  test("round 2b (ENG-14): the spend routes use the shared Scope 3 helpers: one 415 at the same step as every Scope 3 write, strict JSON", async () => {
    // A wrong media type is refused once the actor and the setup are checked, as in the assessment and report writes:
    // without a saved setup the import answers setup_required (409) whatever its media type.
    const unsaved = harness({ setup: setupView(true, false) })
    const early = await unsaved.send(importPath(), { ...csv("x"), type: "application/json" })
    expect([early.status, (await early.json()).code]).toEqual([409, "setup_required"])
    const { send, calls } = harness()
    const wrong = await send(importPath(), { ...csv("x"), type: "text/plain" })
    expect([wrong.status, await wrong.json()]).toEqual([415, { error: "CSV content type required." }])
    const path = `/workspace/${company}/scope3/spend-mappings`
    const mapping = await send(path, { method: "POST", body: "{}", type: "text/csv" })
    expect([mapping.status, await mapping.json()]).toEqual([415, { error: "JSON content type required." }])
    // Strict UTF-8 JSON, as the shared reader: an invalid byte is refused (422), never passed on as a replacement character.
    const bad = new Uint8Array([...new TextEncoder().encode('{"expectedRevision":0,"note":"'), 0xff, ...new TextEncoder().encode('"}')])
    const invalid = await send(path, { method: "POST", body: bad, type: "application/json" })
    expect([invalid.status, await invalid.json()]).toEqual([422, { error: "Invalid Scope 3 spend mapping JSON." }])
    expect(calls.filter(call => call.fn === "mapping" || call.fn === "import")).toEqual([])
    // The spend routes keep no prelude, problem type or body reader of their own.
    const source = await Bun.file(`${import.meta.dir}/scope3-spend-import-routes.ts`).text()
    expect([source.includes("extractBearerToken"), source.includes("class RouteProblem"), source.includes("scope3RoutePrelude(request"), source.includes("readScope3Body(request"), source.includes("readScope3JsonBody(request")])
      .toEqual([false, false, true, true, true])
  })

  test("mappings: JSON only, owner/admin, forwarded to the database; refusals mapped", async () => {
    const path = `/workspace/${company}/scope3/spend-mappings`
    const body = JSON.stringify({ expectedRevision: 0, mapping: { glAccount: "6300", vendor: "V", description: "D", category: 1, naicsCode: "722320", marginChoice: "with_margins" }, categoryConfirmed: null, activityOverlapConfirmed: null })
    const { send, calls } = harness()
    expect((await send(path, { method: "POST", body, type: "text/plain" })).status).toBe(415)
    expect((await send(path, { method: "POST", body: "{", type: "application/json" })).status).toBe(422)
    expect((await harness({ setup: setupView(false) }).send(path, { method: "POST", body, type: "application/json" })).status).toBe(403)
    const ok = await send(path, { method: "POST", body, type: "application/json" })
    expect(ok.status).toBe(201)
    expect(calls.find(call => call.fn === "mapping")!.args).toEqual([owner, company, JSON.parse(body)])
    for (const [code, status] of [["23505", 409], ["22023", 422], ["42501", 404], ["XX000", 503]] as const) {
      const failing = harness({ saveScope3SpendMapping: async () => { throw Object.assign(new Error("x"), { code }) } })
      expect((await failing.send(path, { method: "POST", body, type: "application/json" })).status).toBe(status)
    }
  })

  test("import refusals from the database map to statuses (cross-company evidence, excluded location, setup, conflicts, outage)", async () => {
    const text = `${HEADER}\nA,,V,,,d,10,USD,,1,339940,,\n`
    for (const [code, status] of [["evidence_mismatch", 422], ["location_not_included", 422], ["setup_required", 409], ["23503", 409], ["23505", 409], ["42501", 404], ["22023", 422], ["54000", 413], ["XX000", 503]] as const) {
      const failing = harness({ importScope3Spend: async () => { throw Object.assign(new Error("x"), { code }) } })
      const response = await failing.send(importPath(), csv(text))
      expect([code, response.status]).toEqual([code, status])
    }
  })

  test("round 2 (owner decision 10): a file that would pass the active-line budget is refused before saving; withdrawn lines don't count; a replay is never refused", async () => {
    const h = harness()
    const line = (i: number) => `L-${i},2025-03-14,Vendor ${i},6100,Services,Consulting,${100 + i},USD,2025,1,541611,with_margins,`
    const file = (from: number, n: number) => `${HEADER}\n${Array.from({ length: n }, (_, i) => line(from + i)).join("\n")}\n`
    // 2,999 active lines already (one withdrawn line more, which never counts).
    const first = file(1, 2000), second = file(2001, 999)
    expect((await h.send(importPath(), csv(first))).status).toBe(201)
    expect((await h.send(importPath(), csv(second))).status).toBe(201)
    const withdrawnRecord = structuredClone(h.records[0]!)
    withdrawnRecord.id = crypto.randomUUID(); (withdrawnRecord.currentVersion.activity as { state: string }).state = "withdrawn"
    h.records.push(withdrawnRecord)
    const imported = h.calls.filter(call => call.fn === "import").length
    const refused = await h.send(importPath(), csv(file(5001, 2)))
    const body = await refused.json() as any
    expect([refused.status, body.code, body.lineBudget, body.fileLines]).toEqual([409, "line_budget_exceeded", { max: 3000, used: 2999, remaining: 1 }, 2])
    expect(body.error).toBe("This would take Scope 3 past its limit of 3,000 active lines (2,999 in use, 2 more). Withdraw lines you no longer need, or import a smaller file. Nothing was saved.")
    expect(h.calls.filter(call => call.fn === "import").length).toBe(imported) // nothing reached the database
    // Exactly at the cap is allowed; the same bytes again replay (never refused, nothing new is saved).
    expect((await h.send(importPath(), csv(file(6001, 1)))).status).toBe(201)
    expect((await h.send(importPath(), csv(second))).status).toBe(200)
  }, 60_000)

  test("round 3 (PR-11): a bulk currency conversion is JSON, owner or admin, one database call (one transaction); each line view discloses its conversion", async () => {
    const path = `/workspace/${company}/scope3/spend-currency-conversions`
    const { send, calls } = harness()
    const body = { currency: "EUR", rate: "1.0823", rateSource: "ECB euro reference rate", rateDate: "2025-06-30" }
    const ok = await send(path, { method: "POST", type: "application/json", body: JSON.stringify(body) })
    expect(ok.status).toBe(201)
    expect(await ok.json()).toEqual({ profile: SCOPE3_SPEND_IMPORTS_PROFILE, converted: [{ recordId: "r1", sourceId: "FX-1", versionId: "v2", revision: 2, from: "100", usd: "108.23" }], skipped: [] })
    expect(calls.filter(c => c.fn === "convert").map(c => c.args)).toEqual([[owner, company, body]])
    expect((await send(path)).status).toBe(405)
    expect((await send(path, { method: "POST", type: "text/plain", body: "x" })).status).toBe(415)
    const refused = harness({ convertScope3SpendCurrency: async () => { throw Object.assign(new Error("bad"), { code: "22023" }) } })
    expect((await refused.send(path, { method: "POST", type: "application/json", body: JSON.stringify({ ...body, rate: "x" }) })).status).toBe(422)
    const member = harness({ setup: setupView(false) })
    expect((await member.send(path, { method: "POST", type: "application/json", body: JSON.stringify(body) })).status).toBe(403)
    // The line view: a converted line names its original amount, rate, source and date; its GL description is still read.
    const { send: send2, records } = harness()
    await send2(importPath(), csv(`line_id,date,vendor,gl_account,gl_description,description,amount,currency\nFX-1,2025-05-01,Bosch,5040,Components,Valves,100,EUR\n`))
    const a = records[0]!.currentVersion.activity
    records[0]!.currentVersion = { ...records[0]!.currentVersion, revision: 2, activity: { ...a, quantity: { originalValue: "108.23", originalUnit: "USD", normalizedValue: "108.23", normalizedUnit: "USD" },
      notes: `${a.notes}\nCurrency conversion: EUR 100 × 1.0823 USD per EUR = USD 108.23 (rate source: ECB euro reference rate; rate date: 2025-06-30; rounded half-even to the cent).` } }
    const view = await (await send2(root)).json() as Scope3SpendImportsResponse
    expect(view.lines[0]).toMatchObject({ amount: "108.23", currency: "USD", glDescription: "Components", conversion: { currency: "EUR", amount: "100", rate: "1.0823", rateSource: "ECB euro reference rate", rateDate: "2025-06-30", usd: "108.23" } })
    expect(view.lines[0]!.plan.reasons).not.toContain("currency_not_supported")
  })
})

// Round 3, lane B (EN-1, owner decision 7): specific, retryable refusals for lock and statement timeouts; the SQL line cap
// as the line-budget error; "withdraw this import" through the route.
describe("round 3: spend import refusals and withdraw-import", () => {
  const coded = (code: string) => async () => { throw Object.assign(new Error("db"), { code }) }
  test("a committed import survives a failed review read; its receipt is truthful and replay saves no duplicate", async () => {
    for (const code of ["57014", "55P03", "XX000"]) {
      let readFails = true
      const h = harness({ findCollectionContext: async () => { if (readFails) throw Object.assign(new Error("review failed"), { code }); return context } })
      const text = `${HEADER}\nL1,2025-03-01,Acme,6100,Office,Toner,10,USD,2025,1,339940,with_margins,\n`
      const response = await h.send(importPath(), csv(text)), body = await response.json()
      expect(response.status).toBe(503)
      expect(h.records).toHaveLength(1)
      expect(body).toMatchObject({ code: "import_saved_review_unavailable", importId: h.imports[0]!.id, saved: 1, replayed: false })
      expect(body.error).toContain("saved")
      expect(body.error).toContain("Reload")
      expect(body.error).not.toContain("nothing was saved")
      readFails = false
      const replay = await h.send(importPath(), csv(text))
      expect(replay.status).toBe(200)
      expect(await replay.json()).toMatchObject({ replayed: true, saved: 0 })
      expect(h.records).toHaveLength(1)
    }
  })
  test("read-only timeouts never claim a write was refused", async () => {
    for (const code of ["57014", "55P03"]) {
      const response = await harness({ findCollectionContext: coded(code) }).send(root)
      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ code: "read_unavailable", error: "Scope 3 spend imports could not be read. Reload and try again." })
    }
  })
  test("55P03 and 57014 are 503 with a code and Retry-After (nothing saved); 0030's 54N30 is the line-budget error", async () => {
    const text = `${HEADER}\nL1,2025-03-01,Acme,6100,Office,Toner,10,USD,2025,1,339940,with_margins,\n`
    const busy = await harness({ importScope3Spend: coded("55P03") }).send(importPath(), csv(text))
    expect([busy.status, (await busy.json()).code, busy.headers.get("retry-after")]).toEqual([503, "company_busy", "5"])
    const slow = await harness({ importScope3Spend: coded("57014") }).send(importPath(), csv(text))
    expect([slow.status, (await slow.json()).code, slow.headers.get("retry-after")]).toEqual([503, "write_timed_out", "30"])
    const over = await harness({ importScope3Spend: coded("54N30") }).send(importPath(), csv(text))
    const body = await over.json()
    expect([over.status, body.code]).toEqual([409, "line_budget_exceeded"])
    expect(body.error).toContain("3,000 active lines")
  })

  test("withdraw-import: owner or admin, exact JSON body, the database's counts and a sentence; another company's import is 404", async () => {
    const importId = "93900000-0000-4000-8000-0000000000a9"
    const path = `${root}/${importId}/withdrawal`
    const json = (body: unknown) => ({ method: "POST", type: "application/json", body: JSON.stringify(body) })
    const h = harness({ withdrawScope3SpendImport: async (...args) => { expect(args.slice(1)).toEqual([company, importId, { reason: "Wrong month." }]); return { importId, withdrawn: 1000, alreadyWithdrawn: 2 } } })
    const done = await h.send(path, json({ reason: "Wrong month." }))
    expect([done.status, await done.json()]).toEqual([201, { profile: SCOPE3_SPEND_IMPORTS_PROFILE, importId, withdrawn: 1000, alreadyWithdrawn: 2, message: "1,000 lines withdrawn; 2 already withdrawn. Withdrawn lines stay in the history and no longer count." }])
    expect((await h.send(path)).status).toBe(405)
    expect((await h.send(path, { ...json({ reason: "x" }), type: "text/csv" })).status).toBe(415)
    expect((await harness({ setup: setupView(false) }).send(path, json({ reason: "Wrong month." }))).status).toBe(403)
    expect((await harness({ withdrawScope3SpendImport: coded("23503") }).send(path, json({ reason: "Wrong month." }))).status).toBe(404)
    expect((await harness({ withdrawScope3SpendImport: coded("22023") }).send(path, json({ reason: "no" }))).status).toBe(422)
    expect((await h.send(`/workspace/${company}/scope3/spend-mappings/${importId}/withdrawal`, json({ reason: "Wrong month." }))).status).toBe(404)
  })

  test("withdraw-import preserves the safe reason-validation message and hides unexpected database text", async () => {
    const path = `${root}/93900000-0000-4000-8000-0000000000a9/withdrawal`
    const send = (message: string) => harness({ withdrawScope3SpendImport: async () => { throw Object.assign(new Error(message), { code: "22023" }) } })
      .send(path, { method: "POST", type: "application/json", body: JSON.stringify({ reason: "no" }) })
    const expected = "Say why this import is withdrawn (at least 3 characters)."
    const helpful = await send(expected)
    expect([helpful.status, await helpful.json()]).toEqual([422, { error: expected }])
    const unsafe = await send("unexpected internal connection detail")
    expect([unsafe.status, await unsafe.json()]).toEqual([422, { error: "Invalid Scope 3 spend import withdrawal." }])
  })

  test("both import line-cap refusals carry the same error, lineBudget and fileLines shape", async () => {
    const text = `${HEADER}\nL1,2025-03-01,Acme,6100,Office,Toner,10,USD,2025,1,339940,with_margins,\n`
    const full = harness()
    await full.send(importPath(), csv(text))
    const example = full.records[0]!
    full.records.push(...Array.from({ length: 2999 }, (_, index) => ({ ...example, id: `93900000-0000-4000-8000-${String(index + 2000).padStart(12, "0")}` })))
    const before = await full.send(importPath(), csv(text.replace("L1,", "L2,")))
    const beforeBody = await before.json()
    expect(before.status).toBe(409)
    const raced = await harness({ importScope3Spend: coded("54N30") }).send(importPath(), csv(text))
    const racedBody = await raced.json()
    expect(raced.status).toBe(409)
    expect(Object.keys(racedBody).sort()).toEqual(Object.keys(beforeBody).sort())
    expect(Object.keys(racedBody.lineBudget).sort()).toEqual(["max", "remaining", "used"])
    expect([racedBody.code, racedBody.fileLines]).toEqual([beforeBody.code, 1])
    expect(racedBody.error).toContain("3,000 active lines")
  })
})

// Bug hunt (PR 22, lane B, 1 November 2026): every bulk spend write saves the lines against the current setup version, and
// 0030 requires each line's location to be in it (23503). After a location was removed from company setup, natively,
// "withdraw this import" answered 404 "Scope 3 spend imports not found." for an import the same screen lists, and a mapping
// save or currency conversion over such lines said "Reload and try again", which can never succeed. The route now says which
// lines and how to recover: put the location back in company setup (it may be marked excluded), then try again.
describe("bug hunt: spend lines at a location removed from company setup", () => {
  const gone = "93900000-0000-4000-8000-0000000000b9"
  const coded = (code: string) => async () => { throw Object.assign(new Error("db"), { code }) }
  const importId = "93900000-0000-4000-8000-0000000000a9"
  const json = (body: unknown) => ({ method: "POST", type: "application/json", body: JSON.stringify(body) })
  /** One active imported line of `importId` at a location the current setup no longer has (and the import that saved it). */
  async function withLineAt(h: ReturnType<typeof harness>, locationId: string) {
    const text = `${HEADER}\nL1,2025-03-01,Acme,6100,Office,Toner,10,USD,2025,1,339940,with_margins,\n`
    expect((await h.send(importPath(), csv(text))).status).toBe(201)
    const record = h.records[0]!, saved = h.imports[0]!
    ;(record.currentVersion.activity as { locationId: string }).locationId = locationId
    ;(record.currentVersion.activity.payload as { importId: string }).importId = importId
    h.imports[0] = { ...saved, id: importId, locationId, lines: saved.lines }
  }
  const refusal = { code: "location_not_in_setup", lines: 1, error: "1 imported spend line is at a location that is no longer in company setup, so nothing was changed. Add the location back in company setup (it can be marked as excluded), then try again." }
  test("withdraw this import: 409 location_not_in_setup, never 404 for an import that exists", async () => {
    const h = harness({ withdrawScope3SpendImport: coded("23503") })
    await withLineAt(h, gone)
    const r = await h.send(`${root}/${importId}/withdrawal`, json({ reason: "Wrong month." }))
    expect([r.status, await r.json()]).toEqual([409, refusal])
  })
  test("a mapping save or a currency conversion over such lines: 409 location_not_in_setup, not reload_required", async () => {
    for (const [path, body, override] of [["/scope3/spend-mappings", { expectedRevision: 0, mapping: { glAccount: "6100", vendor: "Acme", description: "Toner", category: 1, naicsCode: "339940", marginChoice: "with_margins" }, categoryConfirmed: null, activityOverlapConfirmed: null }, "saveScope3SpendMapping"],
      ["/scope3/spend-currency-conversions", { currency: "EUR", rate: "1.08", rateSource: "ECB", rateDate: "2025-03-01" }, "convertScope3SpendCurrency"]] as const) {
      const h = harness({ [override]: coded("23503") })
      await withLineAt(h, gone)
      const r = await h.send(`/workspace/${company}${path}`, json(body))
      expect([r.status, await r.json()]).toEqual([409, refusal])
    }
  })
  test("otherwise unchanged: an unknown import is 404; with every location still in setup a mapping 23503 is reload_required", async () => {
    expect((await harness({ withdrawScope3SpendImport: coded("23503") }).send(`${root}/${importId}/withdrawal`, json({ reason: "Wrong month." }))).status).toBe(404)
    const h = harness({ saveScope3SpendMapping: coded("23503") })
    await withLineAt(h, location)
    const r = await h.send(`/workspace/${company}/scope3/spend-mappings`, json({ expectedRevision: 0, mapping: { glAccount: "6100", vendor: "Acme", description: "Toner", category: 1, naicsCode: "339940", marginChoice: "with_margins" }, categoryConfirmed: null, activityOverlapConfirmed: null }))
    expect([r.status, (await r.json()).code]).toEqual([409, "reload_required"])
  })
})

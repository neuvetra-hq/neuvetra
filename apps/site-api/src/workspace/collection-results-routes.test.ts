// Claude UX journey (2026-09-29): the draft results route plans every saved record with the reviewed v7 adapter and
// sends only calculable ones to the pinned engines. Runs the real Scope 1 / Scope 2 engines.
// MR2 (2026-09-30): each method's release status comes from the 0024 release store and the running engine; the
// database-backed release cases are in collection-results-release.test.ts.
import { describe, expect, test } from "bun:test"
import { validateCollectionActivity, type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView } from "@neuvetra/database"
import { createScope1Engine } from "../calculation/scope1-authority"
import { createScope2Engine } from "../calculation/scope2-authority"
import type { ReleasedMethod } from "../../../../packages/neuvetra-database/src/method-reference"
import { buildCollectionResults, checkPeriod, classifyMethodRelease, createCollectionResultsRoutes, DRAFT_RESULTS_ENVIRONMENT, DRAFT_RESULTS_LABEL, RELEASED_DRAFT_RESULTS_LABEL, REVIEWED_SCOPE1_ENGINE_SHA256, REVIEWED_SCOPE2_ENGINE_SHA256, type CollectionResultsDatabase, type CollectionResultsResponse, type EngineMethodFacts, type ReleaseEvidence, type ReleaseProblem, type ResultsReleaseCheckLog, LOGGABLE_ERROR_CLASSES, resultCounts, type CollectionResultRow } from "./collection-results-routes"

const python = process.env.NEUVETRA_PYTHON ?? "python3"
const engines = {
  scope1: createScope1Engine({ python, expectedEngineSha256: REVIEWED_SCOPE1_ENGINE_SHA256 }),
  scope2: createScope2Engine({ python, expectedEngineSha256: REVIEWED_SCOPE2_ENGINE_SHA256 }),
}
const company = "72000000-0000-4000-8000-000000000001", other = "72000000-0000-4000-8000-000000000009", setup = "72000000-0000-4000-8000-000000000002"
const office = "72000000-0000-4000-8000-000000000003", warehouse = "72000000-0000-4000-8000-000000000004"
const owner = "72000000-0000-4000-8000-0000000000a1", stranger = "72000000-0000-4000-8000-0000000000a2"
const context: CollectionContext = { boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, companyId: company, setupVersionId: setup, setupRevision: 1, locations: [
  { id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, entity: null, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" },
  { id: warehouse, name: "Warehouse", inclusion: "excluded", control: "landlord" }] }
const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic", notes: "", evidenceIds: [] as string[], period: year }
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value) ? value : null, normalizedUnit: /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value) ? unit : null })
let n = 0
function record(activity: Record<string, unknown>, companyId = company): CollectionActivityRecord {
  const id = `72000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  const parsed = validateCollectionActivity({ ...common, ...activity })
  const version = { id: `73000000-0000-4000-8000-${String(n).padStart(12, "0")}`, recordId: id, companyId, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z" }
  return { id, companyId, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined } as never] }
}
const gasOffice = record({ kind: "natural_gas", sourceId: "GAS-1", quantity: q("12500", "therm"), payload: { heatContent: null } })
const gasWarehouse = record({ kind: "natural_gas", sourceId: "GAS-2", locationId: warehouse, quantity: q("900", "therm"), payload: { heatContent: null } })
const gasBlank = record({ kind: "natural_gas", sourceId: "GAS-3", quantity: q("", "therm"), payload: { heatContent: null } })
const vans = record({ kind: "vehicle", sourceId: "VANS", quantity: q("1200", "US_gallon"), payload: { vehicleGroupId: "VANS", fuel: "diesel", vehicleType: "diesel_light_duty_truck", modelYear: 2021, gallons: "1200", vehicleCount: 4, miles: null, fuelEconomy: null } })
const power = record({ kind: "electricity", sourceId: "M-1", quantity: q("250000", "kWh"), payload: { meterOrAccountNumber: "M-1", utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } })
const withdrawn = record({ kind: "natural_gas", sourceId: "GAS-1", state: "withdrawn", withdrawalReason: "Entered twice.", quantity: q("12500", "therm"), payload: { heatContent: null } })
const setupView = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: setup, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
  setup: { company: { legalName: "Synthetic Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01", firstInventory: "yes", priorInventoryReference: "" },
    boundary: { approach: "operational_control", notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: office, name: "Office", inclusion: "included" }, { id: warehouse, name: "Warehouse", inclusion: "excluded" }], screening: [], changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } } as unknown as CompanySetupView
const evidence: CollectionEvidenceMetadata[] = []
const billId = "72000000-0000-4000-8000-0000000000e1"
const bill: CollectionEvidenceMetadata = { id: billId, companyId: company, bucket: "neuvetra-private-company-evidence", objectKey: `${company}/original/${billId}`, originalName: "gas-bill.pdf", mediaType: "application/pdf", byteLength: 100, sha256: "d".repeat(64), quarantineStatus: "pending", uploadedBy: owner, createdAt: "2025-06-01T00:00:00.000Z" }

describe("draft results (Claude UX journey)", () => {
  test("a setup save between the context and report reads returns a retryable error before any calculation", async () => {
    const newer = "72000000-0000-4000-8000-0000000000b2"
    let currentContext = context, calculations = 0
    const currentSetup = { ...setupView, currentVersion: { ...setupView.currentVersion!, id: newer, revision: 2 } }
    const database: CollectionResultsDatabase = { findCollectionContext: async () => currentContext, findCollectionActivities: async () => [gasOffice],
      findCollectionEvidence: async () => [], findCompanySetup: async () => currentSetup, findCurrentMethodReleases: async () => [] }
    const checkedEngines = { ...engines, scope1: { ...engines.scope1, calculate: async (...args: Parameters<typeof engines.scope1.calculate>) => { calculations++; return engines.scope1.calculate(...args) } } }
    const route = createCollectionResultsRoutes({ database, engines: checkedEngines, environment: "synthetic_staging", origin: "https://www.neuvetra.ai", validateUser: async () => ({ id: owner, phone: null, email: null, fullName: null }) })
    const request = () => route(new Request(`https://www.neuvetra.ai/workspace/${company}/results`, { headers: { authorization: "Bearer owner" } }))
    const raced = await request()
    expect(raced.status).toBe(503)
    expect(await raced.json()).toEqual({ error: "Company setup changed while preparing results. Reload and try again." })
    expect(calculations).toBe(0)
    currentContext = { ...context, setupVersionId: newer, setupRevision: 2, locations: context.locations.map(location => ({ ...location, inclusion: "excluded" })) }
    const fresh = await request()
    expect(fresh.status).toBe(200)
    expect(await fresh.json()).toMatchObject({ counts: { excluded: 1, calculated: 0 }, scope1: null })
    expect(calculations).toBe(0)
  })
  test("the public builder requires consistent company/version/revision and explicitly allows an empty no-setup state", async () => {
    for (const inconsistent of [null, { ...setupView, currentVersion: null },
      { ...setupView, currentVersion: { ...setupView.currentVersion!, revision: 2 } },
      { ...setupView, currentVersion: { ...setupView.currentVersion!, companyId: other } }])
      await expect(buildCollectionResults({ companyId: company, context, records: [gasOffice], evidence, setup: inconsistent, engines })).rejects.toMatchObject({ code: "SETUP_CHANGED" })
    const empty = await buildCollectionResults({ companyId: company, context: { companyId: company, setupVersionId: null, setupRevision: null, locations: [] }, records: [], evidence: [], setup: null, engines })
    expect(empty).toMatchObject({ setup: null, counts: { records: 0 }, scope1: null, scope2: null })
  })
  test("calculates only what the reviewed adapter admits and keeps every hold visible", async () => {
    const result = await buildCollectionResults({ companyId: company, context, records: [gasOffice, gasWarehouse, gasBlank, vans, power, withdrawn], evidence, setup: setupView, engines, now: () => new Date("2026-09-29T00:00:00Z") })
    expect(result.label).toBe(DRAFT_RESULTS_LABEL)
    expect(result.counts).toEqual({ records: 6, calculated: 3, held: 3, withdrawn: 1, excluded: 1, inputNeeded: 1, outsidePeriod: 0, unavailable: 0 })
    expect(result.records.every(item => item.periodCheck === "inside")).toBe(true)
    const row = (id: string) => result.records.find(item => item.recordId === id)!
    expect(row(gasOffice.id).scope1?.status).toBe("complete")
    expect(row(gasWarehouse.id).plan.reasons).toEqual(["location_excluded_by_company_setup"])
    expect(row(gasBlank.id).plan.reasons).toEqual(["quantity_not_calculable"])
    expect(row(withdrawn.id).plan.status).toBe("withdrawn")
    expect(row(vans.id).scope1?.status).toBe("partial")
    expect(row(vans.id).scope1?.estimates).toContain("ch4_n2o_missing")
    expect(row(power.id).scope2?.locationBased.status).toBe("complete")
    // Held and excluded records never reach an engine or a subtotal.
    for (const id of [gasWarehouse.id, gasBlank.id, withdrawn.id]) expect(row(id).scope1).toBeNull()
    expect(result.scope1?.resultCount).toBe(2)
    expect(result.scope1?.complete).toBe(false)
    expect(result.scope2?.locationBasedComplete).toBe(true)
    // The subtotal is the engine's own aggregate of the two Scope 1 results, never a client sum.
    const sum = [row(gasOffice.id).scope1!, row(vans.id).scope1!].map(item => Number(item.total!.unrounded)).reduce((a, b) => a + b, 0)
    expect(Math.abs(Number(result.scope1!.knownSourceSubtotal.unrounded) - sum)).toBeLessThan(1e-6)
    expect(result.setup?.legalName).toBe("Synthetic Co")
    expect(row(gasOffice.id).evidence).toEqual([])
    // Board option 1 (2026-09-29): synthetic staging only, and every method that produced a number is named as unreleased,
    // with the engine and register bytes that ran it.
    expect([result.syntheticOnly, result.environment]).toEqual([true, DRAFT_RESULTS_ENVIRONMENT])
    expect(result.label).toContain("unreleased beta methods")
    expect(result.methods.map(m => [m.methodVersionId, m.scope, m.engineSha256, m.releaseStatus, m.releaseId, m.releaseLabel])).toEqual([
      ["scope1.mobile.onroad_diesel.v2", 1, REVIEWED_SCOPE1_ENGINE_SHA256, "unreleased_beta", null, null],
      ["scope1.stationary.natural_gas.v2", 1, REVIEWED_SCOPE1_ENGINE_SHA256, "unreleased_beta", null, null],
      ["scope2.electricity.egrid2023_greene2025.v3", 2, REVIEWED_SCOPE2_ENGINE_SHA256, "unreleased_beta", null, null]])
    expect(result.warnings).toEqual([])
    expect(result.methods.every(m => /^[0-9a-f]{64}$/.test(m.registerSha256))).toBe(true)
    // Subtotal membership per basis comes from the engine aggregates; held rows are in none.
    expect(row(gasOffice.id).inSubtotal).toEqual({ scope1: true, scope2LocationBased: false, scope2MarketBased: false })
    expect(row(vans.id).inSubtotal.scope1).toBe(true)
    expect(row(power.id).inSubtotal).toEqual({ scope1: false, scope2LocationBased: true, scope2MarketBased: true })
    for (const id of [gasWarehouse.id, gasBlank.id, withdrawn.id]) expect(row(id).inSubtotal).toEqual({ scope1: false, scope2LocationBased: false, scope2MarketBased: false })
  }, 60_000)

  test("a meter can be in the location-based subtotal but not the market-based one", async () => {
    const certificate = { type: "energy_attribute_certificate", mwh: "", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: billId, generationTechnology: "wind", rateLbPerMwh: null }
    const blankMwh = record({ kind: "electricity", sourceId: "M-2", evidenceIds: [billId], quantity: q("10000", "kWh"), payload: { meterOrAccountNumber: "M-2", utilityName: "Synthetic", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: null, instruments: [certificate] } })
    const result = await buildCollectionResults({ companyId: company, context, records: [power, blankMwh], evidence: [{ ...bill, quarantineStatus: "clean" }], setup: setupView, engines })
    const row = result.records.find(item => item.recordId === blankMwh.id)!
    expect(row.scope2?.marketBased.status).toBe("input_needed")
    expect(row.inSubtotal).toEqual({ scope1: false, scope2LocationBased: true, scope2MarketBased: false })
    expect(result.scope2?.marketBasedComplete).toBe(false)
  }, 60_000)

  // A-01/A-03 (26 October 2026): a certificate counts for one market-based claim, and only once its file has cleared review.
  test("A-01/A-03: a shared or uncleared certificate holds market-based only; location-based and Scope 1 are unchanged", async () => {
    const certId = "72000000-0000-4000-8000-0000000000f1", otherCertId = "72000000-0000-4000-8000-0000000000f2", copyId = "72000000-0000-4000-8000-0000000000f3"
    const certFile = (id: string, sha: string, quarantineStatus: CollectionEvidenceMetadata["quarantineStatus"] = "clean"): CollectionEvidenceMetadata => ({ ...bill, id, objectKey: `${company}/original/${id}`, originalName: `${id.slice(-2)}.pdf`, sha256: sha.repeat(64), quarantineStatus })
    const meter = (sourceId: string, cert: string) => record({ kind: "electricity", sourceId, evidenceIds: [cert], quantity: q("100000", "kWh"), payload: { meterOrAccountNumber: sourceId, utilityName: "Synthetic", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: null,
      instruments: [{ type: "energy_attribute_certificate", mwh: "40", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: cert, generationTechnology: "wind", rateLbPerMwh: null }] } })
    const a = meter("M-A", certId), b = meter("M-B", certId), c = meter("M-C", otherCertId), copy = meter("M-D", copyId)
    const files = [certFile(certId, "1"), certFile(otherCertId, "2"), certFile(copyId, "1")]
    const run = (records: CollectionActivityRecord[], evidenceFiles = files) => buildCollectionResults({ companyId: company, context, records: [gasOffice, ...records], evidence: evidenceFiles, setup: setupView, engines })
    const separate = await run([a, c])
    const shared = await run([a, b])
    const sameBytes = await run([a, copy])
    const waiting = await run([a, c], [certFile(certId, "1", "pending"), certFile(otherCertId, "2")])
    const row = (result: CollectionResultsResponse, id: string) => result.records.find(item => item.recordId === id)!
    // Separate certificates: both count (the existing behaviour).
    for (const id of [a.id, c.id]) expect([row(separate, id).plan.notes, row(separate, id).scope2!.marketBased.status, row(separate, id).inSubtotal.scope2MarketBased]).toEqual([[], "complete", true])
    // One file on two meters, or the same bytes uploaded twice: neither claim counts.
    for (const [result, ids] of [[shared, [a.id, b.id]], [sameBytes, [a.id, copy.id]]] as const) {
      for (const id of ids) {
        const r = row(result, id)
        expect([r.outcome, r.plan.notes, r.scope2!.marketBased.status, r.scope2!.marketBased.findings, r.inSubtotal]).toEqual(["calculated", ["instrument_1_evidence_shared"], "input_needed", ["instrument_evidence_required"], { scope1: false, scope2LocationBased: true, scope2MarketBased: false }])
        expect(r.scope2!.locationBased.total).toEqual(row(separate, a.id).scope2!.locationBased.total)
      }
      expect([result.scope2!.marketBasedComplete, result.scope2!.locationBasedSubtotal, result.scope1!.knownSourceSubtotal]).toEqual([false, separate.scope2!.locationBasedSubtotal, separate.scope1!.knownSourceSubtotal])
    }
    // A file waiting for quarantine review holds that meter's market-based result until it clears.
    expect([row(waiting, a.id).plan.notes, row(waiting, a.id).scope2!.marketBased.status, row(waiting, a.id).inSubtotal.scope2MarketBased]).toEqual([["instrument_1_evidence_pending_scan"], "input_needed", false])
    expect(row(waiting, c.id).scope2!.marketBased.total).toEqual(row(separate, c.id).scope2!.marketBased.total)
    expect(waiting.scope2!.locationBasedSubtotal).toEqual(separate.scope2!.locationBasedSubtotal)
  }, 120_000)

  test("the route refuses to exist outside synthetic staging", () => {
    const database = { findCollectionContext: async () => null, findCollectionActivities: async () => [], findCollectionEvidence: async () => [], findCompanySetup: async () => setupView, findCurrentMethodReleases: async () => [] } as CollectionResultsDatabase
    for (const environment of ["production", "staging", "", undefined])
      expect(() => createCollectionResultsRoutes({ database, engines, origin: "https://www.neuvetra.ai", validateUser: async () => null, environment: environment as never })).toThrow(/synthetic staging/)
  })

  test("each row names its linked evidence and scan state", async () => {
    const linked = record({ kind: "natural_gas", sourceId: "GAS-9", quantity: q("10", "therm"), payload: { heatContent: null }, evidenceIds: [billId] })
    const result = await buildCollectionResults({ companyId: company, context, records: [linked], evidence: [bill], setup: setupView, engines })
    expect(result.records[0]!.evidence).toEqual([{ id: billId, name: "gas-bill.pdf", sha256: "d".repeat(64), status: "pending" }])
  }, 60_000)

  test("a linked file that is not among the company's evidence is reported as missing, and evidence state never changes a figure (MR3)", async () => {
    const unknownId = "72000000-0000-4000-8000-0000000000e9"
    const linked = record({ kind: "natural_gas", sourceId: "GAS-8", quantity: q("10", "therm"), payload: { heatContent: null }, evidenceIds: [billId, unknownId] })
    const unlinked = record({ kind: "natural_gas", sourceId: "GAS-8", quantity: q("10", "therm"), payload: { heatContent: null } })
    // One at a time: the engines admit two concurrent processes in total.
    const withFiles = await buildCollectionResults({ companyId: company, context, records: [linked], evidence: [bill], setup: setupView, engines })
    const without = await buildCollectionResults({ companyId: company, context, records: [unlinked], evidence: [], setup: setupView, engines })
    const cleared = await buildCollectionResults({ companyId: company, context, records: [linked], evidence: [{ ...bill, quarantineStatus: "clean" }], setup: setupView, engines })
    expect(without.records[0]!.outcome).toBe("calculated")
    expect(withFiles.records[0]!.evidence.map(file => [file.id, file.status])).toEqual([[billId, "pending"], [unknownId, "missing"]])
    expect(withFiles.records[0]!.evidenceCount).toBe(2)
    for (const result of [withFiles, cleared]) {
      expect(result.records[0]!.outcome).toBe(without.records[0]!.outcome)
      expect(result.records[0]!.scope1?.total).toEqual(without.records[0]!.scope1?.total)
      expect(result.scope1?.knownSourceSubtotal).toEqual(without.scope1?.knownSourceSubtotal)
    }
  }, 60_000)

  test("records outside the setup reporting period are held, never totalled under that period", async () => {
    const current = setupView.currentVersion!
    const withPeriod = (start: string, endExclusive: string) => ({ ...setupView, currentVersion: { ...current, setup: { ...current.setup, reportingPeriod: { ...current.setup.reportingPeriod, start, endExclusive } } } }) as typeof setupView
    const prior = await buildCollectionResults({ companyId: company, context, records: [gasOffice, power], evidence, setup: withPeriod("2024-01-01", "2025-01-01"), engines })
    expect(prior.records.map(item => [item.periodCheck, item.outcome])).toEqual([["outside", "held"], ["outside", "held"]])
    expect(prior.scope1).toBeNull(); expect(prior.scope2).toBeNull()
    expect(prior.counts.outsidePeriod).toBe(2); expect(prior.counts.calculated).toBe(0)
    const fiscal = await buildCollectionResults({ companyId: company, context, records: [gasOffice], evidence, setup: withPeriod("2025-07-01", "2026-07-01"), engines })
    expect(fiscal.records[0]!.periodCheck).toBe("partial"); expect(fiscal.records[0]!.scope1).toBeNull()
    expect(checkPeriod({ start: "2025-01-01", endExclusive: "2026-01-01" }, { start: null, endExclusive: null })).toBe("no_period")
    expect(checkPeriod({ start: "2025-03-01", endExclusive: "2025-04-01" }, { start: "2025-01-01", endExclusive: "2026-01-01" })).toBe("inside")
    expect(checkPeriod({ start: "2025-12-01", endExclusive: "2026-01-01" }, { start: "2026-01-01", endExclusive: "2027-01-01" })).toBe("outside")
  })

  test("an empty collection returns no subtotal rather than zero", async () => {
    const result = await buildCollectionResults({ companyId: company, context, records: [], evidence, setup: setupView, engines })
    expect(result.scope1).toBeNull(); expect(result.scope2).toBeNull(); expect(result.counts.records).toBe(0)
  })

  test("the route authenticates, checks the origin and never serves another company", async () => {
    const database: CollectionResultsDatabase = {
      findCollectionContext: async (user, id) => user === owner && id === company ? context : null,
      findCollectionActivities: async (user, id) => user === owner && id === company ? [gasOffice] : [],
      findCollectionEvidence: async () => [],
      findCompanySetup: async (user, id) => user === owner && id === company ? setupView : null,
      findCurrentMethodReleases: async () => [],
    }
    const routes = createCollectionResultsRoutes({ database, engines, environment: "synthetic_staging", origin: "https://www.neuvetra.ai", validateUser: async token => token === "owner" ? { id: owner, phone: null, email: null, fullName: null } : token === "stranger" ? { id: stranger, phone: null, email: null, fullName: null } : null })
    const get = (path: string, token?: string, origin?: string) => routes(new Request(`https://www.neuvetra.ai${path}`, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) } }))
    expect((await get(`/workspace/${company}/results`)).status).toBe(401)
    expect((await get(`/workspace/${company}/results`, "nobody")).status).toBe(401)
    expect((await get(`/workspace/${company}/results`, "owner", "https://evil.example")).status).toBe(403)
    expect((await get(`/workspace/${company}/results`, "stranger")).status).toBe(404)
    expect((await get(`/workspace/${other}/results`, "owner")).status).toBe(404)
    expect((await routes(new Request(`https://www.neuvetra.ai/workspace/${company}/results`, { method: "POST", headers: { authorization: "Bearer owner", origin: "https://www.neuvetra.ai" } }))).status).toBe(405)
    const ok = await get(`/workspace/${company}/results`, "owner")
    expect(ok.status).toBe(200)
    expect(ok.headers.get("cache-control")).toBe("no-store")
    const body = await ok.json() as CollectionResultsResponse
    expect(body.records).toHaveLength(1)
    expect(body.records[0]!.scope1?.status).toBe("complete")
    // No release exists: the method is unreleased, without a warning.
    expect([body.label, body.methods.map(m => m.releaseStatus), body.warnings]).toEqual([DRAFT_RESULTS_LABEL, ["unreleased_beta"], []])
  }, 60_000)

  test("a record from another company is never calculated", async () => {
    const foreign = record({ kind: "natural_gas", sourceId: "GAS-X", quantity: q("10", "therm"), payload: { heatContent: null } }, other)
    const database: CollectionResultsDatabase = { findCollectionContext: async () => context, findCollectionActivities: async () => [foreign], findCollectionEvidence: async () => [], findCompanySetup: async () => setupView, findCurrentMethodReleases: async () => [] }
    const routes = createCollectionResultsRoutes({ database, engines, environment: "synthetic_staging", origin: "https://www.neuvetra.ai", validateUser: async () => ({ id: owner, phone: null, email: null, fullName: null }) })
    const response = await routes(new Request(`https://www.neuvetra.ai/workspace/${company}/results`, { headers: { authorization: "Bearer owner" } }))
    expect(response.status).toBe(404)
  })

  test("release status: released only for the exact release, engine and values; every other case is unreleased", () => {
    const method = { methodVersionId: "scope1.stationary.natural_gas.v2", engineSha256: "a".repeat(64), registerSha256: "b".repeat(64) }
    const release: ReleasedMethod = { releaseId: "74000000-0000-4000-8000-000000000001", profileId: "scope1.stationary.natural_gas", methodVersionId: method.methodVersionId, scope: 1, family: "stationary_combustion",
      engineSha256: method.engineSha256, registerSha256: method.registerSha256, gwpSetId: "AR5-100", outputLabel: "Draft — prepared with Neuvetra beta methods; not externally assured",
      factors: [{ key: "stationary.Natural Gas.co2", value: "53.06", unit: "kg CO2 per MMBtu HHV", cell: "E38", label: "Natural Gas", table: "Table 1" }], gwp: [], constants: [{ id: "therm_to_mmbtu", value: "0.1", unit: "MMBtu per therm" }] }
    const facts: EngineMethodFacts = { engineSha256: method.engineSha256, registerSha256: method.registerSha256, factorValues: { "stationary.Natural Gas.co2": "53.060" }, constantValues: { therm_to_mmbtu: { value: "0.1", unit: "MMBtu per therm" } } }
    const evidence = (change: Partial<ReleaseEvidence> = {}): ReleaseEvidence => ({ current: [release], engines: new Map([[method.methodVersionId, facts]]), ...change })
    expect(classifyMethodRelease(method, evidence())).toEqual({ releaseStatus: "released_beta", releaseId: release.releaseId, releaseLabel: release.outputLabel, problem: null })
    const cases: Array<[string, ReleaseEvidence | null, ReleaseProblem | null]> = [
      ["no check made", null, null],
      ["no release of this version", evidence({ current: [] }), null],
      ["release lookup failed", evidence({ current: null }), "release_lookup_unavailable"],
      ["released for another engine", evidence({ current: [{ ...release, engineSha256: "c".repeat(64) }] }), "engine_differs_from_release"],
      ["released for another register", evidence({ current: [{ ...release, registerSha256: "c".repeat(64) }] }), "engine_differs_from_release"],
      ["engine description unavailable", evidence({ engines: null }), "engine_description_unavailable"],
      ["engine describes other bytes", evidence({ engines: new Map([[method.methodVersionId, { ...facts, engineSha256: "c".repeat(64) }]]) }), "engine_differs_from_release"],
      ["engine factor value differs", evidence({ engines: new Map([[method.methodVersionId, { ...facts, factorValues: { "stationary.Natural Gas.co2": "53.07" } }]]) }), "engine_values_differ_from_release"],
      ["engine has an extra factor", evidence({ engines: new Map([[method.methodVersionId, { ...facts, factorValues: { ...facts.factorValues, extra: "1" } }]]) }), "engine_values_differ_from_release"],
      ["engine constant unit differs", evidence({ engines: new Map([[method.methodVersionId, { ...facts, constantValues: { therm_to_mmbtu: { value: "0.1", unit: "MMBtu" } } }]]) }), "engine_values_differ_from_release"],
    ]
    for (const [label, input, problem] of cases) expect([label, classifyMethodRelease(method, input)]).toEqual([label, { releaseStatus: "unreleased_beta", releaseId: null, releaseLabel: null, problem }])
  })

  test("the released label needs every method released; a mixed or failed check keeps the unreleased label and warns", async () => {
    const describe = async () => { const facts = new Map<string, EngineMethodFacts>(); for (const d of [await engines.scope1.describe(), await engines.scope2.describe()]) for (const m of d.methods) facts.set(m.id, { engineSha256: d.engineSha256, registerSha256: d.registerSha256, factorValues: m.factorValues, constantValues: m.constantValues }); return facts }
    const facts = await describe()
    const released = (id: string): ReleasedMethod => { const f = facts.get(id)!; return { releaseId: `74000000-0000-4000-8000-${String(id.length).padStart(12, "0")}`, profileId: id, methodVersionId: id, scope: id.startsWith("scope2") ? 2 : 1, family: "f", engineSha256: f.engineSha256, registerSha256: f.registerSha256, gwpSetId: "AR5-100", outputLabel: "Draft — prepared with Neuvetra beta methods; not externally assured",
      factors: Object.entries(f.factorValues).map(([key, value]) => ({ key, value, unit: "u", cell: "A1", label: key, table: "t" })), gwp: [], constants: Object.entries(f.constantValues).map(([id, c]) => ({ id, value: c.value, unit: c.unit })) } }
    const ids = ["scope1.stationary.natural_gas.v2", "scope2.electricity.egrid2023_greene2025.v3"]
    const run = (releases: ReleaseEvidence) => buildCollectionResults({ companyId: company, context, records: [gasOffice, power], evidence, setup: setupView, engines, releases })
    const all = await run({ current: ids.map(released), engines: facts })
    expect([all.label, all.methods.map(m => m.releaseStatus), all.warnings]).toEqual([RELEASED_DRAFT_RESULTS_LABEL, ["released_beta", "released_beta"], []])
    expect(all.methods.every(m => m.releaseLabel === "Draft — prepared with Neuvetra beta methods; not externally assured" && m.releaseId !== null)).toBe(true)
    const mixed = await run({ current: [released(ids[0]!)], engines: facts })
    expect([mixed.label, mixed.methods.map(m => m.releaseStatus), mixed.warnings]).toEqual([DRAFT_RESULTS_LABEL, ["released_beta", "unreleased_beta"], []])
    const failed = await run({ current: null, engines: facts })
    expect([failed.label, failed.methods.map(m => m.releaseStatus), failed.warnings]).toEqual([DRAFT_RESULTS_LABEL, ["unreleased_beta", "unreleased_beta"], ["Method release status could not be checked, so every method is shown as unreleased."]])
    // Nothing calculated: never the released label.
    const none = await buildCollectionResults({ companyId: company, context, records: [gasBlank], evidence, setup: setupView, engines, releases: { current: ids.map(released), engines: facts } })
    expect([none.label, none.methods]).toEqual([DRAFT_RESULTS_LABEL, []])
  }, 60_000)

  test("the route reads releases per request, describes the engines once, and a failed lookup never blocks results", async () => {
    let describeCalls = 0, lookups = 0
    const counted = { scope1: { ...engines.scope1, calculate: engines.scope1.calculate, aggregate: engines.scope1.aggregate, describe: async () => { describeCalls++; return engines.scope1.describe() } }, scope2: { ...engines.scope2, calculate: engines.scope2.calculate, aggregate: engines.scope2.aggregate, describe: async () => { describeCalls++; return engines.scope2.describe() } } }
    const facts = await engines.scope1.describe(), gas = facts.methods.find(m => m.id === "scope1.stationary.natural_gas.v2")!
    const release: ReleasedMethod = { releaseId: "74000000-0000-4000-8000-000000000009", profileId: "scope1.stationary.natural_gas", methodVersionId: gas.id, scope: 1, family: "stationary_combustion", engineSha256: facts.engineSha256, registerSha256: facts.registerSha256, gwpSetId: "AR5-100", outputLabel: "Draft — prepared with Neuvetra beta methods; not externally assured",
      factors: Object.entries(gas.factorValues).map(([key, value]) => ({ key, value, unit: "u", cell: "A1", label: key, table: "t" })), gwp: [], constants: Object.entries(gas.constantValues).map(([id, c]) => ({ id, value: c.value, unit: c.unit })) }
    let fail = false
    const database: CollectionResultsDatabase = { findCollectionContext: async () => context, findCollectionActivities: async () => [gasOffice], findCollectionEvidence: async () => [], findCompanySetup: async () => setupView,
      findCurrentMethodReleases: async () => { lookups++; if (fail) throw new Error("lookup failed"); return [release] } }
    const routes = createCollectionResultsRoutes({ database, engines: counted, environment: "synthetic_staging", origin: "https://www.neuvetra.ai", validateUser: async () => ({ id: owner, phone: null, email: null, fullName: null }) })
    const get = async () => (await routes(new Request(`https://www.neuvetra.ai/workspace/${company}/results`, { headers: { authorization: "Bearer owner" } }))).json() as Promise<CollectionResultsResponse>
    const first = await get(), second = await get()
    for (const body of [first, second]) expect([body.label, body.methods.map(m => [m.methodVersionId, m.releaseStatus, m.releaseId])]).toEqual([RELEASED_DRAFT_RESULTS_LABEL, [[gas.id, "released_beta", release.releaseId]]])
    expect([lookups, describeCalls]).toEqual([2, 2])
    fail = true
    const third = await get()
    expect([third.label, third.methods.map(m => m.releaseStatus), third.warnings, third.records[0]!.scope1?.status]).toEqual([DRAFT_RESULTS_LABEL, ["unreleased_beta"], ["Method release status could not be checked, so every method is shown as unreleased."], "complete"])
  }, 60_000)

  test("record counts: an engine hold counts as input needed or excluded, and an excluded record is not also outside the period (B02)", async () => {
    const records = [
      record({ kind: "natural_gas", sourceId: "GAS-CCF", quantity: q("1000", "ccf"), payload: { heatContent: null } }),
      record({ kind: "distillate_no2", sourceId: "GEN-1", quantity: q("", "US_gallon"), payload: { consumption: { basis: "purchases_only", purchasedGallons: "500" }, statedHhvMmbtuPerGallon: null } }),
      record({ kind: "fugitive", sourceId: "TENANT-RTU", quantity: q("", "kg"), payload: { gas: "R-410A", unit: "kg", terms: { PN: "0", CN: "0", PS: "2", CD: "0", RD: "0" }, insideBoundary: false, maintainsRefrigerantStock: false, retrofitInPeriod: false, contractorRecordsComplete: true, eventChronologyComplete: true } }),
      gasOffice,
    ]
    const held = await buildCollectionResults({ companyId: company, context, records, evidence: [], setup: setupView, engines })
    expect(Object.fromEntries(held.records.map(row => [row.sourceId, [row.outcome, row.scope1?.status]]))).toEqual({ "GAS-CCF": ["calculated", "input_needed"], "GEN-1": ["calculated", "input_needed"], "TENANT-RTU": ["calculated", "excluded"], "GAS-1": ["calculated", "complete"] })
    expect({ calculated: held.counts.calculated, inputNeeded: held.counts.inputNeeded, excluded: held.counts.excluded }).toEqual({ calculated: 1, inputNeeded: 2, excluded: 1 })
    // A record at an excluded location, dated outside the period: one excluded record, not also one outside the period.
    const current = setupView.currentVersion!
    const period2024 = { ...setupView, currentVersion: { ...current, setup: { ...current.setup, reportingPeriod: { ...current.setup.reportingPeriod, start: "2024-01-01", endExclusive: "2025-01-01" } } } } as typeof setupView
    const excludedSite = record({ kind: "natural_gas", sourceId: "GAS-W", locationId: warehouse, quantity: q("10", "therm"), payload: { heatContent: null } })
    const outside = await buildCollectionResults({ companyId: company, context, records: [excludedSite, gasOffice], evidence: [], setup: period2024, engines })
    expect(Object.fromEntries(outside.records.map(row => [row.sourceId, [row.plan.status, row.periodCheck]]))).toEqual({ "GAS-W": ["excluded", "outside"], "GAS-1": [null, "outside"] })
    expect([outside.counts.excluded, outside.counts.outsidePeriod]).toEqual([1, 1])
  }, 60_000)

  // BF2 (Request B closure P3): in the 2024 state the header listed 22 items for 21 records, because a record that needed
  // input and was outside the period counted twice. Each record now counts in exactly one header category.
  test("BF2: header counts never add up to more than the records; outside the period wins over input needed", async () => {
    const unknownGas = record({ kind: "natural_gas", sourceId: "GAS-UNKNOWN", quantity: q("unknown", "therm"), payload: { heatContent: null } })
    const generator = record({ kind: "distillate_no2", sourceId: "GEN-1", quantity: q("", "US_gallon"), payload: { consumption: { basis: "purchases_only", purchasedGallons: "500" }, statedHhvMmbtuPerGallon: null } })
    const current = setupView.currentVersion!
    const period = (start: string, endExclusive: string) => ({ ...setupView, currentVersion: { ...current, setup: { ...current.setup, reportingPeriod: { ...current.setup.reportingPeriod, start, endExclusive } } } }) as typeof setupView
    const header = (counts: CollectionResultsResponse["counts"]) => counts.calculated + counts.inputNeeded + counts.outsidePeriod + counts.excluded + counts.withdrawn + counts.unavailable
    const inYear = await buildCollectionResults({ companyId: company, context, records: [unknownGas, generator, gasOffice], evidence: [], setup: period("2025-01-01", "2026-01-01"), engines })
    expect(inYear.counts).toMatchObject({ records: 3, calculated: 1, inputNeeded: 2, outsidePeriod: 0 })
    const prior = await buildCollectionResults({ companyId: company, context, records: [unknownGas, generator, gasOffice], evidence: [], setup: period("2024-01-01", "2025-01-01"), engines })
    expect(prior.records.find(row => row.sourceId === "GAS-UNKNOWN")!.plan.status).toBe("input_needed")
    expect(prior.counts).toMatchObject({ records: 3, calculated: 0, inputNeeded: 0, outsidePeriod: 3 })
    for (const result of [inYear, prior]) expect(header(result.counts)).toBe(result.counts.records)
  }, 60_000)

  // Request B (14 October 2026) actual hosted captures, bound by SHA-256. Run with NEUVETRA_REQUEST_B_CAPTURES set to the
  // folder holding them (notes\reviews\2026-10-14-request-b-integrated-qa); skipped without it, never fetched.
  const captures = process.env.NEUVETRA_REQUEST_B_CAPTURES
  test.skipIf(!captures)("Request B captures: the engine-held generator and refrigerant records count as input needed, not calculated (B02)", async () => {
    const bound = { "company-a-results-api.json": "c769faa06e62ddfeac905828fb24d7408c719c3a14157d8370d08b4251b44f33", "company-b-results-api.json": "ceabb84edc1e8a93a81dddcd1ead793289ee61e257e5187e5aa62dca22047b03" }
    for (const [name, sha256] of Object.entries(bound)) {
      const bytes = await Bun.file(`${captures}/${name}`).bytes()
      expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(sha256)
      const capture = JSON.parse(new TextDecoder().decode(bytes)) as CollectionResultsResponse
      // What the fixed MR2 image served: the three engine holds counted as calculated.
      expect(capture.counts).toEqual({ records: 21, calculated: 20, held: 1, withdrawn: 0, excluded: 0, inputNeeded: 1, outsidePeriod: 0, unavailable: 0 })
      const engineHeld = capture.records.filter(row => row.outcome === "calculated" && (row.scope1?.status === "input_needed" || row.scope1?.status === "review_required")).map(row => row.sourceId).sort()
      expect(engineHeld).toEqual(["RB-20261014-generator-purchases-only", "RB-20261014-refrigerant-stock", "RB-20261014-refrigerant-unknown"])
      expect(resultCounts(capture.records as CollectionResultRow[])).toEqual({ records: 21, calculated: 17, held: 1, withdrawn: 0, excluded: 0, inputNeeded: 4, outsidePeriod: 0, unavailable: 0 })
    }
  })

  test("a request sent after a save never joins an earlier run; requests that arrive during a run share one follow-up run (BF1)", async () => {
    let records: CollectionActivityRecord[] = [], reads = 0
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const database: CollectionResultsDatabase = { findCollectionContext: async () => context, findCollectionEvidence: async () => [], findCompanySetup: async () => setupView, findCurrentMethodReleases: async () => [],
      findCollectionActivities: async () => { reads++; const snapshot = records; if (reads === 1) await gate; return snapshot } }
    const routes = createCollectionResultsRoutes({ database, engines, environment: "synthetic_staging", origin: "https://www.neuvetra.ai", validateUser: async () => ({ id: owner, phone: null, email: null, fullName: null }) })
    const get = () => routes(new Request(`https://www.neuvetra.ai/workspace/${company}/results`, { headers: { authorization: "Bearer owner" } })).then(response => response.json() as Promise<CollectionResultsResponse>)
    const first = get()                      // starts a run that reads the collection before the save
    while (reads === 0) await Bun.sleep(1)
    records = [gasOffice]                     // the user saves a record
    const second = get(), third = get()       // both sent after the save, while the first run is still going
    await Bun.sleep(20)
    expect(reads).toBe(1)                     // the follow-up run waits: one run per company at a time
    release()
    const [a, b, c] = await Promise.all([first, second, third])
    expect([a.records.length, b.records.length, c.records.length]).toEqual([0, 1, 1])
    expect(reads).toBe(2)                     // the two later requests shared one follow-up run
    expect(await get().then(r => r.records.length)).toBe(1)
    expect(reads).toBe(3)                     // and nothing stays queued afterwards
  }, 60_000)

  test("a release check that cannot run is logged with only its stage and an error code, and logging never blocks results (MR3)", async () => {
    const secret = "postgres://neuvetra_runtime:not-a-real-password@db.example.invalid:5432/postgres"
    const facts = await engines.scope1.describe(), gas = facts.methods.find(m => m.id === "scope1.stationary.natural_gas.v2")!
    const release: ReleasedMethod = { releaseId: "74000000-0000-4000-8000-000000000019", profileId: "scope1.stationary.natural_gas", methodVersionId: gas.id, scope: 1, family: "stationary_combustion", engineSha256: facts.engineSha256, registerSha256: facts.registerSha256, gwpSetId: "AR5-100", outputLabel: "Draft — prepared with Neuvetra beta methods; not externally assured",
      factors: Object.entries(gas.factorValues).map(([key, value]) => ({ key, value, unit: "u", cell: "A1", label: key, table: "t" })), gwp: [], constants: Object.entries(gas.constantValues).map(([id, c]) => ({ id, value: c.value, unit: c.unit })) }
    let mode: "lookup" | "describe" | "ok" = "lookup", throwingLogger = false
    const failing = { scope1: { ...engines.scope1, calculate: engines.scope1.calculate, aggregate: engines.scope1.aggregate, describe: async () => { if (mode === "describe") throw new Error(secret); return engines.scope1.describe() } }, scope2: engines.scope2 }
    const database: CollectionResultsDatabase = { findCollectionContext: async () => context, findCollectionActivities: async () => [gasOffice], findCollectionEvidence: async () => [], findCompanySetup: async () => setupView,
      findCurrentMethodReleases: async () => { if (mode === "lookup") throw Object.assign(new Error(secret), { code: "42501" }); return [release] } }
    const logs: ResultsReleaseCheckLog[] = []
    const routes = createCollectionResultsRoutes({ database, engines: failing, environment: "synthetic_staging", origin: "https://www.neuvetra.ai", validateUser: async () => ({ id: owner, phone: null, email: null, fullName: null }),
      log: event => { if (throwingLogger) throw new Error("log sink down"); logs.push(event) } })
    const get = async () => { const response = await routes(new Request(`https://www.neuvetra.ai/workspace/${company}/results`, { headers: { authorization: "Bearer owner" } })); return [response.status, await response.json()] as [number, CollectionResultsResponse] }
    const [lookupStatus, lookupBody] = await get()
    mode = "describe"
    const [describeStatus, describeBody] = await get()
    expect([lookupStatus, describeStatus]).toEqual([200, 200])
    expect(logs).toEqual([{ event: "results_release_check_unavailable", stage: "release_lookup", errorCode: "42501" }, { event: "results_release_check_unavailable", stage: "engine_description", errorCode: "Error" }])
    for (const text of [secret, owner, company, "not-a-real-password"]) expect(JSON.stringify(logs)).not.toContain(text)
    expect([lookupBody.warnings, describeBody.warnings]).toEqual([["Method release status could not be checked, so every method is shown as unreleased."], ["A released method could not be checked against the running engine, so it is shown as unreleased."]])
    // A logger that throws changes nothing for the user.
    throwingLogger = true; mode = "lookup"
    const [status, body] = await get()
    expect([status, body.label, body.records[0]!.scope1?.status]).toEqual([200, DRAFT_RESULTS_LABEL, "complete"])
    // A successful check logs nothing.
    throwingLogger = false; mode = "ok"; logs.length = 0
    const [okStatus, okBody] = await get()
    expect([okStatus, okBody.label, logs]).toEqual([200, RELEASED_DRAFT_RESULTS_LABEL, []])
  }, 60_000)

  test("the log names only an SQLSTATE or a known error class; any other name or thrown value is \"other\" (Codex MR3 F2)", async () => {
    const thrown: unknown[] = [
      { name: "SyntheticCustomerPrivateToken", message: "omitted" },                 // Codex's reproduction
      Object.assign(new Error("x"), { name: "AcmeCorpJaneDoe" }),                    // any alphabetic custom name
      Object.assign(new Error("x"), { name: "Error ", code: "jane@example.invalid" }), // near-miss name, non-SQLSTATE code
      { code: "42P01", name: "AcmeCorp" },                                            // SQLSTATE wins, name ignored
      new TypeError("x"), new RangeError("x"), Object.assign(new Error("x"), { name: "PostgresError" }),
      "a thrown string", null, undefined, 7, { code: "abcde" }, { code: "4250" }, { code: "425011" },
    ]
    const logs: ResultsReleaseCheckLog[] = []
    let next = 0
    const database: CollectionResultsDatabase = { findCollectionContext: async () => context, findCollectionActivities: async () => [], findCollectionEvidence: async () => [], findCompanySetup: async () => setupView,
      findCurrentMethodReleases: async () => { throw thrown[next++] } }
    const routes = createCollectionResultsRoutes({ database, engines, environment: "synthetic_staging", origin: "https://www.neuvetra.ai", validateUser: async () => ({ id: owner, phone: null, email: null, fullName: null }), log: event => logs.push(event) })
    for (const _ of thrown) expect((await routes(new Request(`https://www.neuvetra.ai/workspace/${company}/results`, { headers: { authorization: "Bearer owner" } }))).status).toBe(200)
    expect(logs.map(event => event.errorCode)).toEqual(["other", "other", "other", "42P01", "TypeError", "RangeError", "PostgresError", "other", "other", "other", "other", "other", "other", "other"])
    expect(logs.every(event => event.stage === "release_lookup" && (/^([0-9A-Z]{5}|other)$/.test(event.errorCode) || LOGGABLE_ERROR_CLASSES.has(event.errorCode)))).toBe(true)
    for (const text of ["SyntheticCustomerPrivateToken", "AcmeCorp", "JaneDoe", "jane@", "omitted", "thrown string"]) expect(JSON.stringify(logs)).not.toContain(text)
  }, 60_000)
})

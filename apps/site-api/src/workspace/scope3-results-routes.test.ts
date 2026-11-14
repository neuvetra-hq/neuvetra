// Scope 3 package 2: the draft Scope 3 results route, end to end through the adapter, the real Scope 3 engine and the
// trusted boundary. Cases S3-01 to S3-14 of the 19 October brief that are route behaviour. Claude, 26 October 2026.
import { describe, expect, test } from "bun:test"
import { SCOPE3_CAPACITY_TEXT, validateCollectionActivity, type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView } from "@neuvetra/database"
import { createScope1Engine } from "../calculation/scope1-authority"
import { createScope2Engine } from "../calculation/scope2-authority"
import { createScope3Engine } from "../calculation/scope3-authority"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { planElectricityUpstream, planEnergyResoldUpstream, planFuelUpstream, planGridLossCalculation, planScope3Calculation, type Scope3CollectionVersion } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { SCOPE3_COMPLETION_KINDS, SCOPE3_KIND_CATEGORIES } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import { buildCollectionResults, DRAFT_RESULTS_LABEL, REVIEWED_SCOPE1_ENGINE_SHA256, REVIEWED_SCOPE2_ENGINE_SHA256 } from "./collection-results-routes"
import { buildScope3Results, createScope3ResultsRoutes, MAX_COMPANY_RECORDS, MAX_SCOPE3_LINES, MAX_SCOPE3_RUN_LINES, scope3LineCountRule, scope3StoredLineCount, REVIEWED_SCOPE3_ENGINE_SHA256, SCOPE3_RESULTS_PROFILE, scope3AnnotationOf, scope3HeldOutcome, scope3RowPlan, type Scope3ResultRow, type Scope3ResultsDatabase, type Scope3ResultsEngine } from "./scope3-results-routes"
import { fixtureAssessmentRecord } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import type { Scope3AssessmentRecord } from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"

const python = process.env.NEUVETRA_PYTHON ?? "python3"
const direct = createScope3Engine({ python, expectedEngineSha256: REVIEWED_SCOPE3_ENGINE_SHA256 })
const engine: Scope3ResultsEngine = direct
const scope12 = { scope1: createScope1Engine({ python, expectedEngineSha256: REVIEWED_SCOPE1_ENGINE_SHA256 }), scope2: createScope2Engine({ python, expectedEngineSha256: REVIEWED_SCOPE2_ENGINE_SHA256 }) }
const company = "93000000-0000-4000-8000-000000000001", setup = "93000000-0000-4000-8000-000000000002"
const office = "93000000-0000-4000-8000-000000000003", warehouse = "93000000-0000-4000-8000-000000000004"
const owner = "93000000-0000-4000-8000-0000000000a1"
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [
  { id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" },
  { id: warehouse, name: "Warehouse", inclusion: "excluded", control: "landlord", entityId: null, startMode: "period_start", endMode: "period_end" }] }
const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic", notes: "", evidenceIds: [] as string[], period: year }
const q = (value: string, unit: string) => { const ok = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value); return { originalValue: value, originalUnit: unit, normalizedValue: ok ? value : null, normalizedUnit: ok ? unit : null } }
let n = 0
function record(activity: Record<string, unknown>): CollectionActivityRecord {
  const id = `93000000-0000-4000-8000-${String(1000 + ++n).padStart(12, "0")}`
  const parsed = validateCollectionActivity({ ...common, ...activity })
  const version = { id: `94000000-0000-4000-8000-${String(1000 + n).padStart(12, "0")}`, recordId: id, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z" }
  return { id, companyId: company, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined } as never] }
}
type Screen = "unknown" | "yes" | "no" | "not_applicable"
function setupView(screen: Partial<Record<number, Screen>>, period = year): CompanySetupView {
  const screening = Object.entries(screen).map(([category, state]) => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[Number(category) - 1]!, state, reason: state === "no" || state === "not_applicable" ? "Synthetic screening reason." : "", details: "", locationId: null }))
  return { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: setup, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
    setup: { company: { legalName: "Synthetic Scope 3 Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { start: period.start, endExclusive: period.endExclusive, firstInventory: "yes", priorInventoryReference: "" },
      boundary: { approach: "operational_control", notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }, { id: warehouse, name: "Warehouse", inclusion: "excluded", control: "landlord", entityId: null, startMode: "period_start", endMode: "period_end" }], screening, changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } } as unknown as CompanySetupView
}
const evidence: CollectionEvidenceMetadata[] = []

const power = (kwh = "250000") => record({ kind: "electricity", sourceId: "M-1", quantity: q(kwh, "kWh"), payload: { meterOrAccountNumber: "M-1", utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } })
const powerWarehouse = record({ kind: "electricity", sourceId: "M-2", locationId: warehouse, quantity: q("90000", "kWh"), payload: { meterOrAccountNumber: "M-2", utilityName: "City & County of San Francisco", site: "Warehouse", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } })
const freight = record({ kind: "transport", sourceId: "LANE-1", quantity: q("1200.5", "short ton-mile"), payload: { category: 4, vehicle: "rail", loadBasis: "shared_vehicle", thirdPartyFacilities: "none" } })
const asphalt = record({ kind: "waste", sourceId: "W-1", quantity: q("17.125", "metric_ton"), payload: { category: 5, material: "asphalt_concrete", treatment: "recycled" } })
const unknownWaste = record({ kind: "waste", sourceId: "W-2", quantity: q("3", "metric_ton"), payload: { category: 5, material: "unobtainium", treatment: "recycled" } })
const flights = record({ kind: "business_travel", sourceId: "T-1", quantity: q("2400", "mile"), payload: { mode: "air", passengerSegments: 4, haulBasis: null } })
const cancelled = record({ kind: "business_travel", sourceId: "T-2", state: "withdrawn", withdrawalReason: "Trip cancelled.", quantity: q("800", "mile"), payload: { mode: "air", passengerSegments: 2, haulBasis: null } })
const commute = record({ kind: "employee_commuting", sourceId: "C-1", quality: "estimated", estimateBasis: "Survey of 40 staff, scaled to 120.", quantity: q("9800", "passenger-mile"), payload: { mode: "bus" } })
const powerOffice = power()
const gas = record({ kind: "natural_gas", sourceId: "GAS-1", quantity: q("12500", "therm"), payload: { heatContent: null } })
const scope3Records = [freight, asphalt, unknownWaste, flights, cancelled, commute]
const included: Partial<Record<number, Screen>> = { 1: "no", 3: "yes", 4: "yes", 5: "yes", 6: "yes", 7: "yes", 9: "not_applicable", 12: "no" }
const build = (records: CollectionActivityRecord[], screen = included, period = year, use: Scope3ResultsEngine = engine, assessments: Scope3AssessmentRecord[] | null = null) =>
  buildScope3Results({ companyId: company, context: { ...context, reportingPeriod: period }, records, evidence, setup: setupView(screen, period), engine: use, now: () => new Date("2026-10-26T00:00:00Z"), assessments })
const TIMEOUT = 120_000
/** I-12u: the adapter plan of a response line, by its kind (a saved Scope 3 record, or a line derived from a Scope 1/2 or 3D record). */
const planOf = (source: CollectionActivityRecord, kind: string) => kind === "td_losses" ? planGridLossCalculation(source.currentVersion, context, evidence)
  : kind === "td_losses_upstream" || kind === "electricity_upstream" ? planElectricityUpstream(source.currentVersion, context, evidence, kind)
  : kind === "fuel_upstream" ? planFuelUpstream(source.currentVersion, context, evidence)
  : kind === "energy_resold_upstream" ? planEnergyResoldUpstream(source.currentVersion as unknown as Scope3CollectionVersion, context, evidence)
  : planScope3Calculation(source.currentVersion as unknown as Scope3CollectionVersion, context, evidence)

describe("draft Scope 3 results (Scope 3 package 2)", () => {
  test("refuses mixed company/setup snapshots before invoking the engine", async () => {
    let calls = 0
    const unused = { describe: async () => { calls++; throw new Error("must not reach engine") }, calculateMany: async () => { calls++; throw new Error("must not reach engine") }, aggregate: async () => { calls++; throw new Error("must not reach engine") } } as Scope3ResultsEngine
    const live = setupView(included)
    const other = "93000000-0000-4000-8000-000000000099"
    for (const mismatch of [
      { ...context, companyId: other }, { ...context, setupVersionId: other }, { ...context, setupRevision: 2 },
    ]) await expect(buildScope3Results({ companyId: company, context: mismatch, records: [], evidence: [], setup: live, engine: unused })).rejects.toMatchObject({ code: "SETUP_CHANGED" })
    await expect(buildScope3Results({ companyId: company, context, records: [], evidence: [], setup: { ...live, currentVersion: { ...live.currentVersion!, companyId: other } }, engine: unused })).rejects.toMatchObject({ code: "SETUP_CHANGED" })
    expect(calls).toBe(0)
  })

  test("calculates what the adapter admits, holds the rest with reasons, and builds verified coverage", async () => {
    const result = await build([gas, powerOffice, powerWarehouse, ...scope3Records])
    expect(result.profile).toBe(SCOPE3_RESULTS_PROFILE)
    expect(result.label).toBe(DRAFT_RESULTS_LABEL)
    expect([result.syntheticOnly, result.environment]).toEqual([true, "synthetic_staging"])
    const row = (id: string, kind?: string) => result.records.find(item => item.recordId === id && (!kind || item.kind === kind))!
    // Scope 1 records appear only as their category 3A line (I-12u); each electricity record gives its 3C, 3C upstream and 3B lines (D3).
    expect(result.records.filter(item => item.recordId === gas.id).map(item => [item.kind, item.category, item.outcome])).toEqual([["fuel_upstream", 3, "calculated"]])
    expect(result.records.filter(item => item.recordId === powerOffice.id).map(item => item.kind)).toEqual(["td_losses", "td_losses_upstream", "electricity_upstream"])
    const loss = row(powerOffice.id, "td_losses")
    expect([loss.outcome, loss.category, loss.result?.status]).toEqual(["calculated", 3, "complete"])
    const heldLoss = result.records.find(item => item.kind === "td_losses" && item.sourceId === "M-2")!
    expect([heldLoss.outcome, heldLoss.plan.status, heldLoss.plan.reasons]).toEqual(["held", "excluded", ["electricity_record_held", "location_excluded_by_company_setup"]])
    expect(result.gridLosses).toEqual({ included: true, electricityRecords: 2 })
    for (const calculated of [freight, asphalt, flights, commute]) expect(row(calculated.id).outcome).toBe("calculated")
    expect([row(unknownWaste.id).outcome, row(unknownWaste.id).plan.reasons]).toEqual(["held", ["material_not_an_engine_token"]])
    // Round 2 (owner decision 10): the withdrawn trip is counted in its category, never listed as a line.
    expect(result.records.some(item => item.recordId === cancelled.id)).toBe(false)
    expect(result.coverage.categories[5]!.counts.withdrawn).toBe(1)
    // Coverage: all 15 categories, each with one status, never a zero for unknown (S3-06).
    const cat = (n: number) => result.coverage.categories[n - 1]!
    expect(result.coverage.categories).toHaveLength(15)
    expect(cat(1)).toMatchObject({ status: "excluded", subtotal: null })
    // I-03: category 2 is calculated by the engine now; with no screening decision and no records it is not screened.
    // I-04: `not_yet_supported` retired (audit D12); support comes from the method catalog.
    expect(cat(2)).toMatchObject({ status: "not_screened", support: "engine", subtotal: null })
    expect(cat(3)).toMatchObject({ status: "partial_boundary" })
    expect(cat(4).status).toBe("calculated")
    expect(cat(5)).toMatchObject({ status: "input_needed", subtotalBasis: "known_sources_only" })
    expect(cat(6)).toMatchObject({ status: "calculated", counts: { records: 2, calculated: 1, withdrawn: 1 } })
    expect(cat(7).quality.estimated).toBe(1)
    expect(cat(9)).toMatchObject({ status: "not_relevant", subtotal: null })
    expect(cat(12)).toMatchObject({ status: "excluded", subtotal: null })
    for (const n of [8, 10, 11, 13, 14, 15]) expect([n, cat(n).subtotal]).toEqual([n, null])
    // CARB's proposed five (S3-07): category 1 is excluded, so the line is incomplete and names it.
    expect(result.coverage.proposedMandatory.complete).toBe(false)
    expect(result.coverage.proposedMandatory.line).toContain("category 1")
    // Disclosures (S3-04, S3-05, S3-13): partial 3C, AR4 waste and mixed GWP sets, radiative forcing.
    const codes = result.coverage.disclosures.map(item => item.code)
    // I-12u: the 3C line is closed by its upstream line, so its "upstream excluded" note gives way to the closure; 3B and 3C upstream
    // (NETL, as published) are partial for coal, oil and other fossil fuels; the GWP mix now includes a published set.
    for (const code of ["combustion_line_closed_by_upstream_line", "fossil_fuel_upstream_not_mapped", "ar4_gwp_embedded_in_factor", "mixed_gwp_sets_including_reported", "radiative_forcing_not_included", "estimated_activity_data"]) expect(codes).toContain(code)
    expect(codes).not.toContain("combustion_only_upstream_of_lost_energy_excluded")
    expect(result.coverage.addedToScope1And2).toBe(false)
    // Every Scope 3 method shown is unreleased beta (S3-11).
    expect(result.methods.length).toBeGreaterThan(0)
    expect(result.methods.every(item => item.scope === 3 && item.releaseStatus === "unreleased_beta" && item.engineSha256 === REVIEWED_SCOPE3_ENGINE_SHA256)).toBe(true)
  }, TIMEOUT)

  test("S3-01 and S3-14: every result equals a direct engine call on the adapter input; the total is the engine's own sum", async () => {
    const result = await build([powerOffice, ...scope3Records])
    let calculated = 0
    for (const row of result.records.filter(item => item.outcome === "calculated")) {
      const source = [powerOffice, ...scope3Records].find(item => item.id === row.recordId)!
      const single = await direct.calculate(planOf(source, row.kind).call!.request as never)
      expect(row.result).toEqual(single)
      calculated++
    }
    expect(calculated).toBe(7)  // four records, and the electricity record's 3C, 3C upstream and 3B lines (I-12u)
    const totals = result.records.filter(item => item.result?.total).map(item => item.result!.total!.unrounded)
    const aggregate = await engine.aggregate(result.records.filter(item => item.result).map(item => item.result!))
    expect(result.coverage.knownSourceSubtotal).toEqual(aggregate.knownSourceSubtotal)
    expect(totals).toHaveLength(7)
  }, TIMEOUT)

  test("S3-03: 3C follows its electricity record, and only when category 3 is screened as included (D3)", async () => {
    const small = await build([power("100000")]), large = await build([power("200000")])
    const loss = (result: Awaited<ReturnType<typeof build>>) => result.records.find(item => item.kind === "td_losses")!.result!.total!.unrounded
    expect(Number(loss(large))).toBeCloseTo(Number(loss(small)) * 2, 6)
    for (const screen of [{ 3: "no" as const }, { 3: "not_applicable" as const }, { 3: "unknown" as const }, {}]) {
      const result = await build([powerOffice], screen)
      expect(result.records.filter(item => item.kind === "td_losses")).toEqual([])
      expect(result.gridLosses.included).toBe(false)
      expect(result.coverage.categories[2]!.subtotal).toBeNull()
    }
    // A held electricity record holds its 3C line with the same reasons.
    const blank = record({ kind: "electricity", sourceId: "M-3", quantity: q("", "kWh"), payload: { meterOrAccountNumber: "M-3", utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } })
    const held = (await build([blank])).records.find(item => item.kind === "td_losses")!
    expect([held.outcome, held.plan.reasons]).toEqual(["held", ["electricity_record_held", "quantity_not_calculable"]])
  }, TIMEOUT)

  test("S3-08: records outside the setup reporting period are held with no figure", async () => {
    const half = { start: "2025-01-01", endExclusive: "2025-07-01" }
    const autumn = record({ kind: "employee_commuting", sourceId: "C-9", period: { start: "2025-09-01", endExclusive: "2025-10-01" }, quantity: q("100", "passenger-mile"), payload: { mode: "bus" } })
    const spanning = record({ kind: "employee_commuting", sourceId: "C-8", period: { start: "2025-06-01", endExclusive: "2025-08-01" }, quantity: q("100", "passenger-mile"), payload: { mode: "bus" } })
    const february = record({ kind: "employee_commuting", sourceId: "C-7", period: { start: "2025-02-01", endExclusive: "2025-03-01" }, quantity: q("100", "passenger-mile"), payload: { mode: "bus" } })
    // commute covers the whole of 2025, so against a half-year period it is partly outside, and held too.
    const result = await build([autumn, spanning, commute, february], included, half)
    const row = (id: string) => result.records.find(item => item.recordId === id)!
    expect([row(autumn.id).outcome, row(autumn.id).result, row(autumn.id).periodCheck]).toEqual(["outside_period", null, "outside"])
    expect([row(spanning.id).outcome, row(spanning.id).periodCheck]).toEqual(["outside_period", "partial"])
    expect([row(commute.id).outcome, row(commute.id).periodCheck]).toEqual(["outside_period", "partial"])
    expect([row(february.id).outcome, row(february.id).periodCheck]).toEqual(["calculated", "inside"])
    expect(result.coverage.categories[6]!).toMatchObject({ status: "calculated", counts: { records: 4, outsidePeriod: 3, calculated: 1 } })
  }, TIMEOUT)

  test("S3-10: each linked file's quarantine state is reported as it is (only clean is cleared); it never changes a figure", async () => {
    const file = (id: string, quarantineStatus: CollectionEvidenceMetadata["quarantineStatus"]): CollectionEvidenceMetadata => ({ id, companyId: company, bucket: "neuvetra-private-company-evidence", objectKey: `${company}/original/${id}`,
      originalName: `${quarantineStatus}.pdf`, mediaType: "application/pdf", byteLength: 100, sha256: quarantineStatus[0]!.repeat(64).slice(0, 64).replace(/[^0-9a-f]/g, "a"), quarantineStatus, uploadedBy: owner, createdAt: "2025-06-01T00:00:00.000Z" })
    const pending = "93000000-0000-4000-8000-0000000000e1", clean = "93000000-0000-4000-8000-0000000000e2", missing = "93000000-0000-4000-8000-0000000000e3"
    const linked = record({ kind: "waste", sourceId: "W-EVIDENCE", evidenceIds: [pending, clean, missing], quantity: q("17.125", "metric_ton"), payload: { category: 5, material: "asphalt_concrete", treatment: "recycled" } })
    const result = await buildScope3Results({ companyId: company, context, records: [linked], evidence: [file(pending, "pending"), file(clean, "clean")], setup: setupView(included), engine, now: () => new Date("2026-10-26T00:00:00Z") })
    const row = result.records[0]!
    expect(row.evidence.map(item => [item.id, item.status])).toEqual([[pending, "pending"], [clean, "clean"], [missing, "missing"]])
    expect([row.outcome, row.result?.total?.display]).toEqual(["calculated", "66.4575"])
  }, TIMEOUT)

  test("S3-02: Scope 3 records never change the Scope 1 and 2 results, counts or subtotals", async () => {
    const now = () => new Date("2026-10-26T00:00:00Z")
    const base = { companyId: company, context, evidence, setup: setupView(included), engines: scope12, now }
    const without = await buildCollectionResults({ ...base, records: [gas, powerOffice] })
    const withScope3 = await buildCollectionResults({ ...base, records: [gas, powerOffice, ...scope3Records] })
    expect(JSON.stringify(withScope3)).toBe(JSON.stringify(without))
  }, TIMEOUT)

  test("the route: authentication, tenant scope (S3-09), the synthetic-only guard and a refused verification", async () => {
    const database = (records: CollectionActivityRecord[], member = true): Scope3ResultsDatabase => ({
      findCollectionContext: async (_user, id) => member && id === company ? context : null,
      findCollectionActivities: async () => records, findCollectionEvidence: async () => [], findCompanySetup: async () => setupView(included), findCurrentMethodReleases: async () => [],
    })
    const routes = (db: Scope3ResultsDatabase, use = engine) => createScope3ResultsRoutes({ database: db, engine: use, origin: "https://staging.example.test", environment: "synthetic_staging", validateUser: async token => token === "ok" ? { id: owner, email: null, phone: null, fullName: null } : null })
    const get = (route: ReturnType<typeof routes>, id = company, token = "ok") => route(new Request(`https://api.example.test/workspace/${id}/results/scope3`, { headers: { authorization: `Bearer ${token}` } }))
    expect((await get(routes(database([asphalt])), company, "bad")).status).toBe(401)
    expect((await get(routes(database([asphalt], false)))).status).toBe(404)
    expect((await get(routes(database([asphalt])), "93000000-0000-4000-8000-0000000000ff")).status).toBe(404)
    const ok = await get(routes(database([asphalt])))
    expect(ok.status).toBe(200)
    expect((await ok.json()).coverage.categories[4].status).toBe("calculated")
    // A record of another company in the list is refused, never shown.
    const stranger = { ...asphalt, companyId: "93000000-0000-4000-8000-0000000000ee" }
    expect((await get(routes(database([stranger])))).status).toBe(404)
    expect(() => createScope3ResultsRoutes({ database: database([]), engine, origin: "x", environment: "production" as never, validateUser: async () => null })).toThrow("synthetic staging")
    // An engine whose aggregate doesn't verify yields no Scope 3 figure at all.
    const lying: Scope3ResultsEngine = { calculateMany: requests => engine.calculateMany(requests), describe: () => engine.describe(), aggregate: async (results, notes) => ({ ...(await engine.aggregate(results, notes)), knownSourceSubtotal: { unrounded: "1", display: "1.0000", unit: "kg CO2e", rounding: "half_even_4dp_once" } }) }
    const refused = await get(routes(database([asphalt]), lying))
    expect(refused.status).toBe(503)
    expect(await refused.json()).toEqual({ error: "Scope 3 results could not be prepared or verified. Try again shortly." })
  }, TIMEOUT)
})

// Scope 3 completion I-01 (DESIGN 4.2, 5.2; audit D3): one batch per run, per-line failures, the Scope 3 line limit and
// the aggregate annotations taken from each record's payload.
const clone = (source: CollectionActivityRecord, i: number): CollectionActivityRecord => {
  const id = `95000000-0000-4000-8000-${String(i).padStart(12, "0")}`, versionId = `96000000-0000-4000-8000-${String(i).padStart(12, "0")}`
  // A copy down to the activity, so a test that edits a clone's payload never changes the shared record. BF-01: each copy has
  // its own source ID, so the copies are different bills, not possible duplicates of each other.
  return { ...source, id, currentVersion: { ...source.currentVersion, id: versionId, recordId: id, activity: { ...source.currentVersion.activity, sourceId: `${source.currentVersion.activity.sourceId}-${i}` } } }
}
/** Wraps the real engine and records how it is called. */
function spy(changeItems?: (items: Awaited<ReturnType<Scope3ResultsEngine["calculateMany"]>>) => Awaited<ReturnType<Scope3ResultsEngine["calculateMany"]>>) {
  const calls = { batches: [] as number[], annotations: [] as unknown[] }
  const wrapped: Scope3ResultsEngine & { calculate?: never } = {
    calculateMany: async requests => { calls.batches.push(requests.length); const items = await engine.calculateMany(requests); return changeItems ? changeItems(items) : items },
    aggregate: (results, notes) => { calls.annotations.push(notes); return engine.aggregate(results, notes) },
    describe: () => engine.describe(),
  }
  return { wrapped, calls }
}
describe("Scope 3 results through the batch engine path (I-01)", () => {
  test("every calculable line goes to the engine in one batch, and the response is what the per-record path gave", async () => {
    const { wrapped, calls } = spy()
    const result = await build([gas, powerOffice, powerWarehouse, ...scope3Records], included, year, wrapped)
    expect(calls.batches).toEqual([8])  // I-12u: + the 3C upstream, 3B and 3A lines
    const reference = await build([gas, powerOffice, powerWarehouse, ...scope3Records])
    expect(JSON.stringify(result)).toBe(JSON.stringify(reference))
    for (const row of result.records.filter(item => item.outcome === "calculated")) {
      const source = [gas, powerOffice, ...scope3Records].find(item => item.id === row.recordId)!
      expect(row.result).toEqual(await direct.calculate(planOf(source, row.kind).call!.request as never))
    }
  }, TIMEOUT)

  test("a refused or unanswered item marks only its own line unavailable; a failed batch leaves every line unavailable", async () => {
    const records = [powerOffice, freight, asphalt, flights, commute]
    const refusedOne = spy(items => items.map((item, i) => i === 1 ? { status: "refused", code: "invalid_quantity" } : item))
    const result = await build(records, included, year, refusedOne.wrapped)
    const outcomes = result.records.map(row => [row.kind, row.outcome, row.refusalCode])
    expect(outcomes.filter(o => o[1] === "unavailable")).toEqual([["employee_commuting", "unavailable", "invalid_quantity"]])
    expect(outcomes.filter(o => o[1] === "calculated")).toHaveLength(6)  // I-12u: + 3C upstream and 3B
    expect(result.coverage.categories[6]!.status).toBe("unavailable")
    expect(result.coverage.categories[5]!.status).toBe("calculated")
    expect(result.warnings).toEqual(["The Scope 3 engine could not calculate at least one record. Try again shortly."])
    const missing = spy(items => items.map((item, i) => i === 0 ? { status: "unavailable", code: null } : item))
    expect((await build(records, included, year, missing.wrapped)).records.filter(row => row.outcome === "unavailable").map(row => [row.kind, row.refusalCode])).toEqual([["business_travel", null]])
    const down: Scope3ResultsEngine = { calculateMany: async () => { throw new Error("Scope 3 engine unavailable.") }, aggregate: (r, n) => engine.aggregate(r, n), describe: () => engine.describe() }
    const failed = await build(records, included, year, down)
    expect(failed.records.map(row => row.outcome)).toEqual(Array(7).fill("unavailable"))
    expect(failed.coverage.knownSourceSubtotal).toBeNull()
  }, TIMEOUT)

  test("each calculated line's payload dataQuality goes to the aggregate as its annotation; payloads without one give nulls", async () => {
    const dataQuality = { indicators: { technological: "poor", temporal: null, geographical: "good", completeness: null, reliability: "fair" }, activityDataOrigin: "value_chain_partner", basis: "Supplier survey" }
    const noted = clone(commute, 1)
    ;(noted.currentVersion.activity as { payload: Record<string, unknown> }).payload = { ...(commute.currentVersion.activity as { payload: Record<string, unknown> }).payload, dataQuality }
    const { wrapped, calls } = spy()
    const result = await build([powerOffice, freight, noted], included, year, wrapped)
    const order = result.records.filter(row => row.outcome === "calculated").map(row => row.kind)
    expect(order).toEqual(["employee_commuting", "transport", "td_losses", "td_losses_upstream", "electricity_upstream"])
    expect(calls.annotations).toEqual([[
      { dataQuality: { technological: "poor", temporal: null, geographical: "good", completeness: null, reliability: "fair" }, activityDataOrigin: "value_chain_partner" },
      { dataQuality: null, activityDataOrigin: null }, { dataQuality: null, activityDataOrigin: null }, { dataQuality: null, activityDataOrigin: null }, { dataQuality: null, activityDataOrigin: null }]])
    expect(scope3AnnotationOf({ mode: "bus" })).toEqual({ dataQuality: null, activityDataOrigin: null })
    expect(scope3AnnotationOf({ dataQuality: null })).toEqual({ dataQuality: null, activityDataOrigin: null })
    expect(scope3AnnotationOf({ dataQuality: { indicators: null, activityDataOrigin: "estimate", basis: null } })).toEqual({ dataQuality: null, activityDataOrigin: "estimate" })
    // A malformed annotation is refused (by the boundary, and by the engine), so no Scope 3 figure is shown at all.
    ;(noted.currentVersion.activity as { payload: Record<string, unknown> }).payload = { mode: "bus", dataQuality: { indicators: { technological: "excellent" }, activityDataOrigin: null } }
    await expect(build([noted], included, year, wrapped)).rejects.toThrow("Scope 3 engine output refused")
  }, TIMEOUT)

  // Wave-1 integration (I-01 batch route x I-02 kinds): a held record of a 0030 kind is planned, never sent to the engine,
  // and counted in its own category; the calculable lines still go in one batch with exactly the results they had alone.
  test("every 0030 kind has its method: none is held method_not_built_yet; the other lines are unchanged and every line is counted", async () => {
    // I-03: spend lines and supplier figures have their method (their route tests are in scope3-results-purchases.test.ts).
    // I-05: so do energy resold, average commuting, teleworking, asset energy and partner figures, and buildings by floor
    // area wait for their factor source (method_pending; route tests in scope3-results-energy-partner.test.ts).
    // I-07: so do the category 11, 12 and 15 kinds (route tests in scope3-results-downstream.test.ts): nothing is left unbuilt.
    const i07 = ["sold_fuel", "sold_energy_product", "sold_ghg_product", "end_of_life_split", "investment"] as const
    expect(SCOPE3_COMPLETION_KINDS.filter(kind => !["purchase_spend", "purchase_supplier", "energy_resold", "commuting_average", "teleworking", "asset_energy", "partner_reported", "building_average", ...i07].includes(kind))).toEqual([])
    const newKinds = i07.map((kind, i) => {
      const fixture = SCOPE3_PAYLOAD_FIXTURES.find(item => item.kind === kind && item.valid)!
      return record({ kind, sourceId: `NEW-${i + 1}`, quantity: fixture.quantity, payload: fixture.payload })
    })
    const { wrapped, calls } = spy()
    const result = await build([powerOffice, freight, asphalt, ...newKinds], { ...included, 11: "yes", 12: "yes", 15: "yes" }, year, wrapped)
    // One batch: the five existing lines (I-12u: with 3C upstream and 3B) and the five new ones, each calculated with its own method.
    expect(calls.batches).toEqual([10])
    expect(result.records.filter(row => (i07 as readonly string[]).includes(row.kind)).map(row => `${row.kind} ${row.category} ${row.outcome} ${row.result?.status}`).sort())
      .toEqual(["end_of_life_split 12 calculated complete", "investment 15 calculated complete", "sold_energy_product 11 calculated complete", "sold_fuel 11 calculated complete", "sold_ghg_product 11 calculated complete"])
    expect(result.records.flatMap(row => row.plan.reasons)).not.toContain("method_not_built_yet")
    expect([11, 12, 15].map(category => result.coverage.categories[category - 1]!.status)).toEqual(["calculated", "calculated", "calculated"])
    // I-02b: the row type carries categories 1-15; the amended kinds' widened categories reach the rows as saved.
    const categories: Array<Scope3ResultRow["category"]> = result.records.map(row => row.category)
    expect(categories.every(category => category >= 1 && category <= 15)).toBe(true)
    const widened = (category: number, kind: "purchase_spend" | "asset_energy" | "partner_reported") => {
      const fixture = SCOPE3_PAYLOAD_FIXTURES.find(item => item.kind === kind && item.valid && (item.payload as { category: number }).category === category)!
      return record({ kind, sourceId: `WIDE-${kind}-${category}`, quantity: fixture.quantity, payload: fixture.payload })
    }
    const wide = await build([widened(5, "purchase_spend"), widened(3, "purchase_spend"), widened(9, "asset_energy"), widened(12, "partner_reported")], included, year)
    // I-05: asset energy (category 9) and partner figures (category 12) are calculated now.
    expect(wide.records.map(row => `${row.kind} ${row.category} ${row.outcome}`).sort()).toEqual(["asset_energy 9 calculated", "partner_reported 12 calculated", "purchase_spend 3 held", "purchase_spend 5 held"])
    // I-03: the two spend lines are held by their own §5.1 rules (fallback overlap not confirmed; the category 3 proxy not enabled).
    expect(wide.records.filter(row => row.kind === "purchase_spend").map(row => row.plan.reasons).sort()).toEqual([["spend_overlap_not_confirmed"], ["spend_proxy_for_category_3_not_enabled", "spend_overlap_not_confirmed"]])
    for (const row of result.records) expect(SCOPE3_KIND_CATEGORIES[row.kind as keyof typeof SCOPE3_KIND_CATEGORIES]).toContain(row.category)
    const reference = await build([powerOffice, freight, asphalt])
    const calculated = (response: typeof result) => response.records.filter(row => row.outcome === "calculated" && !(i07 as readonly string[]).includes(row.kind))
    expect(calculated(result)).toEqual(calculated(reference))
    expect([3, 4, 5].map(category => result.coverage.categories[category - 1]!.subtotal)).toEqual([3, 4, 5].map(category => reference.coverage.categories[category - 1]!.subtotal))
  }, TIMEOUT)

  test("the limit counts Scope 3 lines (records plus 3C lines), not Scope 1 and 2 records", async () => {
    expect([MAX_SCOPE3_LINES, MAX_COMPANY_RECORDS]).toEqual([3000, 20000])
    // 401 Scope 1 records were over the old 400-record limit; they are not Scope 3 lines. I-12u: with category 3 included each
    // gives its 3A line, which is a Scope 3 line.
    const many = Array.from({ length: 401 }, (_, i) => clone(gas, 10_000 + i))
    expect((await build([...many, asphalt], { ...included, 3: "no" })).records).toHaveLength(1)
    expect((await build([...many, asphalt])).records.map(row => row.kind).filter(kind => kind === "fuel_upstream")).toHaveLength(401)
    // 2,999 Scope 3 records and two electricity records: 3,001 lines when category 3 is included, 2,999 when it is not.
    const lines = Array.from({ length: 2999 }, (_, i) => clone(asphalt, 20_000 + i))
    const power2 = [clone(powerOffice, 1), clone(powerOffice, 2)]
    await expect(build([...lines, ...power2])).rejects.toMatchObject({ code: "54000" })
    const started = performance.now()
    const ok = await build([...lines, ...power2], { ...included, 3: "no" })
    console.info(`Scope 3 results: ${ok.records.length} lines built and verified in ${Math.round(performance.now() - started)} ms`)
    expect([ok.records.length, ok.coverage.categories[4]!.counts.calculated]).toEqual([2999, 2999])
    const database = (records: CollectionActivityRecord[]): Scope3ResultsDatabase => ({
      findCollectionContext: async () => context, findCollectionActivities: async () => records, findCollectionEvidence: async () => [], findCompanySetup: async () => setupView(included), findCurrentMethodReleases: async () => [],
    })
    const get = (records: CollectionActivityRecord[]) => createScope3ResultsRoutes({ database: database(records), engine, origin: "https://staging.example.test", environment: "synthetic_staging", validateUser: async () => ({ id: owner, email: null, phone: null, fullName: null }) })(new Request(`https://api.example.test/workspace/${company}/results/scope3`, { headers: { authorization: "Bearer ok" } }))
    const over = await get([...lines, ...power2])
    // Round 2 (owner decision 10): only active lines count; the refusal says how to recover.
    expect([over.status, await over.json()]).toEqual([422, { code: "line_budget_exceeded", error: "More than 3,000 active Scope 3 lines. Withdraw lines you no longer need (withdrawn lines don’t count) to calculate again." }])
    expect((await get(Array(MAX_COMPANY_RECORDS + 1).fill(gas))).status).toBe(422)
  }, TIMEOUT)

  test("BF-21: from schema 32 the limit counts stored Scope 3 records only (0032's count); below 32 every listed line, as before", async () => {
    expect([scope3LineCountRule(28), scope3LineCountRule(31), scope3LineCountRule(32), MAX_SCOPE3_RUN_LINES]).toEqual(["listed", "listed", "stored", 4200])
    // 2,999 stored Scope 3 records and two electricity records: 3,005 listed lines with category 3 included.
    const lines = Array.from({ length: 2999 }, (_, i) => clone(asphalt, 30_000 + i))
    const power2 = [clone(powerOffice, 1), clone(powerOffice, 2)]
    const stored = (records: CollectionActivityRecord[], screen = included) => buildScope3Results({ companyId: company, context, records, evidence, setup: setupView(screen), engine, now: () => new Date("2026-10-26T00:00:00Z"), lineCountRule: "stored" })
    await expect(build([...lines, ...power2])).rejects.toMatchObject({ code: "54000", lineBudget: { rule: "listed", used: 3005 } })
    const ok = await stored([...lines, ...power2])
    // The budget is true under 0032's count and keeps the shape the web decoder and the frozen v3 validator check: 3,000
    // stored lines plus the 6 lines derived from the two Scope 2 records may be listed; 1 stored line is still free.
    expect([ok.records.length, ok.lineBudget]).toEqual([3005, { max: 3006, used: 3005, remaining: 1 }])
    expect(ok.records.every(row => row.outcome === "calculated")).toBe(true)
    // Not one figure changes with the rule: the same records under 3,000 listed lines give the same document but the budget.
    const few = [...lines.slice(0, 10), ...power2]
    const [a, b] = [await build(few), await stored(few)]
    expect({ ...b, lineBudget: null, generatedAt: null }).toEqual({ ...a, lineBudget: null, generatedAt: null })
    expect([a.lineBudget, b.lineBudget]).toEqual([{ max: 3000, used: 16, remaining: 2984 }, { max: 3006, used: 16, remaining: 2990 }])
    // Category 3 excluded: no derived lines, the two budgets agree exactly.
    expect((await stored(few, { ...included, 3: "no" })).lineBudget).toEqual((await build(few, { ...included, 3: "no" })).lineBudget)
    // Over 3,000 stored lines: refused under both rules, with the stored count under "stored".
    const over = [...lines, clone(asphalt, 40_000), clone(asphalt, 40_001)]
    await expect(stored(over)).rejects.toMatchObject({ code: "54000", lineBudget: { rule: "stored", max: 3000, used: 3001 } })
    // An energy-resold record counts twice while category 3 is included, once otherwise (0032).
    const resold = record({ kind: "energy_resold", sourceId: "RES-1", quantity: q("10", "MWh"), payload: { gridBasis: "subregion", zip: "94105", subregion: "CAMX", utilityEiaId: null, resoldEnergyNotInScope2: true } })
    expect([scope3StoredLineCount([resold, asphalt, gas, powerOffice], true), scope3StoredLineCount([resold, asphalt, gas, powerOffice], false), scope3StoredLineCount([cancelled], true)]).toEqual([3, 2, 0])
    // More derived lines than 400 active Scope 1 and 2 records can give (data saved before 0031's cap): refused before the engine.
    const legacy = Array.from({ length: 1401 }, (_, i) => clone(powerOffice, 50_000 + i))
    await expect(stored(legacy)).rejects.toMatchObject({ code: "54000", scope12RecordLimit: true })
    // Through the route: at 31 the answer before BF-21; at 32 the run, or the stored count and the ways back.
    const database = (records: CollectionActivityRecord[]): Scope3ResultsDatabase => ({
      findCollectionContext: async () => context, findCollectionActivities: async () => records, findCollectionEvidence: async () => [], findCompanySetup: async () => setupView(included), findCurrentMethodReleases: async () => [],
    })
    const get = (records: CollectionActivityRecord[], schema: number) => createScope3ResultsRoutes({ database: database(records), engine, origin: "https://staging.example.test", environment: "synthetic_staging", schemaVersion: async () => schema, validateUser: async () => ({ id: owner, email: null, phone: null, fullName: null }) })(new Request(`https://api.example.test/workspace/${company}/results/scope3`, { headers: { authorization: "Bearer ok" } }))
    const at31 = await get([...lines, ...power2], 31)
    expect([at31.status, await at31.json()]).toEqual([422, { code: "line_budget_exceeded", error: "More than 3,000 active Scope 3 lines. Withdraw lines you no longer need (withdrawn lines don’t count) to calculate again." }])
    const at32 = await get([...lines, ...power2], 32)
    expect([at32.status, (await at32.json()).lineBudget]).toEqual([200, { max: 3006, used: 3005, remaining: 1 }])
    const over32 = await get(over, 32)
    expect([over32.status, await over32.json()]).toEqual([422, { code: "line_budget_exceeded", lineBudget: { max: 3000, used: 3001 }, error: SCOPE3_CAPACITY_TEXT.storedResultsOverBudget(3000, 3001) }])
    expect(SCOPE3_CAPACITY_TEXT.storedResultsOverBudget(3000, 3001)).toBe("Scope 3 has 3,001 saved lines, more than its limit of 3,000, so it can’t be calculated. Each active Scope 3 record counts once and an energy-resold record twice while category 3 is included in company setup. Withdraw Scope 3 lines you no longer need (withdrawn lines don’t count), or exclude category 3 in company setup, then calculate again.")
    const legacy32 = await get(legacy, 32)
    expect([legacy32.status, (await legacy32.json()).code]).toEqual([422, "record_limit_reached"])
  }, TIMEOUT)
})

describe("API-01: every response is read under its own caller's access", () => {
  test("a member whose access is revoked while waiting gets no data, not another member's queued results", async () => {
    const [a, b, c] = ["93000000-0000-4000-8000-0000000000b1", "93000000-0000-4000-8000-0000000000b2", "93000000-0000-4000-8000-0000000000b3"]
    const gate = (() => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve }); return { promise, release } })()
    const reads: string[] = [], revoked = new Set<string>()
    let gated = false
    // As HostedWorkspaceDatabase.asUser: every actor-scoped read re-checks staging access.
    const scoped = async <T>(user: string, value: T) => { reads.push(user); if (revoked.has(user)) throw new Error("Private staging access required."); return value }
    const database: Scope3ResultsDatabase = {
      findCollectionContext: async (user, id) => id === company && !revoked.has(user) ? context : null,
      findCollectionActivities: async user => { const records = await scoped(user, [asphalt]); if (!gated) { gated = true; await gate.promise } return records },
      findCollectionEvidence: user => scoped(user, []), findCompanySetup: user => scoped(user, setupView(included)), findCurrentMethodReleases: async () => [],
    }
    const routes = createScope3ResultsRoutes({ database, engine, origin: "https://staging.example.test", environment: "synthetic_staging", validateUser: async token => ({ id: token, email: null, phone: null, fullName: null }) })
    const get = (user: string) => routes(new Request(`https://api.example.test/workspace/${company}/results/scope3`, { headers: { authorization: `Bearer ${user}` } }))
    const first = get(a)                                  // A's run pauses at its activity read
    while (reads.length === 0) await Bun.sleep(1)
    const second = get(b)                                 // B waits behind A
    const third = get(c)                                  // C passes the context check, then waits
    await Bun.sleep(20)
    expect(new Set(reads)).toEqual(new Set([a]))          // one run per company at a time: B and C wait
    revoked.add(c)                                        // C loses staging access while waiting
    gate.release()
    const [ra, rb, rc] = await Promise.all([first, second, third])
    expect([ra.status, rb.status, rc.status]).toEqual([200, 200, 503])
    const body = await rc.text()
    expect(body).not.toContain("Synthetic Scope 3 Co")
    expect(JSON.parse(body)).toEqual({ error: "Scope 3 results could not be prepared or verified. Try again shortly." })
    expect(reads.filter(user => user === c).length).toBeGreaterThan(0) // C's own reads ran, and refused it
  }, TIMEOUT)
})

// The Results screen's decoder and Scope 3 CSV are tested on this exact route output (apps/site-web/src/lib/
// scope3-results.test.ts). This test keeps the two bound: if the route's output changes, rebuild the fixture with
// NEUVETRA_UPDATE_SCOPE3_FIXTURE=1 and review the diff.
const FIXTURE = new URL("../../../site-web/src/lib/scope3-results.fixture.json", import.meta.url)
const formula = record({ kind: "transport", sourceId: "=HYPERLINK(\"x\")", quantity: q("640", "short ton-mile"), payload: { category: 9, vehicle: "single_unit_truck", loadBasis: "shared_vehicle", thirdPartyFacilities: "unknown" } })
// I-04: the fixture carries assessments for three categories (fixed ids, so the fixture is deterministic): category 1
// excluded and fully assessed, category 4 included with its activities described, category 12 excluded with only a reason.
const fixtureAssessments = [
  fixtureAssessmentRecord(company, setup, { category: 1, id: "93000000-0000-4000-8000-0000000000c1" }),
  fixtureAssessmentRecord(company, setup, { category: 4, id: "93000000-0000-4000-8000-0000000000c4", reasonCode: null, magnitudeKind: null, magnitudeTCo2e: null, magnitudeBasis: "", activitiesIncluded: "Inbound rail freight to the office.",
    plannedMethodTypes: ["activity_average_data"], revision: 2, previousId: "93000000-0000-4000-8000-0000000000d4", correctionReason: "Rail lane added." }),
  fixtureAssessmentRecord(company, setup, { category: 12, id: "93000000-0000-4000-8000-0000000000cc", criteria: { size: false, influence: false, risk: false, stakeholders: false, outsourcing: false, sectorGuidance: false, other: false, otherText: "" },
    magnitudeKind: null, magnitudeTCo2e: null, magnitudeBasis: "", plannedMethodTypes: [] }),
].map(item => ({ ...item, createdBy: owner })) as unknown as Scope3AssessmentRecord[]
// I-06: category 2 (not screened) carries a spend line in 2024 dollars (deflated; a company-set temporal rating and an
// origin override the spend method type ignores, A19) and an unverified supplier-allocated total (A20, AS-REPORTED), so the
// fixture shows a method mix, the value-chain share, a price conversion and the new mixed-GWP disclosure.
const capitalSpend = record({ kind: "purchase_spend", sourceId: "AP-2025-0042", reference: "Invoice 0042", quantity: q("12500.5", "USD"), payload: { category: 2, naicsCode: "325211", dollarYear: 2024,
  marginChoice: "with_margins", boughtAtFactoryGate: false, capitalFullCost: true, taxTreatment: "excludes_sales_tax", supplierName: "Synthetic Resins Inc", glAccount: "1500", description: "Moulding resin line",
  categoryConfirmed: false, activityOverlap: "unknown", importId: null, importRow: null, mappingSource: "user", paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null,
  duplicateConfirmedDistinct: false, dataQuality: { indicators: { technological: null, temporal: "very_good", geographical: null, completeness: null, reliability: null }, activityDataOrigin: "value_chain_partner", basis: "Invoice-level spend." } } })
const capitalSupplier = record({ kind: "purchase_supplier", sourceId: "SUP-7", reference: "Supplier statement 2025", quantity: q("145000", "kg CO2e"), payload: { category: 2, supplierName: "Synthetic Tooling Co",
  product: "Press tooling", basis: "allocated_total", factorValue: null, factorUnit: null, allocationBasis: "revenue", allocationNumerator: "2500000", allocationDenominator: "100000000", boundary: "cradle_to_gate",
  gwpBasis: "AR5", verification: "unverified", dataYear: 2024, factorOrigin: "supplier_primary", hybridUpstreamCoveredBy: null, supersedesSpend: null } })
export const FIXTURE_RECORDS = [gas, powerOffice, powerWarehouse, ...scope3Records, formula, capitalSpend, capitalSupplier]
describe("the web fixture is this route's output", () => {
  test("the Results screen's Scope 3 fixture equals buildScope3Results on the S3-01 records", async () => {
    const built = await build(FIXTURE_RECORDS, { ...included, 9: "yes" }, year, engine, fixtureAssessments)
    const text = `${JSON.stringify(built, null, 2)}\n`
    if (process.env.NEUVETRA_UPDATE_SCOPE3_FIXTURE === "1") await Bun.write(FIXTURE, text)
    expect(await Bun.file(FIXTURE).text()).toBe(text)
  }, TIMEOUT)
})

// Scope 3 completion I-04 (DESIGN 5.2, 3.4, 3.5): assessments are read for the setup's reporting year, only at schema 30
// or above; method-pending holds keep their optional flag; the assessment disclosures reach the response.
describe("I-04: assessments and method-pending lines in Scope 3 results", () => {
  const routeWith = (schemaVersion: (() => Promise<number>) | undefined, period = year) => {
    const calls: Array<[string, string, number]> = []
    const database: Scope3ResultsDatabase = {
      findCollectionContext: async () => context, findCollectionActivities: async () => [asphalt], findCollectionEvidence: async () => [], findCompanySetup: async () => setupView(included, period), findCurrentMethodReleases: async () => [],
      findScope3Assessments: async (user, id, reportingYear) => { calls.push([user, id, reportingYear]); return fixtureAssessments.map(item => ({ ...item, reportingYear })) },
    }
    const route = createScope3ResultsRoutes({ database, engine, origin: "https://staging.example.test", environment: "synthetic_staging", validateUser: async () => ({ id: owner, email: null, phone: null, fullName: null }), ...(schemaVersion ? { schemaVersion } : {}) })
    const get = async () => { const response = await route(new Request(`https://api.example.test/workspace/${company}/results/scope3`, { headers: { authorization: "Bearer ok" } })); expect(response.status).toBe(200); return response.json() as Promise<any> }
    return { calls, get }
  }

  test("assessments are read only at schema 30 or above, for the year the setup's reporting period ends", async () => {
    for (const [label, version] of [["no schema reader", undefined], ["schema 28", async () => 28], ["schema 29", async () => 29]] as const) {
      const { calls, get } = routeWith(version)
      const body = await get()
      expect([label, calls]).toEqual([label, []])
      expect(body.coverage.categories.every((row: any) => row.assessment === null)).toBe(true)
      expect(body.coverage.disclosures.map((d: any) => d.code)).not.toContain("exclusion_without_reason_code")
    }
    const at30 = routeWith(async () => 30)
    const body = await at30.get()
    expect(at30.calls).toEqual([[owner, company, 2025]])
    expect(body.coverage.categories[0].assessment).toMatchObject({ id: "93000000-0000-4000-8000-0000000000c1", category: 1, reportingYear: 2025 })
    expect(body.coverage.categories[11].disclosures).toEqual(expect.arrayContaining(["exclusion_without_magnitude", "exclusion_without_relevance_criteria"]))
    expect(body.coverage.categories[4].disclosures).toContain("included_activities_not_described")
    expect(body.coverage.categories[3].disclosures).not.toContain("included_activities_not_described")
    // A fiscal year ending 30 June 2026 is reporting year 2026.
    const fy = routeWith(async () => 30, { start: "2025-07-01", endExclusive: "2026-07-01" })
    await fy.get()
    expect(fy.calls).toEqual([[owner, company, 2026]])
  }, TIMEOUT)

  test("a method-pending hold keeps whether it is optional in the row plan and the coverage outcome; other holds carry no flag", () => {
    const plan = (status: "input_needed" | "method_pending" | "withdrawn", optional?: true) => ({ action: "hold" as const, status, reasons: ["factor_source_not_yet_loaded"], notes: [], ...(optional ? { optional } : {}) })
    expect(scope3HeldOutcome(plan("method_pending", true))).toEqual({ outcome: "held", status: "method_pending", reasons: ["factor_source_not_yet_loaded"], optional: true })
    expect(scope3HeldOutcome(plan("method_pending"))).toEqual({ outcome: "held", status: "method_pending", reasons: ["factor_source_not_yet_loaded"], optional: false })
    expect(scope3HeldOutcome(plan("input_needed"))).toEqual({ outcome: "held", status: "input_needed", reasons: ["factor_source_not_yet_loaded"] })
    expect(scope3HeldOutcome({ status: null, reasons: [] })).toEqual({ outcome: "held", status: "input_needed", reasons: [] })
    const row = (p: ReturnType<typeof plan>) => scope3RowPlan(p as never)
    expect(row(plan("method_pending", true))).toEqual({ action: "hold", status: "method_pending", reasons: ["factor_source_not_yet_loaded"], notes: [], optional: true })
    expect("optional" in row(plan("method_pending"))).toBe(false)
    expect("optional" in row(plan("input_needed", true))).toBe(false)
  })
})

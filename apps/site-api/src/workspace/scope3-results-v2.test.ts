// Scope 3 completion I-06 (DESIGN 4.2, 5.2, 6): the results route's v2 fields through the real engine and the trusted
// boundary (line trace, effective data quality, method formulas, registers, profiles and methodology on categories), and
// the one 25-second budget for a run: each engine call gets what is left of it, and a run past it answers with its lines
// unavailable and a warning, never a partial figure.
import { describe, expect, test } from "bun:test"
import { validateCollectionActivity, type CollectionActivityRecord, type CollectionContext, type CompanySetupView } from "@neuvetra/database"
import { createScope3Engine } from "../calculation/scope3-authority"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { SCOPE3_METHODS } from "../../../../packages/neuvetra-database/src/scope3-method-catalog"
import { scope3MethodologyStatement } from "../../../../packages/neuvetra-database/src/scope3-methodology"
import { scope3AnnotationFromPayload, scope3EffectiveDataQuality, scope3ReviewFlags, type Scope3ResultsDocument } from "../../../../packages/neuvetra-database/src/scope3-trace"
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } from "../../../../packages/neuvetra-database/src/method-reference"
import { buildScope3Results, createScope3ResultsRoutes, REVIEWED_SCOPE3_ENGINE_SHA256, SCOPE3_BUDGET_WARNING, SCOPE3_FORMULA_WARNING, SCOPE3_RESULTS_BUDGET_MS, scope3EngineFormulas, type Scope3ResultsDatabase, type Scope3ResultsEngine } from "./scope3-results-routes"

const python = process.env.NEUVETRA_PYTHON ?? "python3"
const engine: Scope3ResultsEngine = createScope3Engine({ python, expectedEngineSha256: REVIEWED_SCOPE3_ENGINE_SHA256 })
const company = "93800000-0000-4000-8000-000000000001", setup = "93800000-0000-4000-8000-000000000002", office = "93800000-0000-4000-8000-000000000003", owner = "93800000-0000-4000-8000-0000000000a1"
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [{ id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] }
const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic", notes: "", evidenceIds: [] as string[], period: year }
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
let n = 0
function record(activity: Record<string, unknown>): CollectionActivityRecord {
  const id = `93800000-0000-4000-8000-${String(1000 + ++n).padStart(12, "0")}`
  const parsed = validateCollectionActivity({ ...common, sourceId: `V2-${n}`, ...activity })
  const version = { id: `94800000-0000-4000-8000-${String(1000 + n).padStart(12, "0")}`, recordId: id, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z" }
  return { id, companyId: company, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined } as never] }
}
function setupView(screen: Partial<Record<number, "yes" | "no" | "not_applicable">>): CompanySetupView {
  const screening = Object.entries(screen).map(([category, state]) => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[Number(category) - 1]!, state, reason: state === "yes" ? "" : "Synthetic screening reason.", details: "", locationId: null }))
  return { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: setup, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
    setup: { company: { legalName: "Synthetic Results v2 Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { start: year.start, endExclusive: year.endExclusive, firstInventory: "yes", priorInventoryReference: "" },
      boundary: { approach: "operational_control", notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }], screening, changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } } as unknown as CompanySetupView
}
const power = record({ kind: "electricity", sourceId: "M-1", reference: "Bill 2025-12", quantity: q("250000", "kWh"), payload: { meterOrAccountNumber: "M-1", utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } })
const freight = record({ kind: "transport", reference: "Waybill 77", quantity: q("1200.5", "short ton-mile"), payload: { category: 4, vehicle: "rail", loadBasis: "shared_vehicle", thirdPartyFacilities: "none",
  dataQuality: { indicators: { technological: "good", temporal: null, geographical: null, completeness: null, reliability: "fair" }, activityDataOrigin: "value_chain_partner", basis: "Carrier ton-mile report." } } })
const buy = record({ kind: "purchase_spend", reference: "Invoice 9", quantity: q("2000", "USD"), payload: { category: 1, naicsCode: "541511", dollarYear: 2024, marginChoice: "with_margins", boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: "excludes_sales_tax",
  supplierName: "Synthetic Software LLC", glAccount: "6100", description: "Software consulting", categoryConfirmed: false, activityOverlap: "unknown", importId: null, importRow: null, mappingSource: "user", paidByReportingCompany: null, spendEstimateBasis: null,
  lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false } })
const records = [power, freight, buy]
const screen = { 1: "yes", 3: "yes", 4: "yes" } as const
const TIMEOUT = 120_000
const build = (extra: Partial<Parameters<typeof buildScope3Results>[0]> = {}) =>
  buildScope3Results({ companyId: company, context, records, evidence: [], setup: setupView(screen), engine, now: () => new Date("2026-10-30T00:00:00Z"), ...extra })
/** The real engine, recording the options each call gets; `during` runs inside calculateMany (to move a test clock). */
function spy(during?: () => void) {
  const calls: Array<{ action: string; options: unknown }> = []
  const wrapped: Scope3ResultsEngine = {
    calculateMany: async (requests, options) => { calls.push({ action: "calculate_many", options }); const items = await engine.calculateMany(requests); during?.(); return items },
    aggregate: (results, notes, options) => { calls.push({ action: "aggregate", options }); return engine.aggregate(results, notes) },
    describe: () => engine.describe(),
  }
  return { wrapped, calls }
}

describe("I-06: the line trace, method facts and category narrative in the response", () => {
  test("each line carries its reference, derivation, payload, method type and effective data quality (A19, A20)", async () => {
    const result = await build()
    const row = (kind: string) => result.records.find(item => item.kind === kind)!
    expect(row("td_losses")).toMatchObject({ recordId: power.id, reference: "Bill 2025-12", derivedFrom: { recordId: power.id, kind: "electricity" }, methodType: "activity_average_data" })
    expect(row("td_losses").payload).toEqual(power.currentVersion.activity.payload)
    expect(row("transport")).toMatchObject({ reference: "Waybill 77", derivedFrom: null, methodType: "activity_average_data" })
    expect(row("transport").payload).toEqual(freight.currentVersion.activity.payload)
    // Activity/average data takes the company's origin and ratings; the rest are the method's defaults.
    expect(row("transport").effectiveDataQuality).toEqual({
      indicators: { technological: { rating: "good", setBy: "user" }, temporal: { rating: "very_good", setBy: "method_default" }, geographical: { rating: "good", setBy: "method_default" }, completeness: { rating: "good", setBy: "method_default" }, reliability: { rating: "fair", setBy: "user" } },
      activityDataOrigin: { origin: "value_chain_partner", setBy: "user" } })
    // A derived 3C line takes no annotation (its payload is the Scope 2 record's).
    expect(row("td_losses").effectiveDataQuality!.activityDataOrigin).toEqual({ origin: "company_records", setBy: "method_default" })
    expect(row("purchase_spend")).toMatchObject({ methodType: "spend_based", effectiveDataQuality: { activityDataOrigin: { origin: "company_records", setBy: "method_type" } } })
    for (const line of result.records) expect(line.effectiveDataQuality).toEqual(line.result ? scope3EffectiveDataQuality(line.result, line.derivedFrom ? { dataQuality: null, activityDataOrigin: null } : scope3AnnotationFromPayload(line.payload)) : null)
    // The profile's value-chain numerator counts the company-declared partner origin of the rail line (it equals the engine's).
    expect(result.coverage.categories[3]!.profile!.valueChain.numerator.display).toBe(row("transport").result!.total!.display)
  }, TIMEOUT)

  test("methods carry the catalog title and type and the engine's own formula; the registers are listed; categories carry profile, flags and methodology", async () => {
    const result: Scope3ResultsDocument = await build()
    const description = await engine.describe()
    for (const method of result.methods) {
      expect(method.title).toBe(SCOPE3_METHODS[method.methodVersionId]!.title)
      expect(method.methodType).toBe(SCOPE3_METHODS[method.methodVersionId]!.methodType)
      expect(method.formula).toBe(description.methods.find(item => item.id === method.methodVersionId)!.formula as string)
    }
    expect(result.registerSha256s).toEqual({ main: SCOPE3_REGISTER_2025_SHA256, spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 })
    for (const row of result.coverage.categories) {
      const { methodology, ...rest } = row
      expect(methodology).toEqual(scope3MethodologyStatement(rest, result.records, result.coverage.categories))
      expect(row.profile === null).toBe(row.subtotal === null)
      // Review flags follow the engine's shares (none before the I-05 engine sends them; DESIGN 4.6).
      expect(row.reviewFlags).toEqual(scope3ReviewFlags(row.profile))
    }
    expect(result.coverage.categories[0]!.methodology.some(sentence => sentence.topic === "price_year")).toBe(true)
    expect(result.warnings).toEqual([])
  }, TIMEOUT)

  test("a formula the engine can't describe is null, with a warning; the description is read once per engine", async () => {
    let described = 0
    const flaky: Scope3ResultsEngine = { calculateMany: (r, o) => engine.calculateMany(r, o), aggregate: (r, a, o) => engine.aggregate(r, a, o), describe: async () => { described++; throw new Error("down") } }
    const result = await build({ engine: flaky })
    expect(result.methods.every(method => method.formula === null)).toBe(true)
    expect(result.warnings).toEqual([SCOPE3_FORMULA_WARNING])
    expect(result.coverage.knownSourceSubtotal).not.toBeNull() // the figures stand; only the formula text is missing
    // A failed description is not cached; a working one is read once.
    await build({ engine: flaky })
    expect(described).toBe(2)
    const counting = { ...engine, describe: async () => { described++; return engine.describe() } } as Scope3ResultsEngine
    await scope3EngineFormulas(counting); await scope3EngineFormulas(counting)
    expect(described).toBe(3)
  }, TIMEOUT)
})

describe("I-06: one 25-second budget per run (DESIGN 4.2)", () => {
  test("each engine call gets what is left of the budget", async () => {
    let now = 1_000_000
    const { wrapped, calls } = spy(() => { now += 4_000 })
    const result = await build({ engine: wrapped, deadline: 1_000_000 + SCOPE3_RESULTS_BUDGET_MS, clock: () => now })
    expect(SCOPE3_RESULTS_BUDGET_MS).toBe(25_000)
    expect(calls).toEqual([{ action: "calculate_many", options: { timeoutMs: 25_000 } }, { action: "aggregate", options: { timeoutMs: 21_000 } }])
    expect(result.coverage.knownSourceSubtotal).not.toBeNull()
    expect(result.warnings).toEqual([])
    // Without a deadline (tests, and callers that set none) no call is limited by the route.
    const unlimited = spy()
    await build({ engine: unlimited.wrapped })
    expect(unlimited.calls.map(call => call.options)).toEqual([undefined, undefined])
  }, TIMEOUT)

  test("a run past its budget before the batch sends nothing: every calculable line unavailable, no figure, a warning", async () => {
    const { wrapped, calls } = spy()
    const result = await build({ engine: wrapped, deadline: 5_000, clock: () => 5_000 })
    expect(calls).toEqual([])
    expect(result.records.filter(row => row.outcome === "unavailable").map(row => row.kind).sort()).toEqual(["electricity_upstream", "purchase_spend", "td_losses", "td_losses_upstream", "transport"])  // I-12u: + 3C upstream and 3B
    expect(result.records.every(row => row.result === null && row.methodType === null && row.effectiveDataQuality === null)).toBe(true)
    expect(result.coverage.knownSourceSubtotal).toBeNull()
    expect(result.coverage.categories.filter(row => row.status === "unavailable").map(row => row.category)).toEqual([1, 3, 4])
    expect(result.warnings).toEqual(["The Scope 3 engine could not calculate at least one record. Try again shortly.", SCOPE3_BUDGET_WARNING])
    expect(result.methods).toEqual([])
  }, TIMEOUT)

  test("a run whose batch uses up the budget never shows a partial figure: the aggregate is not asked, every line is unavailable", async () => {
    let now = 0
    const { wrapped, calls } = spy(() => { now = 30_000 })
    const result = await build({ engine: wrapped, deadline: SCOPE3_RESULTS_BUDGET_MS, clock: () => now })
    expect(calls.map(call => call.action)).toEqual(["calculate_many"])
    expect(result.records.every(row => row.outcome === "unavailable" && row.result === null)).toBe(true)
    expect(result.coverage.knownSourceSubtotal).toBeNull()
    expect(result.coverage.categories.every(row => row.subtotal === null && row.profile === null)).toBe(true)
    expect(result.warnings).toContain(SCOPE3_BUDGET_WARNING)
    expect(result.methods).toEqual([])
  }, TIMEOUT)

  test("the route starts the 25-second budget when the run starts, and a run within it answers 200", async () => {
    const { wrapped, calls } = spy()
    const database: Scope3ResultsDatabase = { findCollectionContext: async () => context, findCollectionActivities: async () => records, findCollectionEvidence: async () => [], findCompanySetup: async () => setupView(screen), findCurrentMethodReleases: async () => [] }
    const route = createScope3ResultsRoutes({ database, engine: wrapped, origin: "https://staging.example.test", environment: "synthetic_staging", validateUser: async () => ({ id: owner, email: null, phone: null, fullName: null }) })
    const started = performance.now()
    const response = await route(new Request(`https://api.example.test/workspace/${company}/results/scope3`, { headers: { authorization: "Bearer ok" } }))
    const elapsed = performance.now() - started
    expect(response.status).toBe(200)
    const [batch, aggregate] = calls.map(call => (call.options as { timeoutMs: number }).timeoutMs)
    expect(batch).toBeGreaterThan(SCOPE3_RESULTS_BUDGET_MS - elapsed - 1)
    expect(batch).toBeLessThanOrEqual(SCOPE3_RESULTS_BUDGET_MS)
    expect(aggregate).toBeLessThanOrEqual(batch!)
    expect(((await response.json()) as Scope3ResultsDocument).coverage.knownSourceSubtotal).not.toBeNull()
  }, TIMEOUT)
})

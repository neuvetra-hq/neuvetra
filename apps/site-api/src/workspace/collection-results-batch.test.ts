// BI-01 (backend audit, 12 November 2026): Scope 1 and 2 results run all of a company's Scope 1 records in one engine
// process and all its Scope 2 records in another (scope12_batch.py), instead of one process per record. These tests pin
// that the answer is the per-record answer exactly, that a failed, refused or timed-out batch never becomes a figure, that
// a run stops when its request goes away, and that a run where no engine could answer is not presented as results.
import { describe, expect, test } from "bun:test"
import { validateCollectionActivity, type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView } from "@neuvetra/database"
import { SCOPE12_BATCH_ENGINE } from "../calculation/method-engine-runner"
import { createScope1Engine } from "../calculation/scope1-authority"
import { createScope2Engine } from "../calculation/scope2-authority"
import { buildCollectionResults, checkResultsEngines, reviewedResultsEngines, COLLECTION_RESULTS_BUDGET_MS, createCollectionResultsRoutes, RESULTS_ENGINE_UNAVAILABLE_TEXT, REVIEWED_SCOPE1_ENGINE_SHA256, REVIEWED_SCOPE12_BATCH_SHA256, REVIEWED_SCOPE2_ENGINE_SHA256, type CollectionResultsDatabase, type CollectionResultsEngines, type CollectionResultsResponse } from "./collection-results-routes"

const python = process.env.NEUVETRA_PYTHON ?? "python3"
const perRecord = { scope1: createScope1Engine({ python, expectedEngineSha256: REVIEWED_SCOPE1_ENGINE_SHA256 }), scope2: createScope2Engine({ python, expectedEngineSha256: REVIEWED_SCOPE2_ENGINE_SHA256 }) }
const batched = {
  scope1: createScope1Engine({ python, expectedEngineSha256: REVIEWED_SCOPE1_ENGINE_SHA256, expectedBatchSha256: REVIEWED_SCOPE12_BATCH_SHA256 }),
  scope2: createScope2Engine({ python, expectedEngineSha256: REVIEWED_SCOPE2_ENGINE_SHA256, expectedBatchSha256: REVIEWED_SCOPE12_BATCH_SHA256 }),
}
const company = "74000000-0000-4000-8000-000000000001", setup = "74000000-0000-4000-8000-000000000002"
const office = "74000000-0000-4000-8000-000000000003", warehouse = "74000000-0000-4000-8000-000000000004", owner = "74000000-0000-4000-8000-0000000000a1"
// The reporting period starts in February, so January activity is outside it (records must stay inside calendar 2025).
const context: CollectionContext = { boundaryApproach: "operational_control", reportingPeriod: { start: "2025-02-01", endExclusive: "2026-01-01" }, companyId: company, setupVersionId: setup, setupRevision: 1, locations: [
  { id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, entity: null, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" },
  { id: warehouse, name: "Warehouse", inclusion: "excluded", control: "landlord" }] }
const setupView = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: setup, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
  setup: { company: { legalName: "Batch Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { start: "2025-02-01", endExclusive: "2026-01-01", firstInventory: "yes", priorInventoryReference: "" },
    boundary: { approach: "operational_control", notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: office, name: "Office", inclusion: "included" }, { id: warehouse, name: "Warehouse", inclusion: "excluded" }], screening: [], changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } } as unknown as CompanySetupView
const year = { start: "2025-02-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic", notes: "", evidenceIds: [] as string[], period: year }
const plain = (value: string) => /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value)
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: plain(value) ? value : null, normalizedUnit: plain(value) ? unit : null })
let n = 0
function record(activity: Record<string, unknown>): CollectionActivityRecord {
  const id = `74000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  let parsed: ReturnType<typeof validateCollectionActivity>
  try { parsed = validateCollectionActivity({ ...common, ...activity }) } catch (error) { throw new Error(`fixture ${activity.sourceId as string}: ${(error as Error).message} ${JSON.stringify((error as { issues?: unknown }).issues ?? "")}`) }
  const version = { id: `75000000-0000-4000-8000-${String(n).padStart(12, "0")}`, recordId: id, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z" }
  return { id, companyId: company, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined } as never] }
}
const file = (id: string, status: CollectionEvidenceMetadata["quarantineStatus"], sha: string): CollectionEvidenceMetadata => ({ id, companyId: company, bucket: "neuvetra-private-company-evidence", objectKey: `${company}/original/${id}`, originalName: `${id}.pdf`, mediaType: "application/pdf", byteLength: 100, sha256: sha.repeat(64), quarantineStatus: status, uploadedBy: owner, createdAt: "2025-06-01T00:00:00.000Z" })
const clean = "74000000-0000-4000-8000-0000000000e1", pending = "74000000-0000-4000-8000-0000000000e2", shared = "74000000-0000-4000-8000-0000000000e3", rejected = "74000000-0000-4000-8000-0000000000e4"
const evidence = [file(clean, "clean", "1"), file(pending, "pending", "2"), file(shared, "clean", "3"), file(rejected, "rejected", "4")]
const vehicle = (fields: Record<string, unknown>) => ({ vehicleGroupId: "VANS", fuel: "diesel", vehicleType: "diesel_light_duty_truck", modelYear: 2021, gallons: "1200", vehicleCount: 4, miles: null, fuelEconomy: null, ...fields })
const terms = (PS: string) => ({ PN: "0", CN: "0", PS, CD: "0", RD: "0" })
const fugitive = (fields: Record<string, unknown>) => ({ gas: "R-410A", unit: "kg", terms: terms("2"), insideBoundary: true, maintainsRefrigerantStock: false, retrofitInPeriod: false, contractorRecordsComplete: true, eventChronologyComplete: true, ...fields })
const meter = (id: string, fields: Record<string, unknown> = {}) => ({ meterOrAccountNumber: id, utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [], ...fields })
const cert = (fields: Record<string, unknown>) => ({ type: "energy_attribute_certificate", mwh: "40", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: clean, generationTechnology: "wind", rateLbPerMwh: null, ...fields })
const months = (m: number) => ({ start: `2025-${String(m).padStart(2, "0")}-01`, endExclusive: m === 12 ? "2026-01-01" : `2025-${String(m + 1).padStart(2, "0")}-01` })

/** Every Scope 1 and 2 record kind, in every plan hold, engine status and outcome the route can give. */
const records = [
  // Natural gas: complete; volume without (engine input needed) and with heat content; blank and unparseable quantities (held).
  record({ kind: "natural_gas", sourceId: "GAS-1", quantity: q("12500", "therm"), payload: { heatContent: null } }),
  record({ kind: "natural_gas", sourceId: "GAS-2", quantity: q("100000", "scf"), payload: { heatContent: null } }),
  record({ kind: "natural_gas", sourceId: "GAS-3", quantity: q("100000", "scf"), payload: { heatContent: { value: "0.001026", unit: "MMBtu per scf" } } }),
  record({ kind: "natural_gas", sourceId: "GAS-4", quantity: q("", "therm"), payload: { heatContent: null } }),
  record({ kind: "natural_gas", sourceId: "GAS-5", quantity: q("1,000", "therm"), payload: { heatContent: null } }),
  record({ kind: "natural_gas", sourceId: "GAS-6", quantity: q("103.7", "MMBtu"), quality: "estimated", estimateBasis: "Meter photo", payload: { heatContent: null } }),
  // Excluded location, outside and partly outside the period, withdrawn.
  record({ kind: "natural_gas", sourceId: "GAS-7", locationId: warehouse, quantity: q("900", "therm"), payload: { heatContent: null } }),
  record({ kind: "natural_gas", sourceId: "GAS-8", quantity: q("900", "therm"), period: { start: "2025-01-01", endExclusive: "2025-02-01" }, payload: { heatContent: null } }),
  record({ kind: "natural_gas", sourceId: "GAS-9", quantity: q("900", "therm"), period: { start: "2025-01-15", endExclusive: "2025-02-15" }, payload: { heatContent: null } }),
  record({ kind: "natural_gas", sourceId: "GAS-1", state: "withdrawn", withdrawalReason: "Entered twice.", quantity: q("12500", "therm"), payload: { heatContent: null } }),
  // Possible duplicates (same kind, source ID, overlapping dates): held or counted by policy.
  record({ kind: "natural_gas", sourceId: "DUP-1", quantity: q("50", "therm"), period: months(3), payload: { heatContent: null } }),
  record({ kind: "natural_gas", sourceId: "DUP-1", quantity: q("50", "therm"), period: months(3), payload: { heatContent: null } }),
  // Distillate: measured with the default HHV, stated HHV, purchases only (engine input needed), zero purchases (review required).
  record({ kind: "distillate_no2", sourceId: "GEN-1", quantity: q("100", "US_gallon"), payload: { consumption: { basis: "measured", gallons: "100" }, statedHhvMmbtuPerGallon: null } }),
  record({ kind: "distillate_no2", sourceId: "GEN-2", quantity: q("100", "US_gallon"), payload: { consumption: { basis: "measured", gallons: "100" }, statedHhvMmbtuPerGallon: "0.137" } }),
  record({ kind: "distillate_no2", sourceId: "GEN-3", quantity: q("", "US_gallon"), payload: { consumption: { basis: "purchases_only", purchasedGallons: "500" }, statedHhvMmbtuPerGallon: null } }),
  record({ kind: "distillate_no2", sourceId: "GEN-4", quantity: q("", "US_gallon"), payload: { consumption: { basis: "purchases_with_tank_levels", purchasedGallons: "0", openingGallons: "10", closingGallons: "20" }, statedHhvMmbtuPerGallon: null } }),
  // Vehicles: diesel without miles (partial: CH4 and N2O missing), with miles, gasoline with fuel economy, a year before the first band (held).
  record({ kind: "vehicle", sourceId: "VANS", quantity: q("1200", "US_gallon"), payload: vehicle({}) }),
  record({ kind: "vehicle", sourceId: "TRUCKS", quantity: q("1200", "US_gallon"), payload: vehicle({ vehicleGroupId: "TRUCKS", miles: { value: "18000", basis: "odometer" } }) }),
  record({ kind: "vehicle", sourceId: "CARS", quantity: q("300", "US_gallon"), payload: vehicle({ vehicleGroupId: "CARS", fuel: "gasoline", vehicleType: "gasoline_passenger_car", modelYear: 2020, gallons: "300", fuelEconomy: { mpg: "30", source: "manufacturer_rating" } }) }),
  record({ kind: "vehicle", sourceId: "OLD", quantity: q("300", "US_gallon"), payload: vehicle({ vehicleGroupId: "OLD", fuel: "gasoline", vehicleType: "gasoline_passenger_car", modelYear: 1961, gallons: "300", miles: { value: "1000", basis: "odometer" } }) }),
  // Fugitive: complete, reported outside the scopes (memo), pounds of HFC-134a, unknown answer, outside the boundary.
  record({ kind: "fugitive", sourceId: "HVAC-1", quantity: q("2", "kg"), payload: fugitive({}) }),
  record({ kind: "fugitive", sourceId: "HVAC-2", quantity: q("2", "kg"), payload: fugitive({ gas: "R-22" }) }),
  record({ kind: "fugitive", sourceId: "HVAC-3", quantity: q("2", "lb"), payload: fugitive({ gas: "HFC-134a", unit: "lb" }) }),
  record({ kind: "fugitive", sourceId: "HVAC-4", quantity: q("2", "kg"), payload: fugitive({ retrofitInPeriod: null }) }),
  record({ kind: "fugitive", sourceId: "HVAC-5", quantity: q("", "kg"), payload: fugitive({ insideBoundary: false, terms: terms("") }) }),
  // Electricity: plain; certificates with clean, pending, shared and rejected files; a supplier rate; bioenergy; unknown MWh;
  // a ZIP outside its stated subregion; a blank quantity (held) and an unknown ZIP; kWh and MWh.
  ...Array.from({ length: 12 }, (_, i) => record({ kind: "electricity", sourceId: "M-1", quantity: q(String(20000 + i), "kWh"), period: months(i + 1), payload: meter("M-1") })),
  record({ kind: "electricity", sourceId: "M-2", quantity: q("250", "MWh"), evidenceIds: [clean], payload: meter("M-2", { instruments: [cert({})] }) }),
  record({ kind: "electricity", sourceId: "M-3", quantity: q("250", "MWh"), evidenceIds: [pending], payload: meter("M-3", { instruments: [cert({ evidenceReference: pending })] }) }),
  record({ kind: "electricity", sourceId: "M-4", quantity: q("250", "MWh"), evidenceIds: [shared], payload: meter("M-4", { instruments: [cert({ evidenceReference: shared })] }) }),
  record({ kind: "electricity", sourceId: "M-5", quantity: q("250", "MWh"), evidenceIds: [shared], payload: meter("M-5", { instruments: [cert({ evidenceReference: shared })] }) }),
  record({ kind: "electricity", sourceId: "M-6", quantity: q("250", "MWh"), evidenceIds: [rejected], payload: meter("M-6", { instruments: [cert({ evidenceReference: rejected })] }) }),
  record({ kind: "electricity", sourceId: "M-7", quantity: q("250", "MWh"), payload: meter("M-7", { instruments: [cert({ type: "supplier_specific_rate", evidenceReference: null, generationTechnology: "natural_gas", rateLbPerMwh: { co2: "800.5", ch4: "0.02", n2o: null } })] }) }),
  record({ kind: "electricity", sourceId: "M-8", quantity: q("250", "MWh"), payload: meter("M-8", { instruments: [cert({ evidenceReference: null, generationTechnology: "biomass" })] }) }),
  record({ kind: "electricity", sourceId: "M-9", quantity: q("250", "MWh"), payload: meter("M-9", { instruments: [cert({ evidenceReference: null, mwh: "" })] }) }),
  record({ kind: "electricity", sourceId: "M-10", quantity: q("250", "MWh"), payload: meter("M-10", { zip: "97201", subregion: "CAMX", utilityEiaId: null }) }),
  record({ kind: "electricity", sourceId: "M-11", quantity: q("", "kWh"), payload: meter("M-11") }),
  record({ kind: "electricity", sourceId: "M-12", quantity: q("250", "MWh"), payload: meter("M-12", { zip: "00000", utilityEiaId: null }) }),
]
// Saved records never reach an engine refusal (validation and the adapter stop them first), so two stored versions are
// altered after validation, as only data edited outside the API could be, to cover the refused outcome in both scopes.
const altered = (base: CollectionActivityRecord, change: (payload: Record<string, unknown>) => void) => { change(base.currentVersion.activity.payload as unknown as Record<string, unknown>); return base }
records.push(
  altered(record({ kind: "natural_gas", sourceId: "GAS-X", quantity: q("100000", "scf"), payload: { heatContent: { value: "0.001026", unit: "MMBtu per scf" } } }), payload => { (payload.heatContent as { unit: string }).unit = "BTU per barrel" }),
  altered(record({ kind: "electricity", sourceId: "M-X", quantity: q("250", "MWh"), payload: meter("M-X", { instruments: [cert({ evidenceReference: null })] }) }), payload => { (payload.instruments as Array<Record<string, unknown>>)[0]!.mwh = 40 }))
const build = (engines: CollectionResultsEngines, extra: Partial<Parameters<typeof buildCollectionResults>[0]> = {}) =>
  buildCollectionResults({ companyId: company, context, records, evidence, setup: setupView, engines, now: () => new Date("2026-11-12T00:00:00Z"), ...extra })
/** Counts engine calls by action. */
function counted(engines: typeof batched) {
  const calls: string[] = []
  const wrap = <E extends object>(scope: string, engine: E): E => new Proxy(engine, { get(target, key) {
    const value = (target as Record<string | symbol, unknown>)[key]
    return typeof value === "function" ? (...args: unknown[]) => { calls.push(`${scope}.${String(key)}`); return (value as (...a: unknown[]) => unknown).apply(target, args) } : value
  } })
  return { engines: { scope1: wrap("scope1", engines.scope1), scope2: wrap("scope2", engines.scope2) }, calls }
}

describe("BI-01: Scope 1 and 2 results in one engine run per scope", () => {
  test("the pinned batch entry point is the reviewed file", async () => {
    expect(new Bun.CryptoHasher("sha256").update(await Bun.file(SCOPE12_BATCH_ENGINE).bytes()).digest("hex")).toBe(REVIEWED_SCOPE12_BATCH_SHA256)
  })

  for (const duplicatePolicy of ["hold", "count_and_warn"] as const)
    test(`the whole response is identical to the per-record path, record by record (duplicates: ${duplicatePolicy})`, async () => {
      const before = await build(perRecord, { duplicatePolicy })
      const { engines, calls } = counted(batched)
      const after = await build(engines, { duplicatePolicy })
      expect(JSON.stringify(after)).toBe(JSON.stringify(before))
      // One process per scope, then the two aggregates: never a call per record.
      expect(calls).toEqual(["scope1.calculateMany", "scope2.calculateMany", "scope1.aggregate", "scope2.aggregate"])
      expect(after.records.filter(row => row.outcome === "refused").map(row => row.scope).sort()).toEqual([1, 2])
      // The fixture reaches every outcome and engine status the route can give.
      expect(new Set(after.records.map(row => row.outcome))).toEqual(new Set(["calculated", "held", "refused"]))
      expect(new Set(after.records.map(row => row.scope1?.status).filter(Boolean))).toEqual(new Set(["complete", "partial", "input_needed", "review_required", "memo_only", "excluded"]))
      expect(new Set(after.records.map(row => row.scope2?.marketBased.status).filter(Boolean))).toEqual(new Set(["complete", "input_needed", "review_required"]))
      expect(new Set(after.records.map(row => row.plan.status))).toEqual(new Set([null, "withdrawn", "excluded", "input_needed"]))
      expect(new Set(after.records.map(row => row.periodCheck))).toEqual(new Set(["inside", "outside", "partial"]))
      expect(after.counts.unavailable).toBe(2)  // the two refusals; nothing unavailable
      expect(after.records.map(row => [row.scope1?.engineSha256, row.scope2?.engineSha256]).flat().filter(Boolean).every(sha => sha === REVIEWED_SCOPE1_ENGINE_SHA256 || sha === REVIEWED_SCOPE2_ENGINE_SHA256)).toBe(true)
    }, 180_000)

  test("a batch that cannot run makes only its own scope's records unavailable, never a figure", async () => {
    const before = await build(perRecord)
    const broken = { scope1: createScope1Engine({ python, expectedEngineSha256: REVIEWED_SCOPE1_ENGINE_SHA256, expectedBatchSha256: "0".repeat(64) }), scope2: batched.scope2 }
    const after = await build(broken)
    for (const row of after.records) {
      const was = before.records.find(item => item.recordId === row.recordId)!
      if (row.scope === 1 && was.outcome !== "held") expect([row.outcome, row.scope1, row.inSubtotal.scope1]).toEqual(["unavailable", null, false])
      else expect(row).toEqual(was)
    }
    expect(after.scope1).toBeNull()
    expect(after.scope2).toEqual(before.scope2)
    expect(after.warnings).toContain("A calculation engine was unavailable for at least one record. Try again shortly.")
  }, 180_000)

  test("a run past its budget answers its records unavailable and its subtotals unverified, never a partial figure", async () => {
    const spent = await build(batched, { deadline: Date.now() - 1 })
    expect(spent.records.filter(row => row.outcome !== "held").every(row => row.outcome === "unavailable")).toBe(true)
    expect([spent.scope1, spent.scope2]).toEqual([null, null])
    expect(COLLECTION_RESULTS_BUDGET_MS).toBe(25_000)
  }, 60_000)

  test("an aborted run stops: no engine is started after the abort and the run throws", async () => {
    const controller = new AbortController(), { engines, calls } = counted(batched)
    const slow = { ...engines, scope1: { ...engines.scope1, calculateMany: async (...args: Parameters<NonNullable<typeof batched.scope1.calculateMany>>) => { const out = await engines.scope1.calculateMany!(...args); controller.abort(); return out } } }
    await expect(build(slow, { signal: controller.signal })).rejects.toMatchObject({ code: "ABORTED" })
    expect(calls).toEqual(["scope1.calculateMany"])
  }, 60_000)
})

describe("BI-01: the results route", () => {
  const database: CollectionResultsDatabase = { findCollectionContext: async () => context, findCollectionActivities: async () => records, findCollectionEvidence: async () => evidence, findCompanySetup: async () => setupView, findCurrentMethodReleases: async () => [] }
  const route = (engines: CollectionResultsEngines) => createCollectionResultsRoutes({ database, engines, environment: "synthetic_staging", origin: "https://www.neuvetra.ai", validateUser: async () => ({ id: owner, phone: null, email: null, fullName: null }) })
  const get = (handler: ReturnType<typeof route>, signal?: AbortSignal) => handler(new Request(`https://www.neuvetra.ai/workspace/${company}/results`, { headers: { authorization: "Bearer owner" }, ...(signal ? { signal } : {}) }))

  test("when no engine could answer for any record the route answers 503, not results that look complete", async () => {
    // Before BI-01 this was a 200 with every record "unavailable", no subtotal and only a warning.
    const down = { scope1: createScope1Engine({ python, expectedEngineSha256: "0".repeat(64), expectedBatchSha256: REVIEWED_SCOPE12_BATCH_SHA256 }), scope2: createScope2Engine({ python, expectedEngineSha256: "0".repeat(64), expectedBatchSha256: REVIEWED_SCOPE12_BATCH_SHA256 }) }
    const response = await get(route(down))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ code: "results_engine_unavailable", error: RESULTS_ENGINE_UNAVAILABLE_TEXT })
    // One engine down: the other's figures are shown, with the warning, as before.
    const half = await get(route({ scope1: batched.scope1, scope2: down.scope2 }))
    expect(half.status).toBe(200)
    const body = await half.json() as CollectionResultsResponse
    expect(body.records.some(row => row.outcome === "calculated") && body.records.some(row => row.outcome === "unavailable")).toBe(true)
  }, 120_000)

  test("a request that goes away stops its run: the engine batch gets the abort and nothing runs after it", async () => {
    const controller = new AbortController(), seen: Array<AbortSignal | undefined> = []
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const engines: CollectionResultsEngines = { scope1: { ...batched.scope1, calculateMany: async (requests, call) => { seen.push(call?.signal); await gate; return batched.scope1.calculateMany!(requests, call) } },
      scope2: { ...batched.scope2, calculateMany: async (inputs, call) => { seen.push(call?.signal); return batched.scope2.calculateMany!(inputs, call) } } }
    const pending = get(route(engines), controller.signal)
    while (!seen.length) await Bun.sleep(5)
    expect(seen[0]?.aborted).toBe(false)
    controller.abort()
    expect(seen[0]?.aborted).toBe(true)  // the run's own signal: the runner kills the engine process group with it
    release()
    expect((await pending).status).toBe(503)
    expect(seen).toHaveLength(1)  // the Scope 2 batch never started
  }, 60_000)
})

// BI-01b (QA follow-up 3 of PR #68): the image job makes one real batch call per scope (tools/staging/scope12-batch-image-smoke.ts).
describe("BI-01b: the results engine self-check", () => {
  test("the reviewed engines pass; a missing or mis-pinned batch entry point fails the scope it serves", async () => {
    expect(await checkResultsEngines(reviewedResultsEngines({ python }))).toEqual({ scope1: "ok", scope2: "ok" })
    const misPinned = { scope1: createScope1Engine({ python, expectedEngineSha256: REVIEWED_SCOPE1_ENGINE_SHA256, expectedBatchSha256: "0".repeat(64) }), scope2: batched.scope2 }
    expect(await checkResultsEngines(misPinned)).toEqual({ scope1: "failed", scope2: "ok" })
    // Without a batch entry point at all (the engines without expectedBatchSha256).
    expect(await checkResultsEngines(perRecord)).toEqual({ scope1: "failed", scope2: "failed" })
    // No Python able to run anything.
    expect(await checkResultsEngines(reviewedResultsEngines({ python: "/bin/false" }))).toEqual({ scope1: "failed", scope2: "failed" })
  }, 120_000)
  test("the staging image copies the check and the image job runs it", async () => {
    const root = new URL("../../../../", import.meta.url)
    const [dockerfile, ignore, workflow] = await Promise.all(["Dockerfile.staging", "Dockerfile.staging.dockerignore", ".github/workflows/verify.yml"].map(name => Bun.file(new URL(name, root)).text()))
    expect(dockerfile).toContain("tools/staging/scope12-batch-image-smoke.ts ./tools/staging/")
    expect(ignore.split("\n")).toContain("!tools/staging/scope12-batch-image-smoke.ts")
    expect(workflow).toContain("--entrypoint bun neuvetra-m63:${{ github.sha }} tools/staging/scope12-batch-image-smoke.ts")
  })
})

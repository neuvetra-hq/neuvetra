// Claude UX journey (2026-09-29): the draft results route plans every saved record with the reviewed v7 adapter and
// sends only calculable ones to the pinned engines. Runs the real Scope 1 / Scope 2 engines.
import { describe, expect, test } from "bun:test"
import { validateCollectionActivity, type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView } from "@neuvetra/database"
import { createScope1Engine } from "../calculation/scope1-authority"
import { createScope2Engine } from "../calculation/scope2-authority"
import { buildCollectionResults, checkPeriod, createCollectionResultsRoutes, DRAFT_RESULTS_ENVIRONMENT, DRAFT_RESULTS_LABEL, REVIEWED_SCOPE1_ENGINE_SHA256, REVIEWED_SCOPE2_ENGINE_SHA256, type CollectionResultsDatabase, type CollectionResultsResponse } from "./collection-results-routes"

const python = process.env.NEUVETRA_PYTHON ?? "python3"
const engines = {
  scope1: createScope1Engine({ python, expectedEngineSha256: REVIEWED_SCOPE1_ENGINE_SHA256 }),
  scope2: createScope2Engine({ python, expectedEngineSha256: REVIEWED_SCOPE2_ENGINE_SHA256 }),
}
const company = "72000000-0000-4000-8000-000000000001", other = "72000000-0000-4000-8000-000000000009", setup = "72000000-0000-4000-8000-000000000002"
const office = "72000000-0000-4000-8000-000000000003", warehouse = "72000000-0000-4000-8000-000000000004"
const owner = "72000000-0000-4000-8000-0000000000a1", stranger = "72000000-0000-4000-8000-0000000000a2"
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, locations: [
  { id: office, name: "Office", inclusion: "included", control: "reporting_company" },
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
    expect(result.methods.map(m => [m.methodVersionId, m.scope, m.engineSha256, m.releaseStatus])).toEqual([
      ["scope1.mobile.onroad_diesel.v2", 1, REVIEWED_SCOPE1_ENGINE_SHA256, "unreleased_beta"],
      ["scope1.stationary.natural_gas.v2", 1, REVIEWED_SCOPE1_ENGINE_SHA256, "unreleased_beta"],
      ["scope2.electricity.egrid2023_greene2025.v3", 2, REVIEWED_SCOPE2_ENGINE_SHA256, "unreleased_beta"]])
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
    const result = await buildCollectionResults({ companyId: company, context, records: [power, blankMwh], evidence: [{ ...bill, quarantineStatus: "clean" }], setup: null, engines })
    const row = result.records.find(item => item.recordId === blankMwh.id)!
    expect(row.scope2?.marketBased.status).toBe("input_needed")
    expect(row.inSubtotal).toEqual({ scope1: false, scope2LocationBased: true, scope2MarketBased: false })
    expect(result.scope2?.marketBasedComplete).toBe(false)
  }, 60_000)

  test("the route refuses to exist outside synthetic staging", () => {
    const database = { findCollectionContext: async () => null, findCollectionActivities: async () => [], findCollectionEvidence: async () => [], findCompanySetup: async () => null } as CollectionResultsDatabase
    for (const environment of ["production", "staging", "", undefined])
      expect(() => createCollectionResultsRoutes({ database, engines, origin: "https://www.neuvetra.ai", validateUser: async () => null, environment: environment as never })).toThrow(/synthetic staging/)
  })

  test("each row names its linked evidence and scan state", async () => {
    const linked = record({ kind: "natural_gas", sourceId: "GAS-9", quantity: q("10", "therm"), payload: { heatContent: null }, evidenceIds: [billId] })
    const result = await buildCollectionResults({ companyId: company, context, records: [linked], evidence: [bill], setup: null, engines })
    expect(result.records[0]!.evidence).toEqual([{ id: billId, name: "gas-bill.pdf", sha256: "d".repeat(64), status: "pending" }])
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
    const result = await buildCollectionResults({ companyId: company, context, records: [], evidence, setup: null, engines })
    expect(result.scope1).toBeNull(); expect(result.scope2).toBeNull(); expect(result.counts.records).toBe(0)
  })

  test("the route authenticates, checks the origin and never serves another company", async () => {
    const database: CollectionResultsDatabase = {
      findCollectionContext: async (user, id) => user === owner && id === company ? context : null,
      findCollectionActivities: async (user, id) => user === owner && id === company ? [gasOffice] : [],
      findCollectionEvidence: async () => [],
      findCompanySetup: async (user, id) => user === owner && id === company ? setupView : null,
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
  }, 60_000)

  test("a record from another company is never calculated", async () => {
    const foreign = record({ kind: "natural_gas", sourceId: "GAS-X", quantity: q("10", "therm"), payload: { heatContent: null } }, other)
    const database: CollectionResultsDatabase = { findCollectionContext: async () => context, findCollectionActivities: async () => [foreign], findCollectionEvidence: async () => [], findCompanySetup: async () => null }
    const routes = createCollectionResultsRoutes({ database, engines, environment: "synthetic_staging", origin: "https://www.neuvetra.ai", validateUser: async () => ({ id: owner, phone: null, email: null, fullName: null }) })
    const response = await routes(new Request(`https://www.neuvetra.ai/workspace/${company}/results`, { headers: { authorization: "Bearer owner" } }))
    expect(response.status).toBe(404)
  })
})

import { describe, expect, test } from "bun:test"
import type { CompanySetupView } from "../../../../packages/neuvetra-database/src/company-setup-contract"
import { validateCollectionActivity, type CollectionActivity, type CollectionActivityRecord, type CollectionContext } from "../../../../packages/neuvetra-database/src/collection-contract"
import { SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import { recordReadiness } from "../components/CollectionWorkspace"
import { computeJourneyStatus, recordState, type JourneyStatus } from "./journey-status"
import { scope3ReadinessOptions, scope3SetupFacts, scope3SpendLineChoices } from "./scope3-forms"
import { computeReadiness, progressAnswer as answerFrom } from "./readiness"
/** WO-04b: Ask answers from the same readiness as the Overview (Scope 1 and 2 here; Scope 3 has its own tests). */
const progressAnswer = (status: JourneyStatus | null, failed = false) => answerFrom(computeReadiness({ status, statusFailed: failed, scope3: { state: "off" } }))

const company = "93810000-0000-4000-8000-000000000001", setupId = "93810000-0000-4000-8000-000000000002", site = "93810000-0000-4000-8000-000000000003"
const period = { start: "2025-01-01", endExclusive: "2026-01-01" }
const context: CollectionContext = { companyId: company, setupVersionId: setupId, setupRevision: 1, boundaryApproach: "operational_control", reportingPeriod: period,
  locations: [{ id: site, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] }
function setup(countryCode: string | null = "US", approach = "operational_control"): CompanySetupView {
  return { currentVersion: { revision: 1, setup: { company: { legalName: "Synthetic review" }, reportingPeriod: period, boundary: { approach },
    locations: [{ id: site, name: "Office", inclusion: "included", countryCode }], screening: [] } } } as unknown as CompanySetupView
}
function record(n: number, label: string, payload: Record<string, unknown> = {}): CollectionActivityRecord {
  const fixture = SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === label)!
  if (!fixture) throw new Error(`Missing test fixture: ${label}`)
  const activity = validateCollectionActivity({ kind: fixture.kind, locationId: site, setupVersionId: setupId, sourceId: `S-${n}`, state: "active", withdrawalReason: null,
    quantity: structuredClone(fixture.quantity), quality: "actual", estimateBasis: null, period, reference: "", notes: "", evidenceIds: [], payload: { ...structuredClone(fixture.payload as object), ...payload } })
  const id = `93810000-0000-4000-8000-${String(n).padStart(12, "0")}`
  return { id, companyId: company, kind: activity.kind, history: [], currentVersion: { id: `${id.slice(0, -1)}f`, recordId: id, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, activity, payloadSha256: "a".repeat(64), createdBy: company, createdAt: "2025-06-01T00:00:00.000Z" } }
}
async function status(records: CollectionActivityRecord[], view = setup()) {
  const choices = await scope3SpendLineChoices(records)
  const mappingKeys = new Map(choices.map(line => [line.mappingKeyInput, line.mappingKey]))
  const result = computeJourneyStatus({ setup: view, context, records, evidence: [], canManage: true, scope3: true, scope3MappingKeys: mappingKeys })
  const options = scope3ReadinessOptions({ setup: scope3SetupFacts(view), context, records, mappingKeys })
  for (const row of records) {
    const findings = recordReadiness(row.currentVersion.activity, context, [], undefined, { options, recordId: row.id })
    expect(result.collection.records.find(item => item.id === row.id)).toMatchObject({ state: recordState(findings), reasons: findings.map(item => item.reason) })
  }
  return result
}

describe("Overview and Ask share Activity's full Scope 3 context", () => {
  test("a hotel uses the saved location country; explicit hotel country still takes precedence", async () => {
    const hotel = record(11, "business_travel: v2 hotel stay in room-nights (normalized from 0030)", { hotelCountry: null })
    const ready = await status([hotel])
    expect(ready.collection.records[0]!.state).toBe("ready")
    expect(progressAnswer(ready).join(" ")).not.toContain("Hotel country")
    for (const country of [null, "CA"]) expect((await status([hotel], setup(country))).collection.records[0]!.state).toBe("input_needed")
    const explicit = record(12, "business_travel: v2 hotel stay in room-nights (normalized from 0030)", { hotelCountry: "CA" })
    expect((await status([explicit])).collection.records[0]!.state).toBe("method_pending")
  })
  test("leased-asset guidance uses the saved consolidation approach", async () => {
    const asset = record(21, "asset_energy: electricity, sub-metered", { category: 8, leaseType: "operating", noOperationalControlBasis: null })
    expect((await status([asset])).collection.records[0]!.state).toBe("input_needed")
    expect((await status([asset], setup("US", "financial_control"))).collection.records[0]!.state).toBe("ready")
    expect((await status([asset], setup("US", "unknown"))).collection.records[0]!.state).toBe("input_needed")
  })
  test("overlapping distance and average commuting cannot look ready in Overview", async () => {
    const average = record(31, "commuting_average: overlap unknown")
    const distance = record(32, "employee_commuting: 0029 payload")
    expect((await status([average])).collection.records[0]!.state).toBe("ready")
    expect((await status([average, distance])).collection.records[0]!.state).toBe("input_needed")
  })
  test("mapping-key-specific supersession does not present the replaced spend as counted", async () => {
    const spend = record(41, "purchase_spend: manual line")
    const [choice] = await scope3SpendLineChoices([spend])
    const supplier = record(42, "purchase_supplier: product factor", { supersedesSpend: { supplierName: "Different supplier alias", mappingKeys: [choice!.mappingKey] } })
    expect((await status([spend])).collection.records[0]!.state).toBe("ready")
    const result = await status([spend, supplier])
    expect(result.collection.records[0]!.state).toBe("excluded")
    expect(result.collection.records[1]!.state).toBe("ready")
    const other = record(43, "purchase_supplier: product factor", { supersedesSpend: { supplierName: "Different supplier alias", mappingKeys: ["f".repeat(64)] } })
    expect((await status([spend, other])).collection.records[0]!.state).toBe("ready")
  })
  test("adding Scope 3 context leaves Scope 1 and 2 readiness unchanged", () => {
    const base = record(51, "purchase_spend: manual line")
    const activity = validateCollectionActivity({ ...base.currentVersion.activity, kind: "natural_gas", quantity: { originalValue: "100", originalUnit: "therm", normalizedValue: "100", normalizedUnit: "therm" },
      payload: { heatContent: null } }) as CollectionActivity
    const gas = { ...base, kind: activity.kind, currentVersion: { ...base.currentVersion, activity } }
    const input = { setup: setup(), context, records: [gas], evidence: [], canManage: true }
    const before = computeJourneyStatus(input)
    const { scope3: _scope3, ...after } = computeJourneyStatus({ ...input, scope3: true })
    void _scope3
    expect(after).toEqual(before)
  })
})

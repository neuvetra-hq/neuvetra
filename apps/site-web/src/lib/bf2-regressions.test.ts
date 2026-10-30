// BF2 (Request B closure P3s, 24 October 2026): setup content is compared, not version IDs; a file waiting for quarantine
// review doesn't make a record need input; and a record outside the reporting period counts once, as outside it.
import { describe, expect, test } from "bun:test"
import { validateCollectionActivity, withCurrentSetupVersion, type CollectionActivity, type CollectionContext, type CollectionEvidenceMetadata } from "../../../../packages/neuvetra-database/src/collection-contract"
import { recordReadiness, requiresCurrentLocationReselection } from "@/components/CollectionWorkspace"
import { computeJourneyStatus } from "./journey-status"

const company = "b2000000-0000-4000-8000-000000000001", office = "b2000000-0000-4000-8000-000000000003"
const v1 = "b2000000-0000-4000-8000-0000000000a1", v2 = "b2000000-0000-4000-8000-0000000000a2", v3 = "b2000000-0000-4000-8000-0000000000a3"
const pending = "b2000000-0000-4000-8000-0000000000c2"
// Revision 3 restored revision 1's content byte for byte; revision 2 differed.
const context: CollectionContext = { boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, companyId: company, setupVersionId: v3, setupRevision: 3, sameContentSetupVersionIds: [v3, v1],
  locations: [{ id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, entity: null, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" }] }
const evidence: CollectionEvidenceMetadata[] = [{ id: pending, companyId: company, bucket: "neuvetra-private-company-evidence", objectKey: `${company}/original/${pending}`,
  originalName: "certificate.pdf", mediaType: "application/pdf", byteLength: 100, sha256: "a".repeat(64), quarantineStatus: "pending", uploadedBy: company, createdAt: "2025-06-01T00:00:00.000Z" }]
const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: v1, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic source", notes: "", evidenceIds: [] as string[], period: year }
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: /^\d+(\.\d+)?$/.test(value) ? value : null, normalizedUnit: /^\d+(\.\d+)?$/.test(value) ? unit : null })
const gas = (extra: Record<string, unknown> = {}) => validateCollectionActivity({ ...common, kind: "natural_gas", sourceId: "GAS-1", quantity: q("10", "therm"), payload: { heatContent: null }, ...extra })
const meter = (extra: Record<string, unknown> = {}) => validateCollectionActivity({ ...common, kind: "electricity", sourceId: "M-1", quantity: q("10000", "kWh"), evidenceIds: [pending], period: { start: "2025-01-01", endExclusive: "2025-02-01" },
  payload: { meterOrAccountNumber: "M-1", utilityName: "Synthetic", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: null,
    instruments: [{ type: "energy_attribute_certificate", mwh: "1", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: pending, generationTechnology: "wind", rateLbPerMwh: null }] }, ...extra })
const refrigerantStock = () => validateCollectionActivity({ ...common, kind: "fugitive", sourceId: "RTU-1", quantity: q("", "kg"), payload: { gas: "R-410A", unit: "kg",
  terms: { PN: "0", CN: "0", PS: "2", CD: "0", RD: "0" }, insideBoundary: true, maintainsRefrigerantStock: true, retrofitInPeriod: false, contractorRecordsComplete: true, eventChronologyComplete: true } })
let n = 0
const saved = (activity: CollectionActivity) => ({ id: `b2000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, kind: activity.kind, currentVersion: { activity } })
const setupView = (start = "2025-01-01", endExclusive = "2026-01-01") => ({ currentVersion: { revision: 3, setup: { company: { legalName: "Synthetic" }, reportingPeriod: { start, endExclusive },
  boundary: { approach: "operational_control" }, screening: [], locations: [{ id: office, name: "Office", inclusion: "included", operatorDetails: "" }] } } }) as never
const status = (records: CollectionActivity[], setup = setupView()) => computeJourneyStatus({ setup, context, records: records.map(saved) as never, evidence, canManage: true })

describe("BF2: setup content, not version IDs", () => {
  test("records saved against an identical earlier setup are not flagged; a changed setup still is", () => {
    expect(status([gas(), gas({ sourceId: "GAS-2" })]).collection.olderSetup).toBe(0)
    expect(status([gas(), gas({ sourceId: "GAS-2", setupVersionId: v2 })]).collection.olderSetup).toBe(1)
    // An older server sends no list: only the version ID counts, as before.
    const older: CollectionContext = { ...context }
    delete older.sameContentSetupVersionIds
    expect(computeJourneyStatus({ setup: setupView(), context: older, records: [saved(gas())] as never, evidence, canManage: true }).collection.olderSetup).toBe(1)
  })
  test("editing such a record keeps its site and saves it against the current version", () => {
    expect(requiresCurrentLocationReselection(gas(), context)).toBe(false)
    expect(requiresCurrentLocationReselection(gas({ setupVersionId: v2 }), context)).toBe(true)
    expect(withCurrentSetupVersion(gas(), context).setupVersionId).toBe(v3)
    expect(withCurrentSetupVersion(gas({ setupVersionId: v2 }), context).setupVersionId).toBe(v2)
    expect(withCurrentSetupVersion(gas({ locationId: "b2000000-0000-4000-8000-0000000000ff" }), context).setupVersionId).toBe(v1)
    expect(withCurrentSetupVersion(gas(), null).setupVersionId).toBe(v1)
  })
})

describe("BF2: the counters agree with Results", () => {
  // A-03 (26 October 2026): the waiting file no longer counts meanwhile, so the record's market-based result is held (partial),
  // but it is still nothing to fix: it never makes the record need input.
  test("a market-based file waiting for quarantine review holds the market-based result but doesn't make the record need input", () => {
    const findings = recordReadiness(meter(), context, evidence)
    expect(findings).toEqual([{ status: "partial", reason: "Market-based result held — Market-based instrument 1 evidence is waiting for quarantine review; it counts once the review clears the file.", waitingOnEvidence: true }])
    const journey = status([meter(), refrigerantStock(), gas()])
    expect(journey.collection.records.map(row => row.state)).toEqual(["partial", "review_required", "ready"])
    expect(journey.collection.partial).toBe(1)
    expect(journey.collection.attention).toBe(1)
    expect(journey.evidence.checking).toBe(1)
    expect(journey.next.title).toBe("Finish 1 record that needs input")
  })
  test("a record that needs input and is outside the reporting period counts once, as outside it", () => {
    const unknown = gas({ sourceId: "GAS-UNKNOWN", quality: "unknown", quantity: q("unknown", "therm") })
    expect(status([unknown]).collection).toMatchObject({ attention: 1, held: 0 })
    const prior = status([unknown, gas()], setupView("2024-01-01", "2025-01-01"))
    expect(prior.collection.records.map(row => row.state)).toEqual(["held_period", "held_period"])
    expect(prior.collection).toMatchObject({ attention: 0, held: 2 })
    expect(prior.collection.records[0]!.reasons[0]).toContain("outside the reporting period")
  })
})

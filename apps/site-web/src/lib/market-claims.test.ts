// A-01 / A-03 (Claude, 26 October 2026): what a client sees when a market-based certificate can't be counted yet.
// - A-01: one certificate file attached to several meters used to lower market-based emissions once per meter. Each file
//   now supports one claim; a file behind two or more claims counts for none, and the screens say why.
// - A-03: a certificate file still waiting for quarantine review used to count meanwhile (BF2). Its market-based result is
//   now held until the file clears; it is still nothing for the client to fix.
// Location-based results never change, and neither condition ever makes a record "need input".
import { describe, expect, test } from "bun:test"
import { validateCollectionActivity, type CollectionActivity, type CollectionContext, type CollectionEvidenceMetadata } from "../../../../packages/neuvetra-database/src/collection-contract"
import { instrumentEvidenceClaims } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { recordReadiness } from "@/components/CollectionWorkspace"
import { computeJourneyStatus } from "./journey-status"
import { reasonText } from "./plain-language"
import { decodeResults, DRAFT_LABEL, instrumentNotes, resultsCsv, RESULTS_PROFILE } from "./results-api"
import { rowReasons } from "./results-view"

const company = "a0100000-0000-4000-8000-000000000001", office = "a0100000-0000-4000-8000-000000000003", setup = "a0100000-0000-4000-8000-0000000000a1"
const certA = "a0100000-0000-4000-8000-0000000000c1", certACopy = "a0100000-0000-4000-8000-0000000000c2", certB = "a0100000-0000-4000-8000-0000000000c3"
const context: CollectionContext = { boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, companyId: company, setupVersionId: setup, setupRevision: 1, locations: [{ id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, entity: null, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" }] }
const file = (id: string, sha: string, quarantineStatus: CollectionEvidenceMetadata["quarantineStatus"] = "clean"): CollectionEvidenceMetadata => ({ id, companyId: company, bucket: "neuvetra-private-company-evidence",
  objectKey: `${company}/original/${id}`, originalName: "certificate.pdf", mediaType: "application/pdf", byteLength: 100, sha256: sha.repeat(64), quarantineStatus, uploadedBy: company, createdAt: "2025-06-01T00:00:00.000Z" })
const evidence = [file(certA, "1"), file(certACopy, "1"), file(certB, "2")]
const meter = (sourceId: string, cert: string) => validateCollectionActivity({ locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic", notes: "",
  kind: "electricity", sourceId, quantity: { originalValue: "10000", originalUnit: "kWh", normalizedValue: "10000", normalizedUnit: "kWh" }, evidenceIds: [cert], period: { start: "2025-01-01", endExclusive: "2025-02-01" },
  payload: { meterOrAccountNumber: sourceId, utilityName: "Synthetic", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: null,
    instruments: [{ type: "energy_attribute_certificate", mwh: "1", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: cert, generationTechnology: "wind", rateLbPerMwh: null }] } })
let n = 0
const saved = (activity: CollectionActivity) => ({ id: `a0100000-0000-4000-8000-${String(++n).padStart(12, "0")}`, kind: activity.kind, currentVersion: { activity } })
const setupView = { currentVersion: { revision: 1, setup: { company: { legalName: "Synthetic" }, reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" },
  boundary: { approach: "operational_control" }, screening: [], locations: [{ id: office, name: "Office", inclusion: "included", operatorDetails: "" }] } } } as never
const journey = (records: CollectionActivity[], files = evidence) => computeJourneyStatus({ setup: setupView, context, records: records.map(saved) as never, evidence: files, canManage: true })
const SHARED = "Market-based result held — Market-based instrument 1 uses a certificate file that also supports another market-based claim. A certificate can be claimed only once, so the market-based figure is held. Give each claim its own certificate or retirement record."

describe("A-01: one certificate file, one market-based claim", () => {
  test("the record screen says why the market-based result is held, for every record that shares the file", () => {
    const a = meter("M-1", certA), b = meter("M-2", certA), copy = meter("M-3", certACopy), other = meter("M-4", certB)
    const claims = instrumentEvidenceClaims([a, b, other], context, evidence)
    for (const record of [a, b]) expect(recordReadiness(record, context, evidence, claims)).toEqual([{ status: "partial", reason: SHARED }])
    expect(recordReadiness(other, context, evidence, claims)).toEqual([])
    // The same bytes uploaded twice are one certificate.
    expect(recordReadiness(a, context, evidence, instrumentEvidenceClaims([a, copy], context, evidence))).toEqual([{ status: "partial", reason: SHARED }])
    // Without the company's claims (no other records known) nothing is shared.
    expect(recordReadiness(a, context, evidence)).toEqual([])
  })

  test("the journey counts shared records as partly calculated, never as needing input", () => {
    const status = journey([meter("M-1", certA), meter("M-2", certA), meter("M-4", certB)])
    expect(status.collection.records.map(row => row.state)).toEqual(["partial", "partial", "ready"])
    expect([status.collection.attention, status.collection.partial, status.collection.ready]).toEqual([0, 2, 3])
    expect(status.collection.records[0]!.reasons).toEqual([SHARED])
  })
})

describe("A-03: a certificate waiting for quarantine review isn't counted yet", () => {
  test("the record is partial with the waiting reason; it isn't something to fix", () => {
    const files = [file(certA, "1", "pending"), file(certB, "2")]
    const status = journey([meter("M-1", certA), meter("M-4", certB)], files)
    expect(status.collection.records.map(row => [row.state, row.reasons])).toEqual([
      ["partial", ["Market-based result held — Market-based instrument 1 evidence is waiting for quarantine review; it counts once the review clears the file."]], ["ready", []]])
    expect([status.collection.attention, status.evidence.checking]).toEqual([0, 1])
  })
})

describe("Results and the CSV name the reason next to the engine's finding", () => {
  const ENGINE2 = "56f1245df2e5eac10adbbd7f553f2fa63ba64135b6153b5edc1025cf0e3e8dbb", REGISTER2 = "e".repeat(64)
  const total = (display: string) => ({ unrounded: display, display, unit: "kg CO2e", rounding: "half_even_4dp" })
  const row = (notes: string[]) => ({ recordId: "a0200000-0000-4000-8000-000000000001", versionId: "a0200000-0000-4000-8000-000000000011", revision: 1, kind: "electricity", scope: 2, sourceId: "M-1", locationId: office, locationName: "Office",
    period: { start: "2025-01-01", endExclusive: "2025-02-01" }, quantity: { value: "10000", unit: "kWh" }, quality: "actual", estimateBasis: null, evidenceCount: 1, evidence: [{ id: certA, name: "certificate.pdf", sha256: "1".repeat(64), status: "clean" }],
    plan: { action: "calculate", status: null, reasons: [], notes }, periodCheck: "inside", outcome: "calculated", inSubtotal: { scope1: false, scope2LocationBased: true, scope2MarketBased: false }, refusalCode: null, scope1: null,
    scope2: { methodVersionId: "scope2.electricity.egrid2023_greene2025.v3", engineSha256: ENGINE2, registerSha256: REGISTER2, gwpSetId: "AR5-100", status: "input_needed", findings: [], estimates: [], activity: { mwh: "10", instrumentMwh: "1", subregion: "CAMX" },
      locationBased: { status: "complete", findings: [], gases: {}, total: total("1950.2612") }, marketBased: { status: "input_needed", findings: ["instrument_evidence_required"], gases: null, total: null, residualMix: null }, factorsUsed: [], resultSha256: "f".repeat(64) } })
  const response = (notes: string[]) => ({ profile: RESULTS_PROFILE, label: DRAFT_LABEL, syntheticOnly: true, environment: "synthetic_staging", generatedAt: "2026-10-26T00:00:00.000Z", companyId: company,
    methods: [{ methodVersionId: "scope2.electricity.egrid2023_greene2025.v3", scope: 2, engineSha256: ENGINE2, registerSha256: REGISTER2, releaseStatus: "unreleased_beta", releaseId: null, releaseLabel: null }],
    setup: null, records: [row(notes)], counts: { records: 1, calculated: 1, held: 0, withdrawn: 0, excluded: 0, inputNeeded: 0, outsidePeriod: 0, unavailable: 0 }, warnings: [], scope1: null,
    scope2: { locationBasedSubtotal: total("1950.2612"), marketBasedSubtotal: total("0.0000"), locationBasedIncluded: ["f".repeat(64)], marketBasedIncluded: [], marketBasedProvisional: [], locationBasedComplete: true, marketBasedComplete: false, notCalculated: [], resultCount: 1 } })

  test("the shared and waiting notes are shown on screen and exported; other adapter notes are not", () => {
    for (const note of ["instrument_1_evidence_shared", "instrument_1_evidence_pending_scan", "instrument_1_evidence_not_usable"]) {
      const decoded = decodeResults(response([note, "saved_against_earlier_setup_version"]), company)
      const results = decoded.records[0]!
      expect(instrumentNotes(results)).toEqual([note])
      expect(rowReasons(results)).toEqual([reasonText(note), "Link the certificate or contract document."])
      const csv = resultsCsv(decoded, { kind: (k: string) => k, reason: reasonText, status: () => "Partial calculation", boundary: (c: string) => c, period: () => "2025" })
      expect(csv).toContain(reasonText(note))
      expect(csv).not.toContain(reasonText("saved_against_earlier_setup_version"))
    }
    expect(decodeResults(response([]), company).records[0]!.plan.notes).toEqual([])
  })
})

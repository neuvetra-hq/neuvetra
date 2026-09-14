import { describe, expect, test } from "bun:test"
import { M58_FIXTURE_SHA256, M58_REPORTED, M58_TOTALS, M58_WARNINGS, multiplyMwh, type AnnualInventory, type AnnualPeriod, type AnnualRegister } from "./m58"
import { M59_ENTRY_NAMES, buildInventoryEvidenceArchive, inspectInventoryEvidenceArchive, sha256, verifyInventoryEvidenceArchive, type EvidencePackInputs, type M59AuditEvent } from "./m59"

const ids = Array.from({ length: 40 }, (_, index) => `${String(index + 1).padStart(8, "0")}-1111-4111-8111-${String(index + 1).padStart(12, "0")}`)
const company = ids[0]!, facility = ids[1]!, boundary = ids[2]!, owner = ids[3]!, admin = ids[4]!

function registerSnapshot(value: Omit<AnnualRegister, "createdBy" | "createdAt" | "snapshotSha256">): string { return sha256(value) }
function inventorySnapshot(value: Omit<AnnualInventory, "submittedBy" | "submittedAt" | "decision" | "snapshotSha256">): string { return sha256(value) }

export async function fixture(): Promise<EvidencePackInputs> {
  const rawBillBytes = new Uint8Array(await Bun.file(new URL("../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf", import.meta.url)).arrayBuffer())
  const rawRegisterBytes = new Uint8Array(await Bun.file(new URL("../../../data/synthetic/m58-electricity-register-2023.json", import.meta.url)).arrayBuffer())
  const rawFixtureManifestBytes = new Uint8Array(await Bun.file(new URL("../../../data/synthetic/m58-electricity-register-2023.manifest.json", import.meta.url)).arrayBuffer())
  const calculationCore = { contract_version: "m56-linked-bill-calculation-result-v1", status: "calculated", method: { adapter_implementation_sha256: "ae03b9146060187c63b6f3b8a253fbd61cd4f97a9aa97905481904eca45b061e", reviewed_engine_sha256: "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c", authority_record_sha256: "9c63b2cb12fa2708f35d394e537ca5803e27f91c4647f33376abf75a6fb72b91" }, factor: { candidate_sha256: "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356", source: { workbook_sha256: "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab" }, total_output_co2e: { value: "195.0402888", cell: "AI6" } }, gwp_policy: { policy_sha256: "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5" }, input_snapshot: { company_id: company, evidence_id: ids[5]!, activity_version_id: ids[7]!, bill_version_id: ids[6]!, facility_id: facility, boundary_id: boundary }, total: { unrounded: "2407.9674055248", display: "2407.9674" } }
  const calculationHash = sha256(calculationCore)
  const calculation = {
    id: ids[8]!, activityVersionId: ids[7]!, billVersionId: ids[6]!, evidenceId: ids[5]!, facilityId: facility, boundaryId: boundary, billVersion: 2 as const,
    sourceQuantityKwh: "12346.000" as const, normalizedQuantityMwh: "12.346000" as const, status: "draft" as const, classification: "development_candidate" as const, releaseEligible: false as const,
    method: { id: "scope2-location-based-egrid-subregion" as const, version: "2023-r2-camx-v1" as const, implementationSha256: "ae03b9146060187c63b6f3b8a253fbd61cd4f97a9aa97905481904eca45b061e", reviewedEngineSha256: "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c", authorityRecordSha256: "9c63b2cb12fa2708f35d394e537ca5803e27f91c4647f33376abf75a6fb72b91" },
    factor: { id: "epa-egrid2023-r2-camx-total-output" as const, version: "eGRID2023-revision-2" as const, candidateSha256: "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356", sourceSha256: "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab", sheet: "SRL23" as const, totalOutputCell: "AI6" as const, value: "195.0402888" as const },
    gwpPolicy: { id: "epa-egrid2023-ar5-100-year" as const, version: "egrid2023-technical-guide-v1" as const, policySha256: "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5" }, inputSnapshotSha256: "1".repeat(64), resultPayloadSha256: calculationHash,
    total: { unrounded: "2407.9674055248" as const, display: "2407.9674" as const, unit: "kg CO2e" as const, rounding: "half_up_4" }, gasResults: {}, reconciliation: { authority: "published total", componentSum: "2407.8330020304" as const, componentRoundingDelta: "0.1344034944" as const, explanation: "Synthetic reconciliation." }, trace: [], billVersionPayloadSha256: "2".repeat(64), createdBy: owner, createdAt: "2026-09-14T00:00:00.000Z", record: { ...calculationCore, result_payload_sha256: calculationHash },
  }
  const predecessorBase = { profile: "m57-synthetic-scope2-inventory-v1", companyId: company, boundaryId: boundary, calculationId: calculation.id, calculationResultSha256: calculationHash, reportingYear: 2023, scope: "scope_2_location_based", coverage: { expectedFacilities: 1, coveredFacilities: 1, expectedPeriods: 12, coveredPeriods: 1, coveredMonths: ["2023-01"], missingMonths: Array.from({ length: 11 }, (_, n) => `2023-${String(n + 2).padStart(2, "0")}`) }, warnings: ["annual_coverage_incomplete_1_of_12_months", "market_based_scope2_not_included", "factor_and_method_not_released", "synthetic_local_only_no_assurance"], complete: false, releaseEligible: false }
  const predecessor = { id: ids[9]!, companyId: company, boundaryId: boundary, calculationId: calculation.id, version: 1 as const, reportingYear: 2023 as const, scope: "scope_2_location_based" as const, reviewState: "approved_bounded_draft" as const, completeness: "incomplete" as const, releaseEligible: false as const, coverage: predecessorBase.coverage as any, warnings: predecessorBase.warnings, line: { facilityId: facility, servicePeriodStart: "2023-01-01" as const, servicePeriodEnd: "2023-01-31" as const, quantityMwh: "12.346000" as const, subtotalKgCo2e: "2407.9674" as const, calculationResultSha256: calculationHash }, snapshotSha256: sha256(predecessorBase), submittedBy: owner, submittedAt: "2026-09-14T00:01:00.000Z", decision: { id: ids[10]!, decision: "approve_bounded_draft" as const, outcome: "approved_bounded_draft" as const, acknowledgedWarnings: predecessorBase.warnings, reasonCode: "bounded_synthetic_scope_reviewed" as const, decidedBy: admin, decidedAt: "2026-09-14T00:02:00.000Z" } }
  const periods1: AnnualPeriod[] = Array.from({ length: 12 }, (_, n) => n === 0 ? { month: "2023-01", state: "reported", version: 1, quantityMwh: "12.346000", emissionsKgCo2e: "2407.9674055248", evidence: { source: "M56 calculation derived from M55 bill version 2", sha256: calculationHash, locator: `calculation ${calculation.id}; service 2023-01-01..2023-01-31` }, reason: null, method: null, formula: null, basisMonths: [] } : { month: `2023-${String(n + 1).padStart(2, "0")}`, state: "missing", version: 1, quantityMwh: null, emissionsKgCo2e: null, evidence: null, reason: "awaiting_source", method: null, formula: null, basisMonths: [] })
  const v1Base = { id: ids[11]!, companyId: company, boundaryId: boundary, previousInventoryVersionId: predecessor.id, version: 1 as const, reportingYear: 2023 as const, facilityId: facility, status: "incomplete" as const, counts: { expected: 12 as const, resolved: 1, reported: 1, estimated: 0, excluded: 0, missing: 11, calculationBearing: 1 }, periods: periods1, totals: null, fixtureSha256: null }
  const v1: AnnualRegister = { ...v1Base, snapshotSha256: registerSnapshot(v1Base), createdBy: owner, createdAt: "2026-09-14T00:03:00.000Z" }
  const periods2: AnnualPeriod[] = M58_REPORTED.map(([month, quantityMwh], n) => ({ month, state: "reported", version: n === 0 ? 1 : 2, quantityMwh, emissionsKgCo2e: multiplyMwh(quantityMwh), evidence: n === 0 ? periods1[0]!.evidence : { source: "M58 fixed fictional electricity register", sha256: M58_FIXTURE_SHA256, locator: `rows[${n - 1}]` }, reason: null, method: null, formula: null, basisMonths: [] }))
  periods2.push({ month: "2023-11", state: "estimated", version: 2, quantityMwh: "12.493000", emissionsKgCo2e: "2436.6383279784", evidence: null, reason: "synthetic_november_statement_unavailable", method: "mean_of_prior_two_reported_months_v1", formula: "(12.765000 + 12.221000) / 2", basisMonths: ["2023-09", "2023-10"] }, { month: "2023-12", state: "excluded", version: 2, quantityMwh: null, emissionsKgCo2e: null, evidence: { source: "M58 fixed fictional electricity register", sha256: M58_FIXTURE_SHA256, locator: "closureMemo" }, reason: "outside_operational_control_after_lease_end", method: null, formula: null, basisMonths: [] })
  const v2Base = { id: ids[12]!, companyId: company, boundaryId: boundary, previousInventoryVersionId: predecessor.id, version: 2 as const, reportingYear: 2023 as const, facilityId: facility, status: "resolved_with_exceptions" as const, counts: { expected: 12 as const, resolved: 12, reported: 10, estimated: 1, excluded: 1, missing: 0, calculationBearing: 11 }, periods: periods2, totals: M58_TOTALS, fixtureSha256: M58_FIXTURE_SHA256 }
  const v2: AnnualRegister = { ...v2Base, snapshotSha256: registerSnapshot(v2Base), createdBy: owner, createdAt: "2026-09-14T00:04:00.000Z" }
  const annualBase = { id: ids[13]!, companyId: company, boundaryId: boundary, previousInventoryVersionId: predecessor.id, registerId: v2.id, registerSnapshotSha256: v2.snapshotSha256, version: 2 as const, reportingYear: 2023 as const, scope: "scope_2_location_based" as const, periodResolution: "resolved_with_exceptions" as const, overallInventoryCompleteness: "incomplete" as const, releaseEligible: false as const, counts: { expected: 12 as const, resolved: 12 as const, reported: 10 as const, estimated: 1 as const, excluded: 1 as const, missing: 0 as const, calculationBearing: 11 as const }, totals: M58_TOTALS, warnings: [...M58_WARNINGS] }
  const annual: AnnualInventory = { ...annualBase, snapshotSha256: inventorySnapshot(annualBase), submittedBy: owner, submittedAt: "2026-09-14T00:05:00.000Z", decision: { id: ids[14]!, decision: "approve_bounded_annual_location_draft", outcome: "approved_bounded_annual_location_draft", reasonCode: "bounded_annual_location_register_reviewed", acknowledgedWarnings: [...M58_WARNINGS], decidedBy: admin, decidedAt: "2026-09-14T00:06:00.000Z" } }
  const subjects=[ids[5]!,ids[6]!,ids[7]!,calculation.id,predecessor.id,predecessor.decision.id,v1.id,v2.id,annual.id,annual.decision!.id]
  const auditEvents: M59AuditEvent[] = ["bill.ingested", "bill.corrected", "bill.linked", "calculation.created", "inventory.version.created", "inventory.review.recorded", "annual_register.created", "annual_register.completed", "annual_inventory.created", "annual_inventory.reviewed"].map((eventType, n) => ({ id: ids[20 + n]!, companyId: company, actorUserId: n === 5 || n === 9 ? admin : owner, eventType: eventType as M59AuditEvent["eventType"], subjectId: subjects[n]!, metadata: {}, occurredAt: `2026-09-14T00:${String(10 + n).padStart(2, "0")}:00.000Z` }))
  return { workspace: { id: company, companyName: "Synthetic Acme, Inc.", countryCode: "US", stateCode: "CA", facility: { id: facility, name: "Synthetic California office", egridSubregion: "CAMX" }, boundary: { id: boundary, reportingYear: 2023, approach: "operational_control", status: "draft", version: 1 } }, bill: { id: ids[5]!, companyId: company, originalName: "neuvetra-m55-synthetic-electricity-bill.pdf", mediaType: "application/pdf", byteLength: 4605, sha256: "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135", parserVersion: "m55-fixed-pdf-v1", supplierName: "Synthetic Golden State Electric", accountLabel: "SYNTHETIC-0001", billNumber: "SYN-CA-2023-01", servicePeriodStart: "2023-01-01", servicePeriodEnd: "2023-01-31", sourceLocators: { servicePeriod: { startByte: 3119, endByte: 3147 }, electricityKwh: { startByte: 3384, endByte: 3394 } }, state: "linked_draft", versions: [{ id: ids[15]!, version: 1, facilityId: null, electricityKwh: "12345.000", correctionReason: null }, { id: ids[6]!, version: 2, facilityId: facility, electricityKwh: "12346.000", correctionReason: "Synthetic review exercise" }], draftActivity: { id: ids[7]!, billVersionId: ids[6]!, quantityMwh: "12.346000", status: "draft" } }, calculation, predecessorInventory: predecessor, registers: [v1, v2], annualInventory: annual, rawBillBytes, rawRegisterBytes, rawFixtureManifestBytes, auditEvents }
}

describe("M59 deterministic evidence archive", () => {
  test("builds 17 deterministic ZIP_STORED entries and replays exact arithmetic", async () => {
    const input = await fixture(), first = buildInventoryEvidenceArchive(input), second = buildInventoryEvidenceArchive(input)
    expect(first.archive).toEqual(second.archive)
    expect(first.entryCount).toBe(17)
    expect(inspectInventoryEvidenceArchive(first.archive)).toEqual(M59_ENTRY_NAMES.map((name) => expect.objectContaining({ name, method: "stored" })))
    const receipt = verifyInventoryEvidenceArchive(first.archive, { archiveSha256: first.archiveSha256, manifestSha256: first.manifestSha256, lineageRootSha256: first.lineageRootSha256, companyId: company, inventoryId: input.annualInventory.id, currentArchive: second.archive })
    expect(receipt).toMatchObject({ status: "verified_match", entryCount: 17, reconstructed: { includedMwh: "139.281000", includedKgCo2e: "27165.4064643528", includedDisplayKgCo2e: "27165.4065" }, overallInventoryCompleteness: "incomplete", releaseEligible: false })
  })
  test("rejects byte, metadata, current-archive, arithmetic and audit tampering", async () => {
    const input = await fixture(), built = buildInventoryEvidenceArchive(input)
    const changed = built.archive.slice(); changed[40] ^= 1
    expect(() => verifyInventoryEvidenceArchive(changed, { archiveSha256: built.archiveSha256 })).toThrow()
    const metadata = built.archive.slice(); metadata[10] = 1
    expect(() => verifyInventoryEvidenceArchive(metadata, { archiveSha256: new Bun.CryptoHasher("sha256").update(metadata).digest("hex") })).toThrow()
    const other = built.archive.slice(); other[100] ^= 1
    expect(() => verifyInventoryEvidenceArchive(built.archive, { archiveSha256: built.archiveSha256, currentArchive: other })).toThrow()
    const arithmetic = await fixture(); arithmetic.registers[1]!.periods[10]!.quantityMwh = "12.494000"
    expect(() => buildInventoryEvidenceArchive(arithmetic)).toThrow()
    const audit = await fixture(); audit.auditEvents.reverse()
    expect(() => buildInventoryEvidenceArchive(audit)).toThrow()
  })
  test("rejects changed local and central headers, CRCs, paths and entry order", async () => {
    const built = buildInventoryEvidenceArchive(await fixture())
    const sha = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const u16 = (bytes: Uint8Array, offset: number) => bytes[offset]! | (bytes[offset + 1]! << 8)
    const u32 = (bytes: Uint8Array, offset: number) => (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0
    const verifyChanged = (bytes: Uint8Array) => expect(() => verifyInventoryEvidenceArchive(bytes, { archiveSha256: sha(bytes) })).toThrow()

    const localCrc = built.archive.slice(); localCrc[14] ^= 1; verifyChanged(localCrc)
    const localPath = built.archive.slice(); localPath[30] = localPath[30] === 109 ? 110 : 109; verifyChanged(localPath)
    const centralOffset = u32(built.archive, built.archive.byteLength - 6)
    const centralCrc = built.archive.slice(); centralCrc[centralOffset + 16] ^= 1; verifyChanged(centralCrc)
    const centralPath = built.archive.slice(); centralPath[centralOffset + 46] = centralPath[centralOffset + 46] === 109 ? 110 : 109; verifyChanged(centralPath)

    const firstLength = 46 + u16(built.archive, centralOffset + 28) + u16(built.archive, centralOffset + 30) + u16(built.archive, centralOffset + 32)
    const secondOffset = centralOffset + firstLength
    const secondLength = 46 + u16(built.archive, secondOffset + 28) + u16(built.archive, secondOffset + 30) + u16(built.archive, secondOffset + 32)
    const reordered = built.archive.slice()
    reordered.set(built.archive.slice(secondOffset, secondOffset + secondLength), centralOffset)
    reordered.set(built.archive.slice(centralOffset, centralOffset + firstLength), centralOffset + secondLength)
    verifyChanged(reordered)
  })
})

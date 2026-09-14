import { describe, expect, test } from "bun:test"
import { calculateSyntheticBill, correctSyntheticBill, createSyntheticWorkspace, decodeSyntheticBill, decodeWorkspace, linkSyntheticBill, replaySyntheticBillCalculation, revisitSyntheticWorkspace, uploadSyntheticBill } from "./workspace-api"

const fixture = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  companyName: "Synthetic Acme, Inc.",
  countryCode: "US",
  stateCode: "CA",
  facility: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Synthetic California office", egridSubregion: "CAMX" },
  boundary: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", reportingYear: 2023, approach: "operational_control", status: "draft", version: 1 },
}

const billFixture = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", companyId: fixture.id,
  originalName: "neuvetra-m55-synthetic-electricity-bill.pdf", mediaType: "application/pdf", byteLength: 4605,
  sha256: "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135", parserVersion: "m55-fixed-pdf-v1", state: "needs_review",
  supplierName: "Synthetic Golden State Electric", accountLabel: "SYNTHETIC-0001", billNumber: "SYN-CA-2023-01",
  servicePeriodStart: "2023-01-01", servicePeriodEnd: "2023-01-31",
  sourceLocators: { servicePeriod: { startByte: 3119, endByte: 3147 }, electricityKwh: { startByte: 3384, endByte: 3394 } },
  versions: [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", version: 1, facilityId: null, electricityKwh: "12345.000", correctionReason: null }], draftActivity: null, draftCalculation: null,
} as const

const reviewedVersion = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", version: 2, facilityId: fixture.facility.id, electricityKwh: "12346.000", correctionReason: "Synthetic review exercise" }
const activity = { id: "12121212-1212-4212-8212-121212121212", billVersionId: reviewedVersion.id, quantityMwh: "12.346000", status: "draft" }
const rawGasResults = { co2: { mass: "2399.4607843584", mass_unit: "kg CO2", co2e: "2399.4607843584", co2e_unit: "kg CO2e" }, ch4: { mass: "0.14000364", mass_unit: "kg CH4", co2e: "3.92010192", co2e_unit: "kg CO2e" }, n2o: { mass: "0.0168004368", mass_unit: "kg N2O", co2e: "4.452115752", co2e_unit: "kg CO2e" } }
const rawTrace = [{ step: "reviewed_bill_conversion", expression: "12346.000 / 1000", result: "12.346000", unit: "MWh" }, { step: "published_total_output", expression: "12.346000 * 195.0402888", result: "2407.9674055248", unit: "kg CO2e" }, { step: "component_sum_reference", expression: "2399.4607843584 + 3.92010192 + 4.452115752", result: "2407.8330020304", unit: "kg CO2e" }, { step: "published_rate_rounding_delta", expression: "2407.9674055248 - 2407.8330020304", result: "0.1344034944", unit: "kg CO2e" }]
const rawTotal = { unrounded: "2407.9674055248", display: "2407.9674", unit: "kg CO2e", rounding: "four decimal places; ROUND_HALF_EVEN; no intermediate rounding" }
const rawReconciliation = { authority: "published total-output CO2e rate in AI6", component_sum: "2407.8330020304", component_rounding_delta: "0.1344034944", explanation: "EPA publishes the gas-specific rates as rounded columns. They remain inspection values and are not substituted for the published AI6 total-output rate." }
const rawMethod = { id: "scope2-location-based-egrid-subregion", version: "2023-r2-camx-v1", adapter_implementation_sha256: "ae03b9146060187c63b6f3b8a253fbd61cd4f97a9aa97905481904eca45b061e", reviewed_engine_sha256: "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c", authority_record_sha256: "9c63b2cb12fa2708f35d394e537ca5803e27f91c4647f33376abf75a6fb72b91", formula: "MWh × published eGRID subregion total-output CO2e rate" }
const rawFactor = { id: "epa-egrid2023-r2-camx-total-output", version: "eGRID2023-revision-2", status: "development_candidate", release_eligible: false, data_year: "2023", geography: { country: "United States", state: "California", egrid_subregion: "CAMX", name: "WECC California" }, components: { co2: { value: "194.3512704", unit: "kg CO2/MWh", cell: "AC6" }, ch4: { value: "0.01134", unit: "kg CH4/MWh", cell: "AE6" }, n2o: { value: "0.0013608", unit: "kg N2O/MWh", cell: "AG6" } }, total_output_co2e: { cell: "AI6", value: "195.0402888", unit: "kg CO2e/MWh" }, source: { publisher: "U.S. Environmental Protection Agency", title: "eGRID2023 metric data file, revision 2", workbook_sha256: "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab", sheet: "SRL23", table: "eGRID subregion annual total output emission rates", row_cells: ["A6", "B6", "C6", "AC6", "AE6", "AG6", "AI6"], header_cells: ["A1", "B1", "C1", "AC1", "AE1", "AG1", "AI1"], publisher_url: "https://www.epa.gov/egrid/detailed-data", rights_status: "federal_public_data_commercial_use_citation_reviewed; method_release_pending" }, candidate_sha256: "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356" }
const rawGwp = { id: "epa-egrid2023-ar5-100-year", version: "egrid2023-technical-guide-v1", assessment: "IPCC AR5 without climate-carbon feedbacks", time_horizon_years: "100", values: { co2: "1", ch4: "28", n2o: "265" }, source: { publisher: "U.S. Environmental Protection Agency", title: "Technical Guide for eGRID2023", page: "12", section: "3.1.1.2 Annual Emission Estimates for CH4, N2O, and CO2 equivalent", publisher_url: "https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf" }, policy_sha256: "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5" }
const rawInput = { company_id: fixture.id, evidence_id: billFixture.id, bill_version_id: reviewedVersion.id, activity_version_id: activity.id, facility_id: fixture.facility.id, boundary_id: fixture.boundary.id, extraction_id: "15151515-1515-4515-8515-151515151515", parser_version: "m55-fixed-pdf-v1", previous_bill_version_id: billFixture.versions[0].id, activity_version: 1, bill_version: 2, evidence_sha256: billFixture.sha256, source_quantity_kwh: "12346.000", normalized_quantity_mwh: "12.346000", correction_reason: "Synthetic review exercise", service_period: { start: "2023-01-01", end: "2023-01-31" }, facility: { name: "Synthetic California office", country: "United States", state: "California", egrid_subregion: "CAMX" }, boundary: { reporting_year: 2023, approach: "operational_control", status: "draft", version: 1 } }
const recordResultFixture = { contract_version: "m56-linked-bill-calculation-result-v1", status: "calculated", classification: { factor: "development_candidate", runtime: "not_released", release_eligible: false }, input_snapshot: rawInput, input_snapshot_sha256: "a".repeat(64), activity: { asset_id: fixture.facility.id, boundary_id: fixture.boundary.id, electricity: "Grid-delivered purchased electricity", geography: { country: "United States", state: "California", egrid_subregion: "CAMX" }, activity_period: { start: "2023-01-01", end: "2023-01-31" }, factor_data_year: "2023", quantity: "12.346000", unit: "MWh" }, method: rawMethod, factor: rawFactor, gwp_policy: rawGwp, conversion: { id: "exact-kwh-to-mwh-v1", expression: "12346.000 / 1000", source: "12346.000 kWh", result: "12.346000 MWh" }, gas_results: rawGasResults, trace: rawTrace, total: rawTotal, reconciliation: rawReconciliation, result_payload_sha256: "b".repeat(64) }
const recordFixture = { calculationId: "13131313-1313-4313-8313-131313131313", billVersionPayloadSha256: "c".repeat(64), createdBy: "14141414-1414-4414-8414-141414141414", createdAt: "2026-09-13T12:00:00.000Z", result: recordResultFixture }

function setPath(value: unknown, path: readonly string[], replacement: unknown) {
  let cursor = value as Record<string, unknown>
  for (const key of path.slice(0, -1)) cursor = cursor[key] as Record<string, unknown>
  cursor[path.at(-1)!] = replacement
}
const calculatedFixture = {
  ...billFixture, state: "linked_draft", versions: [...billFixture.versions, reviewedVersion], draftActivity: activity,
  draftCalculation: {
    id: "13131313-1313-4313-8313-131313131313", activityVersionId: activity.id, billVersionId: reviewedVersion.id,
    evidenceId: billFixture.id, facilityId: fixture.facility.id, boundaryId: fixture.boundary.id, billVersion: 2,
    sourceQuantityKwh: "12346.000", normalizedQuantityMwh: "12.346000", status: "draft", classification: "development_candidate", releaseEligible: false,
    method: { id: "scope2-location-based-egrid-subregion", version: "2023-r2-camx-v1", implementationSha256: "ae03b9146060187c63b6f3b8a253fbd61cd4f97a9aa97905481904eca45b061e", reviewedEngineSha256: "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c", authorityRecordSha256: "9c63b2cb12fa2708f35d394e537ca5803e27f91c4647f33376abf75a6fb72b91" },
    factor: { id: "epa-egrid2023-r2-camx-total-output", version: "eGRID2023-revision-2", candidateSha256: "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356", sourceSha256: "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab", sheet: "SRL23", totalOutputCell: "AI6", value: "195.0402888" },
    gwpPolicy: { id: "epa-egrid2023-ar5-100-year", version: "egrid2023-technical-guide-v1", policySha256: "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5" },
    inputSnapshotSha256: "a".repeat(64), resultPayloadSha256: "b".repeat(64),
    total: { unrounded: "2407.9674055248", display: "2407.9674", unit: "kg CO2e", rounding: "four decimal places; ROUND_HALF_EVEN; no intermediate rounding" },
    gasResults: { co2: { mass: "2399.4607843584", mass_unit: "kg CO2", co2e: "2399.4607843584", co2e_unit: "kg CO2e" }, ch4: { mass: "0.14000364", mass_unit: "kg CH4", co2e: "3.92010192", co2e_unit: "kg CO2e" }, n2o: { mass: "0.0168004368", mass_unit: "kg N2O", co2e: "4.452115752", co2e_unit: "kg CO2e" } },
    reconciliation: { authority: "published total-output CO2e rate in AI6", componentSum: "2407.8330020304", componentRoundingDelta: "0.1344034944", explanation: "EPA publishes the gas-specific rates as rounded columns. They remain inspection values and are not substituted for the published AI6 total-output rate." },
    trace: [{ step: "reviewed_bill_conversion", expression: "12346.000 / 1000", result: "12.346000", unit: "MWh" }, { step: "published_total_output", expression: "12.346000 * 195.0402888", result: "2407.9674055248", unit: "kg CO2e" }, { step: "component_sum_reference", expression: "2399.4607843584 + 3.92010192 + 4.452115752", result: "2407.8330020304", unit: "kg CO2e" }, { step: "published_rate_rounding_delta", expression: "2407.9674055248 - 2407.8330020304", result: "0.1344034944", unit: "kg CO2e" }],
    billVersionPayloadSha256: "c".repeat(64), createdBy: "14141414-1414-4414-8414-141414141414", createdAt: "2026-09-13T12:00:00.000Z",
    record: recordFixture,
  },
} as const

describe("M54 workspace browser boundary", () => {
  test("accepts only the fixed synthetic workspace contract", () => {
    expect(decodeWorkspace(fixture)).toEqual(fixture)
    for (const changed of [
      { ...fixture, ownerId: "injected" },
      { ...fixture, companyName: "Other" },
      { ...fixture, boundary: { ...fixture.boundary, version: 2 } },
      { ...fixture, facility: { ...fixture.facility, egridSubregion: "NWPP" } },
    ]) expect(() => decodeWorkspace(changed)).toThrow("not recognized")
  })

  test("sends only a synthetic bearer identity outside the body", async () => {
    let observed: { url: string; init?: RequestInit } | undefined
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      observed = { url: String(url), init }
      return Response.json(fixture, { status: 201 })
    }) as typeof fetch
    await createSyntheticWorkspace("owner", fetcher)
    expect(observed?.url).toBe("/workspace-api/workspace")
    expect(new Headers(observed?.init?.headers).get("authorization")).toBe("Bearer m54-synthetic-owner")
    expect(JSON.parse(String(observed?.init?.body))).not.toHaveProperty("userId")
  })

  test("keeps foreign and absent responses claim-free", async () => {
    const fetcher = (async () => Response.json({ error: "Workspace not found." }, { status: 404 })) as typeof fetch
    await expect(revisitSyntheticWorkspace(fixture.id, "outsider", fetcher)).rejects.toThrow("Workspace not found")
  })

  test("makes signed-out creation fail through the server contract", async () => {
    let headers: HeadersInit | undefined
    const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
      headers = init?.headers
      return Response.json({ error: "Authentication required." }, { status: 401 })
    }) as typeof fetch
    await expect(createSyntheticWorkspace("signed_out", fetcher)).rejects.toThrow("Authentication required")
    expect(new Headers(headers).has("authorization")).toBe(false)
  })
})

describe("M55 bill browser boundary", () => {
  test("accepts only the exact bounded bill response", () => {
    expect(decodeSyntheticBill(billFixture)).toEqual(billFixture)
    expect(() => decodeSyntheticBill({ ...billFixture, rawBytes: "injected" })).toThrow("not recognized")
    expect(() => decodeSyntheticBill({ ...billFixture, byteLength: 4606 })).toThrow("not recognized")
    expect(() => decodeSyntheticBill({ ...billFixture, versions: [{ ...billFixture.versions[0], facilityId: "foreign" }] })).toThrow("not recognized")
    expect(() => decodeSyntheticBill({ ...billFixture, state: "reviewed" })).toThrow("not recognized")
    expect(() => decodeSyntheticBill({ ...billFixture, servicePeriodStart: "2023-11-01" })).toThrow("not recognized")
    expect(() => decodeSyntheticBill({ ...billFixture, sourceLocators: { ...billFixture.sourceLocators, electricityKwh: { startByte: 0, endByte: 10 } } })).toThrow("not recognized")
  })

  test("uploads multipart without setting its content type", async () => {
    let observed: RequestInit | undefined
    const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => { observed = init; return Response.json(billFixture) }) as typeof fetch
    const file = new File([new Uint8Array(4605)], billFixture.originalName, { type: "application/pdf" })
    await uploadSyntheticBill(fixture.id, "owner", file, fetcher)
    expect(new Headers(observed?.headers).get("authorization")).toBe("Bearer m54-synthetic-owner")
    expect(new Headers(observed?.headers).has("content-type")).toBe(false)
    expect(observed?.body).toBeInstanceOf(FormData)
  })

  test("sends only the fixed correction and boundary link", async () => {
    const bodies: unknown[] = []
    const correctionFetcher = (async (_url: string | URL | Request, init?: RequestInit) => { if (init?.body) bodies.push(JSON.parse(String(init.body))); return Response.json(billFixture) }) as typeof fetch
    await correctSyntheticBill(fixture, billFixture.id, "owner", correctionFetcher)
    const reviewedFixture = { ...billFixture, state: "reviewed", versions: [...billFixture.versions, { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", version: 2, facilityId: fixture.facility.id, electricityKwh: "12346.000", correctionReason: "Synthetic review exercise" }] }
    const linkFetcher = (async (_url: string | URL | Request, init?: RequestInit) => { if (init?.body) bodies.push(JSON.parse(String(init.body))); return Response.json(reviewedFixture) }) as typeof fetch
    await linkSyntheticBill(fixture, billFixture.id, "owner", linkFetcher)
    expect(bodies).toEqual([
      { facilityId: fixture.facility.id, priorVersionId: billFixture.versions[0].id, electricityKwh: "12346.000", reason: "Synthetic review exercise" },
      { boundaryId: fixture.boundary.id, billVersionId: reviewedFixture.versions[1].id },
    ])
  })
})

describe("M56 draft calculation browser boundary", () => {
  test("binds the exact calculation and sends no user-supplied accounting input", async () => {
    expect(decodeSyntheticBill(calculatedFixture)).toEqual(calculatedFixture)
    expect(() => decodeSyntheticBill({ ...calculatedFixture, draftCalculation: { ...calculatedFixture.draftCalculation, total: { ...calculatedFixture.draftCalculation.total, display: "2407.9675" } } })).toThrow("not recognized")
    for (const [path, replacement] of [
      [["draftCalculation", "record", "result", "factor", "source", "workbook_sha256"], "0".repeat(64)],
      [["draftCalculation", "record", "result", "input_snapshot", "parser_version"], "changed"],
      [["draftCalculation", "record", "result", "activity", "quantity"], "99"],
      [["draftCalculation", "record", "result", "gwp_policy", "extra"], true],
      [["draftCalculation", "record", "createdBy"], "99999999-9999-4999-8999-999999999999"],
    ] as const) { const changed = structuredClone(calculatedFixture); setPath(changed, path, replacement); expect(() => decodeSyntheticBill(changed)).toThrow("not recognized") }
    let observed: { url: string; body: unknown } | undefined
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => { observed = { url: String(url), body: init?.body }; return Response.json(calculatedFixture) }) as typeof fetch
    await calculateSyntheticBill(fixture.id, billFixture.id, "owner", fetcher)
    expect(observed?.url).toBe(`/workspace-api/workspace/${fixture.id}/bills/${billFixture.id}/calculate`)
    expect(JSON.parse(String(observed?.body))).toEqual({ idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    await replaySyntheticBillCalculation(fixture.id, billFixture.id, calculatedFixture.draftCalculation.record, "admin", fetcher)
    expect(observed?.url).toBe(`/workspace-api/workspace/${fixture.id}/bills/${billFixture.id}/calculate/replay`)
    expect(JSON.parse(String(observed?.body))).toEqual({ idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/), record: calculatedFixture.draftCalculation.record })
  })
})

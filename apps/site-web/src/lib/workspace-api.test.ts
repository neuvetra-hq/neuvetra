import { describe, expect, test } from "bun:test"
import { ANNUAL_WARNINGS, calculateSyntheticBill, correctSyntheticBill, createSyntheticWorkspace, decideSyntheticInventory, decodeAnnualInventory, decodeAnnualRegister, decodeEvidencePackMetadata, decodeEvidencePackReceipt, decodeSyntheticBill, decodeWorkspace, downloadEvidencePack, INVENTORY_WARNINGS, linkSyntheticBill, prepareSyntheticInventory, replaySyntheticBillCalculation, revisitSyntheticInventory, revisitSyntheticWorkspace, uploadSyntheticBill, type SyntheticInventory } from "./workspace-api"

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

describe("M59 evidence-pack browser boundary",()=>{
  const pack={id:"45454545-4545-4545-8545-454545454545",companyId:fixture.id,inventoryId:"46464646-4646-4646-8646-464646464646",profile:"neuvetra.synthetic.inventory-evidence-pack.v1" as const,manifestSha256:"a".repeat(64),lineageRootSha256:"b".repeat(64),archiveSha256:"c".repeat(64),archiveByteLength:24000,entryCount:17 as const,createdBy:"47474747-4747-4747-8747-474747474747",createdAt:"2026-09-14T12:00:00.000Z"}
  test("accepts exact metadata and reconstruction only",()=>{
    expect(decodeEvidencePackMetadata(pack,{companyId:fixture.id,inventoryId:pack.inventoryId})).toEqual(pack)
    for(const changed of [{...pack,extra:true},{...pack,entryCount:16},{...pack,archiveSha256:"bad"},{...pack,companyId:"48484848-4848-4848-8848-484848484848"}])expect(()=>decodeEvidencePackMetadata(changed,{companyId:fixture.id,inventoryId:pack.inventoryId})).toThrow("not recognized")
    const receipt={status:"verified_match",profile:pack.profile,archiveSha256:pack.archiveSha256,manifestSha256:pack.manifestSha256,lineageRootSha256:pack.lineageRootSha256,entryCount:17,inventoryId:pack.inventoryId,reconstructed:{expected:12,reported:10,estimated:1,excluded:1,missing:0,reportedMwh:"126.788000",reportedKgCo2e:"24728.7681363744",estimatedMwh:"12.493000",estimatedKgCo2e:"2436.6383279784",includedMwh:"139.281000",includedKgCo2e:"27165.4064643528",includedDisplayKgCo2e:"27165.4065"},overallInventoryCompleteness:"incomplete",releaseEligible:false}
    expect(decodeEvidencePackReceipt(receipt,pack)).toEqual(receipt)
    const reversed={...receipt,reconstructed:Object.fromEntries(Object.entries(receipt.reconstructed).reverse())}
    expect(decodeEvidencePackReceipt(reversed,pack)).toEqual(reversed)
    expect(()=>decodeEvidencePackReceipt({...receipt,reconstructed:{...receipt.reconstructed,includedMwh:"0.000000"}},pack)).toThrow("not recognized")
  })
  test("hashes downloaded bytes instead of trusting the response header",async()=>{
    const bytes=new TextEncoder().encode("fixed evidence archive")
    const archiveSha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),byte=>byte.toString(16).padStart(2,"0")).join("")
    const exactPack={...pack,archiveSha256,archiveByteLength:bytes.byteLength}
    const response=(body:Uint8Array)=>new Response(body,{status:200,headers:{"x-neuvetra-archive-sha256":archiveSha256,"content-type":"application/zip"}})
    expect((await downloadEvidencePack(exactPack,"member",(async()=>response(bytes)) as typeof fetch)).size).toBe(bytes.byteLength)
    const changed=bytes.slice();changed[0]^=1
    await expect(downloadEvidencePack(exactPack,"member",(async()=>response(changed)) as typeof fetch)).rejects.toThrow("not recognized")
  })
})

describe("M58 annual register browser boundary",()=>{
  const ids={register:"31313131-3131-4131-8131-313131313131",boundary:"32323232-3232-4232-8232-323232323232",inventory:"33333333-3333-4333-8333-333333333333",facility:"34343434-3434-4434-8434-343434343434",actor:"35353535-3535-4535-8535-353535353535"}
  const months=Array.from({length:12},(_,i)=>`2023-${String(i+1).padStart(2,"0")}`)
  const initial={id:ids.register,companyId:fixture.id,boundaryId:ids.boundary,previousInventoryVersionId:ids.inventory,version:1,reportingYear:2023,facilityId:ids.facility,status:"incomplete",counts:{expected:12,resolved:1,reported:1,estimated:0,excluded:0,missing:11,calculationBearing:1},periods:months.map((month,index)=>index===0?{month,state:"reported",version:1,quantityMwh:"12.346000",emissionsKgCo2e:"2407.9674055248",evidence:{source:"M56 calculation derived from M55 bill version 2",sha256:"a".repeat(64),locator:"service"},reason:null,method:null,formula:null,basisMonths:[]}:{month,state:"missing",version:1,quantityMwh:null,emissionsKgCo2e:null,evidence:null,reason:"awaiting_source",method:null,formula:null,basisMonths:[]}),totals:null,fixtureSha256:null,snapshotSha256:"b".repeat(64),createdBy:ids.actor,createdAt:"2026-09-13T12:00:00.000Z"}
  test("accepts the exact initial denominator and rejects hidden zeroes",()=>{
    expect(decodeAnnualRegister(initial,fixture.id)).toEqual(initial)
    const changed=structuredClone(initial);changed.periods[11]!.quantityMwh="0.000000"
    expect(()=>decodeAnnualRegister(changed,fixture.id)).toThrow("not recognized")
    expect(()=>decodeAnnualRegister(initial,fixture.id,{version:2})).toThrow("not recognized")
    expect(()=>decodeAnnualRegister(initial,fixture.id,{januaryEvidenceSha256:"f".repeat(64)})).toThrow("not recognized")
  })
  test("pins every final evidence locator and exception",()=>{
    const q=["12.346000","11.982000","12.417000","11.876000","12.104000","13.228000","14.037000","13.812000","12.765000","12.221000","12.493000",null]
    const e=["2407.9674055248","2336.9727404016","2421.8152660296","2316.2984697888","2360.7676556352","2579.9929402464","2737.7805338856","2693.8964689056","2489.689286532","2383.5873694248","2436.6383279784",null]
    const hash="44cf813b31bf92a13e15a5432e26cd931355df7ded4684248759a50876dbdc29"
    const periods=months.map((month,index)=>index<10?{month,state:"reported",version:index===0?1:2,quantityMwh:q[index],emissionsKgCo2e:e[index],evidence:index===0?initial.periods[0]!.evidence:{source:"M58 fixed fictional electricity register",sha256:hash,locator:`rows[${index-1}]`},reason:null,method:null,formula:null,basisMonths:[]}:index===10?{month,state:"estimated",version:2,quantityMwh:q[index],emissionsKgCo2e:e[index],evidence:null,reason:"synthetic_november_statement_unavailable",method:"mean_of_prior_two_reported_months_v1",formula:"(12.765000 + 12.221000) / 2",basisMonths:["2023-09","2023-10"]}:{month,state:"excluded",version:2,quantityMwh:null,emissionsKgCo2e:null,evidence:{source:"M58 fixed fictional electricity register",sha256:hash,locator:"closureMemo"},reason:"outside_operational_control_after_lease_end",method:null,formula:null,basisMonths:[]})
    const final={...initial,id:"37373737-3737-4737-8737-373737373737",version:2,status:"resolved_with_exceptions",counts:{expected:12,resolved:12,reported:10,estimated:1,excluded:1,missing:0,calculationBearing:11},periods,totals:{reportedMwh:"126.788000",reportedKgCo2e:"24728.7681363744",reportedDisplayKgCo2e:"24728.7681",estimatedMwh:"12.493000",estimatedKgCo2e:"2436.6383279784",estimatedDisplayKgCo2e:"2436.6383",includedMwh:"139.281000",includedKgCo2e:"27165.4064643528",includedDisplayKgCo2e:"27165.4065"},fixtureSha256:hash}
    expect(decodeAnnualRegister(final,fixture.id,{version:2})).toEqual(final)
    const canonicalOrder={...final,counts:Object.fromEntries(Object.entries(final.counts).reverse()),totals:Object.fromEntries(Object.entries(final.totals).reverse())}
    expect(decodeAnnualRegister(canonicalOrder,fixture.id,{version:2})).toEqual(canonicalOrder)
    const lineage={version:2 as const,previousInventoryVersionId:final.previousInventoryVersionId,boundaryId:final.boundaryId,facilityId:final.facilityId,januaryEvidenceSha256:"a".repeat(64),januaryCalculationId:"41414141-4141-4141-8141-414141414141"}
    const exactFinal={...final,periods:final.periods.map((period,index)=>index===0?{...period,evidence:{source:"M56 calculation derived from M55 bill version 2",sha256:"a".repeat(64),locator:"calculation 41414141-4141-4141-8141-414141414141; service 2023-01-01..2023-01-31"}}:period)}
    expect(decodeAnnualRegister(exactFinal,fixture.id,lineage)).toEqual(exactFinal)
    for(const changed of [{...exactFinal,boundaryId:"42424242-4242-4242-8242-424242424242"},{...exactFinal,facilityId:"43434343-4343-4343-8343-434343434343"},{...exactFinal,previousInventoryVersionId:"44444444-4444-4444-8444-444444444444"},{...exactFinal,periods:exactFinal.periods.map((p,index)=>index===0?{...p,evidence:{...(p.evidence as object),source:"other"}}:p)},{...exactFinal,periods:exactFinal.periods.map((p,index)=>index===0?{...p,evidence:{...(p.evidence as object),locator:"calculation 45454545-4545-4545-8545-454545454545; service 2023-01-01..2023-01-31"}}:p)},{...exactFinal,fixtureSha256:"e".repeat(64)},{...exactFinal,periods:exactFinal.periods.map((p,index)=>index===1?{...p,evidence:{...(p.evidence as object),source:"other"}}:p)},{...exactFinal,periods:exactFinal.periods.map((p,index)=>index===9?{...p,evidence:{...(p.evidence as object),locator:"rows[0]"}}:p)},{...exactFinal,periods:exactFinal.periods.map((p,index)=>index===11?{...p,evidence:{...(p.evidence as object),sha256:"e".repeat(64)}}:p)}]) expect(()=>decodeAnnualRegister(changed,fixture.id,lineage)).toThrow("not recognized")
  })
  test("requires incomplete and unreleased inventory version 2",()=>{
    const totals={reportedMwh:"126.788000",reportedKgCo2e:"24728.7681363744",reportedDisplayKgCo2e:"24728.7681",estimatedMwh:"12.493000",estimatedKgCo2e:"2436.6383279784",estimatedDisplayKgCo2e:"2436.6383",includedMwh:"139.281000",includedKgCo2e:"27165.4064643528",includedDisplayKgCo2e:"27165.4065"}
    const annual={id:ids.inventory,companyId:fixture.id,boundaryId:ids.boundary,previousInventoryVersionId:"36363636-3636-4636-8636-363636363636",registerId:ids.register,registerSnapshotSha256:"c".repeat(64),version:2,reportingYear:2023,scope:"scope_2_location_based",periodResolution:"resolved_with_exceptions",overallInventoryCompleteness:"incomplete",releaseEligible:false,counts:{expected:12,resolved:12,reported:10,estimated:1,excluded:1,missing:0,calculationBearing:11},totals,warnings:[...ANNUAL_WARNINGS],snapshotSha256:"d".repeat(64),submittedBy:ids.actor,submittedAt:"2026-09-13T12:00:00.000Z",decision:null}
    expect(decodeAnnualInventory(annual,fixture.id)).toEqual(annual)
    expect(()=>decodeAnnualInventory({...annual,overallInventoryCompleteness:"complete"},fixture.id)).toThrow("not recognized")
    expect(()=>decodeAnnualInventory({...annual,releaseEligible:true},fixture.id)).toThrow("not recognized")
    const approved={...annual,decision:{id:"38383838-3838-4838-8838-383838383838",decision:"approve_bounded_annual_location_draft",outcome:"approved_bounded_annual_location_draft",reasonCode:"bounded_annual_location_register_reviewed",acknowledgedWarnings:[...ANNUAL_WARNINGS],decidedBy:"39393939-3939-4939-8939-393939393939",decidedAt:"2026-09-13T12:01:00.000Z"}}
    const lineage={inventoryId:annual.id,registerId:annual.registerId,previousInventoryVersionId:annual.previousInventoryVersionId,boundaryId:annual.boundaryId,registerSnapshotSha256:annual.registerSnapshotSha256}
    expect(decodeAnnualInventory(approved,fixture.id,lineage)).toEqual(approved)
    for(const changed of [{...approved,registerId:"46464646-4646-4646-8646-464646464646"},{...approved,previousInventoryVersionId:"47474747-4747-4747-8747-474747474747"},{...approved,boundaryId:"48484848-4848-4848-8848-484848484848"},{...approved,registerSnapshotSha256:"e".repeat(64)}])expect(()=>decodeAnnualInventory(changed,fixture.id,lineage)).toThrow("not recognized")
    for(const changed of [{...approved,decision:{...approved.decision,extra:true}},{...approved,decision:{...approved.decision,outcome:"changes_requested"}},{...approved,decision:{...approved.decision,acknowledgedWarnings:[]}},{...approved,decision:{...approved.decision,decidedBy:annual.submittedBy}},{...approved,decision:{...approved.decision,decidedAt:"later"}}])expect(()=>decodeAnnualInventory(changed,fixture.id)).toThrow("not recognized")
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

describe("M57 inventory review browser boundary", () => {
  const inventory: SyntheticInventory = {
    id: "21212121-2121-4121-8121-212121212121", companyId: fixture.id, boundaryId: fixture.boundary.id, calculationId: calculatedFixture.draftCalculation.id,
    version: 1, reportingYear: 2023, scope: "scope_2_location_based", reviewState: "awaiting_review", completeness: "incomplete", releaseEligible: false,
    coverage: { expectedFacilities: 1, coveredFacilities: 1, expectedPeriods: 12, coveredPeriods: 1, coveredMonths: ["2023-01"], missingMonths: ["2023-02","2023-03","2023-04","2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12"] },
    warnings: [...INVENTORY_WARNINGS], line: { facilityId: fixture.facility.id, servicePeriodStart: "2023-01-01", servicePeriodEnd: "2023-01-31", quantityMwh: "12.346000", subtotalKgCo2e: "2407.9674", calculationResultSha256: "b".repeat(64) },
    snapshotSha256: "d".repeat(64), submittedBy: "11111111-1111-4111-8111-111111111111", submittedAt: "2026-09-13T12:00:00.000Z", decision: null,
  }

  test("accepts the exact incomplete snapshot and sends only bounded commands", async () => {
    const observed: Array<{ url: string; body: unknown }> = []
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => { observed.push({ url: String(url), body: init?.body }); return Response.json(inventory, { status: init?.method === "POST" ? 201 : 200 }) }) as typeof fetch
    expect(await revisitSyntheticInventory(fixture.id, "member", fetcher)).toEqual(inventory)
    await prepareSyntheticInventory(fixture.id, calculatedFixture.draftCalculation.id, "owner", fetcher)
    await decideSyntheticInventory(inventory, "approve_bounded_draft", "admin", fetcher)
    expect(JSON.parse(String(observed[1]!.body))).toEqual({ calculationId: calculatedFixture.draftCalculation.id, idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    expect(JSON.parse(String(observed[2]!.body))).toEqual({ decision: "approve_bounded_draft", expectedInventorySnapshotSha256: inventory.snapshotSha256, acknowledgedWarnings: [...INVENTORY_WARNINGS], reasonCode: "bounded_synthetic_scope_reviewed", idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/) })
  })

  test("rejects completeness, release and warning drift", async () => {
    for (const changed of [
      { ...inventory, completeness: "complete" }, { ...inventory, releaseEligible: true }, { ...inventory, warnings: inventory.warnings.slice(1) },
      { ...inventory, coverage: { ...inventory.coverage, coveredPeriods: 12 } }, { ...inventory, line: { ...inventory.line, subtotalKgCo2e: "2407.9675" } },
      { ...inventory, injected: true }, { ...inventory, coverage: { ...inventory.coverage, injected: true } },
      { ...inventory, coverage: { ...inventory.coverage, missingMonths: ["2023-02", "2023-03", "2023-04", "2023-05", "2023-06", "2023-07", "2023-08", "2023-09", "2023-10", "2023-11", "2024-01"] } },
      { ...inventory, submittedAt: "sometime" }, { ...inventory, companyId: "99999999-9999-4999-8999-999999999999" },
    ]) {
      const fetcher = (async () => Response.json(changed)) as typeof fetch
      await expect(revisitSyntheticInventory(fixture.id, "owner", fetcher)).rejects.toThrow("not recognized")
    }
  })

  test("accepts only an exact two-person immutable decision", async () => {
    const approved = { ...inventory, reviewState: "approved_bounded_draft" as const, decision: { id: "23232323-2323-4323-8323-232323232323", decision: "approve_bounded_draft" as const, outcome: "approved_bounded_draft" as const, acknowledgedWarnings: [...INVENTORY_WARNINGS], reasonCode: "bounded_synthetic_scope_reviewed", decidedBy: "22222222-2222-4222-8222-222222222222", decidedAt: "2026-09-13T12:01:00.000Z" } }
    const fetcher = (value: unknown) => (async () => Response.json(value)) as typeof fetch
    expect(await revisitSyntheticInventory(fixture.id, "member", fetcher(approved))).toEqual(approved)
    for (const changed of [
      { ...approved, decision: { ...approved.decision, extra: true } },
      { ...approved, decision: { ...approved.decision, decision: "changes_requested" } },
      { ...approved, decision: { ...approved.decision, reasonCode: "source_or_calculation_revision_required" } },
      { ...approved, decision: { ...approved.decision, acknowledgedWarnings: [] } },
      { ...approved, decision: { ...approved.decision, decidedBy: inventory.submittedBy } },
      { ...approved, decision: { ...approved.decision, decidedAt: "tomorrow" } },
    ]) await expect(revisitSyntheticInventory(fixture.id, "member", fetcher(changed))).rejects.toThrow("not recognized")
  })
})

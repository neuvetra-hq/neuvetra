export interface CompanyWorkspace {
  id: string
  companyName: "Synthetic Acme, Inc."
  countryCode: "US"
  stateCode: "CA"
  facility: {
    id: string
    name: "Synthetic California office"
    egridSubregion: "CAMX"
  }
  boundary: {
    id: string
    reportingYear: 2023
    approach: "operational_control"
    status: "draft"
    version: 1
  }
}

export type WorkspaceActor = "owner" | "admin" | "member" | "outsider" | "signed_out"

export interface SyntheticBill {
  id: string
  companyId: string
  originalName: "neuvetra-m55-synthetic-electricity-bill.pdf"
  mediaType: "application/pdf"
  byteLength: 4605
  sha256: "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135"
  parserVersion: "m55-fixed-pdf-v1"
  supplierName: "Synthetic Golden State Electric"
  accountLabel: "SYNTHETIC-0001"
  billNumber: "SYN-CA-2023-01"
  servicePeriodStart: "2023-01-01"
  servicePeriodEnd: "2023-01-31"
  sourceLocators: {
    servicePeriod: { startByte: 3119; endByte: 3147 }
    electricityKwh: { startByte: 3384; endByte: 3394 }
  }
  state: "needs_review" | "reviewed" | "linked_draft"
  versions: Array<{
    id: string
    version: number
    facilityId: string | null
    electricityKwh: string
    correctionReason: string | null
  }>
  draftActivity: null | {
    id: string
    billVersionId: string
    quantityMwh: string
    status: "draft"
  }
  draftCalculation: null | {
    id: string; activityVersionId: string; billVersionId: string; evidenceId: string; facilityId: string; boundaryId: string
    billVersion: 2; sourceQuantityKwh: "12346.000"; normalizedQuantityMwh: "12.346000"; status: "draft"; classification: "development_candidate"; releaseEligible: false
    method: { id: "scope2-location-based-egrid-subregion"; version: "2023-r2-camx-v1"; implementationSha256: string; reviewedEngineSha256: string; authorityRecordSha256: string }
    factor: { id: "epa-egrid2023-r2-camx-total-output"; version: "eGRID2023-revision-2"; candidateSha256: string; sourceSha256: string; sheet: "SRL23"; totalOutputCell: "AI6"; value: "195.0402888" }
    gwpPolicy: { id: "epa-egrid2023-ar5-100-year"; version: "egrid2023-technical-guide-v1"; policySha256: string }
    inputSnapshotSha256: string; resultPayloadSha256: string
    total: { unrounded: "2407.9674055248"; display: "2407.9674"; unit: "kg CO2e"; rounding: string }
    gasResults: Record<string, unknown>
    reconciliation: { authority: string; componentSum: "2407.8330020304"; componentRoundingDelta: "0.1344034944"; explanation: string }
    trace: Array<Record<string, unknown>>
    billVersionPayloadSha256: string; createdBy: string; createdAt: string
    record: Record<string, unknown>
  }
}

const TOKENS = {
  owner: "m54-synthetic-owner",
  admin: "m55-synthetic-admin",
  member: "m55-synthetic-member",
  outsider: "m54-synthetic-outsider",
} as const

const input = {
  companyName: "Synthetic Acme, Inc.",
  facilityName: "Synthetic California office",
  countryCode: "US",
  stateCode: "CA",
  egridSubregion: "CAMX",
  reportingYear: 2023,
  approach: "operational_control",
} as const

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|")
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function decodeWorkspace(value: unknown): CompanyWorkspace {
  if (!object(value) || !exactKeys(value, ["id", "companyName", "countryCode", "stateCode", "facility", "boundary"])) throw new Error("The workspace response was not recognized.")
  if (!uuid(value.id) || value.companyName !== input.companyName || value.countryCode !== "US" || value.stateCode !== "CA") throw new Error("The workspace response was not recognized.")
  if (!object(value.facility) || !exactKeys(value.facility, ["id", "name", "egridSubregion"]) || !uuid(value.facility.id) || value.facility.name !== input.facilityName || value.facility.egridSubregion !== "CAMX") throw new Error("The workspace response was not recognized.")
  if (!object(value.boundary) || !exactKeys(value.boundary, ["id", "reportingYear", "approach", "status", "version"]) || !uuid(value.boundary.id) || value.boundary.reportingYear !== 2023 || value.boundary.approach !== "operational_control" || value.boundary.status !== "draft" || value.boundary.version !== 1) throw new Error("The workspace response was not recognized.")
  return value as unknown as CompanyWorkspace
}

export function decodeSyntheticBill(value: unknown): SyntheticBill {
  if (!object(value) || !exactKeys(value, ["id", "companyId", "originalName", "mediaType", "byteLength", "sha256", "parserVersion", "supplierName", "accountLabel", "billNumber", "servicePeriodStart", "servicePeriodEnd", "sourceLocators", "state", "versions", "draftActivity", "draftCalculation"])) throw new Error("The bill response was not recognized.")
  if (!uuid(value.id) || !uuid(value.companyId) || value.originalName !== "neuvetra-m55-synthetic-electricity-bill.pdf" || value.mediaType !== "application/pdf" || value.byteLength !== 4605 || value.sha256 !== "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135" || value.parserVersion !== "m55-fixed-pdf-v1" || value.supplierName !== "Synthetic Golden State Electric" || value.accountLabel !== "SYNTHETIC-0001" || value.billNumber !== "SYN-CA-2023-01" || value.servicePeriodStart !== "2023-01-01" || value.servicePeriodEnd !== "2023-01-31" || !["needs_review", "reviewed", "linked_draft"].includes(String(value.state)) || !Array.isArray(value.versions)) throw new Error("The bill response was not recognized.")
  if (!object(value.sourceLocators) || !exactKeys(value.sourceLocators, ["servicePeriod", "electricityKwh"])) throw new Error("The bill response was not recognized.")
  for (const [locator, startByte, endByte] of [[value.sourceLocators.servicePeriod, 3119, 3147], [value.sourceLocators.electricityKwh, 3384, 3394]] as const) if (!object(locator) || !exactKeys(locator, ["startByte", "endByte"]) || locator.startByte !== startByte || locator.endByte !== endByte) throw new Error("The bill response was not recognized.")
  for (const version of value.versions) {
    if (!object(version) || !exactKeys(version, ["id", "version", "facilityId", "electricityKwh", "correctionReason"]) || !uuid(version.id) || !Number.isInteger(version.version) || (version.facilityId !== null && !uuid(version.facilityId)) || typeof version.electricityKwh !== "string" || (version.correctionReason !== null && typeof version.correctionReason !== "string")) throw new Error("The bill response was not recognized.")
  }
  if (value.draftActivity !== null && (!object(value.draftActivity) || !exactKeys(value.draftActivity, ["id", "billVersionId", "quantityMwh", "status"]) || !uuid(value.draftActivity.id) || !uuid(value.draftActivity.billVersionId) || typeof value.draftActivity.quantityMwh !== "string" || value.draftActivity.status !== "draft")) throw new Error("The bill response was not recognized.")
  if (value.draftCalculation !== null) {
    const calculation = value.draftCalculation
    if (!object(calculation) || !exactKeys(calculation, ["id", "activityVersionId", "billVersionId", "evidenceId", "facilityId", "boundaryId", "billVersion", "sourceQuantityKwh", "normalizedQuantityMwh", "status", "classification", "releaseEligible", "method", "factor", "gwpPolicy", "inputSnapshotSha256", "resultPayloadSha256", "total", "gasResults", "reconciliation", "trace", "billVersionPayloadSha256", "createdBy", "createdAt", "record"])) throw new Error("The calculation response was not recognized.")
    for (const id of [calculation.id, calculation.activityVersionId, calculation.billVersionId, calculation.evidenceId, calculation.facilityId, calculation.boundaryId]) if (!uuid(id)) throw new Error("The calculation response was not recognized.")
    if (calculation.evidenceId !== value.id || calculation.billVersion !== 2 || calculation.sourceQuantityKwh !== "12346.000" || calculation.normalizedQuantityMwh !== "12.346000" || calculation.status !== "draft" || calculation.classification !== "development_candidate" || calculation.releaseEligible !== false) throw new Error("The calculation response was not recognized.")
    if (!object(calculation.method) || !exactKeys(calculation.method, ["id", "version", "implementationSha256", "reviewedEngineSha256", "authorityRecordSha256"]) || calculation.method.id !== "scope2-location-based-egrid-subregion" || calculation.method.version !== "2023-r2-camx-v1" || calculation.method.implementationSha256 !== "ae03b9146060187c63b6f3b8a253fbd61cd4f97a9aa97905481904eca45b061e" || calculation.method.reviewedEngineSha256 !== "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c" || calculation.method.authorityRecordSha256 !== "9c63b2cb12fa2708f35d394e537ca5803e27f91c4647f33376abf75a6fb72b91") throw new Error("The calculation response was not recognized.")
    if (!object(calculation.factor) || !exactKeys(calculation.factor, ["id", "version", "candidateSha256", "sourceSha256", "sheet", "totalOutputCell", "value"]) || calculation.factor.id !== "epa-egrid2023-r2-camx-total-output" || calculation.factor.version !== "eGRID2023-revision-2" || calculation.factor.candidateSha256 !== "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356" || calculation.factor.sourceSha256 !== "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab" || calculation.factor.sheet !== "SRL23" || calculation.factor.totalOutputCell !== "AI6" || calculation.factor.value !== "195.0402888") throw new Error("The calculation response was not recognized.")
    if (!object(calculation.gwpPolicy) || !exactKeys(calculation.gwpPolicy, ["id", "version", "policySha256"]) || calculation.gwpPolicy.id !== "epa-egrid2023-ar5-100-year" || calculation.gwpPolicy.version !== "egrid2023-technical-guide-v1" || calculation.gwpPolicy.policySha256 !== "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5") throw new Error("The calculation response was not recognized.")
    if (!/^[0-9a-f]{64}$/.test(String(calculation.inputSnapshotSha256)) || !/^[0-9a-f]{64}$/.test(String(calculation.resultPayloadSha256)) || !/^[0-9a-f]{64}$/.test(String(calculation.billVersionPayloadSha256)) || !uuid(calculation.createdBy) || typeof calculation.createdAt !== "string" || !Number.isFinite(Date.parse(calculation.createdAt)) || !object(calculation.total) || !exactKeys(calculation.total, ["unrounded", "display", "unit", "rounding"]) || calculation.total.unrounded !== "2407.9674055248" || calculation.total.display !== "2407.9674" || calculation.total.unit !== "kg CO2e" || calculation.total.rounding !== "four decimal places; ROUND_HALF_EVEN; no intermediate rounding" || !object(calculation.reconciliation) || !exactKeys(calculation.reconciliation, ["authority", "componentSum", "componentRoundingDelta", "explanation"]) || calculation.reconciliation.authority !== "published total-output CO2e rate in AI6" || calculation.reconciliation.componentSum !== "2407.8330020304" || calculation.reconciliation.componentRoundingDelta !== "0.1344034944" || calculation.reconciliation.explanation !== "EPA publishes the gas-specific rates as rounded columns. They remain inspection values and are not substituted for the published AI6 total-output rate." || !Array.isArray(calculation.trace) || calculation.trace.length !== 4 || !object(calculation.gasResults) || !object(calculation.record)) throw new Error("The calculation response was not recognized.")
    const gases = calculation.gasResults
    const expectedGases = { co2: ["2399.4607843584", "kg CO2", "2399.4607843584"], ch4: ["0.14000364", "kg CH4", "3.92010192"], n2o: ["0.0168004368", "kg N2O", "4.452115752"] } as const
    for (const gas of ["co2", "ch4", "n2o"] as const) { const item = gases[gas]; const expected = expectedGases[gas]; if (!object(item) || !exactKeys(item, ["mass", "mass_unit", "co2e", "co2e_unit"]) || item.mass !== expected[0] || item.mass_unit !== expected[1] || item.co2e !== expected[2] || item.co2e_unit !== "kg CO2e") throw new Error("The calculation response was not recognized.") }
    const expectedTrace = [["reviewed_bill_conversion", "12346.000 / 1000", "12.346000", "MWh"], ["published_total_output", "12.346000 * 195.0402888", "2407.9674055248", "kg CO2e"], ["component_sum_reference", "2399.4607843584 + 3.92010192 + 4.452115752", "2407.8330020304", "kg CO2e"], ["published_rate_rounding_delta", "2407.9674055248 - 2407.8330020304", "0.1344034944", "kg CO2e"]]
    for (let index = 0; index < expectedTrace.length; index += 1) { const item = calculation.trace[index]; const expected = expectedTrace[index]!; if (!object(item) || !exactKeys(item, ["step", "expression", "result", "unit"]) || item.step !== expected[0] || item.expression !== expected[1] || item.result !== expected[2] || item.unit !== expected[3]) throw new Error("The calculation response was not recognized.") }
    const envelope = calculation.record
    if (!exactKeys(envelope, ["calculationId", "billVersionPayloadSha256", "createdBy", "createdAt", "result"]) || envelope.calculationId !== calculation.id || envelope.billVersionPayloadSha256 !== calculation.billVersionPayloadSha256 || envelope.createdBy !== calculation.createdBy || envelope.createdAt !== calculation.createdAt || !object(envelope.result)) throw new Error("The calculation response was not recognized.")
    const record = envelope.result
    if (!exactKeys(record, ["contract_version", "status", "classification", "input_snapshot", "input_snapshot_sha256", "activity", "method", "factor", "gwp_policy", "conversion", "gas_results", "trace", "total", "reconciliation", "result_payload_sha256"]) || record.contract_version !== "m56-linked-bill-calculation-result-v1" || record.status !== "calculated" || record.result_payload_sha256 !== calculation.resultPayloadSha256 || record.input_snapshot_sha256 !== calculation.inputSnapshotSha256 || !object(record.input_snapshot) || !exactKeys(record.input_snapshot, ["company_id", "evidence_id", "bill_version_id", "activity_version_id", "facility_id", "boundary_id", "extraction_id", "parser_version", "previous_bill_version_id", "activity_version", "bill_version", "evidence_sha256", "source_quantity_kwh", "normalized_quantity_mwh", "correction_reason", "service_period", "facility", "boundary"]) || record.input_snapshot.company_id !== value.companyId || record.input_snapshot.bill_version_id !== calculation.billVersionId || record.input_snapshot.activity_version_id !== calculation.activityVersionId || record.input_snapshot.evidence_id !== calculation.evidenceId || record.input_snapshot.facility_id !== calculation.facilityId || record.input_snapshot.boundary_id !== calculation.boundaryId || record.input_snapshot.evidence_sha256 !== value.sha256 || record.input_snapshot.parser_version !== "m55-fixed-pdf-v1" || record.input_snapshot.activity_version !== 1 || record.input_snapshot.bill_version !== 2 || record.input_snapshot.source_quantity_kwh !== "12346.000" || record.input_snapshot.normalized_quantity_mwh !== "12.346000" || record.input_snapshot.correction_reason !== "Synthetic review exercise") throw new Error("The calculation response was not recognized.")
    if (!object(record.input_snapshot.service_period) || !exactKeys(record.input_snapshot.service_period, ["start", "end"]) || record.input_snapshot.service_period.start !== "2023-01-01" || record.input_snapshot.service_period.end !== "2023-01-31" || !object(record.input_snapshot.facility) || !exactKeys(record.input_snapshot.facility, ["name", "country", "state", "egrid_subregion"]) || record.input_snapshot.facility.name !== "Synthetic California office" || record.input_snapshot.facility.country !== "United States" || record.input_snapshot.facility.state !== "California" || record.input_snapshot.facility.egrid_subregion !== "CAMX" || !object(record.input_snapshot.boundary) || !exactKeys(record.input_snapshot.boundary, ["reporting_year", "approach", "status", "version"]) || record.input_snapshot.boundary.reporting_year !== 2023 || record.input_snapshot.boundary.approach !== "operational_control" || record.input_snapshot.boundary.status !== "draft" || record.input_snapshot.boundary.version !== 1) throw new Error("The calculation response was not recognized.")
    if (JSON.stringify(record.total) !== JSON.stringify(calculation.total) || JSON.stringify(record.gas_results) !== JSON.stringify(calculation.gasResults) || JSON.stringify(record.trace) !== JSON.stringify(calculation.trace) || !object(record.reconciliation) || record.reconciliation.authority !== calculation.reconciliation.authority || record.reconciliation.component_sum !== calculation.reconciliation.componentSum || record.reconciliation.component_rounding_delta !== calculation.reconciliation.componentRoundingDelta || record.reconciliation.explanation !== calculation.reconciliation.explanation) throw new Error("The calculation response was not recognized.")
    if (!object(record.classification) || !exactKeys(record.classification, ["factor", "runtime", "release_eligible"]) || record.classification.factor !== "development_candidate" || record.classification.runtime !== "not_released" || record.classification.release_eligible !== false || !object(record.activity) || !exactKeys(record.activity, ["asset_id", "boundary_id", "electricity", "geography", "activity_period", "factor_data_year", "quantity", "unit"]) || record.activity.asset_id !== calculation.facilityId || record.activity.boundary_id !== calculation.boundaryId || record.activity.electricity !== "Grid-delivered purchased electricity" || record.activity.factor_data_year !== "2023" || record.activity.quantity !== "12.346000" || record.activity.unit !== "MWh" || !object(record.conversion) || !exactKeys(record.conversion, ["id", "expression", "source", "result"]) || record.conversion.id !== "exact-kwh-to-mwh-v1" || record.conversion.expression !== "12346.000 / 1000" || record.conversion.source !== "12346.000 kWh" || record.conversion.result !== "12.346000 MWh") throw new Error("The calculation response was not recognized.")
    if (!object(record.activity.geography) || !exactKeys(record.activity.geography, ["country", "state", "egrid_subregion"]) || record.activity.geography.country !== "United States" || record.activity.geography.state !== "California" || record.activity.geography.egrid_subregion !== "CAMX" || !object(record.activity.activity_period) || !exactKeys(record.activity.activity_period, ["start", "end"]) || record.activity.activity_period.start !== "2023-01-01" || record.activity.activity_period.end !== "2023-01-31") throw new Error("The calculation response was not recognized.")
    if (!object(record.method) || !exactKeys(record.method, ["id", "version", "adapter_implementation_sha256", "reviewed_engine_sha256", "authority_record_sha256", "formula"]) || record.method.id !== calculation.method.id || record.method.version !== calculation.method.version || record.method.adapter_implementation_sha256 !== calculation.method.implementationSha256 || record.method.reviewed_engine_sha256 !== calculation.method.reviewedEngineSha256 || record.method.authority_record_sha256 !== calculation.method.authorityRecordSha256 || record.method.formula !== "MWh × published eGRID subregion total-output CO2e rate" || !object(record.factor) || !exactKeys(record.factor, ["id", "version", "status", "release_eligible", "data_year", "geography", "components", "total_output_co2e", "source", "candidate_sha256"]) || record.factor.id !== calculation.factor.id || record.factor.version !== calculation.factor.version || record.factor.candidate_sha256 !== calculation.factor.candidateSha256 || record.factor.status !== "development_candidate" || record.factor.release_eligible !== false || record.factor.data_year !== "2023" || !object(record.factor.source) || record.factor.source.workbook_sha256 !== calculation.factor.sourceSha256 || record.factor.source.sheet !== "SRL23" || !object(record.factor.total_output_co2e) || record.factor.total_output_co2e.cell !== "AI6" || record.factor.total_output_co2e.value !== "195.0402888" || record.factor.total_output_co2e.unit !== "kg CO2e/MWh" || !object(record.gwp_policy) || !exactKeys(record.gwp_policy, ["id", "version", "assessment", "time_horizon_years", "values", "source", "policy_sha256"]) || record.gwp_policy.id !== calculation.gwpPolicy.id || record.gwp_policy.version !== calculation.gwpPolicy.version || record.gwp_policy.policy_sha256 !== calculation.gwpPolicy.policySha256 || record.gwp_policy.assessment !== "IPCC AR5 without climate-carbon feedbacks" || record.gwp_policy.time_horizon_years !== "100" || !object(record.gwp_policy.values) || !exactKeys(record.gwp_policy.values, ["co2", "ch4", "n2o"]) || record.gwp_policy.values.co2 !== "1" || record.gwp_policy.values.ch4 !== "28" || record.gwp_policy.values.n2o !== "265") throw new Error("The calculation response was not recognized.")
    if (!exactKeys(record.factor.total_output_co2e, ["value", "unit", "cell"]) || !object(record.factor.geography) || !exactKeys(record.factor.geography, ["country", "state", "egrid_subregion", "name"]) || record.factor.geography.country !== "United States" || record.factor.geography.state !== "California" || record.factor.geography.egrid_subregion !== "CAMX" || record.factor.geography.name !== "WECC California" || !object(record.factor.components) || !exactKeys(record.factor.components, ["co2", "ch4", "n2o"]) || !object(record.factor.source) || !exactKeys(record.factor.source, ["publisher", "title", "workbook_sha256", "sheet", "table", "row_cells", "header_cells", "publisher_url", "rights_status"]) || record.factor.source.publisher !== "U.S. Environmental Protection Agency" || record.factor.source.title !== "eGRID2023 metric data file, revision 2" || record.factor.source.table !== "eGRID subregion annual total output emission rates" || record.factor.source.publisher_url !== "https://www.epa.gov/egrid/detailed-data" || record.factor.source.rights_status !== "federal_public_data_commercial_use_citation_reviewed; method_release_pending" || JSON.stringify(record.factor.source.row_cells) !== JSON.stringify(["A6", "B6", "C6", "AC6", "AE6", "AG6", "AI6"]) || JSON.stringify(record.factor.source.header_cells) !== JSON.stringify(["A1", "B1", "C1", "AC1", "AE1", "AG1", "AI1"])) throw new Error("The calculation response was not recognized.")
    const componentExpected = { co2: ["194.3512704", "kg CO2/MWh", "AC6"], ch4: ["0.01134", "kg CH4/MWh", "AE6"], n2o: ["0.0013608", "kg N2O/MWh", "AG6"] } as const
    for (const gas of ["co2", "ch4", "n2o"] as const) { const item = record.factor.components[gas]; const expected = componentExpected[gas]; if (!object(item) || !exactKeys(item, ["value", "unit", "cell"]) || item.value !== expected[0] || item.unit !== expected[1] || item.cell !== expected[2]) throw new Error("The calculation response was not recognized.") }
    if (!object(record.gwp_policy.source) || !exactKeys(record.gwp_policy.source, ["publisher", "title", "page", "section", "publisher_url"]) || record.gwp_policy.source.publisher !== "U.S. Environmental Protection Agency" || record.gwp_policy.source.title !== "Technical Guide for eGRID2023" || record.gwp_policy.source.page !== "12" || record.gwp_policy.source.section !== "3.1.1.2 Annual Emission Estimates for CH4, N2O, and CO2 equivalent" || record.gwp_policy.source.publisher_url !== "https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf") throw new Error("The calculation response was not recognized.")
  }
  const versions = value.versions as Array<Record<string, unknown>>
  if (versions.length < 1 || versions.length > 2 || versions[0]?.version !== 1 || versions[0]?.facilityId !== null || versions[0]?.electricityKwh !== "12345.000" || versions[0]?.correctionReason !== null) throw new Error("The bill response was not recognized.")
  if (value.state === "needs_review" && (versions.length !== 1 || value.draftActivity !== null)) throw new Error("The bill response was not recognized.")
  if ((value.state === "reviewed" || value.state === "linked_draft") && (versions.length !== 2 || versions[1]?.version !== 2 || !uuid(versions[1]?.facilityId) || versions[1]?.electricityKwh !== "12346.000" || versions[1]?.correctionReason !== "Synthetic review exercise")) throw new Error("The bill response was not recognized.")
  if (value.state === "reviewed" && value.draftActivity !== null) throw new Error("The bill response was not recognized.")
  if (value.state === "linked_draft" && (!object(value.draftActivity) || value.draftActivity.billVersionId !== versions[1]?.id || value.draftActivity.quantityMwh !== "12.346000")) throw new Error("The bill response was not recognized.")
  if (object(value.draftCalculation) && (!object(value.draftActivity) || value.draftCalculation.activityVersionId !== value.draftActivity.id || value.draftCalculation.billVersionId !== value.draftActivity.billVersionId)) throw new Error("The calculation response was not recognized.")
  return value as unknown as SyntheticBill
}

function authorization(actor: WorkspaceActor, contentType = false) {
  const headers = new Headers()
  if (contentType) headers.set("content-type", "application/json")
  if (actor !== "signed_out") headers.set("authorization", `Bearer ${TOKENS[actor]}`)
  return headers
}

async function decodeResponse(response: Response) {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (object(body) && typeof body.error === "string") throw new Error(body.error)
    throw new Error("The workspace is unavailable.")
  }
  return decodeWorkspace(body)
}

async function decodeBillResponse(response: Response) {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (object(body) && typeof body.error === "string") throw new Error(body.error)
    throw new Error("The bill evidence is unavailable.")
  }
  return decodeSyntheticBill(body)
}

export async function createSyntheticWorkspace(actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  const response = await fetcher("/workspace-api/workspace", {
    method: "POST",
    headers: authorization(actor, true),
    body: JSON.stringify(input),
  })
  return decodeResponse(response)
}

export async function revisitSyntheticWorkspace(workspaceId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  if (!uuid(workspaceId)) throw new Error("The saved workspace identifier is invalid.")
  const response = await fetcher(`/workspace-api/workspace/${workspaceId}`, { headers: authorization(actor) })
  return decodeResponse(response)
}

export async function uploadSyntheticBill(workspaceId: string, actor: WorkspaceActor, file: File, fetcher: typeof fetch = fetch) {
  if (!uuid(workspaceId)) throw new Error("The saved workspace identifier is invalid.")
  const body = new FormData()
  body.set("file", file)
  return decodeBillResponse(await fetcher(`/workspace-api/workspace/${workspaceId}/bills`, { method: "POST", headers: authorization(actor), body }))
}

export async function revisitSyntheticBill(workspaceId: string, evidenceId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  if (!uuid(workspaceId) || !uuid(evidenceId)) throw new Error("The saved bill identifier is invalid.")
  return decodeBillResponse(await fetcher(`/workspace-api/workspace/${workspaceId}/bills/${evidenceId}`, { headers: authorization(actor) }))
}

export async function correctSyntheticBill(workspace: CompanyWorkspace, evidenceId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  const current = await revisitSyntheticBill(workspace.id, evidenceId, actor, fetcher)
  return decodeBillResponse(await fetcher(`/workspace-api/workspace/${workspace.id}/bills/${evidenceId}/corrections`, {
    method: "POST", headers: authorization(actor, true),
    body: JSON.stringify({ facilityId: workspace.facility.id, priorVersionId: current.versions[0]!.id, electricityKwh: "12346.000", reason: "Synthetic review exercise" }),
  }))
}

export async function linkSyntheticBill(workspace: CompanyWorkspace, evidenceId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  const current = await revisitSyntheticBill(workspace.id, evidenceId, actor, fetcher)
  return decodeBillResponse(await fetcher(`/workspace-api/workspace/${workspace.id}/bills/${evidenceId}/link`, {
    method: "POST", headers: authorization(actor, true), body: JSON.stringify({ boundaryId: workspace.boundary.id, billVersionId: current.versions.find((version) => version.version === 2)?.id }),
  }))
}

export async function calculateSyntheticBill(workspaceId: string, evidenceId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  if (!uuid(workspaceId) || !uuid(evidenceId)) throw new Error("The saved bill identifier is invalid.")
  return decodeBillResponse(await fetcher(`/workspace-api/workspace/${workspaceId}/bills/${evidenceId}/calculate`, {
    method: "POST", headers: authorization(actor, true), body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
  }))
}

export async function replaySyntheticBillCalculation(workspaceId: string, evidenceId: string, record: Record<string, unknown>, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  if (!uuid(workspaceId) || !uuid(evidenceId)) throw new Error("The saved bill identifier is invalid.")
  return decodeBillResponse(await fetcher(`/workspace-api/workspace/${workspaceId}/bills/${evidenceId}/calculate/replay`, {
    method: "POST", headers: authorization(actor, true), body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), record }),
  }))
}

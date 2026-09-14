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
export const INVENTORY_WARNINGS = ["annual_coverage_incomplete_1_of_12_months", "market_based_scope2_not_included", "factor_and_method_not_released", "synthetic_local_only_no_assurance"] as const
export interface SyntheticInventory {
  id: string; companyId: string; boundaryId: string; calculationId: string; version: 1; reportingYear: 2023; scope: "scope_2_location_based"
  reviewState: "awaiting_review" | "approved_bounded_draft" | "changes_requested"; completeness: "incomplete"; releaseEligible: false
  coverage: { expectedFacilities: 1; coveredFacilities: 1; expectedPeriods: 12; coveredPeriods: 1; coveredMonths: ["2023-01"]; missingMonths: string[] }
  warnings: string[]; line: { facilityId: string; servicePeriodStart: "2023-01-01"; servicePeriodEnd: "2023-01-31"; quantityMwh: "12.346000"; subtotalKgCo2e: "2407.9674"; calculationResultSha256: string }
  snapshotSha256: string; submittedBy: string; submittedAt: string
  decision: null | { id: string; decision: "approve_bounded_draft" | "changes_requested"; outcome: "approved_bounded_draft" | "changes_requested"; acknowledgedWarnings: string[]; reasonCode: string; decidedBy: string; decidedAt: string }
}

export const ANNUAL_WARNINGS = ["one_period_estimated", "one_period_excluded", "market_based_scope2_not_included", "factor_and_method_not_released", "scope_1_and_scope_3_not_assessed", "synthetic_local_only_no_assurance"] as const
export interface AnnualPeriod { month: string; state: "missing" | "reported" | "estimated" | "excluded"; version: 1 | 2; quantityMwh: string | null; emissionsKgCo2e: string | null; evidence: null | { source: string; sha256: string; locator: string }; reason: string | null; method: string | null; formula: string | null; basisMonths: string[] }
export interface AnnualRegister { id: string; companyId: string; boundaryId: string; previousInventoryVersionId: string; version: 1 | 2; reportingYear: 2023; facilityId: string; status: "incomplete" | "resolved_with_exceptions"; counts: { expected: 12; resolved: number; reported: number; estimated: number; excluded: number; missing: number; calculationBearing: number }; periods: AnnualPeriod[]; totals: null | { reportedMwh: "126.788000"; reportedKgCo2e: "24728.7681363744"; reportedDisplayKgCo2e: "24728.7681"; estimatedMwh: "12.493000"; estimatedKgCo2e: "2436.6383279784"; estimatedDisplayKgCo2e: "2436.6383"; includedMwh: "139.281000"; includedKgCo2e: "27165.4064643528"; includedDisplayKgCo2e: "27165.4065" }; fixtureSha256: string | null; snapshotSha256: string; createdBy: string; createdAt: string }
export interface AnnualInventory { id: string; companyId: string; boundaryId: string; previousInventoryVersionId: string; registerId: string; registerSnapshotSha256: string; version: 2; reportingYear: 2023; scope: "scope_2_location_based"; periodResolution: "resolved_with_exceptions"; overallInventoryCompleteness: "incomplete"; releaseEligible: false; counts: { expected: 12; resolved: 12; reported: 10; estimated: 1; excluded: 1; missing: 0; calculationBearing: 11 }; totals: NonNullable<AnnualRegister["totals"]>; warnings: string[]; snapshotSha256: string; submittedBy: string; submittedAt: string; decision: null | { id: string; decision: "approve_bounded_annual_location_draft" | "changes_requested"; outcome: "approved_bounded_annual_location_draft" | "changes_requested"; reasonCode: string; acknowledgedWarnings: string[]; decidedBy: string; decidedAt: string } }
export interface EvidencePackMetadata {id:string;companyId:string;inventoryId:string;profile:"neuvetra.synthetic.inventory-evidence-pack.v1";manifestSha256:string;lineageRootSha256:string;archiveSha256:string;archiveByteLength:number;entryCount:17;createdBy:string;createdAt:string}
export interface EvidencePackReceipt {status:"verified_match";profile:"neuvetra.synthetic.inventory-evidence-pack.v1";archiveSha256:string;manifestSha256:string;lineageRootSha256:string;entryCount:17;inventoryId:string;reconstructed:{expected:12;reported:10;estimated:1;excluded:1;missing:0;reportedMwh:"126.788000";reportedKgCo2e:"24728.7681363744";estimatedMwh:"12.493000";estimatedKgCo2e:"2436.6383279784";includedMwh:"139.281000";includedKgCo2e:"27165.4064643528";includedDisplayKgCo2e:"27165.4065"};overallInventoryCompleteness:"incomplete";releaseEligible:false}

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

const MISSING_INVENTORY_MONTHS = ["2023-02", "2023-03", "2023-04", "2023-05", "2023-06", "2023-07", "2023-08", "2023-09", "2023-10", "2023-11", "2023-12"] as const

function instant(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value))
}

function decodeInventory(value: unknown, expected: { companyId?: string; calculationId?: string; inventoryId?: string } = {}): SyntheticInventory {
  if (!object(value) || !exactKeys(value, ["id", "companyId", "boundaryId", "calculationId", "version", "reportingYear", "scope", "reviewState", "completeness", "releaseEligible", "coverage", "warnings", "line", "snapshotSha256", "submittedBy", "submittedAt", "decision"]) || !uuid(value.id) || !uuid(value.companyId) || !uuid(value.boundaryId) || !uuid(value.calculationId) || value.version !== 1 || value.reportingYear !== 2023 || value.scope !== "scope_2_location_based" || !["awaiting_review", "approved_bounded_draft", "changes_requested"].includes(String(value.reviewState)) || value.completeness !== "incomplete" || value.releaseEligible !== false) throw new Error("The inventory response was not recognized.")
  if ((expected.companyId && value.companyId !== expected.companyId) || (expected.calculationId && value.calculationId !== expected.calculationId) || (expected.inventoryId && value.id !== expected.inventoryId)) throw new Error("The inventory response was not recognized.")
  if (!object(value.coverage) || !exactKeys(value.coverage, ["expectedFacilities", "coveredFacilities", "expectedPeriods", "coveredPeriods", "coveredMonths", "missingMonths"]) || value.coverage.expectedFacilities !== 1 || value.coverage.coveredFacilities !== 1 || value.coverage.expectedPeriods !== 12 || value.coverage.coveredPeriods !== 1 || JSON.stringify(value.coverage.coveredMonths) !== JSON.stringify(["2023-01"]) || JSON.stringify(value.coverage.missingMonths) !== JSON.stringify(MISSING_INVENTORY_MONTHS)) throw new Error("The inventory response was not recognized.")
  if (JSON.stringify(value.warnings) !== JSON.stringify(INVENTORY_WARNINGS) || !object(value.line) || !exactKeys(value.line, ["facilityId", "servicePeriodStart", "servicePeriodEnd", "quantityMwh", "subtotalKgCo2e", "calculationResultSha256"]) || !uuid(value.line.facilityId) || value.line.servicePeriodStart !== "2023-01-01" || value.line.servicePeriodEnd !== "2023-01-31" || value.line.quantityMwh !== "12.346000" || value.line.subtotalKgCo2e !== "2407.9674" || !/^[0-9a-f]{64}$/.test(String(value.line.calculationResultSha256)) || !/^[0-9a-f]{64}$/.test(String(value.snapshotSha256)) || !uuid(value.submittedBy) || !instant(value.submittedAt)) throw new Error("The inventory response was not recognized.")
  if (value.reviewState === "awaiting_review" && value.decision !== null) throw new Error("The inventory response was not recognized.")
  if (value.reviewState !== "awaiting_review") {
    const decision = value.decision
    if (!object(decision) || !exactKeys(decision, ["id", "decision", "outcome", "acknowledgedWarnings", "reasonCode", "decidedBy", "decidedAt"]) || !uuid(decision.id) || decision.outcome !== value.reviewState || decision.decision !== (value.reviewState === "approved_bounded_draft" ? "approve_bounded_draft" : "changes_requested") || !uuid(decision.decidedBy) || decision.decidedBy === value.submittedBy || !instant(decision.decidedAt)) throw new Error("The inventory response was not recognized.")
    const approved = decision.decision === "approve_bounded_draft" && decision.reasonCode === "bounded_synthetic_scope_reviewed" && JSON.stringify(decision.acknowledgedWarnings) === JSON.stringify(INVENTORY_WARNINGS)
    const changesRequested = decision.decision === "changes_requested" && decision.reasonCode === "source_or_calculation_revision_required" && JSON.stringify(decision.acknowledgedWarnings) === "[]"
    if (!approved && !changesRequested) throw new Error("The inventory response was not recognized.")
  }
  return value as unknown as SyntheticInventory
}

async function decodeInventoryResponse(response: Response, expected: { companyId?: string; calculationId?: string; inventoryId?: string } = {}) {
  if (response.status === 404) throw new Error("Inventory not found.")
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) { if (object(body) && typeof body.error === "string") throw new Error(body.error); throw new Error("The inventory is unavailable.") }
  return decodeInventory(body, expected)
}

const MONTHS = Array.from({ length: 12 }, (_, index) => `2023-${String(index + 1).padStart(2, "0")}`)
const FINAL_QUANTITIES = ["12.346000","11.982000","12.417000","11.876000","12.104000","13.228000","14.037000","13.812000","12.765000","12.221000","12.493000",null] as const
const FINAL_EMISSIONS = ["2407.9674055248","2336.9727404016","2421.8152660296","2316.2984697888","2360.7676556352","2579.9929402464","2737.7805338856","2693.8964689056","2489.689286532","2383.5873694248","2436.6383279784",null] as const
const FINAL_TOTALS = { reportedMwh:"126.788000",reportedKgCo2e:"24728.7681363744",reportedDisplayKgCo2e:"24728.7681",estimatedMwh:"12.493000",estimatedKgCo2e:"2436.6383279784",estimatedDisplayKgCo2e:"2436.6383",includedMwh:"139.281000",includedKgCo2e:"27165.4064643528",includedDisplayKgCo2e:"27165.4065" } as const
const M58_FIXTURE_SHA256 = "44cf813b31bf92a13e15a5432e26cd931355df7ded4684248759a50876dbdc29"
function exactAnnualCounts(value: unknown): boolean { return object(value)&&exactKeys(value,["expected","resolved","reported","estimated","excluded","missing","calculationBearing"])&&value.expected===12&&value.resolved===12&&value.reported===10&&value.estimated===1&&value.excluded===1&&value.missing===0&&value.calculationBearing===11 }
function exactAnnualTotals(value: unknown): boolean { return object(value)&&exactKeys(value,Object.keys(FINAL_TOTALS))&&Object.entries(FINAL_TOTALS).every(([key,expected])=>value[key]===expected) }
type AnnualRegisterExpectation = { version?: 1|2; previousInventoryVersionId?: string; boundaryId?: string; facilityId?: string; januaryEvidenceSha256?: string; januaryCalculationId?: string }
export function decodeAnnualRegister(value: unknown, companyId: string, expected: AnnualRegisterExpectation = {}): AnnualRegister {
  if (!object(value) || !exactKeys(value, ["id","companyId","boundaryId","previousInventoryVersionId","version","reportingYear","facilityId","status","counts","periods","totals","fixtureSha256","snapshotSha256","createdBy","createdAt"]) || !uuid(value.id) || value.companyId !== companyId || !uuid(value.boundaryId) || !uuid(value.previousInventoryVersionId) || !uuid(value.facilityId) || ![1,2].includes(Number(value.version)) || value.reportingYear !== 2023 || !["incomplete","resolved_with_exceptions"].includes(String(value.status)) || !Array.isArray(value.periods) || value.periods.length !== 12 || !/^[0-9a-f]{64}$/.test(String(value.snapshotSha256)) || !uuid(value.createdBy) || !instant(value.createdAt)) throw new Error("The annual register response was not recognized.")
  if((expected.version&&value.version!==expected.version)||(expected.previousInventoryVersionId&&value.previousInventoryVersionId!==expected.previousInventoryVersionId)||(expected.boundaryId&&value.boundaryId!==expected.boundaryId)||(expected.facilityId&&value.facilityId!==expected.facilityId))throw new Error("The annual register response was not recognized.")
  for (let index=0; index<12; index+=1) { const period=value.periods[index]; if (!object(period) || !exactKeys(period,["month","state","version","quantityMwh","emissionsKgCo2e","evidence","reason","method","formula","basisMonths"]) || period.month !== MONTHS[index] || !["missing","reported","estimated","excluded"].includes(String(period.state)) || (period.evidence!==null&&(!object(period.evidence)||!exactKeys(period.evidence,["source","sha256","locator"])||typeof period.evidence.source!=="string"||!/^[0-9a-f]{64}$/.test(String(period.evidence.sha256))||typeof period.evidence.locator!=="string"))) throw new Error("The annual register response was not recognized.") }
  const counts=value.counts; if (!object(counts) || !exactKeys(counts,["expected","resolved","reported","estimated","excluded","missing","calculationBearing"]) || counts.expected !== 12) throw new Error("The annual register response was not recognized.")
  const januaryEvidence=value.periods[0]?.evidence
  if (value.version === 1 && (value.status !== "incomplete" || counts.resolved !== 1 || counts.reported !== 1 || counts.estimated !== 0 || counts.excluded !== 0 || counts.missing !== 11 || counts.calculationBearing !== 1 || value.totals !== null || value.fixtureSha256 !== null || value.periods[0]?.state !== "reported" || value.periods[0]?.version!==1 || value.periods[0]?.quantityMwh !== "12.346000" || value.periods[0]?.emissionsKgCo2e !== "2407.9674055248" || !object(januaryEvidence) || januaryEvidence.source!=="M56 calculation derived from M55 bill version 2" || (expected.januaryEvidenceSha256&&januaryEvidence.sha256!==expected.januaryEvidenceSha256) || (expected.januaryCalculationId&&!String(januaryEvidence.locator).startsWith(`calculation ${expected.januaryCalculationId};`)) || value.periods[0]?.reason!==null || value.periods[0]?.method!==null || value.periods[0]?.formula!==null || JSON.stringify(value.periods[0]?.basisMonths)!=="[]" || value.periods.slice(1).some((period)=>!object(period) || period.state!=="missing" || period.version!==1 || period.quantityMwh!==null || period.emissionsKgCo2e!==null || period.evidence!==null || period.reason!=="awaiting_source" || period.method!==null || period.formula!==null || JSON.stringify(period.basisMonths)!=="[]"))) throw new Error("The annual register response was not recognized.")
  if (value.version === 2) {
    if (value.status !== "resolved_with_exceptions" || !exactAnnualCounts(counts) || !exactAnnualTotals(value.totals) || value.fixtureSha256!==M58_FIXTURE_SHA256) throw new Error("The annual register response was not recognized.")
    for(let index=0;index<12;index+=1){const period=value.periods[index]!;const expectedState=index<10?"reported":index===10?"estimated":"excluded";if(period.state!==expectedState||period.version!==(index===0?1:2)||period.quantityMwh!==FINAL_QUANTITIES[index]||period.emissionsKgCo2e!==FINAL_EMISSIONS[index])throw new Error("The annual register response was not recognized.");if(index<10&&(!object(period.evidence)||period.reason!==null||period.method!==null||period.formula!==null||JSON.stringify(period.basisMonths)!=="[]"))throw new Error("The annual register response was not recognized.");if(index>0&&index<10&&(!object(period.evidence)||period.evidence.source!=="M58 fixed fictional electricity register"||period.evidence.sha256!==M58_FIXTURE_SHA256||period.evidence.locator!==`rows[${index-1}]`))throw new Error("The annual register response was not recognized.")}
    const estimate=value.periods[10]!;if(estimate.reason!=="synthetic_november_statement_unavailable"||estimate.method!=="mean_of_prior_two_reported_months_v1"||estimate.formula!=="(12.765000 + 12.221000) / 2"||JSON.stringify(estimate.basisMonths)!==JSON.stringify(["2023-09","2023-10"])||estimate.evidence!==null)throw new Error("The annual register response was not recognized.")
    const excluded=value.periods[11]!;if(excluded.reason!=="outside_operational_control_after_lease_end"||excluded.method!==null||excluded.formula!==null||!object(excluded.evidence)||excluded.evidence.source!=="M58 fixed fictional electricity register"||excluded.evidence.sha256!==M58_FIXTURE_SHA256||excluded.evidence.locator!=="closureMemo")throw new Error("The annual register response was not recognized.")
  }
  if (expected.januaryEvidenceSha256 || expected.januaryCalculationId) {
    if (!object(januaryEvidence) || januaryEvidence.source!=="M56 calculation derived from M55 bill version 2" || (expected.januaryEvidenceSha256&&januaryEvidence.sha256!==expected.januaryEvidenceSha256) || (expected.januaryCalculationId&&januaryEvidence.locator!==`calculation ${expected.januaryCalculationId}; service 2023-01-01..2023-01-31`)) throw new Error("The annual register response was not recognized.")
  }
  return value as unknown as AnnualRegister
}

type AnnualInventoryExpectation = { inventoryId?: string; registerId?: string; previousInventoryVersionId?: string; boundaryId?: string; registerSnapshotSha256?: string }
export function decodeAnnualInventory(value: unknown, companyId: string, expected: AnnualInventoryExpectation = {}): AnnualInventory {
  if (!object(value) || !exactKeys(value,["id","companyId","boundaryId","previousInventoryVersionId","registerId","registerSnapshotSha256","version","reportingYear","scope","periodResolution","overallInventoryCompleteness","releaseEligible","counts","totals","warnings","snapshotSha256","submittedBy","submittedAt","decision"]) || !uuid(value.id) || value.companyId!==companyId || !uuid(value.boundaryId) || !uuid(value.previousInventoryVersionId) || !uuid(value.registerId) || !/^[0-9a-f]{64}$/.test(String(value.registerSnapshotSha256)) || value.version!==2 || value.reportingYear!==2023 || value.scope!=="scope_2_location_based" || value.periodResolution!=="resolved_with_exceptions" || value.overallInventoryCompleteness!=="incomplete" || value.releaseEligible!==false || !exactAnnualCounts(value.counts) || !exactAnnualTotals(value.totals) || JSON.stringify(value.warnings)!==JSON.stringify(ANNUAL_WARNINGS) || !/^[0-9a-f]{64}$/.test(String(value.snapshotSha256)) || !uuid(value.submittedBy) || !instant(value.submittedAt)) throw new Error("The annual inventory response was not recognized.")
  if((expected.inventoryId&&value.id!==expected.inventoryId)||(expected.registerId&&value.registerId!==expected.registerId)||(expected.previousInventoryVersionId&&value.previousInventoryVersionId!==expected.previousInventoryVersionId)||(expected.boundaryId&&value.boundaryId!==expected.boundaryId)||(expected.registerSnapshotSha256&&value.registerSnapshotSha256!==expected.registerSnapshotSha256))throw new Error("The annual inventory response was not recognized.")
  if (value.decision!==null) { const d=value.decision; if (!object(d) || !exactKeys(d,["id","decision","outcome","reasonCode","acknowledgedWarnings","decidedBy","decidedAt"]) || !uuid(d.id) || !uuid(d.decidedBy) || d.decidedBy===value.submittedBy || !instant(d.decidedAt)) throw new Error("The annual inventory response was not recognized.");const approved=d.decision==="approve_bounded_annual_location_draft"&&d.outcome==="approved_bounded_annual_location_draft"&&d.reasonCode==="bounded_annual_location_register_reviewed"&&JSON.stringify(d.acknowledgedWarnings)===JSON.stringify(ANNUAL_WARNINGS);const changes=d.decision==="changes_requested"&&d.outcome==="changes_requested"&&d.reasonCode==="source_or_calculation_revision_required"&&JSON.stringify(d.acknowledgedWarnings)==="[]";if(!approved&&!changes)throw new Error("The annual inventory response was not recognized.") }
  return value as unknown as AnnualInventory
}

async function responseJson(response: Response) { const body: unknown=await response.json().catch(()=>null); if (!response.ok) { if (object(body)&&typeof body.error==="string") throw new Error(body.error); throw new Error("The annual register is unavailable.") } return body }

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

export async function revisitSyntheticInventory(workspaceId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  if (!uuid(workspaceId)) throw new Error("The saved workspace identifier is invalid.")
  return decodeInventoryResponse(await fetcher(`/workspace-api/workspace/${workspaceId}/inventories/2023/scope2`, { headers: authorization(actor) }), { companyId: workspaceId })
}

export async function prepareSyntheticInventory(workspaceId: string, calculationId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  if (!uuid(workspaceId) || !uuid(calculationId)) throw new Error("The calculation identifier is invalid.")
  return decodeInventoryResponse(await fetcher(`/workspace-api/workspace/${workspaceId}/inventories/2023/scope2/versions`, { method: "POST", headers: authorization(actor, true), body: JSON.stringify({ calculationId, idempotencyKey: crypto.randomUUID() }) }), { companyId: workspaceId, calculationId })
}

export async function decideSyntheticInventory(inventory: SyntheticInventory, decision: "approve_bounded_draft" | "changes_requested", actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  const approval = decision === "approve_bounded_draft"
  return decodeInventoryResponse(await fetcher(`/workspace-api/workspace/${inventory.companyId}/inventories/${inventory.id}/decisions`, {
    method: "POST", headers: authorization(actor, true), body: JSON.stringify({ decision, expectedInventorySnapshotSha256: inventory.snapshotSha256, acknowledgedWarnings: approval ? INVENTORY_WARNINGS : [], reasonCode: approval ? "bounded_synthetic_scope_reviewed" : "source_or_calculation_revision_required", idempotencyKey: crypto.randomUUID() }),
  }), { companyId: inventory.companyId, calculationId: inventory.calculationId, inventoryId: inventory.id })
}

export async function createAnnualRegister(inventory: SyntheticInventory, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  return decodeAnnualRegister(await responseJson(await fetcher(`/workspace-api/workspace/${inventory.companyId}/annual-registers/2023`, { method:"POST", headers:authorization(actor,true), body:JSON.stringify({ previousInventoryVersionId:inventory.id, idempotencyKey:crypto.randomUUID() }) })), inventory.companyId,{version:1,previousInventoryVersionId:inventory.id,januaryEvidenceSha256:inventory.line.calculationResultSha256,januaryCalculationId:inventory.calculationId})
}
export async function revisitAnnualRegisters(workspaceId: string, predecessor: SyntheticInventory, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  const value=await responseJson(await fetcher(`/workspace-api/workspace/${workspaceId}/annual-registers/2023`, { headers:authorization(actor) })); if (!Array.isArray(value) || value.length > 2) throw new Error("The annual register response was not recognized.")
  if (value.length === 0) return []
  const initialRaw=value.find((item)=>object(item)&&item.version===1)
  const initial=decodeAnnualRegister(initialRaw,workspaceId,{version:1,previousInventoryVersionId:predecessor.id,boundaryId:predecessor.boundaryId,facilityId:predecessor.line.facilityId,januaryEvidenceSha256:predecessor.line.calculationResultSha256,januaryCalculationId:predecessor.calculationId})
  const finalRaw=value.find((item)=>object(item)&&item.version===2)
  if (!finalRaw) return [initial]
  return [initial,decodeAnnualRegister(finalRaw,workspaceId,{version:2,previousInventoryVersionId:predecessor.id,boundaryId:initial.boundaryId,facilityId:initial.facilityId,januaryEvidenceSha256:predecessor.line.calculationResultSha256,januaryCalculationId:predecessor.calculationId})]
}
export async function completeAnnualRegister(register: AnnualRegister, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  const january=register.periods[0]!.evidence
  const calculationId=object(january)&&typeof january.locator==="string" ? january.locator.match(/^calculation ([0-9a-f-]{36}); service 2023-01-01\.\.2023-01-31$/)?.[1] : undefined
  if (!object(january) || !calculationId) throw new Error("The annual register response was not recognized.")
  return decodeAnnualRegister(await responseJson(await fetcher(`/workspace-api/workspace/${register.companyId}/annual-registers/${register.id}/complete`, { method:"POST", headers:authorization(actor,true), body:JSON.stringify({ expectedRegisterSnapshotSha256:register.snapshotSha256,fixtureId:"m58-fixed-electricity-register-2023-v1",idempotencyKey:crypto.randomUUID() }) })), register.companyId,{version:2,previousInventoryVersionId:register.previousInventoryVersionId,boundaryId:register.boundaryId,facilityId:register.facilityId,januaryEvidenceSha256:january.sha256,januaryCalculationId:calculationId})
}
export async function createAnnualInventory(register: AnnualRegister, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  return decodeAnnualInventory(await responseJson(await fetcher(`/workspace-api/workspace/${register.companyId}/annual-inventories/2023/scope2/versions`, { method:"POST",headers:authorization(actor,true),body:JSON.stringify({ registerId:register.id,idempotencyKey:crypto.randomUUID() }) })),register.companyId,{registerId:register.id,previousInventoryVersionId:register.previousInventoryVersionId,boundaryId:register.boundaryId,registerSnapshotSha256:register.snapshotSha256})
}
export async function revisitAnnualInventory(workspaceId: string, register: AnnualRegister, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  return decodeAnnualInventory(await responseJson(await fetcher(`/workspace-api/workspace/${workspaceId}/annual-inventories/2023/scope2`,{headers:authorization(actor)})),workspaceId,{registerId:register.id,previousInventoryVersionId:register.previousInventoryVersionId,boundaryId:register.boundaryId,registerSnapshotSha256:register.snapshotSha256})
}
export async function decideAnnualInventory(inventory: AnnualInventory, decision: "approve_bounded_annual_location_draft" | "changes_requested", actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  const approval=decision==="approve_bounded_annual_location_draft"
  return decodeAnnualInventory(await responseJson(await fetcher(`/workspace-api/workspace/${inventory.companyId}/annual-inventories/${inventory.id}/decisions`,{method:"POST",headers:authorization(actor,true),body:JSON.stringify({decision,reasonCode:approval?"bounded_annual_location_register_reviewed":"source_or_calculation_revision_required",acknowledgedWarnings:approval?ANNUAL_WARNINGS:[],expectedInventorySnapshotSha256:inventory.snapshotSha256,idempotencyKey:crypto.randomUUID()})})),inventory.companyId,{inventoryId:inventory.id,registerId:inventory.registerId,previousInventoryVersionId:inventory.previousInventoryVersionId,boundaryId:inventory.boundaryId,registerSnapshotSha256:inventory.registerSnapshotSha256})
}

export function decodeEvidencePackMetadata(value:unknown,expected:{companyId?:string;inventoryId?:string;packId?:string}={}):EvidencePackMetadata{
  if(!object(value)||!exactKeys(value,["id","companyId","inventoryId","profile","manifestSha256","lineageRootSha256","archiveSha256","archiveByteLength","entryCount","createdBy","createdAt"])||!uuid(value.id)||!uuid(value.companyId)||!uuid(value.inventoryId)||value.profile!=="neuvetra.synthetic.inventory-evidence-pack.v1"||![value.manifestSha256,value.lineageRootSha256,value.archiveSha256].every(item=>typeof item==="string"&&/^[0-9a-f]{64}$/.test(item))||!Number.isInteger(value.archiveByteLength)||Number(value.archiveByteLength)<1||Number(value.archiveByteLength)>262144||value.entryCount!==17||!uuid(value.createdBy)||!instant(value.createdAt))throw new Error("The evidence pack response was not recognized.")
  if((expected.companyId&&value.companyId!==expected.companyId)||(expected.inventoryId&&value.inventoryId!==expected.inventoryId)||(expected.packId&&value.id!==expected.packId))throw new Error("The evidence pack response was not recognized.")
  return value as unknown as EvidencePackMetadata
}
export function decodeEvidencePackReceipt(value:unknown,pack:EvidencePackMetadata):EvidencePackReceipt{
  if(!object(value)||!exactKeys(value,["status","profile","archiveSha256","manifestSha256","lineageRootSha256","entryCount","inventoryId","reconstructed","overallInventoryCompleteness","releaseEligible"])||value.status!=="verified_match"||value.profile!==pack.profile||value.archiveSha256!==pack.archiveSha256||value.manifestSha256!==pack.manifestSha256||value.lineageRootSha256!==pack.lineageRootSha256||value.entryCount!==17||value.inventoryId!==pack.inventoryId||value.overallInventoryCompleteness!=="incomplete"||value.releaseEligible!==false||!object(value.reconstructed)||!exactKeys(value.reconstructed,["expected","reported","estimated","excluded","missing","reportedMwh","reportedKgCo2e","estimatedMwh","estimatedKgCo2e","includedMwh","includedKgCo2e","includedDisplayKgCo2e"]))throw new Error("The evidence pack replay was not recognized.")
  const expected={expected:12,reported:10,estimated:1,excluded:1,missing:0,reportedMwh:"126.788000",reportedKgCo2e:"24728.7681363744",estimatedMwh:"12.493000",estimatedKgCo2e:"2436.6383279784",includedMwh:"139.281000",includedKgCo2e:"27165.4064643528",includedDisplayKgCo2e:"27165.4065"}
  const reconstructed=value.reconstructed as Record<string,unknown>
  if(Object.entries(expected).some(([key,expectedValue])=>reconstructed[key]!==expectedValue))throw new Error("The evidence pack replay was not recognized.")
  return value as unknown as EvidencePackReceipt
}
async function packJson(response:Response,expected:{companyId:string;inventoryId:string;packId?:string}){const body:unknown=await response.json().catch(()=>null);if(!response.ok){if(object(body)&&typeof body.error==="string")throw new Error(body.error);throw new Error("The evidence pack is unavailable.")}return decodeEvidencePackMetadata(body,expected)}
export async function createEvidencePack(inventory:AnnualInventory,actor:WorkspaceActor,fetcher:typeof fetch=fetch){return packJson(await fetcher(`/workspace-api/workspace/${inventory.companyId}/annual-inventories/${inventory.id}/evidence-packs`,{method:"POST",headers:authorization(actor,true),body:JSON.stringify({expectedInventorySnapshotSha256:inventory.snapshotSha256,idempotencyKey:crypto.randomUUID()})}),{companyId:inventory.companyId,inventoryId:inventory.id})}
export async function revisitEvidencePack(inventory:AnnualInventory,actor:WorkspaceActor,fetcher:typeof fetch=fetch){return packJson(await fetcher(`/workspace-api/workspace/${inventory.companyId}/annual-inventories/${inventory.id}/evidence-packs/current`,{headers:authorization(actor)}),{companyId:inventory.companyId,inventoryId:inventory.id})}
export async function downloadEvidencePack(pack:EvidencePackMetadata,actor:WorkspaceActor,fetcher:typeof fetch=fetch){const response=await fetcher(`/workspace-api/workspace/${pack.companyId}/annual-inventories/${pack.inventoryId}/evidence-packs/${pack.id}/download`,{headers:authorization(actor)});if(!response.ok)throw new Error("The evidence pack is unavailable.");const bytes=await response.arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),byte=>byte.toString(16).padStart(2,"0")).join("");if(bytes.byteLength!==pack.archiveByteLength||response.headers.get("x-neuvetra-archive-sha256")!==pack.archiveSha256||digest!==pack.archiveSha256)throw new Error("The evidence pack download was not recognized.");return new File([bytes],`neuvetra-m59-${pack.inventoryId}.zip`,{type:"application/zip"})}
export async function replayEvidencePack(pack:EvidencePackMetadata,file:File,actor:WorkspaceActor,fetcher:typeof fetch=fetch){if(file.type!=="application/zip"||file.size!==pack.archiveByteLength)throw new Error("Choose the exact downloaded M59 ZIP file.");const body=new FormData();body.set("file",file);const response=await fetcher(`/workspace-api/workspace/${pack.companyId}/annual-inventories/${pack.inventoryId}/evidence-packs/${pack.id}/replay`,{method:"POST",headers:authorization(actor),body});const value:unknown=await response.json().catch(()=>null);if(!response.ok){if(object(value)&&typeof value.error==="string")throw new Error(value.error);throw new Error("The evidence pack could not be verified.")}return decodeEvidencePackReceipt(value,pack)}

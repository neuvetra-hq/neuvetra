export interface SyntheticActivity {
  asset_id: string
  boundary: string
  geography: string
  reporting_period: { start: string; end: string }
  fuel: string
  quantity: string
  unit: string
}

export interface SyntheticElectricityActivity {
  asset_id: string
  boundary: string
  geography: { country: string; state: string; egrid_subregion: string }
  reporting_period: { start: string; end: string }
  electricity: string
  quantity: string
  unit: string
}

export interface CalculationError {
  code: string
  field: string
  message: string
}

export interface CalculationRecord {
  contract_version: string
  status: "calculated"
  classification: Record<string, string | boolean>
  activity: SyntheticActivity | SyntheticElectricityActivity
  input_snapshot_sha256: string
  method: { id: string; version: string; implementation_sha256: string; scope: string; category: string; formula: string }
  factor: {
    id: string
    version: string
    status: string
    release_eligible: boolean
    candidate_sha256: string
    heat_basis: string
    components: Record<string, { value: string; unit: string; cell: string }>
    source: { publisher: string; title: string; workbook_sha256: string; sheet: string; table: string; row_cells: string[]; method_note_cells: Record<string, string>; publisher_url: string; rights_status: string }
  }
  gwp_policy: { id: string; version: string; assessment: string; time_horizon_years: string; values: Record<string, string>; source_cells: Record<string, string>; source: { publisher: string; title: string; workbook_sha256: string; sheet: string; table: string; title_cells: string[]; horizon_cell: string; assessment_note_cells: string[] }; policy_sha256: string }
  conversion: { id: string; ratio: string }
  gas_results: Record<string, { mass: string; mass_unit: string; co2e: string; co2e_unit: string }>
  trace: Array<{ step: string; expression: string; result: string; unit: string }>
  total: { unrounded: string; display: string; unit: string; rounding: string }
  reconciliation?: { authority: string; component_sum: string; component_rounding_delta: string; explanation: string }
  result_payload_sha256: string
}

type ApiResponse =
  | { status: "ok"; record: CalculationRecord; hash_match?: boolean }
  | { status: "error"; error: CalculationError }

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|")
}

function decimalString(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9][0-9]{0,29})(?:\.[0-9]+)?$/.test(value)
}

function exactStringRecord(value: unknown, expected: Record<string, string>) {
  if (!isObject(value) || !exactKeys(value, Object.keys(expected))) return false
  return Object.entries(expected).every(([key, expectedValue]) => value[key] === expectedValue)
}

function validM53Record(record: Record<string, unknown>) {
  const activity = record.activity
  const method = record.method
  const factor = record.factor
  const gwp = record.gwp_policy
  const conversion = record.conversion
  const classification = record.classification
  const gasResults = record.gas_results
  const total = record.total
  const reconciliation = record.reconciliation
  if (!isObject(classification) || !exactKeys(classification, ["source", "factor", "method_approval", "runtime", "release_eligible"]) || classification.source !== "retained_primary_source_currentness_checked_2026-09-12" || classification.factor !== "development_candidate" || classification.method_approval !== "pending_independent_factor_method_approval" || classification.runtime !== "not_released" || classification.release_eligible !== false) return false
  if (!isObject(activity) || !exactKeys(activity, ["asset_id", "boundary", "geography", "reporting_period", "electricity", "quantity", "unit"])) return false
  if (activity.asset_id !== "Synthetic California office 001" || activity.boundary !== "Purchased electricity consumed by the reporting company" || activity.electricity !== "Grid-delivered purchased electricity" || activity.quantity !== "1" || activity.unit !== "MWh") return false
  if (!exactStringRecord(activity.geography, { country: "United States", state: "California", egrid_subregion: "CAMX" })) return false
  if (!exactStringRecord(activity.reporting_period, { start: "2023-01-01", end: "2023-12-31" })) return false
  if (!isObject(method) || !exactKeys(method, ["id", "version", "implementation_sha256", "scope", "category", "formula"]) || method.id !== "scope2-location-based-egrid-subregion" || method.version !== "2023-r2-camx-v1" || method.scope !== "Scope 2" || method.category !== "location-based purchased electricity" || method.formula !== "MWh × published eGRID subregion total-output CO2e rate" || method.implementation_sha256 !== "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c") return false
  if (!isObject(factor) || !exactKeys(factor, ["id", "version", "status", "release_eligible", "data_year", "geography", "components", "total_output_co2e", "source", "candidate_sha256"])) return false
  if (factor.id !== "epa-egrid2023-r2-camx-total-output" || factor.version !== "eGRID2023-revision-2" || factor.status !== "development_candidate" || factor.release_eligible !== false || factor.data_year !== "2023" || factor.candidate_sha256 !== "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356") return false
  if (!exactStringRecord(factor.geography, { country: "United States", state: "California", egrid_subregion: "CAMX", name: "WECC California" })) return false
  if (!isObject(factor.components) || !exactKeys(factor.components, ["co2", "ch4", "n2o"])) return false
  if (!exactStringRecord(factor.components.co2, { value: "194.3512704", unit: "kg CO2/MWh", cell: "AC6" })) return false
  if (!exactStringRecord(factor.components.ch4, { value: "0.01134", unit: "kg CH4/MWh", cell: "AE6" })) return false
  if (!exactStringRecord(factor.components.n2o, { value: "0.0013608", unit: "kg N2O/MWh", cell: "AG6" })) return false
  if (!exactStringRecord(factor.total_output_co2e, { value: "195.0402888", unit: "kg CO2e/MWh", cell: "AI6" })) return false
  if (!isObject(factor.source) || !exactKeys(factor.source, ["publisher", "title", "workbook_sha256", "sheet", "table", "row_cells", "header_cells", "publisher_url", "rights_status"])) return false
  if (factor.source.publisher !== "U.S. Environmental Protection Agency" || factor.source.title !== "eGRID2023 metric data file, revision 2" || factor.source.workbook_sha256 !== "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab" || factor.source.sheet !== "SRL23" || factor.source.table !== "eGRID subregion annual total output emission rates" || factor.source.publisher_url !== "https://www.epa.gov/egrid/detailed-data" || factor.source.rights_status !== "federal_public_data_commercial_use_citation_reviewed; method_release_pending") return false
  if (JSON.stringify(factor.source.row_cells) !== JSON.stringify(["A6", "B6", "C6", "AC6", "AE6", "AG6", "AI6"]) || JSON.stringify(factor.source.header_cells) !== JSON.stringify(["A1", "B1", "C1", "AC1", "AE1", "AG1", "AI1"])) return false
  if (!isObject(gwp) || !exactKeys(gwp, ["id", "version", "assessment", "time_horizon_years", "values", "source", "policy_sha256"]) || gwp.id !== "epa-egrid2023-ar5-100-year" || gwp.version !== "egrid2023-technical-guide-v1" || gwp.assessment !== "IPCC AR5 without climate-carbon feedbacks" || gwp.time_horizon_years !== "100" || gwp.policy_sha256 !== "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5") return false
  if (!exactStringRecord(gwp.values, { co2: "1", ch4: "28", n2o: "265" })) return false
  if (!isObject(gwp.source) || !exactKeys(gwp.source, ["publisher", "title", "page", "section", "publisher_url"]) || gwp.source.publisher !== "U.S. Environmental Protection Agency" || gwp.source.title !== "Technical Guide for eGRID2023" || gwp.source.page !== "12" || gwp.source.section !== "3.1.1.2 Annual Emission Estimates for CH4, N2O, and CO2 equivalent" || gwp.source.publisher_url !== "https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf") return false
  if (!exactStringRecord(conversion, { id: "identity-mwh-v1", ratio: "1 MWh = 1 MWh" })) return false
  if (!isObject(gasResults) || !exactKeys(gasResults, ["co2", "ch4", "n2o"])) return false
  if (!exactStringRecord(gasResults.co2, { mass: "194.3512704", mass_unit: "kg CO2", co2e: "194.3512704", co2e_unit: "kg CO2e" })) return false
  if (!exactStringRecord(gasResults.ch4, { mass: "0.01134", mass_unit: "kg CH4", co2e: "0.31752", co2e_unit: "kg CO2e" })) return false
  if (!exactStringRecord(gasResults.n2o, { mass: "0.0013608", mass_unit: "kg N2O", co2e: "0.360612", co2e_unit: "kg CO2e" })) return false
  const expectedTrace = [
    { step: "published_total_output", expression: "1 * 195.0402888", result: "195.0402888", unit: "kg CO2e" },
    { step: "component_sum_reference", expression: "194.3512704 + 0.31752 + 0.360612", result: "195.0294024", unit: "kg CO2e" },
    { step: "published_rate_rounding_delta", expression: "195.0402888 - 195.0294024", result: "0.0108864", unit: "kg CO2e" },
  ]
  if (!Array.isArray(record.trace) || record.trace.length !== expectedTrace.length || !record.trace.every((step, index) => exactStringRecord(step, expectedTrace[index]))) return false
  if (!exactStringRecord(total, { unrounded: "195.0402888", unit: "kg CO2e", display: "195.0403", rounding: "four decimal places; ROUND_HALF_EVEN; no intermediate rounding" })) return false
  if (!exactStringRecord(reconciliation, { authority: "published total-output CO2e rate in AI6", component_sum: "195.0294024", component_rounding_delta: "0.0108864", explanation: "EPA publishes the gas-specific rates as rounded columns. They are shown for inspection and are not silently substituted for the published CO2e total-output rate." })) return false
  if (record.input_snapshot_sha256 !== "fdd1b5b8d5de95255d406f33412a5a10b40df8bdc7881d9a6fb95a71330f1c2b" || record.result_payload_sha256 !== "9c63b2cb12fa2708f35d394e537ca5803e27f91c4647f33376abf75a6fb72b91") return false
  return true
}

export function decodeCalculationResponse(value: unknown): ApiResponse {
  if (!isObject(value) || (value.status !== "ok" && value.status !== "error")) throw new Error("The local calculator returned an invalid response.")
  if (value.status === "error") {
    if (!exactKeys(value, ["status", "error"])) throw new Error("The local calculator returned an invalid error envelope.")
    if (!isObject(value.error) || !isString(value.error.code) || !isString(value.error.field) || !isString(value.error.message)) throw new Error("The local calculator returned an invalid error.")
    return { status: "error", error: { code: value.error.code, field: value.error.field, message: value.error.message } }
  }
  if (!exactKeys(value, value.hash_match === true ? ["status", "record", "hash_match"] : ["status", "record"])) throw new Error("The local calculator returned an invalid success envelope.")
  const record = value.record
  if (!isObject(record)) throw new Error("The calculation record is incomplete.")
  const isM42 = record.contract_version === "m42-calculation-result-v1"
  const isM53 = record.contract_version === "m53-electricity-calculation-result-v1"
  const keys = ["contract_version", "status", "classification", "activity", "input_snapshot_sha256", "method", "factor", "gwp_policy", "conversion", "gas_results", "trace", "total", ...(isM53 ? ["reconciliation"] : []), "result_payload_sha256"]
  if (!exactKeys(record, keys) || record.status !== "calculated" || (!isM42 && !isM53) || !isString(record.input_snapshot_sha256) || !isString(record.result_payload_sha256)) throw new Error("The calculation record is incomplete.")
  if (isM53 && !validM53Record(record)) throw new Error("The electricity calculation identity is invalid.")
  if (!isObject(record.activity) || !isObject(record.total) || !isString(record.total.display) || !isString(record.total.unrounded) || !isString(record.total.unit) || !isString(record.total.rounding)) throw new Error("The result total is incomplete.")
  if (!isObject(record.method) || !isObject(record.factor) || !isObject(record.gwp_policy) || !isObject(record.gas_results) || !Array.isArray(record.trace) || !isObject(record.classification) || !isObject(record.conversion)) throw new Error("The calculation trace is incomplete.")
  if (!decimalString(record.total.display) || !decimalString(record.total.unrounded) || record.classification.release_eligible !== false || record.classification.runtime !== "not_released") throw new Error("The result classification is unsafe.")
  if (isM53 && (!isObject(record.reconciliation) || !isString(record.reconciliation.authority) || !decimalString(record.reconciliation.component_sum) || !decimalString(record.reconciliation.component_rounding_delta) || !isString(record.reconciliation.explanation))) throw new Error("The electricity factor reconciliation is incomplete.")
  for (const gas of ["co2", "ch4", "n2o"]) {
    const result = record.gas_results[gas]
    if (!isObject(result) || !decimalString(result.mass) || !decimalString(result.co2e) || !isString(result.mass_unit) || result.co2e_unit !== "kg CO2e") throw new Error("A gas result is invalid.")
  }
  for (const step of record.trace) {
    if (!isObject(step) || !isString(step.step) || !isString(step.expression) || !decimalString(step.result) || !isString(step.unit)) throw new Error("A trace step is invalid.")
  }
  return { status: "ok", record: record as unknown as CalculationRecord, hash_match: value.hash_match === true }
}

async function post(payload: unknown): Promise<ApiResponse> {
  const response = await fetch("/calculation-api/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  return decodeCalculationResponse(await response.json())
}

export function calculateSyntheticActivity(activity: SyntheticActivity) {
  return post({ action: "calculate", activity })
}

export function calculateSyntheticElectricity(activity: SyntheticElectricityActivity) {
  return post({ action: "calculate", activity })
}

export function replayCalculationRecord(record: CalculationRecord) {
  return post({ action: "replay", record })
}

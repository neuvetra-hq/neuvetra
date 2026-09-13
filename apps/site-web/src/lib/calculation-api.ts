export interface SyntheticActivity {
  asset_id: string
  boundary: string
  geography: string
  reporting_period: { start: string; end: string }
  fuel: string
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
  activity: SyntheticActivity
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

export function decodeCalculationResponse(value: unknown): ApiResponse {
  if (!isObject(value) || (value.status !== "ok" && value.status !== "error")) throw new Error("The local calculator returned an invalid response.")
  if (value.status === "error") {
    if (!exactKeys(value, ["status", "error"])) throw new Error("The local calculator returned an invalid error envelope.")
    if (!isObject(value.error) || !isString(value.error.code) || !isString(value.error.field) || !isString(value.error.message)) throw new Error("The local calculator returned an invalid error.")
    return { status: "error", error: { code: value.error.code, field: value.error.field, message: value.error.message } }
  }
  if (!exactKeys(value, value.hash_match === true ? ["status", "record", "hash_match"] : ["status", "record"])) throw new Error("The local calculator returned an invalid success envelope.")
  const record = value.record
  if (!isObject(record) || !exactKeys(record, ["contract_version", "status", "classification", "activity", "input_snapshot_sha256", "method", "factor", "gwp_policy", "conversion", "gas_results", "trace", "total", "result_payload_sha256"]) || record.status !== "calculated" || record.contract_version !== "m42-calculation-result-v1" || !isString(record.input_snapshot_sha256) || !isString(record.result_payload_sha256)) throw new Error("The calculation record is incomplete.")
  if (!isObject(record.activity) || !isObject(record.total) || !isString(record.total.display) || !isString(record.total.unrounded) || !isString(record.total.unit) || !isString(record.total.rounding)) throw new Error("The result total is incomplete.")
  if (!isObject(record.method) || !isObject(record.factor) || !isObject(record.gwp_policy) || !isObject(record.gas_results) || !Array.isArray(record.trace) || !isObject(record.classification) || !isObject(record.conversion)) throw new Error("The calculation trace is incomplete.")
  if (!decimalString(record.total.display) || !decimalString(record.total.unrounded) || record.classification.release_eligible !== false || record.classification.runtime !== "not_released") throw new Error("The result classification is unsafe.")
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

export function replayCalculationRecord(record: CalculationRecord) {
  return post({ action: "replay", record })
}

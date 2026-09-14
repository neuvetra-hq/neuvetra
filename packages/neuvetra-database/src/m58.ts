export const M58_FACTOR = "195.0402888" as const
export const M58_FIXTURE_SHA256 = "44cf813b31bf92a13e15a5432e26cd931355df7ded4684248759a50876dbdc29" as const
export const M58_FIXTURE_BYTES = 1095 as const
export const M58_WARNINGS = [
  "one_period_estimated",
  "one_period_excluded",
  "market_based_scope2_not_included",
  "factor_and_method_not_released",
  "scope_1_and_scope_3_not_assessed",
  "synthetic_local_only_no_assurance",
] as const

export type AnnualPeriodState = "missing" | "reported" | "estimated" | "excluded"
export interface AnnualPeriod {
  month: string
  state: AnnualPeriodState
  version: 1 | 2
  quantityMwh: string | null
  emissionsKgCo2e: string | null
  evidence: null | { source: string; sha256: string; locator: string }
  reason: string | null
  method: string | null
  formula: string | null
  basisMonths: string[]
}

export interface AnnualRegister {
  id: string
  companyId: string
  boundaryId: string
  previousInventoryVersionId: string
  version: 1 | 2
  reportingYear: 2023
  facilityId: string
  status: "incomplete" | "resolved_with_exceptions"
  counts: { expected: 12; resolved: number; reported: number; estimated: number; excluded: number; missing: number; calculationBearing: number }
  periods: AnnualPeriod[]
  totals: null | {
    reportedMwh: "126.788000"; reportedKgCo2e: "24728.7681363744"; reportedDisplayKgCo2e: "24728.7681"
    estimatedMwh: "12.493000"; estimatedKgCo2e: "2436.6383279784"; estimatedDisplayKgCo2e: "2436.6383"
    includedMwh: "139.281000"; includedKgCo2e: "27165.4064643528"; includedDisplayKgCo2e: "27165.4065"
  }
  fixtureSha256: string | null
  snapshotSha256: string
  createdBy: string
  createdAt: string
}

export interface AnnualInventory {
  id: string
  companyId: string
  boundaryId: string
  previousInventoryVersionId: string
  registerId: string
  registerSnapshotSha256: string
  version: 2
  reportingYear: 2023
  scope: "scope_2_location_based"
  periodResolution: "resolved_with_exceptions"
  overallInventoryCompleteness: "incomplete"
  releaseEligible: false
  counts: { expected: 12; resolved: 12; reported: 10; estimated: 1; excluded: 1; missing: 0; calculationBearing: 11 }
  totals: NonNullable<AnnualRegister["totals"]>
  warnings: string[]
  snapshotSha256: string
  submittedBy: string
  submittedAt: string
  decision: null | {
    id: string
    decision: "approve_bounded_annual_location_draft" | "changes_requested"
    outcome: "approved_bounded_annual_location_draft" | "changes_requested"
    reasonCode: "bounded_annual_location_register_reviewed" | "source_or_calculation_revision_required"
    acknowledgedWarnings: string[]
    decidedBy: string
    decidedAt: string
  }
}

export const M58_REPORTED: ReadonlyArray<[string, string]> = [
  ["2023-01", "12.346000"], ["2023-02", "11.982000"], ["2023-03", "12.417000"],
  ["2023-04", "11.876000"], ["2023-05", "12.104000"], ["2023-06", "13.228000"],
  ["2023-07", "14.037000"], ["2023-08", "13.812000"], ["2023-09", "12.765000"],
  ["2023-10", "12.221000"],
]

export const M58_TOTALS: NonNullable<AnnualRegister["totals"]> = {
  reportedMwh: "126.788000", reportedKgCo2e: "24728.7681363744", reportedDisplayKgCo2e: "24728.7681",
  estimatedMwh: "12.493000", estimatedKgCo2e: "2436.6383279784", estimatedDisplayKgCo2e: "2436.6383",
  includedMwh: "139.281000", includedKgCo2e: "27165.4064643528", includedDisplayKgCo2e: "27165.4065",
}

export function multiplyMwh(quantity: string): string {
  const [whole, fraction = ""] = quantity.split(".")
  const q = BigInt(`${whole}${fraction.padEnd(6, "0")}`)
  const factor = 1950402888n
  const raw = (q * factor).toString().padStart(14, "0")
  const resultFraction = raw.slice(-13).replace(/0+$/, "")
  return resultFraction ? `${raw.slice(0, -13)}.${resultFraction}` : raw.slice(0, -13)
}

export function displayKg(value: string): string {
  const [whole, fraction = ""] = value.split(".")
  const ten = fraction.padEnd(10, "0")
  let scaled = BigInt(whole) * 10000n + BigInt(ten.slice(0, 4))
  if (Number(ten[4] ?? "0") >= 5) scaled += 1n
  return `${scaled / 10000n}.${(scaled % 10000n).toString().padStart(4, "0")}`
}

export const M64_PROFILE = "neuvetra.synthetic.manual-electricity-worksheet.v1" as const
export const M64_LIMITATIONS = ["synthetic_manual_input", "overall_inventory_incomplete", "january_2023_camx_only", "market_based_scope2_not_included", "factor_and_method_not_released", "scope_1_and_scope_3_not_assessed", "no_assurance"] as const
export const M64_METHOD = {
  id: "scope2-location-based-egrid-subregion", version: "2023-r2-camx-v1",
  factorId: "epa-egrid2023-r2-camx-total-output", factorVersion: "eGRID2023-revision-2", factorValue: "195.0402888", factorUnit: "kg CO2e/MWh",
  sourceSha256: "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab", sheet: "SRL23", cell: "AI6",
  classification: "development_candidate", policy: "m64-accounting-policy-v1", accountingProfile: "manual-synthetic-2023-01-camx-kwh-v1",
  factorCandidateSha256: "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356", gwpPolicySha256: "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5", reviewedEngineSha256: "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c",
} as const
export interface WorksheetInput { companyLabel: string; facilityLabel: string; quantityKwh: string; period: "2023-01"; geography: "CAMX"; unit: "kWh"; idempotencyKey: string }
export interface WorksheetCorrection extends WorksheetInput { expectedVersionId: string; expectedResultSha256: string; correctionReason: string }
export interface WorksheetReviewInput { versionId: string; expectedResultSha256: string; decision: "accept_bounded_internal_draft" | "changes_requested"; note: string | null; acknowledgedLimitations: string[]; idempotencyKey: string }
export interface WorksheetReview { id: string; versionId: string; resultSha256: string; decision: WorksheetReviewInput["decision"]; note: string | null; acknowledgedLimitations: string[]; reviewerId: string; reviewedAt: string; decisionSha256: string }
export interface WorksheetVersion {
  id: string; version: number; previousVersionId: string | null; companyLabel: string; facilityLabel: string;
  quantityKwh: string; quantityMwh: string; period: "2023-01"; geography: "CAMX"; unit: "kWh"; correctionReason: string | null;
  inputSha256: string; resultSha256: string; createdBy: string; createdAt: string;
  total: { unrounded: string; display: string; unit: "kg CO2e"; rounding: "half_even_4dp" }; method: typeof M64_METHOD; review: WorksheetReview | null
}
export interface ElectricityWorksheet { profile: typeof M64_PROFILE; companyId: string; synthetic: true; complete: false; releaseEligible: false; assurance: "none"; limitations: string[]; versions: WorksheetVersion[] }

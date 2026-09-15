import { M64_METHOD } from "./m64-contract"
export const M67_PROFILE = "neuvetra.synthetic.annual-electricity-worksheet.v1" as const
export const M67_REPORT_PROFILE = "neuvetra.synthetic.annual-electricity-report.v1" as const
export const M67_MONTHS = ["2023-01","2023-02","2023-03","2023-04","2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12"] as const
export const M67_METHOD = { ...M64_METHOD, policy:"m67-accounting-policy-v1", accountingProfile:"manual-synthetic-2023-camx-monthly-kwh-v1" } as const
export const M67_LIMITATIONS = ["synthetic_manual_input","no_bills_linked_to_annual_worksheet","overall_inventory_incomplete","calendar_2023_camx_single_facility_only","missing_months_not_zero","market_based_scope2_not_included","factor_and_method_not_released","scope_1_and_scope_3_not_assessed","no_assurance"] as const
export const M67_EVIDENCE_BASIS = "synthetic_manual_without_linked_bills" as const
export const M67_TEMPLATE_VERSION = "m67-calendar-2023-camx-report-v1" as const
export const M67_MAX_REPORT_BYTES = 98304 as const
export const M67_MEDIA_TYPE = "text/html; charset=utf-8" as const
export type AnnualMonth =
  | "2023-01" | "2023-02" | "2023-03" | "2023-04"
  | "2023-05" | "2023-06" | "2023-07" | "2023-08"
  | "2023-09" | "2023-10" | "2023-11" | "2023-12";
export type AnnualTotal = {
  unrounded: string; display: string;
  unit: "kg CO2e"; rounding: "half_even_4dp";
};
export type AnnualMonthInput = { month: AnnualMonth; quantityKwh: string | null };
export type AnnualMonthResult = AnnualMonthInput & {
  quantityMwh: string | null; total: AnnualTotal | null;
};
export type AnnualWorksheetInput = {
  companyLabel: string; facilityLabel: string;
  year: 2023; geography: "CAMX"; unit: "kWh";
  months: AnnualMonthInput[]; idempotencyKey: string;
};
export type AnnualWorksheetCorrection = AnnualWorksheetInput & {
  expectedVersionId: string; expectedResultSha256: string;
  correctionReason: string;
};
export type AnnualWorksheetReviewInput = {
  versionId: string; expectedResultSha256: string;
  decision: "accept_bounded_internal_draft" | "changes_requested";
  note: string | null; acknowledgedLimitations: string[];
  idempotencyKey: string;
};
export type AnnualWorksheetReview = {
  id: string; versionId: string; resultSha256: string;
  decision: AnnualWorksheetReviewInput["decision"];
  note: string | null; acknowledgedLimitations: string[];
  reviewerId: string; reviewedAt: string; decisionSha256: string;
};
export type AnnualWorksheetVersion = {
  id: string; version: number; previousVersionId: string | null;
  companyLabel: string; facilityLabel: string;
  year: 2023; geography: "CAMX"; unit: "kWh";
  evidenceBasis: "synthetic_manual_without_linked_bills";
  months: AnnualMonthResult[];
  coverage: {
    knownMonths: number; missingMonths: AnnualMonth[];
    electricityComplete: boolean;
  };
  quantityKwh: string; quantityMwh: string;
  total: AnnualTotal; correctionReason: string | null;
  inputSha256: string; resultSha256: string;
  createdBy: string; createdAt: string;
  method: typeof M67_METHOD; review: AnnualWorksheetReview | null;
};
export type AnnualElectricityWorksheet = {
  profile: "neuvetra.synthetic.annual-electricity-worksheet.v1";
  companyId: string; synthetic: true; complete: false;
  releaseEligible: false; assurance: "none";
  limitations: string[]; versions: AnnualWorksheetVersion[];
};
export type AnnualWorksheetReportInput = {
  sourceVersionId: string; expectedInputSha256: string;
  expectedResultSha256: string; expectedReviewId: string | null;
  expectedReviewSha256: string | null; idempotencyKey: string;
};
export type AnnualWorksheetReport = {
  id: string; companyId: string;
  profile: "neuvetra.synthetic.annual-electricity-report.v1";
  sourceVersionId: string; sourceVersion: number;
  inputSha256: string; resultSha256: string;
  reviewId: string | null; reviewSha256: string | null;
  reviewState: "unreviewed" | "accepted_bounded_internal_draft"
    | "changes_requested";
  templateVersion: "m67-calendar-2023-camx-report-v1";
  templateSha256: string; reportSha256: string;
  reportByteLength: number; createdBy: string; createdAt: string;
  synthetic: true; complete: false; releaseEligible: false;
  assurance: "none"; source: AnnualWorksheetVersion;
};
export type AnnualWorksheetReportList = {
  profile: "neuvetra.synthetic.annual-electricity-report.v1";
  companyId: string; reports: AnnualWorksheetReport[];
};

import type { ElectricitySource } from "./m66-contract"
import type { AnnualMonth, AnnualWorksheetVersion, AnnualWorksheetReview, AnnualWorksheetReviewInput, AnnualWorksheetReportInput } from "./m67-contract"

/** Additive evidence overlay. M66/M67 source records and contracts remain immutable.
 * Annual quantities are selected by exact M67 version, never copied/recalculated from bills.
 * Both currently approved source fixtures cover January 1–31, 2023 only.
 * Links may target entered January only. Missing input cannot receive a confirmed link.
 * Two distinct approved documents may be retained together: January is then explicitly
 * overlapping, has no unambiguous document coverage, and quantities are never summed.
 * Duplicate source IDs or source hashes are refused, including duplicate uploads.
 * Every unequal printed/manual quantity requires its own explanation; equality requires null.
 * Evidence linkage is manual, not verification, and does not grant release or assurance.
 */
export const M68_PROFILE = "neuvetra.synthetic.annual-electricity-evidence.v1" as const
export const M68_REPORT_PROFILE = "neuvetra.synthetic.annual-electricity-evidence-report.v1" as const
export const M68_TEMPLATE_VERSION = "m68-annual-evidence-report-v1" as const
export const M68_MEDIA_TYPE = "text/html; charset=utf-8" as const
export const M68_MAX_REPORT_BYTES = 98304 as const
export const M68_LIMITATIONS = ["synthetic_manual_confirmation", "document_attachment_not_verification", "only_january_2023_bill_fixtures_supported", "overlapping_documents_not_summed", "overall_inventory_incomplete", "calendar_2023_camx_single_facility_only", "missing_months_not_zero", "market_based_scope2_not_included", "factor_and_method_not_released", "scope_1_and_scope_3_not_assessed", "no_assurance"] as const

export type AnnualEvidenceLinkInput = {
  month: "2023-01"; sourceId: string; expectedSourceSha256: string;
  sourcePage: 1; manualConfirmation: true; quantityDifferenceReason: string | null;
}
export type AnnualEvidenceInput = {
  annualVersionId: string; expectedAnnualInputSha256: string;
  expectedAnnualResultSha256: string; links: AnnualEvidenceLinkInput[];
  idempotencyKey: string;
}
export type AnnualEvidenceCorrection = AnnualEvidenceInput & {
  expectedVersionId: string; expectedResultSha256: string; correctionReason: string;
}
export type AnnualEvidenceLink = {
  month: "2023-01"; source: ElectricitySource; page: 1;
  periodStart: "2023-01-01"; periodEnd: "2023-01-31";
  confirmedBy: string; confirmedAt: string; quantityDifferenceReason: string | null;
}
export type AnnualEvidenceCoverage = {
  enteredMonths: number; missingInputMonths: AnnualMonth[];
  linkedDocumentMonths: number; unambiguousDocumentMonths: number;
  missingDocumentMonths: AnnualMonth[]; overlappingDocumentMonths: AnnualMonth[];
  quantityDifferenceMonths: AnnualMonth[];
}
export type AnnualEvidenceReviewInput = AnnualWorksheetReviewInput
export type AnnualEvidenceReview = AnnualWorksheetReview
export type AnnualEvidenceVersion = {
  id: string; version: number; previousVersionId: string | null;
  /** Exact historical M67 snapshot, always with review:null. Its manual/no-bill
   * evidenceBasis describes M67's original record, not this M68 overlay. */
  annual: AnnualWorksheetVersion;
  links: AnnualEvidenceLink[]; coverage: AnnualEvidenceCoverage;
  correctionReason: string | null; inputSha256: string; resultSha256: string;
  createdBy: string; createdAt: string; review: AnnualEvidenceReview | null;
}
export type AnnualElectricityEvidence = {
  profile: typeof M68_PROFILE; companyId: string; synthetic: true;
  complete: false; releaseEligible: false; assurance: "none";
  limitations: string[]; versions: AnnualEvidenceVersion[];
}
export type AnnualEvidenceReportInput = AnnualWorksheetReportInput
export type AnnualEvidenceReport = {
  id: string; companyId: string; profile: typeof M68_REPORT_PROFILE;
  sourceVersionId: string; sourceVersion: number; inputSha256: string; resultSha256: string;
  reviewId: string | null; reviewSha256: string | null;
  reviewState: "unreviewed" | "accepted_bounded_internal_draft" | "changes_requested";
  templateVersion: typeof M68_TEMPLATE_VERSION; templateSha256: string;
  reportSha256: string; reportByteLength: number; createdBy: string; createdAt: string;
  synthetic: true; complete: false; releaseEligible: false; assurance: "none";
  source: AnnualEvidenceVersion;
}
export type AnnualEvidenceReportList = {
  profile: typeof M68_REPORT_PROFILE; companyId: string; reports: AnnualEvidenceReport[];
}

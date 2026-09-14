import type { WorksheetVersion } from "./m64-contract"
export const M65_PROFILE = "neuvetra.synthetic.worksheet-report.v1" as const
export const M65_TEMPLATE_VERSION = "m65-january-camx-report-v1" as const
export const M65_MEDIA_TYPE = "text/html; charset=utf-8" as const
export const M65_MAX_REPORT_BYTES = 65536 as const
export interface WorksheetReportInput {
  sourceVersionId: string
  expectedInputSha256: string
  expectedResultSha256: string
  expectedReviewId: string | null
  expectedReviewSha256: string | null
  idempotencyKey: string
}
export interface WorksheetReport {
  id: string; companyId: string; profile: typeof M65_PROFILE
  sourceVersionId: string; sourceVersion: number; inputSha256: string; resultSha256: string
  reviewId: string | null; reviewSha256: string | null
  reviewState: "unreviewed" | "accepted_bounded_internal_draft" | "changes_requested"
  templateVersion: typeof M65_TEMPLATE_VERSION; templateSha256: string
  reportSha256: string; reportByteLength: number; createdBy: string; createdAt: string
  synthetic: true; complete: false; releaseEligible: false; assurance: "none"
  source: WorksheetVersion
}
export interface WorksheetReportList { profile: typeof M65_PROFILE; companyId: string; reports: WorksheetReport[] }

export const M61_PROFILE = "neuvetra.synthetic.inventory-draft-report-review.v1" as const

export const M61_LIMITATION_ACKNOWLEDGMENTS = [
  "overall_inventory_incomplete",
  "one_period_estimated",
  "one_period_excluded",
  "market_based_scope2_not_included",
  "factor_and_method_not_released",
  "scope_1_and_scope_3_not_assessed",
  "synthetic_local_only_no_assurance",
] as const

export const M61_CHANGE_ROUTE_CODES = [
  "source_evidence_revision_required",
  "calculation_revision_required",
  "inventory_boundary_or_period_revision_required",
  "report_presentation_revision_required",
] as const

export type DraftReportReviewDecision = "accept_bounded_internal_draft" | "changes_requested"
export type DraftReportReviewReason = "exact_report_reviewed_for_bounded_internal_use" | "report_revision_required"
export type DraftReportChangeRouteCode = typeof M61_CHANGE_ROUTE_CODES[number]

export interface DraftReportReviewInput {
  decision: DraftReportReviewDecision
  reasonCode: DraftReportReviewReason
  acknowledgedLimitations: string[]
  changeRouteCode: DraftReportChangeRouteCode | null
  changeNote: string | null
  expectedReportSha256: string
  idempotencyKey: string
}

export interface DraftReportDecisionSnapshotInput {
  companyId:string;reportId:string;profile:typeof M61_PROFILE;decision:DraftReportReviewDecision;outcome:"accepted_bounded_internal_draft"|"changes_requested";reasonCode:DraftReportReviewReason;acknowledgedLimitations:string[];changeRouteCode:DraftReportChangeRouteCode|null;changeNote:string|null;reportSha256:string;reportCreatedBy:string;inventorySnapshotSha256:string;sourceArchiveSha256:string;sourceManifestSha256:string;sourceLineageRootSha256:string;releaseEligible:false;reviewerIdentity:string
}

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/

export function validateDraftReportReviewInput(input: Omit<DraftReportReviewInput, "expectedReportSha256" | "idempotencyKey">): void {
  if (input.decision === "accept_bounded_internal_draft") {
    if (input.reasonCode !== "exact_report_reviewed_for_bounded_internal_use" ||
      JSON.stringify(input.acknowledgedLimitations) !== JSON.stringify(M61_LIMITATION_ACKNOWLEDGMENTS) ||
      input.changeRouteCode !== null || input.changeNote !== null) {
      throw new Error("Draft report review input is invalid.")
    }
    return
  }
  const note = input.changeNote
  if (input.decision !== "changes_requested" || input.reasonCode !== "report_revision_required" ||
    input.acknowledgedLimitations.length !== 0 ||
    !M61_CHANGE_ROUTE_CODES.includes(input.changeRouteCode as DraftReportChangeRouteCode) ||
    typeof note !== "string" || note !== note.trim() || note.length < 1 || note.length > 500 || CONTROL_CHARACTER.test(note)) {
    throw new Error("Draft report review input is invalid.")
  }
}

export function draftReportDecisionSnapshotPayload(input:DraftReportDecisionSnapshotInput):string {
  return [
    "version=1",`companyId=${input.companyId}`,`reportId=${input.reportId}`,`profile=${input.profile}`,`decision=${input.decision}`,`outcome=${input.outcome}`,`reasonCode=${input.reasonCode}`,
    `acknowledgedLimitations=${input.acknowledgedLimitations.join(",")}`,`changeRouteCode=${input.changeRouteCode??"<null>"}`,`changeNote=${input.changeNote??"<null>"}`,
    `reportSha256=${input.reportSha256}`,`reportCreatedBy=${input.reportCreatedBy}`,`inventorySnapshotSha256=${input.inventorySnapshotSha256}`,`sourceArchiveSha256=${input.sourceArchiveSha256}`,`sourceManifestSha256=${input.sourceManifestSha256}`,`sourceLineageRootSha256=${input.sourceLineageRootSha256}`,"releaseEligible=false",`reviewerIdentity=${input.reviewerIdentity}`,
  ].join("\n")
}

export function hashDraftReportDecisionSnapshot(input:DraftReportDecisionSnapshotInput):string {
  return new Bun.CryptoHasher("sha256").update(draftReportDecisionSnapshotPayload(input)).digest("hex")
}

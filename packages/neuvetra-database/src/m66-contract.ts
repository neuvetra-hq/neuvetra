import { M64_METHOD, type WorksheetInput, type WorksheetReviewInput, type WorksheetReview, type WorksheetVersion } from "./m64-contract"
export const M66_PROFILE = "neuvetra.synthetic.source-electricity-worksheet.v1" as const
export const M66_SOURCE_PROFILE = "neuvetra.synthetic.electricity-source.v1" as const
export const M66_METHOD = M64_METHOD
export const M66_LIMITATIONS = ["synthetic_manual_confirmation","document_attachment_not_verification","overall_inventory_incomplete","january_2023_camx_only","market_based_scope2_not_included","factor_and_method_not_released","scope_1_and_scope_3_not_assessed","no_assurance"] as const
export const M66_MAX_SOURCE_BYTES = 262144 as const
export interface ElectricitySource { id:string; companyId:string; fixtureId:string; originalName:string; mediaType:"application/pdf"; byteLength:number; sha256:string; printedQuantityKwh:string; uploadedBy:string; uploadedAt:string }
export interface ElectricitySourceList { profile:typeof M66_SOURCE_PROFILE; companyId:string; sources:ElectricitySource[] }
export interface SourceWorksheetInput extends WorksheetInput { sourceId:string; expectedSourceSha256:string; sourcePage:1; manualConfirmation:true; quantityDifferenceReason:string|null }
export interface SourceWorksheetCorrection extends SourceWorksheetInput { expectedVersionId:string; expectedResultSha256:string; correctionReason:string }
export type SourceWorksheetReviewInput = WorksheetReviewInput
export type SourceWorksheetReview = WorksheetReview
export interface SourceWorksheetEvidence { source:ElectricitySource; page:1; confirmedBy:string; confirmedAt:string; quantityDifferenceReason:string|null }
export interface SourceWorksheetVersion extends WorksheetVersion { evidence:SourceWorksheetEvidence }
export interface SourceElectricityWorksheet { profile:typeof M66_PROFILE; companyId:string; synthetic:true; complete:false; releaseEligible:false; assurance:"none"; limitations:string[]; versions:SourceWorksheetVersion[] }
export const M66_REPORT_PROFILE = "neuvetra.synthetic.source-electricity-report.v1" as const
export const M66_TEMPLATE_VERSION = "m66-source-january-camx-report-v1" as const
export const M66_MEDIA_TYPE = "text/html; charset=utf-8" as const
export const M66_MAX_REPORT_BYTES = 98304 as const
export interface SourceWorksheetReportInput { sourceVersionId:string; expectedInputSha256:string; expectedResultSha256:string; expectedReviewId:string|null; expectedReviewSha256:string|null; idempotencyKey:string }
export interface SourceWorksheetReport {
 id:string; companyId:string; profile:typeof M66_REPORT_PROFILE; sourceVersionId:string; sourceVersion:number; inputSha256:string; resultSha256:string;
 reviewId:string|null; reviewSha256:string|null; reviewState:"unreviewed"|"accepted_bounded_internal_draft"|"changes_requested";
 templateVersion:typeof M66_TEMPLATE_VERSION; templateSha256:string; reportSha256:string; reportByteLength:number; createdBy:string; createdAt:string;
 synthetic:true; complete:false; releaseEligible:false; assurance:"none"; source:SourceWorksheetVersion
}
export interface SourceWorksheetReportList { profile:typeof M66_REPORT_PROFILE; companyId:string; reports:SourceWorksheetReport[] }

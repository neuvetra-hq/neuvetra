import type {M71Version} from './m71-contract'
import type {M74Version} from './m74-contract'

export const M75_PROFILE='synthetic-controlled-fleet-v1' as const
export const M75_RECONCILIATION_PROFILE='m75-fleet-reconciliation-v1' as const
export const M75_PERIOD={start:'2025-01-01',endExclusive:'2026-01-01'} as const
export const M75_LIMITATIONS=['synthetic_only','declared_roster_reconciliation_only','scope1_incomplete','corporate_inventory_incomplete','factor_and_method_not_released','no_emissions_aggregation','requirements_not_determined','no_external_assurance'] as const
export const M75_MAX_ASSETS=25, M75_MAX_VERSIONS=40, M75_MAX_REPORTS=40, M75_MAX_VERSION_BYTES=100000, M75_MAX_REPORT_BYTES=131072, M75_MAX_HISTORY_BYTES=3800000, M75_MAX_RESPONSE_BYTES=4000000

export interface M75Pin {id:string;sha256:string}
export interface M75Period {start:string;endExclusive:string}
export type M75Control='owned_operational_control_full_year'|'other_control_arrangement'|'unknown'
export type M75Mode='on_road'|'off_road'|'rail'|'marine'|'air'|'other'|'unknown'
export interface M75RosterAsset {rowId:string;assetId:string|null;aliases:string[];entityId:string|null;facilityId:string|null;period:M75Period|null;mode:M75Mode;vehicleClass:string|null;modelYear:number|null;fuel:string|null;controlBasis:M75Control;classificationBasis:string|null;controlExplanation:string|null}
export interface M75StatementInput {issuer:string;reference:string;description:string;discoveryBasis:string;coveredEntityIds:string[];completeness:'declared_complete'|'partial'|'unknown';allTripLocationsIncluded:boolean;assets:M75RosterAsset[]}
export interface M75Link {rowId:string;sourceId:string|null}
export interface M75SaveInput {profile:typeof M75_PROFILE;coverageVersionId:string;coverageVersionSha256:string;expectedDependencySha256:string;period:M75Period;rosterStatement:M75StatementInput|null;manualConfirmation:boolean;links:M75Link[];expectedVersionId:string|null;expectedVersionSha256:string|null;correctionReason:string|null;idempotencyKey:string}
export type M75Activity=Omit<M75SaveInput,'expectedDependencySha256'|'expectedVersionId'|'expectedVersionSha256'|'correctionReason'|'idempotencyKey'>
export interface M75WorkpaperPin {worksheetId:string;sourceId:string;assetId:string;version:M75Pin;decision:M75Pin|null}
export interface M75Dependencies {coveragePin:M75Pin|null;coverageReviewPin:M75Pin|null;workpaperPins:M75WorkpaperPin[];dependencySha256:string}
export interface M75Statement {id:string;profile:'m75-synthetic-roster-statement-v1';input:M75StatementInput;locator:string;text:string;sha256:string;byteLength:number}
export interface M75Finding {code:string;rowKey:string|null;message:string;blocking:boolean}
export interface M75Version {id:string;companyId:string;rosterId:string;version:number;previousVersionId:string|null;previousVersionSha256:string|null;createdBy:string;createdAt:string;contributorIds:string[];correctionReason:string|null;activity:M75Activity;dependencies:M75Dependencies;statement:M75Statement|null;findings:M75Finding[];inputSha256:string;contentSha256:string;versionSha256:string;synthetic:true;scope1Completeness:'incomplete';corporateCompleteness:'incomplete';releaseEligible:false;assurance:'none';emissionsTotals:null}
export interface M75ReviewInput {versionId:string;expectedVersionSha256:string;expectedDependencySha256:string;decision:'accepted_bounded_reconciliation'|'changes_requested';note:string;acknowledgedLimitations:string[];idempotencyKey:string}
export interface M75Review {id:string;versionId:string;versionSha256:string;dependencies:M75Dependencies;decision:M75ReviewInput['decision'];note:string;acknowledgedLimitations:string[];reviewerId:string;reviewedAt:string;decisionSha256:string}
export type M75RowStatus='unknown'|'unsupported'|'duplicate'|'missing_source'|'missing_workpaper'|'orphan_source'|'orphan_workpaper'|'stale'|'workpaper_incomplete'|'capacity_blocked'|'matched_reviewed'
export interface M75ReconciliationRow {rowKey:string;rosterRowId:string|null;sourceId:string|null;assetId:string|null;worksheetIds:string[];entityLabel:string|null;facilityLabel:string|null;sourceLabel:string|null;status:M75RowStatus;findings:M75Finding[]}
export interface M75Counts {evidenceRows:number;declaredUniqueKnownAssets:number;currentMobileSources:number;currentWorkpaperStreams:number;reconciledRows:number;blockingFindings:number}
export interface M75Reconciliation {profile:typeof M75_RECONCILIATION_PROFILE;companyId:string;period:M75Period;rosterPin:M75Pin|null;rosterReviewPin:M75Pin|null;coveragePin:M75Pin|null;coverageReviewPin:M75Pin|null;workpaperPins:M75WorkpaperPin[];rows:M75ReconciliationRow[];findings:M75Finding[];counts:M75Counts;status:'blocked'|'reconciled_bounded_synthetic';dependencySha256:string;contentSha256:string;limitations:string[];synthetic:true;scope1Completeness:'incomplete';corporateCompleteness:'incomplete';releaseEligible:false;assurance:'none';emissionsTotals:null}
export interface M75ReportInput {expectedReconciliationSha256:string;idempotencyKey:string}
export interface M75Report {id:string;companyId:string;rosterId:string;rosterVersionId:string;createdBy:string;createdAt:string;rendererVersion:'m75-fleet-reconciliation-report-v1';snapshotJson:string;snapshotSha256:string;html:string;htmlSha256:string;htmlByteLength:number;reportSha256:string}
export type M75ReportMetadata=Omit<M75Report,'snapshotJson'|'html'>
export interface M75Proof {coverageVersion:M71Version|null;boundCoverageVersion:M71Version|null;workpaperVersions:M74Version[]}
export interface M75ReportProof {reportId:string;proof:M75Proof}
export interface M75Register {profile:typeof M75_PROFILE;companyId:string;rosterId:string|null;headVersionId:string|null;versions:M75Version[];reviews:M75Review[];reports:M75ReportMetadata[];proof:M75Proof;reconciliation:M75Reconciliation;limitations:string[]}

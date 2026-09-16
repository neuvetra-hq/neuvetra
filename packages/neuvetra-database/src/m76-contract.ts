import type {M71Version} from './m71-contract'
import type {M73Authority,M73Version} from './m73-contract'
import type {M76DieselAuthority,M76DieselVersion} from './m76-diesel-contract'

export const M76_PROFILE='synthetic-stationary-equipment-v1' as const
export const M76_RECONCILIATION_PROFILE='m76-stationary-reconciliation-v1' as const
export const M76_PERIOD={start:'2025-01-01',endExclusive:'2026-01-01'} as const
export const M76_LIMITATIONS=['synthetic_only','declared_stationary_reconciliation_only','scope1_incomplete','corporate_inventory_incomplete','factor_and_method_not_released','no_emissions_aggregation','requirements_not_determined','no_external_assurance'] as const
export const M76_MAX_ASSETS=25,M76_MAX_VERSIONS=40,M76_MAX_REPORTS=40,M76_MAX_VERSION_BYTES=100000,M76_MAX_REPORT_BYTES=131072,M76_MAX_HISTORY_BYTES=3800000,M76_MAX_RESPONSE_BYTES=4000000
export interface M76Authorities {gas:M73Authority;diesel:M76DieselAuthority}
export interface M76Pin {id:string;sha256:string}
export interface M76Period {start:string;endExclusive:string}
export type M76Control='owned_operational_control_full_year'|'other_control_arrangement'|'unknown'
export type M76EquipmentType='boiler'|'space_heater'|'stationary_emergency_generator'|'other'|'unknown'
export interface M76MeterRelationship {issuer:string|null;meterLabel:string|null;measurementBasis:'dedicated_single_device_consumption'|'shared_meter'|'shared_tank_allocation'|'stock_derived'|'other'|'unknown';dedicatedToSingleDevice:boolean|null;explanation:string|null}
export interface M76RosterAsset {rowId:string;equipmentId:string|null;aliases:string[];identifierBasis:string|null;entityId:string|null;facilityId:string|null;period:M76Period|null;equipmentType:M76EquipmentType;fuel:string|null;controlBasis:M76Control;classificationBasis:string|null;controlExplanation:string|null;meterRelationship:M76MeterRelationship|null}
export interface M76StatementInput {issuer:string;reference:string;description:string;discoveryBasis:string;coveredEntityIds:string[];coveredFacilityIds:string[];completeness:'declared_complete'|'partial'|'unknown';allControlledLocationsIncluded:boolean;assets:M76RosterAsset[]}
export interface M76Link {rowId:string;sourceId:string|null}
export interface M76SaveInput {profile:typeof M76_PROFILE;coverageVersionId:string;coverageVersionSha256:string;expectedDependencySha256:string;period:M76Period;rosterStatement:M76StatementInput|null;manualConfirmation:boolean;links:M76Link[];expectedVersionId:string|null;expectedVersionSha256:string|null;correctionReason:string|null;idempotencyKey:string}
export type M76Activity=Omit<M76SaveInput,'expectedDependencySha256'|'expectedVersionId'|'expectedVersionSha256'|'correctionReason'|'idempotencyKey'>
export interface M76WorkpaperPin {family:'natural_gas'|'stationary_diesel';worksheetId:string;sourceId:string;equipmentId:string|null;version:M76Pin;decision:M76Pin|null}
export interface M76Dependencies {coveragePin:M76Pin|null;coverageReviewPin:M76Pin|null;workpaperPins:M76WorkpaperPin[];dependencySha256:string}
export interface M76Statement {id:string;profile:'m76-synthetic-equipment-statement-v1';input:M76StatementInput;locator:string;text:string;sha256:string;byteLength:number}
export interface M76Finding {code:string;rowKey:string|null;message:string;blocking:boolean}
export interface M76Version {id:string;companyId:string;rosterId:string;version:number;previousVersionId:string|null;previousVersionSha256:string|null;createdBy:string;createdAt:string;contributorIds:string[];correctionReason:string|null;activity:M76Activity;dependencies:M76Dependencies;statement:M76Statement|null;findings:M76Finding[];inputSha256:string;contentSha256:string;versionSha256:string;synthetic:true;scope1Completeness:'incomplete';corporateCompleteness:'incomplete';releaseEligible:false;assurance:'none';emissionsTotals:null}
export interface M76ReviewInput {versionId:string;expectedVersionSha256:string;expectedDependencySha256:string;decision:'accepted_bounded_reconciliation'|'changes_requested';note:string;acknowledgedLimitations:string[];idempotencyKey:string}
export interface M76Review {id:string;versionId:string;versionSha256:string;dependencies:M76Dependencies;decision:M76ReviewInput['decision'];note:string;acknowledgedLimitations:string[];reviewerId:string;reviewedAt:string;decisionSha256:string}
export type M76RowStatus='unknown'|'unsupported'|'duplicate'|'missing_source'|'missing_workpaper'|'orphan_source'|'orphan_workpaper'|'stale'|'workpaper_incomplete'|'capacity_blocked'|'matched_reviewed'
export interface M76ReconciliationRow {rowKey:string;rosterRowId:string|null;sourceId:string|null;equipmentId:string|null;worksheetIds:string[];entityLabel:string|null;facilityLabel:string|null;sourceLabel:string|null;status:M76RowStatus;findings:M76Finding[]}
export interface M76Counts {evidenceRows:number;declaredUniqueKnownEquipment:number;currentStationarySources:number;currentWorkpaperStreams:number;reconciledRows:number;blockingFindings:number}
export interface M76Reconciliation {profile:typeof M76_RECONCILIATION_PROFILE;companyId:string;period:M76Period;rosterPin:M76Pin|null;rosterReviewPin:M76Pin|null;coveragePin:M76Pin|null;coverageReviewPin:M76Pin|null;workpaperPins:M76WorkpaperPin[];rows:M76ReconciliationRow[];findings:M76Finding[];counts:M76Counts;status:'blocked'|'reconciled_bounded_synthetic';dependencySha256:string;contentSha256:string;limitations:string[];synthetic:true;scope1Completeness:'incomplete';corporateCompleteness:'incomplete';releaseEligible:false;assurance:'none';emissionsTotals:null}
export interface M76ReportInput {expectedReconciliationSha256:string;idempotencyKey:string}
export interface M76Report {id:string;companyId:string;rosterId:string;rosterVersionId:string;createdBy:string;createdAt:string;rendererVersion:'m76-stationary-reconciliation-report-v1';snapshotJson:string;snapshotSha256:string;html:string;htmlSha256:string;htmlByteLength:number;reportSha256:string}
export type M76ReportMetadata=Omit<M76Report,'snapshotJson'|'html'>
export interface M76Proof {coverageVersion:M71Version|null;boundCoverageVersion:M71Version|null;gasWorkpaperVersions:M73Version[];dieselWorkpaperVersions:M76DieselVersion[]}
export interface M76ReportProof {reportId:string;proof:M76Proof}
export interface M76Register {profile:typeof M76_PROFILE;companyId:string;rosterId:string|null;headVersionId:string|null;versions:M76Version[];reviews:M76Review[];reports:M76ReportMetadata[];proof:M76Proof;reconciliation:M76Reconciliation;limitations:string[]}

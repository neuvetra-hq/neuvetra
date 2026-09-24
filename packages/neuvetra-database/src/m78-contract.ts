import type {M71Version} from './m71-contract'
import type {M73Authority,M73Version} from './m73-contract'
import type {M74Authority,M74Version} from './m74-contract'
import type {M75Version,M75Review,M75Reconciliation} from './m75-contract'
import type {M76Version,M76Review,M76Reconciliation} from './m76-contract'
import type {M76DieselAuthority,M76DieselVersion} from './m76-diesel-contract'
import type {M77Authority,M77Version,M77Review,M77Reconciliation,M77SourceVersion} from './m77-contract'
export const M78_PROCESS_PROFILE='synthetic-process-screen-v1' as const
export const M78_INVENTORY_PROFILE='synthetic-scope1-inventory-v1' as const
export const M78_PERIOD={start:'2025-01-01',endExclusive:'2026-01-01'} as const
export const M78_LIMITATIONS=['synthetic_only','scope1_incomplete','corporate_inventory_incomplete','factor_and_method_not_released','requirements_not_determined','no_external_assurance'] as const
export const M78_GAS_GROUPS=['CO2','CH4','N2O','HFCs','PFCs','SF6','NF3'] as const
export const M78_CATEGORIES=['mineral_products','chemical_production','metal_production','oil_and_gas','waste_treatment','agricultural_biological','other_direct_process'] as const
export const M78_MAX_VERSIONS=40,M78_MAX_REPORTS=80,M78_MAX_ACTIVITY_BYTES=200000,M78_MAX_PROOF_BYTES=4000000,M78_MAX_HISTORY_BYTES=30000000,M78_MAX_RESPONSE_BYTES=10000000
export type M78Family='process_screen'|'inventory'
export type M78SourceFamily='natural_gas'|'stationary_diesel'|'mobile_diesel'|'fugitive'
export interface M78Pin {id:string;sha256:string}
export interface M78CoverageBinding {coverageVersionId:string;coverageVersionSha256:string;processCoverageItemId:string;period:typeof M78_PERIOD}
export interface M78EvidenceInput {reference:string;issuer:string;description:string;issuedOn:string;purpose:'business_activity'|'process_inspection'|'offsite_discovery';entityId:string;facilityId:string|null}
export interface M78Statement extends M78EvidenceInput {id:string;locator:string;text:string;sha256:string;byteLength:number}
export interface M78ProcessLocation {rowId:string;entityId:string;facilityId:string|null;operationId:string|null;businessActivities:string;equipmentAndMaterials:string;controlExplanation:string;evidenceReferences:string[]}
export interface M78ProcessAssessment {rowId:string;category:typeof M78_CATEGORIES[number];discoveredSourceId:string|null;locationRowIds:string[];disposition:'unknown'|'indicated'|'not_applicable_proposed';reason:string|null;evidenceReferences:string[]}
export interface M78GasCoverage {gasGroup:typeof M78_GAS_GROUPS[number];state:'unknown'|'indicated'|'not_applicable_proposed'|'covered_by_sources';sourceIds:string[];discoveredSourceIds:string[];locationRowIds:string[];reason:string|null;evidenceReferences:string[]}
export interface M78ProcessActivity {profile:typeof M78_PROCESS_PROFILE;binding:M78CoverageBinding;declaration:{completeness:'unknown'|'partial'|'declared_complete';coveredEntityIds:string[];coveredFacilityIds:string[];allControlledOperationsIncluded:boolean;discoveryBasis:string}|null;locations:M78ProcessLocation[];assessments:M78ProcessAssessment[];gasCoverage:M78GasCoverage[];evidenceStatements:M78EvidenceInput[];manualConfirmation:boolean}
export interface M78InventoryActivity {profile:typeof M78_INVENTORY_PROFILE;binding:M78CoverageBinding;note:string}
export interface M78Predecessor {expectedVersionId:string|null;expectedVersionSha256:string|null;expectedDependencySha256:string;correctionReason:string|null;idempotencyKey:string}
export type M78ProcessSaveInput=M78ProcessActivity&M78Predecessor
export type M78InventorySaveInput=M78InventoryActivity&M78Predecessor
export interface M78SourcePin {family:M78SourceFamily;worksheetId:string;sourceId:string;physicalId:string|null;version:M78Pin;decision:M78Pin|null}
export interface M78DiscoveryPin {family:'fleet'|'stationary'|'fugitive';version:M78Pin|null;decision:M78Pin|null;dependencySha256:string;reconciliationSha256:string}
export interface M78Dependencies {coveragePin:M78Pin;coverageReviewPin:M78Pin|null;processVersionPin:M78Pin|null;processReviewPin:M78Pin|null;sourcePins:M78SourcePin[];discoveryPins:M78DiscoveryPin[];policySha256:string|null;rulesVersion:'m78-gross-scope1-v1';dependencySha256:string}
export type M78Classification='functional_blocker'|'release_blocker'|'corporate_gap'|'resolved_bounded'
export interface M78Finding {code:string;origin:{family:string;recordId:string|null;originalCode:string};classification:M78Classification;message:string;resolution:{ruleId:string;pins:M78Pin[]}|null}
export type M78SourceVersion=M73Version|M74Version|M76DieselVersion|M77SourceVersion
export interface M78Proof {priorVersions:M78Version[];coverageVersion:M71Version;boundCoverageVersions:M71Version[];sourceVersions:{family:M78SourceFamily;version:M78SourceVersion}[];fleet:{version:M75Version|null;review:M75Review|null;reconciliation:M75Reconciliation};stationary:{version:M76Version|null;review:M76Review|null;reconciliation:M76Reconciliation};fugitive:{version:M77Version|null;review:M77Review|null;reconciliation:M77Reconciliation};process:{version:M78Version;review:M78Review|null;proof:M78Proof}|null;policy:M78Policy|null}
export interface M78Policy {id:string;status:'accounting_reviewed_candidate';releaseEligible:false;reviewArtifact:{path:string;sha256:string};methods:{family:M78SourceFamily;methodSha256:string}[];gasGwps:{gas:string;gwp:string;gasKind:'single_gas'|'blend'}[];blendDisclosure:'opaque_blend_no_constituent_guess';rounding:'half_even_4dp';policySha256:string}
export interface M78GasContribution {sourceId:string;family:M78SourceFamily;physicalId:string|null;entityId:string;facilityId:string|null;gas:string;gasKind:'single_gas'|'blend';massKgExact:string;co2eKgExact:string;originalMass:string;originalMassUnit:string;methodPin:string;gwpPolicyPin:string;estimateBasis:string|null}
export interface M78Rollup {id:string;label:string;kgCo2eExact:string;kgCo2eDisplay:string;gasLines:{gas:string;gasKind:'single_gas'|'blend';massKgExact:string;kgCo2eExact:string}[]}
export interface M78Totals {gasLines:M78Rollup['gasLines'];sourceRows:M78Rollup[];facilityRows:M78Rollup[];entityRows:M78Rollup[];company:{kgCo2eExact:string;kgCo2eDisplay:string;rounding:'half_even_4dp'};displayRoundingDelta:string}
export interface M78Reconciliation {dependencies:M78Dependencies;sourceUnion:{sourceId:string|null;physicalId:string|null;family:string;entityId:string|null;facilityId:string|null}[];findings:M78Finding[];knownSourceSubtotal:M78Totals|null;totals:M78Totals|null;status:'blocked'|'reconciled_bounded_synthetic';contentSha256:string}
export interface M78ReviewInput {versionId:string;expectedVersionSha256:string;expectedDependencySha256:string;decision:'accepted_bounded_process_screen'|'accepted_bounded_inventory'|'changes_requested';note:string;acknowledgedLimitations:string[];idempotencyKey:string}
export interface M78Review {id:string;versionId:string;versionSha256:string;dependencies:M78Dependencies;decision:M78ReviewInput['decision'];note:string;acknowledgedLimitations:string[];reviewerId:string;reviewedAt:string;decisionSha256:string}
export interface M78Version {id:string;companyId:string;streamId:string;family:M78Family;version:number;previousVersionId:string|null;previousVersionSha256:string|null;createdBy:string;createdAt:string;contributorIds:string[];correctionReason:string|null;activity:M78ProcessActivity|M78InventoryActivity;dependencies:M78Dependencies;statements:M78Statement[];findings:M78Finding[];reconciliation:M78Reconciliation|null;inputSha256:string;contentSha256:string;versionSha256:string;synthetic:true;scope1Completeness:'incomplete';corporateCompleteness:'incomplete';releaseEligible:false;assurance:'none';review:M78Review|null}
export interface M78VersionEnvelope {version:M78Version;proof:M78Proof}
export interface M78ReportInput {versionId:string;expectedVersionSha256:string;expectedDecisionId:string|null;expectedDecisionSha256:string|null;expectedReconciliationSha256:string|null;idempotencyKey:string}
export interface M78ReportSnapshot {profile:'m78-report-snapshot-v1';family:M78Family;version:M78Version;review:M78Review|null;proof:M78Proof;reconciliation:M78Reconciliation|null;limitations:string[]}
export interface M78Report {id:string;companyId:string;streamId:string;family:M78Family;versionId:string;versionSha256:string;createdBy:string;createdAt:string;rendererVersion:'m78-retained-report-v1';snapshotJson:string;snapshotSha256:string;html:string;htmlSha256:string;htmlByteLength:number;reportSha256:string}
export interface M78Register {profile:'synthetic-scope1-register-v1';companyId:string;versionProofs:{versionId:string;proof:M78Proof}[];coverageVersion:M71Version;dependencies:M78Dependencies;process:{streamId:string|null;headVersionId:string|null;versions:M78Version[];reviews:M78Review[];reports:Omit<M78Report,'html'|'snapshotJson'>[]};inventory:{streamId:string|null;headVersionId:string|null;versions:M78Version[];reviews:M78Review[];reports:Omit<M78Report,'html'|'snapshotJson'>[]};proof:M78Proof;reconciliation:M78Reconciliation;limitations:string[]}
export interface M78Authorities {gas:M73Authority;mobile:M74Authority;diesel:M76DieselAuthority;fugitive:M77Authority}

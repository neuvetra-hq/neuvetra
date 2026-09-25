import { open, readFile } from "node:fs/promises"
import { realpathSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { parseM80Json } from "../../packages/neuvetra-database/src/m80-validation"
import {
  M80_ACCEPTED_CANDIDATE_SHA256,
  M80_HOSTED_PREPARATION_PROFILE,
  M80_MIGRATION_0022_SHA256,
  M80_REQUIRED_CHECKS,
  m80HostedCanonicalJson,
  m80HostedSha256,
  validateM80HostedPreparationPlanContents,
  type EvidencePin,
  type M80HostedPreparationPlan,
} from "./m80-hosted-prep-independent-20260924-candidate5-frozen-prepare"

export const M80_HOSTED_GATE_PROFILE = "neuvetra.m80.foundation-hosted-execution-gate.v1" as const
export const M80_HOSTED_INTENT_PROFILE = "neuvetra.m80.foundation-hosted-durable-intent.v1" as const
export const M80_HOSTED_OBSERVATION_PROFILE = "neuvetra.m80.foundation-hosted-outcome-observation.v1" as const
export const M80_HOSTED_OUTCOME_PROFILE = "neuvetra.m80.foundation-hosted-durable-outcome.v1" as const
export type M80HostedStage = "migration" | "admission" | "deployment"

export interface M80HostedExecutionGate {
  profile: typeof M80_HOSTED_GATE_PROFILE
  stage: M80HostedStage
  reviewedAt: string
  expiresAt: string
  verdict: "pass"
  operatorId: "/root"
  independentReviewerId: string
  plan: EvidencePin
  planSha256: string
  candidateSha256: typeof M80_ACCEPTED_CANDIDATE_SHA256
  migrationSha256: typeof M80_MIGRATION_0022_SHA256
  reviewedHeadCommitSha: string
  exactRequiredChecksPassed: true
  targetObservation: EvidencePin
  targetReobservedAt: string
  targetProjectRef: string
  targetEnvironmentId: string
  targetServiceId: string
  currentSchemaVersion: 21 | 22
  currentMigrationReceiptCount: 21 | 22
  currentApplicationStateSha256: string
  writeQuiescenceMechanism: "provider_deployment_stopped_and_origin_readiness_unavailable"
  activeDeploymentCount: 0
  originReadinessUnavailable: true
  noActiveApplicationWritesObserved: true
  securityReview: EvidencePin
  integrationAcceptance: EvidencePin
  rootSoleExecutorAccepted: true
  noAutomaticRetryAccepted: true
}

export interface M80HostedIntent {
  profile: typeof M80_HOSTED_INTENT_PROFILE
  createdAt: string
  stage: M80HostedStage
  status: "intent_sealed_not_executed"
  plan: EvidencePin
  gate: EvidencePin
  planSha256: string
  operationScopeSha256: string
  targetProjectRef: string
  targetEnvironmentId: string
  targetServiceId: string
  actionIdentity: Record<string, unknown>
  prerequisiteOutcomes: EvidencePin[]
  noCredentialOrRequestBodyStored: true
  noAutomaticRetry: true
  intentSha256: string
}

export interface M80HostedOutcome {
  profile: typeof M80_HOSTED_OUTCOME_PROFILE
  recordedAt: string
  stage: M80HostedStage
  intent: EvidencePin
  intentSha256: string
  status: "verified_success" | "verified_failure_do_not_retry" | "uncertain_do_not_retry"
  authoritativeObservation: EvidencePin
  nextActionAllowed: boolean
  outcomeSha256: string
}

export interface M80HostedLoadedEvidence { value: unknown; pin: EvidencePin }
export interface M80HostedPredecessorArtifacts {
  intent: unknown
  intentPin: EvidencePin
  gate: unknown
  gatePin: EvidencePin
  gateEvidence: { securityReview: M80HostedLoadedEvidence; integrationAcceptance: M80HostedLoadedEvidence; targetObservation: M80HostedLoadedEvidence }
  observation: unknown
  observationPin: EvidencePin
  outcome: unknown
  outcomePin: EvidencePin
}

const SHA256 = /^[0-9a-f]{64}$/
const SHA1 = /^[0-9a-f]{40}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function closed(value: unknown, keys: string[], name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error(`${name} must contain only exact reviewed fields.`)
}

function pin(value: unknown, name: string): EvidencePin {
  closed(value, ["path", "sha256"], name)
  if (typeof value.path !== "string" || !value.path || isAbsolute(value.path) || value.path.includes("\\") || value.path.split("/").includes("..") || typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) throw new Error(`${name} must be a safe byte pin.`)
  return value as unknown as EvidencePin
}

function iso(value: unknown, name: string): number {
  if (typeof value !== "string") throw new Error(`${name} must be canonical ISO UTC.`)
  const time = Date.parse(value)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) throw new Error(`${name} must be canonical ISO UTC.`)
  return time
}

function signedHash(value: Record<string, unknown>, hashField: string): string {
  const unsigned = { ...value }
  delete unsigned[hashField]
  return m80HostedSha256(m80HostedCanonicalJson(unsigned))
}

const artifactSha256 = (value: unknown): string => m80HostedSha256(`${JSON.stringify(value, null, 2)}\n`)

function expectedActionIdentity(plan: M80HostedPreparationPlan, stage: M80HostedStage): Record<string, unknown> {
  return stage === "migration"
    ? { migrationName: plan.actions.migration.migrationName, migrationSha256: plan.actions.migration.migrationSha256, fromSchemaVersion: 21, toSchemaVersion: 22, expectedReceiptCount: 22 }
    : stage === "admission"
      ? { companyId: plan.actions.admission.companyId, managerUserId: plan.actions.admission.managerUserId, fixtureProfileId: plan.admission.fixtureProfileId, fixtureVersion: 1, fixtureSha256: plan.admission.fixtureSha256, expectedRows: 1 }
      : { commitSha: plan.actions.deployment.commitSha, environmentId: plan.actions.deployment.environmentId, serviceId: plan.actions.deployment.serviceId, expectedSchemaVersion: 22 }
}

export function validateM80HostedPlan(value: unknown, now = new Date(), allowExpired = false): M80HostedPreparationPlan {
  closed(value, ["profile", "createdAt", "expiresAt", "operationScopeSha256", "planSha256", "executionAuthorized", "rootOnlyEventualExecutor", "independentSecurityReviewRequired", "noNetworkOrHostedActionPerformed", "pins", "target", "publication", "backup", "rehearsal", "admission", "sequence", "actions"], "plan")
  if (value.profile !== M80_HOSTED_PREPARATION_PROFILE || value.executionAuthorized !== false || value.rootOnlyEventualExecutor !== true || value.independentSecurityReviewRequired !== true || value.noNetworkOrHostedActionPerformed !== true || typeof value.operationScopeSha256 !== "string" || !SHA256.test(value.operationScopeSha256) || typeof value.planSha256 !== "string" || !SHA256.test(value.planSha256) || signedHash(value, "planSha256") !== value.planSha256) throw new Error("Hosted preparation plan bytes are not valid.")
  const expires = iso(value.expiresAt, "plan.expiresAt")
  iso(value.createdAt, "plan.createdAt")
  if (!allowExpired && (now.getTime() > expires || expires - now.getTime() > 4 * 60 * 60_000)) throw new Error("Hosted preparation plan is expired or implausibly future-dated.")
  const plan = value as unknown as M80HostedPreparationPlan
  validateM80HostedPreparationPlanContents(plan)
  const expectedScope = m80HostedSha256(m80HostedCanonicalJson({ profile: "neuvetra.m80.foundation-hosted-operation-scope.v1", milestone: "M80-FOUNDATION-SCHEMA22", projectRef: plan.target.projectRef, candidateSha256: M80_ACCEPTED_CANDIDATE_SHA256, migrationSha256: M80_MIGRATION_0022_SHA256 }))
  if (plan.operationScopeSha256 !== expectedScope || plan.pins.candidate.sha256 !== M80_ACCEPTED_CANDIDATE_SHA256 || plan.pins.migration.sha256 !== M80_MIGRATION_0022_SHA256 || plan.actions.migration.migrationSha256 !== M80_MIGRATION_0022_SHA256 || plan.actions.deployment.commitSha !== plan.publication.reviewedHeadCommitSha || !Array.isArray(plan.sequence) || plan.sequence.length !== 3 || plan.sequence.some((item, index) => typeof item !== "string" || item !== ["migration", "admission", "deployment"][index]) || Object.values(plan.actions).some(action => action.status !== "not_executed")) throw new Error("Hosted preparation plan authority pins changed.")
  return plan
}

export function validateM80HostedGate(value: unknown, plan: M80HostedPreparationPlan, planPin: EvidencePin, stage: M80HostedStage, evidence: { securityReview: M80HostedLoadedEvidence; integrationAcceptance: M80HostedLoadedEvidence; targetObservation: M80HostedLoadedEvidence }, now = new Date()): M80HostedExecutionGate {
  closed(value, ["profile", "stage", "reviewedAt", "expiresAt", "verdict", "operatorId", "independentReviewerId", "plan", "planSha256", "candidateSha256", "migrationSha256", "reviewedHeadCommitSha", "exactRequiredChecksPassed", "targetObservation", "targetReobservedAt", "targetProjectRef", "targetEnvironmentId", "targetServiceId", "currentSchemaVersion", "currentMigrationReceiptCount", "currentApplicationStateSha256", "writeQuiescenceMechanism", "activeDeploymentCount", "originReadinessUnavailable", "noActiveApplicationWritesObserved", "securityReview", "integrationAcceptance", "rootSoleExecutorAccepted", "noAutomaticRetryAccepted"], "gate")
  const reviewed = iso(value.reviewedAt, "gate.reviewedAt"), expires = iso(value.expiresAt, "gate.expiresAt"), targetObserved = iso(value.targetReobservedAt, "gate.targetReobservedAt"), nowMs = now.getTime()
  const expectedSchema = stage === "migration" ? 21 : 22, expectedReceipts = stage === "migration" ? 21 : 22
  if (value.profile !== M80_HOSTED_GATE_PROFILE || value.stage !== stage || value.verdict !== "pass" || value.operatorId !== "/root" || typeof value.independentReviewerId !== "string" || !value.independentReviewerId.startsWith("/root/") || value.independentReviewerId === "/root" || value.independentReviewerId === "/root/m80_foundation_runtime" || reviewed > nowMs || nowMs - reviewed > 15 * 60_000 || nowMs - targetObserved > 15 * 60_000 || targetObserved > nowMs || nowMs > expires || expires - reviewed > 15 * 60_000 || expires > Date.parse(plan.expiresAt) || value.targetProjectRef !== plan.target.projectRef || value.targetEnvironmentId !== plan.target.environmentId || value.targetServiceId !== plan.target.serviceId || value.currentSchemaVersion !== expectedSchema || value.currentMigrationReceiptCount !== expectedReceipts || typeof value.currentApplicationStateSha256 !== "string" || !SHA256.test(value.currentApplicationStateSha256) || (stage === "migration" && value.currentApplicationStateSha256 !== plan.target.applicationStateSha256) || value.writeQuiescenceMechanism !== "provider_deployment_stopped_and_origin_readiness_unavailable" || value.activeDeploymentCount !== 0 || value.originReadinessUnavailable !== true || value.noActiveApplicationWritesObserved !== true) throw new Error("Fresh independent stage-specific execution gate with observed provider-stop write quiescence required.")
  const gatePlan = pin(value.plan, "gate.plan"), securityReview = pin(value.securityReview, "gate.securityReview"), integrationAcceptance = pin(value.integrationAcceptance, "gate.integrationAcceptance"), targetObservation = pin(value.targetObservation, "gate.targetObservation")
  if (gatePlan.path !== planPin.path || gatePlan.sha256 !== planPin.sha256 || value.planSha256 !== plan.planSha256 || value.candidateSha256 !== M80_ACCEPTED_CANDIDATE_SHA256 || value.migrationSha256 !== M80_MIGRATION_0022_SHA256 || value.reviewedHeadCommitSha !== plan.publication.reviewedHeadCommitSha || value.exactRequiredChecksPassed !== true || value.rootSoleExecutorAccepted !== true || value.noAutomaticRetryAccepted !== true || integrationAcceptance.sha256 !== plan.pins.integrationAcceptance.sha256 || securityReview.sha256 === integrationAcceptance.sha256) throw new Error("Execution gate is not bound to the exact reviewed plan and acceptance evidence.")
  if (plan.publication.requiredChecks.length !== M80_REQUIRED_CHECKS.length || plan.publication.requiredChecks.some(check => check.status !== "completed" || check.conclusion !== "success")) throw new Error("Final publication checks are not exact successes.")
  const expectedSecurity = { profile: "neuvetra.m80.foundation-hosted-security-review.v1", observedAt: value.reviewedAt, verdict: "pass", reviewerId: value.independentReviewerId, implementationAuthor: "/root/m80_foundation_runtime", independent: true, plan: gatePlan, planSha256: plan.planSha256, operationScopeSha256: plan.operationScopeSha256, stage, targetProjectRef: plan.target.projectRef, reviewedHeadCommitSha: plan.publication.reviewedHeadCommitSha, candidateSha256: M80_ACCEPTED_CANDIDATE_SHA256, migrationSha256: M80_MIGRATION_0022_SHA256, materialFindingsOpen: 0 }
  const expectedIntegration = { profile: "neuvetra.m80.foundation-hosted-integration-acceptance.v1", observedAt: plan.publication.headObservedAt, verdict: "pass", reviewedHeadCommitSha: plan.publication.reviewedHeadCommitSha, candidateSha256: M80_ACCEPTED_CANDIDATE_SHA256, migrationSha256: M80_MIGRATION_0022_SHA256, runtimeIntegrationAccepted: true, uiIntegrationAccepted: true }
  const expectedTarget = { profile: "neuvetra.m80.foundation-hosted-stage-target-observation.v1", observedAt: value.targetReobservedAt, stage, projectRef: plan.target.projectRef, environmentId: plan.target.environmentId, serviceId: plan.target.serviceId, schemaVersion: expectedSchema, migrationReceiptCount: expectedReceipts, applicationStateSha256: value.currentApplicationStateSha256, writeQuiescenceMechanism: "provider_deployment_stopped_and_origin_readiness_unavailable", activeDeploymentCount: 0, originReadinessUnavailable: true, noActiveApplicationWritesObserved: true }
  if (securityReview.path !== evidence.securityReview.pin.path || securityReview.sha256 !== evidence.securityReview.pin.sha256 || integrationAcceptance.path !== evidence.integrationAcceptance.pin.path || integrationAcceptance.sha256 !== evidence.integrationAcceptance.pin.sha256 || targetObservation.path !== evidence.targetObservation.pin.path || targetObservation.sha256 !== evidence.targetObservation.pin.sha256 || m80HostedCanonicalJson(evidence.securityReview.value) !== m80HostedCanonicalJson(expectedSecurity) || m80HostedCanonicalJson(evidence.integrationAcceptance.value) !== m80HostedCanonicalJson(expectedIntegration) || m80HostedCanonicalJson(evidence.targetObservation.value) !== m80HostedCanonicalJson(expectedTarget) || securityReview.sha256 !== artifactSha256(evidence.securityReview.value) || integrationAcceptance.sha256 !== artifactSha256(evidence.integrationAcceptance.value) || targetObservation.sha256 !== artifactSha256(evidence.targetObservation.value) || integrationAcceptance.sha256 !== plan.pins.integrationAcceptance.sha256 || targetObservation.sha256 === securityReview.sha256) throw new Error("Execution gate evidence bytes or typed contents are not bound to this stage.")
  return value as unknown as M80HostedExecutionGate
}

function validateOutcomeObservation(intent: M80HostedIntent, value: unknown, now: Date, requireFresh: boolean): number {
  closed(value, ["profile", "observedAt", "stage", "transportOutcome", "authoritativeState"], "outcome observation")
  const observedAt = iso(value.observedAt, "observation.observedAt"), nowMs = now.getTime(), intentAt = iso(intent.createdAt, "intent.createdAt")
  if (value.profile !== M80_HOSTED_OBSERVATION_PROFILE || value.stage !== intent.stage || typeof value.transportOutcome !== "string" || !["definitive_success", "definitive_failure", "unknown"].includes(value.transportOutcome) || observedAt < intentAt || observedAt > nowMs || (requireFresh && nowMs - observedAt > 15 * 60_000)) throw new Error("Fresh post-intent authoritative observation required.")
  closed(value.authoritativeState, value.transportOutcome === "definitive_success" ? intent.stage === "migration" ? ["projectRef", "environmentId", "serviceId", "schemaVersion", "migrationReceiptCount", "migrationName", "migrationSha256", "oldContentExact", "oldMetadataExact"] : intent.stage === "admission" ? ["projectRef", "environmentId", "serviceId", "rowCount", "companyId", "managerUserId", "fixtureProfileId", "fixtureVersion", "fixtureSha256"] : ["projectRef", "environmentId", "serviceId", "deploymentStatus", "deploymentId", "commitSha", "schemaVersion", "readinessOk"] : [], "observation.authoritativeState")
  const state = value.authoritativeState
  if (value.transportOutcome === "definitive_success") {
    if (state.projectRef !== intent.targetProjectRef || state.environmentId !== intent.targetEnvironmentId || state.serviceId !== intent.targetServiceId) throw new Error("Authoritative observation target changed.")
    if (intent.stage === "migration" && (state.schemaVersion !== 22 || state.migrationReceiptCount !== 22 || state.migrationName !== "0022_scope1_beta_foundation.sql" || state.migrationSha256 !== M80_MIGRATION_0022_SHA256 || state.oldContentExact !== true || state.oldMetadataExact !== true)) throw new Error("Migration success observation does not prove exact schema 22 preservation.")
    if (intent.stage === "admission" && (state.rowCount !== 1 || state.companyId !== intent.actionIdentity.companyId || state.managerUserId !== intent.actionIdentity.managerUserId || state.fixtureProfileId !== "m80-synthetic-scope1-foundation-v1" || state.fixtureVersion !== 1 || state.fixtureSha256 !== intent.actionIdentity.fixtureSha256)) throw new Error("Admission success observation does not prove the exact existing synthetic membership row.")
    if (intent.stage === "deployment" && (state.environmentId !== intent.actionIdentity.environmentId || state.serviceId !== intent.actionIdentity.serviceId || state.deploymentStatus !== "SUCCESS" || typeof state.deploymentId !== "string" || !UUID.test(state.deploymentId) || state.commitSha !== intent.actionIdentity.commitSha || state.schemaVersion !== 22 || state.readinessOk !== true)) throw new Error("Deployment success observation does not prove exact target, head and schema 22 readiness.")
  }
  return observedAt
}

function validatePriorOutcomeChain(args: { plan: M80HostedPreparationPlan; planPin: EvidencePin; stage: "migration" | "admission"; chain: M80HostedPredecessorArtifacts; prerequisiteOutcome?: { pin: EvidencePin; recordedAt: string }; now: Date }): M80HostedOutcome {
  const intent = validateIntent(args.chain.intent), intentPin = pin(args.chain.intentPin, `${args.stage} intent pin`), gatePin = pin(args.chain.gatePin, `${args.stage} gate pin`), observationPin = pin(args.chain.observationPin, `${args.stage} observation pin`), outcomePin = pin(args.chain.outcomePin, `${args.stage} outcome pin`)
  if (intent.stage !== args.stage || intent.plan.path !== args.planPin.path || intent.plan.sha256 !== args.planPin.sha256 || intent.gate.path !== gatePin.path || intent.gate.sha256 !== gatePin.sha256 || intent.planSha256 !== args.plan.planSha256 || intent.operationScopeSha256 !== args.plan.operationScopeSha256 || intent.targetProjectRef !== args.plan.target.projectRef || intent.targetEnvironmentId !== args.plan.target.environmentId || intent.targetServiceId !== args.plan.target.serviceId || m80HostedCanonicalJson(intent.actionIdentity) !== m80HostedCanonicalJson(expectedActionIdentity(args.plan, args.stage)) || intentPin.sha256 !== artifactSha256(intent) || gatePin.sha256 !== artifactSha256(args.chain.gate) || (args.stage === "migration" && intent.prerequisiteOutcomes.length !== 0)) throw new Error(`${args.stage} intent is not the actual exact predecessor for this plan and target.`)
  const gate = validateM80HostedGate(args.chain.gate, args.plan, args.planPin, args.stage, args.chain.gateEvidence, new Date(intent.createdAt))
  if (args.prerequisiteOutcome) {
    const prerequisitePin = pin(args.prerequisiteOutcome.pin, `${args.stage} prerequisite outcome pin`), prerequisiteAt = iso(args.prerequisiteOutcome.recordedAt, `${args.stage} prerequisite outcome.recordedAt`)
    if (intent.prerequisiteOutcomes.length !== 1 || intent.prerequisiteOutcomes[0]?.path !== prerequisitePin.path || intent.prerequisiteOutcomes[0]?.sha256 !== prerequisitePin.sha256 || iso(intent.createdAt, `${args.stage} intent.createdAt`) < prerequisiteAt || iso(gate.reviewedAt, `${args.stage} gate.reviewedAt`) < prerequisiteAt || iso(gate.targetReobservedAt, `${args.stage} gate.targetReobservedAt`) < prerequisiteAt) throw new Error(`${args.stage} predecessor gate and intent are not chronologically linked to the prerequisite outcome.`)
  }
  validateOutcomeObservation(intent, args.chain.observation, args.now, false)
  if ((args.chain.observation as Record<string, unknown>).transportOutcome !== "definitive_success" || observationPin.sha256 !== artifactSha256(args.chain.observation)) throw new Error(`${args.stage} authoritative observation is not an exact success proof.`)
  const value = args.chain.outcome
  closed(value, ["profile", "recordedAt", "stage", "intent", "intentSha256", "status", "authoritativeObservation", "nextActionAllowed", "outcomeSha256"], "prior outcome")
  const recordedAt = iso(value.recordedAt, "prior outcome recordedAt"), observedAt = iso((args.chain.observation as Record<string, unknown>).observedAt, "prior observation observedAt")
  const expectedUnsigned = { profile: M80_HOSTED_OUTCOME_PROFILE, recordedAt: value.recordedAt, stage: args.stage, intent: intentPin, intentSha256: intent.intentSha256, status: "verified_success", authoritativeObservation: observationPin, nextActionAllowed: true }
  const expected = { ...expectedUnsigned, outcomeSha256: m80HostedSha256(m80HostedCanonicalJson(expectedUnsigned)) }
  if (recordedAt < observedAt || recordedAt > args.now.getTime() || m80HostedCanonicalJson(value) !== m80HostedCanonicalJson(expected) || outcomePin.sha256 !== artifactSha256(value)) throw new Error(`${args.stage} must have one actual recomputed verified-success intent/observation/outcome chain before the next stage.`)
  return value as unknown as M80HostedOutcome
}

export function sealM80HostedIntent(args: { plan: unknown; planPin: EvidencePin; gate: unknown; gatePin: EvidencePin; gateEvidence: { securityReview: M80HostedLoadedEvidence; integrationAcceptance: M80HostedLoadedEvidence; targetObservation: M80HostedLoadedEvidence }; stage: M80HostedStage; migration?: M80HostedPredecessorArtifacts; admission?: M80HostedPredecessorArtifacts; now?: Date }): M80HostedIntent {
  const now = args.now ?? new Date()
  const plan = validateM80HostedPlan(args.plan, now)
  const planPin = pin(args.planPin, "plan pin"), gatePin = pin(args.gatePin, "gate pin")
  if (planPin.sha256 !== artifactSha256(plan) || gatePin.sha256 !== artifactSha256(args.gate)) throw new Error("Plan or gate bytes do not match the supplied byte pin.")
  const gate = validateM80HostedGate(args.gate, plan, planPin, args.stage, args.gateEvidence, now)
  const prerequisiteOutcomes: EvidencePin[] = []
  if (args.stage === "migration") {
    if (args.migration || args.admission) throw new Error("Migration intent cannot inherit old outcomes.")
  } else {
    if (!args.migration) throw new Error("Actual verified migration intent, gate, observation and outcome chain required.")
    const migrationOutcome = validatePriorOutcomeChain({ plan, planPin, stage: "migration", chain: args.migration, now })
    if (iso(gate.reviewedAt, "successor gate.reviewedAt") < iso(migrationOutcome.recordedAt, "migration outcome.recordedAt") || iso(gate.targetReobservedAt, "successor gate.targetReobservedAt") < iso(migrationOutcome.recordedAt, "migration outcome.recordedAt")) throw new Error("Successor gate and target observation must follow the migration outcome.")
    prerequisiteOutcomes.push(pin(args.migration.outcomePin, "migration outcome pin"))
    if (args.stage === "deployment") {
      if (!args.admission) throw new Error("Actual verified admission intent, gate, observation and outcome chain required.")
      const admissionOutcome = validatePriorOutcomeChain({ plan, planPin, stage: "admission", chain: args.admission, prerequisiteOutcome: { pin: args.migration.outcomePin, recordedAt: migrationOutcome.recordedAt }, now })
      if (iso(gate.reviewedAt, "deployment gate.reviewedAt") < iso(admissionOutcome.recordedAt, "admission outcome.recordedAt") || iso(gate.targetReobservedAt, "deployment gate.targetReobservedAt") < iso(admissionOutcome.recordedAt, "admission outcome.recordedAt")) throw new Error("Deployment gate and target observation must follow the admission outcome.")
      const admissionIntent = validateIntent(args.admission.intent)
      if (admissionIntent.prerequisiteOutcomes.length !== 1 || admissionIntent.prerequisiteOutcomes[0]?.path !== args.migration.outcomePin.path || admissionIntent.prerequisiteOutcomes[0]?.sha256 !== args.migration.outcomePin.sha256 || iso(admissionIntent.createdAt, "admission intent.createdAt") < iso(migrationOutcome.recordedAt, "migration outcome.recordedAt")) throw new Error("Admission predecessor is not chronologically linked to this migration outcome.")
      prerequisiteOutcomes.push(pin(args.admission.outcomePin, "admission outcome pin"))
    } else if (args.admission) throw new Error("Admission intent cannot inherit a deployment-order outcome.")
  }
  const actionIdentity = expectedActionIdentity(plan, args.stage)
  const unsigned = { profile: M80_HOSTED_INTENT_PROFILE, createdAt: now.toISOString(), stage: args.stage, status: "intent_sealed_not_executed" as const, plan: planPin, gate: gatePin, planSha256: plan.planSha256, operationScopeSha256: plan.operationScopeSha256, targetProjectRef: plan.target.projectRef, targetEnvironmentId: plan.target.environmentId, targetServiceId: plan.target.serviceId, actionIdentity, prerequisiteOutcomes, noCredentialOrRequestBodyStored: true as const, noAutomaticRetry: true as const }
  return { ...unsigned, intentSha256: m80HostedSha256(m80HostedCanonicalJson(unsigned)) }
}

function validateIntent(value: unknown): M80HostedIntent {
  closed(value, ["profile", "createdAt", "stage", "status", "plan", "gate", "planSha256", "operationScopeSha256", "targetProjectRef", "targetEnvironmentId", "targetServiceId", "actionIdentity", "prerequisiteOutcomes", "noCredentialOrRequestBodyStored", "noAutomaticRetry", "intentSha256"], "intent")
  if (value.profile !== M80_HOSTED_INTENT_PROFILE || typeof value.stage !== "string" || !["migration", "admission", "deployment"].includes(value.stage) || value.status !== "intent_sealed_not_executed" || value.noCredentialOrRequestBodyStored !== true || value.noAutomaticRetry !== true || typeof value.operationScopeSha256 !== "string" || !SHA256.test(value.operationScopeSha256) || typeof value.targetProjectRef !== "string" || typeof value.targetEnvironmentId !== "string" || !UUID.test(value.targetEnvironmentId) || typeof value.targetServiceId !== "string" || !UUID.test(value.targetServiceId) || typeof value.intentSha256 !== "string" || !SHA256.test(value.intentSha256) || signedHash(value, "intentSha256") !== value.intentSha256) throw new Error("Durable intent integrity check failed.")
  pin(value.plan, "intent.plan"); pin(value.gate, "intent.gate")
  return value as unknown as M80HostedIntent
}

export function recordM80HostedOutcome(args: { intent: unknown; intentPin: EvidencePin; observation: unknown; observationPin: EvidencePin; now?: Date }): M80HostedOutcome {
  const now = args.now ?? new Date(), intent = validateIntent(args.intent), intentPin = pin(args.intentPin, "intent pin")
  const observationPin = pin(args.observationPin, "authoritative observation pin")
  if (intentPin.sha256 !== artifactSha256(intent) || observationPin.sha256 !== artifactSha256(args.observation)) throw new Error("Intent or authoritative observation bytes do not match their pin.")
  validateOutcomeObservation(intent, args.observation, now, true)
  const transportOutcome = (args.observation as Record<string, unknown>).transportOutcome
  const status: M80HostedOutcome["status"] = transportOutcome === "definitive_success" ? "verified_success" : transportOutcome === "definitive_failure" ? "verified_failure_do_not_retry" : "uncertain_do_not_retry"
  const unsigned = { profile: M80_HOSTED_OUTCOME_PROFILE, recordedAt: now.toISOString(), stage: intent.stage, intent: intentPin, intentSha256: intent.intentSha256, status, authoritativeObservation: observationPin, nextActionAllowed: status === "verified_success" }
  return { ...unsigned, outcomeSha256: m80HostedSha256(m80HostedCanonicalJson(unsigned)) }
}

const repoRoot = resolve(import.meta.dir, "../..")
export const m80HostedIntentPath = (plan: Pick<M80HostedPreparationPlan, "operationScopeSha256">, stage: M80HostedStage): string => `.superpowers/m80-foundation-hosted-${plan.operationScopeSha256}-${stage}-intent.json`
export const m80HostedOutcomePath = (intent: Pick<M80HostedIntent, "operationScopeSha256" | "stage">): string => `.superpowers/m80-foundation-hosted-${intent.operationScopeSha256}-${intent.stage}-outcome.json`

function safePath(path: string, kind: "read" | "write"): string {
  if (!path || isAbsolute(path) || path.includes("\\") || path.split("/").includes("..")) throw new Error(`Unsafe ${kind} path.`)
  const absolute = resolve(repoRoot, path), inside = relative(repoRoot, absolute)
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) throw new Error(`Unsafe ${kind} path.`)
  if (kind === "write" && (dirname(path) !== ".superpowers" || !path.startsWith(".superpowers/m80-foundation-hosted-") || !path.endsWith(".json") || realpathSync(dirname(absolute)).toLowerCase() !== realpathSync(resolve(repoRoot, ".superpowers")).toLowerCase())) throw new Error("Durable output must be one new .superpowers/m80-foundation-hosted-*.json file.")
  if (kind === "read") {
    const actual = realpathSync(absolute), actualInside = relative(realpathSync(repoRoot), actual)
    if (!actualInside || actualInside.startsWith("..") || isAbsolute(actualInside)) throw new Error("Evidence path escaped through a filesystem link.")
    return actual
  }
  return absolute
}

async function load(path: string): Promise<{ value: unknown; pin: EvidencePin }> {
  const bytes = await readFile(safePath(path, "read"))
  if (bytes.byteLength > 100_000) throw new Error(`Bounded JSON exceeded for ${path}.`)
  return { value: parseM80Json(bytes.toString("utf8")), pin: { path, sha256: m80HostedSha256(bytes) } }
}

interface M80HostedDurableHandle {
  writeFile(data: string, encoding: "utf8"): Promise<unknown>
  sync(): Promise<unknown>
  close(): Promise<unknown>
}

type M80HostedExclusiveOpen = (path: string) => Promise<M80HostedDurableHandle>

export async function writeM80HostedEvidenceOnce(absolutePath: string, value: unknown, openExclusive: M80HostedExclusiveOpen = path => open(path, "wx")): Promise<void> {
  let handle: M80HostedDurableHandle | undefined
  let failure: unknown
  try {
    handle = await openExclusive(absolutePath)
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8")
    await handle.sync()
  } catch (error) {
    failure = error
  } finally {
    if (handle) {
      try { await handle.close() }
      catch (error) { if (failure === undefined) failure = error }
    }
  }
  if (failure !== undefined) {
    if ((failure as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Durable intent/outcome already exists; authoritative state is uncertain until inspected. Never retry blindly.")
    throw failure
  }
}

async function writeOnce(path: string, value: unknown): Promise<void> {
  return writeM80HostedEvidenceOnce(safePath(path, "write"), value)
}

async function loadGateEvidence(value: unknown): Promise<{ securityReview: M80HostedLoadedEvidence; integrationAcceptance: M80HostedLoadedEvidence; targetObservation: M80HostedLoadedEvidence }> {
  const gate = value as Record<string, unknown>
  const securityReview = pin(gate.securityReview, "gate.securityReview"), integrationAcceptance = pin(gate.integrationAcceptance, "gate.integrationAcceptance"), targetObservation = pin(gate.targetObservation, "gate.targetObservation")
  return { securityReview: await load(securityReview.path), integrationAcceptance: await load(integrationAcceptance.path), targetObservation: await load(targetObservation.path) }
}

async function loadPredecessor(intentPath: string, observationPath: string, outcomePath: string): Promise<M80HostedPredecessorArtifacts | undefined> {
  if ([intentPath, observationPath, outcomePath].every(path => path === "-")) return undefined
  if ([intentPath, observationPath, outcomePath].some(path => path === "-")) throw new Error("A predecessor requires its complete intent, observation and outcome paths.")
  const intent = await load(intentPath), observation = await load(observationPath), outcome = await load(outcomePath)
  const intentGate = pin((intent.value as Record<string, unknown>).gate, "predecessor intent.gate"), gate = await load(intentGate.path)
  return { intent: intent.value, intentPin: intent.pin, gate: gate.value, gatePin: gate.pin, gateEvidence: await loadGateEvidence(gate.value), observation: observation.value, observationPin: observation.pin, outcome: outcome.value, outcomePin: outcome.pin }
}

if (import.meta.main) {
  const [mode, ...argv] = process.argv.slice(2)
  if (mode === "seal") {
    const [planPath, gatePath, stage, migrationIntentPath = "-", migrationObservationPath = "-", migrationOutcomePath = "-", admissionIntentPath = "-", admissionObservationPath = "-", admissionOutcomePath = "-"] = argv
    if (!planPath || !gatePath || !["migration", "admission", "deployment"].includes(stage ?? "")) throw new Error("Usage: ... seal <plan> <gate> <stage> [migration-intent|-] [migration-observation|-] [migration-outcome|-] [admission-intent|-] [admission-observation|-] [admission-outcome|-]")
    const plan = await load(planPath), gate = await load(gatePath)
    const gateEvidence = await loadGateEvidence(gate.value)
    const migration = await loadPredecessor(migrationIntentPath, migrationObservationPath, migrationOutcomePath)
    const admission = await loadPredecessor(admissionIntentPath, admissionObservationPath, admissionOutcomePath)
    const intent = sealM80HostedIntent({ plan: plan.value, planPin: plan.pin, gate: gate.value, gatePin: gate.pin, gateEvidence, stage: stage as M80HostedStage, migration, admission })
    const outputPath = m80HostedIntentPath(validateM80HostedPlan(plan.value), stage as M80HostedStage)
    await writeOnce(outputPath, intent)
    console.log(JSON.stringify({ status: "intent_sealed_no_action_executed", stage, path: outputPath, sha256: m80HostedSha256(await readFile(safePath(outputPath, "read"))) }))
  } else if (mode === "record") {
    const [intentPath, observationPath] = argv
    if (!intentPath || !observationPath) throw new Error("Usage: ... record <intent> <authoritative-observation>")
    const intent = await load(intentPath), observation = await load(observationPath)
    const outcome = recordM80HostedOutcome({ intent: intent.value, intentPin: intent.pin, observation: observation.value, observationPin: observation.pin })
    const outputPath = m80HostedOutcomePath(validateIntent(intent.value))
    await writeOnce(outputPath, outcome)
    console.log(JSON.stringify({ status: outcome.status, stage: outcome.stage, path: outputPath, sha256: m80HostedSha256(await readFile(safePath(outputPath, "read"))), retryAllowed: false }))
  } else throw new Error("Use seal or record. These modes only persist offline intent/outcome evidence and never execute a hosted action.")
}

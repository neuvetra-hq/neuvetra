import { readFile, writeFile } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"
import { parseM80Json } from "../../packages/neuvetra-database/src/m80-validation"
import {
  M80_ACCEPTED_CANDIDATE_SHA256,
  M80_HOSTED_PREPARATION_PROFILE,
  M80_MIGRATION_0022_SHA256,
  M80_REQUIRED_CHECKS,
  m80HostedCanonicalJson,
  m80HostedSha256,
  type EvidencePin,
  type M80HostedPreparationPlan,
} from "./m80-hosted-prep-independent-20260924-frozen-prepare"

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
  targetReobservedAt: string
  targetProjectRef: string
  currentSchemaVersion: 21 | 22
  currentMigrationReceiptCount: 21 | 22
  currentApplicationStateSha256: string
  maintenanceEnabled: true
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
  authoritativeObservationSha256: string
  nextActionAllowed: boolean
  outcomeSha256: string
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

export function validateM80HostedPlan(value: unknown, now = new Date(), allowExpired = false): M80HostedPreparationPlan {
  closed(value, ["profile", "createdAt", "expiresAt", "operationScopeSha256", "planSha256", "executionAuthorized", "rootOnlyEventualExecutor", "independentSecurityReviewRequired", "noNetworkOrHostedActionPerformed", "pins", "target", "publication", "backup", "rehearsal", "admission", "sequence", "actions"], "plan")
  if (value.profile !== M80_HOSTED_PREPARATION_PROFILE || value.executionAuthorized !== false || value.rootOnlyEventualExecutor !== true || value.independentSecurityReviewRequired !== true || value.noNetworkOrHostedActionPerformed !== true || typeof value.operationScopeSha256 !== "string" || !SHA256.test(value.operationScopeSha256) || typeof value.planSha256 !== "string" || !SHA256.test(value.planSha256) || signedHash(value, "planSha256") !== value.planSha256) throw new Error("Hosted preparation plan bytes are not valid.")
  const expires = iso(value.expiresAt, "plan.expiresAt")
  iso(value.createdAt, "plan.createdAt")
  if (!allowExpired && (now.getTime() > expires || expires - now.getTime() > 4 * 60 * 60_000)) throw new Error("Hosted preparation plan is expired or implausibly future-dated.")
  const plan = value as unknown as M80HostedPreparationPlan
  const expectedScope = m80HostedSha256(m80HostedCanonicalJson({ profile: "neuvetra.m80.foundation-hosted-operation-scope.v1", milestone: "M80-FOUNDATION-SCHEMA22", projectRef: plan.target.projectRef, candidateSha256: M80_ACCEPTED_CANDIDATE_SHA256, migrationSha256: M80_MIGRATION_0022_SHA256 }))
  if (plan.operationScopeSha256 !== expectedScope || plan.pins.candidate.sha256 !== M80_ACCEPTED_CANDIDATE_SHA256 || plan.pins.migration.sha256 !== M80_MIGRATION_0022_SHA256 || plan.actions.migration.migrationSha256 !== M80_MIGRATION_0022_SHA256 || plan.actions.deployment.commitSha !== plan.publication.reviewedHeadCommitSha || plan.sequence.join("|") !== "migration|admission|deployment" || Object.values(plan.actions).some(action => action.status !== "not_executed")) throw new Error("Hosted preparation plan authority pins changed.")
  return plan
}

export function validateM80HostedGate(value: unknown, plan: M80HostedPreparationPlan, planPin: EvidencePin, stage: M80HostedStage, now = new Date()): M80HostedExecutionGate {
  closed(value, ["profile", "stage", "reviewedAt", "expiresAt", "verdict", "operatorId", "independentReviewerId", "plan", "planSha256", "candidateSha256", "migrationSha256", "reviewedHeadCommitSha", "exactRequiredChecksPassed", "targetReobservedAt", "targetProjectRef", "currentSchemaVersion", "currentMigrationReceiptCount", "currentApplicationStateSha256", "maintenanceEnabled", "noActiveApplicationWritesObserved", "securityReview", "integrationAcceptance", "rootSoleExecutorAccepted", "noAutomaticRetryAccepted"], "gate")
  const reviewed = iso(value.reviewedAt, "gate.reviewedAt"), expires = iso(value.expiresAt, "gate.expiresAt"), targetObserved = iso(value.targetReobservedAt, "gate.targetReobservedAt"), nowMs = now.getTime()
  const expectedSchema = stage === "migration" ? 21 : 22, expectedReceipts = stage === "migration" ? 21 : 22
  if (value.profile !== M80_HOSTED_GATE_PROFILE || value.stage !== stage || value.verdict !== "pass" || value.operatorId !== "/root" || typeof value.independentReviewerId !== "string" || !value.independentReviewerId.startsWith("/root/") || value.independentReviewerId === "/root" || nowMs < reviewed - 5_000 || nowMs - reviewed > 15 * 60_000 || nowMs - targetObserved > 15 * 60_000 || targetObserved > nowMs + 5_000 || nowMs > expires || expires - reviewed > 15 * 60_000 || expires > Date.parse(plan.expiresAt) || value.targetProjectRef !== plan.target.projectRef || value.currentSchemaVersion !== expectedSchema || value.currentMigrationReceiptCount !== expectedReceipts || typeof value.currentApplicationStateSha256 !== "string" || !SHA256.test(value.currentApplicationStateSha256) || (stage === "migration" && value.currentApplicationStateSha256 !== plan.target.applicationStateSha256) || value.maintenanceEnabled !== true || value.noActiveApplicationWritesObserved !== true) throw new Error("Fresh independent stage-specific execution gate required.")
  const gatePlan = pin(value.plan, "gate.plan"), securityReview = pin(value.securityReview, "gate.securityReview"), integrationAcceptance = pin(value.integrationAcceptance, "gate.integrationAcceptance")
  if (gatePlan.path !== planPin.path || gatePlan.sha256 !== planPin.sha256 || value.planSha256 !== plan.planSha256 || value.candidateSha256 !== M80_ACCEPTED_CANDIDATE_SHA256 || value.migrationSha256 !== M80_MIGRATION_0022_SHA256 || value.reviewedHeadCommitSha !== plan.publication.reviewedHeadCommitSha || value.exactRequiredChecksPassed !== true || value.rootSoleExecutorAccepted !== true || value.noAutomaticRetryAccepted !== true || integrationAcceptance.sha256 !== plan.pins.integrationAcceptance.sha256 || securityReview.sha256 === integrationAcceptance.sha256) throw new Error("Execution gate is not bound to the exact reviewed plan and acceptance evidence.")
  if (plan.publication.requiredChecks.length !== M80_REQUIRED_CHECKS.length || plan.publication.requiredChecks.some(check => check.status !== "completed" || check.conclusion !== "success")) throw new Error("Final publication checks are not exact successes.")
  return value as unknown as M80HostedExecutionGate
}

function validateOutcome(value: unknown, stage: M80HostedStage, plan: M80HostedPreparationPlan): M80HostedOutcome {
  closed(value, ["profile", "recordedAt", "stage", "intent", "intentSha256", "status", "authoritativeObservationSha256", "nextActionAllowed", "outcomeSha256"], "prior outcome")
  if (value.profile !== M80_HOSTED_OUTCOME_PROFILE || value.stage !== stage || typeof value.intentSha256 !== "string" || !SHA256.test(value.intentSha256) || typeof value.authoritativeObservationSha256 !== "string" || !SHA256.test(value.authoritativeObservationSha256) || value.status !== "verified_success" || value.nextActionAllowed !== true || typeof value.outcomeSha256 !== "string" || signedHash(value, "outcomeSha256") !== value.outcomeSha256) throw new Error(`${stage} must have one verified-success outcome before the next stage.`)
  pin(value.intent, "prior outcome intent")
  if (stage === "migration" && plan.actions.migration.migrationSha256 !== M80_MIGRATION_0022_SHA256) throw new Error("Migration outcome target changed.")
  return value as unknown as M80HostedOutcome
}

export function sealM80HostedIntent(args: { plan: unknown; planPin: EvidencePin; gate: unknown; gatePin: EvidencePin; stage: M80HostedStage; migrationOutcome?: unknown; migrationOutcomePin?: EvidencePin; admissionOutcome?: unknown; admissionOutcomePin?: EvidencePin; now?: Date }): M80HostedIntent {
  const now = args.now ?? new Date()
  const plan = validateM80HostedPlan(args.plan, now)
  const planPin = pin(args.planPin, "plan pin"), gatePin = pin(args.gatePin, "gate pin")
  validateM80HostedGate(args.gate, plan, planPin, args.stage, now)
  const prerequisiteOutcomes: EvidencePin[] = []
  if (args.stage === "migration") {
    if (args.migrationOutcome || args.admissionOutcome) throw new Error("Migration intent cannot inherit old outcomes.")
  } else {
    if (!args.migrationOutcome || !args.migrationOutcomePin) throw new Error("Verified migration outcome required.")
    validateOutcome(args.migrationOutcome, "migration", plan)
    prerequisiteOutcomes.push(pin(args.migrationOutcomePin, "migration outcome pin"))
    if (args.stage === "deployment") {
      if (!args.admissionOutcome || !args.admissionOutcomePin) throw new Error("Verified admission outcome required.")
      validateOutcome(args.admissionOutcome, "admission", plan)
      prerequisiteOutcomes.push(pin(args.admissionOutcomePin, "admission outcome pin"))
    } else if (args.admissionOutcome) throw new Error("Admission intent cannot inherit a deployment-order outcome.")
  }
  const actionIdentity = args.stage === "migration"
    ? { migrationName: plan.actions.migration.migrationName, migrationSha256: plan.actions.migration.migrationSha256, fromSchemaVersion: 21, toSchemaVersion: 22, expectedReceiptCount: 22 }
    : args.stage === "admission"
      ? { companyId: plan.actions.admission.companyId, managerUserId: plan.actions.admission.managerUserId, fixtureProfileId: plan.admission.fixtureProfileId, fixtureVersion: 1, fixtureSha256: plan.admission.fixtureSha256, expectedRows: 1 }
      : { commitSha: plan.actions.deployment.commitSha, environmentId: plan.actions.deployment.environmentId, serviceId: plan.actions.deployment.serviceId, expectedSchemaVersion: 22 }
  const unsigned = { profile: M80_HOSTED_INTENT_PROFILE, createdAt: now.toISOString(), stage: args.stage, status: "intent_sealed_not_executed" as const, plan: planPin, gate: gatePin, planSha256: plan.planSha256, operationScopeSha256: plan.operationScopeSha256, targetProjectRef: plan.target.projectRef, actionIdentity, prerequisiteOutcomes, noCredentialOrRequestBodyStored: true as const, noAutomaticRetry: true as const }
  return { ...unsigned, intentSha256: m80HostedSha256(m80HostedCanonicalJson(unsigned)) }
}

function validateIntent(value: unknown): M80HostedIntent {
  closed(value, ["profile", "createdAt", "stage", "status", "plan", "gate", "planSha256", "operationScopeSha256", "targetProjectRef", "actionIdentity", "prerequisiteOutcomes", "noCredentialOrRequestBodyStored", "noAutomaticRetry", "intentSha256"], "intent")
  if (value.profile !== M80_HOSTED_INTENT_PROFILE || !["migration", "admission", "deployment"].includes(String(value.stage)) || value.status !== "intent_sealed_not_executed" || value.noCredentialOrRequestBodyStored !== true || value.noAutomaticRetry !== true || typeof value.operationScopeSha256 !== "string" || !SHA256.test(value.operationScopeSha256) || typeof value.intentSha256 !== "string" || !SHA256.test(value.intentSha256) || signedHash(value, "intentSha256") !== value.intentSha256) throw new Error("Durable intent integrity check failed.")
  pin(value.plan, "intent.plan"); pin(value.gate, "intent.gate")
  return value as unknown as M80HostedIntent
}

export function recordM80HostedOutcome(args: { intent: unknown; intentPin: EvidencePin; observation: unknown; now?: Date }): M80HostedOutcome {
  const now = args.now ?? new Date(), intent = validateIntent(args.intent), intentPin = pin(args.intentPin, "intent pin")
  closed(args.observation, ["profile", "observedAt", "stage", "transportOutcome", "authoritativeState"], "outcome observation")
  const observedAt = iso(args.observation.observedAt, "observation.observedAt")
  if (args.observation.profile !== M80_HOSTED_OBSERVATION_PROFILE || args.observation.stage !== intent.stage || !["definitive_success", "definitive_failure", "unknown"].includes(String(args.observation.transportOutcome)) || observedAt > now.getTime() + 5_000 || now.getTime() - observedAt > 15 * 60_000) throw new Error("Fresh exact authoritative observation required.")
  closed(args.observation.authoritativeState, args.observation.transportOutcome === "definitive_success" ? intent.stage === "migration" ? ["schemaVersion", "migrationReceiptCount", "migrationName", "migrationSha256", "oldContentExact", "oldMetadataExact"] : intent.stage === "admission" ? ["rowCount", "companyId", "managerUserId", "fixtureProfileId", "fixtureVersion", "fixtureSha256"] : ["deploymentStatus", "deploymentId", "commitSha", "schemaVersion", "readinessOk"] : [], "observation.authoritativeState")
  const state = args.observation.authoritativeState
  if (args.observation.transportOutcome === "definitive_success") {
    if (intent.stage === "migration" && (state.schemaVersion !== 22 || state.migrationReceiptCount !== 22 || state.migrationName !== "0022_scope1_beta_foundation.sql" || state.migrationSha256 !== M80_MIGRATION_0022_SHA256 || state.oldContentExact !== true || state.oldMetadataExact !== true)) throw new Error("Migration success observation does not prove exact schema 22 preservation.")
    if (intent.stage === "admission" && (state.rowCount !== 1 || state.companyId !== intent.actionIdentity.companyId || state.managerUserId !== intent.actionIdentity.managerUserId || state.fixtureProfileId !== "m80-synthetic-scope1-foundation-v1" || state.fixtureVersion !== 1 || state.fixtureSha256 !== intent.actionIdentity.fixtureSha256)) throw new Error("Admission success observation does not prove the exact existing synthetic membership row.")
    if (intent.stage === "deployment" && (state.deploymentStatus !== "SUCCESS" || typeof state.deploymentId !== "string" || !UUID.test(state.deploymentId) || state.commitSha !== intent.actionIdentity.commitSha || state.schemaVersion !== 22 || state.readinessOk !== true)) throw new Error("Deployment success observation does not prove exact head and schema 22 readiness.")
  }
  const status: M80HostedOutcome["status"] = args.observation.transportOutcome === "definitive_success" ? "verified_success" : args.observation.transportOutcome === "definitive_failure" ? "verified_failure_do_not_retry" : "uncertain_do_not_retry"
  const unsigned = { profile: M80_HOSTED_OUTCOME_PROFILE, recordedAt: now.toISOString(), stage: intent.stage, intent: intentPin, intentSha256: intent.intentSha256, status, authoritativeObservationSha256: m80HostedSha256(m80HostedCanonicalJson(args.observation)), nextActionAllowed: status === "verified_success" }
  return { ...unsigned, outcomeSha256: m80HostedSha256(m80HostedCanonicalJson(unsigned)) }
}

const repoRoot = resolve(import.meta.dir, "..")
export const m80HostedIntentPath = (plan: Pick<M80HostedPreparationPlan, "operationScopeSha256">, stage: M80HostedStage): string => `.superpowers/m80-foundation-hosted-${plan.operationScopeSha256}-${stage}-intent.json`
export const m80HostedOutcomePath = (intent: Pick<M80HostedIntent, "operationScopeSha256" | "stage">): string => `.superpowers/m80-foundation-hosted-${intent.operationScopeSha256}-${intent.stage}-outcome.json`

function safePath(path: string, kind: "read" | "write"): string {
  if (!path || isAbsolute(path) || path.includes("\\") || path.split("/").includes("..")) throw new Error(`Unsafe ${kind} path.`)
  const absolute = resolve(repoRoot, path), inside = relative(repoRoot, absolute)
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) throw new Error(`Unsafe ${kind} path.`)
  if (kind === "write" && (!path.startsWith(".superpowers/m80-foundation-hosted-") || !path.endsWith(".json"))) throw new Error("Durable output must be a new .superpowers/m80-foundation-hosted-*.json file.")
  return absolute
}

async function load(path: string): Promise<{ value: unknown; pin: EvidencePin }> {
  const bytes = await readFile(safePath(path, "read"))
  if (bytes.byteLength > 100_000) throw new Error(`Bounded JSON exceeded for ${path}.`)
  return { value: parseM80Json(bytes.toString("utf8")), pin: { path, sha256: m80HostedSha256(bytes) } }
}

export async function writeM80HostedEvidenceOnce(absolutePath: string, value: unknown): Promise<void> {
  try { await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Durable intent/outcome already exists; authoritative state is uncertain until inspected. Never retry blindly.")
    throw error
  }
}

async function writeOnce(path: string, value: unknown): Promise<void> {
  return writeM80HostedEvidenceOnce(safePath(path, "write"), value)
}

if (import.meta.main) {
  const [mode, ...argv] = process.argv.slice(2)
  if (mode === "seal") {
    const [planPath, gatePath, stage, migrationOutcomePath = "-", admissionOutcomePath = "-"] = argv
    if (!planPath || !gatePath || !["migration", "admission", "deployment"].includes(stage ?? "")) throw new Error("Usage: ... seal <plan> <gate> <migration|admission|deployment> [migration-outcome|-] [admission-outcome|-]")
    const plan = await load(planPath), gate = await load(gatePath)
    const migration = migrationOutcomePath === "-" ? undefined : await load(migrationOutcomePath)
    const admission = admissionOutcomePath === "-" ? undefined : await load(admissionOutcomePath)
    const intent = sealM80HostedIntent({ plan: plan.value, planPin: plan.pin, gate: gate.value, gatePin: gate.pin, stage: stage as M80HostedStage, migrationOutcome: migration?.value, migrationOutcomePin: migration?.pin, admissionOutcome: admission?.value, admissionOutcomePin: admission?.pin })
    const outputPath = m80HostedIntentPath(validateM80HostedPlan(plan.value), stage as M80HostedStage)
    await writeOnce(outputPath, intent)
    console.log(JSON.stringify({ status: "intent_sealed_no_action_executed", stage, path: outputPath, sha256: m80HostedSha256(await readFile(safePath(outputPath, "read"))) }))
  } else if (mode === "record") {
    const [intentPath, observationPath] = argv
    if (!intentPath || !observationPath) throw new Error("Usage: ... record <intent> <authoritative-observation>")
    const intent = await load(intentPath), observation = await load(observationPath)
    const outcome = recordM80HostedOutcome({ intent: intent.value, intentPin: intent.pin, observation: observation.value })
    const outputPath = m80HostedOutcomePath(validateIntent(intent.value))
    await writeOnce(outputPath, outcome)
    console.log(JSON.stringify({ status: outcome.status, stage: outcome.stage, path: outputPath, sha256: m80HostedSha256(await readFile(safePath(outputPath, "read"))), retryAllowed: false }))
  } else throw new Error("Use seal or record. These modes only persist offline intent/outcome evidence and never execute a hosted action.")
}

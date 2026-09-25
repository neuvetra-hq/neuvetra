import { readFile, realpath } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { migratePrivateStaging } from "../../packages/neuvetra-database/src/staging-migrations"
import type { WorkspaceConnection, WorkspaceSql } from "../../packages/neuvetra-database/src/workspace"
import { parseM71Json } from "../../packages/neuvetra-database/src/m71-validation"
import { parseM80Json } from "../../packages/neuvetra-database/src/m80-validation"
import { connectOperator } from "../../tools/staging/m73-common"
import { assertSchema22Delta, captureApplicationState, verifyExactSource21, type ApplicationState } from "../../.superpowers/m80-backup-core"
import {
  M80_ADMISSION_SQL,
  M80_FIXTURE_SHA256,
  M80_MIGRATION_0022_SHA256,
  M80_HOSTED_INPUT_PROFILE,
  m80ExpectedHostedEvidence,
  m80HostedCanonicalJson,
  m80HostedSha256,
  type EvidencePin,
  type M80HostedPreparationPlan,
  type HostedPreparationInput,
} from "../../.superpowers/m80-foundation-hosted-prepare-v2"
import {
  recordM80HostedOutcome,
  sealM80HostedIntent,
  validateM80HostedGate,
  validateM80HostedPlan,
  writeM80HostedEvidenceOnce,
  type M80HostedIntent,
  type M80HostedLoadedEvidence,
  type M80HostedOutcome,
  type M80HostedPredecessorArtifacts,
  type M80HostedStage,
} from "../../.superpowers/m80-foundation-hosted-once-v2"

export const M80_EXECUTOR_REVIEW_PROFILE = "neuvetra.m80.foundation-executor-source-review.v1" as const
export const M80_EXECUTOR_ATTEMPT_PROFILE = "neuvetra.m80.foundation-executor-attempt.v1" as const
export const M80_EXECUTOR_MIGRATION_SOURCE_PROFILE = "neuvetra.m80.foundation-executor-migration-source.v1" as const
export const M80_EXECUTOR_PROVIDER_ACK_PROFILE = "neuvetra.m80.foundation-executor-provider-ack.v1" as const
export const M80_EXECUTOR_PENDING_OBSERVATION_PROFILE = "neuvetra.m80.foundation-executor-pending-observation.v1" as const
export const M80_EXECUTOR_PREPARATION_CANDIDATE_PATH = "operations/agent-improvement/snapshots/M80-FOUNDATION-HOSTED-PREP-20260924-CANDIDATE6.json" as const
export const M80_EXECUTOR_PREPARATION_CANDIDATE_SHA256 = "ad834aee260dd732988b00b6d0f6e9ea4df64bdc1544064c0e87e8cc819a3c0a" as const
export const M80_EXECUTOR_ENTRYPOINT_PATH = ".superpowers/m80-foundation-executor.ts" as const
export const M80_EXECUTOR_BUNDLE_PROFILE = "neuvetra.m80.foundation-executor-bundle.v1" as const
export const M80_EXECUTOR_PRIVATE_INPUT_PROFILE = "neuvetra.m80.foundation-executor-private-input.v1" as const
export const M80_RAILWAY_PROJECT_ID = "119f3652-9d84-4d16-983c-1a17c0fd1aaa" as const
export const M80_READINESS_URL = "https://www.neuvetra.ai/ready" as const

const SHA256 = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const M80_EXECUTOR_EVIDENCE_MAX_BYTES = 1_000_000
const M80_EXECUTOR_SOURCE_MAX_BYTES = 4_000_000
const repoRoot = resolve(import.meta.dir, "../..")

export interface M80ExecutorSourceReview {
  verdict: "pass_m80_executor_transport_only"
  reviewer: "/root/m80_foundation_runtime_qa"
  source_snapshot: EvidencePin
  source_pins: EvidencePin[]
}

export interface M80ExecutorArtifacts {
  plan: unknown
  planPin: EvidencePin
  gate: unknown
  gatePin: EvidencePin
  gateEvidence: {
    securityReview: M80HostedLoadedEvidence
    integrationAcceptance: M80HostedLoadedEvidence
    targetObservation: M80HostedLoadedEvidence
  }
  intent: unknown
  intentPin: EvidencePin
  stage: M80HostedStage
  migration?: M80HostedPredecessorArtifacts
  admission?: M80HostedPredecessorArtifacts
  executorReview: EvidencePin
  planEvidence: {
    targetObservation: M80HostedLoadedEvidence
    publicationReview: M80HostedLoadedEvidence
    integrationAcceptance: M80HostedLoadedEvidence
    backupReceipt: M80HostedLoadedEvidence
    restoreReceipt: M80HostedLoadedEvidence
    preservationReceipt: M80HostedLoadedEvidence
    migrationRehearsalReceipt: M80HostedLoadedEvidence
    admissionObservation: M80HostedLoadedEvidence
  }
}

export interface M80ExecutorAttempt {
  profile: typeof M80_EXECUTOR_ATTEMPT_PROFILE
  startedAt: string
  operatorId: "/root"
  stage: M80HostedStage
  plan: EvidencePin
  intent: EvidencePin
  executorReview: EvidencePin
  operationScopeSha256: string
  targetProjectRef: string
  targetEnvironmentId: string
  targetServiceId: string
  actionIdentity: Record<string, unknown>
  preMigrationState: EvidencePin | null
  durableBeforeTransport: true
  noAutomaticRetry: true
  attemptSha256: string
}

export interface M80ExecutorJournal {
  writeOnce(path: string, value: unknown): Promise<void>
}

export interface M80ProviderTransport {
  serviceInstanceDeployV2(input: { environmentId: string; serviceId: string; commitSha: string }): Promise<unknown>
}

export interface M80ExecutorObserver {
  observe(input: { stage: M80HostedStage; plan: M80HostedPreparationPlan; intent: M80HostedIntent }): Promise<unknown>
}

export interface M80ExecutorDependencies {
  journal: M80ExecutorJournal
  observer: M80ExecutorObserver
  readSourceBytes?: (path: string) => Promise<Uint8Array>
  database?: WorkspaceConnection
  provider?: M80ProviderTransport
  migrate?: (database: WorkspaceConnection, plan: M80HostedPreparationPlan) => Promise<unknown>
  admit?: (database: WorkspaceConnection, plan: M80HostedPreparationPlan) => Promise<unknown>
  now?: () => Date
  migrationSourceState?: unknown
  migrationSourceReceipt?: M80HostedLoadedEvidence
  observationReceipt?: M80HostedLoadedEvidence
  providerAcknowledgement?: M80HostedLoadedEvidence
}

export interface M80ExecutorProviderAcknowledgement {
  profile: typeof M80_EXECUTOR_PROVIDER_ACK_PROFILE
  acknowledgedAt: string
  stage: "deployment"
  attempt: EvidencePin
  intent: EvidencePin
  operationScopeSha256: string
  projectRef: string
  environmentId: string
  serviceId: string
  commitSha: string
  deploymentId: string
}

export interface M80ExecutorFileBundle {
  profile: typeof M80_EXECUTOR_BUNDLE_PROFILE
  stage: M80HostedStage
  plan: EvidencePin
  gate: EvidencePin
  intent: EvidencePin
  executorReview: EvidencePin
  planEvidence: Record<keyof M80ExecutorArtifacts["planEvidence"], EvidencePin>
  migration: { intent: EvidencePin; observation: EvidencePin; outcome: EvidencePin } | null
  admission: { intent: EvidencePin; observation: EvidencePin; outcome: EvidencePin } | null
}

export interface M80ExecutorPrivateInput {
  profile: typeof M80_EXECUTOR_PRIVATE_INPUT_PROFILE
  operatorId: "/root"
  mode: "execute" | "reconcile"
  bundle: EvidencePin
  attempt: EvidencePin | null
  operatorDatabaseUrl: string
  railwaySessionMode: "current_authenticated_cli"
}

function closed(value: unknown, keys: string[], name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error(`${name} must contain only exact reviewed fields.`)
}

function exactIso(value: unknown, name: string): number {
  if (typeof value !== "string") throw new Error(`${name} must be canonical ISO UTC.`)
  const time = Date.parse(value)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) throw new Error(`${name} must be canonical ISO UTC.`)
  return time
}

function pin(value: unknown, name: string): EvidencePin {
  closed(value, ["path", "sha256"], name)
  if (typeof value.path !== "string" || !value.path || isAbsolute(value.path) || value.path.includes("\\") || value.path.split("/").includes("..") || typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) throw new Error(`${name} must be a safe exact byte pin.`)
  return value as unknown as EvidencePin
}

const artifactSha256 = (value: unknown): string => m80HostedSha256(`${JSON.stringify(value, null, 2)}\n`)

async function readWorkspaceBytes(path: string): Promise<Uint8Array> {
  const absolute = resolve(repoRoot, path), actual = await realpath(absolute), inside = relative(await realpath(repoRoot), actual)
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) throw new Error("Executor evidence path escaped the workspace.")
  return readFile(actual)
}

async function loadPinnedJson(item: EvidencePin, readBytes: (path: string) => Promise<Uint8Array>, maxBytes = M80_EXECUTOR_EVIDENCE_MAX_BYTES): Promise<unknown> {
  const exact = pin(item, "JSON evidence pin"), bytes = await readBytes(exact.path)
  if (bytes.byteLength > maxBytes || m80HostedSha256(bytes) !== exact.sha256) throw new Error(`Evidence bytes changed for ${exact.path}.`)
  return parseM71Json(new TextDecoder().decode(bytes), maxBytes)
}

export async function loadM80ExecutorEvidence(item: EvidencePin, readBytes: (path: string) => Promise<Uint8Array> = readWorkspaceBytes): Promise<unknown> {
  return loadPinnedJson(item, readBytes)
}

export async function loadM80ExecutorSourceEvidence(item: EvidencePin, readBytes: (path: string) => Promise<Uint8Array> = readWorkspaceBytes): Promise<unknown> {
  return loadPinnedJson(item, readBytes, M80_EXECUTOR_SOURCE_MAX_BYTES)
}

async function validateSnapshotClosure(snapshot: unknown, readBytes: (path: string) => Promise<Uint8Array>, state = { paths: new Map<string, string>(), count: 0 }, depth = 0): Promise<EvidencePin[]> {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || depth > 4) throw new Error("Concrete bounded executor source snapshot required.")
  const record = snapshot as Record<string, unknown>, hasArtifacts = Array.isArray(record.artifacts), hasFiles = Array.isArray(record.files)
  if (hasArtifacts === hasFiles) throw new Error("Snapshot must contain exactly one reviewed source list.")
  const rows = (hasArtifacts ? record.artifacts : record.files) as unknown[]
  if (rows.length < 1 || rows.length > 256 || state.count + rows.length > 512) throw new Error("Executor source closure count is outside its bound.")
  const pins: EvidencePin[] = []
  for (let index = 0; index < rows.length; index++) {
    const entry = rows[index]
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`executor snapshot artifacts[${index}] changed.`)
    const row = entry as Record<string, unknown>, exact = pin({ path: row.path, sha256: row.sha256 }, `executor snapshot artifacts[${index}]`)
    if (typeof row.text !== "string" || m80HostedSha256(row.text) !== exact.sha256) throw new Error(`Executor snapshot source changed at ${exact.path}.`)
    const prior = state.paths.get(exact.path)
    if (prior && prior !== exact.sha256) throw new Error(`Executor snapshot source conflicts at ${exact.path}.`)
    if (prior) continue
    state.paths.set(exact.path, exact.sha256); state.count++; pins.push(exact)
    const current = await readBytes(exact.path)
    if (m80HostedSha256(current) !== exact.sha256) throw new Error(`Reviewed executor source changed at ${exact.path}.`)
    if (exact.path.startsWith("operations/agent-improvement/snapshots/") && exact.path.endsWith(".json")) {
      const nested = parseM71Json(row.text, M80_EXECUTOR_SOURCE_MAX_BYTES) as Record<string, unknown>
      if (Array.isArray(nested?.artifacts) || Array.isArray(nested?.files)) await validateSnapshotClosure(nested, readBytes, state, depth + 1)
    }
  }
  return pins
}

export async function validateM80ExecutorReview(item: EvidencePin, readBytes: (path: string) => Promise<Uint8Array> = readWorkspaceBytes): Promise<M80ExecutorSourceReview> {
  const value = await loadPinnedJson(item, readBytes)
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Exact independent executor transport-only review required.")
  const review = value as Record<string, unknown>
  if (review.verdict !== "pass_m80_executor_transport_only" || review.reviewer !== "/root/m80_foundation_runtime_qa" || !Array.isArray(review.source_pins) || review.source_pins.length < 1) throw new Error("Exact independent executor transport-only review required.")
  const snapshotPin = pin(review.source_snapshot, "executor review source_snapshot"), snapshot = await loadPinnedJson(snapshotPin, readBytes, M80_EXECUTOR_SOURCE_MAX_BYTES)
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || !Array.isArray((snapshot as Record<string, unknown>).artifacts)) throw new Error("Concrete executor transport snapshot required.")
  const outerRows = (snapshot as { artifacts: unknown[] }).artifacts
  const artifacts = outerRows.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`executor snapshot artifacts[${index}] changed.`)
    const row = entry as Record<string, unknown>
    return pin({ path: row.path, sha256: row.sha256 }, `executor snapshot artifacts[${index}]`)
  })
  const sourcePins = review.source_pins.map((entry, index) => pin(entry, `executor review source_pins[${index}]`))
  if (new Set(sourcePins.map(entry => entry.path)).size !== sourcePins.length || m80HostedCanonicalJson([...sourcePins].sort((a,b)=>a.path.localeCompare(b.path))) !== m80HostedCanonicalJson([...artifacts].sort((a,b)=>a.path.localeCompare(b.path))) || !sourcePins.some(entry => entry.path === M80_EXECUTOR_ENTRYPOINT_PATH)) throw new Error("Executor review source closure is incomplete, duplicated or differs from its snapshot.")
  await validateSnapshotClosure(snapshot, readBytes)
  return value as unknown as M80ExecutorSourceReview
}

function validatePlanEvidence(plan: M80HostedPreparationPlan, evidence: M80ExecutorArtifacts["planEvidence"]): void {
  const { fixtureProfileId: _profile, fixtureVersion: _version, fixtureSha256: _fixture, ...admission } = plan.admission
  const input = { profile: M80_HOSTED_INPUT_PROFILE, operatorId: "/root", observedTarget: plan.target, publication: plan.publication, acceptedRuntime: { candidate: plan.pins.candidate, migration: plan.pins.migration, rootClosure: plan.pins.rootClosure }, backup: plan.backup, rehearsal: plan.rehearsal, admission } as HostedPreparationInput
  const rows: Array<[keyof M80ExecutorArtifacts["planEvidence"], EvidencePin, Parameters<typeof m80ExpectedHostedEvidence>[1]]> = [
    ["targetObservation", plan.pins.targetObservation, "target"], ["publicationReview", plan.pins.publicationReview, "publication"], ["integrationAcceptance", plan.pins.integrationAcceptance, "integration"],
    ["backupReceipt", plan.pins.backupReceipt, "backup"], ["restoreReceipt", plan.pins.restoreReceipt, "restore"], ["preservationReceipt", plan.pins.preservationReceipt, "preservation"],
    ["migrationRehearsalReceipt", plan.pins.migrationRehearsalReceipt, "rehearsal"], ["admissionObservation", plan.pins.admissionObservation, "admission"],
  ]
  for (const [name, expectedPin, kind] of rows) {
    const loaded = evidence[name], loadedPin = pin(loaded.pin, `plan evidence ${name}`), expected = m80ExpectedHostedEvidence(input, kind)
    if (loadedPin.path !== expectedPin.path || loadedPin.sha256 !== expectedPin.sha256 || loadedPin.sha256 !== artifactSha256(loaded.value) || m80HostedCanonicalJson(loaded.value) !== m80HostedCanonicalJson(expected)) throw new Error(`Plan evidence bytes or typed contents changed for ${name}.`)
  }
}

function expectedAttempt(args: { artifacts: M80ExecutorArtifacts; plan: M80HostedPreparationPlan; intent: M80HostedIntent; startedAt: string; preMigrationState: EvidencePin | null }): M80ExecutorAttempt {
  const unsigned = {
    profile: M80_EXECUTOR_ATTEMPT_PROFILE,
    startedAt: args.startedAt,
    operatorId: "/root" as const,
    stage: args.intent.stage,
    plan: pin(args.artifacts.planPin, "attempt plan pin"),
    intent: pin(args.artifacts.intentPin, "attempt intent pin"),
    executorReview: pin(args.artifacts.executorReview, "attempt executor review pin"),
    operationScopeSha256: args.plan.operationScopeSha256,
    targetProjectRef: args.plan.target.projectRef,
    targetEnvironmentId: args.plan.target.environmentId,
    targetServiceId: args.plan.target.serviceId,
    actionIdentity: structuredClone(args.intent.actionIdentity),
    preMigrationState: args.preMigrationState,
    durableBeforeTransport: true as const,
    noAutomaticRetry: true as const,
  }
  return { ...unsigned, attemptSha256: m80HostedSha256(m80HostedCanonicalJson(unsigned)) }
}

async function preflight(artifacts: M80ExecutorArtifacts, deps: M80ExecutorDependencies, requireTransport: boolean, verificationTime?: Date): Promise<{ plan: M80HostedPreparationPlan; intent: M80HostedIntent; now: Date }> {
  const now = verificationTime ?? deps.now?.() ?? new Date(), readBytes = deps.readSourceBytes ?? readWorkspaceBytes
  const plan = validateM80HostedPlan(artifacts.plan, now), planPin = pin(artifacts.planPin, "executor plan pin"), gatePin = pin(artifacts.gatePin, "executor gate pin"), intentPin = pin(artifacts.intentPin, "executor intent pin")
  if (artifacts.stage !== (artifacts.intent as Record<string, unknown>)?.stage || planPin.sha256 !== artifactSha256(plan) || gatePin.sha256 !== artifactSha256(artifacts.gate) || intentPin.sha256 !== artifactSha256(artifacts.intent)) throw new Error("Executor artifacts do not match their exact byte pins and stage.")
  await validateM80ExecutorReview(artifacts.executorReview, readBytes)
  validatePlanEvidence(plan, artifacts.planEvidence)
  validateM80HostedGate(artifacts.gate, plan, planPin, artifacts.stage, artifacts.gateEvidence, now)
  const createdAt = exactIso((artifacts.intent as Record<string, unknown>).createdAt, "intent.createdAt")
  const intent = sealM80HostedIntent({ plan, planPin, gate: artifacts.gate, gatePin, gateEvidence: artifacts.gateEvidence, stage: artifacts.stage, migration: artifacts.migration, admission: artifacts.admission, now: new Date(createdAt) })
  if (m80HostedCanonicalJson(intent) !== m80HostedCanonicalJson(artifacts.intent)) throw new Error("Executor intent is not the exact reconstructed reviewed intent.")
  const backupAt = exactIso(plan.backup.completedAt, "plan.backup.completedAt")
  if (backupAt > now.getTime() || now.getTime() - backupAt > 24 * 60 * 60_000 || plan.backup.sourceSchemaVersion !== 21 || plan.rehearsal.sourceSchemaVersion !== 21 || plan.rehearsal.targetSchemaVersion !== 22 || plan.rehearsal.oldContentExact !== true || plan.rehearsal.oldMetadataExact !== true || plan.rehearsal.releaseRecordsExactFourHeld !== true) throw new Error("Fresh encrypted backup and disposable restore/preservation rehearsal required before execution.")
  if (requireTransport && artifacts.stage !== "deployment" && !deps.database) throw new Error("A private operator database connection must be injected before durable attempt creation.")
  if (requireTransport && artifacts.stage === "deployment" && !deps.provider) throw new Error("A reviewed private provider transport must be injected before durable attempt creation.")
  return { plan, intent, now }
}

export async function executeM80Migration(database: WorkspaceConnection, plan: M80HostedPreparationPlan): Promise<void> {
  const result = await migratePrivateStaging(database, { expectedProjectRef: plan.target.projectRef, syntheticTargetConfirmed: true, reuseExistingProject: true })
  const migration = result.migrations.at(-1)
  if (result.schemaVersion !== 22 || result.migrations.length !== 22 || migration?.name !== "0022_scope1_beta_foundation.sql" || migration.sha256 !== M80_MIGRATION_0022_SHA256) throw new Error("Migration transport did not return the exact schema-22 manifest.")
}

interface AdmissionRow { company_id: string; fixture_profile_id: string; fixture_version: number; fixture_sha256: string; active: boolean; admitted_by: string }

function exactAdmission(row: AdmissionRow | undefined, plan: M80HostedPreparationPlan): boolean {
  return !!row && row.company_id === plan.admission.companyId && row.admitted_by === plan.admission.managerUserId && row.fixture_profile_id === "m80-synthetic-scope1-foundation-v1" && row.fixture_version === 1 && row.fixture_sha256 === M80_FIXTURE_SHA256 && row.active === true
}

export async function executeM80Admission(database: WorkspaceConnection, plan: M80HostedPreparationPlan): Promise<void> {
  await database.transaction(async (tx: WorkspaceSql) => {
    const inserted = await tx.query<AdmissionRow>(M80_ADMISSION_SQL, [plan.admission.companyId, plan.admission.managerUserId])
    if (inserted.rows.length !== 1 || !exactAdmission(inserted.rows[0], plan)) throw new Error("Admission must insert exactly one existing synthetic company/owner row.")
    const readback = await tx.query<AdmissionRow>("select company_id::text,fixture_profile_id,fixture_version,fixture_sha256,active,admitted_by::text from neuvetra.scope1_beta_fixture_admissions where company_id=$1::uuid", [plan.admission.companyId])
    if (readback.rows.length !== 1 || !exactAdmission(readback.rows[0], plan)) throw new Error("Admission exact readback failed; transaction must roll back.")
  })
}

export class M80FileExecutorJournal implements M80ExecutorJournal {
  async writeOnce(path: string, value: unknown): Promise<void> {
    if (dirname(path) !== ".superpowers" || !path.startsWith(".superpowers/m80-foundation-executor-") || !path.endsWith(".json") || path.includes("\\") || path.split("/").includes("..")) throw new Error("Executor journal path is outside its fixed namespace.")
    const absolute = resolve(repoRoot, path), inside = relative(repoRoot, absolute)
    if (!inside || inside.startsWith("..") || isAbsolute(inside)) throw new Error("Executor journal path escaped the workspace.")
    if ((await realpath(dirname(absolute))).toLowerCase() !== (await realpath(resolve(repoRoot, ".superpowers"))).toLowerCase()) throw new Error("Executor journal parent escaped through a filesystem link.")
    await writeM80HostedEvidenceOnce(absolute, value)
  }
}

export const m80ExecutorAttemptPath = (intent: M80HostedIntent): string => `.superpowers/m80-foundation-executor-${intent.operationScopeSha256}-${intent.stage}-attempt.json`
export const m80ExecutorMigrationSourcePath = (intent: M80HostedIntent): string => `.superpowers/m80-foundation-executor-${intent.operationScopeSha256}-migration-source.json`
export const m80ExecutorProviderAcknowledgementPath = (intent: M80HostedIntent): string => `.superpowers/m80-foundation-executor-${intent.operationScopeSha256}-deployment-ack.json`
export const m80ExecutorPendingObservationPath = (intent: M80HostedIntent, observedAt: string): string => `.superpowers/m80-foundation-executor-${intent.operationScopeSha256}-${intent.stage}-pending-${observedAt.replace(/\D/g, "")}.json`
export const m80ExecutorObservationPath = (intent: M80HostedIntent): string => `.superpowers/m80-foundation-executor-${intent.operationScopeSha256}-${intent.stage}-observation.json`
export const m80ExecutorOutcomePath = (intent: M80HostedIntent): string => `.superpowers/m80-foundation-executor-${intent.operationScopeSha256}-${intent.stage}-outcome.json`

function providerAcknowledgement(artifacts: M80ExecutorArtifacts, plan: M80HostedPreparationPlan, intent: M80HostedIntent, attempt: M80ExecutorAttempt, deploymentId: unknown, acknowledgedAt: Date): M80ExecutorProviderAcknowledgement {
  if (intent.stage !== "deployment" || typeof deploymentId !== "string" || !UUID.test(deploymentId)) throw new Error("Exact provider deployment acknowledgement required.")
  return {
    profile: M80_EXECUTOR_PROVIDER_ACK_PROFILE,
    acknowledgedAt: acknowledgedAt.toISOString(),
    stage: "deployment",
    attempt: { path: m80ExecutorAttemptPath(intent), sha256: artifactSha256(attempt) },
    intent: pin(artifacts.intentPin, "provider acknowledgement intent"),
    operationScopeSha256: plan.operationScopeSha256,
    projectRef: plan.target.projectRef,
    environmentId: plan.target.environmentId,
    serviceId: plan.target.serviceId,
    commitSha: plan.publication.reviewedHeadCommitSha,
    deploymentId,
  }
}

function validateProviderAcknowledgement(artifacts: M80ExecutorArtifacts, plan: M80HostedPreparationPlan, intent: M80HostedIntent, attempt: M80ExecutorAttempt, loaded: M80HostedLoadedEvidence | undefined, verificationTime: Date): M80ExecutorProviderAcknowledgement | undefined {
  if (!loaded) return undefined
  const exact = pin(loaded.pin, "provider acknowledgement pin")
  closed(loaded.value, ["profile", "acknowledgedAt", "stage", "attempt", "intent", "operationScopeSha256", "projectRef", "environmentId", "serviceId", "commitSha", "deploymentId"], "provider acknowledgement")
  const acknowledgedAt = exactIso(loaded.value.acknowledgedAt, "provider acknowledgement acknowledgedAt")
  if (acknowledgedAt < exactIso(attempt.startedAt, "provider acknowledgement attempt startedAt") || acknowledgedAt > verificationTime.getTime()) throw new Error("Provider acknowledgement is outside its exact attempt and verification chronology.")
  const expected = providerAcknowledgement(artifacts, plan, intent, attempt, loaded.value.deploymentId, new Date(acknowledgedAt))
  if (exact.path !== m80ExecutorProviderAcknowledgementPath(intent) || exact.sha256 !== artifactSha256(loaded.value) || m80HostedCanonicalJson(loaded.value) !== m80HostedCanonicalJson(expected)) throw new Error("Provider acknowledgement changed or is not bound to this exact attempt.")
  return loaded.value as unknown as M80ExecutorProviderAcknowledgement
}

function validateDeploymentSuccessBinding(intent: M80HostedIntent, observation: unknown, acknowledgement: M80ExecutorProviderAcknowledgement | undefined): void {
  if (intent.stage !== "deployment" || (observation as Record<string, unknown>)?.transportOutcome !== "definitive_success") return
  if (!acknowledgement) throw new Error("Deployment success requires the exact durable provider acknowledgement.")
  const value = observation as Record<string, unknown>, state = value.authoritativeState as Record<string, unknown>
  const observedAt = exactIso(value.observedAt, "deployment success observedAt"), acknowledgedAt = exactIso(acknowledgement.acknowledgedAt, "deployment success acknowledgedAt")
  if (observedAt < acknowledgedAt || !state || state.deploymentId !== acknowledgement.deploymentId) throw new Error("Deployment success is not bound to the acknowledged deployment ID and chronology.")
}

async function observeAndPersist(artifacts: M80ExecutorArtifacts, plan: M80HostedPreparationPlan, intent: M80HostedIntent, attempt: M80ExecutorAttempt, deps: M80ExecutorDependencies): Promise<M80HostedOutcome> {
  let observation: unknown
  try { observation = await deps.observer.observe({ stage: intent.stage, plan, intent }) }
  catch {
    const observedAt = (deps.now?.() ?? new Date()).toISOString()
    const pending = { profile: M80_EXECUTOR_PENDING_OBSERVATION_PROFILE, observedAt, stage: intent.stage, attempt: { path: m80ExecutorAttemptPath(intent), sha256: artifactSha256(attempt) }, intent: pin(artifacts.intentPin, "pending observation intent"), operationScopeSha256: intent.operationScopeSha256, status: "observer_unavailable_or_nonterminal", sideEffectRetried: false }
    await deps.journal.writeOnce(m80ExecutorPendingObservationPath(intent, observedAt), pending)
    throw new M80ProviderPendingError("Authoritative observation remains pending; side effect was not retried.")
  }
  validateDeploymentSuccessBinding(intent, observation, deps.providerAcknowledgement?.value as M80ExecutorProviderAcknowledgement | undefined)
  const observationPin = { path: m80ExecutorObservationPath(intent), sha256: artifactSha256(observation) }
  const outcome = recordM80HostedOutcome({ intent, intentPin: artifacts.intentPin, observation, observationPin, now: deps.now?.() ?? new Date() })
  await deps.journal.writeOnce(observationPin.path, observation)
  await deps.journal.writeOnce(m80ExecutorOutcomePath(intent), outcome)
  return outcome
}

async function completeFromPersistedObservation(artifacts: M80ExecutorArtifacts, intent: M80HostedIntent, receipt: M80HostedLoadedEvidence, deps: M80ExecutorDependencies): Promise<M80HostedOutcome> {
  const exact = pin(receipt.pin, "persisted observation pin")
  if (exact.path !== m80ExecutorObservationPath(intent) || exact.sha256 !== artifactSha256(receipt.value)) throw new Error("Persisted authoritative observation changed.")
  validateDeploymentSuccessBinding(intent, receipt.value, deps.providerAcknowledgement?.value as M80ExecutorProviderAcknowledgement | undefined)
  const outcome = recordM80HostedOutcome({ intent, intentPin: artifacts.intentPin, observation: receipt.value, observationPin: exact, now: deps.now?.() ?? new Date() })
  await deps.journal.writeOnce(m80ExecutorOutcomePath(intent), outcome)
  return outcome
}

export async function executeM80HostedStage(artifacts: M80ExecutorArtifacts, deps: M80ExecutorDependencies): Promise<M80HostedOutcome> {
  const { plan, intent, now } = await preflight(artifacts, deps, true)
  let preMigrationState: EvidencePin | null = null
  if (intent.stage === "migration") {
    if (!deps.migrationSourceState || typeof deps.migrationSourceState !== "object" || (deps.migrationSourceState as Record<string, unknown>).applicationStateSha256 !== plan.target.applicationStateSha256) throw new Error("Exact captured pre-migration application state required before durable attempt creation.")
    const source = { profile: M80_EXECUTOR_MIGRATION_SOURCE_PROFILE, capturedAt: now.toISOString(), projectRef: plan.target.projectRef, applicationStateSha256: plan.target.applicationStateSha256, state: deps.migrationSourceState }
    if (new TextEncoder().encode(`${JSON.stringify(source, null, 2)}\n`).byteLength > M80_EXECUTOR_SOURCE_MAX_BYTES) throw new Error("Pre-migration source receipt exceeds the bounded restart loader.")
    preMigrationState = { path: m80ExecutorMigrationSourcePath(intent), sha256: artifactSha256(source) }
    await deps.journal.writeOnce(preMigrationState.path, source)
  }
  const attempt = expectedAttempt({ artifacts, plan, intent, startedAt: now.toISOString(), preMigrationState })
  await deps.journal.writeOnce(m80ExecutorAttemptPath(intent), attempt)
  let providerAcknowledgementPersisted = intent.stage !== "deployment"
  let retainedProviderAcknowledgement: M80HostedLoadedEvidence | undefined
  try {
    if (intent.stage === "migration") await (deps.migrate ?? executeM80Migration)(deps.database!, plan)
    else if (intent.stage === "admission") await (deps.admit ?? executeM80Admission)(deps.database!, plan)
    else {
      const action = intent.actionIdentity as { environmentId?: unknown; serviceId?: unknown; commitSha?: unknown }
      if (typeof action.environmentId !== "string" || !UUID.test(action.environmentId) || typeof action.serviceId !== "string" || !UUID.test(action.serviceId) || typeof action.commitSha !== "string") throw new Error("Exact deployment action identity required.")
      const deploymentId = await deps.provider!.serviceInstanceDeployV2({ environmentId: action.environmentId, serviceId: action.serviceId, commitSha: action.commitSha })
      const acknowledgement = providerAcknowledgement(artifacts, plan, intent, attempt, deploymentId, deps.now?.() ?? new Date())
      const acknowledgementPath = m80ExecutorProviderAcknowledgementPath(intent), acknowledgementPin = { path: acknowledgementPath, sha256: artifactSha256(acknowledgement) }
      await deps.journal.writeOnce(acknowledgementPath, acknowledgement)
      retainedProviderAcknowledgement = { value: acknowledgement, pin: acknowledgementPin }
      providerAcknowledgementPersisted = true
    }
  } catch {
    // The authoritative observer decides success, failure or uncertainty. The transport is never retried.
  }
  if (!providerAcknowledgementPersisted) {
    const observation = { profile: "neuvetra.m80.foundation-hosted-outcome-observation.v1", observedAt: (deps.now?.() ?? new Date()).toISOString(), stage: intent.stage, transportOutcome: "unknown", authoritativeState: {} }
    return observeAndPersist(artifacts, plan, intent, attempt, { ...deps, observer: { observe: async () => observation } })
  }
  return observeAndPersist(artifacts, plan, intent, attempt, { ...deps, providerAcknowledgement: retainedProviderAcknowledgement })
}

export async function reconcileM80HostedStage(artifacts: M80ExecutorArtifacts, attemptValue: unknown, attemptPin: EvidencePin, deps: M80ExecutorDependencies): Promise<M80HostedOutcome> {
  closed(attemptValue, ["profile", "startedAt", "operatorId", "stage", "plan", "intent", "executorReview", "operationScopeSha256", "targetProjectRef", "targetEnvironmentId", "targetServiceId", "actionIdentity", "preMigrationState", "durableBeforeTransport", "noAutomaticRetry", "attemptSha256"], "executor attempt")
  const exactPin = pin(attemptPin, "executor attempt pin"), startedAt = exactIso(attemptValue.startedAt, "executor attempt startedAt")
  const { plan, intent } = await preflight(artifacts, deps, false, new Date(startedAt))
  const preMigrationState = attemptValue.preMigrationState === null ? null : pin(attemptValue.preMigrationState, "executor attempt preMigrationState")
  if (intent.stage === "migration") {
    if (!preMigrationState || preMigrationState.path !== m80ExecutorMigrationSourcePath(intent) || !deps.migrationSourceReceipt || deps.migrationSourceReceipt.pin.path !== preMigrationState.path || deps.migrationSourceReceipt.pin.sha256 !== preMigrationState.sha256 || artifactSha256(deps.migrationSourceReceipt.value) !== preMigrationState.sha256) throw new Error("Observer-only migration reconciliation requires the exact durable pre-migration state receipt.")
    const source = deps.migrationSourceReceipt.value
    closed(source, ["profile", "capturedAt", "projectRef", "applicationStateSha256", "state"], "migration source receipt")
    if (source.profile !== M80_EXECUTOR_MIGRATION_SOURCE_PROFILE || source.projectRef !== plan.target.projectRef || source.applicationStateSha256 !== plan.target.applicationStateSha256 || (source.state as Record<string, unknown>)?.applicationStateSha256 !== plan.target.applicationStateSha256) throw new Error("Durable pre-migration state receipt changed.")
  } else if (preMigrationState !== null) throw new Error("Only migration may bind a pre-migration state receipt.")
  const expected = expectedAttempt({ artifacts, plan, intent, startedAt: new Date(startedAt).toISOString(), preMigrationState })
  if (exactPin.path !== m80ExecutorAttemptPath(intent) || exactPin.sha256 !== artifactSha256(attemptValue) || m80HostedCanonicalJson(attemptValue) !== m80HostedCanonicalJson(expected)) throw new Error("Observer-only reconciliation requires the exact durable attempt marker.")
  if (intent.stage === "deployment") validateProviderAcknowledgement(artifacts, plan, intent, expected, deps.providerAcknowledgement, deps.now?.() ?? new Date())
  else if (deps.providerAcknowledgement) throw new Error("Only deployment may bind a provider acknowledgement.")
  if (deps.observationReceipt) return completeFromPersistedObservation(artifacts, intent, deps.observationReceipt, deps)
  return observeAndPersist(artifacts, plan, intent, expected, deps)
}

async function loadedEvidence(item: unknown, name: string): Promise<M80HostedLoadedEvidence> {
  const exact = pin(item, name)
  return { value: await loadPinnedJson(exact, readWorkspaceBytes), pin: exact }
}

async function loadedGateEvidence(gate: unknown): Promise<M80ExecutorArtifacts["gateEvidence"]> {
  const value = gate as Record<string, unknown>
  return { securityReview: await loadedEvidence(value.securityReview, "gate securityReview"), integrationAcceptance: await loadedEvidence(value.integrationAcceptance, "gate integrationAcceptance"), targetObservation: await loadedEvidence(value.targetObservation, "gate targetObservation") }
}

async function loadPredecessorFiles(value: unknown, name: "migration" | "admission"): Promise<M80HostedPredecessorArtifacts | undefined> {
  if (value === null) return undefined
  closed(value, ["intent", "observation", "outcome"], `${name} predecessor files`)
  const intent = await loadedEvidence(value.intent, `${name} predecessor intent`), observation = await loadedEvidence(value.observation, `${name} predecessor observation`), outcome = await loadedEvidence(value.outcome, `${name} predecessor outcome`)
  const gatePin = pin((intent.value as Record<string, unknown>).gate, `${name} predecessor gate`), gate = await loadedEvidence(gatePin, `${name} predecessor gate`)
  return { intent: intent.value, intentPin: intent.pin, gate: gate.value, gatePin: gate.pin, gateEvidence: await loadedGateEvidence(gate.value), observation: observation.value, observationPin: observation.pin, outcome: outcome.value, outcomePin: outcome.pin }
}

export async function loadM80ExecutorBundle(item: EvidencePin): Promise<M80ExecutorArtifacts> {
  const value = await loadPinnedJson(item, readWorkspaceBytes)
  closed(value, ["profile", "stage", "plan", "gate", "intent", "executorReview", "planEvidence", "migration", "admission"], "executor bundle")
  if (value.profile !== M80_EXECUTOR_BUNDLE_PROFILE || typeof value.stage !== "string" || !["migration", "admission", "deployment"].includes(value.stage)) throw new Error("Exact executor stage bundle required.")
  closed(value.planEvidence, ["targetObservation", "publicationReview", "integrationAcceptance", "backupReceipt", "restoreReceipt", "preservationReceipt", "migrationRehearsalReceipt", "admissionObservation"], "executor bundle planEvidence")
  const [plan, gate, intent, migration, admission] = await Promise.all([loadedEvidence(value.plan, "bundle plan"), loadedEvidence(value.gate, "bundle gate"), loadedEvidence(value.intent, "bundle intent"), loadPredecessorFiles(value.migration, "migration"), loadPredecessorFiles(value.admission, "admission")])
  const planEvidence = Object.fromEntries(await Promise.all(Object.entries(value.planEvidence).map(async ([key, evidence]) => [key, await loadedEvidence(evidence, `bundle planEvidence.${key}`)]))) as unknown as M80ExecutorArtifacts["planEvidence"]
  return { plan: plan.value, planPin: plan.pin, gate: gate.value, gatePin: gate.pin, gateEvidence: await loadedGateEvidence(gate.value), intent: intent.value, intentPin: intent.pin, stage: value.stage as M80HostedStage, executorReview: pin(value.executorReview, "bundle executorReview"), planEvidence, migration, admission }
}

export async function assertM80DatabasePreflight(database: WorkspaceConnection, stage: M80HostedStage, plan: M80HostedPreparationPlan, expectedCurrentStateSha256?: string, captureState: (tx: WorkspaceSql) => Promise<ApplicationState> = captureApplicationState, options: { allowRuntimeSessions?: boolean } = {}): Promise<ApplicationState | undefined> {
  if (options.allowRuntimeSessions === true && stage !== "deployment") throw new Error("Runtime sessions are allowed only for post-deployment observer reconciliation.")
  return database.transaction(async tx => {
    await tx.exec("set transaction isolation level repeatable read read only")
    const sessions = (await tx.query<{ count: number }>("select count(*)::int count from pg_stat_activity where datname=current_database() and usename='neuvetra_runtime' and backend_type='client backend'")).rows[0]?.count
    if (!Number.isSafeInteger(sessions) || sessions! < 0 || (options.allowRuntimeSessions !== true && sessions !== 0)) throw new Error("Active application database sessions refuse execution.")
    if (stage === "migration") {
      await verifyExactSource21(tx, "postgres", "hosted")
      const state = await captureApplicationState(tx)
      if (state.applicationStateSha256 !== plan.target.applicationStateSha256) throw new Error("Current schema-21 application state differs from the reviewed target.")
      return state
    }
    const receipts = await tx.query<{ name: string; sha256: string }>("select name,sha256 from neuvetra.schema_migrations order by name")
    const target = await tx.query<{ projectRef: string; profile: string }>("select project_ref \"projectRef\",profile from neuvetra.staging_target")
    if (receipts.rows.length !== 22 || receipts.rows[21]?.name !== "0022_scope1_beta_foundation.sql" || receipts.rows[21]?.sha256 !== M80_MIGRATION_0022_SHA256 || target.rows.length !== 1 || target.rows[0]?.projectRef !== plan.target.projectRef || target.rows[0]?.profile !== "neuvetra.private-synthetic-staging.v1") throw new Error("Exact hosted schema-22 target required.")
    if (expectedCurrentStateSha256 !== undefined) {
      if (!SHA256.test(expectedCurrentStateSha256)) throw new Error("Fresh gate application-state SHA-256 required.")
      const current = await captureState(tx)
      if (current.applicationStateSha256 !== expectedCurrentStateSha256) throw new Error("Current schema-22 application state differs from the fresh reviewed gate.")
    }
    return undefined
  })
}

function databaseObserver(database: WorkspaceConnection, source: ApplicationState | undefined): M80ExecutorObserver {
  return { observe: async ({ stage, plan, intent }) => {
    if (stage === "migration") {
      if (!source) throw new Error("Migration source state missing.")
      return database.transaction(async tx => {
        await tx.exec("set transaction isolation level repeatable read read only")
        const after = await captureApplicationState(tx)
        await assertSchema22Delta(source, after, tx)
        return { profile: "neuvetra.m80.foundation-hosted-outcome-observation.v1", observedAt: new Date().toISOString(), stage, transportOutcome: "definitive_success", authoritativeState: { projectRef: plan.target.projectRef, environmentId: plan.target.environmentId, serviceId: plan.target.serviceId, schemaVersion: 22, migrationReceiptCount: 22, migrationName: "0022_scope1_beta_foundation.sql", migrationSha256: M80_MIGRATION_0022_SHA256, oldContentExact: true, oldMetadataExact: true } }
      })
    }
    const rows = await database.query<AdmissionRow>("select company_id::text,fixture_profile_id,fixture_version,fixture_sha256,active,admitted_by::text from neuvetra.scope1_beta_fixture_admissions where company_id=$1::uuid", [plan.admission.companyId])
    if (rows.rows.length === 0) return { profile: "neuvetra.m80.foundation-hosted-outcome-observation.v1", observedAt: new Date().toISOString(), stage, transportOutcome: "definitive_failure", authoritativeState: {} }
    if (rows.rows.length !== 1 || !exactAdmission(rows.rows[0], plan)) throw new Error("Admission observer found a conflicting row.")
    return { profile: "neuvetra.m80.foundation-hosted-outcome-observation.v1", observedAt: new Date().toISOString(), stage, transportOutcome: "definitive_success", authoritativeState: { projectRef: intent.targetProjectRef, environmentId: intent.targetEnvironmentId, serviceId: intent.targetServiceId, rowCount: 1, companyId: plan.admission.companyId, managerUserId: plan.admission.managerUserId, fixtureProfileId: "m80-synthetic-scope1-foundation-v1", fixtureVersion: 1, fixtureSha256: M80_FIXTURE_SHA256 } }
  } }
}

export type M80RailwayRun = (args: string[]) => Promise<unknown>
export type M80ReadinessFetch = () => Promise<unknown>
export class M80ProviderPendingError extends Error {}

async function defaultRailwayRun(args: string[]): Promise<unknown> {
  const bunx = resolve(dirname(process.execPath), process.platform === "win32" ? "bunx.exe" : "bunx")
  const child = Bun.spawn([bunx, "@railway/cli", ...args], { stdin: "ignore", stdout: "pipe", stderr: "pipe" })
  const [stdout, , code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  if (code !== 0 || stdout.length > 1_000_000) throw new Error("Private Railway transport failed or exceeded bounds.")
  return parseM80Json(stdout.replace(/^\uFEFF/, ""))
}

async function defaultReadinessFetch(): Promise<unknown> {
  const response = await fetch(M80_READINESS_URL, { redirect: "error", signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error("Readiness observation failed.")
  return response.json()
}

export function createM80RailwayTransport(run: M80RailwayRun = defaultRailwayRun, readReady: M80ReadinessFetch = defaultReadinessFetch, retainedAcknowledgedDeploymentId?: string): M80ProviderTransport & M80ExecutorObserver {
  let acknowledgedDeploymentId: string | undefined = retainedAcknowledgedDeploymentId
  if (acknowledgedDeploymentId !== undefined && !UUID.test(acknowledgedDeploymentId)) throw new Error("Retained provider acknowledgement is malformed.")
  return {
    serviceInstanceDeployV2: async input => {
      const query = `mutation { serviceInstanceDeployV2(environmentId:"${input.environmentId}",serviceId:"${input.serviceId}",commitSha:"${input.commitSha}") }`
      const value = await run(["api", query, "--compact"]) as Record<string, any>
      const id = value?.data?.serviceInstanceDeployV2
      if (value?.errors || typeof id !== "string" || !UUID.test(id)) throw new Error("Deployment request acknowledgment is absent or malformed.")
      acknowledgedDeploymentId = id
      return id
    },
    observe: async ({ stage, plan }) => {
      if (stage !== "deployment") throw new Error("Railway observer is deployment-only.")
      const rows = await run(["deployment", "list", "--project", M80_RAILWAY_PROJECT_ID, "--service", plan.target.serviceId, "--environment", plan.target.environmentId, "--json"])
      if (!Array.isArray(rows)) throw new Error("Deployment observation is malformed.")
      if (!acknowledgedDeploymentId) return { profile: "neuvetra.m80.foundation-hosted-outcome-observation.v1", observedAt: new Date().toISOString(), stage, transportOutcome: "unknown", authoritativeState: {} }
      const matching = rows.filter(row => row && typeof row === "object" && (row as any).meta?.commitHash === plan.publication.reviewedHeadCommitSha && (row as any).id === acknowledgedDeploymentId)
      if (matching.length === 0) throw new M80ProviderPendingError("Acknowledged deployment is not observable yet.")
      if (matching.length !== 1) return { profile: "neuvetra.m80.foundation-hosted-outcome-observation.v1", observedAt: new Date().toISOString(), stage, transportOutcome: "unknown", authoritativeState: {} }
      const deployment = matching[0] as any
      if (["FAILED", "CRASHED", "REMOVED", "SKIPPED"].includes(deployment.status)) return { profile: "neuvetra.m80.foundation-hosted-outcome-observation.v1", observedAt: new Date().toISOString(), stage, transportOutcome: "definitive_failure", authoritativeState: {} }
      if (deployment.status !== "SUCCESS") throw new M80ProviderPendingError("Exact deployment remains nonterminal; observer-only reconciliation is required.")
      const ready = await readReady() as Record<string, unknown>
      if (ready.status !== "ready" || ready.profile !== "neuvetra.private-synthetic-staging.v1" || ready.schemaVersion !== 22 || ready.legacyContainmentVerified !== true) throw new M80ProviderPendingError("Exact schema-22 readiness remains pending.")
      return { profile: "neuvetra.m80.foundation-hosted-outcome-observation.v1", observedAt: new Date().toISOString(), stage, transportOutcome: "definitive_success", authoritativeState: { projectRef: plan.target.projectRef, environmentId: plan.target.environmentId, serviceId: plan.target.serviceId, deploymentStatus: "SUCCESS", deploymentId: deployment.id, commitSha: plan.publication.reviewedHeadCommitSha, schemaVersion: 22, readinessOk: true } }
    },
  }
}

export async function runM80PrivateExecutor(inputValue: unknown): Promise<M80HostedOutcome> {
  closed(inputValue, ["profile", "operatorId", "mode", "bundle", "attempt", "operatorDatabaseUrl", "railwaySessionMode"], "private executor stdin")
  if (inputValue.profile !== M80_EXECUTOR_PRIVATE_INPUT_PROFILE || inputValue.operatorId !== "/root" || !["execute", "reconcile"].includes(inputValue.mode as string) || typeof inputValue.operatorDatabaseUrl !== "string" || inputValue.operatorDatabaseUrl.length > 2_048 || inputValue.railwaySessionMode !== "current_authenticated_cli") throw new Error("Closed root-only private executor stdin required.")
  const artifacts = await loadM80ExecutorBundle(pin(inputValue.bundle, "private executor bundle")), plan = validateM80HostedPlan(artifacts.plan), database = await connectOperator(inputValue.operatorDatabaseUrl)
  try {
    if (inputValue.mode === "execute") {
      if (inputValue.attempt !== null) throw new Error("New execution refuses a prior attempt pin.")
      const expectedState = artifacts.stage === "migration" ? undefined : (artifacts.gate as Record<string, unknown>).currentApplicationStateSha256
      const source = await assertM80DatabasePreflight(database, artifacts.stage, plan, typeof expectedState === "string" ? expectedState : undefined), railway = artifacts.stage === "deployment" ? createM80RailwayTransport() : undefined
      const deps: M80ExecutorDependencies = { journal: new M80FileExecutorJournal(), observer: railway ?? databaseObserver(database, source), database, provider: railway, migrationSourceState: source }
      return executeM80HostedStage(artifacts, deps)
    }
    const attemptPin = pin(inputValue.attempt, "reconciliation attempt"), attempt = await loadPinnedJson(attemptPin, readWorkspaceBytes)
    let migrationSourceReceipt: M80HostedLoadedEvidence | undefined, source: ApplicationState | undefined
    if (artifacts.stage === "migration") {
      const sourcePin = pin((attempt as Record<string, unknown>).preMigrationState, "reconciliation preMigrationState")
      migrationSourceReceipt = { value: await loadM80ExecutorSourceEvidence(sourcePin), pin: sourcePin }
      source = (migrationSourceReceipt.value as Record<string, unknown>).state as ApplicationState
    } else {
      await assertM80DatabasePreflight(database, artifacts.stage, plan, undefined, captureApplicationState, { allowRuntimeSessions: artifacts.stage === "deployment" })
    }
    const intent = artifacts.intent as M80HostedIntent
    let providerAcknowledgementReceipt: M80HostedLoadedEvidence | undefined
    if (artifacts.stage === "deployment") {
      const acknowledgementPath = m80ExecutorProviderAcknowledgementPath(intent)
      try {
        const bytes = await readWorkspaceBytes(acknowledgementPath)
        providerAcknowledgementReceipt = { value: parseM71Json(new TextDecoder().decode(bytes), M80_EXECUTOR_EVIDENCE_MAX_BYTES), pin: { path: acknowledgementPath, sha256: m80HostedSha256(bytes) } }
      } catch (error) {
        if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "ENOENT") throw error
      }
    }
    const retainedDeploymentId = (providerAcknowledgementReceipt?.value as Record<string, unknown> | undefined)?.deploymentId
    const railway = artifacts.stage === "deployment" ? createM80RailwayTransport(undefined, undefined, typeof retainedDeploymentId === "string" ? retainedDeploymentId : undefined) : undefined
    let observationReceipt: M80HostedLoadedEvidence | undefined
    const observationPath = m80ExecutorObservationPath(intent)
    try {
      const bytes = await readWorkspaceBytes(observationPath)
      observationReceipt = { value: parseM80Json(new TextDecoder().decode(bytes)), pin: { path: observationPath, sha256: m80HostedSha256(bytes) } }
    } catch (error) {
      if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "ENOENT") throw error
    }
    const deps: M80ExecutorDependencies = { journal: new M80FileExecutorJournal(), observer: railway ?? databaseObserver(database, source), database, provider: railway, migrationSourceReceipt, observationReceipt, providerAcknowledgement: providerAcknowledgementReceipt }
    return reconcileM80HostedStage(artifacts, attempt, attemptPin, deps)
  } finally { await database.close() }
}

if (import.meta.main) {
  try {
    const text = await Bun.stdin.text()
    if (Buffer.byteLength(text, "utf8") > 32_768) throw new Error("Private executor stdin exceeded its bound.")
    const outcome = await runM80PrivateExecutor(parseM80Json(text))
    console.log(JSON.stringify({ status: outcome.status, stage: outcome.stage, retryAllowed: false }))
  } catch {
    console.error(JSON.stringify({ status: "m80_foundation_executor_refused_or_uncertain", retryAllowed: false }))
    process.exitCode = 1
  }
}

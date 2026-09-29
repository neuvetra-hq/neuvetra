import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import {
  M80_ACCEPTED_CANDIDATE_SHA256,
  M80_EXPECTED_NEW_TABLE_ROW_COUNTS,
  M80_HOSTED_INPUT_PROFILE,
  M80_MIGRATION_0022_SHA256,
  M80_NEW_TABLES,
  M80_REQUIRED_CHECKS,
  M80_RUNTIME_ROOT_CLOSURE_SHA256,
  buildM80HostedPreparationPlan,
  m80ExpectedHostedEvidence,
  m80HostedCanonicalJson,
  m80HostedSha256,
  type EvidencePin,
  type HostedPreparationInput,
  type M80HostedPreparationPlan,
} from "../../.superpowers/m80-foundation-hosted-prepare-v3"
import {
  M80_HOSTED_GATE_PROFILE,
  M80_HOSTED_IMPLEMENTATION_AUTHOR,
  M80_HOSTED_OBSERVATION_PROFILE,
  m80HostedIntentPath,
  recordM80HostedOutcome,
  sealM80HostedIntent,
  type M80HostedIntent,
  type M80HostedPredecessorArtifacts,
  type M80HostedStage,
} from "../../.superpowers/m80-foundation-hosted-once-v3"
import {
  M80_EXECUTOR_ENTRYPOINT_PATH,
  M80_EXECUTOR_PREPARATION_CANDIDATE_PATH,
  M80_EXECUTOR_PREPARATION_CANDIDATE_SHA256,
  M80_EXECUTOR_REVIEW_PROFILE,
  createM80RailwayTransport,
  closeM80DatabaseAfter,
  assertM80DatabasePreflight,
  executeM80Admission,
  executeM80HostedStage,
  loadM80ExecutorEvidence,
  m80ExecutorAttemptPath,
  m80ExecutorMigrationSourcePath,
  m80ExecutorObservationPath,
  m80ExecutorOutcomePath,
  m80ExecutorPendingObservationPath,
  m80ExecutorProviderAcknowledgementPath,
  reconcileM80HostedStage,
  validateM80ExecutorReview,
  type M80ExecutorArtifacts,
  type M80ExecutorJournal,
  type M80ExecutorSourceReview,
} from "../../.superpowers/m80-foundation-executor-v2"
import {
  m80ExecutorAttemptPath as m80ExecutorAttemptPathV1,
  m80ExecutorMigrationSourcePath as m80ExecutorMigrationSourcePathV1,
  m80ExecutorObservationPath as m80ExecutorObservationPathV1,
  m80ExecutorOutcomePath as m80ExecutorOutcomePathV1,
  m80ExecutorPendingObservationPath as m80ExecutorPendingObservationPathV1,
  m80ExecutorProviderAcknowledgementPath as m80ExecutorProviderAcknowledgementPathV1,
} from "../../.superpowers/m80-foundation-executor"
import type { WorkspaceConnection, WorkspaceSql } from "../../packages/neuvetra-database/src/workspace"
import { composeM80StageBundle, m80StageBundlePath, type M80StageBundleComposeInput } from "../../.superpowers/m80-stage-bundle-compose-v2"

const NOW = new Date("2026-09-24T22:12:00.000Z")
const sha = (character: string) => character.repeat(64)
const artifactSha256 = (value: unknown) => m80HostedSha256(`${JSON.stringify(value, null, 2)}\n`)
const artifactPin = (path: string, value: unknown): EvidencePin => ({ path, sha256: artifactSha256(value) })
const fakePin = (path: string, character: string): EvidencePin => ({ path, sha256: sha(character) })
const TABLES = ["auth.users", "neuvetra.companies", "neuvetra.company_members"]
const CONTENT_SHA256 = sha("a")
const SOURCE_RAW_METADATA_SHA256 = sha("b")
const RESTORED_RAW_METADATA_SHA256 = sha("c")
const SOURCE_RAW_APPLICATION_STATE_SHA256 = m80HostedSha256(m80HostedCanonicalJson({ contentSha256: CONTENT_SHA256, metadataSha256: SOURCE_RAW_METADATA_SHA256 }))
const RESTORED_RAW_APPLICATION_STATE_SHA256 = m80HostedSha256(m80HostedCanonicalJson({ contentSha256: CONTENT_SHA256, metadataSha256: RESTORED_RAW_METADATA_SHA256 }))
const NORMALIZED_METADATA_SHA256 = sha("d")

function preparationInput(): HostedPreparationInput {
  const value: HostedPreparationInput = {
    profile: M80_HOSTED_INPUT_PROFILE, operatorId: "/root",
    observedTarget: {
      observedAt: "2026-09-24T22:00:00.000Z", observationPhase: "healthy_pre_stop_baseline", observationReceipt: fakePin(".superpowers/m80-foundation-hosted-target-observation.json", "0"),
      projectRef: "abcdefghijklmnopqrst", environmentId: "80000000-0000-4000-8000-000000000001", serviceId: "80000000-0000-4000-8000-000000000002", deploymentId: "80000000-0000-4000-8000-000000000003",
      deploymentStatus: "SUCCESS", deployedCommitSha: "1".repeat(40), deployedImageSha256: sha("2"), targetClassification: "private_synthetic_staging", syntheticDataOnlyVerified: true,
      schemaVersion: 21, migrationReceiptCount: 21, observedNonReceiptTableCount: TABLES.length, observedNonReceiptTables: [...TABLES], historicalReferenceNonReceiptTableCount: 120,
      applicationReadinessSchemaVersion: 21, applicationStateSha256: SOURCE_RAW_APPLICATION_STATE_SHA256, automaticDeploymentsPaused: true, writeQuiescenceRequiredBeforeExecution: true,
    },
    publication: {
      reviewedHeadCommitSha: "4".repeat(40), headObservedAt: "2026-09-24T22:11:00.000Z", checksObservedAt: "2026-09-24T22:11:00.000Z",
      requiredChecks: M80_REQUIRED_CHECKS.map(name => ({ name, status: "completed", conclusion: "success" })), publicationReviewVerdict: "pass", publicationReview: fakePin("evaluations/research-qa/m80-publication-review.json", "4"),
      integrationAcceptanceVerdict: "pass", integrationAcceptance: fakePin("evaluations/research-qa/m80-integration-acceptance.json", "5"),
    },
    acceptedRuntime: {
      candidate: { path: "operations/agent-improvement/snapshots/M80-FOUNDATION-RUNTIME-20260924-CANDIDATE2.json", sha256: M80_ACCEPTED_CANDIDATE_SHA256 },
      migration: { path: "packages/neuvetra-database/src/migrations/0022_scope1_beta_foundation.sql", sha256: M80_MIGRATION_0022_SHA256 },
      rootClosure: { path: "evaluations/research-qa/m80-foundation-runtime-root-closure-20260924.json", sha256: M80_RUNTIME_ROOT_CLOSURE_SHA256 },
    },
    backup: {
      completedAt: "2026-09-24T22:03:00.000Z", sourceSchemaVersion: 21, sourceApplicationStateSha256: SOURCE_RAW_APPLICATION_STATE_SHA256, applicationOnly: true, syntheticDataOnly: true, providerRecoveryExcluded: true,
      backupReceipt: fakePin(".superpowers/m80-foundation-hosted-backup-receipt.json", "6"), encryptedArchiveSha256: sha("7"), snapshotSha256: sha("8"), customDumpSha256: sha("9"),
    },
    rehearsal: {
      completedAt: "2026-09-24T22:05:00.000Z", disposableDatabaseName: "m80_ops_foundation_1790287200", hostedEvidence: false, sourceSchemaVersion: 21, targetSchemaVersion: 22,
      sourceBackupReceiptSha256: sha("6"), migrationSha256: M80_MIGRATION_0022_SHA256, sourceObservedNonReceiptTableCount: TABLES.length, sourceObservedNonReceiptTablesSha256: m80HostedSha256(m80HostedCanonicalJson(TABLES)), historicalReferenceNonReceiptTableCount: 120,
      oldMigrationReceiptCount: 21, sourceContentSha256: CONTENT_SHA256, restoredContentSha256: CONTENT_SHA256,
      sourceRawApplicationStateSha256: SOURCE_RAW_APPLICATION_STATE_SHA256, restoredRawApplicationStateSha256: RESTORED_RAW_APPLICATION_STATE_SHA256,
      sourceRawMetadataSha256: SOURCE_RAW_METADATA_SHA256, restoredRawMetadataSha256: RESTORED_RAW_METADATA_SHA256,
      sourceExternalDefaultAclRowsExcluded: 2, restoredExternalDefaultAclRows: 0, scopedDefaultAclRowsExact: true,
      sourceInternalTriggerRows: 9, restoredInternalTriggerRows: 9, internalTriggerSemanticMultisetExact: true, allOtherInventoryMetadataExact: true,
      sourceNormalizedMetadataSha256: NORMALIZED_METADATA_SHA256, restoredNormalizedMetadataSha256: NORMALIZED_METADATA_SHA256, normalizedMetadataExact: true,
      oldContentExact: true, applicationMetadataEquivalent: true, rawMetadataHashesEqual: false,
      expectedNewTables: [...M80_NEW_TABLES], expectedNewTableRowCounts: { ...M80_EXPECTED_NEW_TABLE_ROW_COUNTS }, releaseRecordsExactFourHeld: true, forcedRlsVerified: true, runtimeSelectOnlyVerified: true, runtimeDirectWritesDenied: true,
      operatorAdmissionNotExecuted: true, allConnectionsClosed: true, restoreReceipt: fakePin("evaluations/research-qa/m80-hosted-restore.json", "a"), normalizationProof: fakePin("evaluations/research-qa/m80-hosted-normalization.json", "e"), preservationReceipt: fakePin("evaluations/research-qa/m80-hosted-preservation.json", "b"), migrationReceipt: fakePin("evaluations/research-qa/m80-hosted-rehearsal.json", "c"),
    },
    admission: {
      verifiedAt: "2026-09-24T22:11:00.000Z", observationReceipt: fakePin(".superpowers/m80-foundation-hosted-admission-observation.json", "f"), companyId: "80000000-0000-4000-8000-000000000101", managerUserId: "80000000-0000-4000-8000-000000000102", managerRole: "owner",
      existingSyntheticCompanyVerified: true, existingManagerMembershipVerified: true, noCompanyCreation: true, noUserCreation: true, noRoleOrPermissionCreation: true,
    },
  }
  value.backup.backupReceipt.sha256 = artifactSha256(m80ExpectedHostedEvidence(value, "backup"))
  value.rehearsal.sourceBackupReceiptSha256 = value.backup.backupReceipt.sha256
  const evidencePins: Array<[EvidencePin, Parameters<typeof m80ExpectedHostedEvidence>[1]]> = [
    [value.observedTarget.observationReceipt, "target"], [value.publication.publicationReview, "publication"], [value.publication.integrationAcceptance, "integration"],
    [value.rehearsal.restoreReceipt, "restore"], [value.rehearsal.normalizationProof, "normalization"], [value.rehearsal.preservationReceipt, "preservation"], [value.rehearsal.migrationReceipt, "rehearsal"], [value.admission.observationReceipt, "admission"],
  ]
  for (const [item, kind] of evidencePins) item.sha256 = artifactSha256(m80ExpectedHostedEvidence(value, kind))
  return value
}

async function planFixture(): Promise<M80HostedPreparationPlan> {
  const value = preparationInput(), evidence = new Map([
    [value.observedTarget.observationReceipt.path, m80ExpectedHostedEvidence(value, "target")], [value.publication.publicationReview.path, m80ExpectedHostedEvidence(value, "publication")],
    [value.publication.integrationAcceptance.path, m80ExpectedHostedEvidence(value, "integration")], [value.backup.backupReceipt.path, m80ExpectedHostedEvidence(value, "backup")],
    [value.rehearsal.restoreReceipt.path, m80ExpectedHostedEvidence(value, "restore")], [value.rehearsal.normalizationProof.path, m80ExpectedHostedEvidence(value, "normalization")], [value.rehearsal.preservationReceipt.path, m80ExpectedHostedEvidence(value, "preservation")],
    [value.rehearsal.migrationReceipt.path, m80ExpectedHostedEvidence(value, "rehearsal")], [value.admission.observationReceipt.path, m80ExpectedHostedEvidence(value, "admission")],
  ])
  return buildM80HostedPreparationPlan(value, { now: NOW, verifyPin: async () => {}, loadJsonEvidence: async item => evidence.get(item.path) })
}

type GateBundle = { gate: Record<string, unknown>; gatePin: EvidencePin; gateEvidence: { securityReview: { value: unknown; pin: EvidencePin }; integrationAcceptance: { value: unknown; pin: EvidencePin }; targetObservation: { value: unknown; pin: EvidencePin } } }

function gateFixture(plan: M80HostedPreparationPlan, planPin: EvidencePin, stage: M80HostedStage): GateBundle {
  const integration = m80ExpectedHostedEvidence({ profile: M80_HOSTED_INPUT_PROFILE, operatorId: "/root", observedTarget: plan.target, publication: plan.publication, acceptedRuntime: { candidate: plan.pins.candidate, migration: plan.pins.migration, rootClosure: plan.pins.rootClosure }, backup: plan.backup, rehearsal: plan.rehearsal, admission: plan.admission } as HostedPreparationInput, "integration")
  const target = { profile: "neuvetra.m80.foundation-hosted-stage-target-observation.v1", observedAt: NOW.toISOString(), stage, projectRef: plan.target.projectRef, environmentId: plan.target.environmentId, serviceId: plan.target.serviceId, schemaVersion: stage === "migration" ? 21 : 22, migrationReceiptCount: stage === "migration" ? 21 : 22, applicationStateSha256: stage === "migration" ? plan.target.applicationStateSha256 : sha("d"), writeQuiescenceMechanism: "provider_deployment_stopped_and_origin_readiness_unavailable", activeDeploymentCount: 0, originReadinessUnavailable: true, noActiveApplicationWritesObserved: true }
  const security = { profile: "neuvetra.m80.foundation-hosted-security-review.v1", observedAt: NOW.toISOString(), verdict: "pass", reviewerId: "/root/m80_foundation_hosted_qa", implementationAuthor: M80_HOSTED_IMPLEMENTATION_AUTHOR, independent: true, plan: planPin, planSha256: plan.planSha256, operationScopeSha256: plan.operationScopeSha256, stage, targetProjectRef: plan.target.projectRef, reviewedHeadCommitSha: plan.publication.reviewedHeadCommitSha, candidateSha256: M80_ACCEPTED_CANDIDATE_SHA256, migrationSha256: M80_MIGRATION_0022_SHA256, materialFindingsOpen: 0 }
  const integrationPin = artifactPin(plan.pins.integrationAcceptance.path, integration), securityPin = artifactPin(`evaluations/research-qa/m80-hosted-${stage}-security.json`, security), targetPin = artifactPin(`.superpowers/m80-hosted-${stage}-target.json`, target)
  const gate = { profile: M80_HOSTED_GATE_PROFILE, stage, reviewedAt: NOW.toISOString(), expiresAt: "2026-09-24T22:22:00.000Z", verdict: "pass", operatorId: "/root", independentReviewerId: "/root/m80_foundation_hosted_qa", plan: planPin, planSha256: plan.planSha256, candidateSha256: M80_ACCEPTED_CANDIDATE_SHA256, migrationSha256: M80_MIGRATION_0022_SHA256, reviewedHeadCommitSha: plan.publication.reviewedHeadCommitSha, exactRequiredChecksPassed: true, targetObservation: targetPin, targetReobservedAt: NOW.toISOString(), targetProjectRef: plan.target.projectRef, targetEnvironmentId: plan.target.environmentId, targetServiceId: plan.target.serviceId, currentSchemaVersion: stage === "migration" ? 21 : 22, currentMigrationReceiptCount: stage === "migration" ? 21 : 22, currentApplicationStateSha256: stage === "migration" ? plan.target.applicationStateSha256 : sha("d"), writeQuiescenceMechanism: "provider_deployment_stopped_and_origin_readiness_unavailable", activeDeploymentCount: 0, originReadinessUnavailable: true, noActiveApplicationWritesObserved: true, securityReview: securityPin, integrationAcceptance: integrationPin, rootSoleExecutorAccepted: true, noAutomaticRetryAccepted: true }
  return { gate, gatePin: artifactPin(`.superpowers/m80-hosted-${stage}-gate.json`, gate), gateEvidence: { securityReview: { value: security, pin: securityPin }, integrationAcceptance: { value: integration, pin: integrationPin }, targetObservation: { value: target, pin: targetPin } } }
}

type Sealed = GateBundle & { intent: M80HostedIntent; intentPin: EvidencePin }
function seal(plan: M80HostedPreparationPlan, planPin: EvidencePin, stage: M80HostedStage, predecessors: { migration?: M80HostedPredecessorArtifacts; admission?: M80HostedPredecessorArtifacts } = {}): Sealed {
  const gate = gateFixture(plan, planPin, stage), intent = sealM80HostedIntent({ plan, planPin, stage, now: NOW, ...gate, ...predecessors })
  return { ...gate, intent, intentPin: artifactPin(m80HostedIntentPath(intent, stage), intent) }
}

function successObservation(intent: M80HostedIntent): unknown {
  const authoritativeState = intent.stage === "migration"
    ? { projectRef: intent.targetProjectRef, environmentId: intent.targetEnvironmentId, serviceId: intent.targetServiceId, schemaVersion: 22, migrationReceiptCount: 22, migrationName: "0022_scope1_beta_foundation.sql", migrationSha256: M80_MIGRATION_0022_SHA256, oldContentExact: true, oldMetadataExact: true }
    : intent.stage === "admission"
      ? { projectRef: intent.targetProjectRef, environmentId: intent.targetEnvironmentId, serviceId: intent.targetServiceId, rowCount: 1, companyId: intent.actionIdentity.companyId, managerUserId: intent.actionIdentity.managerUserId, fixtureProfileId: "m80-synthetic-scope1-foundation-v1", fixtureVersion: 1, fixtureSha256: intent.actionIdentity.fixtureSha256 }
      : { projectRef: intent.targetProjectRef, environmentId: intent.targetEnvironmentId, serviceId: intent.targetServiceId, deploymentStatus: "SUCCESS", deploymentId: "80000000-0000-4000-8000-000000000009", commitSha: intent.actionIdentity.commitSha, schemaVersion: 22, readinessOk: true }
  return { profile: M80_HOSTED_OBSERVATION_PROFILE, observedAt: NOW.toISOString(), stage: intent.stage, transportOutcome: "definitive_success", authoritativeState }
}

function predecessor(chain: Sealed): M80HostedPredecessorArtifacts {
  const observation = successObservation(chain.intent), observationPin = artifactPin(`.superpowers/${chain.intent.stage}-observation.json`, observation)
  const outcome = recordM80HostedOutcome({ intent: chain.intent, intentPin: chain.intentPin, observation, observationPin, now: NOW })
  return { intent: chain.intent, intentPin: chain.intentPin, gate: chain.gate, gatePin: chain.gatePin, gateEvidence: chain.gateEvidence, observation, observationPin, outcome, outcomePin: artifactPin(`.superpowers/${chain.intent.stage}-outcome.json`, outcome) }
}

async function artifacts(stage: M80HostedStage): Promise<M80ExecutorArtifacts> {
  const plan = await planFixture(), planPin = artifactPin(".superpowers/m80-hosted-plan.json", plan), migration = predecessor(seal(plan, planPin, "migration"))
  const admission = predecessor(seal(plan, planPin, "admission", { migration }))
  const predecessors = stage === "migration" ? {} : stage === "admission" ? { migration } : { migration, admission }
  const sealed = seal(plan, planPin, stage, predecessors)
  const review = await reviewFixture(), result: M80ExecutorArtifacts = { plan, planPin, gate: sealed.gate, gatePin: sealed.gatePin, gateEvidence: sealed.gateEvidence, intent: sealed.intent, intentPin: sealed.intentPin, stage, executorReview: review.pin, planEvidence: planEvidenceFixture(plan), ...predecessors }
  reviewReaders.set(result, review.readSourceBytes)
  return result
}

const reviewReaders = new WeakMap<object, (path: string) => Promise<Uint8Array>>()
async function reviewFixture(): Promise<{ pin: EvidencePin; readSourceBytes: (path: string) => Promise<Uint8Array> }> {
  const sources = new Map<string, Uint8Array>(), entry = await readFile(M80_EXECUTOR_ENTRYPOINT_PATH), sourcePin = { path: M80_EXECUTOR_ENTRYPOINT_PATH, sha256: m80HostedSha256(entry) }
  sources.set(M80_EXECUTOR_ENTRYPOINT_PATH, entry)
  const snapshot = { artifacts: [{ ...sourcePin, text: new TextDecoder().decode(entry) }] }, snapshotBytes = new TextEncoder().encode(`${JSON.stringify(snapshot, null, 2)}\n`), snapshotPath = "operations/agent-improvement/snapshots/m80-executor-fixture.json"
  sources.set(snapshotPath, snapshotBytes)
  const review: M80ExecutorSourceReview = { verdict: "pass_m80_executor_transport_only", reviewer: "/root/m80_foundation_runtime_qa", source_snapshot: { path: snapshotPath, sha256: m80HostedSha256(snapshotBytes) }, source_pins: [sourcePin] }
  const bytes = new TextEncoder().encode(`${JSON.stringify(review, null, 2)}\n`), path = "evaluations/research-qa/m80-executor-review.json"
  sources.set(path, bytes)
  return { pin: { path, sha256: m80HostedSha256(bytes) }, readSourceBytes: async source => { const value = sources.get(source); if (!value) throw new Error(`missing ${source}`); return value } }
}

function planEvidenceFixture(plan: M80HostedPreparationPlan): M80ExecutorArtifacts["planEvidence"] {
  const { fixtureProfileId: _profile, fixtureVersion: _version, fixtureSha256: _fixture, ...admission } = plan.admission
  const input = { profile: M80_HOSTED_INPUT_PROFILE, operatorId: "/root", observedTarget: plan.target, publication: plan.publication, acceptedRuntime: { candidate: plan.pins.candidate, migration: plan.pins.migration, rootClosure: plan.pins.rootClosure }, backup: plan.backup, rehearsal: plan.rehearsal, admission } as HostedPreparationInput
  const item = (pin: EvidencePin, kind: Parameters<typeof m80ExpectedHostedEvidence>[1]) => ({ value: m80ExpectedHostedEvidence(input, kind), pin })
  return { targetObservation: item(plan.pins.targetObservation, "target"), publicationReview: item(plan.pins.publicationReview, "publication"), integrationAcceptance: item(plan.pins.integrationAcceptance, "integration"), backupReceipt: item(plan.pins.backupReceipt, "backup"), restoreReceipt: item(plan.pins.restoreReceipt, "restore"), normalizationProof: item(plan.pins.normalizationProof, "normalization"), preservationReceipt: item(plan.pins.preservationReceipt, "preservation"), migrationRehearsalReceipt: item(plan.pins.migrationRehearsalReceipt, "rehearsal"), admissionObservation: item(plan.pins.admissionObservation, "admission") }
}

class MemoryJournal implements M80ExecutorJournal {
  values = new Map<string, unknown>()
  async writeOnce(path: string, value: unknown): Promise<void> { if (this.values.has(path)) throw new Error("already exists"); this.values.set(path, structuredClone(value)) }
}

class InterruptedJournal extends MemoryJournal {
  private interruptObservation = true
  override async writeOnce(path: string, value: unknown): Promise<void> {
    if (this.interruptObservation && path.endsWith("-observation.json")) { this.interruptObservation = false; throw new Error("injected crash after transport") }
    return super.writeOnce(path, value)
  }
}

class OutcomeInterruptedJournal extends MemoryJournal {
  private interruptOutcome = true
  override async writeOnce(path: string, value: unknown): Promise<void> {
    if (this.interruptOutcome && path.endsWith("-outcome.json")) { this.interruptOutcome = false; throw new Error("injected crash after observation") }
    return super.writeOnce(path, value)
  }
}

const fakeDatabase = (): WorkspaceConnection => ({ query: async () => ({ rows: [] }), exec: async () => {}, transaction: async operation => operation({ query: async () => ({ rows: [] }), exec: async () => {} }), close: async () => {} })
const sourceState = (input: M80ExecutorArtifacts) => ({ applicationStateSha256: (input.plan as M80HostedPreparationPlan).target.applicationStateSha256, synthetic: "captured full state fixture" })


export { artifacts,reviewReaders,NOW,sourceState,artifactPin,MemoryJournal,fakeDatabase,planFixture,planEvidenceFixture,gateFixture,seal,predecessor,successObservation };


import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  M80_ACCEPTED_CANDIDATE_SHA256,
  M80_HOSTED_INPUT_PROFILE,
  M80_MIGRATION_0022_SHA256,
  M80_NEW_TABLES,
  M80_REQUIRED_CHECKS,
  M80_RUNTIME_ROOT_CLOSURE_SHA256,
  buildM80HostedPreparationPlan,
  m80ExpectedHostedEvidence,
  m80HostedCanonicalJson,
  m80HostedSha256,
  safeM80HostedPreparationOutputPath,
  type EvidencePin,
  type HostedPreparationInput,
  type M80HostedPreparationPlan,
} from "./m80-hosted-prep-independent-20260924-candidate2-frozen-prepare"
import {
  M80_HOSTED_GATE_PROFILE,
  M80_HOSTED_OBSERVATION_PROFILE,
  m80HostedIntentPath,
  recordM80HostedOutcome,
  sealM80HostedIntent,
  validateM80HostedPlan,
  writeM80HostedEvidenceOnce,
  type M80HostedIntent,
  type M80HostedOutcome,
  type M80HostedStage,
} from "./m80-hosted-prep-independent-20260924-candidate2-frozen-once"

const NOW = new Date("2026-09-24T22:12:00.000Z")
const sha = (character: string) => character.repeat(64)
const fakePin = (path: string, character: string): EvidencePin => ({ path, sha256: sha(character) })
const artifactSha256 = (value: unknown) => m80HostedSha256(`${JSON.stringify(value, null, 2)}\n`)
const artifactPin = (path: string, value: unknown): EvidencePin => ({ path, sha256: artifactSha256(value) })
const OBSERVED_TABLES = ["auth.users", "neuvetra.companies", "neuvetra.company_members"]
const OBSERVED_TABLES_SHA256 = m80HostedSha256(m80HostedCanonicalJson(OBSERVED_TABLES))
const temporary: string[] = []

function input(): HostedPreparationInput {
  const value: HostedPreparationInput = {
    profile: M80_HOSTED_INPUT_PROFILE,
    operatorId: "/root",
    observedTarget: {
      observedAt: "2026-09-24T22:10:00.000Z",
      observationReceipt: fakePin(".superpowers/m80-foundation-hosted-target-observation.json", "0"),
      projectRef: "abcdefghijklmnopqrst",
      environmentId: "80000000-0000-4000-8000-000000000001",
      serviceId: "80000000-0000-4000-8000-000000000002",
      deploymentId: "80000000-0000-4000-8000-000000000003",
      deploymentStatus: "SUCCESS",
      deployedCommitSha: "1".repeat(40),
      deployedImageSha256: sha("2"),
      targetClassification: "private_synthetic_staging",
      syntheticDataOnlyVerified: true,
      schemaVersion: 21,
      migrationReceiptCount: 21,
      observedNonReceiptTableCount: 3,
      observedNonReceiptTables: [...OBSERVED_TABLES],
      historicalReferenceNonReceiptTableCount: 120,
      applicationReadinessSchemaVersion: 21,
      applicationStateSha256: sha("3"),
      automaticDeploymentsPaused: true,
      maintenanceEnabled: true,
      noActiveApplicationWritesObserved: true,
    },
    publication: {
      reviewedHeadCommitSha: "4".repeat(40),
      headObservedAt: "2026-09-24T22:11:00.000Z",
      checksObservedAt: "2026-09-24T22:11:00.000Z",
      requiredChecks: M80_REQUIRED_CHECKS.map(name => ({ name, status: "completed", conclusion: "success" })),
      publicationReviewVerdict: "pass",
      publicationReview: fakePin("evaluations/research-qa/m80-publication-review.json", "4"),
      integrationAcceptanceVerdict: "pass",
      integrationAcceptance: fakePin("evaluations/research-qa/m80-integration-acceptance.json", "5"),
    },
    acceptedRuntime: {
      candidate: { path: "operations/agent-improvement/snapshots/M80-FOUNDATION-RUNTIME-20260924-CANDIDATE2.json", sha256: M80_ACCEPTED_CANDIDATE_SHA256 },
      migration: { path: "packages/neuvetra-database/src/migrations/0022_scope1_beta_foundation.sql", sha256: M80_MIGRATION_0022_SHA256 },
      rootClosure: { path: "evaluations/research-qa/m80-foundation-runtime-root-closure-20260924.json", sha256: M80_RUNTIME_ROOT_CLOSURE_SHA256 },
    },
    backup: {
      completedAt: "2026-09-24T22:00:00.000Z",
      sourceSchemaVersion: 21,
      sourceApplicationStateSha256: sha("3"),
      applicationOnly: true,
      syntheticDataOnly: true,
      providerRecoveryExcluded: true,
      backupReceipt: fakePin(".superpowers/m80-foundation-hosted-backup-receipt.json", "6"),
      encryptedArchiveSha256: sha("7"), snapshotSha256: sha("8"), customDumpSha256: sha("9"),
    },
    rehearsal: {
      completedAt: "2026-09-24T22:05:00.000Z",
      disposableDatabaseName: "m80_ops_foundation_1790287200",
      hostedEvidence: false,
      sourceSchemaVersion: 21,
      targetSchemaVersion: 22,
      sourceBackupReceiptSha256: sha("6"),
      migrationSha256: M80_MIGRATION_0022_SHA256,
      sourceObservedNonReceiptTableCount: 3,
      sourceObservedNonReceiptTablesSha256: OBSERVED_TABLES_SHA256,
      historicalReferenceNonReceiptTableCount: 120,
      oldMigrationReceiptCount: 21,
      sourceContentSha256: sha("a"), restoredContentSha256: sha("a"),
      sourceMetadataSha256: sha("b"), restoredMetadataSha256: sha("b"),
      oldContentExact: true, oldMetadataExact: true,
      expectedNewTables: [...M80_NEW_TABLES],
      forcedRlsVerified: true, runtimeSelectOnlyVerified: true, runtimeDirectWritesDenied: true,
      operatorAdmissionNotExecuted: true, allConnectionsClosed: true,
      restoreReceipt: fakePin("evaluations/research-qa/m80-hosted-restore.json", "a"),
      preservationReceipt: fakePin("evaluations/research-qa/m80-hosted-preservation.json", "b"),
      migrationReceipt: fakePin("evaluations/research-qa/m80-hosted-rehearsal.json", "c"),
    },
    admission: {
      verifiedAt: "2026-09-24T22:11:00.000Z",
      observationReceipt: fakePin(".superpowers/m80-foundation-hosted-admission-observation.json", "f"),
      companyId: "80000000-0000-4000-8000-000000000101",
      managerUserId: "80000000-0000-4000-8000-000000000102",
      managerRole: "owner",
      existingSyntheticCompanyVerified: true, existingManagerMembershipVerified: true,
      noCompanyCreation: true, noUserCreation: true, noRoleOrPermissionCreation: true,
    },
  }
  const integration = m80ExpectedHostedEvidence(value, "integration")
  value.publication.integrationAcceptance.sha256 = artifactSha256(integration)
  return value
}

function semanticEvidence(value: HostedPreparationInput): Map<string, unknown> {
  return new Map([
    [value.observedTarget.observationReceipt.path, m80ExpectedHostedEvidence(value, "target")],
    [value.publication.publicationReview.path, m80ExpectedHostedEvidence(value, "publication")],
    [value.publication.integrationAcceptance.path, m80ExpectedHostedEvidence(value, "integration")],
    [value.backup.backupReceipt.path, m80ExpectedHostedEvidence(value, "backup")],
    [value.rehearsal.restoreReceipt.path, m80ExpectedHostedEvidence(value, "restore")],
    [value.rehearsal.preservationReceipt.path, m80ExpectedHostedEvidence(value, "preservation")],
    [value.rehearsal.migrationReceipt.path, m80ExpectedHostedEvidence(value, "rehearsal")],
    [value.admission.observationReceipt.path, m80ExpectedHostedEvidence(value, "admission")],
  ])
}

function build(value: unknown, now = NOW, checked?: string[]) {
  const candidate = value as HostedPreparationInput
  const semantic = semanticEvidence(candidate)
  return buildM80HostedPreparationPlan(value, {
    now,
    verifyPin: async item => { checked?.push(item.path) },
    loadJsonEvidence: async item => {
      const evidence = semantic.get(item.path)
      if (!evidence) throw new Error(`missing evidence fixture ${item.path}`)
      return evidence
    },
  })
}

type GateBundle = { gate: Record<string, unknown>; gatePin: EvidencePin; gateEvidence: { securityReview: { value: unknown; pin: EvidencePin }; integrationAcceptance: { value: unknown; pin: EvidencePin }; targetObservation: { value: unknown; pin: EvidencePin } } }

function gateBundle(plan: M80HostedPreparationPlan, planPin: EvidencePin, stage: M80HostedStage): GateBundle {
  const reviewedAt = NOW.toISOString()
  const integration = m80ExpectedHostedEvidence({ profile: M80_HOSTED_INPUT_PROFILE, operatorId: "/root", observedTarget: plan.target, publication: plan.publication, acceptedRuntime: { candidate: plan.pins.candidate, migration: plan.pins.migration, rootClosure: plan.pins.rootClosure }, backup: plan.backup, rehearsal: plan.rehearsal, admission: plan.admission } as HostedPreparationInput, "integration")
  const target = { profile: "neuvetra.m80.foundation-hosted-stage-target-observation.v1", observedAt: reviewedAt, stage, projectRef: plan.target.projectRef, environmentId: plan.target.environmentId, serviceId: plan.target.serviceId, schemaVersion: stage === "migration" ? 21 : 22, migrationReceiptCount: stage === "migration" ? 21 : 22, applicationStateSha256: stage === "migration" ? plan.target.applicationStateSha256 : sha("d"), maintenanceEnabled: true, noActiveApplicationWritesObserved: true }
  const integrationPin = artifactPin(plan.pins.integrationAcceptance.path, integration)
  const targetPin = artifactPin(`.superpowers/m80-foundation-hosted-${stage}-target.json`, target)
  const securityPath = `evaluations/research-qa/m80-hosted-preparation-${stage}-security.json`
  const security = { profile: "neuvetra.m80.foundation-hosted-security-review.v1", observedAt: reviewedAt, verdict: "pass", reviewerId: "/root/m80_foundation_hosted_qa", implementationAuthor: "/root/m80_foundation_runtime", independent: true, plan: planPin, planSha256: plan.planSha256, operationScopeSha256: plan.operationScopeSha256, stage, targetProjectRef: plan.target.projectRef, reviewedHeadCommitSha: plan.publication.reviewedHeadCommitSha, candidateSha256: M80_ACCEPTED_CANDIDATE_SHA256, migrationSha256: M80_MIGRATION_0022_SHA256, materialFindingsOpen: 0 }
  const securityPin = artifactPin(securityPath, security)
  const gate = {
    profile: M80_HOSTED_GATE_PROFILE, stage, reviewedAt, expiresAt: "2026-09-24T22:22:00.000Z", verdict: "pass", operatorId: "/root", independentReviewerId: "/root/m80_foundation_hosted_qa",
    plan: planPin, planSha256: plan.planSha256, candidateSha256: M80_ACCEPTED_CANDIDATE_SHA256, migrationSha256: M80_MIGRATION_0022_SHA256,
    reviewedHeadCommitSha: plan.publication.reviewedHeadCommitSha, exactRequiredChecksPassed: true,
    targetObservation: targetPin, targetReobservedAt: reviewedAt, targetProjectRef: plan.target.projectRef, targetEnvironmentId: plan.target.environmentId, targetServiceId: plan.target.serviceId,
    currentSchemaVersion: stage === "migration" ? 21 : 22, currentMigrationReceiptCount: stage === "migration" ? 21 : 22,
    currentApplicationStateSha256: stage === "migration" ? plan.target.applicationStateSha256 : sha("d"), maintenanceEnabled: true, noActiveApplicationWritesObserved: true,
    securityReview: securityPin, integrationAcceptance: integrationPin, rootSoleExecutorAccepted: true, noAutomaticRetryAccepted: true,
  }
  return { gate, gatePin: artifactPin(`.superpowers/m80-foundation-hosted-${stage}-gate.json`, gate), gateEvidence: { securityReview: { value: security, pin: securityPin }, integrationAcceptance: { value: integration, pin: integrationPin }, targetObservation: { value: target, pin: targetPin } } }
}

function seal(plan: M80HostedPreparationPlan, planPin: EvidencePin, stage: M80HostedStage, predecessors: Partial<Parameters<typeof sealM80HostedIntent>[0]> = {}) {
  const bundle = gateBundle(plan, planPin, stage)
  return sealM80HostedIntent({ plan, planPin, stage, now: NOW, ...bundle, ...predecessors })
}

function observation(intent: M80HostedIntent, transportOutcome: "definitive_success" | "definitive_failure" | "unknown" = "definitive_success", observedAt = NOW.toISOString()) {
  const authoritativeState = transportOutcome !== "definitive_success" ? {} : intent.stage === "migration"
    ? { projectRef: intent.targetProjectRef, environmentId: intent.targetEnvironmentId, serviceId: intent.targetServiceId, schemaVersion: 22, migrationReceiptCount: 22, migrationName: "0022_scope1_beta_foundation.sql", migrationSha256: M80_MIGRATION_0022_SHA256, oldContentExact: true, oldMetadataExact: true }
    : intent.stage === "admission"
      ? { projectRef: intent.targetProjectRef, environmentId: intent.targetEnvironmentId, serviceId: intent.targetServiceId, rowCount: 1, companyId: intent.actionIdentity.companyId, managerUserId: intent.actionIdentity.managerUserId, fixtureProfileId: "m80-synthetic-scope1-foundation-v1", fixtureVersion: 1, fixtureSha256: intent.actionIdentity.fixtureSha256 }
      : { projectRef: intent.targetProjectRef, environmentId: intent.actionIdentity.environmentId, serviceId: intent.actionIdentity.serviceId, deploymentStatus: "SUCCESS", deploymentId: "80000000-0000-4000-8000-000000000009", commitSha: intent.actionIdentity.commitSha, schemaVersion: 22, readinessOk: true }
  return { profile: M80_HOSTED_OBSERVATION_PROFILE, observedAt, stage: intent.stage, transportOutcome, authoritativeState }
}

function record(intent: M80HostedIntent, value = observation(intent)): { intent: M80HostedIntent; intentPin: EvidencePin; observation: unknown; observationPin: EvidencePin; outcome: M80HostedOutcome; outcomePin: EvidencePin } {
  const intentPin = artifactPin(m80HostedIntentPath(intent, intent.stage), intent)
  const observationPin = artifactPin(`.superpowers/m80-foundation-hosted-${intent.operationScopeSha256}-${intent.stage}-observation.json`, value)
  const outcome = recordM80HostedOutcome({ intent, intentPin, observation: value, observationPin, now: NOW })
  return { intent, intentPin, observation: value, observationPin, outcome, outcomePin: artifactPin(`.superpowers/m80-foundation-hosted-${intent.operationScopeSha256}-${intent.stage}-outcome.json`, outcome) }
}

const chainArgs = (name: "migration" | "admission", chain: ReturnType<typeof record>) => ({ [`${name}Intent`]: chain.intent, [`${name}IntentPin`]: chain.intentPin, [`${name}Observation`]: chain.observation, [`${name}ObservationPin`]: chain.observationPin, [`${name}Outcome`]: chain.outcome, [`${name}OutcomePin`]: chain.outcomePin })

function resignPlan(plan: M80HostedPreparationPlan): M80HostedPreparationPlan {
  const unsigned = structuredClone(plan) as M80HostedPreparationPlan & { planSha256?: string }
  delete unsigned.planSha256
  return { ...unsigned, planSha256: m80HostedSha256(m80HostedCanonicalJson(unsigned)) } as M80HostedPreparationPlan
}


export {input,build,gateBundle,seal,observation,record,chainArgs,resignPlan,artifactPin,NOW,semanticEvidence}

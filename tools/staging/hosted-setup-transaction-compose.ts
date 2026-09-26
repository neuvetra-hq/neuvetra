/** Local-only composition of the frozen transactional runner and dedicated pg.Client. */
import { createHostedSetupDedicatedClient } from "./hosted-setup-dedicated-client"
import { withSequenceFence } from "./hosted-setup-sequence-fence"
import {
  HOSTED_SETUP_MAINTENANCE_TARGET,
  HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE,
  HOSTED_SETUP_REVIEWED_MAINTENANCE_PROFILE,
  reconcileHostedSetupTransactionalCommit,
  runHostedSetupTransactionalUpgrade,
  type HostedSetupTransactionalDependencies,
} from "./hosted-setup-transactional-upgrade"
import { ARTIFACT_PROFILE, ARTIFACT_SOURCE_PROFILE } from "./hosted-setup-artifact-source"
import {
  HOSTED_SETUP_PROFILE,
  HOSTED_SETUP_PROJECT,
  fingerprintSha256,
  hash,
  sha256,
  snapshotHostedSetupDatabaseInTransaction,
  type HostedSetupUpgradeInput,
} from "./hosted-setup-upgrade"
import { migratePrivateStagingFromManifest, readMigrationManifest } from "../../packages/neuvetra-database/src/staging-migrations"
import type { WorkspaceConnection, WorkspaceSql } from "../../packages/neuvetra-database/src/workspace"

export type ComposeMode = "snapshot" | "commit" | "rollback" | "timeout" | "reconcile"
export interface HostedSetupComposeInput {
  profile: "neuvetra.hosted-setup.transaction-compose.local-only.v1"
  mode: ComposeMode
  connectionString: string
  applicationName: string
  journalPath?: string
  expectedFingerprintSha256?: string
  expectedMigrationSha256?: string
  originalTransactionResolved?: boolean
  psqlPath?: string
}

const HEAD = "a".repeat(40)
const SYNTHETIC_EXECUTION_ARTIFACT = "4".repeat(64)
const artifact = (label: string) => {
  const bytes = JSON.stringify({ localOnlySyntheticMock: label }) + "\n"
  return Object.freeze({ bytes, sha256: sha256(bytes) })
}

function upgradeInput(journalPath: string): HostedSetupUpgradeInput {
  return {
    profile: "neuvetra.hosted-setup.upgrade-input.v1",
    projectRef: HOSTED_SETUP_PROJECT,
    targetProfile: HOSTED_SETUP_PROFILE,
    reviewedProductHead: HEAD,
    operatorId: "local-compose-operator",
    restoreReviewerId: "local-compose-restore-reviewer",
    publicationReviewerId: "local-compose-publication-reviewer",
    stopReviewerId: "local-compose-stop-reviewer",
    journalPath,
    restoreReceipt: artifact("restore-receipt"),
    restoreReview: artifact("restore-review"),
    fingerprintDerivation: artifact("fingerprint-derivation"),
    fingerprintDerivationReview: artifact("fingerprint-derivation-review"),
    publicationReceipt: artifact("publication-receipt"),
    publicationReview: artifact("publication-review"),
    stopReceipt: artifact("maintenance-stop-receipt"),
    stopReview: artifact("maintenance-stop-review"),
  }
}

function observeBackend(psqlPath: string | undefined, connectionString: string, applicationName: string) {
  if (!psqlPath) return null
  const sql = `select coalesce(string_agg(pid::text,',' order by pid),'')||'|'||count(*)::text||'|'||coalesce(sum((select count(*) from pg_locks l where l.pid=a.pid)),0)::text from pg_stat_activity a where application_name='${applicationName}'`
  const child = Bun.spawnSync([psqlPath, connectionString, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdin: "ignore", stdout: "pipe", stderr: "pipe" })
  if (child.exitCode !== 0) throw new Error("LOCAL_COMPOSE_BACKEND_OBSERVER_FAILED")
  const [pids, sessions, locks] = new TextDecoder().decode(child.stdout).trim().split('|')
  return Object.freeze({ pids, sessions, locks })
}

export async function runHostedSetupLocalComposition(input: HostedSetupComposeInput) {
  if (input?.profile !== "neuvetra.hosted-setup.transaction-compose.local-only.v1") throw new Error("LOCAL_COMPOSE_PROFILE_REFUSED")
  const manifest = await readMigrationManifest()
  const db = await createHostedSetupDedicatedClient({
    connectionString: input.connectionString,
    target: { kind: "synthetic-loopback" },
    transactionTimeoutMs: input.mode === "timeout" ? 3_000 : 180_000,
    localDeadlineGraceMs: input.mode === "timeout" ? 250 : 2_000,
    teardownTimeoutMs: 1_000,
    applicationName: input.applicationName,
  })
  try {
    if (input.mode === "snapshot") {
      // Local fixture preparation only. The real accepted-restore fingerprint is
      // an external reviewed artifact; this probe captures the same rows on the
      // otherwise idle disposable clone without pretending to attest a restore.
      const fingerprint = await db.transaction(tx => snapshotHostedSetupDatabaseInTransaction(tx))
      return Object.freeze({ mode: input.mode, schemaVersion: fingerprint.schemaVersion, fingerprintSha256: fingerprintSha256(fingerprint) })
    }
    if (input.mode === "reconcile") {
      try {
        const receipt = await reconcileHostedSetupTransactionalCommit(db, {
          profile: "neuvetra.hosted-setup.uncertain-commit-reconciliation.v1",
          projectRef: HOSTED_SETUP_PROJECT,
          expectedMigrationSha256: input.expectedMigrationSha256 ?? "",
          observeOriginalTransactionResolved: () => input.originalTransactionResolved === true,
        } as Parameters<typeof reconcileHostedSetupTransactionalCommit>[1])
        return Object.freeze({ mode: input.mode, outcome: "resolved", receipt })
      } catch (error) {
        return Object.freeze({ mode: input.mode, outcome: "refused", error: error instanceof Error ? error.message : "unknown" })
      }
    }

    if (!input.journalPath || !input.expectedFingerprintSha256) throw new Error("LOCAL_COMPOSE_RUN_INPUT_REFUSED")
    const sourceInput = upgradeInput(input.journalPath)
    let artifactLockState: "ready" | "active" | "consumed" = "ready"
    let migrationCalls = 0
    const phases: string[] = []
    const backendObservations: unknown[] = []
    let transactionCallbackFailure: null | { name: string; message: string; code: string | null; sqlState: string | null } = null
    const instrumentedDb: WorkspaceConnection = Object.freeze({
      query: db.query,
      exec: db.exec,
      close: db.close,
      transaction: async <T>(operation: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
        try { return await operation(tx) }
        catch (error) {
          const value = error as { name?: unknown; message?: unknown; code?: unknown; sqlState?: unknown }
          transactionCallbackFailure = {
            name: typeof value?.name === "string" ? value.name : "unknown",
            message: typeof value?.message === "string" ? value.message : "unknown",
            code: typeof value?.code === "string" ? value.code : null,
            sqlState: typeof value?.sqlState === "string" ? value.sqlState : null,
          }
          throw error
        }
      }),
    })
    const dependencies: HostedSetupTransactionalDependencies = {
      verifyAcceptedRestore: () => ({
        profile: "neuvetra.hosted-setup.accepted-restore-binding.v1",
        projectRef: HOSTED_SETUP_PROJECT,
        targetProfile: HOSTED_SETUP_PROFILE,
        schemaVersion: 22,
        restoreReceiptSha256: sourceInput.restoreReceipt.sha256,
        restoreReviewSha256: sourceInput.restoreReview.sha256,
        fingerprintDerivationSha256: sourceInput.fingerprintDerivation.sha256,
        fingerprintDerivationReviewSha256: sourceInput.fingerprintDerivationReview.sha256,
        sourceSnapshotSha256: "1".repeat(64),
        sourceArchiveSha256: "2".repeat(64),
        sourceStateSha256: "3".repeat(64),
        restoredStateSha256: "3".repeat(64),
        expectedDatabaseFingerprintSha256: input.expectedFingerprintSha256!,
        databaseFingerprintIndependentlyDerived: true,
        exactApplicationPreserved: true,
        tenantControlsVerified: true,
        operatorId: sourceInput.operatorId,
        independentReviewerId: sourceInput.restoreReviewerId,
        materialFindingsOpen: 0,
      }),
      verifyReviewedExecutionArtifact: () => ({
        profile: HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE,
        projectRef: HOSTED_SETUP_PROJECT,
        reviewedProductHead: HEAD,
        remoteHead: HEAD,
        requiredChecksPassed: true,
        publicationReceiptSha256: sourceInput.publicationReceipt.sha256,
        publicationReviewSha256: sourceInput.publicationReview.sha256,
        artifactPublicationSha256: sourceInput.publicationReceipt.sha256,
        executionArtifactProfile: ARTIFACT_PROFILE,
        artifactSourceProfile: ARTIFACT_SOURCE_PROFILE,
        artifactTrustBoundary: "trusted-operator-host",
        artifactClaim: "verified-at-rest-artifact-and-private-sql-only",
        executionArtifactSha256: SYNTHETIC_EXECUTION_ARTIFACT,
        migrationManifestSha256: hash(manifest),
        runtimeLoadedCodeAttested: false,
        launchAuthorized: false,
        operatorId: sourceInput.operatorId,
        independentReviewerId: sourceInput.publicationReviewerId,
        materialFindingsOpen: 0,
      }),
      currentProductHead: () => HEAD,
      verifyReviewedMaintenanceStop: () => ({
        profile: HOSTED_SETUP_REVIEWED_MAINTENANCE_PROFILE,
        maintenanceProfile: "neuvetra.hosted-setup.maintenance-stop.v2",
        projectRef: HOSTED_SETUP_PROJECT,
        targetProfile: HOSTED_SETUP_PROFILE,
        ...HOSTED_SETUP_MAINTENANCE_TARGET,
        deploymentId: "8946ec8e-3dba-484c-8f84-80fa71d8da5f",
        deployedCommit: HEAD,
        imageDigest: `sha256:${"8".repeat(64)}`,
        replicas: 0,
        availabilityStopObserved: true,
        databaseWritersExcluded: false,
        configurationVersion: "local-only-synthetic-compose",
        stopReceiptSha256: sourceInput.stopReceipt.sha256,
        stopReviewSha256: sourceInput.stopReview.sha256,
        operatorId: sourceInput.operatorId,
        independentReviewerId: sourceInput.stopReviewerId,
        materialFindingsOpen: 0,
      }),
      observeMaintenanceStopped: async (_binding, phase) => {
        phases.push(phase)
        if (phase !== "before_transaction") backendObservations.push(observeBackend(input.psqlPath, input.connectionString, input.applicationName))
        if (phase === "under_lock_before_commit" && input.mode === "rollback") throw new Error("LOCAL_ONLY_FORCED_ROLLBACK")
        if (phase === "under_lock_before_commit" && input.mode === "timeout") await new Promise(resolve => setTimeout(resolve, 4_500))
        return JSON.stringify(true)
      },
      withSequenceFence,
      artifactSqlLock: {
        binding: Object.freeze({ profile: ARTIFACT_SOURCE_PROFILE, reviewedProductHead: HEAD, executionArtifactSha256: SYNTHETIC_EXECUTION_ARTIFACT, migrationManifestSha256: hash(manifest) }),
        migrationManifest: () => manifest,
        withArtifactSource: async (binding, operation) => {
          if (artifactLockState !== "ready" || binding.profile !== ARTIFACT_SOURCE_PROFILE || binding.reviewedProductHead !== HEAD || binding.migrationManifestSha256 !== hash(manifest) || binding.executionArtifactSha256 !== SYNTHETIC_EXECUTION_ARTIFACT) throw new Error("LOCAL_COMPOSE_ARTIFACT_SOURCE_BINDING_REFUSED")
          artifactLockState = "active"
          try { return await operation() } finally { artifactLockState = "consumed" }
        },
        migrate: async (connection, projectRef) => {
          if (artifactLockState !== "active" || migrationCalls++ !== 0 || projectRef !== HOSTED_SETUP_PROJECT) throw new Error("LOCAL_COMPOSE_ARTIFACT_MIGRATION_REFUSED")
          return migratePrivateStagingFromManifest(connection, { expectedProjectRef: projectRef, syntheticTargetConfirmed: true, reuseExistingProject: true }, manifest)
        },
      },
      now: () => "2026-09-26T13:00:00.000Z",
    }
    try {
      const receipt = await runHostedSetupTransactionalUpgrade(instrumentedDb, sourceInput, dependencies)
      return Object.freeze({ mode: input.mode, outcome: "committed", receipt, phases, backendObservations, migrationCalls, transactionCallbackFailure, approvalEvidence: "synthetic-mock-only", launchAuthorized: false })
    } catch (error) {
      return Object.freeze({ mode: input.mode, outcome: "refused", error: error instanceof Error ? error.message : "unknown", phases, backendObservations, migrationCalls, transactionCallbackFailure, approvalEvidence: "synthetic-mock-only", launchAuthorized: false })
    }
  } finally {
    await db.close()
  }
}

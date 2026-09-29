import { readFile, writeFile } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"
import { parseM80Json } from "../../packages/neuvetra-database/src/m80-validation"

export const M80_HOSTED_PREPARATION_PROFILE = "neuvetra.m80.foundation-hosted-preparation.v1" as const
export const M80_HOSTED_INPUT_PROFILE = "neuvetra.m80.foundation-hosted-preparation-input.v1" as const
export const M80_ACCEPTED_CANDIDATE_SHA256 = "40c4ac822ef2d045457ade7dd63d471813178c8f3a585425be58eb81013de59b" as const
export const M80_MIGRATION_0022_SHA256 = "0ee148b366e803e8cf28187393f9e5a6f19b29f5bb54578e359db7cbcd795e35" as const
export const M80_RUNTIME_ROOT_CLOSURE_SHA256 = "953cdda7f40b808be09f05aef2bc1b8ac271136f980774bb07c9d20aaa79aac6" as const
export const M80_FIXTURE_SHA256 = "2c6a9f78cded2a209bf536969e4ea389baa7fe1633c8ef63fad0c22826f77dc1" as const

export const M80_REQUIRED_CHECKS = [
  "GHG calculation specifications and engine",
  "Offline research catalog tests",
  "Typecheck, lint, unit tests and web builds",
  "Dedicated staging image and offline runtime smoke",
  "Role routing and evidence records",
  "Native PostgreSQL worksheet and tenant regression",
] as const

export const M80_NEW_TABLES = [
  "scope1_beta_audit",
  "scope1_beta_fixture_admissions",
  "scope1_beta_release_records",
  "scope1_beta_requests",
  "scope1_beta_setup_heads",
  "scope1_beta_setup_versions",
] as const

export interface EvidencePin { path: string; sha256: string }

export interface HostedPreparationInput {
  profile: typeof M80_HOSTED_INPUT_PROFILE
  operatorId: "/root"
  observedTarget: {
    observedAt: string
    observationReceipt: EvidencePin
    projectRef: string
    environmentId: string
    serviceId: string
    deploymentId: string
    deploymentStatus: "SUCCESS"
    deployedCommitSha: string
    deployedImageSha256: string
    targetClassification: "private_synthetic_staging"
    syntheticDataOnlyVerified: true
    schemaVersion: 21
    migrationReceiptCount: 21
    observedNonReceiptTableCount: number
    historicalReferenceNonReceiptTableCount: 120
    applicationReadinessSchemaVersion: 21
    applicationStateSha256: string
    automaticDeploymentsPaused: true
    maintenanceEnabled: true
    noActiveApplicationWritesObserved: true
  }
  publication: {
    reviewedHeadCommitSha: string
    headObservedAt: string
    checksObservedAt: string
    requiredChecks: { name: string; status: "completed"; conclusion: "success" }[]
    publicationReviewVerdict: "pass"
    publicationReview: EvidencePin
    integrationAcceptanceVerdict: "pass"
    integrationAcceptance: EvidencePin
  }
  acceptedRuntime: {
    candidate: EvidencePin
    migration: EvidencePin
    rootClosure: EvidencePin
  }
  backup: {
    completedAt: string
    sourceSchemaVersion: 21
    sourceApplicationStateSha256: string
    applicationOnly: true
    syntheticDataOnly: true
    providerRecoveryExcluded: true
    backupReceipt: EvidencePin
    encryptedArchiveSha256: string
    snapshotSha256: string
    customDumpSha256: string
  }
  rehearsal: {
    completedAt: string
    disposableDatabaseName: string
    hostedEvidence: false
    sourceSchemaVersion: 21
    targetSchemaVersion: 22
    sourceBackupReceiptSha256: string
    migrationSha256: typeof M80_MIGRATION_0022_SHA256
    sourceObservedNonReceiptTableCount: number
    historicalReferenceNonReceiptTableCount: 120
    oldMigrationReceiptCount: 21
    oldContentExact: true
    oldMetadataExact: true
    expectedNewTables: string[]
    forcedRlsVerified: true
    runtimeSelectOnlyVerified: true
    runtimeDirectWritesDenied: true
    operatorAdmissionNotExecuted: true
    allConnectionsClosed: true
    restoreReceipt: EvidencePin
    preservationReceipt: EvidencePin
    migrationReceipt: EvidencePin
  }
  admission: {
    verifiedAt: string
    observationReceipt: EvidencePin
    companyId: string
    managerUserId: string
    managerRole: "owner" | "admin"
    existingSyntheticCompanyVerified: true
    existingManagerMembershipVerified: true
    noCompanyCreation: true
    noUserCreation: true
    noRoleOrPermissionCreation: true
  }
}

export interface M80HostedPreparationPlan {
  profile: typeof M80_HOSTED_PREPARATION_PROFILE
  createdAt: string
  expiresAt: string
  operationScopeSha256: string
  planSha256: string
  executionAuthorized: false
  rootOnlyEventualExecutor: true
  independentSecurityReviewRequired: true
  noNetworkOrHostedActionPerformed: true
  pins: {
    candidate: EvidencePin
    migration: EvidencePin
    rootClosure: EvidencePin
    targetObservation: EvidencePin
    publicationReview: EvidencePin
    integrationAcceptance: EvidencePin
    backupReceipt: EvidencePin
    restoreReceipt: EvidencePin
    preservationReceipt: EvidencePin
    migrationRehearsalReceipt: EvidencePin
    admissionObservation: EvidencePin
  }
  target: HostedPreparationInput["observedTarget"]
  publication: HostedPreparationInput["publication"]
  backup: HostedPreparationInput["backup"]
  rehearsal: HostedPreparationInput["rehearsal"]
  admission: HostedPreparationInput["admission"] & {
    fixtureProfileId: "m80-synthetic-scope1-foundation-v1"
    fixtureVersion: 1
    fixtureSha256: typeof M80_FIXTURE_SHA256
  }
  sequence: readonly ["migration", "admission", "deployment"]
  actions: {
    migration: {
      status: "not_executed"
      fromSchemaVersion: 21
      toSchemaVersion: 22
      migrationName: "0022_scope1_beta_foundation.sql"
      migrationSha256: typeof M80_MIGRATION_0022_SHA256
      expectedReceiptCount: 22
      retryPolicy: "one_intent_only_verify_authoritative_state_after_uncertainty"
    }
    admission: {
      status: "not_executed"
      prerequisite: "verified_migration_success"
      companyId: string
      managerUserId: string
      sql: string
      expectedRows: 1
      retryPolicy: "one_intent_only_verify_authoritative_state_after_uncertainty"
    }
    deployment: {
      status: "not_executed"
      prerequisite: "verified_migration_and_admission_success"
      commitSha: string
      environmentId: string
      serviceId: string
      expectedSchemaVersion: 22
      retryPolicy: "one_intent_only_verify_authoritative_state_after_uncertainty"
    }
  }
}

const SHA256 = /^[0-9a-f]{64}$/
const SHA1 = /^[0-9a-f]{40}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PROJECT = /^[a-z]{20}$/
const DATABASE = /^m80_(?:ops|qa)_foundation_[0-9]{10,}$/
const FORBIDDEN_KEY = /(password|secret|token|credential|databaseurl|connectionstring|authorization|cookie)/i
const FORBIDDEN_VALUE = /(postgres(?:ql)?:\/\/|bearer\s+[a-z0-9._-]+|-----begin [a-z ]*private key-----)/i
const MAX_INPUT_BYTES = 50_000

export const m80HostedCanonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(m80HostedCanonicalJson).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => `${JSON.stringify(key)}:${m80HostedCanonicalJson(child)}`).join(",")}}`
  return JSON.stringify(value)
}

export const m80HostedSha256 = (value: string | Uint8Array): string => new Bun.CryptoHasher("sha256").update(value).digest("hex")

function closedObject(value: unknown, keys: string[], name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error(`${name} must contain only its exact reviewed fields.`)
}

function noSecrets(value: unknown, path = "input"): void {
  if (Array.isArray(value)) return value.forEach((child, index) => noSecrets(child, `${path}[${index}]`))
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY.test(key)) throw new Error(`Secret-shaped field refused at ${path}.${key}.`)
      noSecrets(child, `${path}.${key}`)
    }
  } else if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) throw new Error(`Secret-shaped value refused at ${path}.`)
}

function exactIso(value: string, name: string): number {
  const time = Date.parse(value)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) throw new Error(`${name} must be canonical ISO UTC.`)
  return time
}

function fresh(value: string, nowMs: number, maxAgeMs: number, name: string): number {
  const time = exactIso(value, name)
  if (time > nowMs + 5_000 || nowMs - time > maxAgeMs) throw new Error(`${name} is stale or future-dated.`)
  return time
}

function pin(value: unknown, name: string): EvidencePin {
  closedObject(value, ["path", "sha256"], name)
  if (typeof value.path !== "string" || !value.path || isAbsolute(value.path) || value.path.includes("\\") || value.path.split("/").includes("..") || typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) throw new Error(`${name} is not a safe exact byte pin.`)
  return value as unknown as EvidencePin
}

function exactChecks(value: unknown): asserts value is HostedPreparationInput["publication"]["requiredChecks"] {
  if (!Array.isArray(value) || value.length !== M80_REQUIRED_CHECKS.length) throw new Error("The exact six required checks are required.")
  const names = value.map((row, index) => {
    closedObject(row, ["name", "status", "conclusion"], `requiredChecks[${index}]`)
    if (row.status !== "completed" || row.conclusion !== "success" || typeof row.name !== "string") throw new Error("Every required check must be completed successfully.")
    return row.name
  })
  if ([...names].sort().join("|") !== [...M80_REQUIRED_CHECKS].sort().join("|")) throw new Error("Required check names changed or are incomplete.")
}

export function validateM80HostedPreparationInput(value: unknown, now = new Date()): HostedPreparationInput {
  if (m80HostedCanonicalJson(value).length > MAX_INPUT_BYTES) throw new Error("Hosted preparation input is too large.")
  noSecrets(value)
  closedObject(value, ["profile", "operatorId", "observedTarget", "publication", "acceptedRuntime", "backup", "rehearsal", "admission"], "input")
  if (value.profile !== M80_HOSTED_INPUT_PROFILE || value.operatorId !== "/root") throw new Error("Exact root-owned hosted preparation profile required.")

  const target = value.observedTarget
  closedObject(target, ["observedAt", "observationReceipt", "projectRef", "environmentId", "serviceId", "deploymentId", "deploymentStatus", "deployedCommitSha", "deployedImageSha256", "targetClassification", "syntheticDataOnlyVerified", "schemaVersion", "migrationReceiptCount", "observedNonReceiptTableCount", "historicalReferenceNonReceiptTableCount", "applicationReadinessSchemaVersion", "applicationStateSha256", "automaticDeploymentsPaused", "maintenanceEnabled", "noActiveApplicationWritesObserved"], "observedTarget")
  const nowMs = now.getTime()
  const targetAt = fresh(String(target.observedAt), nowMs, 15 * 60_000, "observedTarget.observedAt")
  pin(target.observationReceipt, "observedTarget.observationReceipt")
  if (typeof target.projectRef !== "string" || !PROJECT.test(target.projectRef) || typeof target.environmentId !== "string" || !UUID.test(target.environmentId) || typeof target.serviceId !== "string" || !UUID.test(target.serviceId) || typeof target.deploymentId !== "string" || !UUID.test(target.deploymentId) || target.deploymentStatus !== "SUCCESS" || typeof target.deployedCommitSha !== "string" || !SHA1.test(target.deployedCommitSha) || typeof target.deployedImageSha256 !== "string" || !SHA256.test(target.deployedImageSha256) || target.targetClassification !== "private_synthetic_staging" || target.syntheticDataOnlyVerified !== true || target.schemaVersion !== 21 || target.migrationReceiptCount !== 21 || !Number.isSafeInteger(target.observedNonReceiptTableCount) || (target.observedNonReceiptTableCount as number) < 1 || target.historicalReferenceNonReceiptTableCount !== 120 || target.applicationReadinessSchemaVersion !== 21 || typeof target.applicationStateSha256 !== "string" || !SHA256.test(target.applicationStateSha256) || target.automaticDeploymentsPaused !== true || target.maintenanceEnabled !== true || target.noActiveApplicationWritesObserved !== true) throw new Error("Fresh exact schema-21 synthetic target observation required.")

  const publication = value.publication
  closedObject(publication, ["reviewedHeadCommitSha", "headObservedAt", "checksObservedAt", "requiredChecks", "publicationReviewVerdict", "publicationReview", "integrationAcceptanceVerdict", "integrationAcceptance"], "publication")
  if (typeof publication.reviewedHeadCommitSha !== "string" || !SHA1.test(publication.reviewedHeadCommitSha) || publication.publicationReviewVerdict !== "pass" || publication.integrationAcceptanceVerdict !== "pass") throw new Error("Exact accepted publication head required.")
  fresh(String(publication.headObservedAt), nowMs, 15 * 60_000, "publication.headObservedAt")
  fresh(String(publication.checksObservedAt), nowMs, 15 * 60_000, "publication.checksObservedAt")
  exactChecks(publication.requiredChecks)
  pin(publication.publicationReview, "publication.publicationReview")
  pin(publication.integrationAcceptance, "publication.integrationAcceptance")

  const runtime = value.acceptedRuntime
  closedObject(runtime, ["candidate", "migration", "rootClosure"], "acceptedRuntime")
  const candidate = pin(runtime.candidate, "acceptedRuntime.candidate")
  const migration = pin(runtime.migration, "acceptedRuntime.migration")
  const closure = pin(runtime.rootClosure, "acceptedRuntime.rootClosure")
  if (candidate.path !== "operations/agent-improvement/snapshots/M80-FOUNDATION-RUNTIME-20260924-CANDIDATE2.json" || candidate.sha256 !== M80_ACCEPTED_CANDIDATE_SHA256 || migration.path !== "packages/neuvetra-database/src/migrations/0022_scope1_beta_foundation.sql" || migration.sha256 !== M80_MIGRATION_0022_SHA256 || closure.path !== "evaluations/research-qa/m80-foundation-runtime-root-closure-20260924.json" || closure.sha256 !== M80_RUNTIME_ROOT_CLOSURE_SHA256) throw new Error("Accepted runtime, migration or root closure pin changed.")

  const backup = value.backup
  closedObject(backup, ["completedAt", "sourceSchemaVersion", "sourceApplicationStateSha256", "applicationOnly", "syntheticDataOnly", "providerRecoveryExcluded", "backupReceipt", "encryptedArchiveSha256", "snapshotSha256", "customDumpSha256"], "backup")
  const backupAt = fresh(String(backup.completedAt), nowMs, 24 * 60 * 60_000, "backup.completedAt")
  if (backupAt > targetAt || backup.sourceSchemaVersion !== 21 || backup.sourceApplicationStateSha256 !== target.applicationStateSha256 || backup.applicationOnly !== true || backup.syntheticDataOnly !== true || backup.providerRecoveryExcluded !== true || ![backup.encryptedArchiveSha256, backup.snapshotSha256, backup.customDumpSha256].every(item => typeof item === "string" && SHA256.test(item))) throw new Error("Verified application-only schema-21 backup bound to the observed target is required.")
  const backupReceipt = pin(backup.backupReceipt, "backup.backupReceipt")

  const rehearsal = value.rehearsal
  closedObject(rehearsal, ["completedAt", "disposableDatabaseName", "hostedEvidence", "sourceSchemaVersion", "targetSchemaVersion", "sourceBackupReceiptSha256", "migrationSha256", "sourceObservedNonReceiptTableCount", "historicalReferenceNonReceiptTableCount", "oldMigrationReceiptCount", "oldContentExact", "oldMetadataExact", "expectedNewTables", "forcedRlsVerified", "runtimeSelectOnlyVerified", "runtimeDirectWritesDenied", "operatorAdmissionNotExecuted", "allConnectionsClosed", "restoreReceipt", "preservationReceipt", "migrationReceipt"], "rehearsal")
  const rehearsalAt = fresh(String(rehearsal.completedAt), nowMs, 24 * 60 * 60_000, "rehearsal.completedAt")
  if (rehearsalAt < backupAt || rehearsalAt > targetAt || typeof rehearsal.disposableDatabaseName !== "string" || !DATABASE.test(rehearsal.disposableDatabaseName) || rehearsal.hostedEvidence !== false || rehearsal.sourceSchemaVersion !== 21 || rehearsal.targetSchemaVersion !== 22 || rehearsal.sourceBackupReceiptSha256 !== backupReceipt.sha256 || rehearsal.migrationSha256 !== M80_MIGRATION_0022_SHA256 || rehearsal.sourceObservedNonReceiptTableCount !== target.observedNonReceiptTableCount || rehearsal.historicalReferenceNonReceiptTableCount !== 120 || rehearsal.oldMigrationReceiptCount !== 21 || rehearsal.oldContentExact !== true || rehearsal.oldMetadataExact !== true || !Array.isArray(rehearsal.expectedNewTables) || [...rehearsal.expectedNewTables].sort().join("|") !== [...M80_NEW_TABLES].sort().join("|") || rehearsal.forcedRlsVerified !== true || rehearsal.runtimeSelectOnlyVerified !== true || rehearsal.runtimeDirectWritesDenied !== true || rehearsal.operatorAdmissionNotExecuted !== true || rehearsal.allConnectionsClosed !== true) throw new Error("Exact disposable schema-21 to schema-22 preservation rehearsal required.")
  pin(rehearsal.restoreReceipt, "rehearsal.restoreReceipt")
  pin(rehearsal.preservationReceipt, "rehearsal.preservationReceipt")
  pin(rehearsal.migrationReceipt, "rehearsal.migrationReceipt")

  const admission = value.admission
  closedObject(admission, ["verifiedAt", "observationReceipt", "companyId", "managerUserId", "managerRole", "existingSyntheticCompanyVerified", "existingManagerMembershipVerified", "noCompanyCreation", "noUserCreation", "noRoleOrPermissionCreation"], "admission")
  fresh(String(admission.verifiedAt), nowMs, 15 * 60_000, "admission.verifiedAt")
  pin(admission.observationReceipt, "admission.observationReceipt")
  if (typeof admission.companyId !== "string" || !UUID.test(admission.companyId) || typeof admission.managerUserId !== "string" || !UUID.test(admission.managerUserId) || !["owner", "admin"].includes(String(admission.managerRole)) || admission.existingSyntheticCompanyVerified !== true || admission.existingManagerMembershipVerified !== true || admission.noCompanyCreation !== true || admission.noUserCreation !== true || admission.noRoleOrPermissionCreation !== true) throw new Error("Fresh existing synthetic company and manager admission proof required.")

  return value as unknown as HostedPreparationInput
}

export async function buildM80HostedPreparationPlan(value: unknown, options: { now?: Date; verifyPin?: (pin: EvidencePin) => Promise<void> } = {}): Promise<M80HostedPreparationPlan> {
  const now = options.now ?? new Date()
  const input = validateM80HostedPreparationInput(value, now)
  const pins = [input.acceptedRuntime.candidate, input.acceptedRuntime.migration, input.acceptedRuntime.rootClosure, input.observedTarget.observationReceipt, input.publication.publicationReview, input.publication.integrationAcceptance, input.backup.backupReceipt, input.rehearsal.restoreReceipt, input.rehearsal.preservationReceipt, input.rehearsal.migrationReceipt, input.admission.observationReceipt]
  if (options.verifyPin) for (const item of pins) await options.verifyPin(item)
  const sql = `insert into neuvetra.scope1_beta_fixture_admissions(company_id,fixture_profile_id,fixture_version,fixture_sha256,active,admitted_by) select c.id,'m80-synthetic-scope1-foundation-v1',1,'${M80_FIXTURE_SHA256}',true,m.user_id from neuvetra.companies c join neuvetra.company_members m on m.company_id=c.id where c.id=$1::uuid and m.user_id=$2::uuid and m.role in ('owner','admin') returning company_id,fixture_profile_id,fixture_version,fixture_sha256,active,admitted_by;`
  const operationScopeSha256 = m80HostedSha256(m80HostedCanonicalJson({ profile: "neuvetra.m80.foundation-hosted-operation-scope.v1", milestone: "M80-FOUNDATION-SCHEMA22", projectRef: input.observedTarget.projectRef, candidateSha256: M80_ACCEPTED_CANDIDATE_SHA256, migrationSha256: M80_MIGRATION_0022_SHA256 }))
  const unsigned = {
    profile: M80_HOSTED_PREPARATION_PROFILE,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 4 * 60 * 60_000).toISOString(),
    operationScopeSha256,
    executionAuthorized: false as const,
    rootOnlyEventualExecutor: true as const,
    independentSecurityReviewRequired: true as const,
    noNetworkOrHostedActionPerformed: true as const,
    pins: { candidate: input.acceptedRuntime.candidate, migration: input.acceptedRuntime.migration, rootClosure: input.acceptedRuntime.rootClosure, targetObservation: input.observedTarget.observationReceipt, publicationReview: input.publication.publicationReview, integrationAcceptance: input.publication.integrationAcceptance, backupReceipt: input.backup.backupReceipt, restoreReceipt: input.rehearsal.restoreReceipt, preservationReceipt: input.rehearsal.preservationReceipt, migrationRehearsalReceipt: input.rehearsal.migrationReceipt, admissionObservation: input.admission.observationReceipt },
    target: input.observedTarget,
    publication: input.publication,
    backup: input.backup,
    rehearsal: input.rehearsal,
    admission: { ...input.admission, fixtureProfileId: "m80-synthetic-scope1-foundation-v1" as const, fixtureVersion: 1 as const, fixtureSha256: M80_FIXTURE_SHA256 },
    sequence: ["migration", "admission", "deployment"] as const,
    actions: {
      migration: { status: "not_executed" as const, fromSchemaVersion: 21 as const, toSchemaVersion: 22 as const, migrationName: "0022_scope1_beta_foundation.sql" as const, migrationSha256: M80_MIGRATION_0022_SHA256, expectedReceiptCount: 22 as const, retryPolicy: "one_intent_only_verify_authoritative_state_after_uncertainty" as const },
      admission: { status: "not_executed" as const, prerequisite: "verified_migration_success" as const, companyId: input.admission.companyId, managerUserId: input.admission.managerUserId, sql, expectedRows: 1 as const, retryPolicy: "one_intent_only_verify_authoritative_state_after_uncertainty" as const },
      deployment: { status: "not_executed" as const, prerequisite: "verified_migration_and_admission_success" as const, commitSha: input.publication.reviewedHeadCommitSha, environmentId: input.observedTarget.environmentId, serviceId: input.observedTarget.serviceId, expectedSchemaVersion: 22 as const, retryPolicy: "one_intent_only_verify_authoritative_state_after_uncertainty" as const },
    },
  }
  return { ...unsigned, planSha256: m80HostedSha256(m80HostedCanonicalJson(unsigned)) }
}

const repoRoot = resolve(import.meta.dir, "..")
async function verifyRepositoryPin(item: EvidencePin): Promise<void> {
  const absolute = resolve(repoRoot, item.path)
  const inside = relative(repoRoot, absolute)
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) throw new Error(`Unsafe evidence path: ${item.path}`)
  const actual = m80HostedSha256(await readFile(absolute))
  if (actual !== item.sha256) throw new Error(`Evidence bytes changed: ${item.path}`)
}

if (import.meta.main) {
  const [inputPath, outputPath] = process.argv.slice(2)
  if (!inputPath || !outputPath) throw new Error("Usage: bun .superpowers/m80-foundation-hosted-prepare.ts <input.json> <new-output.json>")
  if (isAbsolute(outputPath) || !outputPath.startsWith(".superpowers/m80-foundation-hosted-") || !outputPath.endsWith(".json")) throw new Error("Output must be a new repository-relative .superpowers/m80-foundation-hosted-*.json file.")
  const text = await readFile(resolve(repoRoot, inputPath), "utf8")
  if (Buffer.byteLength(text, "utf8") > MAX_INPUT_BYTES) throw new Error("Hosted preparation input is too large.")
  const plan = await buildM80HostedPreparationPlan(parseM80Json(text), { verifyPin: verifyRepositoryPin })
  await writeFile(resolve(repoRoot, outputPath), `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" })
  console.log(JSON.stringify({ status: "prepared_offline_review_required", path: outputPath, sha256: m80HostedSha256(await readFile(resolve(repoRoot, outputPath))), executionAuthorized: false }))
}

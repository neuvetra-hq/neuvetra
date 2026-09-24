import type { WorkspaceSql } from "./workspace"
import {
  M80_DATA_CLASSIFICATION,
  M80_FIXTURE_PROFILE,
  M80_FIXTURE_VERSION,
  type M80FixtureAdmission,
  type M80FoundationClassification,
  type M80HeldProfile,
  type M80SetupInput,
  type M80ValidatedSetup,
} from "./m80-contract"
import { createM80FixtureSetup, m80HashCanonical, M80_FIXTURE_SHA256 } from "./m80-fixture"
import { classifyM80Foundation, M80ValidationError, validateM80Setup } from "./m80-validation"
import { m71CanonicalJson } from "./m71-validation"

export const M80_RUNTIME_PROFILE = "m80-scope1-beta-foundation-runtime-v1" as const
export const M80_CORRECTION_REASON = "synthetic_fact_correction" as const

export interface M80BetaSetupVersion {
  id: string
  companyId: string
  reportingYear: 2025
  revision: number
  previousVersionId: string | null
  previousVersionSha256: string | null
  setup: M80ValidatedSetup
  payloadSha256: string
  versionSha256: string
  createdBy: string
  createdAt: string
}

export interface M80FoundationView {
  profile: typeof M80_RUNTIME_PROFILE
  syntheticOnly: true
  canManage: boolean
  fixtureAdmission: M80FixtureAdmission
  releaseRegistry: M80HeldProfile[]
  currentVersion: M80BetaSetupVersion | null
  history: M80BetaVersionSummary[]
  setup: M80ValidatedSetup
  eligibility: M80FoundationClassification
}

export interface M80SaveSetupInput {
  idempotencyKey: string
  expectedRevision: number
  expectedVersionId: string | null
  expectedVersionSha256: string | null
  correctionReason: null | typeof M80_CORRECTION_REASON
  setup: unknown
}

export interface M80SaveSetupResult {
  foundation: M80FoundationView
  savedVersion: M80BetaSetupVersion
  replayed: boolean
}

export type M80BetaVersionSummary = Omit<M80BetaSetupVersion, "setup">

interface AdmissionRow {
  company_id: string
  fixture_profile_id: typeof M80_FIXTURE_PROFILE
  fixture_version: number
  fixture_sha256: string
  active: boolean
}

interface ReleaseRow {
  profile_id: M80HeldProfile["profileId"]
  status: "held_candidate"
  method_id: string
  method_version: string | null
  method_sha256: string
  engine_sha256: string
  factor_identity_sha256: string
  gwp_identity_sha256: string
  source_artifact_ids: unknown
  reporting_period_start: string
  reporting_period_end_exclusive: string
  effective_at: string | null
  superseded_at: string | null
  exclusions: unknown
  decision_artifact_sha256: string
}

interface VersionRow {
  id: string
  company_id: string
  reporting_year: number
  revision: number
  previous_version_id: string | null
  previous_version_sha256: string | null
  fixture_profile_id: string
  fixture_version: number
  fixture_sha256: string
  payload: unknown
  canonical_payload: string
  payload_sha256: string
  version_sha256: string
  created_by: string
  created_at: string
  correction_reason: string | null
  data_classification: string
  completeness: string
  released_supported_count: number
  request_actor_id: string
  request_created_at: string
  request_sha256: string
  audit_actor_id: string
  audit_created_at: string
  audit_record_sha256: string
  audit_event_type: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA256 = /^[0-9a-f]{64}$/

function exactObject(value: unknown, keys: string[], message = "Invalid M80 setup request."): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new M80ValidationError(message)
}

function releaseRegistry(rows: ReleaseRow[]): M80HeldProfile[] {
  return rows.map((row) => {
    if (!Array.isArray(row.source_artifact_ids) || row.source_artifact_ids.some((entry) => typeof entry !== "string") || row.reporting_period_start !== "2025-01-01" || row.reporting_period_end_exclusive !== "2026-01-01" || row.effective_at !== null || row.superseded_at !== null || row.decision_artifact_sha256 !== "848883159be48c88a0dab8589ad371dcdbbf8dd07966a3d5fbcfd0799f7a530b" || !Array.isArray(row.exclusions) || m80HashCanonical(row.exclusions) !== m80HashCanonical(["domain_release_pending", "rights_release_pending", "runtime_release_prohibited"])) throw new Error("M80 release registry could not be verified.")
    return {
      profileId: row.profile_id,
      status: row.status,
      methodId: row.method_id,
      methodVersion: row.method_version,
      methodSha256: row.method_sha256,
      engineSha256: row.engine_sha256,
      factorIdentitySha256: row.factor_identity_sha256,
      gwpIdentitySha256: row.gwp_identity_sha256,
      sourceArtifactIds: [...row.source_artifact_ids] as string[],
    }
  })
}

function admission(row: AdmissionRow): M80FixtureAdmission {
  if (row.fixture_profile_id !== M80_FIXTURE_PROFILE || row.fixture_version !== M80_FIXTURE_VERSION || row.fixture_sha256 !== M80_FIXTURE_SHA256 || row.active !== true) throw new Error("M80 fixture admission could not be verified.")
  return { companyId: row.company_id, fixtureProfileId: row.fixture_profile_id, fixtureVersion: M80_FIXTURE_VERSION, fixtureSha256: row.fixture_sha256, active: true }
}

function versionHashPayload(version: Omit<M80BetaSetupVersion, "versionSha256" | "setup"> & { fixtureProfileId: typeof M80_FIXTURE_PROFILE; fixtureVersion: typeof M80_FIXTURE_VERSION; fixtureSha256: string; dataClassification: typeof M80_DATA_CLASSIFICATION; completeness: "incomplete"; releasedSupportedCount: 0 }): Record<string, unknown> {
  return {
    profile: M80_RUNTIME_PROFILE,
    id: version.id,
    companyId: version.companyId,
    reportingYear: version.reportingYear,
    revision: version.revision,
    previousVersionId: version.previousVersionId,
    previousVersionSha256: version.previousVersionSha256,
    fixtureProfileId: version.fixtureProfileId,
    fixtureVersion: version.fixtureVersion,
    fixtureSha256: version.fixtureSha256,
    payloadSha256: version.payloadSha256,
    createdBy: version.createdBy,
    createdAt: version.createdAt,
    dataClassification: version.dataClassification,
    completeness: version.completeness,
    releasedSupportedCount: version.releasedSupportedCount,
  }
}

function persistedSetup(setup: M80ValidatedSetup): M80SetupInput {
  const { fixture: _fixture, sources, ...root } = setup
  return {
    ...root,
    sources: sources.map(({ sourceIdentitySha256: _identity, ...source }) => source),
  }
}

function decodeVersion(row: VersionRow, trustedAdmission: M80FixtureAdmission): M80BetaSetupVersion {
  if (m71CanonicalJson(row.payload) !== row.canonical_payload || m80HashCanonical(row.payload) !== row.payload_sha256) throw new Error("Stored M80 setup integrity check failed.")
  const setup = validateM80Setup(row.payload, trustedAdmission)
  const createdAt = new Date(row.created_at).toISOString()
  if (row.reporting_year !== 2025 || !Number.isSafeInteger(row.revision) || row.revision < 1 || row.fixture_profile_id !== M80_FIXTURE_PROFILE || row.fixture_version !== M80_FIXTURE_VERSION || row.fixture_sha256 !== trustedAdmission.fixtureSha256 || row.correction_reason !== (row.revision === 1 ? null : M80_CORRECTION_REASON) || row.data_classification !== M80_DATA_CLASSIFICATION || row.completeness !== "incomplete" || row.released_supported_count !== 0 || row.request_actor_id !== row.created_by || row.audit_actor_id !== row.created_by || new Date(row.request_created_at).toISOString() !== createdAt || new Date(row.audit_created_at).toISOString() !== createdAt || row.audit_record_sha256 !== row.version_sha256 || row.audit_event_type !== "setup_saved") throw new Error("Stored M80 setup integrity check failed.")
  const version: M80BetaSetupVersion = {
    id: row.id,
    companyId: row.company_id,
    reportingYear: 2025,
    revision: row.revision,
    previousVersionId: row.previous_version_id,
    previousVersionSha256: row.previous_version_sha256,
    setup,
    payloadSha256: row.payload_sha256,
    versionSha256: row.version_sha256,
    createdBy: row.created_by,
    createdAt,
  }
  const expected = m80HashCanonical(versionHashPayload({
    ...version,
    fixtureProfileId: row.fixture_profile_id,
    fixtureVersion: row.fixture_version,
    fixtureSha256: row.fixture_sha256,
    dataClassification: row.data_classification,
    completeness: row.completeness,
    releasedSupportedCount: row.released_supported_count,
  }))
  const expectedRequestSha256 = m80HashCanonical({
    operation: "save_scope1_beta_setup",
    actor: row.created_by,
    companyId: row.company_id,
    request: {
      profile: M80_RUNTIME_PROFILE,
      expectedRevision: row.revision - 1,
      expectedVersionId: row.previous_version_id,
      expectedVersionSha256: row.previous_version_sha256,
      correctionReason: row.revision === 1 ? null : M80_CORRECTION_REASON,
    },
    setup: row.payload,
  })
  if (expected !== version.versionSha256 || expectedRequestSha256 !== row.request_sha256) throw new Error("Stored M80 version integrity check failed.")
  return version
}

export function validateM80SaveSetup(value: unknown): M80SaveSetupInput {
  exactObject(value, ["idempotencyKey", "expectedRevision", "expectedVersionId", "expectedVersionSha256", "correctionReason", "setup"])
  if (typeof value.idempotencyKey !== "string" || !UUID.test(value.idempotencyKey) || !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0) throw new M80ValidationError("Invalid M80 setup request.")
  if (value.expectedRevision === 0) {
    if (value.expectedVersionId !== null || value.expectedVersionSha256 !== null || value.correctionReason !== null) throw new M80ValidationError("Exact initial M80 setup binding required.")
  } else if (typeof value.expectedVersionId !== "string" || !UUID.test(value.expectedVersionId) || typeof value.expectedVersionSha256 !== "string" || !SHA256.test(value.expectedVersionSha256) || value.correctionReason !== M80_CORRECTION_REASON) {
    throw new M80ValidationError("Exact M80 predecessor binding required.")
  }
  return value as unknown as M80SaveSetupInput
}

export async function readM80Foundation(tx: WorkspaceSql, companyId: string): Promise<M80FoundationView | null> {
  const admissions = await tx.query<AdmissionRow>(`select company_id,fixture_profile_id,fixture_version,fixture_sha256,active
    from neuvetra.scope1_beta_fixture_admissions where company_id=$1 and active`, [companyId])
  if (admissions.rows.length !== 1) return null
  const trustedAdmission = admission(admissions.rows[0]!)
  const releases = await tx.query<ReleaseRow>(`select profile_id,status,method_id,method_version,method_sha256,engine_sha256,
      factor_identity_sha256,gwp_identity_sha256,source_artifact_ids,reporting_period_start::text,reporting_period_end_exclusive::text,
      effective_at::text,superseded_at::text,exclusions,decision_artifact_sha256
    from neuvetra.scope1_beta_release_records order by profile_id`)
  const registry = releaseRegistry(releases.rows)
  const versions = await tx.query<VersionRow>(`select v.id,v.company_id,v.reporting_year,v.revision,v.previous_version_id,v.previous_version_sha256,
      v.fixture_profile_id,v.fixture_version,v.fixture_sha256,v.payload,v.canonical_payload,v.payload_sha256,v.version_sha256,v.created_by,v.created_at::text,
      v.correction_reason,v.data_classification,v.completeness,v.released_supported_count,
      r.actor_id request_actor_id,r.created_at::text request_created_at,r.request_sha256,a.actor_id audit_actor_id,a.created_at::text audit_created_at,
      a.record_sha256 audit_record_sha256,a.event_type audit_event_type
    from neuvetra.scope1_beta_setup_versions v
    join neuvetra.scope1_beta_requests r on r.company_id=v.company_id and r.record_id=v.id
    join neuvetra.scope1_beta_audit a on a.company_id=v.company_id and a.record_id=v.id
    where v.company_id=$1 and v.reporting_year=2025 order by v.revision`, [companyId])
  const decoded = versions.rows.map((row) => decodeVersion(row, trustedAdmission))
  for (let index = 0; index < decoded.length; index++) {
    const item = decoded[index]!
    const prior = decoded[index - 1] ?? null
    if (item.revision !== index + 1 || (item.previousVersionId !== (prior?.id ?? null)) || (item.previousVersionSha256 !== (prior?.versionSha256 ?? null))) throw new Error("M80 setup history integrity check failed.")
  }
  const heads = await tx.query<{ version_id: string; revision: number }>("select version_id,revision from neuvetra.scope1_beta_setup_heads where company_id=$1 and reporting_year=2025", [companyId])
  if (heads.rows.length > 1 || (decoded.length === 0) !== (heads.rows.length === 0)) throw new Error("M80 setup head could not be verified.")
  const currentVersion = decoded.length ? decoded[decoded.length - 1]! : null
  if (currentVersion && (heads.rows[0]?.version_id !== currentVersion.id || heads.rows[0]?.revision !== currentVersion.revision)) throw new Error("M80 setup head could not be verified.")
  const setup = currentVersion?.setup ?? validateM80Setup(createM80FixtureSetup(companyId), trustedAdmission)
  const rawSetup = currentVersion ? persistedSetup(currentVersion.setup) : createM80FixtureSetup(companyId)
  const eligibility = classifyM80Foundation(rawSetup, trustedAdmission, registry)
  const history = decoded.map(({ setup: _setup, ...summary }) => summary)
  const authority = await tx.query<{ allowed: boolean }>("select neuvetra.can_manage_company($1) allowed", [companyId])
  return { profile: M80_RUNTIME_PROFILE, syntheticOnly: true, canManage: authority.rows[0]?.allowed === true, fixtureAdmission: trustedAdmission, releaseRegistry: registry, currentVersion, history, setup, eligibility }
}

export async function readM80FoundationVersion(tx: WorkspaceSql, companyId: string, versionId: string): Promise<M80BetaSetupVersion | null> {
  if (!UUID.test(versionId)) return null
  const foundation = await readM80Foundation(tx, companyId)
  if (!foundation || !foundation.history.some((entry) => entry.id === versionId)) return null
  const admissions = await tx.query<AdmissionRow>(`select company_id,fixture_profile_id,fixture_version,fixture_sha256,active
    from neuvetra.scope1_beta_fixture_admissions where company_id=$1 and active`, [companyId])
  if (admissions.rows.length !== 1) return null
  const rows = await tx.query<VersionRow>(`select v.id,v.company_id,v.reporting_year,v.revision,v.previous_version_id,v.previous_version_sha256,
      v.fixture_profile_id,v.fixture_version,v.fixture_sha256,v.payload,v.canonical_payload,v.payload_sha256,v.version_sha256,v.created_by,v.created_at::text,
      v.correction_reason,v.data_classification,v.completeness,v.released_supported_count,
      r.actor_id request_actor_id,r.created_at::text request_created_at,r.request_sha256,a.actor_id audit_actor_id,a.created_at::text audit_created_at,
      a.record_sha256 audit_record_sha256,a.event_type audit_event_type
    from neuvetra.scope1_beta_setup_versions v
    join neuvetra.scope1_beta_requests r on r.company_id=v.company_id and r.record_id=v.id
    join neuvetra.scope1_beta_audit a on a.company_id=v.company_id and a.record_id=v.id
    where v.company_id=$1 and v.id=$2`, [companyId, versionId])
  return rows.rows.length === 1 ? decodeVersion(rows.rows[0]!, admission(admissions.rows[0]!)) : null
}

export async function saveM80Foundation(tx: WorkspaceSql, actorId: string, companyId: string, rawInput: unknown): Promise<M80SaveSetupResult> {
  const input = validateM80SaveSetup(rawInput)
  const admissions = await tx.query<AdmissionRow>(`select company_id,fixture_profile_id,fixture_version,fixture_sha256,active
    from neuvetra.scope1_beta_fixture_admissions where company_id=$1 and active`, [companyId])
  if (admissions.rows.length !== 1) throw Object.assign(new Error("M80 foundation not found."), { code: "M80_FOUNDATION_NOT_FOUND" })
  const trustedAdmission = admission(admissions.rows[0]!)
  const validatedSetup = validateM80Setup(input.setup, trustedAdmission)
  const setup = persistedSetup(validatedSetup)
  const payloadSha256 = m80HashCanonical(setup)
  const createdAt = new Date().toISOString()
  const id = crypto.randomUUID()
  const body = {
    profile: M80_RUNTIME_PROFILE,
    id,
    companyId,
    reportingYear: 2025 as const,
    revision: input.expectedRevision + 1,
    previousVersionId: input.expectedVersionId,
    previousVersionSha256: input.expectedVersionSha256,
    fixtureProfileId: M80_FIXTURE_PROFILE,
    fixtureVersion: M80_FIXTURE_VERSION,
    fixtureSha256: M80_FIXTURE_SHA256,
    payloadSha256,
    createdBy: actorId,
    createdAt,
    dataClassification: M80_DATA_CLASSIFICATION,
    completeness: "incomplete" as const,
    releasedSupportedCount: 0 as const,
  }
  const version = { ...body, versionSha256: m80HashCanonical(body) }
  const request = {
    profile: M80_RUNTIME_PROFILE,
    idempotencyKey: input.idempotencyKey,
    expectedRevision: input.expectedRevision,
    expectedVersionId: input.expectedVersionId,
    expectedVersionSha256: input.expectedVersionSha256,
    correctionReason: input.correctionReason,
  }
  const saved = await tx.query<{ record_id: string; replayed: boolean }>("select * from neuvetra.save_scope1_beta_setup($1,$2::text::jsonb,$3::text::jsonb,$4::text::jsonb)", [companyId, JSON.stringify(request), JSON.stringify(setup), JSON.stringify(version)])
  if (saved.rows.length !== 1) throw new Error("M80 setup write could not be verified.")
  const foundation = await readM80Foundation(tx, companyId)
  const savedVersion = await readM80FoundationVersion(tx, companyId, saved.rows[0]!.record_id)
  if (!foundation || !savedVersion) throw new Error("M80 setup write could not be read back.")
  return { foundation, savedVersion, replayed: saved.rows[0]!.replayed }
}

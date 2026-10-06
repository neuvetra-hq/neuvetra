// Operator-only method release (Claude, 2026-09-30). Takes a reviewed release plan and, in ONE transaction:
// loads each approved register with its original sources, registers each method version exactly as its engine
// describes itself, records the independent reviews, creates the released_beta rows through 0024's
// release_method_version, then reads the releases back and checks every released value against the engine.
// Re-running the same plan changes nothing. Any mismatch throws, and the caller's transaction rolls everything back.
// A withdrawal plan (end of file) is the rollback: it supersedes a current release with a 'withdrawn' row.
// Revision 2 (Codex review of MR1, F1-F3 and P3): an existing method row must equal the engine's description in every
// stored field; a review is only treated as already recorded when every field matches, and before any release the latest
// persisted review of each group must be the plan's own; idempotent receipts report and check the persisted decision,
// operator and lineage; evidence paths are checked after resolving links.
// Never imported by an HTTP entrypoint; the runtime role cannot call any of the 0024 functions this uses.
import { assertEngineMatchesRelease, citedSourceSha256s, loadMethodRegister, readCurrentReleasedMethods, readSourceOriginals, readVerifiedRegister,
  ELECTRICITY_REGISTER_GREENE2025_SHA256, ELECTRICITY_REGISTER_GREENE2025_URL, METHOD_REGISTER_2025_SHA256, METHOD_REGISTER_2025_URL } from './method-reference'
import type { WorkspaceConnection, WorkspaceSql } from './workspace'
import { fileURLToPath } from 'node:url'
import { realpath } from 'node:fs/promises'
import path from 'node:path'

export const METHOD_RELEASE_PLAN_PROFILE = 'neuvetra.method-release-plan.v1'

/** Registers this tool may load: the Scope 1 register (0024) and the Scope 2 eGRID + Green-e register (0026). */
export const RELEASABLE_REGISTERS: Readonly<Record<string, URL>> = {
  [METHOD_REGISTER_2025_SHA256]: METHOD_REGISTER_2025_URL,
  [ELECTRICITY_REGISTER_GREENE2025_SHA256]: ELECTRICITY_REGISTER_GREENE2025_URL,
}

/** What an engine's `describe` action reports for one method version. */
export interface EngineMethodDescription {
  id: string; profileId: string; scope: number; family: string; title: string; formula: string; enginePath: string
  engineSha256: string; registerSha256: string; gwpSetId: string; admissionRules: unknown[]; estimateRules: unknown[]
  reportingPeriod: { start: string; endExclusive: string }; factorKeys: string[]; constantIds: string[]
  factorValues: Record<string, string>; constantValues: Record<string, { value: string; unit: string }>
  [other: string]: unknown
}

export type ReviewerType = 'ai_independent' | 'human_qualified' | 'independent_qa'
export interface MethodReleasePlan {
  profile: typeof METHOD_RELEASE_PLAN_PROFILE
  /** The board decision authorizing this release, and the SHA-256 of that file (the operator CLI rehashes it). */
  decisionReference: string
  decisionFileSha256: string
  releasedBy: string
  /** Who wrote the engines. No review may be recorded under the author's name (independence). */
  methodAuthor: string
  methods: Array<{ methodVersionId: string; engineSha256: string; registerSha256: string; releaseDecisionSha256: string; supersedesLegacyRecordId: string | null }>
  /** Recorded in this order; the last review of each group decides, as in release_method_version. */
  reviews: Array<{ methodVersionIds: string[]; reviewer: string; reviewerType: ReviewerType; reviewedOn: string; verdict: 'pass' | 'fail'; reportPath: string; reportSha256: string; scope: string }>
}

export interface MethodReleaseReceipt {
  registers: Array<{ registerSha256: string; action: 'loaded' | 'already_loaded'; factorSetId: string }>
  methodVersions: Array<{ methodVersionId: string; action: 'registered' | 'already_registered' }>
  reviews: Array<{ methodVersionId: string; reviewer: string; reviewerType: ReviewerType; reportSha256: string; action: 'recorded' | 'already_recorded' }>
  /** Every field is read back from the persisted release row, including on an idempotent re-run. */
  releases: Array<{ methodVersionId: string; profileId: string; releaseId: string; action: 'released' | 'already_released'; supersedesReleaseId: string | null; supersedesLegacyRecordId: string | null; decisionSha256: string; releasedBy: string }>
  verified: Array<{ methodVersionId: string; releaseId: string; factors: number; constants: number }>
}

const HEX64 = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const REVIEWER_TYPES: readonly ReviewerType[] = ['ai_independent', 'human_qualified', 'independent_qa']
const exactKeys = (value: unknown, keys: string[], what: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(','))
    throw new Error(`Method release plan: ${what} must have exactly ${keys.join(', ')}.`)
}
const text = (value: unknown, what: string, max = 2000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Method release plan: ${what} is required.`)
  return value
}

/** Refuses anything but a complete, self-consistent plan: every method has passing method and QA reviews, by someone other than the author. */
export function validateMethodReleasePlan(plan: unknown): MethodReleasePlan {
  exactKeys(plan, ['profile', 'decisionReference', 'decisionFileSha256', 'releasedBy', 'methodAuthor', 'methods', 'reviews'], 'the plan')
  const p = plan as MethodReleasePlan
  if (p.profile !== METHOD_RELEASE_PLAN_PROFILE) throw new Error('Method release plan: unknown profile.')
  text(p.decisionReference, 'decisionReference', 300); text(p.releasedBy, 'releasedBy', 200); text(p.methodAuthor, 'methodAuthor', 200)
  if (!HEX64.test(p.decisionFileSha256)) throw new Error('Method release plan: decisionFileSha256 must be a SHA-256.')
  if (!Array.isArray(p.methods) || p.methods.length < 1 || p.methods.length > 50) throw new Error('Method release plan: methods are required.')
  const ids = new Set<string>()
  for (const m of p.methods) {
    exactKeys(m, ['methodVersionId', 'engineSha256', 'registerSha256', 'releaseDecisionSha256', 'supersedesLegacyRecordId'], 'each method')
    if (!/^[a-z0-9][a-z0-9._-]{2,120}$/.test(m.methodVersionId) || ids.has(m.methodVersionId)) throw new Error(`Method release plan: invalid or repeated method ${m.methodVersionId}.`)
    ids.add(m.methodVersionId)
    if (![m.engineSha256, m.registerSha256, m.releaseDecisionSha256].every(h => HEX64.test(h))) throw new Error(`Method release plan: ${m.methodVersionId} needs engine, register and decision SHA-256s.`)
    if (!RELEASABLE_REGISTERS[m.registerSha256]) throw new Error(`Method release plan: ${m.methodVersionId} cites a register this tool does not release.`)
    if (m.supersedesLegacyRecordId !== null && !UUID.test(m.supersedesLegacyRecordId)) throw new Error(`Method release plan: ${m.methodVersionId} legacy record must be a UUID or null.`)
  }
  if (!Array.isArray(p.reviews)) throw new Error('Method release plan: reviews are required.')
  const author = p.methodAuthor.trim().toLowerCase()
  for (const r of p.reviews) {
    exactKeys(r, ['methodVersionIds', 'reviewer', 'reviewerType', 'reviewedOn', 'verdict', 'reportPath', 'reportSha256', 'scope'], 'each review')
    if (!Array.isArray(r.methodVersionIds) || !r.methodVersionIds.length || r.methodVersionIds.some(id => !ids.has(id))) throw new Error('Method release plan: a review names a method the plan does not release.')
    text(r.reviewer, 'reviewer', 200); text(r.reportPath, 'reportPath', 500); text(r.scope, 'review scope')
    if (r.reviewer.toLowerCase().includes(author)) throw new Error(`Method release plan: ${r.reviewer} wrote these methods and cannot review them.`)
    if (!REVIEWER_TYPES.includes(r.reviewerType)) throw new Error('Method release plan: unknown reviewer type.')
    if (!DATE.test(r.reviewedOn) || !['pass', 'fail'].includes(r.verdict) || !HEX64.test(r.reportSha256)) throw new Error('Method release plan: each review needs a date, a pass/fail verdict and a report SHA-256.')
  }
  for (const id of ids) {
    const last = (types: ReviewerType[]) => { const matching = p.reviews.filter(r => r.methodVersionIds.includes(id) && types.includes(r.reviewerType)); return matching[matching.length - 1]?.verdict }
    if (last(['ai_independent', 'human_qualified']) !== 'pass' || last(['independent_qa']) !== 'pass')
      throw new Error(`Method release plan: ${id} needs a passing method review and a passing independent QA review, each the latest of its kind.`)
  }
  return p
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n')

/**
 * Runs the plan inside the caller's transaction (READ COMMITTED; operator role only). `descriptions` come from the engines'
 * `describe` action; `reports` holds the bytes of every review report the plan cites; `sourcesDir` holds the verified originals.
 */
export async function executeMethodRelease(tx: WorkspaceSql, input: {
  plan: MethodReleasePlan; descriptions: EngineMethodDescription[]; reports: Record<string, Uint8Array>; sourcesDir: string
}): Promise<MethodReleaseReceipt> {
  const plan = validateMethodReleasePlan(input.plan)
  const receipt: MethodReleaseReceipt = { registers: [], methodVersions: [], reviews: [], releases: [], verified: [] }
  // 1. Everything is checked before the first write.
  const described = new Map(input.descriptions.map(d => [d.id, d]))
  for (const m of plan.methods) {
    const d = described.get(m.methodVersionId)
    if (!d) throw new Error(`The engines do not describe ${m.methodVersionId}.`)
    // Engines hash their own raw bytes, so a checkout that converts line endings (Windows core.autocrlf) is refused here.
    if (d.engineSha256 !== m.engineSha256 || d.registerSha256 !== m.registerSha256) throw new Error(`${m.methodVersionId}: the engine on disk (${d.engineSha256.slice(0, 12)}…, register ${d.registerSha256.slice(0, 12)}…) is not the reviewed engine and register. The reviewed bytes use LF line endings; release from a checkout that keeps them.`)
  }
  for (const r of plan.reviews) {
    const bytes = input.reports[r.reportPath]
    if (!bytes) throw new Error(`Review report ${r.reportPath} was not supplied.`)
    if (new Bun.CryptoHasher('sha256').update(bytes).digest('hex') !== r.reportSha256) throw new Error(`Review report ${r.reportPath} does not match its SHA-256.`)
  }
  const isolation = (await tx.query<{ level: string }>("select current_setting('transaction_isolation') level")).rows[0]?.level
  if (isolation !== 'read committed') throw new Error('Method releases must run at READ COMMITTED isolation.')

  // 2. Registers, each with every original it cites (0024 rehashes the text and the originals).
  for (const sha of [...new Set(plan.methods.map(m => m.registerSha256))]) {
    const existing = (await tx.query<{ id: string }>('select id from neuvetra.method_factor_sets where register_sha256=$1', [sha])).rows[0]
    if (existing) { receipt.registers.push({ registerSha256: sha, action: 'already_loaded', factorSetId: existing.id }); continue }
    const register = await readVerifiedRegister(RELEASABLE_REGISTERS[sha]!, sha)
    const id = await loadMethodRegister(tx, register, await readSourceOriginals(input.sourcesDir, citedSourceSha256s(register.text)))
    receipt.registers.push({ registerSha256: sha, action: 'loaded', factorSetId: id })
  }

  // 3. Method versions, exactly as the engine describes them. An existing row must be the same version in every stored
  // field (Codex MR1 F1): 0024 blocks later edits, but not a first row that differs from what was reviewed.
  for (const m of plan.methods) {
    const d = described.get(m.methodVersionId)!
    const exists = (await tx.query('select 1 from neuvetra.method_versions where id=$1', [d.id])).rows.length > 0
    if (exists) {
      const differs = await storedVersionDifferences(tx, d)
      if (differs.length) throw new Error(`${d.id} is already registered with different content: ${differs.join(', ')}.`)
      receipt.methodVersions.push({ methodVersionId: d.id, action: 'already_registered' }); continue
    }
    const { factorValues: _values, factorCells: _cells, constantValues: _constants, ...version } = d
    await tx.query('select neuvetra.register_method_version($1::jsonb)', [JSON.stringify(version)])
    receipt.methodVersions.push({ methodVersionId: d.id, action: 'registered' })
  }

  // 4. Reviews, in plan order. A review counts as already recorded only when a row matches it in every field, for this exact
  // engine and register (Codex MR1 F2); anything else is appended.
  for (const r of plan.reviews) for (const id of r.methodVersionIds) {
    const d = described.get(id)!
    const seen = (await tx.query(`select 1 from neuvetra.method_reviews where method_version_id=$1 and engine_sha256=$2 and register_sha256=$3 and reviewer=$4
        and reviewer_type=$5 and reviewed_on=$6::date and verdict=$7 and report_sha256=$8 and scope=$9`,
      [id, d.engineSha256, d.registerSha256, r.reviewer, r.reviewerType, r.reviewedOn, r.verdict, r.reportSha256, r.scope])).rows.length > 0
    if (!seen) await tx.query('select neuvetra.record_method_review($1::jsonb)', [JSON.stringify({ methodVersionId: id, reviewer: r.reviewer, reviewerType: r.reviewerType, reviewedOn: r.reviewedOn, verdict: r.verdict, reportSha256: r.reportSha256, scope: r.scope })])
    receipt.reviews.push({ methodVersionId: id, reviewer: r.reviewer, reviewerType: r.reviewerType, reportSha256: r.reportSha256, action: seen ? 'already_recorded' : 'recorded' })
  }
  // 4b. 0024 releases on the latest persisted review of each group. That row must be the plan's own latest review of the
  // group, field for field, and not by the author, so the review the tool validated is the review the release relies on.
  const author = plan.methodAuthor.trim().toLowerCase()
  for (const m of plan.methods) {
    const d = described.get(m.methodVersionId)!
    for (const group of [['ai_independent', 'human_qualified'], ['independent_qa']] as const) {
      const matching = plan.reviews.filter(r => r.methodVersionIds.includes(d.id) && (group as readonly string[]).includes(r.reviewerType)), planned = matching[matching.length - 1]!
      const latest = (await tx.query<{ reviewer: string; reviewer_type: string; reviewed_on: string; verdict: string; report_sha256: string; scope: string }>(
        `select reviewer,reviewer_type,to_char(reviewed_on,'YYYY-MM-DD') reviewed_on,verdict,report_sha256,scope from neuvetra.method_reviews
          where method_version_id=$1 and engine_sha256=$2 and register_sha256=$3 and reviewer_type in (${group.map(t => `'${t}'`).join(',')})
          order by review_seq desc limit 1`, [d.id, d.engineSha256, d.registerSha256])).rows[0]
      const same = latest && latest.reviewer === planned.reviewer && latest.reviewer_type === planned.reviewerType && latest.reviewed_on === planned.reviewedOn
        && latest.verdict === planned.verdict && latest.report_sha256 === planned.reportSha256 && latest.scope === planned.scope
      if (!same) throw new Error(`${d.id}: the latest recorded ${group.join(' or ')} review is not the plan's review by ${planned.reviewer}; nothing was released.`)
      if (latest.reviewer.toLowerCase().includes(author)) throw new Error(`${d.id}: the latest recorded review is by the method author; nothing was released.`)
    }
  }

  // 5. Releases through 0024 (which re-checks the reviews, the decision and the chain). Only a profile's first release supersedes its legacy M80 record.
  for (const m of plan.methods) {
    const d = described.get(m.methodVersionId)!
    const latest = await latestReleaseRow(tx, d.profileId)
    if (latest && latest.method_version_id === d.id && latest.status === 'released_beta') {
      // Idempotent only when the persisted release is the one this plan would create (Codex MR1 F3).
      if (latest.decision_sha256 !== m.releaseDecisionSha256 || latest.released_by !== plan.releasedBy || latest.engine_sha256 !== d.engineSha256 || latest.register_sha256 !== d.registerSha256)
        throw new Error(`${d.id} is already released under decision ${latest.decision_sha256.slice(0, 12)}… by ${latest.released_by}; this plan cannot attest that release.`)
      receipt.releases.push({ methodVersionId: d.id, profileId: d.profileId, releaseId: latest.id, action: 'already_released', ...lineage(latest) }); continue
    }
    const supersedesReleaseId = latest?.id ?? null, supersedesLegacyRecordId = latest ? null : m.supersedesLegacyRecordId
    const releaseId = (await tx.query<{ id: string }>('select neuvetra.release_method_version($1::jsonb) id', [JSON.stringify({
      methodVersionId: d.id, status: 'released_beta', supersedesReleaseId, supersedesLegacyRecordId, decisionSha256: m.releaseDecisionSha256, releasedBy: plan.releasedBy })])).rows[0]!.id
    const written = (await tx.query<ReleaseRow>(`${RELEASE_ROW} where m.id=$1`, [releaseId])).rows[0]!
    receipt.releases.push({ methodVersionId: d.id, profileId: d.profileId, releaseId, action: 'released', ...lineage(written) })
  }

  // 6. Read back what a release exposes and check it value for value against the engine (QA F04).
  const current = await readCurrentReleasedMethods(tx)
  for (const m of plan.methods) {
    const d = described.get(m.methodVersionId)!
    const release = current.find(r => r.methodVersionId === d.id)
    if (!release) throw new Error(`${d.id} is not a current release after the release step.`)
    assertEngineMatchesRelease(release, { engineSha256: d.engineSha256, registerSha256: d.registerSha256, factors: d.factorValues, constants: d.constantValues })
    receipt.verified.push({ methodVersionId: d.id, releaseId: release.releaseId, factors: release.factors.length, constants: release.constants.length })
  }
  return receipt
}

/** The stored fields of a method version that differ from the engine's description (empty when it is the same version). */
async function storedVersionDifferences(tx: WorkspaceSql, d: EngineMethodDescription): Promise<string[]> {
  const row = (await tx.query<Record<string, boolean>>(`select v.profile_id=$2 profile_id, v.scope=$3::integer scope, v.family=$4 family, v.title=$5 title,
      v.formula=$6 formula, v.engine_path=$7 engine_path, v.engine_sha256=$8 engine_sha256, v.register_sha256=$9 register_sha256,
      v.factor_set_id=(select f.id from neuvetra.method_factor_sets f where f.register_sha256=$9) factor_set_id, v.gwp_set_id=$10 gwp_set_id,
      v.admission_rules=$11::jsonb admission_rules, v.estimate_rules=$12::jsonb estimate_rules,
      v.reporting_period_start=$13::date reporting_period_start, v.reporting_period_end_exclusive=$14::date reporting_period_end_exclusive
    from neuvetra.method_versions v where v.id=$1`, [d.id, d.profileId, d.scope, d.family, d.title, d.formula, d.enginePath, d.engineSha256, d.registerSha256,
      d.gwpSetId, JSON.stringify(d.admissionRules), JSON.stringify(d.estimateRules), d.reportingPeriod.start, d.reportingPeriod.endExclusive])).rows[0]
  if (!row) return ['row']
  const differs = Object.entries(row).filter(([, same]) => same !== true).map(([field]) => field)
  const factors = (await tx.query<{ factor_key: string }>('select factor_key from neuvetra.method_version_factors where method_version_id=$1', [d.id])).rows.map(r => r.factor_key)
  const constants = (await tx.query<{ constant_id: string }>('select constant_id from neuvetra.method_version_constants where method_version_id=$1', [d.id])).rows.map(r => r.constant_id)
  if (!sameSet(factors, d.factorKeys)) differs.push('factor_keys')
  if (!sameSet(constants, d.constantIds)) differs.push('constant_ids')
  return differs
}

interface ReleaseRow { id: string; method_version_id: string; status: string; decision_sha256: string; released_by: string; supersedes_release_id: string | null; supersedes_legacy_record_id: string | null; engine_sha256: string; register_sha256: string }
const RELEASE_ROW = `select m.id,m.method_version_id,m.status,m.decision_sha256,m.released_by,m.supersedes_release_id,m.supersedes_legacy_record_id,m.engine_sha256,m.register_sha256 from neuvetra.method_releases m`
/** The head of a profile's release chain (the row nothing supersedes), or undefined before its first release. */
const latestReleaseRow = async (tx: WorkspaceSql, profileId: string) => (await tx.query<ReleaseRow>(`${RELEASE_ROW} where m.profile_id=$1
  and not exists(select 1 from neuvetra.method_releases n where n.supersedes_release_id=m.id)`, [profileId])).rows[0]
const lineage = (row: ReleaseRow) => ({ supersedesReleaseId: row.supersedes_release_id, supersedesLegacyRecordId: row.supersedes_legacy_record_id, decisionSha256: row.decision_sha256, releasedBy: row.released_by })

/** The Scope 1 and Scope 2 engines' own descriptions (their `describe` action), read from the checked-out engine files. */
export function describeReleasableEngines(python = process.env.NEUVETRA_PYTHON ?? 'python3'): EngineMethodDescription[] {
  return ['scope1_engine.py', 'scope2_engine.py'].flatMap(name => {
    const engine = fileURLToPath(new URL(`../../../apps/site-api/src/calculation/${name}`, import.meta.url))
    const out = Bun.spawnSync([python, engine], { stdin: new TextEncoder().encode('{"action":"describe"}'), env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } })
    if (out.exitCode !== 0) throw new Error(`${name} describe failed.`)
    return (JSON.parse(out.stdout.toString()) as { description: { methods: EngineMethodDescription[] } }).description.methods
  })
}

/**
 * The operator CLI's entry: reads the plan, the board decision and every review report from disk, and runs the release in one
 * transaction. The operator confirms the decision by typing its SHA-256; it must equal both the file and the plan.
 * Report paths are relative to `evidenceDir` and may not leave it.
 */
export async function releaseMethodsFromFiles(db: WorkspaceConnection, files: {
  planPath: string; decisionPath: string; confirmedDecisionSha256: string; evidenceDir: string; sourcesDir: string; descriptions?: EngineMethodDescription[]
}): Promise<MethodReleaseReceipt> {
  const plan = validateMethodReleasePlan(await Bun.file(files.planPath).json())
  const decision = new Bun.CryptoHasher('sha256').update(await Bun.file(files.decisionPath).bytes()).digest('hex')
  if (decision !== plan.decisionFileSha256) throw new Error('The board decision file does not match the plan.')
  if (files.confirmedDecisionSha256 !== decision) throw new Error('Operator confirmation does not match the board decision.')
  if (!files.sourcesDir) throw new Error('NEUVETRA_METHOD_SOURCES_DIR must hold the verified originals.')
  // Containment is checked on real paths, so a link or junction inside the folder cannot lead outside it (Codex MR1 P3).
  const root = await realpath(path.resolve(files.evidenceDir))
  const reports: Record<string, Uint8Array> = {}
  for (const r of plan.reviews) {
    const full = await realpath(path.resolve(root, r.reportPath)).catch(() => { throw new Error(`Review report ${r.reportPath} was not found in the evidence folder.`) })
    if (!full.startsWith(root + path.sep)) throw new Error(`Review report ${r.reportPath} is outside the evidence folder.`)
    reports[r.reportPath] = await Bun.file(full).bytes()
  }
  const descriptions = files.descriptions ?? describeReleasableEngines()
  return db.transaction(tx => executeMethodRelease(tx, { plan, descriptions, reports, sourcesDir: files.sourcesDir }))
}

// ---------------------------------------------------------------------------------------------------------------------
// Withdrawal (the rollback for a release). A withdrawal is a new 'withdrawn' row that supersedes the current release of
// the profile, through 0024's release_method_version; nothing is deleted or changed. After it, the profile has no current
// release, so results made with that method show as unreleased again. Re-releasing later needs a new release plan.

export const METHOD_WITHDRAWAL_PLAN_PROFILE = 'neuvetra.method-withdrawal-plan.v1'
export interface MethodWithdrawalPlan {
  profile: typeof METHOD_WITHDRAWAL_PLAN_PROFILE
  decisionReference: string
  decisionFileSha256: string
  withdrawnBy: string
  /** Each version must be its profile's current release; the decision is the register's approved release decision. */
  methods: Array<{ methodVersionId: string; releaseDecisionSha256: string }>
}
export interface MethodWithdrawalReceipt {
  /** Read back from the persisted withdrawal row, including on an idempotent re-run. */
  withdrawals: Array<{ methodVersionId: string; profileId: string; action: 'withdrawn' | 'already_withdrawn'; releaseId: string; supersedesReleaseId: string | null; decisionSha256: string; withdrawnBy: string }>
}

export function validateMethodWithdrawalPlan(plan: unknown): MethodWithdrawalPlan {
  exactKeys(plan, ['profile', 'decisionReference', 'decisionFileSha256', 'withdrawnBy', 'methods'], 'the withdrawal plan')
  const p = plan as MethodWithdrawalPlan
  if (p.profile !== METHOD_WITHDRAWAL_PLAN_PROFILE) throw new Error('Method release plan: unknown withdrawal profile.')
  text(p.decisionReference, 'decisionReference', 300); text(p.withdrawnBy, 'withdrawnBy', 200)
  if (!HEX64.test(p.decisionFileSha256)) throw new Error('Method release plan: decisionFileSha256 must be a SHA-256.')
  if (!Array.isArray(p.methods) || p.methods.length < 1 || p.methods.length > 50) throw new Error('Method release plan: methods are required.')
  const ids = new Set<string>()
  for (const m of p.methods) {
    exactKeys(m, ['methodVersionId', 'releaseDecisionSha256'], 'each withdrawn method')
    if (!/^[a-z0-9][a-z0-9._-]{2,120}$/.test(m.methodVersionId) || ids.has(m.methodVersionId) || !HEX64.test(m.releaseDecisionSha256))
      throw new Error(`Method release plan: invalid or repeated withdrawal of ${m.methodVersionId}.`)
    ids.add(m.methodVersionId)
  }
  return p
}

/** Runs a withdrawal plan in the caller's transaction (READ COMMITTED, operator role). Re-running it changes nothing. */
export async function executeMethodWithdrawal(tx: WorkspaceSql, input: { plan: MethodWithdrawalPlan }): Promise<MethodWithdrawalReceipt> {
  const plan = validateMethodWithdrawalPlan(input.plan)
  const isolation = (await tx.query<{ level: string }>("select current_setting('transaction_isolation') level")).rows[0]?.level
  if (isolation !== 'read committed') throw new Error('Method releases must run at READ COMMITTED isolation.')
  const receipt: MethodWithdrawalReceipt = { withdrawals: [] }
  for (const m of plan.methods) {
    const version = (await tx.query<{ profile_id: string }>('select profile_id from neuvetra.method_versions where id=$1', [m.methodVersionId])).rows[0]
    if (!version) throw new Error(`${m.methodVersionId} is not a registered method version.`)
    const latest = await latestReleaseRow(tx, version.profile_id)
    if (latest?.method_version_id === m.methodVersionId && latest.status === 'withdrawn') {
      // Idempotent only when the persisted withdrawal is the one this plan would create (Codex MR1 F3).
      if (latest.decision_sha256 !== m.releaseDecisionSha256 || latest.released_by !== plan.withdrawnBy)
        throw new Error(`${m.methodVersionId} is already withdrawn under decision ${latest.decision_sha256.slice(0, 12)}… by ${latest.released_by}; this plan cannot attest that withdrawal.`)
      receipt.withdrawals.push({ methodVersionId: m.methodVersionId, profileId: version.profile_id, action: 'already_withdrawn', releaseId: latest.id, supersedesReleaseId: latest.supersedes_release_id, decisionSha256: latest.decision_sha256, withdrawnBy: latest.released_by }); continue
    }
    if (!latest || latest.status !== 'released_beta' || latest.method_version_id !== m.methodVersionId)
      throw new Error(`${m.methodVersionId} is not the current release of ${version.profile_id}; nothing was withdrawn.`)
    const releaseId = (await tx.query<{ id: string }>('select neuvetra.release_method_version($1::jsonb) id', [JSON.stringify({
      methodVersionId: m.methodVersionId, status: 'withdrawn', supersedesReleaseId: latest.id, supersedesLegacyRecordId: null, decisionSha256: m.releaseDecisionSha256, releasedBy: plan.withdrawnBy })])).rows[0]!.id
    const written = (await tx.query<ReleaseRow>(`${RELEASE_ROW} where m.id=$1`, [releaseId])).rows[0]!
    receipt.withdrawals.push({ methodVersionId: m.methodVersionId, profileId: version.profile_id, action: 'withdrawn', releaseId, supersedesReleaseId: written.supersedes_release_id, decisionSha256: written.decision_sha256, withdrawnBy: written.released_by })
  }
  // Read back: no withdrawn profile may still have a current release.
  const current = await readCurrentReleasedMethods(tx)
  for (const w of receipt.withdrawals) if (current.some(r => r.profileId === w.profileId)) throw new Error(`${w.profileId} still has a current release after the withdrawal.`)
  return receipt
}

/** The operator CLI's withdrawal entry: the same decision-file and typed-confirmation checks as a release. */
export async function withdrawMethodsFromFiles(db: WorkspaceConnection, files: { planPath: string; decisionPath: string; confirmedDecisionSha256: string }): Promise<MethodWithdrawalReceipt> {
  const plan = validateMethodWithdrawalPlan(await Bun.file(files.planPath).json())
  const decision = new Bun.CryptoHasher('sha256').update(await Bun.file(files.decisionPath).bytes()).digest('hex')
  if (decision !== plan.decisionFileSha256) throw new Error('The board decision file does not match the plan.')
  if (files.confirmedDecisionSha256 !== decision) throw new Error('Operator confirmation does not match the board decision.')
  return db.transaction(tx => executeMethodWithdrawal(tx, { plan }))
}

// The method release tool (Claude, 2026-09-30) against the real engines, registers and source originals on PGlite.
// Revision 2 adds Codex's MR1 reproductions (F1-F3, P3) as regression tests at the end of the file. Revision 3 makes the
// P3 test portable to Windows (directory junctions instead of a file symlink; Codex MR1 r2 N1).
// Needs NEUVETRA_METHOD_SOURCES_DIR, like the other method-reference suites; NEUVETRA_METHOD_SOURCES_REQUIRED=1 makes
// their absence a failure. Review reports here are synthetic stand-ins: the real release cites Codex's reports.
import { beforeAll, describe, expect, test } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import { describeReleasableEngines, executeMethodRelease, executeMethodWithdrawal, releaseMethodsFromFiles, validateMethodReleasePlan, validateMethodWithdrawalPlan, withdrawMethodsFromFiles, RELEASABLE_REGISTERS,
  METHOD_RELEASE_PLAN_PROFILE, METHOD_WITHDRAWAL_PLAN_PROFILE, type EngineMethodDescription, type MethodReleasePlan, type MethodWithdrawalPlan } from './method-release'
import { citedSourceSha256s, loadMethodRegister, readCurrentReleasedMethods, readSourceOriginals, readVerifiedRegister, ELECTRICITY_REGISTER_GREENE2025_SHA256, METHOD_REGISTER_2025_SHA256 } from './method-reference'
import type { WorkspaceConnection, WorkspaceSql } from './workspace'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const SOURCES = process.env.NEUVETRA_METHOD_SOURCES_DIR ?? ''
if (!SOURCES && process.env.NEUVETRA_METHOD_SOURCES_REQUIRED === '1') throw new Error('NEUVETRA_METHOD_SOURCES_REQUIRED=1: set NEUVETRA_METHOD_SOURCES_DIR to the folder holding the verified method source originals.')
if (!SOURCES) console.warn('SKIPPED: method release tool suite. Set NEUVETRA_METHOD_SOURCES_DIR to the verified source originals to run it; required before any method release.')
const TIMEOUT_MS = 300_000
const MIGRATIONS = new URL('./migrations/', import.meta.url)
const LATER = ['0024_method_reference.sql', '0025_scope3_method_reference.sql', '0026_scope2_residual_mix.sql', '0027_collection.sql']
const user = '24400000-0000-4000-8000-000000000001', company = '24400000-0000-4000-8000-000000000002'
// Decisions already bound to each register by 0024 and 0026.
const SCOPE1_DECISION = '6c0d52b56e63651afe2d80a70a5c3dd9b5bb85e9f917137df3d4a6ae0a50a9c6', SCOPE2_DECISION = '1960499ec1a6872b3eda5d684149e1e59d66a34a57a1eb920993bbc6ef5e5236'
const LEGACY: Record<string, string> = {
  'scope1.stationary.natural_gas.v2': '81000000-0000-4000-8000-000000000001', 'scope1.mobile.onroad_diesel.v2': '81000000-0000-4000-8000-000000000002',
  'scope1.stationary.distillate_no2.v2': '81000000-0000-4000-8000-000000000003', 'scope1.fugitive.material_balance.v2': '81000000-0000-4000-8000-000000000004',
}
const RELEASING = ['scope1.stationary.natural_gas.v2', 'scope1.stationary.distillate_no2.v2', 'scope1.mobile.onroad_diesel.v2', 'scope1.mobile.onroad_gasoline.v2', 'scope1.fugitive.material_balance.v2', 'scope2.electricity.egrid2023_greene2025.v3']

async function database() {
  const db = new PGlite()
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
    alter table storage.objects enable row level security; grant usage on schema storage to authenticated,anon; grant select,insert on storage.objects to authenticated,anon;`)
  const manifest = (await readMigrationManifest()).filter(m => m.name < '0028')
  for (const m of manifest) await db.exec(m.sql)
  for (const name of LATER) if (!manifest.some(m => m.name === name)) await db.exec(await Bun.file(new URL(name, MIGRATIONS)).text())
  await db.query('insert into auth.users values($1)', [user])
  await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Release','US','CA',$2)", [company, user])
  await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [company, user])
  await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [user, company])
  return db
}
const operator = (tx: { query: PGlite['query']; exec: PGlite['exec'] }): WorkspaceSql => ({ query: async (s, a) => ({ rows: (await tx.query(s, a)).rows as never[] }), exec: async s => { await tx.exec(s) } })
const bytes = (s: string) => new TextEncoder().encode(s)
const sha = (b: Uint8Array) => new Bun.CryptoHasher('sha256').update(b).digest('hex')
const REPORTS: Record<string, Uint8Array> = {
  'notes/reviews/method-review.md': bytes('Synthetic stand-in for the release-candidate method review (test only).\n'),
  'notes/reviews/integrated-qa.md': bytes('Synthetic stand-in for the release-candidate integrated QA (test only).\n'),
}
function plan(descriptions: EngineMethodDescription[], change: (p: MethodReleasePlan) => void = () => {}): MethodReleasePlan {
  const p: MethodReleasePlan = {
    profile: METHOD_RELEASE_PLAN_PROFILE, decisionReference: 'notes/decisions/draft-method-release.md', decisionFileSha256: 'd'.repeat(64),
    releasedBy: 'Codex (operator) for Nima (board, release owner)', methodAuthor: 'Claude',
    methods: RELEASING.map(id => {
      const d = descriptions.find(x => x.id === id)!
      return { methodVersionId: id, engineSha256: d.engineSha256, registerSha256: d.registerSha256, releaseDecisionSha256: d.scope === 1 ? SCOPE1_DECISION : SCOPE2_DECISION, supersedesLegacyRecordId: LEGACY[id] ?? null }
    }),
    reviews: [
      { methodVersionIds: [...RELEASING], reviewer: 'Codex (release-candidate method review)', reviewerType: 'ai_independent', reviewedOn: '2026-10-01', verdict: 'pass', reportPath: 'notes/reviews/method-review.md', reportSha256: sha(REPORTS['notes/reviews/method-review.md']!), scope: 'Test stand-in' },
      { methodVersionIds: [...RELEASING], reviewer: 'Codex (integrated QA)', reviewerType: 'independent_qa', reviewedOn: '2026-10-01', verdict: 'pass', reportPath: 'notes/reviews/integrated-qa.md', reportSha256: sha(REPORTS['notes/reviews/integrated-qa.md']!), scope: 'Test stand-in' },
    ],
  }
  change(p)
  return p
}
const failure = (promise: Promise<unknown>) => promise.then(() => null, (error: Error) => error.message)
const counts = async (db: PGlite) => (await db.query<Record<string, number>>(`select (select count(*)::int from neuvetra.method_factor_sets) sets,(select count(*)::int from neuvetra.method_versions) versions,
  (select count(*)::int from neuvetra.method_reviews) reviews,(select count(*)::int from neuvetra.method_releases) releases,(select count(*)::int from neuvetra.method_reference_audit) audit`)).rows[0]!

describe('plan validation (no database)', () => {
  const d = [{ id: 'scope1.stationary.natural_gas.v2', scope: 1, engineSha256: 'a'.repeat(64), registerSha256: METHOD_REGISTER_2025_SHA256 },
    ...RELEASING.slice(1).map(id => ({ id, scope: id.startsWith('scope2') ? 2 : 1, engineSha256: 'a'.repeat(64), registerSha256: id.startsWith('scope2') ? ELECTRICITY_REGISTER_GREENE2025_SHA256 : METHOD_REGISTER_2025_SHA256 }))] as EngineMethodDescription[]
  test('a complete plan passes; every gap is refused', () => {
    expect(() => validateMethodReleasePlan(plan(d))).not.toThrow()
    const refused: [string, (p: MethodReleasePlan) => void, RegExp][] = [
      ['no QA review', p => { p.reviews = p.reviews.filter(r => r.reviewerType !== 'independent_qa') }, /passing method review and a passing independent QA/],
      ['no method review', p => { p.reviews = p.reviews.filter(r => r.reviewerType === 'independent_qa') }, /passing method review/],
      ['latest review fails', p => { p.reviews.push({ ...p.reviews[1]!, verdict: 'fail' }) }, /latest of its kind/],
      ['review by the author', p => { p.reviews[0]!.reviewer = 'Claude (self-check)' }, /wrote these methods/],
      ['unknown register', p => { p.methods[0]!.registerSha256 = 'e'.repeat(64) }, /register this tool does not release/],
      ['repeated method', p => { p.methods.push({ ...p.methods[0]! }) }, /invalid or repeated/],
      ['extra field', p => { (p as unknown as Record<string, unknown>).force = true }, /exactly/],
      ['review of a method not in the plan', p => { p.reviews[0]!.methodVersionIds.push('scope3.waste.v1') }, /does not release/],
    ]
    for (const [label, change, message] of refused) expect([label, (() => { try { validateMethodReleasePlan(plan(d, change)); return 'accepted' } catch (e) { return (e as Error).message } })()]).toEqual([label, expect.stringMatching(message)])
  })
})

describe.skipIf(!SOURCES)('method release tool with the real engines, registers and originals', () => {
  let descriptions: EngineMethodDescription[]
  beforeAll(() => { descriptions = describeReleasableEngines() })

  test('releases the six Scope 1 and 2 method versions, checks every value, and a re-run changes nothing', async () => {
    const db = await database()
    try {
      expect(descriptions.map(d => d.id).sort()).toEqual([...RELEASING].sort())
      const first = await db.transaction(tx => executeMethodRelease(operator(tx), { plan: plan(descriptions), descriptions, reports: REPORTS, sourcesDir: SOURCES }))
      expect(first.registers.map(r => [r.registerSha256, r.action])).toEqual([[METHOD_REGISTER_2025_SHA256, 'loaded'], [ELECTRICITY_REGISTER_GREENE2025_SHA256, 'loaded']])
      expect(first.methodVersions.every(m => m.action === 'registered')).toBe(true)
      expect(first.reviews).toHaveLength(12)
      expect(first.releases.map(r => [r.methodVersionId, r.action, r.supersedesLegacyRecordId])).toEqual(RELEASING.map(id => [id, 'released', LEGACY[id] ?? null]))
      expect(first.verified.map(v => [v.methodVersionId, v.factors])).toEqual([
        ['scope1.stationary.natural_gas.v2', 6], ['scope1.stationary.distillate_no2.v2', 7], ['scope1.mobile.onroad_diesel.v2', 20],
        ['scope1.mobile.onroad_gasoline.v2', 234], ['scope1.fugitive.material_balance.v2', 6], ['scope2.electricity.egrid2023_greene2025.v3', 138]])
      // The runtime role sees exactly these six releases and their values.
      const runtime = await db.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user]); await tx.exec('set local role neuvetra_runtime')
        return readCurrentReleasedMethods(operator(tx))
      })
      expect(runtime.map(r => r.methodVersionId).sort()).toEqual([...RELEASING].sort())
      expect(runtime.every(r => r.outputLabel === 'Draft — prepared with Neuvetra beta methods; not externally assured')).toBe(true)
      // The M80 held records are superseded by reference, never changed.
      expect((await db.query<{ status: string }>("select distinct status from neuvetra.scope1_beta_release_records")).rows).toEqual([{ status: 'held_candidate' }])
      const before = await counts(db)
      const again = await db.transaction(tx => executeMethodRelease(operator(tx), { plan: plan(descriptions), descriptions, reports: REPORTS, sourcesDir: SOURCES }))
      expect([...new Set([...again.registers, ...again.methodVersions, ...again.reviews, ...again.releases].map(x => x.action))].sort()).toEqual(['already_loaded', 'already_recorded', 'already_registered', 'already_released'])
      expect(await counts(db)).toEqual(before)
    } finally { await db.close() }
  }, TIMEOUT_MS)

  test('refuses before writing anything, and a failure part-way rolls the whole release back', async () => {
    const db = await database()
    try {
      const empty = await counts(db)
      const run = (p: MethodReleasePlan, reports = REPORTS) => failure(db.transaction(tx => executeMethodRelease(operator(tx), { plan: p, descriptions, reports, sourcesDir: SOURCES })))
      expect(await run(plan(descriptions, p => { p.methods[5]!.engineSha256 = 'b'.repeat(64) }))).toMatch(/not the reviewed engine/)
      expect(await run(plan(descriptions), { ...REPORTS, 'notes/reviews/integrated-qa.md': bytes('edited after review\n') })).toMatch(/does not match its SHA-256/)
      expect(await run(plan(descriptions), { 'notes/reviews/method-review.md': REPORTS['notes/reviews/method-review.md']! })).toMatch(/was not supplied/)
      expect(await counts(db)).toEqual(empty)
      // Scope 2 cites Scope 1's decision: 0024 refuses the sixth release, after five succeeded in the same transaction.
      expect(await run(plan(descriptions, p => { p.methods[5]!.releaseDecisionSha256 = SCOPE1_DECISION }))).toMatch(/release decision is not approved for this register/)
      expect(await counts(db)).toEqual(empty)
      // A method version already registered is compared with the engine's description, never overwritten.
      const firstOnly = plan(descriptions, p => { p.methods = p.methods.slice(0, 1); p.reviews.forEach(r => { r.methodVersionIds = [p.methods[0]!.methodVersionId] }) })
      expect(await run(firstOnly)).toBeNull()
      const altered = descriptions.map(d => d.id === 'scope1.stationary.natural_gas.v2' ? { ...d, factorKeys: d.factorKeys.slice(1) } : d)
      expect(await failure(db.transaction(tx => executeMethodRelease(operator(tx), { plan: firstOnly, descriptions: altered, reports: REPORTS, sourcesDir: SOURCES })))).toMatch(/already registered with different content/)
    } finally { await db.close() }
  }, TIMEOUT_MS)

  test('the operator entry checks the decision file, the typed confirmation and the report paths, then releases', async () => {
    const db = await database(), dir = await mkdtemp(path.join(tmpdir(), 'method-release-'))
    try {
      const connection: WorkspaceConnection = { ...operator(db), transaction: fn => db.transaction(tx => fn(operator(tx))), close: async () => {} }
      const decision = bytes('Synthetic stand-in for the board release decision (test only).\n')
      await writeFile(path.join(dir, 'decision.md'), decision)
      await mkdir(path.join(dir, 'evidence', 'notes', 'reviews'), { recursive: true })
      for (const [name, content] of Object.entries(REPORTS)) await writeFile(path.join(dir, 'evidence', name), content)
      const write = async (p: MethodReleasePlan) => { await writeFile(path.join(dir, 'plan.json'), JSON.stringify(p)); return path.join(dir, 'plan.json') }
      const good = plan(descriptions, p => { p.decisionFileSha256 = sha(decision) })
      const files = { decisionPath: path.join(dir, 'decision.md'), confirmedDecisionSha256: sha(decision), evidenceDir: path.join(dir, 'evidence'), sourcesDir: SOURCES, descriptions }
      expect(await failure(releaseMethodsFromFiles(connection, { ...files, planPath: await write(plan(descriptions)) }))).toMatch(/decision file does not match the plan/)
      expect(await failure(releaseMethodsFromFiles(connection, { ...files, planPath: await write(good), confirmedDecisionSha256: 'c'.repeat(64) }))).toMatch(/Operator confirmation does not match/)
      const escaping = plan(descriptions, p => { p.decisionFileSha256 = sha(decision); p.reviews[0]!.reportPath = '../decision.md' })
      expect(await failure(releaseMethodsFromFiles(connection, { ...files, planPath: await write(escaping) }))).toMatch(/outside the evidence folder/)
      expect((await counts(db)).versions).toBe(0)
      const receipt = await releaseMethodsFromFiles(connection, { ...files, planPath: await write(good) })
      expect(receipt.releases.map(r => r.action)).toEqual(RELEASING.map(() => 'released'))
    } finally { await db.close(); await rm(dir, { recursive: true, force: true }) }
  }, TIMEOUT_MS)

  test('a withdrawal supersedes the current release without changing it, is idempotent, and a later release can restore it', async () => {
    const db = await database(), dir = await mkdtemp(path.join(tmpdir(), 'method-withdrawal-'))
    try {
      const connection: WorkspaceConnection = { ...operator(db), transaction: fn => db.transaction(tx => fn(operator(tx))), close: async () => {} }
      const current = async () => (await db.transaction(tx => readCurrentReleasedMethods(operator(tx)))).map(r => r.methodVersionId).sort()
      const withdrawal = (change: (p: MethodWithdrawalPlan) => void = () => {}): MethodWithdrawalPlan => {
        const p: MethodWithdrawalPlan = { profile: METHOD_WITHDRAWAL_PLAN_PROFILE, decisionReference: 'notes/decisions/draft-withdrawal.md', decisionFileSha256: 'd'.repeat(64), withdrawnBy: 'Codex (operator) for Nima (board)',
          methods: [{ methodVersionId: 'scope1.stationary.natural_gas.v2', releaseDecisionSha256: SCOPE1_DECISION }, { methodVersionId: 'scope2.electricity.egrid2023_greene2025.v3', releaseDecisionSha256: SCOPE2_DECISION }] }
        change(p); return p
      }
      const run = (p: MethodWithdrawalPlan) => failure(db.transaction(tx => executeMethodWithdrawal(operator(tx), { plan: p })))
      expect(await run(withdrawal())).toMatch(/not a registered method version/)
      await db.transaction(tx => executeMethodRelease(operator(tx), { plan: plan(descriptions), descriptions, reports: REPORTS, sourcesDir: SOURCES }))
      const released = await db.query<Record<string, unknown>>('select * from neuvetra.method_releases order by id')
      expect(() => validateMethodWithdrawalPlan(withdrawal(p => { p.methods.push({ ...p.methods[0]! }) }))).toThrow(/invalid or repeated/)
      // The Scope 2 row cites Scope 1's decision: 0024 refuses it, and the natural gas withdrawal before it rolls back too.
      expect(await run(withdrawal(p => { p.methods[1]!.releaseDecisionSha256 = SCOPE1_DECISION }))).toMatch(/release decision is not approved for this register/)
      expect(await current()).toEqual([...RELEASING].sort())
      // Through the operator entry: decision file, typed confirmation, then the withdrawal.
      const decision = bytes('Synthetic stand-in for a board withdrawal decision (test only).\n')
      await writeFile(path.join(dir, 'decision.md'), decision)
      const good = withdrawal(p => { p.decisionFileSha256 = sha(decision) })
      await writeFile(path.join(dir, 'withdrawal.json'), JSON.stringify(good))
      const files = { planPath: path.join(dir, 'withdrawal.json'), decisionPath: path.join(dir, 'decision.md'), confirmedDecisionSha256: sha(decision) }
      expect(await failure(withdrawMethodsFromFiles(connection, { ...files, confirmedDecisionSha256: 'c'.repeat(64) }))).toMatch(/Operator confirmation does not match/)
      const receipt = await withdrawMethodsFromFiles(connection, files)
      expect(receipt.withdrawals.map(w => w.action)).toEqual(['withdrawn', 'withdrawn'])
      expect(await current()).toEqual(RELEASING.filter(id => !['scope1.stationary.natural_gas.v2', 'scope2.electricity.egrid2023_greene2025.v3'].includes(id)).sort())
      // Nothing was changed: the release rows are exactly as before, plus two 'withdrawn' rows that supersede them.
      const after = await db.query<Record<string, unknown>>('select * from neuvetra.method_releases order by id')
      expect(after.rows.filter(r => released.rows.some(b => b.id === r.id))).toEqual(released.rows)
      expect(after.rows.filter(r => r.status === 'withdrawn').map(r => r.supersedes_release_id).sort()).toEqual(receipt.withdrawals.map(w => w.supersedesReleaseId).sort())
      expect((await withdrawMethodsFromFiles(connection, files)).withdrawals.map(w => w.action)).toEqual(['already_withdrawn', 'already_withdrawn'])
      // Withdrawing a registered version that is not its profile's current release is refused.
      const { factorValues: _values, factorCells: _cells, constantValues: _constants, ...other } = descriptions.find(d => d.id === 'scope1.mobile.onroad_diesel.v2')!
      await db.query('select neuvetra.register_method_version($1::jsonb)', [JSON.stringify({ ...other, id: 'scope1.mobile.onroad_diesel.v9' })])
      expect(await run(withdrawal(p => { p.methods = [{ methodVersionId: 'scope1.mobile.onroad_diesel.v9', releaseDecisionSha256: SCOPE1_DECISION }] }))).toMatch(/not the current release of scope1\.mobile\.onroad_diesel/)
      expect(await current()).toEqual(['scope1.fugitive.material_balance.v2', 'scope1.mobile.onroad_diesel.v2', 'scope1.mobile.onroad_gasoline.v2', 'scope1.stationary.distillate_no2.v2'])
      // The same release plan restores both; the restored rows supersede the withdrawn ones.
      const restored = await db.transaction(tx => executeMethodRelease(operator(tx), { plan: plan(descriptions), descriptions, reports: REPORTS, sourcesDir: SOURCES }))
      expect(restored.releases.filter(r => r.action === 'released').map(r => r.methodVersionId).sort()).toEqual(['scope1.stationary.natural_gas.v2', 'scope2.electricity.egrid2023_greene2025.v3'])
      expect(restored.releases.filter(r => r.action === 'released').every(r => r.supersedesReleaseId !== null && r.supersedesLegacyRecordId === null)).toBe(true)
      expect(await current()).toEqual([...RELEASING].sort())
    } finally { await db.close(); await rm(dir, { recursive: true, force: true }) }
  }, TIMEOUT_MS)

  // ---- Revision 2: Codex's MR1 review reproductions (F1-F3, P3), now refused or reported correctly ----
  const only = (ids: string[]) => (p: MethodReleasePlan) => { p.methods = p.methods.filter(m => ids.includes(m.methodVersionId)); p.reviews.forEach(r => { r.methodVersionIds = [...ids] }) }
  /** Loads the registers and registers the given versions directly (as a pre-existing row), optionally altered. */
  async function preRegister(db: PGlite, ids: string[], alter: (version: Record<string, unknown>) => void = () => {}) {
    await db.transaction(async tx => {
      const t = operator(tx)
      for (const sha of new Set(ids.map(id => descriptions.find(d => d.id === id)!.registerSha256))) {
        if ((await t.query('select 1 from neuvetra.method_factor_sets where register_sha256=$1', [sha])).rows.length) continue
        const register = await readVerifiedRegister(RELEASABLE_REGISTERS[sha]!, sha)
        await loadMethodRegister(t, register, await readSourceOriginals(SOURCES, citedSourceSha256s(register.text)))
      }
      for (const id of ids) {
        const { factorValues: _values, factorCells: _cells, constantValues: _constants, ...version } = descriptions.find(d => d.id === id)!
        alter(version)
        await t.query('select neuvetra.register_method_version($1::jsonb)', [JSON.stringify(version)])
      }
    })
  }
  const releaseCount = async (db: PGlite) => (await db.query<{ n: number }>('select count(*)::int n from neuvetra.method_releases')).rows[0]!.n

  test('F1: a pre-existing row that differs from the engine description in any stored field is refused before any release', async () => {
    const db = await database()
    try {
      const run = (ids: string[]) => failure(db.transaction(tx => executeMethodRelease(operator(tx), { plan: plan(descriptions, only(ids)), descriptions, reports: REPORTS, sourcesDir: SOURCES })))
      await preRegister(db, ['scope1.stationary.natural_gas.v2'], v => { v.formula = 'TAMPERED FORMULA' })
      expect(await run(['scope1.stationary.natural_gas.v2'])).toMatch(/already registered with different content: formula\./)
      await preRegister(db, ['scope1.stationary.distillate_no2.v2'], v => { v.admissionRules = [...(v.admissionRules as string[]), 'Anything goes']; v.estimateRules = [] })
      expect(await run(['scope1.stationary.distillate_no2.v2'])).toMatch(/different content: admission_rules, estimate_rules\./)
      await preRegister(db, ['scope1.mobile.onroad_diesel.v2'], v => { v.title = 'Another title'; v.reportingPeriod = { start: '2025-01-01', endExclusive: '2027-01-01' } })
      expect(await run(['scope1.mobile.onroad_diesel.v2'])).toMatch(/different content: title, reporting_period_end_exclusive\./)
      expect([await releaseCount(db), (await counts(db)).reviews]).toEqual([0, 0])
      // A pre-existing row that is exactly the described version is accepted.
      await preRegister(db, ['scope1.mobile.onroad_gasoline.v2'])
      const ok = await db.transaction(tx => executeMethodRelease(operator(tx), { plan: plan(descriptions, only(['scope1.mobile.onroad_gasoline.v2'])), descriptions, reports: REPORTS, sourcesDir: SOURCES }))
      expect([ok.methodVersions[0]!.action, ok.releases[0]!.action]).toEqual(['already_registered', 'released'])
    } finally { await db.close() }
  }, TIMEOUT_MS)

  test('F2: an author review row cannot stand in for the plan review; the release relies on the plan reviewer', async () => {
    const id = 'scope1.stationary.natural_gas.v2', p = plan(descriptions, only([id])), codex = p.reviews[0]!
    const record = (db: PGlite, reviewer: string) => db.query('select neuvetra.record_method_review($1::jsonb)', [JSON.stringify({ methodVersionId: id, reviewer, reviewerType: codex.reviewerType, reviewedOn: codex.reviewedOn, verdict: codex.verdict, reportSha256: codex.reportSha256, scope: codex.scope })])
    const latestMethodReviewer = async (db: PGlite) => (await db.query<{ reviewer: string }>(`select reviewer from neuvetra.method_reviews where method_version_id=$1 and reviewer_type in ('ai_independent','human_qualified') order by review_seq desc limit 1`, [id])).rows[0]!.reviewer
    // Codex's reproduction: the author's row with the same type, report, verdict, date and scope was already recorded.
    const first = await database()
    try {
      await preRegister(first, [id]); await record(first, 'Claude (method author)')
      const receipt = await first.transaction(tx => executeMethodRelease(operator(tx), { plan: p, descriptions, reports: REPORTS, sourcesDir: SOURCES }))
      expect(receipt.reviews.find(r => r.reviewerType === 'ai_independent')).toMatchObject({ reviewer: codex.reviewer, action: 'recorded' })
      expect(receipt.releases[0]!.action).toBe('released')
      expect(await latestMethodReviewer(first)).toBe(codex.reviewer)
    } finally { await first.close() }
    // An exact plan review followed by a later author row: the latest persisted review is not the plan's, so nothing is released.
    const second = await database()
    try {
      await preRegister(second, [id]); await record(second, codex.reviewer); await record(second, 'Claude (method author)')
      expect(await failure(second.transaction(tx => executeMethodRelease(operator(tx), { plan: p, descriptions, reports: REPORTS, sourcesDir: SOURCES })))).toMatch(/latest recorded ai_independent or human_qualified review is not the plan's review by Codex/)
      expect(await releaseCount(second)).toBe(0)
    } finally { await second.close() }
  }, TIMEOUT_MS)

  test('F3: idempotent re-runs report the persisted decision, operator and lineage, and refuse a plan that cannot attest them', async () => {
    const db = await database(), id = 'scope1.stationary.natural_gas.v2'
    try {
      const release = (change: (p: MethodReleasePlan) => void = () => {}) => db.transaction(tx => executeMethodRelease(operator(tx), { plan: plan(descriptions, p => { only([id])(p); change(p) }), descriptions, reports: REPORTS, sourcesDir: SOURCES }))
      const first = (await release()).releases[0]!
      const again = (await release()).releases[0]!
      expect(again).toEqual({ ...first, action: 'already_released' })
      expect([again.supersedesLegacyRecordId, again.decisionSha256, again.releasedBy]).toEqual([LEGACY[id], SCOPE1_DECISION, 'Codex (operator) for Nima (board, release owner)'])
      expect(await failure(release(p => { p.releasedBy = 'Someone else' }))).toMatch(/already released under decision 6c0d52b56e63… by Codex \(operator\) for Nima \(board, release owner\); this plan cannot attest/)
      expect(await failure(release(p => { p.methods[0]!.releaseDecisionSha256 = 'e'.repeat(64) }))).toMatch(/this plan cannot attest that release/)
      const withdrawal = (withdrawnBy: string) => db.transaction(tx => executeMethodWithdrawal(operator(tx), { plan: { profile: METHOD_WITHDRAWAL_PLAN_PROFILE, decisionReference: 'test', decisionFileSha256: 'd'.repeat(64), withdrawnBy, methods: [{ methodVersionId: id, releaseDecisionSha256: SCOPE1_DECISION }] } }))
      const withdrawn = (await withdrawal('Codex (operator)')).withdrawals[0]!
      expect([withdrawn.action, withdrawn.supersedesReleaseId, withdrawn.decisionSha256, withdrawn.withdrawnBy]).toEqual(['withdrawn', first.releaseId, SCOPE1_DECISION, 'Codex (operator)'])
      expect((await withdrawal('Codex (operator)')).withdrawals[0]).toEqual({ ...withdrawn, action: 'already_withdrawn' })
      expect(await failure(withdrawal('Someone else'))).toMatch(/already withdrawn under decision 6c0d52b56e63… by Codex \(operator\); this plan cannot attest/)
    } finally { await db.close() }
  }, TIMEOUT_MS)

  test('P3: a link inside the evidence folder that resolves outside it is refused, even with the right bytes', async () => {
    // Directory junctions need no special rights on Windows (file symlinks do: EPERM, Codex MR1 r2 N1). Elsewhere the
    // 'junction' type is ignored and a directory symlink is made, so the same links are tested on every platform.
    const db = await database(), dir = await mkdtemp(path.join(tmpdir(), 'method-release-link-'))
    try {
      const connection: WorkspaceConnection = { ...operator(db), transaction: fn => db.transaction(tx => fn(operator(tx))), close: async () => {} }
      const decision = bytes('Synthetic stand-in for the board release decision (test only).\n')
      const reviews = path.join(dir, 'evidence', 'notes', 'reviews')
      await writeFile(path.join(dir, 'decision.md'), decision)
      await mkdir(reviews, { recursive: true })
      await writeFile(path.join(reviews, 'integrated-qa.md'), REPORTS['notes/reviews/integrated-qa.md']!)
      // The method review, with the right bytes, in a folder outside the evidence folder and in one inside it.
      for (const folder of [path.join(dir, 'outside'), path.join(reviews, 'inside')]) {
        await mkdir(folder, { recursive: true })
        await writeFile(path.join(folder, 'method-review.md'), REPORTS['notes/reviews/method-review.md']!)
      }
      await symlink(path.join(dir, 'outside'), path.join(reviews, 'escape'), 'junction')
      await symlink(path.join(reviews, 'inside'), path.join(reviews, 'alias'), 'junction')
      const files = { planPath: path.join(dir, 'plan.json'), decisionPath: path.join(dir, 'decision.md'), confirmedDecisionSha256: sha(decision), evidenceDir: path.join(dir, 'evidence'), sourcesDir: SOURCES, descriptions }
      const release = async (reportPath: string) => {
        await writeFile(files.planPath, JSON.stringify(plan(descriptions, p => { p.decisionFileSha256 = sha(decision); p.reviews[0]!.reportPath = reportPath })))
        return releaseMethodsFromFiles(connection, files)
      }
      // Through a link that leads outside: refused, although the bytes match the plan's SHA-256.
      expect(await failure(release('notes/reviews/escape/method-review.md'))).toMatch(/escape\/method-review\.md is outside the evidence folder/)
      // A report that is not there is named as missing.
      expect(await failure(release('notes/reviews/missing.md'))).toMatch(/missing\.md was not found in the evidence folder/)
      expect((await counts(db)).versions).toBe(0)
      // Through a link that stays inside: accepted, so the refusal above is about where the link leads.
      expect((await release('notes/reviews/alias/method-review.md')).releases.map(r => r.action)).toEqual(RELEASING.map(() => 'released'))
    } finally { await db.close(); await rm(dir, { recursive: true, force: true }) }
  }, TIMEOUT_MS)
})

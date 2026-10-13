// MR2 (Claude, 2026-09-30): how the Results route reads method releases. WorkspaceDatabase.findCurrentMethodReleases runs
// as the runtime role (as the hosted connection does), sees releases only for a user with staging access, and returns
// values that equal the running engines' own (the check the route makes before calling a method released). Releases
// come from the MR1 release tool. Needs NEUVETRA_METHOD_SOURCES_DIR, like the other method-reference suites;
// NEUVETRA_METHOD_SOURCES_REQUIRED=1 makes its absence a failure. Review reports here are synthetic stand-ins.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import { WorkspaceDatabase, type WorkspaceConnection, type WorkspaceSql } from './workspace'
import { describeReleasableEngines, executeMethodRelease, executeMethodWithdrawal, METHOD_RELEASE_PLAN_PROFILE, METHOD_WITHDRAWAL_PLAN_PROFILE, type EngineMethodDescription, type MethodReleasePlan } from './method-release'
import { assertEngineMatchesRelease } from './method-reference'

const SOURCES = process.env.NEUVETRA_METHOD_SOURCES_DIR ?? ''
if (!SOURCES && process.env.NEUVETRA_METHOD_SOURCES_REQUIRED === '1') throw new Error('NEUVETRA_METHOD_SOURCES_REQUIRED=1: set NEUVETRA_METHOD_SOURCES_DIR to the folder holding the verified method source originals.')
if (!SOURCES) console.warn('SKIPPED: runtime method-release read suite. Set NEUVETRA_METHOD_SOURCES_DIR to the verified source originals to run it.')
const TIMEOUT_MS = 300_000
const MIGRATIONS = new URL('./migrations/', import.meta.url)
const LATER = ['0024_method_reference.sql', '0025_scope3_method_reference.sql', '0026_scope2_residual_mix.sql', '0027_collection.sql']
const user = '77000000-0000-4000-8000-0000000000a1', outsider = '77000000-0000-4000-8000-0000000000a2', company = '77000000-0000-4000-8000-000000000001'
const SCOPE1_DECISION = '6c0d52b56e63651afe2d80a70a5c3dd9b5bb85e9f917137df3d4a6ae0a50a9c6', SCOPE2_DECISION = '1960499ec1a6872b3eda5d684149e1e59d66a34a57a1eb920993bbc6ef5e5236'
const LEGACY: Record<string, string> = { 'scope1.stationary.natural_gas.v2': '81000000-0000-4000-8000-000000000001', 'scope1.mobile.onroad_diesel.v2': '81000000-0000-4000-8000-000000000002', 'scope1.stationary.distillate_no2.v2': '81000000-0000-4000-8000-000000000003', 'scope1.fugitive.material_balance.v2': '81000000-0000-4000-8000-000000000004' }
const RELEASING = ['scope1.stationary.natural_gas.v2', 'scope1.stationary.distillate_no2.v2', 'scope1.mobile.onroad_diesel.v2', 'scope1.mobile.onroad_gasoline.v2', 'scope1.fugitive.material_balance.v2', 'scope2.electricity.egrid2023_greene2025.v3']
const bytes = (s: string) => new TextEncoder().encode(s)
const sha = (b: Uint8Array) => new Bun.CryptoHasher('sha256').update(b).digest('hex')
const REPORTS = { 'method-review.md': bytes('Synthetic stand-in for the method review (test only).\n'), 'integrated-qa.md': bytes('Synthetic stand-in for the integrated QA (test only).\n') }
const wrap = (tx: { query: PGlite['query']; exec: PGlite['exec'] }): WorkspaceSql => ({ query: async (s, a) => ({ rows: (await tx.query(s, a)).rows as never[] }), exec: async s => { await tx.exec(s) } })
/** The hosted runtime logs in as neuvetra_runtime; this connection does the same inside each PGlite transaction. */
const runtimeConnection = (db: PGlite): WorkspaceConnection => ({ ...wrap(db), transaction: fn => db.transaction(async tx => { await tx.exec('set local role neuvetra_runtime'); return fn(wrap(tx)) }), close: async () => {} })
class RuntimeDatabase extends WorkspaceDatabase { constructor(db: WorkspaceConnection) { super(db) } }

describe.skipIf(!SOURCES)('runtime read of method releases for Results (MR2)', () => {
  let db: PGlite, runtime: RuntimeDatabase, descriptions: EngineMethodDescription[]
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      create schema storage; create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
      alter table storage.objects enable row level security; grant usage on schema storage to authenticated,anon; grant select,insert on storage.objects to authenticated,anon;`)
    const manifest = (await readMigrationManifest()).filter(m => m.name < '0028')
    for (const m of manifest) await db.exec(m.sql)
    for (const name of LATER) if (!manifest.some(m => m.name === name)) await db.exec(await Bun.file(new URL(name, MIGRATIONS)).text())
    for (const id of [user, outsider]) await db.query('insert into auth.users values($1)', [id])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Release','US','CA',$2)", [company, user])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [company, user])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [user, company])
    runtime = new RuntimeDatabase(runtimeConnection(db))
    descriptions = describeReleasableEngines()
  }, TIMEOUT_MS)
  afterAll(async () => { await db?.close() })

  test('no release yet, then six releases whose values equal the running engines, for a user with staging access only', async () => {
    expect(await runtime.findCurrentMethodReleases(user)).toEqual([])
    const plan: MethodReleasePlan = { profile: METHOD_RELEASE_PLAN_PROFILE, decisionReference: 'test', decisionFileSha256: 'd'.repeat(64), releasedBy: 'Codex (operator)', methodAuthor: 'Claude',
      methods: RELEASING.map(id => { const d = descriptions.find(x => x.id === id)!; return { methodVersionId: id, engineSha256: d.engineSha256, registerSha256: d.registerSha256, releaseDecisionSha256: d.scope === 1 ? SCOPE1_DECISION : SCOPE2_DECISION, supersedesLegacyRecordId: LEGACY[id] ?? null } }),
      reviews: [
        { methodVersionIds: [...RELEASING], reviewer: 'Codex (method review)', reviewerType: 'ai_independent', reviewedOn: '2026-10-01', verdict: 'pass', reportPath: 'method-review.md', reportSha256: sha(REPORTS['method-review.md']), scope: 'Test stand-in' },
        { methodVersionIds: [...RELEASING], reviewer: 'Codex (integrated QA)', reviewerType: 'independent_qa', reviewedOn: '2026-10-01', verdict: 'pass', reportPath: 'integrated-qa.md', reportSha256: sha(REPORTS['integrated-qa.md']), scope: 'Test stand-in' }] }
    await db.transaction(tx => executeMethodRelease(wrap(tx), { plan, descriptions, reports: REPORTS, sourcesDir: SOURCES }))
    const current = await runtime.findCurrentMethodReleases(user)
    expect(current.map(r => r.methodVersionId).sort()).toEqual([...RELEASING].sort())
    expect(current.every(r => r.outputLabel === 'Draft — prepared with Neuvetra beta methods; not externally assured')).toBe(true)
    // The route's release check: each release equals what the running engine describes, value for value.
    for (const release of current) {
      const d = descriptions.find(x => x.id === release.methodVersionId)!
      expect(() => assertEngineMatchesRelease(release, { engineSha256: d.engineSha256, registerSha256: d.registerSha256, factors: d.factorValues, constants: d.constantValues })).not.toThrow()
    }
    // Row-level security: a signed-in user without staging access reads no release.
    expect(await runtime.findCurrentMethodReleases(outsider)).toEqual([])
  }, TIMEOUT_MS)

  test('a withdrawn method is no longer a current release', async () => {
    await db.transaction(tx => executeMethodWithdrawal(wrap(tx), { plan: { profile: METHOD_WITHDRAWAL_PLAN_PROFILE, decisionReference: 'test', decisionFileSha256: 'd'.repeat(64), withdrawnBy: 'Codex (operator)',
      methods: [{ methodVersionId: 'scope2.electricity.egrid2023_greene2025.v3', releaseDecisionSha256: SCOPE2_DECISION }] } }))
    expect((await runtime.findCurrentMethodReleases(user)).map(r => r.methodVersionId).sort()).toEqual(RELEASING.filter(id => !id.startsWith('scope2')).sort())
  }, TIMEOUT_MS)

  test('the read needs the runtime role: the authenticated role (asUser) cannot read the release store', async () => {
    const denied = await db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user]); await tx.exec('set local role authenticated')
      return tx.query('select count(*) from neuvetra.method_current_releases').then(() => 'read', (error: Error) => error.message)
    })
    expect(denied).toMatch(/permission denied/)
  })
})

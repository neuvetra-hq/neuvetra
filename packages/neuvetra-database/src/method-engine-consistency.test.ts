import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { fileURLToPath } from 'node:url'
import { readMigrationManifest } from './staging-migrations'
import { assertEngineMatchesRelease, citedSourceSha256s, loadMethodRegister, readCurrentReleasedMethods, readSourceOriginals, readVerifiedRegister, METHOD_REFERENCE_MIGRATION, SCOPE3_METHOD_MIGRATION,
  RESIDUAL_MIX_METHOD_MIGRATION, ELECTRICITY_REGISTER_GREENE2025_SHA256, ELECTRICITY_REGISTER_GREENE2025_URL, SCOPE3_REGISTER_2025_SHA256, SCOPE3_REGISTER_2025_URL } from './method-reference'
import type { WorkspaceSql } from './workspace'

// The engine's own description is registered, reviewed and released; the runtime then reads back
// exactly the released values, and each must equal what the engine uses. Closes decisions §6.3.
// fileURLToPath, not URL.pathname: on Windows .pathname gives /C:/... which Python cannot open (QA note).
const ENGINES = ['scope1_engine.py', 'scope2_engine.py', 'scope3_engine.py'].map(f => fileURLToPath(new URL(`../../../apps/site-api/src/calculation/${f}`, import.meta.url)))
const DECISION: Record<string, string> = {
  f5351cd375a54072c03061dc3fab6740bed1cf78e05db9de575dca7f2d5c0c02: '6c0d52b56e63651afe2d80a70a5c3dd9b5bb85e9f917137df3d4a6ae0a50a9c6',
  [ELECTRICITY_REGISTER_GREENE2025_SHA256]: '1960499ec1a6872b3eda5d684149e1e59d66a34a57a1eb920993bbc6ef5e5236',
  [SCOPE3_REGISTER_2025_SHA256]: '4ae9f2250963975723e5a5f48786d4d1fb7972a21f37de3302dfd10fda5d1ec2',
}
// Needs the verified source originals to load the registers. Skipped, and says so, when they are absent (CI);
// NEUVETRA_METHOD_SOURCES_REQUIRED=1 (release gates) makes their absence a failure.
const SOURCES = process.env.NEUVETRA_METHOD_SOURCES_DIR ?? ''
if (!SOURCES && process.env.NEUVETRA_METHOD_SOURCES_REQUIRED === '1') throw new Error('NEUVETRA_METHOD_SOURCES_REQUIRED=1: set NEUVETRA_METHOD_SOURCES_DIR to the folder holding the verified method source originals.')
if (!SOURCES) console.warn('SKIPPED: engine and released database values agree. Set NEUVETRA_METHOD_SOURCES_DIR to the verified source originals to run it; required before any method release.')
const LEGACY: Record<string, string> = {
  'scope1.stationary.natural_gas': '81000000-0000-4000-8000-000000000001',
  'scope1.mobile.onroad_diesel': '81000000-0000-4000-8000-000000000002',
  'scope1.stationary.distillate_no2': '81000000-0000-4000-8000-000000000003',
  'scope1.fugitive': '81000000-0000-4000-8000-000000000004',
}
const user = '24300000-0000-4000-8000-000000000001', company = '24300000-0000-4000-8000-000000000002'
type Method = { id: string; profileId: string; engineSha256: string; registerSha256: string; factorValues: Record<string, string>; constantValues: Record<string, { value: string; unit: string }>; [k: string]: unknown }

describe.skipIf(!SOURCES)('engine and released database values agree', () => {
  let db: PGlite, methods: Method[]
  beforeAll(async () => {
    methods = ENGINES.flatMap(engine => {
      // UTF-8 on every platform, as method-engine-runner.ts does (Codex v5 run: Windows Python defaulted to a legacy code page).
      const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', engine], { stdin: new TextEncoder().encode('{"action":"describe"}'), env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } })
      expect(p.exitCode).toBe(0)
      return JSON.parse(p.stdout.toString()).description.methods as Method[]
    })
    db = new PGlite()
    await db.exec(`create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
    for (const m of (await readMigrationManifest()).slice(0, 23)) await db.exec(m.sql)
    for (const m of [METHOD_REFERENCE_MIGRATION, SCOPE3_METHOD_MIGRATION, RESIDUAL_MIX_METHOD_MIGRATION]) await db.exec(await Bun.file(new URL(`./migrations/${m}`, import.meta.url)).text())
    await db.query('insert into auth.users values($1)', [user])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic C','US','CA',$2)", [company, user])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [company, user])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [user, company])
    const operator: WorkspaceSql = { query: async (s, a) => ({ rows: (await db.query(s, a)).rows as never[] }), exec: async s => { await db.exec(s) } }
    for (const register of [await readVerifiedRegister(), await readVerifiedRegister(ELECTRICITY_REGISTER_GREENE2025_URL, ELECTRICITY_REGISTER_GREENE2025_SHA256),
      await readVerifiedRegister(SCOPE3_REGISTER_2025_URL, SCOPE3_REGISTER_2025_SHA256)])
      await loadMethodRegister(operator, register, await readSourceOriginals(SOURCES, citedSourceSha256s(register.text)))
    for (const m of methods) {
      const { factorValues: _values, factorCells: _cells, constantValues: _constants, ...version } = m
      await db.query('select neuvetra.register_method_version($1::jsonb)', [JSON.stringify(version)])
      for (const reviewerType of ['ai_independent', 'independent_qa'])
        await db.query('select neuvetra.record_method_review($1::jsonb)', [JSON.stringify({ methodVersionId: m.id, reviewer: 'test', reviewerType, reviewedOn: '2026-09-27', verdict: 'pass', reportSha256: 'e'.repeat(64), scope: 'consistency test' })])
      await db.query('select neuvetra.release_method_version($1::jsonb)', [JSON.stringify({ methodVersionId: m.id, status: 'released_beta', supersedesReleaseId: null, supersedesLegacyRecordId: LEGACY[m.profileId] ?? null, decisionSha256: DECISION[m.registerSha256], releasedBy: 'test' })])
    }
  }, 60000)
  afterAll(async () => { await db?.close() })

  test('every released factor equals the engine value, read as the runtime role', async () => {
    const released = await db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user]); await tx.exec('set local role neuvetra_runtime')
      return readCurrentReleasedMethods({ query: async (s, a) => ({ rows: (await tx.query(s, a)).rows as never[] }), exec: async s => { await tx.exec(s) } } satisfies WorkspaceSql)
    })
    expect(released.map(r => r.methodVersionId).sort()).toEqual(methods.map(m => m.id).sort())
    for (const r of released) {
      const m = methods.find(x => x.id === r.methodVersionId)!
      expect(() => assertEngineMatchesRelease(r, { engineSha256: m.engineSha256, registerSha256: m.registerSha256, factors: m.factorValues, constants: m.constantValues })).not.toThrow()
    }
    expect(released.reduce((n, r) => n + r.factors.length, 0)).toBe(6 + 7 + 234 + 20 + 6 + 138 + 90 + 24 + 183 + 39 + 30)
    expect(released.reduce((n, r) => n + r.constants.length, 0)).toBe(methods.reduce((n, m) => n + Object.keys(m.constantValues).length, 0))
    // Each release lists only the GWPs it links (re-review P3-2), even when releases share a register.
    expect(released.find(r => r.methodVersionId === 'scope1.stationary.natural_gas.v2')!.gwp.map(g => g.gas)).toEqual(['CH4', 'CO2', 'N2O'])
    expect(released.find(r => r.methodVersionId === 'scope1.fugitive.material_balance.v2')!.gwp.map(g => g.gas)).toEqual(['HFC-134a', 'HFC-227ea', 'R-404A', 'R-407C', 'R-410A', 'R-507A'])
    expect(released.filter(r => r.scope === 3).map(r => [r.family, r.gwpSetId, r.gwp.length])).toEqual([
      ['fuel_energy_related', 'AR5-100', 3], ['transportation_distribution', 'AR5-100', 3], ['waste', 'AR4-100', 0], ['business_travel', 'AR5-100', 3], ['employee_commuting', 'AR5-100', 3]])
    expect(released.find(r => r.methodVersionId === 'scope2.electricity.egrid2023_greene2025.v3')?.scope).toBe(2)
    expect((await db.query<{ n: number }>('select count(*)::int n from neuvetra.method_releases where supersedes_legacy_record_id is not null')).rows[0]!.n).toBe(4)
  })
})

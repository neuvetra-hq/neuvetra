import { beforeAll, afterAll, describe, test, expect } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import { readVerifiedRegister, loadMethodRegister, readSourceOriginals, citedSourceSha256s, ELECTRICITY_REGISTER_EGRID2023_SHA256, ELECTRICITY_REGISTER_EGRID2023_URL, ELECTRICITY_REGISTER_GREENE2025_SHA256, ELECTRICITY_REGISTER_GREENE2025_URL, SCOPE3_REGISTER_2025_SHA256, SCOPE3_REGISTER_2025_URL, readCurrentReleasedMethods, assertEngineMatchesRelease, sameDecimal, METHOD_REGISTER_2025_SHA256, METHOD_REFERENCE_MIGRATION, SCOPE3_METHOD_MIGRATION, RESIDUAL_MIX_METHOD_MIGRATION, BETA_OUTPUT_LABEL, type VerifiedRegister } from './method-reference'
import type { WorkspaceSql } from './workspace'

const admitted = '24100000-0000-4000-8000-000000000001', outsider = '24100000-0000-4000-8000-000000000002'
const company = '24200000-0000-4000-8000-000000000001'
const DECISION = '6c0d52b56e63651afe2d80a70a5c3dd9b5bb85e9f917137df3d4a6ae0a50a9c6'
const SCOPE3_DECISION = '4ae9f2250963975723e5a5f48786d4d1fb7972a21f37de3302dfd10fda5d1ec2'
// QA F03: loading needs the verified originals (EPA Hub workbook, eGRID2023 rev2 workbook). Point this at the
// private copies, e.g. research-sources/2026-09-08 or a private-bucket download.
// Without them this suite is skipped and says so (CI has no originals yet). A release gate sets
// NEUVETRA_METHOD_SOURCES_REQUIRED=1, which turns a missing folder back into a failure, as F03 intended.
const SOURCES = process.env.NEUVETRA_METHOD_SOURCES_DIR ?? ''
if (!SOURCES && process.env.NEUVETRA_METHOD_SOURCES_REQUIRED === '1') throw new Error('NEUVETRA_METHOD_SOURCES_REQUIRED=1: set NEUVETRA_METHOD_SOURCES_DIR to the folder holding the verified method source originals.')
if (!SOURCES) console.warn('SKIPPED: method reference store suite (0024-0026). Set NEUVETRA_METHOD_SOURCES_DIR to the verified source originals to run it; required before any method release.')
const originals = async (register: VerifiedRegister) => readSourceOriginals(SOURCES, citedSourceSha256s(register.text))
const ENGINE = 'a'.repeat(64), REPORT = 'b'.repeat(64)
const NEW_TABLES = ['method_source_documents','method_source_copies','method_register_approvals','method_release_decisions','method_legacy_supersessions','method_factor_sets','method_factor_values','method_gwp_sets','method_gwp_values','method_constants','method_versions','method_version_factors','method_version_constants','method_reviews','method_releases','method_reference_audit']
const NG_KEYS = ['stationary.Natural Gas.co2','stationary.Natural Gas.ch4','stationary.Natural Gas.n2o','gwp_ar5.CO2','gwp_ar5.CH4','gwp_ar5.N2O']

describe.skipIf(!SOURCES)('method reference store (migration 0024)', () => {
  let db: PGlite, legacy: Awaited<ReturnType<typeof snapshot>>
  const sql = (tx: { query: PGlite['query']; exec: PGlite['exec'] }): WorkspaceSql => ({ query: async (s, a = []) => ({ rows: (await tx.query(s, a)).rows as never[] }), exec: async s => { await tx.exec(s) } })
  const asUser = <T>(actor: string, op: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]); await tx.exec('set local role neuvetra_runtime'); return op(sql(tx))
  })
  const snapshot = async () => {
    const tables = (await db.query<{ tablename: string }>("select tablename from pg_tables where schemaname='neuvetra' and tablename not like 'method\\_%' order by tablename")).rows
    const out: Record<string, unknown[]> = {}
    for (const { tablename } of tables) out[tablename] = (await db.query(`select to_jsonb(t) r from neuvetra.${tablename} t order by to_jsonb(t)::text`)).rows
    const triggers = (await db.query("select tgrelid::regclass::text rel,tgname from pg_trigger where tgrelid::regclass::text like 'neuvetra.%' and tgrelid::regclass::text not like 'neuvetra.method\\_%' order by 1,2")).rows
    return { ...out, __triggers: triggers }
  }
  const version = (id: string, keys = NG_KEYS, profile = 'scope1.stationary.natural_gas') => ({
    id, profileId: profile, scope: 1, family: 'stationary_combustion', title: 'Natural gas (HHV)', formula: 'kg CO2e = MMBtu x (CO2 + CH4/1000 x GWP_CH4 + N2O/1000 x GWP_N2O)',
    enginePath: 'apps/site-api/src/calculation/scope1/stationary_combustion.py', engineSha256: ENGINE, registerSha256: METHOD_REGISTER_2025_SHA256, gwpSetId: 'AR5-100',
    admissionRules: ['therm or MMBtu HHV'], estimateRules: [], reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, factorKeys: keys, constantIds: ['therm_to_mmbtu'],
  })
  const review = (id: string, reviewerType: string, verdict = 'pass') => ({ methodVersionId: id, reviewer: reviewerType === 'independent_qa' ? 'Codex QA' : 'Claude', reviewerType, reviewedOn: '2026-09-27', verdict, reportSha256: REPORT, scope: 'test' })
  const release = (id: string, supersedesReleaseId: string | null = null, status = 'released_beta', supersedesLegacyRecordId: string | null = null) =>
    ({ methodVersionId: id, status, supersedesReleaseId, supersedesLegacyRecordId, decisionSha256: DECISION, releasedBy: 'Nima (board)' })
  const call = (fn: string, v: unknown) => db.query(`select neuvetra.${fn}($1::jsonb) r`, [JSON.stringify(v)])

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    const migrations = await readMigrationManifest()
    expect(migrations).toHaveLength(27)
    for (const m of migrations.slice(0, 23)) await db.exec(m.sql)
    await db.query('insert into auth.users values($1),($2)', [admitted, outsider])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic A','US','CA',$2)", [company, admitted])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [company, admitted])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [admitted, company])
    legacy = await snapshot()
    for (const m of [METHOD_REFERENCE_MIGRATION, SCOPE3_METHOD_MIGRATION, RESIDUAL_MIX_METHOD_MIGRATION]) await db.exec(await Bun.file(new URL(`./migrations/${m}`, import.meta.url)).text())
  }, 60000)
  afterAll(async () => { await db?.close() })

  test('is additive: legacy rows and triggers unchanged, every new table forces RLS, runtime cannot write', async () => {
    expect(await snapshot()).toEqual(legacy)
    const rls = (await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>('select relname,relrowsecurity,relforcerowsecurity from pg_class where relnamespace=\'neuvetra\'::regnamespace and relname=any($1)', [NEW_TABLES])).rows
    expect(rls).toHaveLength(NEW_TABLES.length)
    expect(rls.every(r => r.relrowsecurity && r.relforcerowsecurity)).toBe(true)
    const writes = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relname like 'method\\_%'
      and c.relkind in('r','v') and (has_table_privilege('neuvetra_runtime',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT'))`)).rows
    expect(writes).toEqual([])
    for (const seq of ['method_reference_audit_id_seq', 'method_review_seq'])
      expect((await db.query<{ ok: boolean }>(`select has_sequence_privilege('neuvetra_runtime','neuvetra.${seq}','USAGE,SELECT,UPDATE') ok`)).rows[0]?.ok).toBe(false)
    for (const fn of ['load_method_register(text,bytea[])', 'register_method_version(jsonb)', 'release_method_version(jsonb)', 'record_method_review(jsonb)']) {
      expect((await db.query<{ ok: boolean }>(`select has_function_privilege('neuvetra_runtime','neuvetra.${fn}','EXECUTE') ok`)).rows[0]?.ok).toBe(false)
      expect((await db.query<{ ok: boolean }>(`select has_function_privilege('authenticated','neuvetra.${fn}','EXECUTE') ok`)).rows[0]?.ok).toBe(false)
    }
    expect((await db.query<{ n: number }>('select count(*)::int n from neuvetra.scope1_beta_release_records')).rows[0]?.n).toBe(4)
  })

  test('loads only the approved register bytes with its verified original workbook, exactly once, every value equal to the file', async () => {
    const register = await readVerifiedRegister()
    expect(register.sha256).toBe(METHOD_REGISTER_2025_SHA256)
    const hub = await originals(register)
    // The Hub workbook, plus EPA's stationary combustion guidance cited by the therm constant.
    expect(citedSourceSha256s(register.text)).toEqual(['43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7', '9e9899f728932125543d85f97f71f11d4928580e7ca17ae9858f4c34d0a9c124'])
    const tampered = register.text.replace('"53.06"', '"53.07"')
    await expect(db.query("select neuvetra.load_method_register($1,'{}'::bytea[])", [tampered])).rejects.toThrow(/not approved/)
    await expect(asUser(admitted, tx => tx.query("select neuvetra.load_method_register($1,'{}'::bytea[])", [register.text]))).rejects.toThrow()
    // QA F03: no original, or an altered original, blocks the load before anything is inserted.
    await expect(loadMethodRegister(sql(db), register, [])).rejects.toThrow(/original missing/)
    await expect(db.query("select neuvetra.load_method_register($1,'{}'::bytea[])", [register.text])).rejects.toThrow(/source original missing or altered/)
    const altered = Buffer.from(hub[0]!); altered[1000] = altered[1000]! ^ 1
    const guidance = Buffer.from(hub[1]!)
    await expect(db.query('select neuvetra.load_method_register($1,array[$2::bytea,$3::bytea])', [register.text, altered, guidance])).rejects.toThrow(/source original missing or altered/)
    await expect(db.query('select neuvetra.load_method_register($1,array[$2::bytea,$3::bytea])', [register.text, Buffer.from(hub[0]!.subarray(0, hub[0]!.length - 1)), guidance])).rejects.toThrow(/source original missing or altered/)
    await expect(db.query('select neuvetra.load_method_register($1,array[$2::bytea])', [register.text, Buffer.from(hub[0]!)])).rejects.toThrow(/source original missing or altered: 9e9899f7/)
    expect((await db.query('select 1 from neuvetra.method_factor_sets')).rows).toHaveLength(0)
    const setId = await loadMethodRegister(sql(db), register, hub)
    await expect(loadMethodRegister(sql(db), register, hub)).rejects.toThrow(/already loaded/)
    const file = JSON.parse(register.text) as { entries: Array<{ id: string; value: string; valueCell: string; unit: string }>; constants: Array<{ id: string; value: string }> }
    const rows = (await db.query<{ factor_key: string; value_text: string; value_cell: string; unit: string }>('select factor_key,value_text,value_cell,unit from neuvetra.method_factor_values where factor_set_id=$1', [setId])).rows
    expect(rows).toHaveLength(265)
    const byKey = new Map(rows.map(r => [r.factor_key, r]))
    for (const e of file.entries) expect(byKey.get(e.id)).toEqual({ factor_key: e.id, value_text: e.value, value_cell: e.valueCell, unit: e.unit })
    expect((await db.query('select gas,value_text from neuvetra.method_gwp_values order by gas')).rows).toEqual([
      { gas: 'CH4', value_text: '28' }, { gas: 'CO2', value_text: '1' }, { gas: 'HFC-134a', value_text: '1300' }, { gas: 'HFC-227ea', value_text: '3350' }, { gas: 'N2O', value_text: '265' },
      { gas: 'R-404A', value_text: '3943' }, { gas: 'R-407C', value_text: '1624' }, { gas: 'R-410A', value_text: '1924' }, { gas: 'R-507A', value_text: '3985' }])
    expect((await db.query('select id,value_text from neuvetra.method_constants order by id')).rows).toEqual(file.constants.map(c => ({ id: c.id, value_text: c.value })).sort((a, b) => a.id < b.id ? -1 : 1))
  })

  test('loads the eGRID register with per-entry sources: rates cite eGRID, GWPs cite the Hub workbook', async () => {
    const electricity = await readVerifiedRegister(ELECTRICITY_REGISTER_EGRID2023_URL, ELECTRICITY_REGISTER_EGRID2023_SHA256)
    const both = await originals(electricity)
    expect(both).toHaveLength(2)
    await expect(loadMethodRegister(sql(db), electricity, both.slice(1))).rejects.toThrow(/original missing/)
    const setId = await loadMethodRegister(sql(db), electricity, both)
    const rows = (await db.query<{ source: string; n: number }>('select source_document_sha256 source,count(*)::int n from neuvetra.method_factor_values where factor_set_id=$1 group by 1 order by 1', [setId])).rows
    expect(rows).toEqual([{ source: '43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7', n: 3 }, { source: '895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6', n: 81 }])
    expect((await db.query<{ value_text: string; value_cell: string }>("select value_text,value_cell from neuvetra.method_factor_values where factor_set_id=$1 and factor_key='egrid2023.CAMX.co2'", [setId])).rows).toEqual([{ value_text: '428.464', value_cell: 'W6' }])
    const bad = electricity.text.replace('"sourceSha256": "43afb91d', '"sourceSha256": "53afb91d')
    await expect(db.query("select neuvetra.load_method_register($1,'{}'::bytea[])", [bad])).rejects.toThrow(/not approved/)
  })

  test('loads the eGRID + Green-e residual-mix register (0026): residual inputs cite the saved Green-e page, eGRID rows unchanged', async () => {
    const register = await readVerifiedRegister(ELECTRICITY_REGISTER_GREENE2025_URL, ELECTRICITY_REGISTER_GREENE2025_SHA256)
    const page = (await db.query<{ sha256: string }>("select sha256 from neuvetra.method_source_documents where media_type='text/html'")).rows
    expect(page).toHaveLength(1)
    expect(citedSourceSha256s(register.text)).toEqual(['43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7', '895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6', page[0]!.sha256].sort())
    const setId = await loadMethodRegister(sql(db), register, await originals(register))
    const rows = (await db.query<{ source: string; n: number }>('select source_document_sha256 source,count(*)::int n from neuvetra.method_factor_values where factor_set_id=$1 group by 1 order by 2', [setId])).rows
    expect(rows.map(r => r.n)).toEqual([3, 54, 81])
    expect((await db.query<{ factor_key: string; value_text: string }>("select factor_key,value_text from neuvetra.method_factor_values where factor_set_id=$1 and factor_key like 'residual_mix_green_e_2025.CAMX.%' order by 1", [setId])).rows)
      .toEqual([{ factor_key: 'residual_mix_green_e_2025.CAMX.net_generation_mwh', value_text: '220986983' }, { factor_key: 'residual_mix_green_e_2025.CAMX.voluntary_re_mwh', value_text: '2155596' }])
    expect((await db.query<{ scope: number }>('select scope from neuvetra.method_register_approvals where register_sha256=$1', [ELECTRICITY_REGISTER_GREENE2025_SHA256])).rows).toEqual([{ scope: 2 }])
  })

  test('loads the Scope 3 register: 20-decimal stored value kept exactly, eGRID rows cite eGRID, scope 3 families only', async () => {
    const scope3 = await readVerifiedRegister(SCOPE3_REGISTER_2025_URL, SCOPE3_REGISTER_2025_SHA256)
    const setId = await loadMethodRegister(sql(db), scope3, await originals(scope3))
    const rows = (await db.query<{ source: string; n: number }>('select source_document_sha256 source,count(*)::int n from neuvetra.method_factor_values where factor_set_id=$1 group by 1 order by 1', [setId])).rows
    expect(rows).toEqual([{ source: '43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7', n: 243 }, { source: '895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6', n: 87 }])
    expect((await db.query("select value_text,value_cell from neuvetra.method_factor_values where factor_set_id=$1 and factor_key in('waste.asphalt_concrete.recycled','egrid2023_ggl.western') order by factor_key", [setId])).rows)
      .toEqual([{ value_text: '0.041', value_cell: 'F7' }, { value_text: '0.0035205384954666674', value_cell: 'D490' }])
    expect((await db.query<{ id: string; value_text: string }>('select id,value_text from neuvetra.method_constants where register_sha256=$1 order by id', [SCOPE3_REGISTER_2025_SHA256])).rows.map(r => r.id))
      .toEqual(['g_to_kg', 'km_per_mile', 'kwh_to_mwh', 'lb_per_short_ton', 'lb_to_kg', 'metric_ton_to_kg'])
    const base = { ...version('scope3.cat6.test.v1', ['travel.bus.passenger_mile.co2'], 'scope3.cat6.test'), scope: 3, registerSha256: SCOPE3_REGISTER_2025_SHA256, constantIds: ['g_to_kg'] }
    await expect(call('register_method_version', base)).rejects.toThrow(/check/)
    await expect(call('register_method_version', { ...base, family: 'business_travel', scope: 1 })).rejects.toThrow(/check/)
    await expect(call('register_method_version', { ...base, family: 'business_travel', gwpSetId: 'AR6-100' })).rejects.toThrow(/foreign key/)
    // Re-review P2-2: each register is approved for one scope, so its release decision cannot release another scope's method.
    await expect(call('register_method_version', { ...base, family: 'business_travel', registerSha256: METHOD_REGISTER_2025_SHA256, factorKeys: ['gwp_ar5.CO2'] })).rejects.toThrow(/foreign key/)
    await expect(call('register_method_version', { ...version('scope1.stationary.natural_gas.s3', ['gwp_ar5.CO2']), registerSha256: SCOPE3_REGISTER_2025_SHA256, constantIds: ['g_to_kg'] })).rejects.toThrow(/foreign key/)
    // A valid scope 3 version registers; rolled back so the later tests see only their own versions.
    await expect(db.transaction(async tx => {
      await tx.query('select neuvetra.register_method_version($1::jsonb)', [JSON.stringify({ ...base, family: 'business_travel' })])
      throw new Error('registered, rolling back')
    })).rejects.toThrow('registered, rolling back')
    expect((await db.query('select 1 from neuvetra.method_versions')).rows).toHaveLength(0)
  })

  test('runtime sees citations, but factor values only after a reviewed release exposes them', async () => {
    const before = await asUser(admitted, async tx => ({
      sources: (await tx.query('select sha256 from neuvetra.method_source_documents')).rows.length,
      factors: (await tx.query('select 1 from neuvetra.method_factor_values')).rows.length,
      copies: await tx.exec('savepoint s').then(() => tx.query('select 1 from neuvetra.method_source_copies')).then(() => 'allowed', (e: Error) => e.message).finally(() => tx.exec('rollback to savepoint s')),
    }))
    expect(before.sources).toBe(10)
    expect(before.factors).toBe(0)
    expect(before.copies).toMatch(/permission denied/)
    await call('register_method_version', version('scope1.stationary.natural_gas.v2'))
    await expect(call('release_method_version', release('scope1.stationary.natural_gas.v2'))).rejects.toThrow(/passing method and QA/)
    await call('record_method_review', review('scope1.stationary.natural_gas.v2', 'ai_independent'))
    await expect(call('release_method_version', release('scope1.stationary.natural_gas.v2'))).rejects.toThrow(/passing method and QA/)
    await call('record_method_review', review('scope1.stationary.natural_gas.v2', 'independent_qa'))
    await expect(call('release_method_version', release('scope1.stationary.natural_gas.v2', null, 'released_beta', '24000000-0000-4000-8000-000000000001'))).rejects.toThrow(/held candidate/)
    // Re-review P3-1: another profile's held record (fugitive ...04) cannot be consumed by this profile.
    await expect(call('release_method_version', release('scope1.stationary.natural_gas.v2', null, 'released_beta', '81000000-0000-4000-8000-000000000004'))).rejects.toThrow(/held candidate this profile replaces/)
    // QA F06: a syntactically valid but unapproved decision, or a decision approved only for another register, is refused.
    await expect(call('release_method_version', { ...release('scope1.stationary.natural_gas.v2'), decisionSha256: '0'.repeat(64) })).rejects.toThrow(/not approved for this register/)
    await expect(call('release_method_version', { ...release('scope1.stationary.natural_gas.v2'), decisionSha256: SCOPE3_DECISION })).rejects.toThrow(/not approved for this register/)
    await call('release_method_version', release('scope1.stationary.natural_gas.v2', null, 'released_beta', '81000000-0000-4000-8000-000000000001'))
    const visible = await asUser(admitted, tx => readCurrentReleasedMethods(tx))
    expect(visible).toHaveLength(1)
    expect(visible[0]!.outputLabel).toBe(BETA_OUTPUT_LABEL)
    expect(visible[0]!.factors.map(f => f.key).sort()).toEqual([...NG_KEYS].sort())
    expect(visible[0]!.factors.find(f => f.key === 'stationary.Natural Gas.co2')).toMatchObject({ value: '53.06', cell: 'E38' })
    expect(visible[0]!.constants).toEqual([{ id: 'therm_to_mmbtu', value: '0.1', unit: 'MMBtu per therm' }])
    expect((await asUser(admitted, tx => tx.query('select 1 from neuvetra.method_factor_values'))).rows).toHaveLength(NG_KEYS.length)
    expect((await asUser(outsider, tx => tx.query('select 1 from neuvetra.method_factor_values'))).rows).toHaveLength(0)
    expect((await asUser(outsider, tx => tx.query('select 1 from neuvetra.method_source_documents'))).rows).toHaveLength(0)
    expect((await asUser(admitted, tx => tx.query<{ gas: string }>('select gas from neuvetra.method_gwp_values order by gas'))).rows.map(r => r.gas)).toEqual(['CH4', 'CO2', 'N2O'])
    const engineFactors = Object.fromEntries(visible[0]!.factors.map(f => [f.key, f.value === '1' ? '1.0' : f.value]))
    const constants = { therm_to_mmbtu: { value: '0.10', unit: 'MMBtu per therm' } }
    const engine = { engineSha256: ENGINE, registerSha256: METHOD_REGISTER_2025_SHA256, factors: engineFactors, constants }
    expect(() => assertEngineMatchesRelease(visible[0]!, engine)).not.toThrow()
    expect(() => assertEngineMatchesRelease(visible[0]!, { ...engine, factors: { ...engineFactors, 'stationary.Natural Gas.co2': '53.07' } })).toThrow()
    expect(() => assertEngineMatchesRelease(visible[0]!, { ...engine, engineSha256: 'c'.repeat(64) })).toThrow()
    // QA F04: constants are compared by id, value and unit.
    expect(() => assertEngineMatchesRelease(visible[0]!, { ...engine, constants: { therm_to_mmbtu: { value: '99', unit: 'MMBtu per therm' } } })).toThrow(/constant/)
    expect(() => assertEngineMatchesRelease(visible[0]!, { ...engine, constants: { therm_to_mmbtu: { value: '0.1', unit: 'MMBtu' } } })).toThrow(/constant/)
    expect(() => assertEngineMatchesRelease(visible[0]!, { ...engine, constants: {} })).toThrow(/constant/)
    expect(() => assertEngineMatchesRelease(visible[0]!, { ...engine, constants: { ...constants, g_to_kg: { value: '0.001', unit: 'kg per g' } } })).toThrow(/constant/)
    expect(sameDecimal('0.10', '0.1')).toBe(true)
  })

  test('releases supersede, never update; a failing latest review blocks release; withdrawal empties the profile', async () => {
    const current = (await db.query<{ id: string }>("select id from neuvetra.method_current_releases where profile_id='scope1.stationary.natural_gas'")).rows[0]!.id
    await call('register_method_version', { ...version('scope1.stationary.natural_gas.v3'), engineSha256: 'd'.repeat(64) })
    await call('record_method_review', review('scope1.stationary.natural_gas.v3', 'ai_independent'))
    await call('record_method_review', review('scope1.stationary.natural_gas.v3', 'independent_qa'))
    await call('record_method_review', review('scope1.stationary.natural_gas.v3', 'independent_qa', 'fail'))
    await expect(call('release_method_version', release('scope1.stationary.natural_gas.v3', current))).rejects.toThrow(/passing method and QA/)
    await call('record_method_review', review('scope1.stationary.natural_gas.v3', 'independent_qa'))
    await expect(call('release_method_version', release('scope1.stationary.natural_gas.v3', null))).rejects.toThrow(/supersede/)
    await call('release_method_version', release('scope1.stationary.natural_gas.v3', current))
    await expect(call('release_method_version', release('scope1.stationary.natural_gas.v3', current))).rejects.toThrow()
    const now = (await db.query<{ id: string; method_version_id: string }>('select id,method_version_id from neuvetra.method_current_releases')).rows
    expect(now).toHaveLength(1); expect(now[0]!.method_version_id).toBe('scope1.stationary.natural_gas.v3')
    await call('release_method_version', release('scope1.stationary.natural_gas.v3', now[0]!.id, 'withdrawn'))
    expect((await db.query('select 1 from neuvetra.method_current_releases')).rows).toHaveLength(0)
    expect((await db.query('select 1 from neuvetra.method_releases')).rows).toHaveLength(3)
    // QA F02: after a withdrawal the chain continues from the withdrawal row; a second root is impossible even for the owner.
    const tail = (await db.query<{ id: string }>("select id from neuvetra.method_releases where status='withdrawn'")).rows[0]!.id
    await expect(call('release_method_version', release('scope1.stationary.natural_gas.v3', tail, 'withdrawn'))).rejects.toThrow(/nothing to withdraw/)
    await expect(call('release_method_version', release('scope1.stationary.natural_gas.v3', null))).rejects.toThrow(/supersede the latest/)
    await expect(db.exec(`insert into neuvetra.method_releases(id,profile_id,method_version_id,status,supersedes_release_id,engine_sha256,register_sha256,decision_sha256,released_by,output_label)
      select gen_random_uuid(),profile_id,method_version_id,'released_beta',null,engine_sha256,register_sha256,decision_sha256,'owner','Draft — prepared with Neuvetra beta methods; not externally assured'
      from neuvetra.method_releases where id='${tail}'`)).rejects.toThrow(/one_chain_per_profile/)
    await call('release_method_version', release('scope1.stationary.natural_gas.v3', tail))
    expect((await db.query<{ method_version_id: string }>('select method_version_id from neuvetra.method_current_releases')).rows).toEqual([{ method_version_id: 'scope1.stationary.natural_gas.v3' }])
  })

  // Codex T01: the gate used "order by created_at desc, id", so a later fail sharing the timestamp of an earlier pass
  // with a larger UUID lost to it. Deterministic fixtures for both reviewer groups; everything is rolled back.
  test('the latest recorded review decides, never the clock: a later fail blocks even at the same timestamp (Codex T01)', async () => {
    const profileLocks: number[] = []
    await expect(db.transaction(async tx => {
      const run = (fn: string, v: unknown) => tx.query(`select neuvetra.${fn}($1::jsonb) r`, [JSON.stringify(v)])
      const refused = async (fn: string, v: unknown, why: RegExp) => {
        await tx.exec('savepoint refused'); await expect(run(fn, v)).rejects.toThrow(why); await tx.exec('rollback to savepoint refused')
      }
      // Written as the owner so the fixture controls the timestamp, the ids and even a supplied review_seq; the insert
      // trigger still takes the profile lock and draws review_seq itself, in insertion order.
      const insert = (id: string, versionId: string, reviewerType: string, verdict: string, at: string, seq: number | null = null) => tx.query(
        `insert into neuvetra.method_reviews(id,method_version_id,engine_sha256,register_sha256,reviewer,reviewer_type,reviewed_on,verdict,report_sha256,scope,created_at,review_seq)
          select $1,id,engine_sha256,register_sha256,'Tie fixture',$3,'2026-09-29',$4,$5,'Codex T01 regression',$6,$7 from neuvetra.method_versions where id=$2`,
        [id, versionId, reviewerType, verdict, REPORT, at, seq])
      const latest = async (versionId: string, types: string[], order: string) => (await tx.query<{ verdict: string }>(
        `select verdict from neuvetra.method_reviews where method_version_id=$1 and reviewer_type=any($2) order by ${order} limit 1`, [versionId, types])).rows[0]!.verdict
      const TIE = '2026-09-29 00:00:00+00'
      for (const [n, group] of [[1, 'qa'], [2, 'method']] as const) {
        const id = `scope1.review_order.${group}`
        const [passer, failer, other] = group === 'qa' ? ['independent_qa', 'independent_qa', 'ai_independent'] : ['ai_independent', 'human_qualified', 'independent_qa']
        const types = group === 'qa' ? ['independent_qa'] : ['ai_independent', 'human_qualified']
        await run('register_method_version', version(id, NG_KEYS, id))
        await insert(`10000000-0000-4000-8000-00000000000${n}`, id, other, 'pass', TIE)
        await insert(`20000000-0000-4000-8000-00000000000${n}`, id, passer, 'pass', TIE)
        await insert(`30000000-0000-4000-8000-00000000000${n}`, id, failer, 'fail', TIE)
        // The fixture reproduces the defect's condition: the old ordering picks the earlier pass.
        expect(await latest(id, types, 'created_at desc,id')).toBe('pass')
        expect(await latest(id, types, 'review_seq desc')).toBe('fail')
        await refused('release_method_version', release(id), /passing method and QA/)
        // Recorded order wins over the clock in both directions: a pass stamped earlier still counts as later...
        await insert(`40000000-0000-4000-8000-00000000000${n}`, id, passer, 'pass', '2026-09-28 23:59:59+00')
        expect(await latest(id, types, 'review_seq desc')).toBe('pass')
        // ...and a fail stamped earlier than everything, even with a supplied review_seq of 1, is still the latest and blocks.
        await insert(`50000000-0000-4000-8000-00000000000${n}`, id, failer, 'fail', '2026-09-01 00:00:00+00', 1)
        expect((await tx.query<{ top: boolean }>('select review_seq=(select max(review_seq) from neuvetra.method_reviews) top from neuvetra.method_reviews where id=$1', [`50000000-0000-4000-8000-00000000000${n}`])).rows[0]!.top).toBe(true)
        await refused('release_method_version', release(id), /passing method and QA/)
        // Through the normal function, a later pass releases.
        await run('record_method_review', review(id, passer))
        await run('release_method_version', release(id))
        expect((await tx.query('select 1 from neuvetra.method_current_releases where profile_id=$1', [id])).rows).toHaveLength(1)
      }
      // Recording a review, through the function or directly, holds the same per-profile lock as release_method_version
      // until the transaction ends.
      const held = async (profile: string) => (await tx.query<{ n: number }>(`select count(*)::int n from pg_locks where locktype='advisory' and objsubid=1 and coalesce(pid,pg_backend_pid())=pg_backend_pid()
        and ((classid::bigint<<32)|objid::bigint)=hashtextextended('neuvetra.method_releases:'||$1,0)`, [profile])).rows[0]!.n
      for (const [lockId, write] of [['scope1.review_order.lock', () => run('record_method_review', review('scope1.review_order.lock', 'independent_qa'))],
        ['scope1.review_order.lock-direct', () => insert('60000000-0000-4000-8000-000000000001', 'scope1.review_order.lock-direct', 'independent_qa', 'pass', TIE)]] as const) {
        await run('register_method_version', version(lockId, NG_KEYS, lockId))
        profileLocks.push(await held(lockId))
        await write()
        profileLocks.push(await held(lockId))
      }
      // A direct insert for an unregistered version is refused by the trigger itself, before any lock or sequence number.
      await tx.exec('savepoint unknown')
      await expect(tx.query(`insert into neuvetra.method_reviews(id,method_version_id,engine_sha256,register_sha256,reviewer,reviewer_type,reviewed_on,verdict,report_sha256,scope)
        values('70000000-0000-4000-8000-000000000001','scope1.review_order.unknown',$1,$2,'Tie fixture','independent_qa','2026-09-29','pass',$3,'Codex T01 regression')`,
        [ENGINE, METHOD_REGISTER_2025_SHA256, REPORT])).rejects.toThrow(/method version not registered/)
      await tx.exec('rollback to savepoint unknown')
      throw new Error('T01 fixtures rolled back')
    })).rejects.toThrow('T01 fixtures rolled back')
    expect(profileLocks).toEqual([0, 1, 0, 1])
    expect((await db.query("select 1 from neuvetra.method_versions where id like 'scope1.review\\_order.%'")).rows).toHaveLength(0)
    // A REPEATABLE READ snapshot could predate a review committed while the release waited for the lock, so it is refused.
    await expect(db.transaction(async tx => {
      await tx.exec('set transaction isolation level repeatable read')
      await tx.query('select neuvetra.release_method_version($1::jsonb)', [JSON.stringify(release('scope1.stationary.natural_gas.v3'))])
    })).rejects.toThrow(/READ COMMITTED/)
  })

  test('history is immutable even for the operator, and every write is audited', async () => {
    for (const statement of ["update neuvetra.method_factor_values set value_text='53.07' where factor_key='stationary.Natural Gas.co2'",
      "delete from neuvetra.method_releases", 'truncate neuvetra.method_reviews', "delete from neuvetra.method_reference_audit"])
      await expect(db.exec(statement)).rejects.toThrow(/immutable/)
    const counts = (await db.query<{ table_name: string; n: number }>('select table_name,count(*)::int n from neuvetra.method_reference_audit group by 1 order by 1')).rows
    const expected: Record<string, number> = {}
    for (const t of NEW_TABLES.filter(t => t !== 'method_reference_audit'))
      expected[t] = (await db.query<{ n: number }>(`select count(*)::int n from neuvetra.${t}`)).rows[0]!.n
    for (const [t, n] of Object.entries(expected)) if (n > 0) expect(counts.find(c => c.table_name === t)?.n).toBe(n)
    expect(counts.find(c => c.table_name === 'method_factor_values')?.n).toBe(265 + 84 + 138 + 330)
  })
})

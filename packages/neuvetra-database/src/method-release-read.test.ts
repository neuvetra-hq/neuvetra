// MR3 (Claude, 2026-10-12): the Results route's read of the 0024 release store, runnable in CI without the verified
// source originals. method-release-runtime.test.ts proves the same read against the real registers but needs
// NEUVETRA_METHOD_SOURCES_DIR, so CI skips it. Here one fully synthetic chain (register approval, decision, factor set,
// factor/GWP/constant rows, method version, release) is inserted directly by the migration owner, standing in for the
// operator tools, which the source-backed suites cover. What this suite proves is the runtime read itself: the
// runtime role sees releases only for a user with staging access, `authenticated` cannot read the store at all, the
// rows returned are exactly the ones the release links, and a withdrawal ends the current release.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import { WorkspaceDatabase, type WorkspaceConnection, type WorkspaceSql } from './workspace'

const TIMEOUT_MS = 120_000
const MIGRATIONS = new URL('./migrations/', import.meta.url)
const LATER = ['0024_method_reference.sql', '0025_scope3_method_reference.sql', '0026_scope2_residual_mix.sql', '0027_collection.sql']
const user = '78000000-0000-4000-8000-0000000000a1', outsider = '78000000-0000-4000-8000-0000000000a2', company = '78000000-0000-4000-8000-000000000001'
// Synthetic identifiers only: no real register, engine, decision or release.
const REGISTER = '5'.repeat(64), DECISION = '6'.repeat(64), ENGINE = '7'.repeat(64)
const FACTOR_SET = '78000000-0000-4000-8000-0000000000f1', RELEASE = '78000000-0000-4000-8000-0000000000e1', WITHDRAWAL = '78000000-0000-4000-8000-0000000000e2'
const METHOD = 'scope1.synthetic.ci_read_probe.v1', PROFILE = 'scope1.synthetic.ci_read_probe'
const LABEL = 'Draft — prepared with Neuvetra beta methods; not externally assured'
const wrap = (tx: { query: PGlite['query']; exec: PGlite['exec'] }): WorkspaceSql => ({ query: async (s, a) => ({ rows: (await tx.query(s, a)).rows as never[] }), exec: async s => { await tx.exec(s) } })
/** The hosted runtime logs in as neuvetra_runtime; this connection does the same inside each PGlite transaction. */
const runtimeConnection = (db: PGlite): WorkspaceConnection => ({ ...wrap(db), transaction: fn => db.transaction(async tx => { await tx.exec('set local role neuvetra_runtime'); return fn(wrap(tx)) }), close: async () => {} })
class RuntimeDatabase extends WorkspaceDatabase { constructor(db: WorkspaceConnection) { super(db) } }

describe('runtime read of the method release store, without source originals (MR3)', () => {
  let db: PGlite, runtime: RuntimeDatabase
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
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Read Probe','US','CA',$2)", [company, user])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [company, user])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [user, company])
    // One synthetic register chain, cited to a source document the migration already seeds.
    const source = (await db.query<{ id: string; sha256: string }>("select id,sha256 from neuvetra.method_source_documents where id='24000000-0000-4000-8000-000000000001'")).rows[0]!
    await db.query(`insert into neuvetra.method_register_approvals(register_sha256,register_schema,scope,source_document_sha256,entry_count,decision_sha256,decision_reference,approved_by,approved_on)
      values($1,'neuvetra.verified-factor-register.v1',1,$2,3,$3,'synthetic CI probe (test only)','test','2026-10-12')`, [REGISTER, source.sha256, DECISION])
    await db.query("insert into neuvetra.method_release_decisions(register_sha256,decision_sha256,decision_reference,approved_by,approved_on) values($1,$2,'synthetic CI probe (test only)','test','2026-10-12')", [REGISTER, DECISION])
    await db.query("insert into neuvetra.method_factor_sets(id,register_sha256,source_document_id,verified_by,verification_method) values($1,$2,$3,'test','synthetic')", [FACTOR_SET, REGISTER, source.id])
    for (const [key, value, unit, cell] of [['synthetic.co2', '53.06', 'kg CO2/mmBtu', 'B2'], ['synthetic.ch4', '0.001', 'kg CH4/mmBtu', 'C2'], ['gwp_ar5.CH4', '28', 'kg CO2e/kg', 'D2'], ['synthetic.unlinked', '9', 'kg', 'E2']] as const)
      await db.query(`insert into neuvetra.method_factor_values(factor_set_id,factor_key,table_label,sheet,value_cell,label_cells,label,value_text,unit,source_document_sha256)
        values($1,$2,'Synthetic table','Synthetic',$3,'["A2"]',$2,$4,$5,$6)`, [FACTOR_SET, key, cell, value, unit, source.sha256])
    await db.query("insert into neuvetra.method_gwp_values(gwp_set_id,gas,factor_set_id,factor_key,value_text) values('AR5-100','CH4',$1,'gwp_ar5.CH4','28')", [FACTOR_SET])
    await db.query("insert into neuvetra.method_constants(register_sha256,id,value_text,unit,basis) values($1,'synthetic_constant','0.1','mmBtu/therm','synthetic'),($1,'unlinked_constant','2','x','synthetic')", [REGISTER])
    await db.query(`insert into neuvetra.method_versions(id,profile_id,scope,family,title,formula,engine_path,engine_sha256,register_sha256,factor_set_id,gwp_set_id,admission_rules,estimate_rules,reporting_period_start,reporting_period_end_exclusive)
      values($1,$2,1,'stationary_combustion','Synthetic CI read probe','synthetic','apps/site-api/src/calculation/scope1_engine.py',$3,$4,$5,'AR5-100','["synthetic"]','[]','2025-01-01','2026-01-01')`, [METHOD, PROFILE, ENGINE, REGISTER, FACTOR_SET])
    for (const key of ['synthetic.co2', 'synthetic.ch4', 'gwp_ar5.CH4']) await db.query('insert into neuvetra.method_version_factors(method_version_id,factor_set_id,factor_key) values($1,$2,$3)', [METHOD, FACTOR_SET, key])
    await db.query("insert into neuvetra.method_version_constants(method_version_id,register_sha256,constant_id) values($1,$2,'synthetic_constant')", [METHOD, REGISTER])
    runtime = new RuntimeDatabase(runtimeConnection(db))
  }, TIMEOUT_MS)
  afterAll(async () => { await db?.close() })

  test('nothing is current before a release', async () => {
    expect(await runtime.findCurrentMethodReleases(user)).toEqual([])
  })

  test('a released method returns exactly the rows it links, for a user with staging access only', async () => {
    await db.query(`insert into neuvetra.method_releases(id,profile_id,method_version_id,status,engine_sha256,register_sha256,decision_sha256,released_by,output_label)
      values($1,$2,$3,'released_beta',$4,$5,$6,'test',$7)`, [RELEASE, PROFILE, METHOD, ENGINE, REGISTER, DECISION, LABEL])
    expect(await runtime.findCurrentMethodReleases(user)).toEqual([{
      releaseId: RELEASE, profileId: PROFILE, methodVersionId: METHOD, scope: 1, family: 'stationary_combustion', engineSha256: ENGINE, registerSha256: REGISTER, gwpSetId: 'AR5-100', outputLabel: LABEL,
      // Sorted by key (collate "C"); the unlinked factor and constant are not exposed.
      factors: [
        { key: 'gwp_ar5.CH4', value: '28', unit: 'kg CO2e/kg', cell: 'D2', label: 'gwp_ar5.CH4', table: 'Synthetic table' },
        { key: 'synthetic.ch4', value: '0.001', unit: 'kg CH4/mmBtu', cell: 'C2', label: 'synthetic.ch4', table: 'Synthetic table' },
        { key: 'synthetic.co2', value: '53.06', unit: 'kg CO2/mmBtu', cell: 'B2', label: 'synthetic.co2', table: 'Synthetic table' }],
      gwp: [{ gas: 'CH4', value: '28', cell: 'D2' }],
      constants: [{ id: 'synthetic_constant', value: '0.1', unit: 'mmBtu/therm' }],
    }])
    // Row-level security: a signed-in user without staging access reads no release, and no factor row either.
    expect(await runtime.findCurrentMethodReleases(outsider)).toEqual([])
    const hidden = await db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [outsider]); await tx.exec('set local role neuvetra_runtime')
      return (await tx.query<{ n: number }>('select (select count(*) from neuvetra.method_releases)::int+(select count(*) from neuvetra.method_factor_values)::int+(select count(*) from neuvetra.method_constants)::int n')).rows[0]!.n
    })
    expect(hidden).toBe(0)
  })

  test('the read needs the runtime role: the authenticated role cannot read the release store', async () => {
    for (const table of ['method_current_releases', 'method_releases', 'method_factor_values', 'method_constants']) {
      const denied = await db.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user]); await tx.exec('set local role authenticated')
        return tx.query(`select count(*) from neuvetra.${table}`).then(() => 'read', (error: Error) => error.message)
      })
      expect(denied).toMatch(/permission denied/)
    }
    // The denial above can come from the schema alone, so also check the grants themselves: `authenticated` holds no
    // privilege on any release-store table, and the runtime role may only read them.
    const grants = await db.query<{ table_name: string; authenticated: boolean; runtime_write: boolean; runtime_read: boolean }>(`
      select c.relname table_name,
        has_table_privilege('authenticated',c.oid,'select,insert,update,delete') authenticated,
        has_table_privilege('neuvetra_runtime',c.oid,'insert,update,delete,truncate') runtime_write,
        has_table_privilege('neuvetra_runtime',c.oid,'select') runtime_read
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='neuvetra' and c.relkind in('r','v') and c.relname like 'method\_%' order by c.relname`)
    const tables = grants.rows.map(row => row.table_name)
    expect(tables).toEqual(expect.arrayContaining(['method_current_releases', 'method_releases', 'method_factor_values', 'method_gwp_values', 'method_constants', 'method_versions', 'method_version_factors', 'method_version_constants']))
    expect(grants.rows.filter(row => row.authenticated || row.runtime_write).map(row => row.table_name)).toEqual([])
    expect(grants.rows.filter(row => ['method_current_releases', 'method_releases', 'method_factor_values', 'method_gwp_values', 'method_constants', 'method_versions', 'method_version_factors', 'method_version_constants'].includes(row.table_name) && !row.runtime_read).map(row => row.table_name)).toEqual([])
  })

  test('the runtime role cannot write the store', async () => {
    const refused = await db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user]); await tx.exec('set local role neuvetra_runtime')
      return tx.query(`insert into neuvetra.method_releases(id,profile_id,method_version_id,status,supersedes_release_id,engine_sha256,register_sha256,decision_sha256,released_by,output_label)
        values('78000000-0000-4000-8000-0000000000e9',$1,$2,'withdrawn',$3,$4,$5,$6,'runtime',$7)`, [PROFILE, METHOD, RELEASE, ENGINE, REGISTER, DECISION, LABEL]).then(() => 'written', (error: Error) => error.message)
    })
    expect(refused).toMatch(/permission denied/)
    expect((await runtime.findCurrentMethodReleases(user)).map(r => r.releaseId)).toEqual([RELEASE])
  })

  test('a withdrawal ends the current release', async () => {
    await db.query(`insert into neuvetra.method_releases(id,profile_id,method_version_id,status,supersedes_release_id,engine_sha256,register_sha256,decision_sha256,released_by,output_label)
      values($1,$2,$3,'withdrawn',$4,$5,$6,$7,'test',$8)`, [WITHDRAWAL, PROFILE, METHOD, RELEASE, ENGINE, REGISTER, DECISION, LABEL])
    expect(await runtime.findCurrentMethodReleases(user)).toEqual([])
  })
})

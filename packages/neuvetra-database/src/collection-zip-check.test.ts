// Migration 0028 (collection review N5): the database refuses an electricity ZIP, eGRID subregion and utility that the
// eGRID2023 ZIP lookup doesn't list together, for every writer. Claude, 2026-09-30. Synthetic data only.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import { saveCollectionActivity } from './collection'
import type { CollectionActivity, CollectionActivitySaveInput } from './collection-contract'
import { lookupCollectionZip } from '../../../apps/site-api/src/workspace/collection-zip'

const MIGRATIONS = new URL('./migrations/', import.meta.url)
const LATER = ['0024_method_reference.sql', '0025_scope3_method_reference.sql', '0026_scope2_residual_mix.sql', '0027_collection.sql']
const CHECK = '0028_collection_zip_check.sql'
const TIMEOUT_MS = 300_000 // PGlite runs in WebAssembly; loading 65,110 lookup rows takes seconds, more on a loaded machine.

const owner = '28100000-0000-4000-8000-000000000001', company = '28200000-0000-4000-8000-000000000001'
const setupVersion = '28500000-0000-4000-8000-000000000001', locationId = '28600000-0000-4000-8000-000000000001'

/** The database as hosted will have it: the manifest, then whichever of 0024–0027 it doesn't list yet, then (optionally) 0028. */
async function database(options: { withCheck?: boolean; beforeCheck?: (db: PGlite) => Promise<void>; checkSql?: string } = {}) {
  const db = new PGlite()
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
    alter table storage.objects enable row level security; grant usage on schema storage to authenticated,anon; grant select,insert on storage.objects to authenticated,anon;`)
  // Everything before 0028, whether or not the manifest lists it yet; 0028 is applied last, on its own, below.
  const manifest = (await readMigrationManifest()).filter(migration => migration.name < CHECK)
  for (const migration of manifest) await db.exec(migration.sql)
  const listed = new Set(manifest.map(migration => migration.name))
  for (const name of LATER) if (!listed.has(name)) await db.exec(await Bun.file(new URL(name, MIGRATIONS)).text())
  await db.query('insert into auth.users(id) values($1)', [owner])
  await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic ZIP Check','US','CA',$2)", [company, owner])
  await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [company, owner])
  await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [owner, company])
  await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,boundary_approach,created_by) values($1,$2,1,'{}',$3,'unknown',$4)", [setupVersion, company, 'a'.repeat(64), owner])
  await db.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,1)', [company, setupVersion])
  await db.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Synthetic office','San Francisco','Office','owned','reporting_company','included','','','','period_start','period_end')", [company, setupVersion, locationId])
  if (options.beforeCheck) await options.beforeCheck(db)
  if (options.withCheck !== false) await db.transaction(async tx => { await tx.exec(options.checkSql ?? await Bun.file(new URL(CHECK, MIGRATIONS)).text()) })
  return db
}
const asOwner = <T>(db: PGlite, operation: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]); await tx.exec('set local role neuvetra_runtime')
  return operation({ query: async <R>(sql: string, args: unknown[] = []) => ({ rows: (await tx.query<R>(sql, args)).rows }), exec: async (sql: string) => { await tx.exec(sql) } })
})
const meter = (zip: string, subregion: string, utilityEiaId: string | null, sourceId = `M-${zip}-${subregion}`): CollectionActivity => ({
  setupVersionId: setupVersion, locationId, sourceId, state: 'active', withdrawalReason: null, kind: 'electricity',
  quantity: { originalValue: '1000', originalUnit: 'kWh', normalizedValue: '1000', normalizedUnit: 'kWh' }, quality: 'actual', estimateBasis: null,
  period: { start: '2025-01-01', endExclusive: '2025-02-01' }, reference: 'Synthetic statement', notes: '', evidenceIds: [],
  payload: { meterOrAccountNumber: sourceId, utilityName: 'Synthetic utility', site: 'Synthetic office', zip, subregion, utilityEiaId, instruments: [] } })
const gas = (): CollectionActivity => ({ setupVersionId: setupVersion, locationId, sourceId: 'GAS-1', state: 'active', withdrawalReason: null, kind: 'natural_gas',
  quantity: { originalValue: '10', originalUnit: 'therm', normalizedValue: '10', normalizedUnit: 'therm' }, quality: 'actual', estimateBasis: null,
  period: { start: '2025-01-01', endExclusive: '2025-02-01' }, reference: 'Synthetic statement', notes: '', evidenceIds: [], payload: { heatContent: null } })
const request = (activity: CollectionActivity): CollectionActivitySaveInput => ({ idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity })
const save = (db: PGlite, activity: CollectionActivity) => asOwner(db, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request(activity)))
const failure = (promise: Promise<unknown>) => promise.then(() => null, (error: { code?: string; message?: string; detail?: string }) => ({ code: error.code, message: error.message, detail: error.detail }))

/** The route's rule, as written in collection-routes.ts validateElectricityLookup, over its own lookup (collection-zip.ts). */
async function routeProblem(zip: string, subregion: string, utilityEiaId: string | null): Promise<string | null> {
  const lookup = await lookupCollectionZip(zip)
  if (!lookup.found || lookup.zip !== zip || !lookup.subregions.includes(subregion)) return 'zip_subregion_mismatch'
  if (lookup.needsUtilityChoice && !utilityEiaId) return 'utility_required'
  if (utilityEiaId && !lookup.utilities.some(row => row.eiaId === utilityEiaId && row.subregion === subregion)) return 'utility_mismatch'
  return null
}

describe('0028: the eGRID2023 ZIP lookup check in the database (collection N5)', () => {
  let db: PGlite
  beforeAll(async () => { db = await database() }, TIMEOUT_MS)
  afterAll(async () => { await db.close() })

  test('the lookup rows are the pinned zip.csv and reference the source registered by 0024', async () => {
    const counts = (await db.query<{ rows: number; zips: number; subregions: number; multi: number; sources: string }>(`select count(*)::int rows,count(distinct zip)::int zips,count(distinct subregion)::int subregions,
      (select count(*)::int from (select zip from neuvetra.egrid2023_zip_lookup group by zip having count(distinct subregion)>1) m) multi,
      string_agg(distinct source_document_id::text||' '||source_sha256,',') sources from neuvetra.egrid2023_zip_lookup`)).rows[0]
    expect(counts).toEqual({ rows: 65110, zips: 41588, subregions: 27, multi: 2963, sources: '24000000-0000-4000-8000-000000000009 33d33352c4563c8524862b94ab8e948a7b75c8ee42da5c92cce2b4d47801f523' })
    // Row for row, the same entries the route reads from the same file (a quoted utility name with a comma included).
    const stored = (await db.query<{ zip: string; state: string; eia_id: string; utility_name: string; subregion: string; predominant: boolean }>('select zip,state,eia_id,utility_name,subregion,predominant from neuvetra.egrid2023_zip_lookup order by line_number')).rows
    const zips = [...new Set(stored.map(row => row.zip))]
    const fromRoute: typeof stored = []
    const byZip = new Map<string, typeof stored>()
    for (const row of stored) byZip.set(row.zip, [...(byZip.get(row.zip) ?? []), row])
    for (const zip of zips) {
      const lookup = await lookupCollectionZip(zip)
      const key = (row: { eia_id?: string; eiaId?: string; subregion: string; utility_name?: string; utility?: string }) => `${row.eia_id ?? row.eiaId}|${row.subregion}|${row.utility_name ?? row.utility}`
      expect(lookup.utilities.map(u => `${key(u)}|${u.state}|${u.predominantUtility}`).sort()).toEqual(byZip.get(zip)!.map(r => `${key(r)}|${r.state}|${r.predominant}`).sort())
      fromRoute.push(...byZip.get(zip)!)
    }
    expect(fromRoute.length).toBe(65110)
    expect(stored.find(row => row.utility_name.includes(','))).toMatchObject({ zip: '04853', utility_name: 'Fox Islands Electric Coop, Inc' })
  }, TIMEOUT_MS)

  test('for every ZIP, the database gives the same answer as the route', async () => {
    const lookupRows = (await db.query<{ zip: string; eia_id: string; subregion: string }>('select zip,eia_id,subregion from neuvetra.egrid2023_zip_lookup')).rows
    const byZip = new Map<string, { eia_id: string; subregion: string }[]>()
    for (const row of lookupRows) byZip.set(row.zip, [...(byZip.get(row.zip) ?? []), row])
    const cases: [string, string, string | null][] = []
    for (const [zip, rows] of byZip) {
      const subregions = [...new Set(rows.map(row => row.subregion))]
      for (const subregion of subregions) {
        cases.push([zip, subregion, null], [zip, subregion, ''], [zip, subregion, '9999999'])
        for (const row of rows) cases.push([zip, subregion, row.eia_id || null]) // a utility of this ZIP, listed for this subregion or not
      }
      cases.push([zip, subregions.includes('NYUP') ? 'CAMX' : 'NYUP', null], [zip, 'XXXX', null])
    }
    for (const zip of ['00000', '00900', '99999']) { // ZIPs the lookup doesn't list
      expect((await lookupCollectionZip(zip)).found).toBe(false)
      cases.push([zip, 'CAMX', null], [zip, 'CAMX', '14328'])
    }
    const unique = [...new Map(cases.map(item => [item.join('|'), item])).values()]
    const expected = new Map<string, string | null>()
    for (const [zip, subregion, utility] of unique) expected.set([zip, subregion, utility].join('|'), await routeProblem(zip, subregion, utility))
    await db.exec('create temp table zip_cases(zip text,subregion text,utility text)')
    for (let i = 0; i < unique.length; i += 20000)
      await db.query("insert into zip_cases select * from jsonb_to_recordset($1::jsonb) as t(zip text,subregion text,utility text)", [JSON.stringify(unique.slice(i, i + 20000).map(([zip, subregion, utility]) => ({ zip, subregion, utility })))])
    const actual = (await db.query<{ zip: string; subregion: string; utility: string | null; problem: string | null }>('select zip,subregion,utility,neuvetra.collection_electricity_location_problem(zip,subregion,utility) problem from zip_cases')).rows
    expect(actual.length).toBe(unique.length)
    const tally: Record<string, number> = {}
    const disagreements = actual.filter(row => { tally[String(row.problem)] = (tally[String(row.problem)] ?? 0) + 1; return expected.get([row.zip, row.subregion, row.utility].join('|')) !== row.problem })
    expect(disagreements).toEqual([])
    expect(Object.keys(tally).sort()).toEqual(['null', 'utility_mismatch', 'utility_required', 'zip_subregion_mismatch'])
    console.log(`0028 vs route: ${unique.length} ZIP/subregion/utility cases over ${byZip.size} ZIPs, 0 disagreements; ${JSON.stringify(tally)}`)
  }, TIMEOUT_MS)

  test('every saving path is checked: the save function and a direct insert', async () => {
    const saved = await save(db, meter('94105', 'CAMX', null))
    expect(saved.version.revision).toBe(1)
    expect(await save(db, meter('94105', 'CAMX', '16612', 'M-UTILITY'))).toBeTruthy()
    for (const [zip, subregion, utility, problem] of [['94105', 'NYUP', null, 'zip_subregion_mismatch'], ['00000', 'CAMX', null, 'zip_subregion_mismatch'], ['94105', 'CAMX', '14328', 'utility_mismatch']] as const)
      expect(await failure(save(db, meter(zip, subregion, utility, `M-BAD-${zip}-${subregion}-${utility}`)))).toMatchObject({ code: '22023', detail: problem })
    // A ZIP listed under two subregions needs its utility, as in the route.
    const multi = (await db.query<{ zip: string; subregion: string; eia_id: string }>("select zip,subregion,eia_id from neuvetra.egrid2023_zip_lookup where eia_id<>'' and zip in (select zip from neuvetra.egrid2023_zip_lookup group by zip having count(distinct subregion)>1) order by line_number limit 1")).rows[0]!
    expect(await failure(save(db, meter(multi.zip, multi.subregion, null, 'M-MULTI-NONE')))).toMatchObject({ code: '22023', detail: 'utility_required' })
    expect(await save(db, meter(multi.zip, multi.subregion, multi.eia_id, 'M-MULTI-UTILITY'))).toBeTruthy()
    // Other activity kinds are untouched.
    expect(await save(db, gas())).toBeTruthy()
    // A writer that skips the save function is refused by the trigger on the version row itself.
    const direct = (subregion: string, zipColumn = '94105') => failure(db.query(`insert into neuvetra.collection_activity_versions
      select (jsonb_populate_record(null::neuvetra.collection_activity_versions, to_jsonb(v)||jsonb_build_object('id',gen_random_uuid(),'revision',2,'previous_version_id',v.id,
        'correction_reason','Synthetic direct write','electricity_zip',$3::text,'payload',jsonb_set(v.payload,'{payload,subregion}',to_jsonb($2::text))))).*
      from neuvetra.collection_activity_versions v where v.id=$1`, [saved.version.id, subregion, zipColumn]))
    expect(await direct('NYUP')).toMatchObject({ code: '22023', detail: 'zip_subregion_mismatch' })
    expect(await direct('CAMX', '07401')).toMatchObject({ code: '22023', message: 'electricity location columns do not match the saved activity', detail: 'location_columns_mismatch' })
    expect(await direct('CAMX')).toBeNull() // the same pair, written directly, is accepted: the rule, not the path, decides
  }, TIMEOUT_MS)

  test('the lookup is reference data: no insert, change, delete or truncate', async () => {
    for (const sql of [
      "insert into neuvetra.egrid2023_zip_lookup values(65111,'94105','CA','1','Invented','NYUP',false,'24000000-0000-4000-8000-000000000009','33d33352c4563c8524862b94ab8e948a7b75c8ee42da5c92cce2b4d47801f523')",
      "update neuvetra.egrid2023_zip_lookup set subregion='NYUP' where zip='94105'", "delete from neuvetra.egrid2023_zip_lookup where zip='94105'", 'truncate neuvetra.egrid2023_zip_lookup'])
      expect(await failure(db.exec(sql))).toMatchObject({ code: '42501', message: 'reference data is immutable' })
    expect((await db.query<{ n: number }>("select count(*)::int n from neuvetra.egrid2023_zip_lookup where zip='94105' and subregion='CAMX'")).rows[0]!.n).toBe(1)
    // The server runtime role can neither read nor change it.
    expect(await failure(asOwner(db, tx => tx.query('select count(*) from neuvetra.egrid2023_zip_lookup')))).toMatchObject({ code: '42501' })
    // Like every neuvetra table, row-level security is on and forced: the staging readiness check (hosted.ts
    // checkReadiness) refuses to start when any neuvetra table lacks either.
    expect((await db.query<{ unsafe: string[] }>("select coalesce(array_agg(c.relname::text),'{}') unsafe from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)")).rows[0]!.unsafe).toEqual([])
    expect(await failure(asOwner(db, tx => tx.query("select neuvetra.collection_electricity_location_problem('94105','CAMX',null)")))).toMatchObject({ code: '42501' })
  }, TIMEOUT_MS)
})

describe('0028 refuses to run on anything but the reviewed state', () => {
  const sql = () => Bun.file(new URL(CHECK, MIGRATIONS)).text()
  test('a changed lookup row is refused before any table is created', async () => {
    const original = await sql()
    const tampered = original.replace('\n94105,CA,16612,City & County of San Francisco,CAMX,1\n', '\n94105,CA,16612,City & County of San Francisco,NYUP,1\n')
    expect(tampered).not.toBe(original)
    const db = await database({ withCheck: false })
    expect(await failure(db.transaction(async tx => { await tx.exec(tampered) }))).toMatchObject({ code: '22023', message: 'eGRID2023 ZIP lookup text does not match the engine-pinned zip.csv' })
    expect((await db.query<{ t: string | null }>("select to_regclass('neuvetra.egrid2023_zip_lookup')::text t")).rows[0]!.t).toBeNull()
    await db.close()
  }, TIMEOUT_MS)

  test('a CRLF checkout of the migration proves the same bytes', async () => {
    const db = await database({ checkSql: (await sql()).replace(/\n/g, '\r\n') })
    expect((await db.query<{ n: number }>('select count(*)::int n from neuvetra.egrid2023_zip_lookup')).rows[0]!.n).toBe(65110)
    await db.close()
  }, TIMEOUT_MS)

  test('an electricity record saved before 0028 that the lookup does not list stops the migration', async () => {
    const db = await database({ withCheck: false, beforeCheck: async db => { await save(db, meter('94105', 'NYUP', null, 'M-BEFORE')) } })
    expect(await failure(db.transaction(async tx => { await tx.exec(await sql()) }))).toMatchObject({ code: '23514', message: '1 saved electricity versions fail the eGRID2023 ZIP lookup rule; correct them before 0028' })
    expect((await db.query<{ t: string | null }>("select to_regclass('neuvetra.egrid2023_zip_lookup')::text t")).rows[0]!.t).toBeNull()
    await db.close()
  }, TIMEOUT_MS)

  // Codex review Z28-01: the audit of earlier rows applies the trigger's whole rule. A row whose ZIP or utility columns
  // differ from its saved activity is refused even when the columns alone name a listed pair, because the engines read
  // the activity. Each case is a direct write before 0028, which 0027 alone allowed.
  test('an earlier row whose location columns differ from its saved activity stops the migration', async () => {
    const edits: [string, string][] = [
      ["jsonb_build_object('payload',jsonb_set(v.payload,'{payload,zip}',to_jsonb('07401'::text)))", 'payload ZIP 07401 (not listed under CAMX), column 94105'],
      ["jsonb_build_object('payload',jsonb_set(v.payload,'{payload,utilityEiaId}',to_jsonb('16612'::text)))", 'payload utility 16612 (listed), column null'],
    ]
    for (const [edit, label] of edits) {
      const db = await database({ withCheck: false, beforeCheck: async db => {
        const source = await save(db, meter('94105', 'CAMX', null, 'M-COLUMNS'))
        await db.query(`insert into neuvetra.collection_activity_versions select (jsonb_populate_record(null::neuvetra.collection_activity_versions,
          to_jsonb(v)||jsonb_build_object('id',gen_random_uuid(),'revision',2,'previous_version_id',v.id,'correction_reason','Synthetic direct write')||${edit})).*
          from neuvetra.collection_activity_versions v where v.id=$1`, [source.version.id])
      } })
      expect([label, await failure(db.transaction(async tx => { await tx.exec(await sql()) }))]).toMatchObject([label, { code: '23514', message: '1 saved electricity versions fail the eGRID2023 ZIP lookup rule; correct them before 0028' }])
      expect((await db.query<{ t: string | null }>("select to_regclass('neuvetra.egrid2023_zip_lookup')::text t")).rows[0]!.t).toBeNull()
      await db.close()
    }
  }, TIMEOUT_MS)

  test('without the source registered by 0024 it refuses', async () => {
    const db = await database({ withCheck: false })
    await db.exec("alter table neuvetra.method_source_documents disable trigger user; delete from neuvetra.method_source_copies where source_document_id='24000000-0000-4000-8000-000000000009'; delete from neuvetra.method_source_documents where id='24000000-0000-4000-8000-000000000009'")
    expect(await failure(db.transaction(async tx => { await tx.exec(await sql()) }))).toMatchObject({ code: '23503', message: 'registered eGRID2023 ZIP lookup source is missing' })
    await db.close()
  }, TIMEOUT_MS)
})

// The Scope 2 engine is the method authority: a pair the database accepts gets a location-based figure, and a pair it
// refuses would not. Each call is a fresh Python process (set NEUVETRA_PYTHON on Windows).
const PYTHON = Bun.which(process.env.NEUVETRA_PYTHON ?? 'python3')
if (!PYTHON) console.warn('SKIPPED: 0028 vs the Scope 2 engine needs Python (set NEUVETRA_PYTHON).')
describe.skipIf(!PYTHON)('0028 agrees with the Scope 2 engine', () => {
  let db: PGlite
  beforeAll(async () => { db = await database() }, TIMEOUT_MS)
  afterAll(async () => { await db.close() })
  test('accepted exactly when the engine gives a location-based figure', async () => {
    const engine = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope2_engine.py', import.meta.url))
    const sample = (await db.query<{ zip: string; subregion: string; eia_id: string; multi: boolean }>(`select zip,subregion,eia_id,(select count(distinct subregion) from neuvetra.egrid2023_zip_lookup m where m.zip=l.zip)>1 multi
      from neuvetra.egrid2023_zip_lookup l where line_number % 4001 = 0 or (eia_id<>'' and zip in (select zip from neuvetra.egrid2023_zip_lookup group by zip having count(distinct subregion)>1) and line_number % 331 = 0) order by line_number`)).rows
    const cases: [string, string, string | null][] = []
    for (const [i, row] of sample.entries()) {
      cases.push([row.zip, row.subregion, row.eia_id || null], [row.zip, row.subregion, null], [row.zip, row.subregion === 'NYUP' ? 'CAMX' : 'NYUP', row.eia_id || null])
      if (i % 3 === 0) cases.push([row.zip, row.subregion, '9999999']) // a utility the lookup doesn't list here
    }
    cases.push(['00000', 'CAMX', null], ['94105', 'CAMX', '14328'])
    const tally: Record<string, number> = {}
    for (const [zip, subregion, utility] of cases) {
      const problem = (await db.query<{ p: string | null }>('select neuvetra.collection_electricity_location_problem($1,$2,$3) p', [zip, subregion, utility])).rows[0]!.p
      const input = { period: { start: '2025-01-01', endExclusive: '2025-02-01' }, quantity: '1000', unit: 'kWh', zip, subregion, instruments: [], ...(utility ? { utilityEiaId: utility } : {}) }
      const out = Bun.spawnSync([PYTHON!, engine], { stdin: new TextEncoder().encode(JSON.stringify({ action: 'calculate', input })), env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } })
      const result = JSON.parse(out.stdout.toString()) as { status: string; code?: string; result?: { locationBased: { status: string; findings: string[] } } }
      expect(result.status).toBe('ok')
      const location = result.result!.locationBased
      expect([zip, subregion, utility, problem === null]).toEqual([zip, subregion, utility, location.status === 'complete'])
      tally[`${problem ?? 'accepted'} -> ${location.status}${location.findings.length ? ` (${location.findings.join(',')})` : ''}`] = (tally[`${problem ?? 'accepted'} -> ${location.status}${location.findings.length ? ` (${location.findings.join(',')})` : ''}`] ?? 0) + 1
    }
    console.log(`0028 vs Scope 2 engine: ${cases.length} cases; ${JSON.stringify(tally)}`)
  }, TIMEOUT_MS)
})

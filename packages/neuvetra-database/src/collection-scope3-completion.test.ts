// Migration 0030 (Scope 3 completion I-02; Claude, 30 October 2026). PGlite with every migration up to 0029, records of
// every 0029 kind saved first (one corrected, one withdrawn), then 0030: earlier rows must be byte-identical; the
// thirteen new kinds save as scope 3; the database refuses exactly what the TypeScript contract refuses (the shared
// fixture table); and the assessment, spend-import and report-version tables keep their revisions, idempotency,
// immutability and privileges.
//
// I-02b (DESIGN §11): the drift guard refuses an altered 0029 (AM-01); neither view nor any base table leaks another
// company's rows (AM-02); assessments, imports and reports are per reporting year (AM-03); the amended payloads, NAICS
// code sets (all 1,016 v1.3 codes), line fingerprints and within-category exclusions agree between TypeScript and SQL.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest, STAGING_MIGRATIONS } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import { readCollectionActivities, saveCollectionActivity } from './collection'
import { validateCollectionActivity, type CollectionActivity, type CollectionActivitySaveInput, type CollectionContext } from './collection-contract'
import { planScope3Calculation, SCOPE3_COLLECTION_KINDS, SCOPE3_COLLECTION_UNITS, SCOPE3_COMPLETION_KINDS, SCOPE3_KIND_CATEGORIES, scope3SchemaRequired, type Scope3CollectionVersion } from './scope3-collection'
import { SCOPE3_PAYLOAD_FIXTURES, fixtureAssessment, fixtureMappingKey, fixtureQuantity, scope3AssessmentFixtures } from './scope3-payload-fixtures'
import { scope3ReportingYearOf, validateScope3Assessment, validateScope3AssessmentSaveInput } from './scope3-assessment-contract'
import { SCOPE3_SPEND_CATEGORIES, SCOPE3_SPEND_NAICS_SETS, scope3SpendLineFingerprintInput, scope3SpendNaicsAllowed, scope3SpendPossibleDuplicates } from './scope3-collection-contract'
import { scope3Coverage } from './scope3-engine-output'

const owner = '30100000-0000-4000-8000-000000000001', member = '30100000-0000-4000-8000-000000000002', outsider = '30100000-0000-4000-8000-000000000003'
const company = '30200000-0000-4000-8000-000000000001', otherCompany = '30200000-0000-4000-8000-000000000002'
const setupVersion = '30500000-0000-4000-8000-000000000001', otherSetup = '30500000-0000-4000-8000-000000000002', oldSetup = '30500000-0000-4000-8000-000000000003'
const fySetup = '30500000-0000-4000-8000-000000000004'
const locationId = '30600000-0000-4000-8000-000000000001', otherLocation = '30600000-0000-4000-8000-000000000002', fyLocation = '30600000-0000-4000-8000-000000000003'
const linkage = { setupVersionId: setupVersion, locationId, state: 'active' as const, withdrawalReason: null, quality: 'actual' as const, estimateBasis: null,
  period: { start: '2025-01-01', endExclusive: '2026-01-01' }, reference: 'Synthetic', notes: '', evidenceIds: [] as string[] }
const q = fixtureQuantity
const activity = (kind: string, sourceId: string, quantity: ReturnType<typeof q>, payload: unknown) => ({ ...linkage, kind, sourceId, quantity, payload }) as unknown as CollectionActivity
const legacy = {
  transport: activity('transport', 'LANE-1', q('1200.5', 'short ton-mile'), { category: 4, vehicle: 'medium_and_heavy_duty_truck', loadBasis: 'shared_vehicle', thirdPartyFacilities: 'none' }),
  waste: activity('waste', 'WASTE-1', q('17.125', 'metric_ton'), { category: 5, material: 'asphalt_concrete', treatment: 'recycled' }),
  business_travel: activity('business_travel', 'TRIP-1', q('2400', 'mile'), { mode: 'air', passengerSegments: 4, haulBasis: null }),
  hotel: activity('business_travel', 'HOTEL-1', q('10', 'room-night', false), { mode: 'hotel', passengerSegments: null, haulBasis: null }),
  employee_commuting: activity('employee_commuting', 'SURVEY-1', q('9800', 'passenger-mile'), { mode: 'bus' }),
}
const gas = activity('natural_gas', 'GAS-1', q('12.125', 'therm'), { heatContent: null })
const electricity = activity('electricity', 'MTR-1', q('1200.125', 'kWh'), { meterOrAccountNumber: 'MTR-1', utilityName: 'Synthetic Utility', site: 'Office', zip: '94105', subregion: 'CAMX', utilityEiaId: null, instruments: [] })
const request = (a: unknown, previous?: { revision: number; id: string }): CollectionActivitySaveInput =>
  ({ idempotencyKey: crypto.randomUUID(), expectedRevision: previous?.revision ?? 0, expectedVersionId: previous?.id ?? null, correctionReason: previous ? 'Corrected synthetic value.' : null, activity: a as CollectionActivity })
type Failure = { code: string | undefined; message: string } | null
const failure = (promise: Promise<unknown>): Promise<Failure> => promise.then(() => null, (error: { code?: string; message?: string }) => ({ code: error?.code, message: String(error?.message ?? error) }))
const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
// Every table 0027-0029 write to, and the setup tables 0030's functions read.
const TABLES = ['collection_activity_records', 'collection_activity_versions', 'collection_activity_heads', 'collection_activity_requests', 'collection_activity_evidence_links', 'collection_electricity_instruments',
  'collection_grid_loss_lineage', 'collection_evidence_objects', 'company_setup_versions', 'company_setup_heads', 'company_setup_locations', 'companies', 'company_members', 'staging_access']
const METHOD_STORE = "select (select count(*)::int from neuvetra.method_register_approvals) approvals,(select count(*)::int from neuvetra.method_release_decisions) decisions,(select count(*)::int from neuvetra.method_versions) versions,(select count(*)::int from neuvetra.method_releases) releases,(select count(*)::int from neuvetra.method_factor_values) factors"
const NEW_TABLES = ['scope3_category_assessments', 'scope3_assessment_requests', 'scope3_spend_imports', 'scope3_spend_import_lines', 'scope3_spend_mapping_versions', 'scope3_report_versions', 'scope3_report_requests', 'scope3_report_approvals']
/** The 1,016 NAICS codes of the EPA Supply Chain v1.3 CO2e file (test data read from the primary file; see its note). */
const V13 = JSON.parse(readFileSync(new URL('./testdata/epa-scghg-v1.3-naics-codes.json', import.meta.url), 'utf8')) as { source: { sha256: string }; codes: string[] }
type Q = { query: <R>(sql: string, args?: unknown[]) => Promise<{ rows: R[] }> }

describe('0030: Scope 3 completion in the database (I-02)', () => {
  let db: PGlite
  let before: Record<string, unknown[]>
  let functionsBefore: Array<{ f: string; h: string }>
  let methodSourcesBefore: number
  let methodStoreBefore: unknown
  let methodSourceRowsBefore: unknown[]
  const drift: Array<{ label: string; code: string | undefined; message: string; unchanged: boolean }> = []
  const at29 = new Map<string, boolean>()
  const savedBefore: Array<{ id: string; version: string }> = []
  const asUser = <T,>(actor: string, operation: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]); await tx.exec('set local role neuvetra_runtime')
    return operation({ query: async <R,>(sql: string, args: unknown[] = []) => ({ rows: (await tx.query<R>(sql, args)).rows }), exec: async (sql: string) => { await tx.exec(sql) } })
  })
  const rpc = <R,>(actor: string, fn: string, target: string, body: unknown) => asUser(actor, async tx => (await tx.query<R>(`select * from neuvetra.${fn}($1,$2::text::jsonb)`, [target, JSON.stringify(body)])).rows[0]!)
  const snapshot = async (on: Q = db) => Object.fromEntries(await Promise.all(TABLES.map(async table => [table, (await on.query(`select to_jsonb(t)::text row from neuvetra.${table} t order by 1`)).rows]))) as Record<string, unknown[]>
  const functions = async (on: Q = db) => (await on.query<{ f: string; h: string }>("select p.oid::regprocedure::text f, md5(p.prosrc||coalesce(array_to_string(p.proconfig,','),'')||p.prosecdef::text) h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' order by 1")).rows
  const raw = (a: unknown) => db.query('select neuvetra.collection_assert_activity($1::text::jsonb)', [JSON.stringify(a)])
  const fixtureActivity = (f: typeof SCOPE3_PAYLOAD_FIXTURES[number], index: number) => ({ ...linkage, kind: f.kind, sourceId: `FX-${index}`, quantity: f.quantity, payload: f.payload })
  const contractAccepts = (a: unknown) => { try { validateCollectionActivity(a); return true } catch { return false } }

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    const manifest = await readMigrationManifest()
    for (const migration of manifest.slice(0, 26)) await db.exec(migration.sql)
    await db.exec(`create schema storage;
      create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
      alter table storage.objects enable row level security; grant usage on schema storage to authenticated,anon;`)
    for (const migration of manifest.slice(26, 29)) await db.exec(migration.sql)
    await db.query('insert into auth.users(id) values($1),($2),($3)', [owner, member, outsider])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Completion A','US','CA',$2),($3,'Synthetic Completion B','US','CA',$4)", [company, owner, otherCompany, outsider])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner'),($1,$3,'member'),($4,$5,'owner')", [company, owner, member, otherCompany, outsider])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true),($3,$2,true),($4,$5,true)', [owner, company, member, outsider, otherCompany])
    // An earlier setup version (revision 1) and the current one (revision 2) for the company; one version for the other company.
    // I-02b: setup versions carry the reporting period whose last day gives the reporting year (calendar 2025 here).
    await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,1,'{}',$3,'2025-01-01','2026-01-01','unknown',$4)", [oldSetup, company, 'a'.repeat(64), owner])
    await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,previous_version_id,correction_reason,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,2,$3,'Synthetic correction','{}',$4,'2025-01-01','2026-01-01','operational_control',$5)", [setupVersion, company, oldSetup, 'b'.repeat(64), owner])
    await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,1,'{}',$3,'2025-01-01','2026-01-01','unknown',$4)", [otherSetup, otherCompany, 'a'.repeat(64), outsider])
    await db.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,2),($3,$4,1)', [company, setupVersion, otherCompany, otherSetup])
    for (const [version, target, location] of [[setupVersion, company, locationId], [otherSetup, otherCompany, otherLocation]] as const)
      await db.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Synthetic office','San Francisco','Office','owned','reporting_company','included','','','','period_start','period_end')", [target, version, location])
    // At 29: Scope 1, Scope 2 and every 0029 kind, one corrected and one withdrawn.
    for (const a of [gas, electricity, ...Object.values(legacy)]) {
      const saved = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request(a)))
      savedBefore.push({ id: saved.record.id, version: saved.version.id })
    }
    const corrected = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, savedBefore[2]!.id, request({ ...legacy.transport, quantity: q('1300', 'short ton-mile') }, { revision: 1, id: savedBefore[2]!.version })))
    await asUser(owner, tx => saveCollectionActivity(tx, owner, company, savedBefore[2]!.id, request({ ...legacy.transport, quantity: q('1300', 'short ton-mile'), state: 'withdrawn', withdrawalReason: 'Duplicate lane.' }, { revision: 2, id: corrected.version.id })))
    // What the 0029 database says about every fixture, before 0030.
    for (const [index, f] of SCOPE3_PAYLOAD_FIXTURES.entries()) at29.set(f.label, (await failure(raw(fixtureActivity(f, index)))) === null)
    before = await snapshot()
    functionsBefore = await functions()
    methodSourcesBefore = (await db.query<{ n: number }>('select count(*)::int n from neuvetra.method_source_documents')).rows[0]!.n
    methodStoreBefore = (await db.query(METHOD_STORE)).rows[0]
    methodSourceRowsBefore = (await db.query("select to_jsonb(d)::text row from neuvetra.method_source_documents d order by 1")).rows
    // I-02b (AM-01): over a database whose 0029 functions were changed, 0030 stops with 55000 and changes nothing. Each
    // case alters 0029 inside a transaction, tries 0030 in a savepoint, compares, and rolls everything back.
    const definition = async (signature: string) => (await db.query<{ d: string }>('select pg_get_functiondef($1::regprocedure) d', [signature])).rows[0]!.d
    const assertDef = await definition('neuvetra.collection_assert_activity(jsonb)'), saveDef = await definition('neuvetra.save_collection_activity(uuid,uuid,jsonb)')
    const cases: Array<[string, string]> = [
      ['collection_assert_activity body edited by hand', assertDef.replace('AS $function$', 'AS $function$\n-- edited by hand')],
      ['save_collection_activity body edited by hand', saveDef.replace("raise exception 'collection idempotency conflict'", "raise exception 'collection idempotency conflict (edited)'")],
      ['save_collection_activity parameter renamed', `drop function neuvetra.save_collection_activity(uuid,uuid,jsonb); ${saveDef.replace('(target_company uuid, target_record uuid, request jsonb)', '(company uuid, target_record uuid, request jsonb)')}`],
      ['collection_assert_activity missing', 'drop function neuvetra.collection_assert_activity(jsonb)'],
    ]
    const collectionSignatures = (await db.query("select string_agg(p.oid::regprocedure::text||' '||pg_get_function_identity_arguments(p.oid)||' '||md5(p.prosrc),',' order by p.oid::regprocedure::text) s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and p.proname in('collection_assert_activity','save_collection_activity')")).rows
    for (const [label, alter] of cases) {
      const rollback = new Error('rollback')
      await db.transaction(async tx => {
        await tx.exec(alter)
        const [rows, fns] = [await snapshot(tx), await functions(tx)]
        const signatures = async (on: Q) => (await on.query("select string_agg(p.oid::regprocedure::text||' '||pg_get_function_identity_arguments(p.oid)||' '||md5(p.prosrc),',' order by p.oid::regprocedure::text) s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and p.proname in('collection_assert_activity','save_collection_activity')")).rows
        if (JSON.stringify(await signatures(tx)) === JSON.stringify(collectionSignatures)) throw new Error(`${label}: the alteration changed nothing`)
        await tx.exec('savepoint drift')
        const refused = await failure(tx.exec(manifest[29]!.sql))
        await tx.exec('rollback to savepoint drift')
        const unchanged = JSON.stringify([await snapshot(tx), await functions(tx)]) === JSON.stringify([rows, fns])
          && (await tx.query<{ n: number }>("select count(*)::int n from pg_class where relname='scope3_category_assessments'")).rows[0]!.n === 0
        drift.push({ label, code: refused?.code, message: refused?.message ?? '', unchanged })
        throw rollback
      }).catch(error => { if (error !== rollback) throw error })
    }
    expect(await functions()).toEqual(functionsBefore)
    await db.exec(manifest[29]!.sql)
  }, 180_000)
  afterAll(async () => { await db.close() })

  // BF-09: 0031 follows 0030 (hosted.test.ts and the native suites test it); this file keeps testing the database at schema 30.
  test('0030 follows 0029; every row saved before it is byte-identical; only the two collection functions change', async () => {
    expect(STAGING_MIGRATIONS.slice(26)).toEqual(['0027_collection.sql', '0028_collection_zip_check.sql', '0029_scope3_collection.sql', '0030_scope3_completion.sql', '0031_integrity_guards.sql', '0032_instrument_identity_and_bindings.sql'])
    expect(before.collection_activity_versions).toHaveLength(9)
    expect(await snapshot()).toEqual(before)
    const after = await functions()
    const changed = functionsBefore.filter(f => after.find(g => g.f === f.f)?.h !== f.h).map(f => f.f)
    expect(changed).toEqual(['neuvetra.collection_assert_activity(jsonb)', 'neuvetra.save_collection_activity(uuid,uuid,jsonb)'])
    expect(functionsBefore.every(f => after.some(g => g.f === f.f))).toBe(true)
    const checks = await db.query<{ conname: string }>("select conname from pg_constraint where conrelid='neuvetra.collection_activity_records'::regclass and contype='c' order by 1")
    expect(checks.rows.map(row => row.conname)).toEqual(['collection_activity_records_kind_check', 'collection_activity_records_scope_check', 'collection_activity_records_scope_kind_check'])
    // The one method-store change: the EPA Supply Chain v1.3 CO2e file as a source document (audited like every insert).
    const sources = await db.query<{ id: string; sha256: string; bytes: string; media_type: string; source_use: string; retrieved_on: string }>("select id,sha256,bytes::text,media_type,source_use,retrieved_on::text from neuvetra.method_source_documents where id='30000000-0000-4000-8000-000000000001'")
    expect(sources.rows).toEqual([{ id: '30000000-0000-4000-8000-000000000001', sha256: '6025a14c4fe16675735efba1683030e4d36011e3973f3c4261f8231aa69c002f', bytes: '123481', media_type: 'text/csv', source_use: 'numeric_values_with_citation', retrieved_on: '2026-09-08' }])
    expect((await db.query<{ n: number }>('select count(*)::int n from neuvetra.method_source_documents')).rows[0]!.n).toBe(methodSourcesBefore + 1)
    // No register approval, release decision, method version, release or factor value (methods stay unreleased beta; A5).
    expect((await db.query(METHOD_STORE)).rows[0]).toEqual(methodStoreBefore)
    // AM-19: every source document that existed is byte-identical; the one new row is exactly the EPA v1.3 file.
    const sourceRows = (await db.query<{ row: string }>("select to_jsonb(d)::text row from neuvetra.method_source_documents d order by 1")).rows
    expect(sourceRows.filter(r => !r.row.includes('30000000-0000-4000-8000-000000000001'))).toEqual(methodSourceRowsBefore as { row: string }[])
    // Earlier records still read back through the contract, the 0029 hotel record unchanged.
    const records = await asUser(owner, tx => readCollectionActivities(tx, company))
    expect(records).toHaveLength(7)
    expect(records.find(r => r.currentVersion.activity.sourceId === 'HOTEL-1')!.currentVersion.activity).toEqual(validateCollectionActivity(legacy.hotel))
  })

  test('AM-01: over altered 0029 functions 0030 stops with 55000 and changes nothing', () => {
    expect(drift.map(d => d.label)).toEqual(['collection_assert_activity body edited by hand', 'save_collection_activity body edited by hand', 'save_collection_activity parameter renamed', 'collection_assert_activity missing'])
    for (const d of drift) expect([d.label, d.code, d.message, d.unchanged]).toEqual([d.label, '55000', '0030: the collection functions differ from 0029; re-derive 0030 from the applied 0029', true])
  })

  test('the shared fixture table: the contract and the 0030 database accept and refuse exactly the same payloads', async () => {
    const perKind = new Map<string, { valid: number; invalid: number }>()
    for (const [index, f] of SCOPE3_PAYLOAD_FIXTURES.entries()) {
      const a = fixtureActivity(f, index)
      const database = (await failure(raw(a))) === null
      expect([f.label, contractAccepts(a), database]).toEqual([f.label, f.valid, f.valid])
      const counts = perKind.get(f.kind) ?? { valid: 0, invalid: 0 }; counts[f.valid ? 'valid' : 'invalid']++; perKind.set(f.kind, counts)
    }
    for (const kind of SCOPE3_COLLECTION_KINDS) expect([kind, perKind.get(kind)!.valid >= 5, perKind.get(kind)!.invalid >= 5]).toEqual([kind, true, true])
    // I-02b: every amendment rule has at least three valid and three invalid entries.
    const perRule = new Map<string, { valid: number; invalid: number }>()
    for (const f of SCOPE3_PAYLOAD_FIXTURES) if (f.rule) { const c = perRule.get(f.rule) ?? { valid: 0, invalid: 0 }; c[f.valid ? 'valid' : 'invalid']++; perRule.set(f.rule, c) }
    expect([...perRule.keys()].sort()).toEqual(['AM-04 category 9 attestation and estimate basis', 'AM-04 category 9 never imported', 'AM-04 dollar year 2012-2035', 'AM-04 duplicate confirmed distinct', 'AM-04 line date', 'AM-04 possible duplicate', 'AM-04 spend categories 1-6 and 9',
      'AM-07 data year 2012-2035', 'AM-07 factor origin', 'AM-07 hybrid boundary', 'AM-07 supplier supersedes spend', 'AM-08 partner categories', 'AM-08 partner supersedes spend', 'AM-09 asset categories', 'AM-10 commuting activity overlap', 'AM-11 resold energy not in Scope 2',
      'AM-12 release basis', 'AM-12 use-phase release percent', 'AM-13 end-of-life product label', 'AM-14 covered days 1-366', 'AM-15 revenue year 2012-2035'])
    for (const [rule, c] of perRule) expect([rule, c.valid >= 3, c.invalid >= 3]).toEqual([rule, true, true])
    // Every kind's normalized units, and units of other kinds, agree too.
    const everyUnit = [...new Set(Object.values(SCOPE3_COLLECTION_UNITS).flat()), 'therm', 'US_gallon', 'kWh', 'gallon', 'ton']
    for (const kind of SCOPE3_COLLECTION_KINDS) {
      const base = SCOPE3_PAYLOAD_FIXTURES.find(f => f.kind === kind && f.valid)!
      for (const unit of everyUnit) {
        const a = { ...fixtureActivity(base, 0), quantity: q('10', unit) }
        expect([kind, unit, (await failure(raw(a))) === null]).toEqual([kind, unit, contractAccepts(a)])
        expect([kind, unit, contractAccepts(a)]).toEqual([kind, unit, SCOPE3_COLLECTION_UNITS[kind].includes(unit)])
      }
    }
    // The database refuses with 22023, which the route reports as invalid input (422), never as an outage.
    const bad = SCOPE3_PAYLOAD_FIXTURES.find(f => !f.valid && f.kind === 'investment')!
    expect((await failure(raw(fixtureActivity(bad, 0))))?.code).toBe('22023')
  })

  test('AM-05: scope3SpendNaicsAllowed and scope3_spend_naics_allowed agree on all 1,016 v1.3 codes for every category', async () => {
    expect([V13.codes.length, new Set(V13.codes).size, V13.source.sha256]).toEqual([1016, 1016, '6025a14c4fe16675735efba1683030e4d36011e3973f3c4261f8231aa69c002f'])
    // Every code of every set is a v1.3 code, except the one the set names as absent.
    const known = new Set(V13.codes)
    for (const [name, codes] of Object.entries(SCOPE3_SPEND_NAICS_SETS)) {
      expect([name, (codes as readonly string[]).filter(code => known.has(code) === (name === 'absent'))]).toEqual([name, []])
      expect([name, [...codes].sort(), new Set(codes).size]).toEqual([name, [...codes], codes.length])
    }
    expect([...SCOPE3_SPEND_NAICS_SETS.overlap_confirm] as string[]).toEqual([...new Set([...SCOPE3_SPEND_NAICS_SETS.freight, ...SCOPE3_SPEND_NAICS_SETS.passenger, ...SCOPE3_SPEND_NAICS_SETS.waste])].sort())
    expect([...SCOPE3_SPEND_NAICS_SETS.trade_sector] as string[]).toEqual(V13.codes.filter(code => /^4[245]/.test(code) && !(SCOPE3_SPEND_NAICS_SETS.energy_confirm as readonly string[]).includes(code)))
    expect([SCOPE3_SPEND_NAICS_SETS.freight.length, SCOPE3_SPEND_NAICS_SETS.passenger.length, SCOPE3_SPEND_NAICS_SETS.waste.length, SCOPE3_SPEND_NAICS_SETS.fuel_proxy.length, SCOPE3_SPEND_NAICS_SETS.energy_confirm.length, SCOPE3_SPEND_NAICS_SETS.trade_sector.length]).toEqual([35, 20, 12, 5, 16, 134])
    // 1,016 codes (plus a code v1.3 lacks and a malformed one) x the seven spend categories and five others, in one query.
    const codes = [...V13.codes, '221100', '00000']
    const categories = [...SCOPE3_SPEND_CATEGORIES, 0, 7, 8, 12, 15]
    const sql = (await db.query<{ c: number; n: string; ok: boolean }>('select c, n, neuvetra.scope3_spend_naics_allowed(c, n) ok from unnest($1::int[]) c cross join unnest($2::text[]) n', [categories, codes])).rows
    expect(sql).toHaveLength(codes.length * categories.length)
    const disagree = sql.filter(row => row.ok !== scope3SpendNaicsAllowed(row.c, row.n)).map(row => `${row.c}:${row.n}`)
    expect(disagree).toEqual([])
    const allowed = (category: number) => sql.filter(row => row.c === category && row.ok).length
    expect(SCOPE3_SPEND_CATEGORIES.map(allowed)).toEqual([1018, 1018, 5, 35, 12, 20, 35])
    for (const category of [0, 7, 8, 12, 15]) expect(allowed(category)).toBe(0)
    // No code: categories 1 and 2 only; no category: nothing.
    expect((await db.query<{ a: boolean; b: boolean; c: boolean }>("select neuvetra.scope3_spend_naics_allowed(1,null) a, neuvetra.scope3_spend_naics_allowed(4,null) b, neuvetra.scope3_spend_naics_allowed(null,'484121') c")).rows[0]).toEqual({ a: true, b: false, c: false })
    expect([scope3SpendNaicsAllowed(1, null), scope3SpendNaicsAllowed(4, null)]).toEqual([true, false])
  })

  test('schema 29 refused exactly the payloads that need schema 30, which the contract names', () => {
    for (const f of SCOPE3_PAYLOAD_FIXTURES) {
      const required = scope3SchemaRequired({ kind: f.kind, payload: f.payload, quantity: f.quantity })
      expect([f.label, at29.get(f.label)]).toEqual([f.label, f.valid && required === 29])
      if ((SCOPE3_COMPLETION_KINDS as readonly string[]).includes(f.kind)) expect(required).toBe(30)
    }
    // room-night is normalized only from 0030; written but not normalized it was already storable at 29.
    expect(at29.get('business_travel: 0029 hotel record as saved by the r3 feeds (room-night not normalized)')).toBe(true)
    expect(at29.get('business_travel: v2 hotel stay in room-nights (normalized from 0030)')).toBe(false)
  })

  test('every valid fixture saves as scope 3 through the real save path and reads back byte for byte', async () => {
    const context: CollectionContext = { companyId: company, setupVersionId: setupVersion, setupRevision: 2, sameContentSetupVersionIds: [setupVersion], boundaryApproach: 'operational_control', reportingPeriod: linkage.period,
      locations: [{ id: locationId, name: 'Synthetic office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
    let saved = 0
    for (const [index, f] of SCOPE3_PAYLOAD_FIXTURES.entries()) {
      if (!f.valid) continue
      const a = fixtureActivity(f, index)
      const result = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request(a)))
      expect(result.version.activity).toEqual(validateCollectionActivity(a))
      const row = (await db.query<{ scope: number; zip: string | null; utility: string | null }>('select r.scope,v.electricity_zip zip,v.utility_eia_id utility from neuvetra.collection_activity_records r join neuvetra.collection_activity_versions v on v.record_id=r.id where r.id=$1', [result.record.id])).rows
      expect([f.label, row]).toEqual([f.label, [{ scope: 3, zip: null, utility: null }]])
      // New kinds are held with a plain reason until their method is built; the category is the record's own.
      const plan = planScope3Calculation(result.version as unknown as Scope3CollectionVersion, context, [])
      expect((SCOPE3_KIND_CATEGORIES[f.kind] as readonly number[]).includes(plan.category)).toBe(true)
      // I-03: spend lines and supplier figures have their method; each is calculated or held with its own named reasons.
      // I-05: so do energy resold, average commuting, teleworking, asset energy and partner figures (names, attestations and
      // data quality never sent); buildings by floor area wait for their factor source (method_pending) unless input is needed.
      // I-07: so do the category 11, 12 and 15 kinds (product labels, release and split bases, investee names never sent):
      // no kind is held `method_not_built_yet` any more.
      if (['purchase_spend', 'purchase_supplier', 'energy_resold', 'commuting_average', 'teleworking', 'asset_energy', 'partner_reported',
        'sold_fuel', 'sold_energy_product', 'sold_ghg_product', 'end_of_life_split', 'investment'].includes(f.kind)) {
        expect([f.label, plan.action === 'calculate' ? plan.reasons : plan.reasons.length > 0 && !plan.reasons.includes('method_not_built_yet')]).toEqual([f.label, plan.action === 'calculate' ? [] : true])
        expect([f.label, /dataQuality|counterpartyName|assetLabel|resoldEnergyNotInScope2|activityOverlap|leaseType|supersedesSpend|sharesBasis|baselineBasis|productLabel|releaseBasis|splitBasis|lifetimeSource|investeeName|snapshotDate|initialSponsor/.test(JSON.stringify(plan.call?.request.input ?? {}))]).toEqual([f.label, false])
      } else if (f.kind === 'building_average') expect([f.label, plan.status === 'method_pending' ? plan.reasons : plan.reasons.includes('method_not_built_yet')]).toEqual([f.label, plan.status === 'method_pending' ? ['factor_source_not_yet_loaded'] : false])
      else if ((SCOPE3_COMPLETION_KINDS as readonly string[]).includes(f.kind)) throw new Error(`${f.label}: a kind without a method branch`)
      // A1 and A3: data quality, cabin class and hotel country are recorded but never sent to the engine (input hashes unchanged).
      else expect([f.label, /dataQuality|cabinClass|hotelCountry/.test(JSON.stringify(plan.call?.request.input ?? {}))]).toEqual([f.label, false])
      if (f.label === 'business_travel: v2 with cabin class' || f.label === 'transport: with data quality') expect([f.label, plan.action]).toEqual([f.label, 'calculate'])
      saved++
    }
    expect(saved).toBe(SCOPE3_PAYLOAD_FIXTURES.filter(f => f.valid).length)
    // A new-kind record is corrected and withdrawn under the same rules as every other record, and its kind can't change.
    const spend = SCOPE3_PAYLOAD_FIXTURES.find(f => f.kind === 'purchase_spend' && f.valid)!
    const first = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request(fixtureActivity(spend, 900))))
    const second = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, first.record.id, request({ ...fixtureActivity(spend, 900), quantity: q('130000', 'USD') }, { revision: 1, id: first.version.id })))
    expect(second.version.revision).toBe(2)
    const other = SCOPE3_PAYLOAD_FIXTURES.find(f => f.kind === 'investment' && f.valid)!
    expect((await failure(asUser(owner, tx => saveCollectionActivity(tx, owner, company, first.record.id, request(fixtureActivity(other, 900), { revision: 2, id: second.version.id })))))?.message).toContain('kind cannot change')
    // The company's other members, and other companies, see exactly what RLS allows.
    expect((await asUser(member, tx => readCollectionActivities(tx, company))).length).toBeGreaterThan(saved)
    expect(await asUser(outsider, tx => readCollectionActivities(tx, company))).toEqual([])
  })

  test('the scope and kind pairing holds for every writer, for every new kind', async () => {
    const insert = (scope: number, kind: string) => failure(db.query('insert into neuvetra.collection_activity_records(id,company_id,scope,kind,created_by) values($1,$2,$3,$4,$5)', [crypto.randomUUID(), company, scope, kind, owner]))
    for (const kind of SCOPE3_COMPLETION_KINDS) {
      expect((await insert(1, kind))?.message).toContain('scope_kind_check')
      expect((await insert(2, kind))?.message).toContain('scope_kind_check')
    }
    expect((await insert(3, 'natural_gas'))?.message).toContain('scope_kind_check')
    expect((await insert(3, 'hotel_stay'))?.message).toContain('kind_check')
  })

  const assessment = (extra: Record<string, unknown> = {}) => fixtureAssessment(setupVersion, extra)
  const saveAssessment = (actor: string, body: Record<string, unknown>, target = company) => rpc<{ assessment_id: string; revision: number; replayed: boolean }>(actor, 'save_scope3_category_assessment', target, body)

  test('category assessments: revisions, replay, conflicts, corrections and the current setup version', async () => {
    const first = { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: assessment() }
    expect(validateScope3AssessmentSaveInput(first) as unknown).toEqual(first)
    const one = await saveAssessment(owner, first)
    expect([one.revision, one.replayed]).toEqual([1, false])
    expect(await saveAssessment(owner, first)).toEqual({ ...one, replayed: true })
    expect((await failure(saveAssessment(owner, { ...first, assessment: assessment({ justification: 'Changed.' }) })))?.code).toBe('23505')
    expect((await failure(saveAssessment(owner, { ...first, idempotencyKey: crypto.randomUUID() })))?.code).toBe('23505') // stale revision
    expect((await failure(saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, correctionReason: null, assessment: assessment() })))?.code).toBe('22023')
    const two = await saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, correctionReason: 'Estimate updated with 2025 spend.', assessment: assessment({ magnitudeTCo2e: '98.25' }) })
    expect(two.revision).toBe(2)
    const stored = (await db.query<{ revision: number; previous_id: string; magnitude_t_co2e: string; planned_method_types: string[] }>('select revision,previous_id,magnitude_t_co2e,planned_method_types from neuvetra.scope3_category_assessments where id=$1', [two.assessment_id])).rows[0]!
    expect(stored).toEqual({ revision: 2, previous_id: one.assessment_id, magnitude_t_co2e: '98.25', planned_method_types: ['spend_based'] })
    // The heads view gives the latest revision per category, to company members only.
    const heads = await asUser(member, async tx => (await tx.query<{ category: number; revision: number; reporting_year: number }>('select reporting_year,category,revision from neuvetra.scope3_category_assessment_heads')).rows)
    expect(heads).toEqual([{ reporting_year: 2025, category: 1, revision: 2 }])
    expect(await asUser(outsider, async tx => (await tx.query('select 1 from neuvetra.scope3_category_assessment_heads')).rows)).toEqual([])
    // Not the current setup version, a member without manager rights, another company, evidence that isn't the company's.
    expect((await failure(saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: assessment({ category: 2, setupVersionId: oldSetup }) })))?.code).toBe('23503')
    expect((await failure(saveAssessment(member, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: assessment({ category: 2 }) })))?.code).toBe('42501')
    expect((await failure(saveAssessment(outsider, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: assessment({ category: 2 }) })))?.code).toBe('42501')
    expect((await failure(saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: assessment({ category: 2, evidenceIds: [crypto.randomUUID()] }) })))?.code).toBe('23503')
    // Category 3's energy-resale answer.
    const three = await saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: assessment({ category: 3, reasonCode: null, magnitudeKind: null, magnitudeTCo2e: null, magnitudeBasis: '', energyResale: 'resells_energy', activitiesIncluded: 'Electricity bought and resold to tenants.' }) })
    expect(three.revision).toBe(1)
    // AM-17: documented within-category exclusions are stored as given.
    const exclusions = [{ noteCode: 'nuclear_biomass_byproduct_fuels_upstream_excluded', justification: 'Under 1% of purchased fuel energy.', magnitudeKind: 'estimated', magnitudeTCo2e: '0.8', basis: 'Fuel mix share.' }]
    const four = await saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, correctionReason: 'Documented the 3B exclusion.', assessment: assessment({ category: 3, reasonCode: null, magnitudeKind: null, magnitudeTCo2e: null, magnitudeBasis: '', energyResale: 'resells_energy', withinCategoryExclusions: exclusions }) })
    expect((await db.query<{ w: unknown; y: number }>('select within_category_exclusions w, reporting_year y from neuvetra.scope3_category_assessments where id=$1', [four.assessment_id])).rows[0]).toEqual({ w: exclusions, y: 2025 })
    // AM-03: the year must be the setup's (calendar 2025 here); another year is refused before anything is saved.
    for (const reportingYear of [2024, 2026]) expect((await failure(saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: assessment({ category: 4, reportingYear }) })))?.code).toBe('22023')
  })

  test('the assessment contract and 0030 agree on every assessment rule', async () => {
    const cases = scope3AssessmentFixtures(setupVersion)
    for (const { label, value, valid } of cases) {
      const contract = (() => { try { validateScope3Assessment(value); return true } catch { return false } })()
      const database = (await failure(db.query('select neuvetra.scope3_assert_assessment($1::text::jsonb)', [JSON.stringify(value)]))) === null
      expect([label, contract, database]).toEqual([label, valid, valid])
    }
    // I-02b: at least three valid and three invalid entries for each amendment rule.
    for (const rule of ['AM-03 reporting year', 'AM-17 within-category exclusions']) {
      const tagged = cases.filter(c => c.rule === rule)
      expect([rule, tagged.filter(c => c.valid).length >= 3, tagged.filter(c => !c.valid).length >= 3]).toEqual([rule, true, true])
    }
  })

  const evidenceId = '30700000-0000-4000-8000-000000000001'
  const fileSha = sha256('synthetic spend export v1')
  /** A line's fingerprint (I-02b, AM-16): SHA-256 of scope3SpendLineFingerprintInput. */
  const fingerprint = (lineId: string, amount = '100') => sha256(scope3SpendLineFingerprintInput({ lineId, date: '2025-03-31', vendor: 'Synthetic vendor', amount, currency: 'USD' }))
  const spendRow = (n: number, value: string, currency: string, importId: string, extra: Record<string, unknown> = {}, lineFingerprint = fingerprint(`${importId}-${n}`), linked = linkage) => {
    const normalized = currency === 'USD' && /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value)
    return { recordId: crypto.randomUUID(), lineFingerprint, request: request({ ...linked, kind: 'purchase_spend', sourceId: `row-${n}`, reference: `spend import export.csv sha256 ${fileSha.slice(0, 12)} row ${n}`, quantity: q(value, currency, normalized),
      payload: { category: 1, naicsCode: '541511', dollarYear: null, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: 'unknown', supplierName: 'Synthetic vendor', glAccount: '6100', description: `Line ${n}`, categoryConfirmed: false, activityOverlap: 'unknown', importId, importRow: n, mappingSource: 'file',
        paidByReportingCompany: null, spendEstimateBasis: null, lineDate: '2025-03-31', possibleDuplicateOf: null, duplicateConfirmedDistinct: false, ...extra } }) }
  }
  const spendImport = (importId: string, rows: ReturnType<typeof spendRow>[], fileTotals: Record<string, string>, nonNumericRows: number, sha = fileSha, extra: Record<string, unknown> = {}) =>
    ({ importId, fileSha256: sha, fileName: 'export.csv', evidenceId, locationId, setupVersionId: setupVersion, reportingYear: 2025, rowCount: rows.length, fileTotals, nonNumericRows, rows, ...extra })
  const countSpend = async () => (await db.query<{ n: number }>("select count(*)::int n from neuvetra.collection_activity_records where kind='purchase_spend'")).rows[0]!.n

  test('spend import: one transaction, reconciled per currency, idempotent per file', async () => {
    await db.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,'export.csv','text/csv',24,$4,$5)", [evidenceId, company, `${company}/original/${evidenceId}`, fileSha, owner])
    const before = await countSpend()
    const importId = crypto.randomUUID()
    const rows = [spendRow(1, '1200.50', 'USD', importId), spendRow(2, '99.5', 'USD', importId), spendRow(3, '-25', 'USD', importId), spendRow(4, '400', 'EUR', importId), spendRow(5, 'n/a', 'USD', importId)]
    // Atomic: one invalid line (blank description) saves nothing, not even the import.
    const broken = [...rows.slice(0, 4), spendRow(5, 'n/a', 'USD', importId, { description: '' })]
    expect((await failure(rpc(owner, 'import_scope3_spend', company, spendImport(importId, broken, { USD: '1275', EUR: '400' }, 1))))?.code).toBe('22023')
    expect(await countSpend()).toBe(before)
    expect((await db.query('select 1 from neuvetra.scope3_spend_imports')).rows).toHaveLength(0)
    // The totals must reconcile exactly, and the non-numeric rows be counted.
    expect((await failure(rpc(owner, 'import_scope3_spend', company, spendImport(importId, rows, { USD: '1275.001', EUR: '400' }, 1))))?.message).toContain('reconcile')
    expect((await failure(rpc(owner, 'import_scope3_spend', company, spendImport(importId, rows, { USD: '1275' }, 1))))?.message).toContain('reconcile')
    expect((await failure(rpc(owner, 'import_scope3_spend', company, spendImport(importId, rows, { USD: '1275', EUR: '400' }, 0))))?.message).toContain('reconcile')
    // Rows belong to the import, in order; the evidence is the file itself.
    expect((await failure(rpc(owner, 'import_scope3_spend', company, spendImport(importId, [rows[1]!, rows[0]!, ...rows.slice(2)], { USD: '1275', EUR: '400' }, 1))))?.code).toBe('22023')
    expect((await failure(rpc(owner, 'import_scope3_spend', company, spendImport(importId, rows, { USD: '1275', EUR: '400' }, 1, sha256('another file')))))?.code).toBe('23503')
    expect((await failure(rpc(member, 'import_scope3_spend', company, spendImport(importId, rows, { USD: '1275', EUR: '400' }, 1))))?.code).toBe('42501')
    // I-02b: never category 9 (AM-04); a code outside the category's set (AM-06); the setup's reporting year (AM-03).
    const withRow = (row: ReturnType<typeof spendRow>) => spendImport(importId, [...rows.slice(0, 4), row], { USD: '1275', EUR: '400' }, 1)
    const category9 = spendRow(5, 'n/a', 'USD', importId, { category: 9, naicsCode: '484121', paidByReportingCompany: false, spendEstimateBasis: 'Carrier rate card.' })
    expect(await failure(rpc(owner, 'import_scope3_spend', company, withRow(category9)))).toEqual({ code: '22023', message: 'Scope 3 import row 5 is category 9, which is entered by hand' })
    for (const [category, naics] of [[4, '541511'], [6, '484121'], [5, '721110'], [3, '562212']] as const)
      expect((await failure(rpc(owner, 'import_scope3_spend', company, withRow(spendRow(5, 'n/a', 'USD', importId, { category, naicsCode: naics }))))) ?? null).toEqual({ code: '22023', message: 'Scope 3 import row 5 has a NAICS code outside its category' })
    for (const reportingYear of [2024, 2026]) expect((await failure(rpc(owner, 'import_scope3_spend', company, spendImport(importId, rows, { USD: '1275', EUR: '400' }, 1, fileSha, { reportingYear }))))?.code).toBe('22023')
    expect((await failure(rpc(owner, 'import_scope3_spend', company, spendImport(importId, rows, { USD: '1275', EUR: '400' }, 1, fileSha, { reportingYear: null }))))?.code).toBe('22023')
    expect(await countSpend()).toBe(before)
    const done = await rpc<{ import_id: string; replayed: boolean; saved: number }>(owner, 'import_scope3_spend', company, spendImport(importId, rows, { USD: '1275', EUR: '400' }, 1))
    expect(done).toEqual({ import_id: importId, replayed: false, saved: 5 })
    expect(await countSpend()).toBe(before + 5)
    // Every line is a saved spend record (held or calculable later), read back through the contract.
    const records = (await asUser(owner, tx => readCollectionActivities(tx, company))).filter(r => (r.currentVersion.activity.payload as { importId?: string }).importId === importId)
    expect(records.map(r => r.currentVersion.activity.quantity.originalValue).sort()).toEqual(['-25', '1200.50', '400', '99.5', 'n/a'])
    // The same file again: the first import, nothing saved.
    const replayId = crypto.randomUUID()
    const again = await rpc<{ import_id: string; replayed: boolean; saved: number }>(owner, 'import_scope3_spend', company, spendImport(replayId, [spendRow(1, '1', 'USD', replayId)], { USD: '1' }, 0))
    expect(again).toEqual({ import_id: importId, replayed: true, saved: 0 })
    expect(await countSpend()).toBe(before + 5)
    const stored = (await db.query('select file_sha256,row_count,non_numeric_rows,file_totals,reporting_year from neuvetra.scope3_spend_imports')).rows
    expect(stored).toEqual([{ file_sha256: fileSha, row_count: 5, non_numeric_rows: 1, file_totals: { USD: '1275', EUR: '400' }, reporting_year: 2025 }])
    // One stored line per row, with its fingerprint and record; the replay added none.
    const lines = (await db.query<{ row_number: number; line_fingerprint: string; record_id: string }>('select row_number,line_fingerprint,record_id from neuvetra.scope3_spend_import_lines where import_id=$1 order by row_number', [importId])).rows
    expect(lines).toEqual(rows.map((row, i) => ({ row_number: i + 1, line_fingerprint: row.lineFingerprint, record_id: row.recordId })))
    firstImport = { importId, rows }
  })

  let firstImport: { importId: string; rows: Array<{ lineFingerprint: string }> }
  const readEarlierLines = (actor: string) => asUser(actor, async tx => (await tx.query<{ import_id: string; row_number: number; line_fingerprint: string }>(
    'select l.import_id,l.row_number,l.line_fingerprint from neuvetra.scope3_spend_import_lines l join neuvetra.scope3_spend_imports i on i.id=l.import_id order by i.created_at,l.import_id,l.row_number')).rows.map(r => ({ importId: r.import_id, row: r.row_number, fingerprint: r.line_fingerprint })))

  test('AM-16: line fingerprints find the same line in overlapping exports and twice in one file; the database checks each reference', async () => {
    const shaB = sha256('synthetic spend export, full year'), evidenceB = '30700000-0000-4000-8000-000000000002'
    await db.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,'full-year.csv','text/csv',30,$4,$5)", [evidenceB, company, `${company}/original/${evidenceB}`, shaB, owner])
    const importB = crypto.randomUUID()
    const first = firstImport
    // Row 1 repeats line 2 of the first export, rows 2 and 3 are the same new line, row 4 repeats line 4 of the first export.
    const fps = [first.rows[1]!.lineFingerprint, fingerprint('B-7'), fingerprint('B-7'), first.rows[3]!.lineFingerprint]
    const expected = scope3SpendPossibleDuplicates(importB, fps, await readEarlierLines(member))
    expect(expected).toEqual([{ importId: first.importId, row: 2 }, null, { importId: importB, row: 2 }, { importId: first.importId, row: 4 }])
    const rowsFor = (refs: Array<unknown>) => fps.map((fp, i) => spendRow(i + 1, '100', 'USD', importB, { possibleDuplicateOf: refs[i] }, fp))
    const body = (refs: Array<unknown>) => spendImport(importB, rowsFor(refs), { USD: '400' }, 0, shaB, { evidenceId: evidenceB })
    const before = await countSpend()
    // Each wrong reference is refused and nothing is saved: a duplicate left unflagged, a reference to a later row instead
    // of the earliest, a reference where there is no duplicate, an in-file duplicate pointed at the other file.
    for (const wrong of [[null, null, expected[2], expected[3]], [expected[0], null, { importId: importB, row: 3 }, expected[3]], [expected[0], { importId: first.importId, row: 1 }, expected[2], expected[3]], [expected[0], null, { importId: first.importId, row: 2 }, expected[3]]])
      expect(await failure(rpc(owner, 'import_scope3_spend', company, body(wrong)))).toEqual({ code: '40001', message: expect.stringContaining('has the wrong possible duplicate') })  // round 2 (ENG-10): a stable SQLSTATE the caller retries on
    expect(await countSpend()).toBe(before)
    const done = await rpc<{ import_id: string; saved: number }>(owner, 'import_scope3_spend', company, body(expected))
    expect([done.import_id, done.saved]).toEqual([importB, 4])
    // The same bytes again replay and store no line; the same file for another reporting year is a conflict.
    expect((await rpc<{ replayed: boolean }>(owner, 'import_scope3_spend', company, body(expected))).replayed).toBe(true)
    expect((await failure(rpc(owner, 'import_scope3_spend', company, { ...body(expected), reportingYear: 2026 })))?.code).toBe('23505')
    expect((await db.query<{ n: number }>('select count(*)::int n from neuvetra.scope3_spend_import_lines where import_id=$1', [importB])).rows[0]!.n).toBe(4)
    // A third export: each reference is to the earliest occurrence across both earlier imports.
    const shaC = sha256('synthetic spend export, Q4'), evidenceC = '30700000-0000-4000-8000-000000000003', importC = crypto.randomUUID()
    await db.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,'q4.csv','text/csv',30,$4,$5)", [evidenceC, company, `${company}/original/${evidenceC}`, shaC, owner])
    const fpsC = [fingerprint('B-7'), first.rows[1]!.lineFingerprint, fingerprint('C-1')]
    const expectedC = scope3SpendPossibleDuplicates(importC, fpsC, await readEarlierLines(owner))
    expect(expectedC).toEqual([{ importId: importB, row: 2 }, { importId: first.importId, row: 2 }, null])
    const doneC = await rpc<{ saved: number }>(owner, 'import_scope3_spend', company, spendImport(importC, fpsC.map((fp, i) => spendRow(i + 1, '100', 'USD', importC, { possibleDuplicateOf: expectedC[i] }, fp)), { USD: '300' }, 0, shaC, { evidenceId: evidenceC }))
    expect(doneC.saved).toBe(3)
    // The lines are company data: members read them, other companies don't, and nobody changes them.
    expect((await readEarlierLines(member)).length).toBe(12)
    expect(await readEarlierLines(outsider)).toEqual([])
    for (const statement of ['update neuvetra.scope3_spend_import_lines set row_number=row_number', 'delete from neuvetra.scope3_spend_import_lines', 'truncate neuvetra.scope3_spend_import_lines'])
      expect([statement, (await failure(db.exec(statement)))?.code]).toEqual([statement, '55000'])
    // The fingerprint text: trimmed, lower-cased line ID and vendor, the date as written, the amount, the currency upper-cased.
    expect(scope3SpendLineFingerprintInput({ lineId: ' INV-1 ', date: '2025-03-31', vendor: ' Acme Co ', amount: '1200.5', currency: 'usd' })).toBe('inv-1\u001f2025-03-31\u001facme co\u001f1200.5\u001fUSD')
  })

  test('spend mappings: versioned per key, with optimistic revisions', async () => {
    const mapping = { mappingKeySha256: sha256('6100\u001fsynthetic vendor\u001fsoftware consulting'), glAccount: '6100', vendor: 'Synthetic vendor', description: 'Software consulting', category: 1, naicsCode: '541511', marginChoice: 'with_margins' }
    // Round 2 (ENG-9): the group's lines and the attestations travel with the mapping (no lines here: corrected 0).
    const save = (actor: string, expectedRevision: number, m = mapping) => rpc<{ mapping_id: string; revision: number; corrected: number; unchanged: number }>(actor, 'save_scope3_spend_mapping', company, { expectedRevision, mapping: m, corrections: [], attestations: { categoryConfirmed: null, activityOverlapConfirmed: null } })
    expect(await save(owner, 0)).toMatchObject({ revision: 1, corrected: 0, unchanged: 0 })
    expect((await failure(save(owner, 0)))?.code).toBe('23505')
    expect((await save(owner, 1, { ...mapping, naicsCode: '541512' })).revision).toBe(2)
    // I-02b (AM-06): categories 1-6, never 9; a code inside its category's set.
    expect((await failure(save(owner, 2, { ...mapping, category: 9, naicsCode: '484121' })))?.code).toBe('22023')
    expect((await failure(save(owner, 2, { ...mapping, category: 7 })))?.code).toBe('22023')
    for (const [category, naics] of [[3, '541511'], [4, '541511'], [5, '484121'], [6, '562212']] as const)
      expect(await failure(save(owner, 2, { ...mapping, category, naicsCode: naics }))).toEqual({ code: '22023', message: 'invalid Scope 3 spend mapping: NAICS code outside its category' })
    expect((await save(owner, 2, { ...mapping, category: 4, naicsCode: '484121' })).revision).toBe(3)
    expect((await save(owner, 3, { ...mapping, category: 5, naicsCode: '221320' })).revision).toBe(4)
    expect((await save(owner, 4, { ...mapping, naicsCode: '541512' })).revision).toBe(5)
    // The table itself refuses what the function refuses, whoever writes.
    for (const [category, naics] of [[9, '484121'], [4, '541511']] as const)
      expect((await failure(db.query("insert into neuvetra.scope3_spend_mapping_versions(id,company_id,mapping_key_sha256,gl_account,vendor,description,category,naics_code,margin_choice,revision,created_by) values(gen_random_uuid(),$1,$2,'','','',$3,$4,'with_margins',1,$5)", [company, fixtureMappingKey(99), category, naics, owner])))?.code).toBe('23514')
    expect((await failure(save(member, 5)))?.code).toBe('42501')
    const heads = await asUser(member, async tx => (await tx.query<{ naics_code: string; revision: number }>('select naics_code,revision from neuvetra.scope3_spend_mapping_heads')).rows)
    expect(heads).toEqual([{ naics_code: '541512', revision: 5 }])
    expect(await asUser(outsider, async tx => (await tx.query('select 1 from neuvetra.scope3_spend_mapping_heads')).rows)).toEqual([])
  })

  // Round 2 (owner decision 7): the report text carries the results' readiness (here one open issue).
  const reportText = JSON.stringify({ profile: 'neuvetra.scope3-results.v1', companyId: company, records: [], results: { readiness: { ready: false, openIssues: [{ category: 1, code: 'input_needed' }] } } })
  const csvText = '# Synthetic\nSection,Category\nTotal,\n'
  /**
   * Round 2 (ENG-11): the inputs must be the current head of every record the results list (every Scope 3 record that is
   * not withdrawn, and the category 3 sources when setup includes category 3), read here exactly as 0030 checks them.
   */
  let currentInputs: string[] = []
  const activeInputs = async (setup = setupVersion) => (await db.query<{ id: string }>(`select h.version_id::text id from neuvetra.collection_activity_records r join neuvetra.collection_activity_heads h on h.company_id=r.company_id and h.record_id=r.id
    join neuvetra.collection_activity_versions v on v.company_id=r.company_id and v.id=h.version_id where r.company_id=$1 and v.state<>'withdrawn' and (r.scope=3 or (exists(select 1 from neuvetra.company_setup_screening s where s.company_id=$1 and s.version_id=$2 and s.scope=3
    and s.category='fuel_and_energy_related_activities' and s.state='yes') and r.kind in('electricity','natural_gas','distillate_no2','vehicle'))) order by 1`, [company, setup])).rows.map(r => r.id)
  // Round 3 (owner decision 6, EN-5): the texts are their own parameters; the request carries the readiness, the company,
  // the assessments and rejected evidence the results used, and the previous approved version.
  let currentAssessments: string[] = []
  const readiness = { ready: false, openIssues: [{ category: 1, code: 'input_needed' }] }
  const prepare = (extra: Record<string, unknown> = {}) => {
    const { reportText: text = reportText, csvText: csv = csvText, ...rest } = extra as { reportText?: string; csvText?: string }
    return { reportText: text, csvText: csv, request: { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, reason: null, reportingYear: 2025, companyId: company, reportSha256: sha256(text), csvSha256: sha256(csv),
      engineSha256: 'e'.repeat(64), registerSha256s: { main: '5a534d33e70f7eb83bd8b0870da4cd8530e1d3429b3cb7e610b7941abce354f2' }, inputVersionIds: currentInputs, setupVersionId: setupVersion, readiness,
      assessmentIds: currentAssessments, rejectedEvidenceIds: [], previousApprovedVersionId: null, changeLogBasis: '{"basis":"synthetic"}', ...rest } }
  }
  // Round 3: each text is staged (here as one chunk) in the same transaction, then prepare assembles and stores them.
  const prepareRpc = <R,>(actor: string, call: { request: unknown; reportText: string; csvText: string }) => asUser(actor, async tx => {
    const key = (call.request as { idempotencyKey: string }).idempotencyKey
    for (const [kind, text] of [['report', call.reportText], ['csv', call.csvText]] as const) if (text !== '') await tx.query('select neuvetra.stage_scope3_report_text($1,$2::text::jsonb,$3)', [company, JSON.stringify({ idempotencyKey: key, kind, ordinal: 0 }), text])
    return (await tx.query<R>('select * from neuvetra.prepare_scope3_report($1,$2::text::jsonb)', [company, JSON.stringify(call.request)])).rows[0]!
  })

  test('report versions: exact bytes with their hashes, revisions with reasons, approval of the hash seen, never changed', async () => {
    currentInputs = await activeInputs()
    currentAssessments = (await db.query<{ id: string }>('select id::text id from neuvetra.scope3_category_assessment_heads where company_id=$1 and reporting_year=2025 order by 1', [company])).rows.map(r => r.id)
    expect(currentInputs.length).toBeGreaterThan(1)
    // Round 2 (ENG-11): inputs that are not the current heads, or not every listed record, are refused (40001) before anything is stored.
    const old = (await db.query<{ id: string }>('select v.id::text id from neuvetra.collection_activity_versions v join neuvetra.collection_activity_heads h on h.record_id=v.record_id and h.company_id=v.company_id join neuvetra.collection_activity_records r on r.id=v.record_id and r.company_id=v.company_id and r.scope=3 join neuvetra.collection_activity_versions hv on hv.id=h.version_id and hv.state<>\'withdrawn\' where v.company_id=$1 and v.id<>h.version_id limit 1', [company])).rows[0]!.id
    const headOfOld = (await db.query<{ id: string }>('select h.version_id::text id from neuvetra.collection_activity_versions v join neuvetra.collection_activity_heads h on h.record_id=v.record_id and h.company_id=v.company_id where v.id=$1', [old])).rows[0]!.id
    expect((await failure(prepareRpc(owner, prepare({ inputVersionIds: currentInputs.map(id => id === headOfOld ? old : id) }))))?.code).toBe('40001')
    expect((await failure(prepareRpc(owner, prepare({ inputVersionIds: currentInputs.slice(1) }))))?.code).toBe('40001')
    // Round 2 (owner decision 7): readiness must be well formed.
    expect((await failure(prepareRpc(owner, prepare({ readiness: { ready: true, openIssues: [{ category: 1, code: 'input_needed' }] } }))))?.code).toBe('22023')
    // Round 3 (EN-5): results whose assessments are not the year's latest, whose previous approved version is not the
    // latest approved one, or that missed a rejected file are refused (40001) like stale records.
    expect(currentAssessments.length).toBeGreaterThan(0)
    expect((await failure(prepareRpc(owner, prepare({ assessmentIds: currentAssessments.slice(1) }))))?.code).toBe('40001')
    expect((await failure(prepareRpc(owner, prepare({ previousApprovedVersionId: crypto.randomUUID() }))))?.code).toBe('40001')
    expect((await failure(prepareRpc(owner, prepare({ rejectedEvidenceIds: [crypto.randomUUID()] }))))?.code).toBe('40001')
    // Round 3 (owner decision 6): the report text is checked without parsing it: a JSON object about this company.
    expect((await failure(prepareRpc(owner, prepare({ companyId: otherCompany }))))?.code).toBe('22023')
    expect((await db.query<{ n: number }>('select count(*)::int n from neuvetra.scope3_report_versions where company_id=$1', [company])).rows[0]!.n).toBe(0)
    const body = prepare()
    const one = await prepareRpc<{ version_id: string; revision: number; replayed: boolean }>(owner, body)
    expect([one.revision, one.replayed]).toEqual([1, false])
    expect(await prepareRpc<unknown>(owner, body)).toEqual({ ...one, replayed: true })
    // Round 3: a text whose hash is not the one sent is refused by the table's own check (23514), never stored.
    const wrongHash = prepare({ expectedRevision: 1, reason: 'Re-run.' }); (wrongHash.request as { reportSha256: string }).reportSha256 = sha256('other')
    expect((await failure(prepareRpc(owner, wrongHash)))?.code).toBe('23514')
    expect((await failure(prepareRpc(owner, prepare({ expectedRevision: 1, reason: 'Re-run.', reportText: JSON.stringify({ companyId: otherCompany }) }))))?.code).toBe('22023')
    expect((await failure(prepareRpc(owner, prepare({ expectedRevision: 1, reason: 'Re-run.', inputVersionIds: [...currentInputs, crypto.randomUUID()] }))))?.code).toBe('23503')
    expect((await failure(prepareRpc(owner, prepare({ expectedRevision: 1, reason: 'no' }))))?.code).toBe('22023')
    expect((await failure(prepareRpc(owner, prepare({ expectedRevision: 1, reason: 'Re-run.', reportingYear: 2026 }))))?.code).toBe('22023')
    expect((await failure(prepareRpc(owner, prepare())))?.code).toBe('23505')
    const two = await prepareRpc<{ version_id: string; revision: number }>(owner, prepare({ expectedRevision: 1, reason: 'Records corrected after review.' }))
    expect(two.revision).toBe(2)
    const stored = (await db.query<{ report_text: string; report_sha256: string; csv_text: string }>('select report_text,report_sha256,csv_text from neuvetra.scope3_report_versions where id=$1', [one.version_id])).rows[0]!
    expect(stored).toEqual({ report_text: reportText, report_sha256: sha256(reportText), csv_text: csvText })
    // Approval of the hash the approver saw; a stale hash is refused; approving again returns the first approval.
    // Round 2 (owner decision 7): the version has an open issue and the owner prepared it: both flags are required, and
    // neither may be set when it does not apply.
    const approve = (actor: string, versionId: string, hash: string, acknowledgeOpenIssues = true, confirmSelfApproval = true) => rpc<{ version_id: string; approved_by: string; self_approved: boolean; replayed: boolean }>(actor, 'approve_scope3_report', company, { versionId, reportSha256: hash, acknowledgeOpenIssues, confirmSelfApproval })
    expect((await failure(approve(owner, one.version_id, sha256('stale'))))?.code).toBe('23505')
    expect((await failure(approve(member, one.version_id, sha256(reportText))))?.code).toBe('42501')
    expect((await failure(approve(owner, one.version_id, sha256(reportText), false, true)))?.code).toBe('23514')
    expect((await failure(approve(owner, one.version_id, sha256(reportText), true, false)))?.code).toBe('23514')
    expect((await failure(rpc(owner, 'approve_scope3_report', company, { versionId: one.version_id, reportSha256: sha256(reportText) })))?.code).toBe('22023')
    const approved = await approve(owner, one.version_id, sha256(reportText))
    expect([approved.approved_by, approved.self_approved, approved.replayed]).toEqual([owner, true, false])
    expect((await approve(owner, one.version_id, sha256(reportText))).replayed).toBe(true)
    expect((await db.query('select acknowledged_open_issues,self_approval_confirmed from neuvetra.scope3_report_approvals where version_id=$1', [one.version_id])).rows).toEqual([{ acknowledged_open_issues: [{ category: 1, code: 'input_needed' }], self_approval_confirmed: true }])
    // Nothing changes them afterwards, not even the operator; the table recomputes each hash itself.
    for (const statement of ["update neuvetra.scope3_report_versions set csv_text='x'", 'delete from neuvetra.scope3_report_approvals', 'truncate neuvetra.scope3_report_versions cascade', "update neuvetra.scope3_category_assessments set justification='x'", 'delete from neuvetra.scope3_spend_imports', 'truncate neuvetra.scope3_spend_mapping_versions'])
      expect([statement, (await failure(db.exec(statement)))?.code]).toEqual([statement, '55000'])
    expect((await failure(db.query("insert into neuvetra.scope3_report_versions(id,company_id,reporting_year,revision,previous_id,setup_version_id,reason,report_text,report_sha256,csv_text,csv_sha256,engine_sha256,register_sha256s,input_version_ids,change_log_basis,open_issues,created_by) values(gen_random_uuid(),$1,2025,3,$2,$3,'Forged.',$4,$5,'',$6,$7,'{}','{}','{}','[]',$8)",
      [company, two.version_id, setupVersion, '{"companyId":"x"}', 'f'.repeat(64), sha256(''), 'e'.repeat(64), owner])))?.code).toBe('23514')
    expect(await asUser(outsider, async tx => (await tx.query('select 1 from neuvetra.scope3_report_versions')).rows)).toEqual([])
    expect((await asUser(member, async tx => (await tx.query('select reporting_year,revision from neuvetra.scope3_report_versions order by 2')).rows))).toEqual([{ reporting_year: 2025, revision: 1 }, { reporting_year: 2025, revision: 2 }])
  })

  test('AM-03: assessments, reports and imports are per reporting year, side by side, each against its own setup year', async () => {
    // The TypeScript rule and SQL agree: the year of the last day of the period.
    const ends = ['2026-01-01', '2026-07-01', '2025-01-02', '2024-03-01', '2025-12-31', '2000-01-01', '2036-01-01']
    const sqlYears = (await db.query<{ y: number }>('select extract(year from d::date-1)::int y from unnest($1::text[]) with ordinality t(d,i) order by i', [ends])).rows.map(r => r.y)
    expect(ends.map(scope3ReportingYearOf)).toEqual(sqlYears)
    expect(sqlYears).toEqual([2025, 2026, 2025, 2024, 2025, 1999, 2035])
    expect(scope3ReportingYearOf(null)).toBeNull()
    // A fiscal year ending 30 June 2026 becomes the current setup (reporting year 2026).
    await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,previous_version_id,correction_reason,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,3,$3,'Fiscal year 2026','{}',$4,'2025-07-01','2026-07-01','operational_control',$5)", [fySetup, company, setupVersion, 'c'.repeat(64), owner])
    await db.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Synthetic office','San Francisco','Office','owned','reporting_company','included','','','','period_start','period_end')", [company, fySetup, fyLocation])
    await db.query('update neuvetra.company_setup_heads set version_id=$2, revision=3 where company_id=$1', [company, fySetup])
    try {
      const fy = (extra: Record<string, unknown> = {}) => fixtureAssessment(fySetup, { reportingYear: 2026, ...extra })
      // 2026 starts its own revisions for category 1 while 2025 is at revision 2; the 2025 year is refused under a 2026 setup.
      expect((await failure(saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 2, correctionReason: 'Next year.', assessment: fy({ reportingYear: 2025 }) })))?.code).toBe('22023')
      expect((await failure(saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 2, correctionReason: 'Next year.', assessment: fy() })))?.code).toBe('23505')
      const one = await saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: fy() })
      const two = await saveAssessment(owner, { idempotencyKey: crypto.randomUUID(), expectedRevision: 1, correctionReason: 'FY2026 estimate updated.', assessment: fy({ magnitudeTCo2e: '130' }) })
      expect([one.revision, two.revision]).toEqual([1, 2])
      expect((await db.query<{ previous_id: string | null }>('select previous_id from neuvetra.scope3_category_assessments where id=$1', [one.assessment_id])).rows[0]!.previous_id).toBeNull()
      const heads = await asUser(member, async tx => (await tx.query<{ reporting_year: number; category: number; revision: number }>('select reporting_year,category,revision from neuvetra.scope3_category_assessment_heads where category=1')).rows)
      expect(heads).toEqual([{ reporting_year: 2025, category: 1, revision: 2 }, { reporting_year: 2026, category: 1, revision: 2 }])
      // A revision can never point at another year's revision, whoever writes.
      const year2025 = (await db.query<{ id: string }>('select id from neuvetra.scope3_category_assessments where company_id=$1 and reporting_year=2025 and category=1 and revision=1', [company])).rows[0]!.id
      expect((await failure(db.query("insert into neuvetra.scope3_category_assessments(id,company_id,reporting_year,category,revision,previous_id,setup_version_id,reason_code,criteria,activities_included,justification,magnitude_kind,magnitude_t_co2e,magnitude_basis,not_quantifiable_reason,planned_method_types,energy_resale,evidence_ids,within_category_exclusions,correction_reason,created_by) values(gen_random_uuid(),$1,2026,1,3,$2,$3,null,'{}','','',null,null,'','','{}',null,'{}','[]','Forged link.',$4)", [company, year2025, fySetup, owner])))?.code).toBe('23503')
      // Reports: 2026 starts at revision 1 beside 2025's two versions.
      const fyInputs = await activeInputs(fySetup)
      const fyAssessments = (await db.query<{ id: string }>('select id::text id from neuvetra.scope3_category_assessment_heads where company_id=$1 and reporting_year=2026 order by 1', [company])).rows.map(r => r.id)
      const fyReport = (extra: Record<string, unknown> = {}) => prepare({ setupVersionId: fySetup, reportingYear: 2026, inputVersionIds: fyInputs, assessmentIds: fyAssessments, ...extra })
      expect((await failure(prepareRpc(owner, fyReport({ reportingYear: 2025, expectedRevision: 2, reason: 'Re-run.' }))))?.code).toBe('22023')
      const r1 = await prepareRpc<{ revision: number; version_id: string }>(owner, fyReport())
      const r2 = await prepareRpc<{ revision: number; version_id: string }>(owner, fyReport({ expectedRevision: 1, reason: 'Corrected FY2026 records.' }))
      expect([r1.revision, r2.revision]).toEqual([1, 2])
      expect((await db.query<{ reporting_year: number; revision: number }>('select reporting_year,revision from neuvetra.scope3_report_versions where company_id=$1 order by 1,2', [company])).rows).toEqual([{ reporting_year: 2025, revision: 1 }, { reporting_year: 2025, revision: 2 }, { reporting_year: 2026, revision: 1 }, { reporting_year: 2026, revision: 2 }])
      // Imports: the 2026 import against the 2026 setup.
      const shaFy = sha256('synthetic FY2026 export'), evidenceFy = '30700000-0000-4000-8000-000000000004', importFy = crypto.randomUUID()
      await db.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,'fy.csv','text/csv',23,$4,$5)", [evidenceFy, company, `${company}/original/${evidenceFy}`, shaFy, owner])
      const linked = { ...linkage, setupVersionId: fySetup, locationId: fyLocation }
      const fyRows = [spendRow(1, '10', 'USD', importFy, {}, fingerprint('FY-1'), linked)]
      const fyBody = (reportingYear: number) => spendImport(importFy, fyRows, { USD: '10' }, 0, shaFy, { evidenceId: evidenceFy, locationId: fyLocation, setupVersionId: fySetup, reportingYear })
      expect((await failure(rpc(owner, 'import_scope3_spend', company, fyBody(2025))))?.code).toBe('22023')
      expect((await rpc<{ saved: number }>(owner, 'import_scope3_spend', company, fyBody(2026))).saved).toBe(1)
      expect((await db.query<{ y: number }>('select reporting_year y from neuvetra.scope3_spend_imports where id=$1', [importFy])).rows[0]!.y).toBe(2026)
    } finally {
      await db.query('update neuvetra.company_setup_heads set version_id=$2, revision=2 where company_id=$1', [company, setupVersion])
    }
  })

  test('AM-02: neither heads view nor any base table shows another company\'s rows; both views are security_invoker', async () => {
    // Company B (the outsider owns it) has its own assessment, mapping, import and report.
    const b = await rpc<{ revision: number }>(outsider, 'save_scope3_category_assessment', otherCompany, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, correctionReason: null, assessment: fixtureAssessment(otherSetup, { category: 1 }) })
    expect(b.revision).toBe(1)
    await rpc(outsider, 'save_scope3_spend_mapping', otherCompany, { expectedRevision: 0, mapping: { mappingKeySha256: fixtureMappingKey(5), glAccount: '7000', vendor: 'B vendor', description: 'B', category: 4, naicsCode: '484121', marginChoice: 'with_margins' }, corrections: [], attestations: { categoryConfirmed: null, activityOverlapConfirmed: null } })
    const companiesSeen = (actor: string, relation: string) => asUser(actor, async tx => (await tx.query<{ company_id: string }>(`select distinct company_id::text from neuvetra.${relation} order by 1`)).rows.map(r => r.company_id))
    for (const relation of ['scope3_category_assessment_heads', 'scope3_spend_mapping_heads', ...NEW_TABLES]) {
      expect([relation, await companiesSeen(member, relation)]).toEqual([relation, (await db.query<{ c: string }>(`select distinct company_id::text c from neuvetra.${relation} where company_id=$1`, [company])).rows.map(r => r.c)])
      expect([relation, (await companiesSeen(outsider, relation)).includes(company)]).toEqual([relation, false])
    }
    for (const view of ['scope3_category_assessment_heads', 'scope3_spend_mapping_heads']) {
      expect([view, await companiesSeen(member, view)]).toEqual([view, [company]])
      expect([view, await companiesSeen(outsider, view)]).toEqual([view, [otherCompany]])
    }
    const options = (await db.query<{ relname: string; reloptions: string[] }>("select relname,reloptions from pg_class where relname in('scope3_category_assessment_heads','scope3_spend_mapping_heads') order by 1")).rows
    expect(options).toEqual([{ relname: 'scope3_category_assessment_heads', reloptions: ['security_invoker=true'] }, { relname: 'scope3_spend_mapping_heads', reloptions: ['security_invoker=true'] }])
    // Why the option matters: the same view without it (owned by the migration role) shows company B's rows to a member of A.
    const rollback = new Error('rollback')
    let leaked: string[] = []
    await db.transaction(async tx => {
      await tx.exec('create view neuvetra.scope3_heads_without_invoker as select distinct on (a.company_id,a.reporting_year,a.category) a.* from neuvetra.scope3_category_assessments a order by a.company_id,a.reporting_year,a.category,a.revision desc; grant select on neuvetra.scope3_heads_without_invoker to neuvetra_runtime')
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [member]); await tx.exec('set local role neuvetra_runtime')
      leaked = (await tx.query<{ c: string }>('select distinct company_id::text c from neuvetra.scope3_heads_without_invoker order by 1')).rows.map(r => r.c)
      throw rollback
    }).catch(error => { if (error !== rollback) throw error })
    expect(leaked).toEqual([company, otherCompany].sort())
  })

  test('privileges: the runtime reads the new tables and calls only the five RPCs; it writes nothing directly', async () => {
    for (const table of [...NEW_TABLES, 'scope3_category_assessment_heads', 'scope3_spend_mapping_heads']) {
      const p = (await db.query<{ s: boolean; w: boolean; a: boolean }>(`select has_table_privilege('neuvetra_runtime','neuvetra.${table}','SELECT') s, has_table_privilege('neuvetra_runtime','neuvetra.${table}','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') w, has_table_privilege('authenticated','neuvetra.${table}','SELECT,INSERT') a`)).rows[0]
      expect([table, p]).toEqual([table, { s: true, w: false, a: false }])
    }
    for (const table of NEW_TABLES) {
      const rls = (await db.query<{ r: boolean; f: boolean }>(`select relrowsecurity r, relforcerowsecurity f from pg_class where oid='neuvetra.${table}'::regclass`)).rows[0]
      expect([table, rls]).toEqual([table, { r: true, f: true }])
    }
    expect((await failure(asUser(owner, tx => tx.query("insert into neuvetra.scope3_spend_mapping_versions(id,company_id,mapping_key_sha256,gl_account,vendor,description,category,naics_code,margin_choice,revision,created_by) values(gen_random_uuid(),$1,$2,'','','',1,'541511','with_margins',9,$3)", [company, 'a'.repeat(64), owner]))))?.message).toMatch(/permission denied/)
    const callable = (await db.query<{ f: string }>("select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and (p.proname like '%scope3%') and has_function_privilege('neuvetra_runtime',p.oid,'execute') order by 1")).rows.map(r => r.f)
    // Round 3: prepare assembles its texts from staged chunks; withdraw-import, bulk corrections and text staging are new RPCs.
    expect(callable).toEqual(['neuvetra.approve_scope3_report(uuid,jsonb)', 'neuvetra.import_scope3_spend(uuid,jsonb)', 'neuvetra.prepare_scope3_report(uuid,jsonb)', 'neuvetra.save_scope3_category_assessment(uuid,jsonb)', 'neuvetra.save_scope3_spend_corrections(uuid,jsonb)', 'neuvetra.save_scope3_spend_mapping(uuid,jsonb)', 'neuvetra.stage_scope3_report_text(uuid,jsonb,text)', 'neuvetra.withdraw_scope3_spend_import(uuid,jsonb)'])
    const save = (await db.query<{ save: boolean; check: boolean }>("select has_function_privilege('neuvetra_runtime','neuvetra.save_collection_activity(uuid,uuid,jsonb)','execute') save, has_function_privilege('neuvetra_runtime','neuvetra.collection_assert_activity(jsonb)','execute') check")).rows[0]
    expect(save).toEqual({ save: true, check: false })
  })
})

// I-02, no 503s: a held record of a 0030 kind is counted in its own category by the trusted boundary. Before I-02 the
// boundary refused any category outside the seven engine categories, so Results answered 503.
test('the boundary counts held records of every category, and keeps refusing what is not a Scope 3 category', async () => {
  const engine = { aggregate: async () => { throw new Error('no results to aggregate') } }
  const pins = { engineSha256: 'e'.repeat(64), registerSha256: 'f'.repeat(64) }
  const records = SCOPE3_COMPLETION_KINDS.map((kind, i) => ({ recordId: `30900000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, category: SCOPE3_KIND_CATEGORIES[kind][0]!, quality: 'actual' as const,
    result: { outcome: 'held' as const, status: 'input_needed' as const, reasons: ['method_not_built_yet'] } }))
  const coverage = await scope3Coverage(records, [], [], engine, pins)
  for (const category of [1, 3, 7, 8, 11, 12, 15]) {
    const row = coverage.categories[category - 1]!
    expect([category, row.counts.inputNeeded > 0, row.subtotal, row.reasons]).toEqual([category, true, null, ['method_not_built_yet']])
  }
  // I-03: category 1 is calculated by the engine. I-04: `not_yet_supported` is retired (DESIGN A7); a held record of any
  // category needs input.
  expect(coverage.categories[0]!.status).toBe('input_needed')
  expect(coverage.knownSourceSubtotal).toBeNull()
  await expect(scope3Coverage([{ ...records[0]!, category: 16 as never }], [], [], engine, pins)).rejects.toThrow('not a Scope 3 category')
})

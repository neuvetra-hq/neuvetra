// Migration 0029 (Scope 3 package 2, D1): the collection tables store the four Scope 3 kinds. Claude, 26 October 2026.
// PGlite with every migration up to 0028, Scope 1 and 2 records saved first, then 0029: the earlier rows must be
// byte-identical afterwards, the Scope 3 kinds must save as scope 3 under the same rules as Scope 1 and 2, and the
// database must refuse exactly what the TypeScript contract refuses.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest, STAGING_MIGRATIONS } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import { readCollectionActivities, saveCollectionActivity } from './collection'
import { validateCollectionActivity, validateCollectionSaveInput, type CollectionActivity, type CollectionActivitySaveInput, type CollectionContext } from './collection-contract'
import { planScope3Calculation, SCOPE3_COLLECTION_UNITS, SCOPE3_LEGACY_KINDS, scope3SchemaRequired, type Scope3CollectionVersion } from './scope3-collection'

const owner = '29100000-0000-4000-8000-000000000001', outsider = '29100000-0000-4000-8000-000000000002'
const company = '29200000-0000-4000-8000-000000000001', otherCompany = '29200000-0000-4000-8000-000000000002'
const setupVersion = '29500000-0000-4000-8000-000000000001', otherSetup = '29500000-0000-4000-8000-000000000002'
const locationId = '29600000-0000-4000-8000-000000000001', otherLocation = '29600000-0000-4000-8000-000000000002'
const linkage = { setupVersionId: setupVersion, locationId, state: 'active' as const, withdrawalReason: null, quality: 'actual' as const, estimateBasis: null,
  period: { start: '2025-01-01', endExclusive: '2026-01-01' }, reference: 'Synthetic', notes: '', evidenceIds: [] }
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
const scope3: Record<'transport' | 'waste' | 'business_travel' | 'employee_commuting', CollectionActivity> = {
  transport: { ...linkage, kind: 'transport', sourceId: 'LANE-1', quantity: q('1200.5', 'short ton-mile'), payload: { category: 4, vehicle: 'medium_and_heavy_duty_truck', loadBasis: 'shared_vehicle', thirdPartyFacilities: 'none' } },
  waste: { ...linkage, kind: 'waste', sourceId: 'WASTE-1', quantity: q('17.125', 'metric_ton'), payload: { category: 5, material: 'asphalt_concrete', treatment: 'recycled' } },
  business_travel: { ...linkage, kind: 'business_travel', sourceId: 'TRIP-1', quantity: q('2400', 'mile'), payload: { mode: 'air', passengerSegments: 4, haulBasis: null } },
  employee_commuting: { ...linkage, kind: 'employee_commuting', sourceId: 'SURVEY-1', quantity: q('9800', 'passenger-mile'), payload: { mode: 'bus' } },
}
const gas = (): CollectionActivity => ({ ...linkage, kind: 'natural_gas', sourceId: 'GAS-1', quantity: q('12.125', 'therm'), payload: { heatContent: null } })
const electricity = (): CollectionActivity => ({ ...linkage, kind: 'electricity', sourceId: 'MTR-1', quantity: q('1200.125', 'kWh'),
  payload: { meterOrAccountNumber: 'MTR-1', utilityName: 'Synthetic Utility', site: 'Office', zip: '94105', subregion: 'CAMX', utilityEiaId: null, instruments: [] } })
const request = (activity: CollectionActivity, previous?: { revision: number; id: string }): CollectionActivitySaveInput =>
  ({ idempotencyKey: crypto.randomUUID(), expectedRevision: previous?.revision ?? 0, expectedVersionId: previous?.id ?? null, correctionReason: previous ? 'Corrected synthetic value.' : null, activity })
const message = (promise: Promise<unknown>) => promise.then(() => '', error => String(error?.message ?? error))
const TABLES = ['collection_activity_records', 'collection_activity_versions', 'collection_activity_heads', 'collection_activity_requests', 'collection_activity_evidence_links', 'collection_electricity_instruments', 'collection_grid_loss_lineage']

describe('0029: Scope 3 collection in the database (D1)', () => {
  let db: PGlite
  let before: Record<string, unknown[]>
  const asUser = <T,>(actor: string, operation: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]); await tx.exec('set local role neuvetra_runtime')
    return operation({ query: async <R,>(sql: string, args: unknown[] = []) => ({ rows: (await tx.query<R>(sql, args)).rows }), exec: async (sql: string) => { await tx.exec(sql) } })
  })
  const snapshot = async () => Object.fromEntries(await Promise.all(TABLES.map(async table => [table, (await db.query(`select to_jsonb(t)::text row from neuvetra.${table} t order by 1`)).rows]))) as Record<string, unknown[]>
  const raw = (activity: unknown) => db.query('select neuvetra.collection_assert_activity($1::text::jsonb)', [JSON.stringify(activity)])

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
    await db.exec(manifest[26]!.sql); await db.exec(manifest[27]!.sql)
    await db.query('insert into auth.users(id) values($1),($2)', [owner, outsider])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Scope 3 A','US','CA',$2),($3,'Synthetic Scope 3 B','US','CA',$4)", [company, owner, otherCompany, outsider])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner'),($3,$4,'owner')", [company, owner, otherCompany, outsider])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true),($3,$4,true)', [owner, company, outsider, otherCompany])
    for (const [version, target, location, actor] of [[setupVersion, company, locationId, owner], [otherSetup, otherCompany, otherLocation, outsider]] as const) {
      await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,1,'{}',$3,'2025-01-01','2026-01-01','operational_control',$4)", [version, target, 'a'.repeat(64), actor])
      await db.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,1)', [target, version])
      await db.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Synthetic office','San Francisco','Office','owned','reporting_company','included','','','','period_start','period_end')", [target, version, location])
    }
    // Scope 1 and 2 records saved at 28, one of them corrected, before 0029 runs.
    const first = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request(gas())))
    await asUser(owner, tx => saveCollectionActivity(tx, owner, company, first.record.id, request({ ...gas(), quantity: q('13.5', 'therm') }, { revision: 1, id: first.version.id })))
    await asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request(electricity())))
    // At 28 the database refuses every Scope 3 kind.
    expect(await message(asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request(scope3.waste))))).toContain('invalid collection activity')
    before = await snapshot()
    await db.exec(manifest[28]!.sql)
  }, 120_000)
  afterAll(async () => { await db.close() })

  // I-02: 0030 follows 0029 (collection-scope3-completion.test.ts); this file keeps testing the database at schema 29.
  test('0029 follows 0028 and leaves every earlier collection row byte-identical', async () => {
    expect(STAGING_MIGRATIONS.slice(26)).toEqual(['0027_collection.sql', '0028_collection_zip_check.sql', '0029_scope3_collection.sql', '0030_scope3_completion.sql', '0031_integrity_guards.sql'])
    expect(before.collection_activity_versions).toHaveLength(3)
    expect(await snapshot()).toEqual(before)
    const checks = await db.query<{ conname: string }>("select conname from pg_constraint where conrelid='neuvetra.collection_activity_records'::regclass and contype='c' order by 1")
    expect(checks.rows.map(row => row.conname)).toEqual(['collection_activity_records_kind_check', 'collection_activity_records_scope_check', 'collection_activity_records_scope_kind_check'])
  })

  test('every Scope 3 kind saves as scope 3, reads back intact, and plans for the Scope 3 engine', async () => {
    const context: CollectionContext = { companyId: company, setupVersionId: setupVersion, setupRevision: 1, sameContentSetupVersionIds: [setupVersion], boundaryApproach: 'operational_control', reportingPeriod: linkage.period,
      locations: [{ id: locationId, name: 'Synthetic office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
    for (const activity of Object.values(scope3)) {
      const saved = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request(activity)))
      expect(saved.record.kind).toBe(activity.kind)
      expect(saved.version.activity).toEqual(validateCollectionActivity(activity))
      const stored = await db.query<{ scope: number }>('select scope from neuvetra.collection_activity_records where id=$1', [saved.record.id])
      expect(stored.rows[0]?.scope).toBe(3)
      const plan = planScope3Calculation(saved.version as unknown as Scope3CollectionVersion, context, [])
      expect([activity.kind, plan.action, plan.reasons]).toEqual([activity.kind, 'calculate', []])
    }
    const records = await asUser(owner, tx => readCollectionActivities(tx, company))
    expect(records.map(record => record.kind).sort()).toEqual(['business_travel', 'electricity', 'employee_commuting', 'natural_gas', 'transport', 'waste'])
    // Another company's member sees none of them.
    expect(await asUser(outsider, tx => readCollectionActivities(tx, company))).toEqual([])
  })

  test('Scope 3 corrections, withdrawals and held values follow the same rules as Scope 1 and 2', async () => {
    const saved = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request({ ...scope3.employee_commuting, sourceId: 'SURVEY-2' })))
    const corrected = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, saved.record.id, request({ ...scope3.employee_commuting, sourceId: 'SURVEY-2', quantity: q('9900', 'passenger-mile') }, { revision: 1, id: saved.version.id })))
    expect(corrected.version.revision).toBe(2)
    const withdrawn = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, saved.record.id, request({ ...scope3.employee_commuting, sourceId: 'SURVEY-2', state: 'withdrawn', withdrawalReason: 'Duplicate survey.' }, { revision: 2, id: corrected.version.id })))
    expect(withdrawn.version.activity.state).toBe('withdrawn')
    // A record's kind can't change, even to another Scope 3 kind.
    expect(await message(asUser(owner, tx => saveCollectionActivity(tx, owner, company, saved.record.id, request(scope3.waste, { revision: 3, id: withdrawn.version.id }))))).toContain('kind cannot change')
    // Unknown tokens and units are stored as written and held by the adapter, never refused or normalized.
    const held = { ...scope3.waste, sourceId: 'WASTE-9', quantity: { originalValue: '3', originalUnit: 'cubic_yard', normalizedValue: null, normalizedUnit: null }, payload: { category: 12 as const, material: 'unobtainium', treatment: 'buried' } } as CollectionActivity
    const kept = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request(held)))
    expect(kept.version.activity).toEqual(validateCollectionActivity(held))
    // Outside calendar 2025 is refused for Scope 3 as for Scope 1 and 2.
    expect(await message(asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request({ ...scope3.waste, period: { start: '2024-12-01', endExclusive: '2025-01-01' } }))))).not.toBe('')
  })

  // I-02: the contract is now schema 30's. At 29 the database refuses exactly what the contract refuses, plus what needs
  // schema 30 (room-night, dataQuality, the business travel v2 keys, the new kinds), which the route refuses with 503 first.
  test('at 29 the database refuses exactly what the TypeScript contract refuses, or what needs schema 30', async () => {
    const units = SCOPE3_LEGACY_KINDS.map(kind => [kind, SCOPE3_COLLECTION_UNITS[kind]]) as Array<[keyof typeof scope3, readonly string[]]>
    const cases: Array<[string, unknown]> = []
    for (const [kind, allowed] of units) {
      for (const unit of [...allowed, 'US_gallon', 'kWh', 'therm', 'passenger-mile', 'short_ton', 'mile', 'tonne-km'])
        cases.push([`${kind} normalized to ${unit}`, { ...scope3[kind], quantity: q('10', unit) }])
    }
    const bad: Array<[string, unknown]> = [
      ['transport category 5', { ...scope3.transport, payload: { ...scope3.transport.payload, category: 5 } }],
      ['transport category as text', { ...scope3.transport, payload: { ...scope3.transport.payload, category: '4' } }],
      ['transport unknown load basis', { ...scope3.transport, payload: { ...scope3.transport.payload, loadBasis: 'partial' } }],
      ['transport load basis not yet known', { ...scope3.transport, quantity: q('10', 'vehicle-mile'), payload: { ...scope3.transport.payload, loadBasis: null } }],
      ['transport facilities missing', { ...scope3.transport, payload: { category: 4, vehicle: 'rail', loadBasis: 'shared_vehicle' } }],
      ['transport extra key', { ...scope3.transport, payload: { ...scope3.transport.payload, extra: 1 } }],
      ['transport vehicle of 81 characters', { ...scope3.transport, payload: { ...scope3.transport.payload, vehicle: 'x'.repeat(81) } }],
      ['transport vehicle of 80 characters', { ...scope3.transport, payload: { ...scope3.transport.payload, vehicle: 'x'.repeat(80) } }],
      ['waste category 4', { ...scope3.waste, payload: { ...scope3.waste.payload, category: 4 } }],
      ['waste category 12', { ...scope3.waste, payload: { ...scope3.waste.payload, category: 12 } }],
      ['waste blank material', { ...scope3.waste, payload: { ...scope3.waste.payload, material: '' } }],
      ['waste material as a number', { ...scope3.waste, payload: { ...scope3.waste.payload, material: 7 } }],
      ['travel zero segments', { ...scope3.business_travel, payload: { mode: 'air', passengerSegments: 0, haulBasis: null } }],
      ['travel 10,000,000 segments', { ...scope3.business_travel, payload: { mode: 'air', passengerSegments: 10_000_000, haulBasis: null } }],
      ['travel 10,000,001 segments', { ...scope3.business_travel, payload: { mode: 'air', passengerSegments: 10_000_001, haulBasis: null } }],
      ['travel 1.5 segments', { ...scope3.business_travel, payload: { mode: 'air', passengerSegments: 1.5, haulBasis: null } }],
      ['travel haul basis of 200 characters', { ...scope3.business_travel, quantity: q('10', 'passenger-mile'), payload: { mode: 'air_long_haul', passengerSegments: null, haulBasis: 'h'.repeat(200) } }],
      ['travel haul basis of 201 characters', { ...scope3.business_travel, quantity: q('10', 'passenger-mile'), payload: { mode: 'air_long_haul', passengerSegments: null, haulBasis: 'h'.repeat(201) } }],
      ['travel missing haul basis key', { ...scope3.business_travel, payload: { mode: 'air', passengerSegments: 4 } }],
      ['commuting extra key', { ...scope3.employee_commuting, payload: { mode: 'bus', distance: 1 } }],
      ['commuting mode null', { ...scope3.employee_commuting, payload: { mode: null } }],
      ['unknown kind', { ...scope3.waste, kind: 'hotel_stays' }],
    ]
    let agreements = 0
    for (const [label, activity] of [...cases, ...bad]) {
      let contract = true
      try { validateCollectionActivity(activity) } catch { contract = false }
      if (contract && scope3SchemaRequired(activity as CollectionActivity) !== 29) contract = false
      let database = true
      try { await raw(activity) } catch { database = false }
      expect([label, database]).toEqual([label, contract])
      agreements++
    }
    expect(agreements).toBe(cases.length + bad.length)
    // A writer that skips the TypeScript contract and calls the save function directly is refused too, and nothing is written.
    const rows = (await db.query('select count(*)::int n from neuvetra.collection_activity_versions')).rows[0]
    const direct = { ...request(scope3.waste), activity: { ...scope3.waste, payload: { category: 4, material: 'glass', treatment: 'recycled' } } }
    expect(() => validateCollectionSaveInput(direct)).toThrow()
    expect(await message(asUser(owner, tx => tx.query('select * from neuvetra.save_collection_activity($1,$2,$3::text::jsonb)', [company, crypto.randomUUID(), JSON.stringify(direct)])))).toContain('invalid waste activity')
    expect((await db.query('select count(*)::int n from neuvetra.collection_activity_versions')).rows[0]).toEqual(rows)
  })

  test('DB-01: text the database cannot store is refused by the contract; valid Unicode saves and reads back exactly', async () => {
    const invalid = ['nul\u0000inside', 'lone \ud800 high', 'lone \udc00 low', 'bell\u0007', 'delete\u007f', 'next line\u0085']
    const with_ = (kind: keyof typeof scope3, field: string, value: string): CollectionActivity => ({ ...scope3[kind], payload: { ...scope3[kind].payload, [field]: value } } as CollectionActivity)
    for (const value of invalid) for (const [kind, field] of [['waste', 'material'], ['waste', 'treatment'], ['transport', 'vehicle'], ['business_travel', 'mode'], ['business_travel', 'haulBasis'], ['employee_commuting', 'mode']] as const) {
      expect([kind, field, JSON.stringify(value), (() => { try { validateCollectionSaveInput(request(with_(kind, field, value))); return 'accepted' } catch { return 'refused' } })()]).toEqual([kind, field, JSON.stringify(value), 'refused'])
    }
    // Characters outside the BMP (paired surrogates), decomposed accents, tabs and line breaks are storable, and are kept as typed.
    for (const value of ['recycled \u267b\ufe0f \ud83d\ude9a', 'cafe\u0301 waste', 'line one\nline two\tend']) {
      const activity = with_('waste', 'material', value)
      const saved = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, crypto.randomUUID(), request(activity)))
      const [read] = (await asUser(owner, tx => readCollectionActivities(tx, company))).filter(record => record.id === saved.record.id)
      expect((read!.currentVersion.activity.payload as { material: string }).material).toBe(value)
    }
  })

  test('the scope and kind pairing holds for every writer, not only the save function', async () => {
    const insert = (scope: number, kind: string) => message(db.query('insert into neuvetra.collection_activity_records(id,company_id,scope,kind,created_by) values($1,$2,$3,$4,$5)', [crypto.randomUUID(), company, scope, kind, owner]))
    for (const kind of ['transport', 'waste', 'business_travel', 'employee_commuting']) {
      expect(await insert(1, kind)).toContain('scope_kind_check')
      expect(await insert(2, kind)).toContain('scope_kind_check')
    }
    expect(await insert(3, 'natural_gas')).toContain('scope_kind_check')
    expect(await insert(3, 'electricity')).toContain('scope_kind_check')
    expect(await insert(4, 'waste')).toContain('scope_check')
    expect(await insert(3, 'hotel_stays')).toContain('kind_check')
  })

  test('the runtime keeps exactly its 0027 privileges on the replaced functions', async () => {
    const privileges = await db.query<{ save: boolean; check: boolean }>("select has_function_privilege('neuvetra_runtime','neuvetra.save_collection_activity(uuid,uuid,jsonb)','execute') save, has_function_privilege('neuvetra_runtime','neuvetra.collection_assert_activity(jsonb)','execute') check")
    expect(privileges.rows[0]).toEqual({ save: true, check: false })
  })
})

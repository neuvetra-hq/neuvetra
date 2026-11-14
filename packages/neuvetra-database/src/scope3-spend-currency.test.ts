// Round 3 lane C (PR-11; Claude, 31 October 2026): bulk currency conversion of held spend lines. The user gives one rate
// per currency with its source and date; every held imported line in that currency is converted to US dollars in one
// transaction, through the existing record-save RPC (a correction per line); each line keeps the conversion in its notes
// (original amount, rate, source, date, rounding) and in its correction reason. PGlite with every migration through 0030.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import { readCollectionActivities } from './collection'
import { parseScope3SpendCsv, SCOPE3_SPEND_IMPORT_COLUMNS } from './scope3-spend-import'
import { convertScope3SpendCurrency, importScope3SpendFile } from './scope3-spend-imports'
import { scope3SpendConversionOf, scope3SpendConvertAmount, validateScope3SpendConversionInput } from './scope3-spend-currency'

describe('the conversion arithmetic and input (pure)', () => {
  test('amount × rate, exact, rounded once half-even to the cent', () => {
    expect(scope3SpendConvertAmount('4512.3', '1.0823')).toBe('4883.66') // 4883.66229
    expect(scope3SpendConvertAmount('100', '1.08125')).toBe('108.12') // 108.125 → even cent
    expect(scope3SpendConvertAmount('100', '1.08135')).toBe('108.14') // 108.135 → even cent
    expect(scope3SpendConvertAmount('1,000.5'.replace(',', ''), '0.73')).toBe('730.36') // 730.365 → 730.36
    expect(scope3SpendConvertAmount('0.001', '1')).toBe('0')
  })
  test('the input: a three-letter currency other than USD, a positive rate (≤ 6 + 8 digits), a source and a real ISO rate date', () => {
    expect(validateScope3SpendConversionInput({ currency: 'EUR', rate: '1.0823', rateSource: 'ECB euro reference rate', rateDate: '2025-06-30' })).toEqual({ currency: 'EUR', rate: '1.0823', rateSource: 'ECB euro reference rate', rateDate: '2025-06-30' })
    for (const bad of [{ currency: 'USD', rate: '1', rateSource: 'x', rateDate: '2025-06-30' }, { currency: 'EUR', rate: '0', rateSource: 'x', rateDate: '2025-06-30' }, { currency: 'EUR', rate: '-1', rateSource: 'x', rateDate: '2025-06-30' },
      { currency: 'EUR', rate: '1.0823', rateSource: ' ', rateDate: '2025-06-30' }, { currency: 'EUR', rate: '1.0823', rateSource: 'x', rateDate: '2025-13-30' }, { currency: 'eu', rate: '1', rateSource: 'x', rateDate: '2025-06-30' },
      { currency: 'EUR', rate: '1.123456789', rateSource: 'x', rateDate: '2025-06-30' }, { currency: 'EUR', rate: '1', rateSource: 'x', rateDate: '2025-06-30', extra: 1 }])
      expect(() => validateScope3SpendConversionInput(bad)).toThrow()
  })
})

const owner = '31920000-0000-4000-8000-000000000001', member = '31920000-0000-4000-8000-000000000002'
const company = '31930000-0000-4000-8000-000000000001', setupVersion = '31940000-0000-4000-8000-000000000001', location = '31950000-0000-4000-8000-000000000001'
const HEADER = SCOPE3_SPEND_IMPORT_COLUMNS.join(',')
const shaBytes = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

describe('bulk currency conversion in the database (PR-11)', () => {
  let db: PGlite
  const asUser = <T,>(actor: string, operation: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]); await tx.exec('set local role neuvetra_runtime')
    return operation({ query: async <R,>(sql: string, args: unknown[] = []) => ({ rows: (await tx.query<R>(sql, args)).rows }), exec: async (sql: string) => { await tx.exec(sql) } })
  })
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
    for (const migration of manifest.slice(26, 30)) await db.exec(migration.sql)
    await db.query('insert into auth.users(id) values($1),($2)', [owner, member])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic FX','US','CA',$2)", [company, owner])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')", [company, owner, member])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true),($3,$2,true)', [owner, company, member])
    await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,1,'{}',$3,'2025-01-01','2026-01-01','operational_control',$4)", [setupVersion, company, 'a'.repeat(64), owner])
    await db.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,1)', [company, setupVersion])
    await db.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Synthetic plant','Fresno','Plant','owned','reporting_company','included','','','','period_start','period_end')", [company, setupVersion, location])
    const bytes = new TextEncoder().encode(`${HEADER}\nFX-1,2025-05-01,Bosch Rexroth GmbH,5040,Components,Hydraulic valves,4512.30,EUR,2025,,,,\nFX-2,2025-06-01,Bosch Rexroth GmbH,5040,Components,Hydraulic valves,"1,200.00",EUR,2025,,,,\nFX-3,2025-06-02,Bosch Rexroth GmbH,5040,Components,Credit,-50,EUR,2025,,,,\nFX-4,2025-07-01,Magna Components Canada,5040,Components,Motor housings,800,CAD,2025,,,,\nFX-5,2025-07-02,Uline,5030,Packaging,Boxes,10,USD,2025,,,,\n`)
    const evidenceId = '31960000-0000-4000-8000-000000000001'
    await db.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,'fx.csv','text/csv',$4,$5,$6)", [evidenceId, company, `${company}/original/${evidenceId}`, bytes.byteLength, shaBytes(bytes), owner])
    await asUser(owner, tx => importScope3SpendFile(tx, owner, company, { parsed: parseScope3SpendCsv(bytes), fileSha256: shaBytes(bytes), evidenceId, locationId: location }))
  }, 120_000)
  afterAll(async () => { await db?.close() })
  const spend = async () => (await asUser(owner, tx => readCollectionActivities(tx, company))).filter(r => r.kind === 'purchase_spend').sort((a, b) => a.currentVersion.activity.sourceId.localeCompare(b.currentVersion.activity.sourceId))

  test('every held EUR line becomes US dollars in one transaction, each disclosing the rate, its source and date; a credit and other currencies are left as they are', async () => {
    const input = { currency: 'EUR', rate: '1.0823', rateSource: 'ECB euro reference rate', rateDate: '2025-06-30' }
    const result = await asUser(owner, tx => convertScope3SpendCurrency(tx, owner, company, input))
    expect(result.converted.map(c => [c.sourceId, c.from, c.usd, c.revision])).toEqual([['FX-1', '4512.3', '4883.66', 2], ['FX-2', '1200', '1298.76', 2]])
    expect(result.skipped).toEqual([{ recordId: expect.any(String), sourceId: 'FX-3', reason: 'negative_amount_not_supported' }])
    const [fx1, fx2, fx3, fx4, fx5] = await spend()
    expect(fx1!.currentVersion.activity.quantity).toEqual({ originalValue: '4883.66', originalUnit: 'USD', normalizedValue: '4883.66', normalizedUnit: 'USD' })
    // BF-20: one correction reason for the whole conversion (the lines are written set-based); each line's own amounts stay in its notes.
    expect([fx1!.currentVersion.correctionReason, fx2!.currentVersion.correctionReason]).toEqual(Array(2).fill('Converted from EUR to USD at 1.0823 USD per EUR (ECB euro reference rate, rate date 2025-06-30; rounded half-even to the cent).'))
    expect(scope3SpendConversionOf(fx1!.currentVersion.activity.notes)).toEqual({ currency: 'EUR', amount: '4512.3', rate: '1.0823', rateSource: 'ECB euro reference rate', rateDate: '2025-06-30', usd: '4883.66' })
    // The GL description note the import wrote stays the first line.
    expect(fx1!.currentVersion.activity.notes.split('\n')[0]).toBe('GL description: Components')
    expect(fx2!.currentVersion.activity.quantity.originalValue).toBe('1298.76')
    expect([fx3, fx4, fx5].map(r => [r!.currentVersion.revision, r!.currentVersion.activity.quantity.originalUnit])).toEqual([[1, 'EUR'], [1, 'CAD'], [1, 'USD']])
    // Nothing left in EUR to convert: a second call converts nothing (and says so).
    expect((await asUser(owner, tx => convertScope3SpendCurrency(tx, owner, company, input))).converted).toEqual([])
  })
  test('a member cannot convert; a bad input saves nothing', async () => {
    const input = { currency: 'CAD', rate: '0.73', rateSource: 'Bank of Canada', rateDate: '2025-07-31' }
    expect(await asUser(member, tx => convertScope3SpendCurrency(tx, member, company, input)).then(() => 'saved', () => 'refused')).toBe('refused')
    expect(await asUser(owner, tx => convertScope3SpendCurrency(tx, owner, company, { ...input, rate: 'abc' })).then(() => 'saved', () => 'refused')).toBe('refused')
    const fx4 = (await spend()).find(r => r.currentVersion.activity.sourceId === 'FX-4')!
    expect(fx4.currentVersion.revision).toBe(1)
    const done = await asUser(owner, tx => convertScope3SpendCurrency(tx, owner, company, input))
    expect(done.converted.map(c => [c.sourceId, c.usd])).toEqual([['FX-4', '584']])
  })
})

// BF-14 (accounting audit B-5, lead 2; 13 November 2026): one exchange rate must not convert lines of another calendar year.
// Currency conversion converts only the lines whose "line year" (the year of the line date; without one, the year of a
// period that lies in one calendar year) equals the year of the rate date; the others are skipped with
// `rate_date_outside_line_year` and stay held in their own currency. The planner holds, with `currency_rate_outside_line_year`,
// a line already converted at a rate from another year (converted before this fix) or one whose year is unknown.
// Which rate to use (transaction date, annual average or per import) is accountant question C-6; this only refuses mixing years.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import { validateCollectionSaveInput, type CollectionContext } from './collection-contract'
import { readCollectionActivities } from './collection'
import { planScope3Calculation, validateScope3Payload, type Scope3CollectionActivity, type Scope3CollectionVersion } from './scope3-collection'
import { parseScope3SpendCsv, SCOPE3_SPEND_IMPORT_COLUMNS } from './scope3-spend-import'
import { convertScope3SpendCurrency, importScope3SpendFile } from './scope3-spend-imports'
import { scope3SpendConversionOf, scope3SpendLineYear, scope3SpendNotesWithConversion } from './scope3-spend-currency'
import { SCOPE3_REASON_TEXT_BF14 } from './scope3-text'

describe('BF-14: the line year (pure)', () => {
  const year = (lineDate: string | null, start: string, endExclusive: string) => scope3SpendLineYear({ lineDate, period: { start, endExclusive } })
  test('the year of the line date; without one, the year of a period inside one calendar year; otherwise unknown', () => {
    expect(year('2026-02-01', '2026-01-01', '2027-01-01')).toBe(2026)
    expect(year('2025-12-31', '2025-07-01', '2026-07-01')).toBe(2025) // a fiscal period crossing years: the date decides
    expect(year('2026-01-01', '2025-07-01', '2026-07-01')).toBe(2026)
    expect(year(null, '2025-01-01', '2026-01-01')).toBe(2025) // a calendar year (end exclusive is 1 January)
    expect(year(null, '2025-03-01', '2025-04-01')).toBe(2025)
    expect(year(null, '2025-07-01', '2026-07-01')).toBeNull() // crosses years, no date: unknown
    expect(year(null, '2025-12-31', '2026-01-02')).toBeNull()
    expect(year(null, '2025-01-01', '2027-01-01')).toBeNull()
  })
})

const company = '14300000-0000-4000-8000-000000000001', setup = '14300000-0000-4000-8000-000000000002', office = '14300000-0000-4000-8000-000000000003'
const contextFor = (start: string, endExclusive: string): CollectionContext => ({ companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start, endExclusive },
  locations: [{ id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }] })
const SPEND = { category: 1, naicsCode: '541511', dollarYear: 2024, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: 'excludes_sales_tax',
  supplierName: 'Synthetic Software LLC', glAccount: '6100', description: 'Software consulting', categoryConfirmed: false, activityOverlap: 'unknown', importId: '14300000-0000-4000-8000-0000000000aa', importRow: 2,
  mappingSource: 'file', paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false }
const converted = (rateDate: string, currency = 'EUR') => scope3SpendNotesWithConversion('GL description: Components', { currency, amount: '1000', rate: '1.0823', usd: '1082.3', rateSource: 'ECB euro reference rate', rateDate })
let n = 0
function line(period: { start: string; endExclusive: string }, payload: Record<string, unknown>, notes: string, usd = '1082.3'): Scope3CollectionVersion {
  n++
  const activity = { locationId: office, setupVersionId: setup, sourceId: `FX-${n}`, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null, reference: 'Synthetic source', notes, evidenceIds: [], period, kind: 'purchase_spend',
    quantity: { originalValue: usd, originalUnit: 'USD', normalizedValue: usd, normalizedUnit: 'USD' }, payload: validateScope3Payload('purchase_spend', { ...SPEND, ...payload }) } as unknown as Scope3CollectionActivity
  return { id: `14300000-0000-4000-8000-${String(10000 + n).padStart(12, '0')}`, recordId: `14300000-0000-4000-8000-${String(50000 + n).padStart(12, '0')}`, companyId: company, revision: 2, previousVersionId: null, correctionReason: null, activity, payloadSha256: 'a'.repeat(64), createdBy: company, createdAt: '2026-06-01T00:00:00.000Z' }
}
const Y2025 = { start: '2025-01-01', endExclusive: '2026-01-01' }, Y2026 = { start: '2026-01-01', endExclusive: '2027-01-01' }, FY = { start: '2025-07-01', endExclusive: '2026-07-01' }
const outcome = (version: Scope3CollectionVersion, context: CollectionContext) => { const p = planScope3Calculation(version, context, [], {}); return [p.action, p.status, p.reasons] }

describe('BF-14: the planner holds a line converted at a rate from another year (also one converted before the fix)', () => {
  test('a 2026 line converted at a rate dated 2025 is held input_needed currency_rate_outside_line_year; a 2026 rate counts it', () => {
    const ctx = contextFor(Y2026.start, Y2026.endExclusive)
    expect(outcome(line(Y2026, { lineDate: '2026-02-01' }, converted('2025-06-30')), ctx)).toEqual(['hold', 'input_needed', ['currency_rate_outside_line_year']])
    expect(outcome(line(Y2026, { lineDate: '2026-02-01' }, converted('2026-06-30')), ctx)).toEqual(['calculate', null, []])
    expect(outcome(line(Y2026, { lineDate: '2026-02-01' }, converted('2027-01-02')), ctx)).toEqual(['hold', 'input_needed', ['currency_rate_outside_line_year']])
  })
  test('same-year conversions, USD lines and lines that never had a conversion note plan exactly as before (identical plans)', () => {
    const ctx = contextFor(Y2025.start, Y2025.endExclusive)
    const plain = planScope3Calculation(line(Y2025, { lineDate: '2025-05-01' }, 'GL description: Components'), ctx, [], {})
    const same = planScope3Calculation(line(Y2025, { lineDate: '2025-05-01' }, converted('2025-06-30')), ctx, [], {})
    expect([plain.action, plain.reasons]).toEqual(['calculate', []])
    // Only the line identity differs (version, record, source id); every other part of the plan is equal.
    const strip = (p: typeof plain) => ({ ...p, versionId: '', recordId: '', sourceId: '' })
    expect(strip(same)).toEqual(strip(plain))
    // Dated before the rate, same year: still the line's own year.
    expect(outcome(line(Y2025, { lineDate: '2025-01-02' }, converted('2025-12-31')), ctx)).toEqual(['calculate', null, []])
  })
  test('no line date: a period inside one year follows that year; a period crossing years is held; a date inside a fiscal period decides', () => {
    const ctx25 = contextFor(Y2025.start, Y2025.endExclusive), ctxFy = contextFor(FY.start, FY.endExclusive)
    expect(outcome(line(Y2025, {}, converted('2025-06-30')), ctx25)).toEqual(['calculate', null, []])
    expect(outcome(line(Y2025, {}, converted('2024-12-31')), ctx25)).toEqual(['hold', 'input_needed', ['currency_rate_outside_line_year']])
    expect(outcome(line(FY, {}, converted('2025-12-31')), ctxFy)).toEqual(['hold', 'input_needed', ['currency_rate_outside_line_year']])
    expect(outcome(line(FY, { lineDate: '2025-09-01' }, converted('2025-12-31')), ctxFy)).toEqual(['calculate', null, []])
    expect(outcome(line(FY, { lineDate: '2026-03-01' }, converted('2025-12-31')), ctxFy)).toEqual(['hold', 'input_needed', ['currency_rate_outside_line_year']])
    // An unconverted USD line over a crossing period is not affected: no conversion, nothing to hold.
    expect(outcome(line(FY, {}, 'GL description: Components'), ctxFy)).toEqual(['calculate', null, []])
  })
  test('F1: a hand-typed note in the machine format that does not describe the line does not hold it (plans exactly as without the note)', () => {
    const ctx = contextFor(Y2025.start, Y2025.endExclusive)
    const typed = (fields: { amount: string; rate: string; usd: string }) => scope3SpendNotesWithConversion('GL description: Components', { currency: 'EUR', rateSource: 'my bank', rateDate: '2024-12-31', ...fields })
    // QA's case: a USD 1,000 line whose note claims EUR 900 x 1.1 = USD 990, rate date 2024-12-31.
    const claim990 = line(Y2025, { lineDate: '2025-05-01' }, typed({ amount: '900', rate: '1.1', usd: '990' }), '1000')
    expect(outcome(claim990, ctx)).toEqual(['calculate', null, []])
    const strip = (p: ReturnType<typeof planScope3Calculation>) => ({ ...p, versionId: '', recordId: '', sourceId: '' })
    expect(strip(planScope3Calculation(claim990, ctx, [], {}))).toEqual(strip(planScope3Calculation(line(Y2025, { lineDate: '2025-05-01' }, 'GL description: Components', '1000'), ctx, [], {})))
    // The note's own arithmetic is wrong (900 x 1.1 is 990, not 1000) even though its USD figure equals the line's amount.
    expect(outcome(line(Y2025, { lineDate: '2025-05-01' }, typed({ amount: '900', rate: '1.1', usd: '1000' }), '1000'), ctx)).toEqual(['calculate', null, []])
    // The mirror: a note that is valid for the line (900 x 1.1 = 990 on a USD 990 line) is still held at a rate of another year.
    expect(outcome(line(Y2025, { lineDate: '2025-05-01' }, typed({ amount: '900', rate: '1.1', usd: '990' }), '990'), ctx)).toEqual(['hold', 'input_needed', ['currency_rate_outside_line_year']])
  })
  test('the reason says what to do', () => {
    const text = SCOPE3_REASON_TEXT_BF14.currency_rate_outside_line_year
    expect(text).toContain('isn’t counted')
    expect(text).toContain('rate dated in the same year')
  })
})

const owner = '14310000-0000-4000-8000-000000000001'
const version1 = '14320000-0000-4000-8000-000000000001', version2 = '14320000-0000-4000-8000-000000000002', location = '14330000-0000-4000-8000-000000000001'
const HEADER = SCOPE3_SPEND_IMPORT_COLUMNS.join(',')
const shaBytes = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

describe('BF-14 / ACCT-LEAD-2 (PGlite): one EUR rate converts only the lines of its own year', () => {
  let db: PGlite
  const asUser = <T,>(actor: string, operation: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]); await tx.exec('set local role neuvetra_runtime')
    return operation({ query: async <R,>(sql: string, args: unknown[] = []) => ({ rows: (await tx.query<R>(sql, args)).rows }), exec: async (sql: string) => { await tx.exec(sql) } })
  })
  const addSetup = async (id: string, revision: number, start: string, end: string, previous: string | null = null) => {
    await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by,previous_version_id) values($1,$2,$3,'{}',$4,$5,$6,'operational_control',$7,$8)", [id, company, revision, String(revision).repeat(64), start, end, owner, previous])
    await db.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Synthetic plant','Fresno','Plant','owned','reporting_company','included','','','','period_start','period_end')", [company, id, location])
  }
  const importCsv = async (name: string, evidenceId: string, body: string) => {
    const bytes = new TextEncoder().encode(`${HEADER}\n${body}`)
    await db.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,$4,'text/csv',$5,$6,$7)", [evidenceId, company, `${company}/original/${evidenceId}`, name, bytes.byteLength, shaBytes(bytes), owner])
    await asUser(owner, tx => importScope3SpendFile(tx, owner, company, { parsed: parseScope3SpendCsv(bytes), fileSha256: shaBytes(bytes), evidenceId, locationId: location }))
  }
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
    await db.query('insert into auth.users(id) values($1)', [owner])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic FX','US','CA',$2)", [company, owner])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [company, owner])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [owner, company])
    await addSetup(version1, 1, '2025-01-01', '2026-01-01')
    await db.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,1)', [company, version1])
    await importCsv('fx.csv', '14340000-0000-4000-8000-000000000001', `FX-1,2025-05-01,Bosch Rexroth GmbH,5040,Components,Hydraulic valves,4512.30,EUR,2025,,,,\nFX-2,2025-06-01,Bosch Rexroth GmbH,5040,Components,Hydraulic valves,"1,200.00",EUR,2025,,,,\nFX-3,2025-06-02,Bosch Rexroth GmbH,5040,Components,Credit,-50,EUR,2025,,,,\nFX-4,2025-07-01,Magna Components Canada,5040,Components,Motor housings,800,CAD,2025,,,,\nFX-5,2025-07-02,Uline,5030,Packaging,Boxes,10,USD,2025,,,,\n`)
    await addSetup(version2, 2, '2026-01-01', '2027-01-01', version1)
    await db.query('update neuvetra.company_setup_heads set version_id=$2, revision=2 where company_id=$1', [company, version2])
    await importCsv('fx2026.csv', '14340000-0000-4000-8000-000000000002', `FX-6,2026-02-01,Bosch Rexroth GmbH,5040,Components,Hydraulic valves 2026,1000,EUR,2026,,,,\n`)
  }, 120_000)
  afterAll(async () => { await db?.close() })
  const spend = async () => (await asUser(owner, tx => readCollectionActivities(tx, company))).filter(r => r.kind === 'purchase_spend').sort((a, b) => a.currentVersion.activity.sourceId.localeCompare(b.currentVersion.activity.sourceId))
  const row = async (sourceId: string) => (await spend()).find(r => r.currentVersion.activity.sourceId === sourceId)!.currentVersion

  test('1. auditor B-5: a rate dated 2025-06-30 converts FX-1 and FX-2; FX-6 (2026) is skipped rate_date_outside_line_year and stays EUR', async () => {
    const input = { currency: 'EUR', rate: '1.0823', rateSource: 'ECB euro reference rate', rateDate: '2025-06-30' }
    const result = await asUser(owner, tx => convertScope3SpendCurrency(tx, owner, company, input))
    expect(result.converted.map(c => [c.sourceId, c.from, c.usd])).toEqual([['FX-1', '4512.3', '4883.66'], ['FX-2', '1200', '1298.76']])
    expect(result.skipped.map(s => [s.sourceId, s.reason])).toEqual([['FX-3', 'negative_amount_not_supported'], ['FX-6', 'rate_date_outside_line_year']])
    const fx6 = await row('FX-6')
    expect([fx6.revision, fx6.activity.quantity.originalUnit, fx6.activity.quantity.originalValue, scope3SpendConversionOf(fx6.activity.notes)]).toEqual([1, 'EUR', '1000', null])
    // Same rate again: nothing new converts, FX-6 is still skipped for its year.
    const again = await asUser(owner, tx => convertScope3SpendCurrency(tx, owner, company, input))
    expect([again.converted.length, again.skipped.map(s => s.sourceId)]).toEqual([0, ['FX-3', 'FX-6']])
  })
  test('3. a rate dated in 2026 converts FX-6 (and nothing of 2025 is touched again)', async () => {
    const input = { currency: 'EUR', rate: '1.1', rateSource: 'ECB euro reference rate, annual average 2026', rateDate: '2026-06-30' }
    const result = await asUser(owner, tx => convertScope3SpendCurrency(tx, owner, company, input))
    expect(result.converted.map(c => [c.sourceId, c.from, c.usd, c.revision])).toEqual([['FX-6', '1000', '1100', 2]])
    // F5: the 2025 credit is reported as a credit, whatever year the rate is in.
    expect(result.skipped.map(s => [s.sourceId, s.reason])).toEqual([['FX-3', 'negative_amount_not_supported']])
    expect(scope3SpendConversionOf((await row('FX-6')).activity.notes)).toMatchObject({ rateDate: '2026-06-30', usd: '1100' })
    expect((await row('FX-1')).revision).toBe(2)
  })
  test('2. a line converted across years before the fix (written directly) is held by the planner, and the read-only staging query lists exactly it', async () => {
    // FX-6 is now converted at its own year's rate (test 3). Write a second line the way the old code did: a 2026 line at a 2025 rate.
    const before = await row('FX-6')
    const note = scope3SpendNotesWithConversion(before.activity.notes, { currency: 'EUR', amount: '1000', rate: '1.0823', usd: '1082.3', rateSource: 'ECB euro reference rate', rateDate: '2025-06-30' })
    const request = validateCollectionSaveInput({ idempotencyKey: crypto.randomUUID(), expectedRevision: before.revision, expectedVersionId: before.id, correctionReason: 'Old behaviour: converted at a rate of another year.',
      activity: { ...before.activity, quantity: { originalValue: '1082.3', originalUnit: 'USD', normalizedValue: '1082.3', normalizedUnit: 'USD' }, notes: note } })
    const record = (await spend()).find(r => r.currentVersion.activity.sourceId === 'FX-6')!
    await asUser(owner, tx => tx.query('select * from neuvetra.save_collection_activity($1,$2,$3::text::jsonb)', [company, record.id, JSON.stringify(request)]))
    const now = await row('FX-6')
    const ctx = contextFor('2026-01-01', '2027-01-01')
    const held = planScope3Calculation(now as unknown as Scope3CollectionVersion, { ...ctx, setupVersionId: version2, setupRevision: 2, sameContentSetupVersionIds: [version2], locations: ctx.locations.map(l => ({ ...l, id: location })) }, [], {})
    expect([held.action, held.status, held.reasons.includes('currency_rate_outside_line_year')]).toEqual(['hold', 'input_needed', true]) // (the imported line also still needs its NAICS code)
    // The staging query: SELECT only, and it lists this line only (FX-1 and FX-2 are converted in their own year).
    const sql = readFileSync(fileURLToPath(new URL('../../../tools/scope3/bf14-currency-rate-year.sql', import.meta.url)), 'utf8')
    expect(sql.replace(/--.*$/gm, '')).not.toMatch(/\b(insert|update|delete|alter|drop|create|truncate|grant|copy|call|do)\b/i)
    const [list, summary] = sql.split(/;\s*\n/).filter(part => part.replace(/--.*$/gm, '').trim() !== '')
    const rows = (await db.query<{ source_id: string; line_year: number; rate_year: number; usd_amount: string }>(list!)).rows
    expect(rows.map(r => [r.source_id, Number(r.line_year), Number(r.rate_year), r.usd_amount])).toEqual([['FX-6', 2026, 2025, '1082.3']])
    expect((await db.query<{ lines: string; usd_total: string }>(summary!)).rows.map(r => [Number(r.lines), Number(r.usd_total)])).toEqual([[1, 1082.3]])
  })
})

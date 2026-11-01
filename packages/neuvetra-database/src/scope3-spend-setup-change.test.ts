// Bug hunt PR 22 (lane B, 1 November 2026): imported spend lines keep the setup version they were imported under. After
// the company saves any new setup version (here: the same locations, a new version), the two bulk spend corrections that
// build each line's next version from its saved activity, the mapping save (0030 save_scope3_spend_mapping) and the
// currency conversion (convertScope3SpendCurrency), must carry the line to the current setup version, as every other
// correction and "withdraw this import" do. They were refused (23503 "current company setup location required") for
// every line imported before the setup change, so the unmatched queue and the conversion could never be completed.
// PGlite with every migration through 0030, as the runtime role.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import { readCollectionActivities } from './collection'
import { parseScope3SpendCsv, SCOPE3_SPEND_IMPORT_COLUMNS } from './scope3-spend-import'
import { convertScope3SpendCurrency, importScope3SpendFile, saveScope3SpendMapping } from './scope3-spend-imports'
import type { PurchaseSpendCollectionPayload } from './scope3-collection-contract'

const owner = '30a20000-0000-4000-8000-000000000001', company = '30a30000-0000-4000-8000-000000000001'
const setupV1 = '30a40000-0000-4000-8000-000000000001', setupV2 = '30a40000-0000-4000-8000-000000000002'
const location = '30a50000-0000-4000-8000-000000000001', evidenceId = '30a60000-0000-4000-8000-000000000001'
const HEADER = SCOPE3_SPEND_IMPORT_COLUMNS.join(',')
const shaBytes = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

describe('bulk spend corrections after a new company setup version', () => {
  let db: PGlite
  const asUser = <T,>(operation: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]); await tx.exec('set local role neuvetra_runtime')
    return operation({ query: async <R,>(sql: string, args: unknown[] = []) => ({ rows: (await tx.query<R>(sql, args)).rows }), exec: async (sql: string) => { await tx.exec(sql) } })
  })
  const addSetupVersion = async (id: string, revision: number) => {
    await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,previous_version_id,correction_reason,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,$3,$4,$5,'{}',$6,'2025-01-01','2026-01-01','operational_control',$7)", [id, company, revision, revision === 1 ? null : setupV1, revision === 1 ? null : 'A note changed.', String(revision).repeat(64), owner])
    await db.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Synthetic office','San Francisco','Office','owned','reporting_company','included','','','','period_start','period_end')", [company, id, location])
    if (revision === 1) await db.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,1)', [company, id])
    else await db.query('update neuvetra.company_setup_heads set version_id=$2,revision=$3 where company_id=$1', [company, id, revision])
  }
  const lines = async () => (await asUser(tx => readCollectionActivities(tx, company))).filter(r => r.kind === 'purchase_spend')

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
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Spend Setup Change','US','CA',$2)", [company, owner])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [company, owner])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [owner, company])
    await addSetupVersion(setupV1, 1)
  }, 120_000)
  afterAll(async () => { await db?.close() })

  test('a mapping save and a currency conversion carry lines imported under an earlier setup version to the current one', async () => {
    // An unmatched line (no code) and a euro line, imported under setup version 1.
    const bytes = new TextEncoder().encode(`${HEADER}\nU-1,2025-04-02,Advisory Partners TEST,6400,Consulting,Strategy advice,1500,USD,2025,,,,\nE-1,2025-04-03,Euro Design TEST,6150,Marketing,Brochure design,200,EUR,2025,1,541430,with_margins,\n`)
    await db.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,'ledger.csv','text/csv',$4,$5,$6)", [evidenceId, company, `${company}/original/${evidenceId}`, bytes.byteLength, shaBytes(bytes), owner])
    const imported = await asUser(tx => importScope3SpendFile(tx, owner, company, { parsed: parseScope3SpendCsv(bytes), fileSha256: shaBytes(bytes), evidenceId, locationId: location }))
    expect(imported).toMatchObject({ replayed: false, saved: 2 })
    expect((await lines()).every(r => r.currentVersion.activity.setupVersionId === setupV1)).toBe(true)
    // The company saves a new setup version (same location).
    await addSetupVersion(setupV2, 2)
    // The unmatched queue: a mapping for the unmatched line's key.
    const unmatched = (await lines()).find(r => r.currentVersion.activity.sourceId === 'U-1')!
    const p = unmatched.currentVersion.activity.payload as PurchaseSpendCollectionPayload
    const mapped = await asUser(tx => saveScope3SpendMapping(tx, owner, company, { expectedRevision: 0, mapping: { glAccount: p.glAccount, vendor: p.supplierName, description: p.description, category: 1, naicsCode: '541611', marginChoice: 'with_margins' }, categoryConfirmed: null, activityOverlapConfirmed: null }))
    expect(mapped.corrected).toHaveLength(1)
    const after = (await lines()).find(r => r.id === unmatched.id)!
    expect(after.currentVersion.revision).toBe(2)
    expect(after.currentVersion.activity.setupVersionId).toBe(setupV2)
    expect((after.currentVersion.activity.payload as PurchaseSpendCollectionPayload)).toMatchObject({ naicsCode: '541611', category: 1, mappingSource: 'user' })
    // Saving the same mapping again leaves the line as it is (the setup version alone is no change).
    const again = await asUser(tx => saveScope3SpendMapping(tx, owner, company, { expectedRevision: 1, mapping: { glAccount: p.glAccount, vendor: p.supplierName, description: p.description, category: 1, naicsCode: '541611', marginChoice: 'with_margins' }, categoryConfirmed: null, activityOverlapConfirmed: null }))
    expect([again.corrected.length, again.unchanged]).toEqual([0, 1])
    // The currency conversion of the euro line.
    const converted = await asUser(tx => convertScope3SpendCurrency(tx, owner, company, { currency: 'EUR', rate: '1.0825', rateSource: 'ECB euro reference rate (TEST)', rateDate: '2025-04-03' }))
    expect(converted.converted.map(item => [item.sourceId, item.usd])).toEqual([['E-1', '216.5']])
    const euro = (await lines()).find(r => r.currentVersion.activity.sourceId === 'E-1')!
    expect([euro.currentVersion.revision, euro.currentVersion.activity.setupVersionId, euro.currentVersion.activity.quantity.originalUnit]).toEqual([2, setupV2, 'USD'])
  })
})

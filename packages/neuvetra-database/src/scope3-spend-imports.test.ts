// Spend CSV imports and mapping memory in the database (Scope 3 completion I-09; Claude, 30 October 2026). PGlite with every
// migration through 0030, as the runtime role: the r4 C1 files import with the overlap line flagged as a possible duplicate
// of import 1 row 3; the same bytes replay with nothing new; a failing line saves nothing; a mapping saved from the
// unmatched queue corrects its group and is applied from memory to a later, different file; edits re-correct the group;
// members, outsiders and other companies' owners are refused or see nothing.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import { readCollectionActivities, saveCollectionActivity } from './collection'
import { parseScope3SpendCsv, scope3SpendRecordId, SCOPE3_SPEND_IMPORT_COLUMNS } from './scope3-spend-import'
import { importScope3SpendFile, readScope3SpendImportLines, readScope3SpendImports, readScope3SpendMappings, saveScope3SpendMapping, scope3Sha256 } from './scope3-spend-imports'
import type { PurchaseSpendCollectionPayload } from './scope3-collection-contract'

const owner = '30920000-0000-4000-8000-000000000001', member = '30920000-0000-4000-8000-000000000002', outsider = '30920000-0000-4000-8000-000000000003'
const company = '30930000-0000-4000-8000-000000000001', otherCompany = '30930000-0000-4000-8000-000000000002'
const setupVersion = '30940000-0000-4000-8000-000000000001', otherSetup = '30940000-0000-4000-8000-000000000002'
const location = '30950000-0000-4000-8000-000000000001', excludedLocation = '30950000-0000-4000-8000-000000000002', otherLocation = '30950000-0000-4000-8000-000000000003'
// Round 2 ENG-1: the r4 pack's C1 spend files are committed fixtures (byte for byte), read relative to this file.
const R4_FILES: Record<string, string> = { 'spend-import.csv': 'spend-r4-c1.csv', 'spend-import-overlap.csv': 'spend-r4-c1-overlap.csv' }
const r4File = (name: string) => Bun.file(`${import.meta.dir}/testdata/${R4_FILES[name]}`)
const HEADER = SCOPE3_SPEND_IMPORT_COLUMNS.join(',')
type Failure = { code: string | undefined; message: string } | null
const failure = (promise: Promise<unknown>): Promise<Failure> => promise.then(() => null, (error: { code?: string; message?: string }) => ({ code: error?.code, message: String(error?.message ?? error) }))
const shaBytes = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
let evidenceSeq = 0

describe('spend imports in the database (I-09)', () => {
  let db: PGlite
  const asUser = <T,>(actor: string, operation: (tx: WorkspaceSql) => Promise<T>) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]); await tx.exec('set local role neuvetra_runtime')
    return operation({ query: async <R,>(sql: string, args: unknown[] = []) => ({ rows: (await tx.query<R>(sql, args)).rows }), exec: async (sql: string) => { await tx.exec(sql) } })
  })
  const upload = async (target: string, actor: string, bytes: Uint8Array, name: string) => {
    // The evidence route reuses an upload with the same bytes (unique per company and SHA-256).
    const existing = (await db.query<{ id: string }>('select id from neuvetra.collection_evidence_objects where company_id=$1 and sha256=$2', [target, shaBytes(bytes)])).rows[0]
    if (existing) return existing.id
    const id = `30960000-0000-4000-8000-${String(++evidenceSeq).padStart(12, '0')}`
    await db.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,$4,'text/csv',$5,$6,$7)", [id, target, `${target}/original/${id}`, name, bytes.byteLength, shaBytes(bytes), actor])
    return id
  }
  const importFile = async (bytes: Uint8Array, name: string, options: { actor?: string; target?: string; locationId?: string; evidenceId?: string } = {}) => {
    const target = options.target ?? company, actor = options.actor ?? owner
    const evidenceId = options.evidenceId ?? await upload(target, owner, bytes, name)
    return asUser(actor, tx => importScope3SpendFile(tx, actor, target, { parsed: parseScope3SpendCsv(bytes), fileSha256: shaBytes(bytes), evidenceId, locationId: options.locationId ?? location }))
  }
  const spendRecords = async () => (await asUser(owner, tx => readCollectionActivities(tx, company))).filter(r => r.kind === 'purchase_spend')
  const payloadOf = (record: { currentVersion: { activity: { payload: unknown } } }) => record.currentVersion.activity.payload as PurchaseSpendCollectionPayload
  const r4 = async (name: string) => new Uint8Array(await r4File(name).arrayBuffer())

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
    expect(manifest[29]!.name).toBe('0030_scope3_completion.sql')
    await db.query('insert into auth.users(id) values($1),($2),($3)', [owner, member, outsider])
    await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Spend A','US','CA',$2),($3,'Synthetic Spend B','US','CA',$4)", [company, owner, otherCompany, outsider])
    await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner'),($1,$3,'member'),($4,$5,'owner')", [company, owner, member, otherCompany, outsider])
    await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true),($3,$2,true),($4,$5,true)', [owner, company, member, outsider, otherCompany])
    for (const [version, target, actor] of [[setupVersion, company, owner], [otherSetup, otherCompany, outsider]] as const)
      await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,1,'{}',$3,'2025-01-01','2026-01-01','operational_control',$4)", [version, target, 'a'.repeat(64), actor])
    await db.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,1),($3,$4,1)', [company, setupVersion, otherCompany, otherSetup])
    for (const [target, version, id, inclusion] of [[company, setupVersion, location, 'included'], [company, setupVersion, excludedLocation, 'excluded'], [otherCompany, otherSetup, otherLocation, 'included']] as const)
      await db.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Synthetic office','San Francisco','Office','owned','reporting_company',$4,$5,'','','period_start','period_end')", [target, version, id, inclusion, inclusion === 'excluded' ? 'Sold before the period.' : ''])
  }, 120_000)
  afterAll(async () => { await db?.close() })

  test('the r4 C1 files: every line a record; the overlap line points at import 1 row 3; totals reconcile; the same bytes replay', async () => {
    const first = await importFile(await r4('spend-import.csv'), 'spend-import.csv')
    expect(first).toMatchObject({ replayed: false, saved: 3 })
    expect(first.import).toMatchObject({ companyId: company, reportingYear: 2025, fileSha256: 'cb5871465315cd4528ae8db7055db4586cd7e8940867c97813b268420a81c0ca', fileName: 'spend-import.csv', locationId: location, setupVersionId: setupVersion, rowCount: 3, fileTotals: { USD: '8405.75' }, nonNumericRows: 0 })
    expect(first.import.reconciliation).toEqual({ reconciled: true, nonNumericRows: { file: 0, imported: 0 }, currencies: [{ currency: 'USD', fileTotal: '8405.75', importedTotal: '8405.75', lines: 3, matches: true }] })
    const overlap = await importFile(await r4('spend-import-overlap.csv'), 'spend-import-overlap.csv')
    expect(overlap).toMatchObject({ replayed: false, saved: 2 })
    const records = await spendRecords()
    expect(records).toHaveLength(5)
    const byLine = (importId: string, row: number) => records.find(r => payloadOf(r).importId === importId && payloadOf(r).importRow === row)!
    expect(payloadOf(byLine(overlap.import.id, 1)).possibleDuplicateOf).toEqual({ importId: first.import.id, row: 3 })
    expect(payloadOf(byLine(overlap.import.id, 2)).possibleDuplicateOf).toBeNull()
    expect(byLine(overlap.import.id, 1).currentVersion.activity).toMatchObject({ sourceId: 'INV-2025-0103', reference: 'spend import spend-import-overlap.csv sha256 6571ed6d0116 row 1', quantity: { originalValue: '1275.25', originalUnit: 'USD', normalizedValue: '1275.25', normalizedUnit: 'USD' } })
    expect(payloadOf(byLine(first.import.id, 3))).toMatchObject({ category: 1, naicsCode: '722320', dollarYear: 2024, marginChoice: 'with_margins', mappingSource: 'file', lineDate: '2025-11-20', supplierName: 'Mission Catering TEST', glAccount: '6300', description: 'Client meeting catering' })
    // The same bytes again: replayed, nothing new (records, versions, lines).
    const linesBefore = await asUser(owner, tx => readScope3SpendImportLines(tx, company))
    const again = await importFile(await r4('spend-import-overlap.csv'), 'spend-import-overlap.csv')
    expect(again).toMatchObject({ replayed: true, saved: 0 })
    expect(again.import).toEqual(overlap.import)
    expect(await spendRecords()).toEqual(records)
    expect(await asUser(owner, tx => readScope3SpendImportLines(tx, company))).toEqual(linesBefore)
    expect((await asUser(owner, tx => readScope3SpendImports(tx, company))).map(i => i.id)).toEqual([first.import.id, overlap.import.id])
  })

  test('atomic: one line that cannot be saved leaves no import, no line and no record', async () => {
    const text = `${HEADER}\nAT-1,2025-02-01,Atomic TEST,6100,,Paper,10,USD,2025,1,322121,,\nAT-2,2025-02-02,Atomic TEST,6100,,Pens,20,USD,2025,1,339940,,\n`
    const bytes = new TextEncoder().encode(text)
    // Row 2's deterministic record already exists (a hand-entered record with that ID): its save in the import fails.
    const taken = scope3SpendRecordId(company, shaBytes(bytes), 2, scope3Sha256)
    const before = await spendRecords()
    const manual = await asUser(owner, tx => saveCollectionActivity(tx, owner, company, taken, { idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity: {
      ...before[0]!.currentVersion.activity, sourceId: 'manual', reference: '', notes: '', payload: { ...payloadOf(before[0]!), importId: null, importRow: null, possibleDuplicateOf: null, mappingSource: 'user' } } }))
    expect(manual.replayed).toBe(false)
    const imports = (await asUser(owner, tx => readScope3SpendImports(tx, company))).length
    expect(await failure(importFile(bytes, 'atomic.csv'))).not.toBeNull()
    expect((await asUser(owner, tx => readScope3SpendImports(tx, company))).length).toBe(imports)
    expect((await spendRecords()).filter(r => payloadOf(r).supplierName === 'Atomic TEST')).toEqual([])
    expect((await spendRecords()).find(r => r.id === taken)!.currentVersion).toMatchObject({ revision: 1, activity: { sourceId: 'manual' } })
  })

  test('mapping memory: a mapping saved from the unmatched queue corrects its group and maps a later, different file; an edit re-corrects the group', async () => {
    const fileA = new TextEncoder().encode(`${HEADER}\nMM-1,2025-04-01,Harbor Catering TEST,6300,Meals,Team lunch,300,USD,2025,,,,\nMM-2,2025-04-02,Paper Co TEST,6100,,Paper,50,USD,2025,1,322121,,\n`)
    const a = await importFile(fileA, 'ledger-a.csv')
    const lineA = (await spendRecords()).find(r => payloadOf(r).importId === a.import.id && payloadOf(r).importRow === 1)!
    expect(payloadOf(lineA)).toMatchObject({ mappingSource: 'unmatched', naicsCode: null, category: 1 })
    const body = (naicsCode: string, expectedRevision: number) => ({ expectedRevision, mapping: { glAccount: '6300', vendor: 'Harbor Catering TEST', description: 'Team lunch', category: 1, naicsCode, marginChoice: 'with_margins' }, categoryConfirmed: null, activityOverlapConfirmed: null })
    // A member (not owner/admin) cannot save a mapping; an outsider cannot either.
    expect((await failure(asUser(member, tx => saveScope3SpendMapping(tx, member, company, body('722320', 0)))))?.code).toBe('42501')
    expect((await failure(asUser(outsider, tx => saveScope3SpendMapping(tx, outsider, company, body('722320', 0)))))?.code).toBe('42501')
    const saved = await asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, body('722320', 0)))
    expect(saved.mapping).toMatchObject({ companyId: company, revision: 1, category: 1, naicsCode: '722320', mappingKeySha256: scope3Sha256('6300\u001fharbor catering test\u001fteam lunch') })
    expect(saved.corrected.map(c => [c.recordId, c.revision])).toEqual([[lineA.id, 2]])
    const correctedA = (await spendRecords()).find(r => r.id === lineA.id)!
    expect(payloadOf(correctedA)).toMatchObject({ mappingSource: 'user', naicsCode: '722320', category: 1, importId: a.import.id, importRow: 1 })
    expect(correctedA.currentVersion.correctionReason).toBe('Mapped to NAICS 722320 (category 1, with margins) by spend mapping revision 1.')
    // A stale revision is refused (23505); a wrong-category code is refused before SQL.
    expect((await failure(asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, body('722320', 0)))))?.code).toBe('23505')
    expect((await failure(asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, { ...body('722320', 1), mapping: { ...body('722320', 1).mapping, category: 4 } }))))?.code).toBe('22023')
    // A later, different file with the same GL account, vendor and description (case and spaces aside) is mapped from memory.
    const fileB = new TextEncoder().encode(`${HEADER}\nMM-9,2025-09-09, harbor catering test ,6300,Meals,TEAM LUNCH,120,USD,2025,,,,\n`)
    const b = await importFile(fileB, 'ledger-b.csv')
    const lineB = (await spendRecords()).find(r => payloadOf(r).importId === b.import.id)!
    expect(payloadOf(lineB)).toMatchObject({ mappingSource: 'memory', naicsCode: '722320', category: 1, marginChoice: 'with_margins' })
    // Editing the mapping corrects both lines of the group; the file-mapped paper line is untouched.
    const edited = await asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, body('722310', 1)))
    expect(edited.mapping.revision).toBe(2)
    expect(edited.corrected.map(c => c.recordId).sort()).toEqual([lineA.id, lineB.id].sort())
    const after = await spendRecords()
    expect([lineA.id, lineB.id].map(id => payloadOf(after.find(r => r.id === id)!).naicsCode)).toEqual(['722310', '722310'])
    expect(payloadOf(after.find(r => payloadOf(r).importId === a.import.id && payloadOf(r).importRow === 2)!)).toMatchObject({ mappingSource: 'file', naicsCode: '322121' })
    expect((await asUser(member, tx => readScope3SpendMappings(tx, company))).map(m => [m.naicsCode, m.revision])).toEqual([['722310', 2]])
    // The same mapping again: nothing left to correct.
    expect(await asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, body('722310', 2)))).toMatchObject({ corrected: [], unchanged: 2 })
  })

  test('round 2 UX-1: a group mapping (vendor and account) is stored through 0030, corrects every description of the group except a per-line override, and maps a later file from memory', async () => {
    const fileA = new TextEncoder().encode(`${HEADER}\nGR-1,2025-05-01,Staples Inc.,6110,Office supplies,Toner,100,USD,2025,,,,\nGR-2,2025-05-02,"STAPLES, INC",6110,Office supplies,Paper and pens,40,USD,2025,,,,\nGR-3,2025-05-03,Staples,6110,Office supplies,Ink,25,USD,2025,,,,\nGR-4,2025-05-04,Staples,6210,,Chairs,900,USD,2025,,,,\n`)
    const a = await importFile(fileA, 'ledger-group-a.csv')
    const row = (n: number, importId = a.import.id) => async () => (await spendRecords()).find(r => payloadOf(r).importId === importId && payloadOf(r).importRow === n)!
    // A per-line override first: the ink line keeps its own code whatever its group gets.
    const override = await asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, { expectedRevision: 0, mapping: { glAccount: '6110', vendor: 'Staples', description: 'Ink', category: 1, naicsCode: '325910', marginChoice: 'with_margins' }, categoryConfirmed: null, activityOverlapConfirmed: null }))
    expect(override.corrected.map(c => c.recordId)).toEqual([(await row(3)()).id])
    const group = { expectedRevision: 0, scope: 'group', mapping: { glAccount: '6110', vendor: 'Staples Inc.', description: '', category: 1, naicsCode: '339940', marginChoice: 'with_margins' }, categoryConfirmed: null, activityOverlapConfirmed: null }
    const saved = await asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, group))
    expect(saved.mapping).toMatchObject({ revision: 1, description: '', vendor: 'Staples Inc.', mappingKeySha256: scope3Sha256('vendor-account\u001e6110\u001fstaples') })
    expect(saved.corrected.map(c => c.recordId).sort()).toEqual([(await row(1)()).id, (await row(2)()).id].sort())
    expect([payloadOf(await row(1)()), payloadOf(await row(2)()), payloadOf(await row(3)()), payloadOf(await row(4)())].map(p => [p.naicsCode, p.mappingSource])).toEqual([['339940', 'user'], ['339940', 'user'], ['325910', 'user'], [null, 'unmatched']])
    // A stale group revision is refused like any mapping.
    expect((await failure(asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, group))))?.code).toBe('23505')
    // A later file: a new description of the same vendor and account is mapped from the group; the override still wins.
    const fileB = new TextEncoder().encode(`${HEADER}\nGR-9,2025-10-01,Staples Inc,6110,Office supplies,Binders,60,USD,2025,,,,\nGR-10,2025-10-02,Staples,6110,Office supplies,Ink,30,USD,2025,,,,\n`)
    const b = await importFile(fileB, 'ledger-group-b.csv')
    expect([payloadOf(await row(1, b.import.id)()), payloadOf(await row(2, b.import.id)())].map(p => [p.naicsCode, p.mappingSource])).toEqual([['339940', 'memory'], ['325910', 'memory']])
  })

  // BF-12b (QA F-1): BF-12 kept combining marks in the vendor key, so a group mapping saved before it (Devanagari or Thai
  // vowel signs, Turkish capital İ, which lower-cases to i and a combining dot) is stored under a key its texts no longer
  // give. It is read under today's key, maps later files from memory, and is revised in place: the screen's revision is
  // honoured (no 409 loop) and no second remembered row with the same texts is created.
  test('BF-12b: a group mapping stored under the pre-BF-12 key is found, maps from memory and is revised in place, never duplicated', async () => {
    // The vendor key before BF-12: combining marks became spaces.
    const LEGAL = new Set(['inc', 'incorporated', 'llc', 'l l c', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company', 'plc', 'lp', 'llp', 'l p', 'gmbh', 'ag', 'sa', 'bv', 'pty', 'pc', 'pllc'])
    const oldVendorKey = (vendor: string) => {
      const words = vendor.normalize('NFKC').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      if (!words) return ''
      let out = words
      for (;;) { const before = out; for (const suffix of LEGAL) if (out.endsWith(` ${suffix}`)) out = out.slice(0, -suffix.length - 1).trim(); out = out.replace(/ and$/, '').replace(/^the /, '').trim(); if (out === before) break }
      return out || words
    }
    const vendors = [['कुमार ट्रेडर्स', '6120'], ['กินดี จำกัด', '6130'], ['İSTANBUL TEKSTİL', '6140']] as const
    let n = 0
    for (const [vendor, gl] of vendors) {
      const oldKey = scope3Sha256(`vendor-account\u001e${gl}\u001f${oldVendorKey(vendor)}`)
      const { scope3SpendGroupKeyInput } = await import('./scope3-spend-grouping')
      const newKey = scope3Sha256(scope3SpendGroupKeyInput({ glAccount: gl, supplierName: vendor })!)
      expect([vendor, oldKey === newKey]).toEqual([vendor, false])
      // The mapping as saved before BF-12 (revision 1 under the old key).
      await db.query("insert into neuvetra.scope3_spend_mapping_versions(id,company_id,mapping_key_sha256,gl_account,vendor,description,category,naics_code,margin_choice,revision,created_by) values($1,$2,$3,$4,$5,'',1,'541611','with_margins',1,$6)",
        [`30970000-0000-4000-8000-${String(++n).padStart(12, '0')}`, company, oldKey, gl, vendor, owner])
      // Read under today's key.
      const read = (await asUser(owner, tx => readScope3SpendMappings(tx, company))).filter(m => m.vendor === vendor)
      expect(read.map(m => [m.mappingKeySha256, m.revision])).toEqual([[newKey, 1]])
      // A file of that vendor and account is mapped from memory (before this fix: unmatched).
      const bytes = new TextEncoder().encode(`${HEADER}\nCM-${n}-1,2025-06-01,${vendor},${gl},,Services,100,USD,2025,,,,\n`)
      const imported = await importFile(bytes, `combining-${n}.csv`)
      const line = (await spendRecords()).find(r => payloadOf(r).importId === imported.import.id)!
      expect([vendor, payloadOf(line).naicsCode, payloadOf(line).mappingSource]).toEqual([vendor, '541611', 'memory'])
      // The screen sends the revision it shows (1): saved in place (revision 2, same stored row), not 409.
      const body = (expectedRevision: number, naicsCode: string) => ({ expectedRevision, scope: 'group', mapping: { glAccount: gl, vendor, description: '', category: 1, naicsCode, marginChoice: 'with_margins' }, categoryConfirmed: null, activityOverlapConfirmed: null })
      const saved = await asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, body(1, '541612')))
      expect([saved.mapping.revision, saved.mapping.mappingKeySha256, saved.corrected.map(c => c.recordId)]).toEqual([2, newKey, [line.id]])
      // Revision 0 (as if new) is refused: no second remembered row with the same texts.
      expect((await failure(asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, body(0, '541613')))))?.code).toBe('23505')
      const stored = (await db.query<{ mapping_key_sha256: string; revision: number }>("select mapping_key_sha256,revision from neuvetra.scope3_spend_mapping_versions where company_id=$1 and vendor=$2 order by revision", [company, vendor])).rows
      expect(stored).toEqual([{ mapping_key_sha256: oldKey, revision: 1 }, { mapping_key_sha256: oldKey, revision: 2 }])
      expect((await asUser(owner, tx => readScope3SpendMappings(tx, company))).filter(m => m.vendor === vendor).map(m => [m.mappingKeySha256, m.revision, m.naicsCode])).toEqual([[newKey, 2, '541612']])
    }
    // A pair made before this fix (old-key row, then a revision-0 save under the new key): read once, as the new-key row,
    // and saves revise that row.
    const [vendor, gl] = ['ไทยดี', '6150'] as const
    const oldKey = scope3Sha256(`vendor-account\u001e${gl}\u001f${oldVendorKey(vendor)}`)
    await db.query("insert into neuvetra.scope3_spend_mapping_versions(id,company_id,mapping_key_sha256,gl_account,vendor,description,category,naics_code,margin_choice,revision,created_by,created_at) values($1,$2,$3,$4,$5,'',1,'541611','with_margins',1,$6,now()-interval '1 day')",
      ['30970000-0000-4000-8000-000000000099', company, oldKey, gl, vendor, owner])
    const { scope3SpendGroupKeyInput } = await import('./scope3-spend-grouping')
    const newKey = scope3Sha256(scope3SpendGroupKeyInput({ glAccount: gl, supplierName: vendor })!)
    await db.query("insert into neuvetra.scope3_spend_mapping_versions(id,company_id,mapping_key_sha256,gl_account,vendor,description,category,naics_code,margin_choice,revision,created_by) values($1,$2,$3,$4,$5,'',1,'541620','with_margins',1,$6)",
      ['30970000-0000-4000-8000-000000000098', company, newKey, gl, vendor, owner])
    const pair = (await asUser(owner, tx => readScope3SpendMappings(tx, company))).filter(m => m.vendor === vendor)
    expect(pair.map(m => [m.mappingKeySha256, m.naicsCode])).toEqual([[newKey, '541620']])
    const revised = await asUser(owner, tx => saveScope3SpendMapping(tx, owner, company, { expectedRevision: 1, scope: 'group', mapping: { glAccount: gl, vendor, description: '', category: 1, naicsCode: '541611', marginChoice: 'with_margins' }, categoryConfirmed: null, activityOverlapConfirmed: null }))
    expect([revised.mapping.revision, revised.mapping.mappingKeySha256]).toEqual([2, newKey])
    expect((await db.query<{ k: string; r: number }>("select mapping_key_sha256 k,max(revision) r from neuvetra.scope3_spend_mapping_versions where company_id=$1 and vendor=$2 group by 1 order by 1", [company, vendor])).rows.map(row => [row.k === newKey ? 'new' : 'old', row.r]).sort()).toEqual([['new', 2], ['old', 1]])
  })

  test('access: members read; members cannot import; outsiders see nothing; another company’s owner cannot import into this one; evidence and location must be this company’s', async () => {
    const bytes = new TextEncoder().encode(`${HEADER}\nAC-1,2025-05-01,Access TEST,6100,,Toner,10,USD,2025,1,339940,,\n`)
    const evidenceId = await upload(company, owner, bytes, 'access.csv')
    expect((await failure(importFile(bytes, 'access.csv', { actor: member, evidenceId })))?.code).toBe('42501')
    expect(await failure(importFile(bytes, 'access.csv', { actor: outsider, evidenceId }))).not.toBeNull()
    expect(await asUser(outsider, tx => readScope3SpendImports(tx, company))).toEqual([])
    expect(await asUser(outsider, tx => readScope3SpendImportLines(tx, company))).toEqual([])
    expect(await asUser(outsider, tx => readScope3SpendMappings(tx, company))).toEqual([])
    expect((await asUser(member, tx => readScope3SpendImports(tx, company))).length).toBeGreaterThan(0)
    // Company B's owner, importing into B with A's evidence or A's location: refused, nothing saved.
    expect((await failure(importFile(bytes, 'access.csv', { actor: outsider, target: otherCompany, evidenceId, locationId: otherLocation })))?.code).toBe('evidence_mismatch')
    expect((await failure(importFile(bytes, 'access.csv', { actor: outsider, target: otherCompany, locationId: location })))?.code).toBe('location_not_included')
    expect((await failure(importFile(bytes, 'access.csv', { locationId: excludedLocation, evidenceId })))?.code).toBe('location_not_included')
    // Evidence with other bytes than the file: refused.
    const other = await upload(company, owner, new TextEncoder().encode('other bytes'), 'other.csv')
    expect((await failure(importFile(bytes, 'access.csv', { evidenceId: other })))?.code).toBe('evidence_mismatch')
    expect(await asUser(outsider, tx => readScope3SpendImports(tx, otherCompany))).toEqual([])
  })
})

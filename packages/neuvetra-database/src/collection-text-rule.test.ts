// BF-32: one text-length rule on the save path. Finds every free-text field of the collection contract (Scope 1, 2 and 3) by
// trying the contract, saves awkward strings into each through the API check and through the real SQL function (PGlite
// always; native PostgreSQL when M63_TEST_DATABASE_URL is set), and checks that the two layers can never disagree in the
// direction that leaks a database error. BF32_FACTS_OUT=<file> writes the full table (the "before" and "after" facts).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { writeFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { EXISTING_PROJECT_REF } from './index'
import { CollectionTextLimitError, validateCollectionActivity, validateCollectionSaveInput, type CollectionContext } from './collection-contract'
import { readCollectionActivities, saveCollectionActivity } from './collection'
import { planScope3Calculation, type Scope3CollectionVersion } from './scope3-collection'
import { SAVE_TEXT_LIMITS } from './collection-text-rule'
import { createStagingSchemaFixture } from './staging-schema-fixture'
import { createSyntheticCompanySetup } from './company-setup-fixture'
import { readMigrationManifest } from './staging-migrations'
import { m71CanonicalJson } from './m71-validation'
import {
  TEXT_CASES, activityWith, apiVerdict, endToEnd, modeOf, patternOf, probeBases, requestFor, sqlVerdict, stringLeaves, withValue,
  type Base, type Engine, type ProbeIds,
} from './collection-text-rule-probe'

const FACTS_ONLY = process.env.BF32_FACTS_ONLY === '1'
const ids: ProbeIds = { owner: '32100000-0000-4000-8000-000000000001', company: '32200000-0000-4000-8000-000000000001', setupVersion: '32500000-0000-4000-8000-000000000001', locationId: '32600000-0000-4000-8000-000000000001' }
const setupHash = (payload: unknown) => new Bun.CryptoHasher('sha256').update(m71CanonicalJson(payload)).digest('hex')
const NATIVE = process.env.M63_TEST_DATABASE_URL

async function seed(tx: { query: (sql: string, args?: unknown[]) => Promise<unknown> }) {
  const setup = createSyntheticCompanySetup()
  await tx.query('insert into auth.users(id) values($1)', [ids.owner])
  await tx.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic Text Rule','US','CA',$2)", [ids.company, ids.owner])
  await tx.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [ids.company, ids.owner])
  await tx.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [ids.owner, ids.company])
  await tx.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by) values($1,$2,1,$5::jsonb,$3,'2025-01-01','2026-01-01','unknown',$4)", [ids.setupVersion, ids.company, setupHash(setup), ids.owner, JSON.stringify(setup)])
  await tx.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,1)', [ids.company, ids.setupVersion])
  await tx.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Synthetic office','San Francisco','Office','owned','reporting_company','included','','','','period_start','period_end')", [ids.company, ids.setupVersion, ids.locationId])
}

async function pglite(): Promise<{ engine: Engine; close(): Promise<void> }> {
  const db = new PGlite()
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
  const manifest = await readMigrationManifest()
  for (const migration of manifest.slice(0, 26)) await db.exec(migration.sql)
  await db.exec(`create schema storage;
    create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
    alter table storage.objects enable row level security; grant usage on schema storage to authenticated,anon;`)
  for (const migration of manifest.slice(26)) await db.exec(migration.sql)
  await seed(db)
  return { engine: { name: 'PGlite', transaction: operation => db.transaction(async tx => operation({ query: async (sql: string, args: unknown[] = []) => ({ rows: (await tx.query(sql, args)).rows as never[] }), exec: async (sql: string) => { await tx.exec(sql) } })) }, close: () => db.close() }
}
async function native(): Promise<{ engine: Engine; close(): Promise<void> }> {
  const fixture = await createStagingSchemaFixture(NATIVE!, 'bf32_text_rule', 32, EXISTING_PROJECT_REF)
  await seed(fixture.operator)
  return { engine: { name: 'PostgreSQL 16 (native)', transaction: operation => fixture.operator.transaction(operation) }, close: () => fixture.close() }
}

const accepts = (base: Base, path: string, n: number) => apiVerdict(buildRequest(base, path, 'a'.repeat(n)).request).ok
function buildRequest(base: Base, path: string, value: string) {
  const mode = modeOf(path)
  if (path === 'correctionReason') return { mode, request: requestFor(base.activity, mode, { id: crypto.randomUUID() }, value) }
  return { mode, request: requestFor(activityWith(base, path, value), mode, { id: crypto.randomUUID() }) }
}
/** The most 'a's the API takes in the field, or 0 when it is not free text. */
function apiLimit(base: Base, path: string): number {
  if (!accepts(base, path, 5)) return 0
  let hi = 8
  while (hi < 20000 && accepts(base, path, hi)) hi *= 2
  if (accepts(base, path, hi)) return hi
  let lo = hi / 2
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (accepts(base, path, mid)) lo = mid; else hi = mid }
  return lo
}

export interface Row { field: string; limit: number; case: string; api: string; sqlRaw: string; e2e: string; readable: string }
const bases = probeBases(ids)
/** One representative path per field pattern per base: `kind: pattern`. */
function fieldsOf(base: Base): Array<{ path: string; pattern: string }> {
  const paths = [...stringLeaves(base.activity), 'estimateBasis', 'withdrawalReason', 'correctionReason']
  const seen = new Set<string>(), out: Array<{ path: string; pattern: string }> = []
  for (const path of paths) { const pattern = patternOf(path); if (!seen.has(pattern)) { seen.add(pattern); out.push({ path, pattern }) } }
  return out
}
export const discovered: Array<{ kind: string; pattern: string; limit: number }> = []
const dedupe = new Set<string>()

describe('BF-32: API and SQL text limits', () => {
  const engines: Array<{ engine: Engine; close(): Promise<void> }> = []
  const rows: Record<string, Row[]> = {}
  beforeAll(async () => { engines.push(await pglite()); if (NATIVE) engines.push(await native()) }, 300_000)
  afterAll(async () => { for (const e of engines) await e.close(); if (process.env.BF32_FACTS_OUT) writeFileSync(process.env.BF32_FACTS_OUT, JSON.stringify({ discovered, rows }, null, 1)) })

  test('finds the free-text fields and their API limits', () => {
    for (const base of bases) for (const { path, pattern } of fieldsOf(base)) {
      const limit = apiLimit(base, path)
      if (limit > 0 && !dedupe.has(`${base.kind}|${pattern}`)) { dedupe.add(`${base.kind}|${pattern}`); discovered.push({ kind: base.kind, pattern, limit }) }
    }
    expect(discovered.length).toBeGreaterThan(40)
    // The save-path table and the contract agree on every free-text field and its limit (a new field must be added to the table).
    const table = new Map(SAVE_TEXT_LIMITS.map(([path, , max]) => [path, max]))
    const withoutTable = discovered.filter(d => d.pattern !== 'correctionReason' && table.get(d.pattern) !== d.limit)
    expect(withoutTable.map(d => `${d.kind} ${d.pattern} ${d.limit} (table: ${table.get(d.pattern) ?? 'missing'})`)).toEqual([])
  }, 120_000)

  test('probes every field with every string on every engine', async () => {
    for (const { engine } of engines) {
      const out: Row[] = rows[engine.name] = []
      const done = new Set<string>()
      for (const base of bases) for (const { path, pattern } of fieldsOf(base)) {
        if (process.env.BF32_KINDS && !process.env.BF32_KINDS.split(',').includes(base.kind)) continue
        const limit = apiLimit(base, path)
        const key = `${base.kind}|${pattern}`
        if (limit === 0 || done.has(key)) continue
        done.add(key)
        for (const c of TEXT_CASES) {
          const value = c.build(limit)
          const { mode, request } = buildRequest(base, path, value)
          const api = apiVerdict(request)
          const sqlRaw = await sqlVerdict(engine, ids, base, mode, request as never)
          let e2e = '-', readable = '-'
          if (api.ok) { const r = await endToEnd(engine, ids, base, mode, api.value as never, null); e2e = r.ok ? 'saved' : `DB ${r.code ?? '?'}`; readable = r.ok ? String(r.readable) : '-' }
          out.push({ field: key, limit, case: c.id, api: api.ok ? 'accept' : `refuse: ${api.message}`, sqlRaw: sqlRaw.ok ? 'accept' : `refuse ${sqlRaw.code ?? ''} ${process.env.BF32_MSG ? sqlRaw.message : ''}`.trim(), e2e, readable })
        }
      }
      if (!FACTS_ONLY) {
        // After BF-32: whatever the API accepts, the database stores and the read path reads; no text field leaks a database error.
        // (Utility name, EIA ID and subregion are also bound to the eGRID ZIP lookup, which refuses any other value; the route checks that first.)
        const LOOKUP = /electricity\|payload\.(utilityName|utilityEiaId|subregion)$/
        expect(out.filter(r => r.e2e.startsWith('DB') && !LOOKUP.test(r.field)).map(r => `${r.field} | ${r.case} | ${r.e2e}`)).toEqual([])
        // Every refusal of over-long text names the field, the limit and how far over it is.
        const textRefusals = out.filter(r => r.api.startsWith('refuse') && !r.api.includes('Invalid collection record'))
        for (const r of textRefusals) expect(r.api).toMatch(/is [\d,]+ characters; the limit is [\d,]+ \([\d,]+ over\)/)
        // No string whose NFC form fits the limit is refused as "Invalid collection record." (the generic answer hides the field).
        expect(out.filter(r => r.api.includes('Invalid collection record')).map(r => `${r.field} | ${r.case}`)).toEqual([])
        expect(out.filter(r => r.readable === 'false').map(r => `${r.field} | ${r.case}`)).toEqual([])
      }
    }
  }, 1_800_000)
})

describe('BF-32: a record saved under the old rule still reads, calculates and keeps its hash', () => {
  test('legal under the old rule, over the new one: reads byte for byte; a correction must meet the new rule, with a clear message', async () => {
    const { engine, close } = await pglite()
    try {
      const base = probeBases(ids).find(b => b.kind === 'purchase_spend')!
      // The old Scope 3 contract counted code points and never normalised: 101 x U+0958 is 101 characters (limit 200) and is stored as typed.
      const legacy = withValue(base.activity, 'payload.description', '\u0958'.repeat(101))
      expect(validateCollectionActivity(legacy)).toBeTruthy()
      const record = crypto.randomUUID()
      const asOwner = <T,>(operation: Parameters<typeof engine.transaction<T>>[0]) => engine.transaction(async tx => { await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [ids.owner]); await tx.exec('set local role neuvetra_runtime'); return operation(tx) })
      const first = await asOwner(async tx => (await tx.query<{ version_id: string }>('select * from neuvetra.save_collection_activity($1,$2,$3::text::jsonb)', [ids.company, record, JSON.stringify(requestFor(legacy, 'first', null))])).rows[0]!)
      const stored = await asOwner(async tx => (await tx.query<{ payload: { payload: { description: string } }; payload_sha256: string }>('select payload,payload_sha256 from neuvetra.collection_activity_versions where id=$1', [first.version_id])).rows[0]!)
      expect(stored.payload.payload.description).toBe('\u0958'.repeat(101))
      // Reads go through the unchanged contract and its integrity check (decodeVersion): same value, same hash.
      const read = await asOwner(async tx => (await readCollectionActivities(tx, ids.company, record)).find(r => r.id === record)!)
      expect(read.currentVersion.activity.payload).toMatchObject({ description: '\u0958'.repeat(101) })
      expect(read.currentVersion.payloadSha256).toBe(stored.payload_sha256)
      const context: CollectionContext = { companyId: ids.company, setupVersionId: ids.setupVersion, setupRevision: 1, sameContentSetupVersionIds: [ids.setupVersion], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' },
        locations: [{ id: ids.locationId, name: 'Synthetic office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
      expect(() => planScope3Calculation(read.currentVersion as unknown as Scope3CollectionVersion, context, [])).not.toThrow()
      // A correction (even one that changes another field) must meet the new rule: NFC makes it 202 characters.
      const correction = requestFor(withValue(legacy, 'notes', 'corrected') as never, 'correction', { id: first.version_id })
      let refusal: unknown
      try { validateCollectionSaveInput(correction) } catch (error) { refusal = error }
      expect(refusal).toBeInstanceOf(CollectionTextLimitError)
      expect((refusal as Error).message).toBe('Description is 202 characters; the limit is 200 (2 over). Shorten it and save again.')
      // The read-only census (tools/staging/bf32-text-census.sql) finds exactly this record, by field, and no record already over the old read rule.
      const census = await asOwner(async tx => (await tx.query<Record<string, unknown>>(await Bun.file(new URL('../../../tools/staging/bf32-text-census.sql', import.meta.url)).text())).rows)
      const hit = census.filter(r => Number(r.over_new_rule_versions) > 0)
      expect(hit).toEqual([{ field: 'Description', limit: 200, over_new_rule_versions: 1, over_new_rule_heads: 1, not_nfc_versions: 1, over_old_read_rule: 0 }])
      // Shortened, it saves, and the new version reads back.
      const fixed = requestFor(withValue(withValue(legacy, 'payload.description', '\u0958'.repeat(100)), 'notes', 'corrected') as never, 'correction', { id: first.version_id })
      const saved = await asOwner(tx => saveCollectionActivity(tx, ids.owner, ids.company, record, fixed))
      expect(saved.version.activity.payload).toMatchObject({ description: '\u0915\u093c'.repeat(100) })
    } finally { await close() }
  }, 120_000)
})

// BF-20 (backend audit BI-02 and lead 1; 13 November 2026): the currency conversion writes its lines set-based through
// 0030's save_scope3_spend_corrections instead of one save_collection_activity call per line. Differential test: the
// per-line implementation of main (5b98b86, kept test-only in scope3-spend-currency-per-line.reference.ts) and the new one
// run over the same generated data (each in its own transaction from the same state) and every stored row of every company
// table, every table's row count, the response and any refusal are compared:
// - with the reference given BF-20's one shared correction reason: identical, receipts' request hashes included;
// - with the reference as on main: identical except the correction reason (one per conversion now, the order's only stated
//   change) and the receipt request hash that covers it.
// Runs on PGlite at schema 31 and 32; on native PostgreSQL too when BF20_NATIVE_DATABASE_URLS lists disposable loopback
// databases (operator URLs of databases migrated as hosted.test.ts migrates them; each is dropped and re-created here).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createPostgresConnection } from './hosted'
import { scope3SpendCorrectionChunks } from './scope3-spend-imports'
import { differential, pgliteAt, seedCompany, SEQUENCE, type DiffDb, type DifferentialCase, type Fixture } from './scope3-currency-differential.fixture'

describe('BF-20: correction chunks (pure)', () => {
  test('order kept; at most maxLines lines and maxBytes of JSON per chunk; one item larger than maxBytes is its own chunk', () => {
    const items = Array.from({ length: 7001 }, (_, i) => ({ i, pad: 'x'.repeat(i % 7) }))
    const chunks = scope3SpendCorrectionChunks(items)
    expect(chunks.map(c => c.length)).toEqual([3000, 3000, 1001])
    expect(chunks.flat()).toEqual(items)
    const sized = scope3SpendCorrectionChunks(items.slice(0, 50), 3000, 200)
    expect(sized.flat()).toEqual(items.slice(0, 50))
    for (const c of sized) expect(c.length === 1 || c.reduce((n, x) => n + Buffer.byteLength(JSON.stringify(x)) + 1, 0) <= 200).toBe(true)
    expect(scope3SpendCorrectionChunks([{ big: 'y'.repeat(500) }, { a: 1 }], 3000, 100).map(c => c.length)).toEqual([1, 1])
    expect(scope3SpendCorrectionChunks([])).toEqual([])
  })
  test('a worst-case line (every text at its contract maximum) keeps 3,000 lines within two chunks and every chunk under 8 MiB as jsonb text', () => {
    const line = { recordId: '0'.repeat(36), expectedVersionId: '0'.repeat(36), activity: { notes: 'n'.repeat(2000) + '\n' + 'Currency conversion: '.padEnd(400, 'c'), reference: 'r'.repeat(200), sourceId: 's'.repeat(120), payload: { supplierName: 'v'.repeat(200), glAccount: 'g'.repeat(120), description: 'd'.repeat(200) } } }
    const chunks = scope3SpendCorrectionChunks(Array.from({ length: 3000 }, () => line))
    for (const c of chunks) expect(Buffer.byteLength(JSON.stringify({ reason: 'r'.repeat(2000), corrections: c })) * 2).toBeLessThan(8 * 1024 * 1024)
    expect(chunks.length).toBeLessThanOrEqual(4)
  })
})

const NATIVE = (process.env.BF20_NATIVE_DATABASE_URLS ?? '').split(',').filter(Boolean)
for (const url of NATIVE) {
  const parsed = new URL(url)
  if (parsed.hostname !== '127.0.0.1' || !/^bf20_/.test(parsed.pathname.slice(1))) throw new Error('BF-20 native differential: a disposable loopback database named bf20_* is required.')
}
const targets: Array<{ name: string; open: () => Promise<DiffDb> }> = [
  { name: 'PGlite schema 31', open: () => pgliteAt(31) },
  { name: 'PGlite schema 32', open: () => pgliteAt(32) },
  ...NATIVE.map(url => ({ name: `native ${new URL(url).port}${new URL(url).pathname}`, open: async () => {
    const c = createPostgresConnection(url, { tls: false })
    return { query: c.query.bind(c), exec: c.exec.bind(c), transaction: c.transaction.bind(c), close: () => c.close() } as DiffDb
  } })),
]

for (const target of targets) describe(`BF-20 differential: per-line (main) vs set-based, ${target.name}`, () => {
  let db: DiffDb, fx: Fixture, other: Fixture
  const results: DifferentialCase[] = []
  beforeAll(async () => {
    db = await target.open()
    other = await seedCompany(db, 7, [40, 40], { prefix: '20b00000' })
    fx = await seedCompany(db, 20, [160, 160], { prefix: '20a00000' })
  }, 300_000)
  afterAll(async () => { console.info(`BF-20 differential ${target.name}:`, JSON.stringify(results.map(r => [r.input.currency, r.input.rate, r.input.rateDate, r.converted, r.skipped, r.refused, r.mismatches]))); await db?.close() })

  test('every conversion of the adversarial sequence: identical rows, row counts, response and refusals', async () => {
    for (const input of SEQUENCE) results.push(await differential(db, fx, other, input))
    expect(results.every(r => r.mismatches === 0)).toBe(true)
    // The sequence exercises conversions, skips of every reason, a refusal and a conversion with nothing to do.
    expect(results.reduce((n, r) => n + r.converted, 0)).toBeGreaterThan(100)
    expect(results.some(r => r.refused !== null)).toBe(true)
    expect(results.some(r => r.refused === null && r.converted === 0)).toBe(true)
  }, 600_000)

  test('refusals from SQL: the line location no longer in setup (23503), rejected evidence (22023); the same SQLSTATE from both, nothing saved', async () => {
    const gbp2026 = { currency: 'GBP', rate: '1.27', rateSource: 'Bank of England', rateDate: '2026-02-01' }
    // A third setup version without the lines' location: every line is refused by both (23503); then back to setup 2.
    const v3 = fx.setups[1]!.replace(/.{12}$/, '000000000006'), elsewhere = fx.setups[1]!.replace(/.{12}$/, '000000000007')
    await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by,previous_version_id) values($1,$2,3,'{}',$3,'2025-01-01','2026-01-01','operational_control',$4,$5)", [v3, fx.company, '3'.repeat(64), fx.owner, fx.setups[1]])
    await db.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Other plant','Fresno','Plant','owned','reporting_company','included','','','','period_start','period_end')", [fx.company, v3, elsewhere])
    await db.query('update neuvetra.company_setup_heads set version_id=$2, revision=3 where company_id=$1', [fx.company, v3])
    const moved = await differential(db, fx, other, gbp2026)
    await db.query('update neuvetra.company_setup_heads set version_id=$2, revision=2 where company_id=$1', [fx.company, fx.setups[1]])
    // Both imported files' evidence rejected by quarantine review: both refuse 22023.
    for (const n of [101, 102]) await db.query("insert into neuvetra.collection_evidence_quarantine_events(id,company_id,evidence_id,status,scanner_reference,details,event_seq) values(gen_random_uuid(),$1,$2,'rejected','bf20','Synthetic rejection',(select coalesce(max(event_seq),0)+1 from neuvetra.collection_evidence_quarantine_events))", [fx.company, fx.company.replace(/.{12}$/, String(n).padStart(12, '0'))])
    const rejected = await differential(db, fx, other, gbp2026)
    expect([moved.refused, moved.mismatches, rejected.refused, rejected.mismatches]).toEqual(['23503', 0, '22023', 0])
    results.push(moved, rejected)
  }, 120_000)

  test('a converted version is immutable, as before (the same triggers apply to the set-based writer)', async () => {
    const id = (await db.query<{ id: string }>("select id from neuvetra.collection_activity_versions where company_id=$1 and correction_reason like 'Converted from %' limit 1", [fx.company])).rows[0]!.id
    expect(await db.query("update neuvetra.collection_activity_versions set notes='x' where id=$1", [id]).then(() => 'updated', () => 'refused')).toBe('refused')
    expect(await db.query('delete from neuvetra.collection_activity_versions where id=$1', [id]).then(() => 'deleted', () => 'refused')).toBe('refused')
  })
})

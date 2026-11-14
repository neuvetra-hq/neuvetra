// BF-20 (backend audit BI-02 and lead 1; 13 November 2026): the currency conversion writes its lines set-based through
// 0030's save_scope3_spend_corrections instead of one save_collection_activity call per line. Differential test: the
// per-line implementation of main (5b98b86, kept test-only in scope3-spend-currency-per-line.reference.ts) and the new one
// run over the same generated data (each in its own transaction from the same state) and every stored row of every company
// table, every table's row count, the response and any refusal are compared:
// - with the reference given BF-20's one shared correction reason: identical, receipts' request hashes included;
// - with the reference as on main: identical except the correction reason (one per conversion now, the order's only stated
//   change) and the receipt request hash that covers it.
// Runs on PGlite at schema 31 (schema 32 in scope3-currency-set-based-32.test.ts); on native PostgreSQL too when BF20_NATIVE_DATABASE_URLS lists disposable loopback
// databases (operator URLs of databases migrated as hosted.test.ts migrates them; each is dropped and re-created here).
import { describe, expect, test } from 'bun:test'
import { createPostgresConnection } from './hosted'
import { scope3SpendCorrectionChunks } from './scope3-spend-imports'
import { pgliteAt, registerDifferentialSuite, type DiffDb } from './scope3-currency-differential.fixture'

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
  // One PGlite schema per file (this file 31, scope3-currency-set-based-32.test.ts 32): two PGlite
  // instances plus the rest of the package suite in one process exhausted PGlite's WebAssembly memory on this host.
  { name: 'PGlite schema 31', open: () => pgliteAt(31) },
  ...NATIVE.map(url => ({ name: `native ${new URL(url).port}${new URL(url).pathname}`, open: async () => {
    const c = createPostgresConnection(url, { tls: false })
    return { query: c.query.bind(c), exec: c.exec.bind(c), transaction: c.transaction.bind(c), close: () => c.close() } as DiffDb
  } })),
]

for (const target of targets) registerDifferentialSuite(target.name, target.open)

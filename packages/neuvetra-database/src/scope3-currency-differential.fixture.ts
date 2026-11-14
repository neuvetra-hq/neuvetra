// BF-20 test fixture (test-only; never imported by product code). The differential harness for the currency conversion:
// the same generated companies on PGlite or native PostgreSQL, the per-line reference (main at 5b98b86) and the set-based
// implementation run over the same database state (each in its own transaction, the first rolled back), and every stored
// row of every company table, every table's row count and the response compared after normalising only what is random
// by construction (new version IDs, idempotency keys, the transaction time).
import { createHash } from 'node:crypto'
import { expect } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import type { WorkspaceSql } from './workspace'
import { parseScope3SpendCsv, SCOPE3_SPEND_IMPORT_COLUMNS } from './scope3-spend-import'
import { convertScope3SpendCurrency, importScope3SpendFile } from './scope3-spend-imports'
import { convertScope3SpendCurrencyPerLineReference } from './scope3-spend-currency-per-line.reference'
import { scope3SpendConversionGroupReason, scope3SpendConversionReason, type Scope3SpendConversionInput } from './scope3-spend-currency'

export interface DiffDb extends WorkspaceSql { transaction<T>(operation: (tx: WorkspaceSql) => Promise<T>): Promise<T>; close(): Promise<void> }

/** A PGlite database at schema `length` (31 or 32), built as the package's PGlite tests build it. */
export async function pgliteAt(length: number): Promise<DiffDb> {
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
  for (const migration of manifest.slice(26, length)) await db.exec(migration.sql)
  const wrap = (q: { query: PGlite['query']; exec: PGlite['exec'] }): WorkspaceSql => ({ query: async <R,>(sql: string, args: unknown[] = []) => ({ rows: (await q.query<R>(sql, args)).rows }), exec: async (sql: string) => { await q.exec(sql) } })
  return { ...wrap(db), transaction: operation => db.transaction(tx => operation(wrap(tx))), close: () => db.close() }
}

export class Rollback<T> extends Error { constructor(readonly value: T) { super('rollback') } }
/** Runs `operation` as `actor` (the runtime role and the hosted timeouts), then commits, or rolls back when `keep` is false. */
export async function asActor<T>(db: DiffDb, actor: string, operation: (tx: WorkspaceSql) => Promise<T>, options: { keep?: boolean; after?: (tx: WorkspaceSql) => Promise<unknown> } = {}): Promise<{ value: T; after: unknown }> {
  try {
    return await db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actor])
      await tx.exec("set local lock_timeout='5s'; set local statement_timeout='15s'; set local role neuvetra_runtime")
      const value = await operation(tx)
      await tx.exec('reset role')
      const after = options.after ? await options.after(tx) : undefined
      if (options.keep === false) throw new Rollback({ value, after })
      return { value, after }
    })
  } catch (error) {
    if (error instanceof Rollback) return error.value as { value: T; after: unknown }
    throw error
  }
}

/**
 * The rows of every company table that belong to `companies` (as jsonb text, sorted) and every neuvetra table's row count
 * (company tables included, so a row written for any other company shows), read in one statement by the caller's role.
 */
const snapshotSql = new Map<string, string>()
export async function snapshot(tx: WorkspaceSql, companies: readonly string[]): Promise<Record<string, string[]>> {
  const key = 'neuvetra'
  if (!snapshotSql.has(key)) {
    const tables = (await tx.query<{ table_name: string; has_company: boolean }>(`select t.table_name,exists(select 1 from information_schema.columns c where c.table_schema=t.table_schema and c.table_name=t.table_name and c.column_name='company_id') has_company
      from information_schema.tables t where t.table_schema='neuvetra' and t.table_type='BASE TABLE' order by t.table_name`)).rows
    snapshotSql.set(key, tables.flatMap(t => [`select '#count' t,'${t.table_name}='||count(*) r from neuvetra.${t.table_name} x`, ...(t.has_company ? [`select '${t.table_name}' t,to_jsonb(x)::text r from neuvetra.${t.table_name} x where x.company_id=any($1::uuid[])`] : [])]).join('\nunion all\n'))
  }
  const out: Record<string, string[]> = {}
  for (const row of (await tx.query<{ t: string; r: string }>(snapshotSql.get(key)!, [companies])).rows) (out[row.t] ??= []).push(row.r)
  for (const k of Object.keys(out)) out[k]!.sort()
  return out
}

/**
 * A snapshot with what is random by construction replaced: each new version ID by `version:<record>:<revision>` (wherever
 * it appears), each new idempotency key, and the transaction time of new rows. `mask` names further keys to blank in new
 * rows (the expected differences, e.g. correction_reason). Rows present before the run are compared verbatim.
 */
export function normalise(before: Record<string, string[]>, after: Record<string, string[]>, mask: string[] = []) {
  const old = new Set(Object.values(before).flat())
  const ids = new Map<string, string>()
  for (const text of after.collection_activity_versions ?? []) if (!old.has(text)) { const row = JSON.parse(text); ids.set(row.id, `version:${row.record_id}:${row.revision}`) }
  const swap = (value: unknown): unknown => typeof value === 'string' ? (ids.get(value) ?? value) : Array.isArray(value) ? value.map(swap) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swap(v)])) : value
  const out: Record<string, string[]> = {}
  for (const [table, rows] of Object.entries(after)) out[table] = rows.map(text => {
    if (old.has(text) || table === '#count') return text
    const row = swap(JSON.parse(text)) as Record<string, unknown>
    for (const key of ['created_at', 'idempotency_key', ...mask]) if (key in row) row[key] = `<${key}>`
    return JSON.stringify(row)
  }).sort()
  return { rows: out, ids }
}

export const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
/** A seeded PRNG (mulberry32), so a failure names a reproducible seed. */
export function prng(seed: number) {
  let a = seed >>> 0
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const int = (n: number) => Math.floor(next() * n)
  return { next, int, pick: <T,>(items: readonly T[]) => items[int(items.length)]! }
}

/** Adversarial amounts as written in a file: plain decimals of 1-12 integer and 0-3 decimal digits, half-cent boundaries, the extremes, and the kinds a conversion skips. */
export function amountText(r: ReturnType<typeof prng>, huge = true): string {
  const digits = (n: number) => Array.from({ length: n }, (_, i) => String(i === 0 ? 1 + r.int(9) : r.int(10))).join('')
  switch (r.int(14)) {
    case 0: return r.pick(['0.005', '0.015', '0.025', '0.5', '1.5', '2.5', '0.125', '0.375', '10.005', '0.001', '0.999', '0', '0.000', '1.000'])
    case 1: return huge ? r.pick(['999999999999.999', '999999999999', '100000000000.001', '0.001', '1']) : r.pick(['99999999999.999', '0.001', '1'])
    case 2: return r.pick(['-50', '-0.01', '-1,200.00', '-0'])
    case 3: return r.pick(['n/a', 'TBD', '1.2.3', '12 EUR'])
    case 4: return r.pick(['1234.5678', '1234567890123', '0.0001'])
    case 5: return `${digits(1 + r.int(4))},${String(r.int(1000)).padStart(3, '0')}.${String(r.int(100)).padStart(2, '0')}`
    case 6: return `${digits(1 + r.int(huge ? 12 : 11))}`
    default: return `${r.int(3) === 0 ? '0' : digits(1 + r.int(7))}.${String(r.int(10 ** (1 + r.int(3)))).padStart(1 + r.int(3), '0').slice(0, 3)}`
  }
}

export interface Fixture { owner: string; company: string; location: string; setups: string[] }
const HEADER = SCOPE3_SPEND_IMPORT_COLUMNS.join(',')

/**
 * A company with two setup versions (a fiscal year 2025-07-01..2026-07-01, then calendar 2025, the same location) and two
 * imported files of generated lines: many currencies, dated in 2024-2026 or undated, every amount kind above, long and
 * Unicode texts. Amounts of 12 integer digits only in CAD (a conversion at a rate above 1 then overflows the 12-digit
 * contract and is refused whole, by both implementations). File 1 is imported under the fiscal setup (its lines keep that setup version and period), file 2 under
 * the calendar one.
 */
export async function seedCompany(db: DiffDb, seed: number, lines: [number, number], ids: { prefix: string; currencies?: readonly string[]; plain?: boolean }): Promise<Fixture> {
  const r = prng(seed)
  const id = (n: number) => `${ids.prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`
  const fx: Fixture = { owner: id(1), company: id(2), location: id(3), setups: [id(4), id(5)] }
  await db.query('insert into auth.users(id) values($1)', [fx.owner])
  await db.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,'Synthetic BF-20','US','CA',$2)", [fx.company, fx.owner])
  await db.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')", [fx.company, fx.owner])
  await db.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)', [fx.owner, fx.company])
  const setup = async (version: string, revision: number, start: string, end: string, previous: string | null) => {
    await db.query("insert into neuvetra.company_setup_versions(id,company_id,revision,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by,previous_version_id) values($1,$2,$3,'{}',$4,$5,$6,'operational_control',$7,$8)", [version, fx.company, revision, String(revision).repeat(64), start, end, fx.owner, previous])
    await db.query("insert into neuvetra.company_setup_locations(company_id,version_id,id,name,locality,purpose,occupancy,control,inclusion,reason,other_entity,operator_details,start_mode,end_mode) values($1,$2,$3,'Synthetic plant','Fresno','Plant','owned','reporting_company','included','','','','period_start','period_end')", [fx.company, version, fx.location])
    if (revision === 1) await db.query('insert into neuvetra.company_setup_heads(company_id,version_id,revision) values($1,$2,1)', [fx.company, version])
    else await db.query('update neuvetra.company_setup_heads set version_id=$2, revision=$3 where company_id=$1', [fx.company, version, revision])
  }
  const csvCell = (text: string) => /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  const file = async (n: number, count: number, dates: string[]) => {
    const vendors = ['Bosch Rexroth GmbH', 'Magna Components Canada', 'Søren & Ærø ApS', 'Café Crème SARL', 'Société Générale "Services"', 'Ünïcödé Supplies Kft', 'Nakamura 株式会社', 'Plain Vendor LLC']
    const body = Array.from({ length: count }, (_, i) => {
      const currency = r.pick(ids.currencies ?? ['EUR', 'EUR', 'EUR', 'EUR', 'CAD', 'GBP', 'JPY', 'CHF', 'USD'])
      const date = ids.plain ? dates[0]! : r.int(6) === 0 ? '' : r.pick(dates)
      const description = r.int(10) === 0 ? 'Long description '.repeat(11).slice(0, 190) : `Line ${n}-${i} ${r.pick(['valves', 'motor housings', 'consulting', 'freight, inbound', 'boxes'])}`
      return [`L${n}-${String(i).padStart(4, '0')}`, date, r.pick(vendors), String(5000 + r.int(80)), r.pick(['Components', 'Services', 'Packaging, misc']), description, ids.plain ? `${1 + r.int(99999)}.${String(r.int(1000)).padStart(3, '0')}` : amountText(r, currency === 'CAD'), currency, '2025', '', '', '', ''].map(csvCell).join(',')
    }).join('\n')
    const bytes = new TextEncoder().encode(`${HEADER}\n${body}\n`)
    const evidence = id(100 + n)
    await db.query("insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values($1,$2,$3,$4,'text/csv',$5,$6,$7)", [evidence, fx.company, `${fx.company}/original/${evidence}`, `file-${n}.csv`, bytes.byteLength, sha(bytes), fx.owner])
    await asActor(db, fx.owner, tx => importScope3SpendFile(tx, fx.owner, fx.company, { parsed: parseScope3SpendCsv(bytes), fileSha256: sha(bytes), evidenceId: evidence, locationId: fx.location }))
  }
  await setup(fx.setups[0]!, 1, '2025-07-01', '2026-07-01', null)
  if (lines[0] > 0) await file(1, lines[0], [ids.plain ? '2025-12-31' : '2025-07-14', '2025-12-31', '2026-01-01', '2026-03-15', '2026-06-30', '2025-02-01', '03/14/2026'])
  await setup(fx.setups[1]!, 2, '2025-01-01', '2026-01-01', fx.setups[0]!)
  if (lines[1] > 0) await file(2, lines[1], ['2025-01-01', '2025-06-30', '2025-12-31', '2024-12-31', '2026-01-02', '12/01/2025'])
  return fx
}

export type Impl = (tx: WorkspaceSql, actor: string, company: string, input: unknown) => Promise<{ converted: Array<{ recordId: string; sourceId: string; versionId: string; revision: number; from: string; usd: string }>; skipped: Array<{ recordId: string; sourceId: string; reason: string }> }>
const shared: Impl = (tx, actor, company, input) => convertScope3SpendCurrencyPerLineReference(tx, actor, company, input, { reason: c => scope3SpendConversionGroupReason(c) })
const original: Impl = (tx, actor, company, input) => convertScope3SpendCurrencyPerLineReference(tx, actor, company, input)

async function run(db: DiffDb, fx: Fixture, impl: Impl, input: unknown, keep: boolean, companies: string[]) {
  let calls = 0
  const counting = (tx: WorkspaceSql): WorkspaceSql => ({ query: (sql, args) => { if (sql.includes('save_scope3_spend_corrections')) calls++; return tx.query(sql, args) }, exec: sql => tx.exec(sql) })
  try {
    const { value, after } = await asActor(db, fx.owner, tx => impl(counting(tx), fx.owner, fx.company, input), { keep, after: tx => snapshot(tx, companies) })
    return { ok: true as const, value, after: after as Record<string, string[]>, calls }
  } catch (error) {
    return { ok: false as const, code: (error as { code?: string }).code ?? `no code: ${(error as Error).message}`, message: (error as Error).message }
  }
}
const responseOf = (value: Awaited<ReturnType<Impl>>, ids: Map<string, string>) => ({ converted: value.converted.map(c => ({ ...c, versionId: ids.get(c.versionId) ?? `UNMAPPED ${c.versionId}` })), skipped: value.skipped })

export interface DifferentialCase { input: Scope3SpendConversionInput; converted: number; skipped: number; refused: string | null; mismatches: number; rows: number; chunks: number }
/** One conversion, three runs from the same state: reference (shared reason) and reference (main) rolled back, then the new one committed. */
export async function differential(db: DiffDb, fx: Fixture, other: Fixture, input: Scope3SpendConversionInput, options: { againstMain?: boolean } = {}): Promise<DifferentialCase> {
  const companies = [fx.company, other.company]
  const before = await db.transaction(tx => snapshot(tx, companies))
  const a = await run(db, fx, shared, input, false, companies)
  const b = options.againstMain === false ? a : await run(db, fx, original, input, false, companies)
  const n = await run(db, fx, convertScope3SpendCurrency, input, true, companies)
  let mismatches = 0
  const same = (x: unknown, y: unknown) => { try { expect(x).toEqual(y) } catch (error) { mismatches++; throw error } }
  same([a.ok, b.ok], [n.ok, n.ok])
  if (!n.ok || !a.ok || !b.ok) {
    // A refusal: the same SQLSTATE from every implementation, and nothing saved (the next snapshot equals `before`).
    same([(a as { code: string | null }).code, (b as { code: string | null }).code], [(n as { code: string | null }).code, (n as { code: string | null }).code])
    same(await db.transaction(tx => snapshot(tx, companies)), before)
    return { input, converted: 0, skipped: 0, refused: (n as { code: string | null }).code, mismatches, rows: 0, chunks: 0 }
  }
  const na = normalise(before, a.after), nn = normalise(before, n.after)
  same(nn.rows, na.rows)
  same(responseOf(n.value, nn.ids), responseOf(a.value, na.ids))
  const fresh = new Set(before.collection_activity_versions ?? [])
  const reasons = (after: Record<string, string[]>) => (after.collection_activity_versions ?? []).filter(text => !fresh.has(text)).map(text => JSON.parse(text) as { record_id: string; correction_reason: string }).sort((x, y) => x.record_id.localeCompare(y.record_id))
  // The new reason: one for the whole conversion.
  const groupReason = scope3SpendConversionGroupReason(input).normalize('NFC')
  same(reasons(n.after).map(r => r.correction_reason), reasons(n.after).map(() => groupReason))
  if (options.againstMain !== false) {
    // Against main exactly: only the reason (main's is per line) and the receipt request hash that covers it differ.
    const mask = ['correction_reason', 'request_sha256']
    same(normalise(before, n.after, mask).rows, normalise(before, b.after, mask).rows)
    same(responseOf(n.value, nn.ids), responseOf(b.value, normalise(before, b.after).ids))
    const byRecord = new Map(n.value.converted.map(c => [c.recordId, c]))
    same(reasons(b.after).map(r => r.correction_reason), reasons(b.after).map(r => { const c = byRecord.get(r.record_id)!; return scope3SpendConversionReason({ ...input, amount: c.from, usd: c.usd }).normalize('NFC') }))
  }
  // The other company's rows are exactly as before (tenant isolation), in every table.
  const theirs = (s: Record<string, string[]>) => Object.entries(s).flatMap(([table, rows]) => rows.filter(text => text.includes(other.company)).map(text => `${table} ${text}`)).sort()
  same(theirs(n.after), theirs(before))
  return { input, converted: n.value.converted.length, skipped: n.value.skipped.length, refused: null, mismatches, rows: Object.values(nn.rows).flat().length, chunks: n.calls }
}

/** The adversarial conversion sequence run on every database (each committed with the new implementation before the next). */
export const SEQUENCE: Scope3SpendConversionInput[] = [
  { currency: 'EUR', rate: '1.0823', rateSource: 'ECB euro reference rate', rateDate: '2025-06-30' },
  { currency: 'EUR', rate: '1.0823', rateSource: 'ECB euro reference rate', rateDate: '2025-06-30' }, // again: nothing new converts
  { currency: 'EUR', rate: '0.00000001', rateSource: 'Tiny synthetic rate (8 decimals)', rateDate: '2026-01-15' },
  { currency: 'GBP', rate: '1.005', rateSource: 'Half-cent boundary rate', rateDate: '2025-12-31' },
  { currency: 'JPY', rate: '0.00671234', rateSource: `Banque de France — taux de référence; "quoted", (paren) ${'x'.repeat(120)}`, rateDate: '2025-03-01' },
  { currency: 'CAD', rate: '999999.99999999', rateSource: 'Huge synthetic rate', rateDate: '2025-07-01' },
  { currency: 'CHF', rate: '0.5', rateSource: 'Half rate (every .x05 a tie)', rateDate: '2026-03-01' },
  { currency: 'CAD', rate: '0.73', rateSource: 'Bank of Canada', rateDate: '2025-07-01' },
  { currency: 'CHF', rate: '1.1', rateSource: 'SNB', rateDate: '2025-08-01' },
  { currency: 'SEK', rate: '0.1', rateSource: 'No lines in this currency', rateDate: '2025-08-01' },
]


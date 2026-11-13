// BF-12 QA (accounting audit B-2; Claude, 13 November 2026): which spend lines the BF-12 supplier-name rule will newly
// replace, before it is deployed. Read-only: it reads rows the owner exported (see below) and prints a report; it connects to
// nothing and writes nothing.
//
// Why a script and not SQL: the rule is `scope3SpendVendorKey` (NFKC, JavaScript toLowerCase, `&` as "and", every run of
// characters that are not Unicode letters or digits as one space, legal suffixes stripped repeatedly). PostgreSQL has
// normalize(..., NFKC), but its lower() and its regex classes follow the database's collation and ctype, not Unicode as
// JavaScript applies it, so a SQL copy could disagree on non-ASCII names. This script calls the TypeScript function itself.
//
// What the owner exports (read-only role; psql -At writes one JSON object per line):
//
//   psql "$URL" -At -c "select json_build_object('companyId',v.company_id,'recordId',v.record_id,'kind',r.kind,'sourceId',v.source_id,
//     'periodStart',v.period_start,'periodEndExclusive',v.period_end_exclusive,'payload',v.payload->'payload')
//     from neuvetra.collection_activity_heads h
//     join neuvetra.collection_activity_versions v on v.id=h.version_id and v.company_id=h.company_id
//     join neuvetra.collection_activity_records r on r.id=h.record_id and r.company_id=h.company_id
//     where r.kind in ('purchase_spend','purchase_supplier','partner_reported') and v.state='active'" > bf12-lines.jsonl
//
//   # optional, for the kg each line currently counts (from each company's newest frozen version, if any):
//   psql "$URL" -At -c "select json_build_object('companyId',s.company_id,'reportingYear',s.reporting_year,'revision',s.revision,'basis',s.change_log_basis::json)
//     from neuvetra.scope3_report_versions s
//     where s.revision=(select max(x.revision) from neuvetra.scope3_report_versions x where x.company_id=s.company_id and x.reporting_year=s.reporting_year)" > bf12-versions.jsonl
//
// Usage: bun tools/scope3/bf12-vendor-key-collisions.ts bf12-lines.jsonl [bf12-versions.jsonl]
//
// A line is listed when it is an active spend line of a category the record can replace (supplier figures 1 and 2; partner
// figures also their own category 4, 5 or 9), in the same reporting year, is NOT replaced today (no active supplier or
// partner record names it by the earlier exact rule or lists its mapping key), and its supplier's vendor key equals the
// vendor key of a supplier such a record names. Not checked here (the results run checks them): whether the line's site is
// included and whether both records fall inside the setup reporting period. So the list is an upper bound; a listed line
// whose site is excluded or whose period is outside the reporting period is not replaced after BF-12 either.
// "kg counted" is the line's total in the company's newest frozen version when that version calculated it; frozen versions
// can be older than the live results, so it is a guide, not the live figure. Empty when there is no frozen version.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { scope3SpendMappingKeyInput } from '../../packages/neuvetra-database/src/scope3-collection'
import { scope3SpendVendorKey } from '../../packages/neuvetra-database/src/scope3-spend-grouping'
import { scope3ReportingYearOf } from '../../packages/neuvetra-database/src/scope3-assessment-contract'

type Row = { companyId: string; recordId: string; kind: string; sourceId: string; periodStart: string; periodEndExclusive: string; payload: Record<string, any> }
const [linesFile, versionsFile] = process.argv.slice(2)
if (!linesFile) throw new Error('Usage: bun tools/scope3/bf12-vendor-key-collisions.ts bf12-lines.jsonl [bf12-versions.jsonl]')
const jsonl = (file: string) => readFileSync(file, 'utf8').split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line))
const rows: Row[] = jsonl(linesFile)
const counted = new Map<string, string>()
if (versionsFile) for (const v of jsonl(versionsFile)) for (const r of v.basis?.results?.records ?? []) {
  if (r.derivedFrom === null && r.outcome === 'calculated' && r.result?.total?.display) counted.set(`${v.companyId}\u0000${r.recordId}`, r.result.total.display)
}
const exact = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')  // the rule before BF-12
const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const yearOf = (row: Row) => { try { return scope3ReportingYearOf(String(row.periodEndExclusive)) } catch { return null } }  // as the pre-pass does

const out: Array<{ companyId: string; spendRecordId: string; sourceId: string; category: number; supplier: string; replacingRecordId: string; namedSupplier: string; vendorKey: string; kg: string }> = []
for (const company of [...new Set(rows.map(row => row.companyId))].sort()) {
  const mine = rows.filter(row => row.companyId === company)
  const replacers = mine.filter(row => (row.kind === 'purchase_supplier' || row.kind === 'partner_reported') && row.payload.supersedesSpend)
    .map(row => ({ row, named: String(row.payload.supersedesSpend.supplierName ?? ''), keys: new Set<string>(row.payload.supersedesSpend.mappingKeys ?? []),
      categories: new Set<number>([1, 2, ...(row.kind === 'partner_reported' && [4, 5, 9].includes(row.payload.category) ? [row.payload.category] : [])]) }))
    .sort((a, b) => a.row.recordId < b.row.recordId ? -1 : 1)
  for (const line of mine.filter(row => row.kind === 'purchase_spend')) {
    const supplier = String(line.payload.supplierName ?? ''), key = sha256(scope3SpendMappingKeyInput(line.payload as any))
    const eligible = replacers.filter(r => r.categories.has(line.payload.category) && yearOf(r.row) === yearOf(line))
    const replacedToday = eligible.some(r => (exact(supplier) !== '' && exact(supplier) === exact(r.named)) || r.keys.has(key))
    if (replacedToday) continue
    const vendorKey = scope3SpendVendorKey(supplier)
    const by = vendorKey === '' ? undefined : eligible.find(r => scope3SpendVendorKey(r.named) === vendorKey)
    if (by) out.push({ companyId: company, spendRecordId: line.recordId, sourceId: line.sourceId, category: line.payload.category, supplier, replacingRecordId: by.row.recordId,
      namedSupplier: by.named, vendorKey, kg: counted.get(`${company}\u0000${line.recordId}`) ?? '' })
  }
}
const perCompany = new Map<string, { lines: number; kg: number }>()
for (const item of out) { const c = perCompany.get(item.companyId) ?? { lines: 0, kg: 0 }; c.lines++; c.kg += item.kg ? Number(item.kg) : 0; perCompany.set(item.companyId, c) }
console.log('Per company (lines BF-12 would newly replace or hold; kg from the newest frozen version, 4 dp):')
for (const [company, c] of perCompany) console.log(`${company}\t${c.lines} line(s)\t${c.kg.toFixed(4)} kg`)
console.log(`Total: ${out.length} line(s) in ${perCompany.size} compan${perCompany.size === 1 ? 'y' : 'ies'}.`)
console.log('\nLines:')
console.log(['companyId', 'spendRecordId', 'sourceId', 'category', 'supplier on the line', 'replacing record', 'supplier named on it', 'vendor key', 'kg counted (frozen)'].join('\t'))
for (const item of out) console.log([item.companyId, item.spendRecordId, item.sourceId, item.category, item.supplier, item.replacingRecordId, item.namedSupplier, item.vendorKey, item.kg].join('\t'))

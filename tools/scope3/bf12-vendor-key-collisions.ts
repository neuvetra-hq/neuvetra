// BF-12 QA (accounting audit B-2; Claude, 13 November 2026): which spend lines the BF-12 supplier-name rule changes, before it
// is deployed. Read-only: it reads rows the owner exported with the SELECT statements in
// tools/scope3/bf12-vendor-key-collisions.sql and prints a report; it connects to nothing and writes nothing.
//
// It applies the product's own rules, not a copy: the company context is built from the exported setup as
// packages/neuvetra-database/src/collection.ts readCollectionContext builds it, each record is decoded with
// validateCollectionActivity, and `planScope3SupersessionMatches` decides, per spend line and per replacing record, whether
// they match by mapping key, by the earlier exact name rule, or only by the vendor key, inside the setup reporting period
// (or the same reporting year without one) and at sites setup includes, exactly as the results run's pre-pass does.
//
// Usage: bun tools/scope3/bf12-vendor-key-collisions.ts bf12-records.jsonl bf12-setups.jsonl [bf12-versions.jsonl]
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { validateCollectionActivity, type CollectionContext } from '../../packages/neuvetra-database/src/collection-contract'
import { planScope3SupersessionMatches, type Scope3CollectionVersion } from '../../packages/neuvetra-database/src/scope3-collection'

const [recordsFile, setupsFile, versionsFile] = process.argv.slice(2)
if (!recordsFile || !setupsFile) throw new Error('Usage: bun tools/scope3/bf12-vendor-key-collisions.ts bf12-records.jsonl bf12-setups.jsonl [bf12-versions.jsonl]')
const jsonl = (file: string) => readFileSync(file, 'utf8').split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line))
const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

// The context, as readCollectionContext builds it (collection.ts).
function contextOf(row: any): CollectionContext {
  const setup = row.setup
  const locations = (setup.locations ?? []).map((location: any) => {
    const entity = (setup.entities ?? []).find((item: any) => item.id === location.entityId)
    const { id, name, inclusion, control, entityId, start, endExclusive, startMode, endMode } = location
    return { id, name, inclusion, control, entityId, start, endExclusive, startMode, endMode,
      entity: entity ? { id: entity.id, inclusion: entity.inclusion, control: entity.control, ownershipPercent: entity.ownershipPercent } : null }
  }).sort((a: any, b: any) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  return { companyId: row.companyId, setupVersionId: row.setupVersionId, setupRevision: row.revision, locations, sameContentSetupVersionIds: row.sameContentSetupVersionIds ?? [row.setupVersionId],
    boundaryApproach: setup.boundary?.approach, reportingPeriod: { start: setup.reportingPeriod?.start ?? null, endExclusive: setup.reportingPeriod?.endExclusive ?? null } } as CollectionContext
}
// Each record's state in the newest frozen version: counted in full (calculated, complete, with a total), and the line's kg.
const frozen = new Map<string, { counted: boolean; kg: string | null; outcome: string }>()
const frozenCompanies = new Set<string>()
if (versionsFile) for (const v of jsonl(versionsFile)) {
  frozenCompanies.add(v.companyId)
  for (const r of v.basis?.results?.records ?? []) if (r.derivedFrom === null) frozen.set(`${v.companyId}\u0000${r.recordId}`,
    { counted: r.outcome === 'calculated' && r.result?.status === 'complete' && !!r.result?.total, kg: r.outcome === 'calculated' ? r.result?.total?.display ?? null : null, outcome: r.outcome })
}
const setups = new Map(jsonl(setupsFile).map((row: any) => [row.companyId, row]))
const records = jsonl(recordsFile)
let skipped = 0, noSetup = 0
const newly: string[][] = [], heldToExcluded: string[][] = [], mixedOther: string[][] = []
for (const company of [...new Set(records.map((row: any) => row.companyId as string))].sort()) {
  const setupRow = setups.get(company)
  if (!setupRow) { noSetup++; continue }
  const context = contextOf(setupRow)
  const versions: Scope3CollectionVersion[] = []
  for (const row of records.filter((item: any) => item.companyId === company)) {
    try { versions.push({ id: row.versionId, recordId: row.recordId, companyId: company, revision: row.revision, activity: validateCollectionActivity(row.activity) } as unknown as Scope3CollectionVersion) } catch { skipped++ }
  }
  const period = context.reportingPeriod?.start && context.reportingPeriod.endExclusive ? { start: context.reportingPeriod.start, endExclusive: context.reportingPeriod.endExclusive } : null
  const byId = new Map(versions.map(v => [v.recordId, v]))
  for (const [lineId, pairs] of planScope3SupersessionMatches(versions, context, { reportingPeriod: period, sha256 })) {
    const line = byId.get(lineId)!.activity as any
    const state = (id: string) => frozenCompanies.has(company) ? (frozen.get(`${company}\u0000${id}`)?.counted ? 'counted' : 'not counted') : 'unknown'
    const today = [...pairs].filter(([, p]) => p.match !== 'vendor_key'), loose = [...pairs].filter(([, p]) => p.match === 'vendor_key')
    if (loose.length === 0) continue
    const describe = (list: typeof today) => list.map(([id, p]) => `${id} (${p.match}, names "${p.named}", ${state(id)})`).join('; ')
    const kg = frozen.get(`${company}\u0000${lineId}`)?.kg ?? ''
    const cells = [company, lineId, line.sourceId, String(line.payload.category), line.payload.supplierName, describe(loose), describe(today), kg]
    if (today.length === 0) newly.push(cells)
    else if (today.every(([id]) => state(id) === 'not counted') && loose.some(([id]) => state(id) === 'counted')) heldToExcluded.push(cells)
    else mixedOther.push(cells)
  }
}
console.log('BF-12 supplier-name check. Limits of this report:')
console.log('- "counted" means calculated in full in the company\'s newest frozen Scope 3 version; the live run decides at calculation time,')
console.log('  so a record changed since that version may be counted differently. Without a frozen version the state is "unknown".')
console.log('- kg is the line\'s total in the newest frozen version (empty when it was not calculated there, or there is none).')
console.log('- Possible-duplicate holds and the results run\'s line cap are not applied here.')
console.log(`- Records whose stored activity did not decode: ${skipped}. Companies with spend or supplier records but no company setup: ${noSetup}.`)
const table = (title: string, rows: string[][]) => {
  console.log(`\n${title}: ${rows.length} line(s) in ${new Set(rows.map(row => row[0])).size} compan${new Set(rows.map(row => row[0])).size === 1 ? 'y' : 'ies'}`)
  if (rows.length === 0) return
  const perCompany = new Map<string, { lines: number; kg: number }>()
  for (const row of rows) { const c = perCompany.get(row[0]!) ?? { lines: 0, kg: 0 }; c.lines++; c.kg += row[7] ? Number(row[7]) : 0; perCompany.set(row[0]!, c) }
  for (const [company, c] of perCompany) console.log(`  ${company}\t${c.lines} line(s)\t${c.kg.toFixed(4)} kg counted in the newest frozen version`)
  console.log(['companyId', 'spendRecordId', 'sourceId', 'category', 'supplier on the line', 'records matching only by the vendor key', 'records matching today (exact or mapping key)', 'kg (frozen)'].join('\t'))
  for (const row of rows) console.log(row.join('\t'))
}
table('A. Lines no record replaces today that BF-12 replaces (excluded) or holds (replacing record not counted)', newly)
table('B. Lines held today (every exact or mapping-key claimant not counted) that BF-12 excludes through a counted vendor-key claimant', heldToExcluded)
table('C. Other lines with a vendor-key claimant beside an exact or mapping-key one (outcome unchanged; the note may now name the vendor-key record)', mixedOther)

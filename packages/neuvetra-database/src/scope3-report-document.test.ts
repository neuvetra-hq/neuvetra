// Frozen Scope 3 report versions: the report document (Scope 3 completion I-10; Claude, 30 October 2026; DESIGN 3.7, 7.4,
// A16, A31; assurance-ux M8). Pure: the report text is the canonical JSON of the results response plus the assertion, the
// base-year statement and the change log against the previous approved version; the CSV is the shared CSV v2 with the
// frozen lines first. Nothing here calculates: every figure is a string the engine-backed results route produced.
import { describe, expect, test } from 'bun:test'
import { scope3Csv } from './scope3-report-csv'
import { SCOPE3_BASE_YEAR_TEXT } from './scope3-text'
import type { Scope3ResultsDocument } from './scope3-trace'
import {
  buildScope3ReportDocument, scope3ReportChangeLog, scope3ReportCsv, scope3ReportText, SCOPE3_REPORT_CRITERIA, SCOPE3_REPORT_PROFILE, validateScope3ReportDocument,
  type Scope3ReportDocument, type Scope3ReportVersionSummary,
} from './scope3-report-document'

const fixture: Scope3ResultsDocument = await Bun.file(new URL('../../../apps/site-web/src/lib/scope3-results.fixture.json', import.meta.url)).json()
const company = fixture.companyId
const preparer = '93100000-0000-4000-8000-0000000000a1', approver = '93100000-0000-4000-8000-0000000000a2'
const labels = { kind: (kind: string) => `kind ${kind}`, reason: (code: string) => `reason ${code}`, period: (start: string | null | undefined, end: string | null | undefined) => `${start} to ${end}` }
const unquote = (line: string) => line.startsWith('"') && line.endsWith('"') ? line.slice(1, -1).replace(/""/g, '"') : line
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const meta = (revision: number, extra: Partial<Parameters<typeof buildScope3ReportDocument>[0]> = {}) => ({
  results: fixture, reportingYear: 2025, revision, setupVersionId: '93100000-0000-4000-8000-0000000000c1', consolidationApproach: 'operational_control' as const,
  preparedBy: preparer, preparedAt: '2026-10-30T10:00:00.000Z', previous: null, ...extra,
})
const summary = (document: Scope3ReportDocument, id: string): Scope3ReportVersionSummary => ({
  id, companyId: company, reportingYear: 2025, revision: document.revision, previousId: null, setupVersionId: document.inputs.setupVersionId, reason: null,
  reportSha256: 'a'.repeat(64), csvSha256: 'b'.repeat(64), engineSha256: 'c'.repeat(64), registerSha256s: document.results.registerSha256s, inputVersionCount: document.inputs.recordVersionIds.length,
  createdBy: preparer, createdAt: '2026-10-30T10:00:01.000Z', openIssues: document.results.readiness?.openIssues ?? [],
  approval: { approvedBy: approver, approvedAt: '2026-10-30T11:00:00.000Z', selfApproved: false, reportSha256: 'a'.repeat(64), acknowledgedOpenIssues: document.results.readiness?.openIssues.length ? document.results.readiness.openIssues : null, selfApprovalConfirmed: false },
})

describe('the frozen report document (I-10)', () => {
  test('a first version: the results, an assertion with the engine’s own totals, the base-year statement and a "first version" change log', () => {
    const document = buildScope3ReportDocument(meta(1))
    expect(document.profile).toBe(SCOPE3_REPORT_PROFILE)
    expect([document.companyId, document.reportingYear, document.revision]).toEqual([company, 2025, 1])
    expect(document.results).toEqual(fixture)
    expect(document.baseYear).toEqual({ established: false, statement: SCOPE3_BASE_YEAR_TEXT })
    const a = document.assertion
    expect(a.criteria).toBe(SCOPE3_REPORT_CRITERIA)
    expect([a.companyId, a.legalName, a.consolidationApproach, a.reportingYear, a.preparedBy, a.preparedAt]).toEqual([company, 'Synthetic Scope 3 Co', 'operational_control', 2025, preparer, '2026-10-30T10:00:00.000Z'])
    expect(a.reportingPeriod).toEqual({ start: '2025-01-01', endExclusive: '2026-01-01' })
    // Every category's figure is the engine's display string; tonnes by scale only; no figure is never a zero.
    expect(a.totals).toHaveLength(15)
    expect(a.totals.find(row => row.category === 2)).toEqual({ category: 2, title: fixture.coverage.categories[1]!.title, status: 'calculated', subtotalKg: '15901.5596', subtotalTonnes: '15.9015596', subtotalBasis: 'all_counted_records' })
    expect(a.totals.find(row => row.category === 9)).toMatchObject({ status: 'input_needed', subtotalKg: null, subtotalTonnes: null })
    expect(a.knownSourceSubtotal).toEqual({ kg: '38715.3740', tonnes: '38.7153740' })  // round 2: oil-mapped 3B/3C upstream lines; lane F: + their coal mine methane term
    expect(a.totalLabel).toBe('known sources only')
    // Inputs: every line's record version, once, sorted; the setup version.
    expect(document.inputs.recordVersionIds).toEqual([...new Set(fixture.records.map(row => row.versionId))].sort())
    expect(document.changeLog).toMatchObject({ basis: 'first_version', previous: null, methods: { added: [], removed: [] }, mappings: [], records: { added: [], removed: [], edited: [] } })
    expect(document.changeLog.categories).toEqual([])
    // The text is canonical JSON: keys sorted at every level, the same bytes for the same document.
    const text = scope3ReportText(document)
    expect(text).toBe(scope3ReportText(JSON.parse(text)))
    expect(text.startsWith('{"assertion":{')).toBe(true)
    expect(validateScope3ReportDocument(JSON.parse(text), company)).toEqual(JSON.parse(text))
  })

  test('the change log against the previous approved version lists a mapping change and a method change with before/after subtotals', () => {
    const first = buildScope3ReportDocument(meta(1))
    const previous = { summary: summary(first, '93100000-0000-4000-8000-0000000000f1'), document: JSON.parse(scope3ReportText(first)) as Scope3ReportDocument }
    const next = clone(fixture)
    const spend = next.records.find(row => row.kind === 'purchase_spend')!, supplier = next.records.find(row => row.kind === 'purchase_supplier')!
    // A mapping change (NAICS corrected on the spend line: a new record version) and a method change (the supplier record
    // re-entered as a company-typed secondary factor), with the engine's new category 2 subtotal.
    const spendBefore = { ...spend }
    spend.versionId = '93100000-0000-4000-8000-0000000000e1'; spend.revision = 2
    spend.payload = { ...(spend.payload as Record<string, unknown>), naicsCode: '325212' }
    spend.result = { ...spend.result!, total: { ...spend.result!.total!, display: '12000.0000' } }
    supplier.versionId = '93100000-0000-4000-8000-0000000000e2'; supplier.revision = 2
    supplier.result = { ...supplier.result!, methodVersionId: 'scope3.cat1_2.average_data_user_factor.v1' }
    next.methods = next.methods.map(item => item.methodVersionId === 'scope3.cat1_2.supplier_specific.v1' ? { ...item, methodVersionId: 'scope3.cat1_2.average_data_user_factor.v1' } : item)
    const category2 = next.coverage.categories.find(row => row.category === 2)!
    category2.subtotal = { ...category2.subtotal!, display: '15625.0000' }
    next.coverage.knownSourceSubtotal = { ...next.coverage.knownSourceSubtotal!, display: '38438.8144' }  // round 2 (lane F): 38715.3740 - (15901.5596 - 15625.0000)
    // One record removed (a held waste line) and one added (a copy of the commuting line under a new id).
    const removed = next.records.findIndex(row => row.kind === 'waste' && row.outcome === 'held')
    const removedRow = next.records.splice(removed, 1)[0]!
    next.records.push({ ...clone(next.records.find(row => row.kind === 'employee_commuting')!), recordId: '93100000-0000-4000-8000-0000000000d1', versionId: '93100000-0000-4000-8000-0000000000d2' })

    const log = scope3ReportChangeLog(previous, next)
    expect(log.basis).toBe('previous_approved_version')
    expect(log.previous).toEqual({ versionId: '93100000-0000-4000-8000-0000000000f1', revision: 1, reportSha256: 'a'.repeat(64), approvedBy: approver, approvedAt: '2026-10-30T11:00:00.000Z' })
    expect(log.methods).toEqual({ added: ['scope3.cat1_2.average_data_user_factor.v1'], removed: ['scope3.cat1_2.supplier_specific.v1'] })
    expect(log.mappings).toEqual([{ recordId: spend.recordId, before: { category: 2, naicsCode: '325211', marginChoice: 'with_margins', mappingSource: (spendBefore.payload as any).mappingSource ?? null }, after: { category: 2, naicsCode: '325212', marginChoice: 'with_margins', mappingSource: (spendBefore.payload as any).mappingSource ?? null } }])
    expect(log.records.edited).toEqual(expect.arrayContaining([
      { recordId: spend.recordId, kind: 'purchase_spend', category: 2, revisionBefore: 1, revisionAfter: 2, versionBefore: spendBefore.versionId, versionAfter: spend.versionId, methodBefore: 'scope3.spend.epa_scghg_v1_3.v1', methodAfter: 'scope3.spend.epa_scghg_v1_3.v1', totalBefore: '12276.5596', totalAfter: '12000.0000' },
      expect.objectContaining({ recordId: supplier.recordId, kind: 'purchase_supplier', methodBefore: 'scope3.cat1_2.supplier_specific.v1', methodAfter: 'scope3.cat1_2.average_data_user_factor.v1', totalBefore: '3625.0000', totalAfter: '3625.0000' }),
    ]))
    expect(log.records.edited).toHaveLength(2)
    expect(log.records.removed).toEqual([{ recordId: removedRow.recordId, kind: 'waste', category: 5, versionId: removedRow.versionId }])
    expect(log.records.added).toEqual([{ recordId: '93100000-0000-4000-8000-0000000000d1', kind: 'employee_commuting', category: 7, versionId: '93100000-0000-4000-8000-0000000000d2' }])
    // Before/after per changed category (engine strings, no arithmetic) and the known-source subtotal.
    expect(log.categories).toEqual([{ category: 2, title: category2.title, statusBefore: 'calculated', statusAfter: 'calculated', subtotalBefore: '15901.5596', subtotalAfter: '15625.0000' }])
    expect(log.knownSourceSubtotal).toEqual({ before: '38715.3740', after: '38438.8144' })
    expect(log.engine).toBeNull()
    expect(log.registers).toEqual([])

    // The CSV is the shared CSV v2 byte for byte, after the frozen lines (assertion, base year, change log).
    const document = buildScope3ReportDocument(meta(2, { results: next, previous }))
    expect(document.changeLog).toEqual(log)
    const csv = scope3ReportCsv(document, labels)
    expect(csv.endsWith(scope3Csv(next, labels))).toBe(true)
    const frozen = csv.slice(0, csv.length - scope3Csv(next, labels).length).split('\n').filter(Boolean).map(unquote)
    // Each frozen line is one CSV cell, escaped as the shared CSV escapes its own `#` lines (quoted when it has a comma).
    expect(frozen[0]).toBe('# Frozen Scope 3 report version: reporting year 2025, revision 2. These bytes were fixed when the version was prepared; later record changes never alter them.')
    expect(frozen).toContain(`# Base year: ${SCOPE3_BASE_YEAR_TEXT}`)
    expect(frozen).toContain('# Change log: compared with revision 1 (version 93100000-0000-4000-8000-0000000000f1, report sha256 ' + 'a'.repeat(64) + '), approved 2026-10-30T11:00:00.000Z.')
    expect(frozen).toContain('# Change log, methods added: scope3.cat1_2.average_data_user_factor.v1')
    expect(frozen).toContain('# Change log, methods removed: scope3.cat1_2.supplier_specific.v1')
    expect(frozen).toContain(`# Change log, mapping of record ${spend.recordId}: category 2 NAICS 325211 with_margins (user) → category 2 NAICS 325212 with_margins (user)`)
    expect(frozen).toContain('# Change log, category 2: Calculated 15901.5596 kg CO2e → Calculated 15625.0000 kg CO2e')
    expect(frozen).toContain('# Change log, known-source subtotal: 38715.3740 kg CO2e → 38438.8144 kg CO2e')
    expect(frozen.some(line => line.startsWith('# Assertion total, category 2 ') && line.includes('15901') === false && line.includes('15625.0000 kg CO2e (15.6250000 t CO2e)'))).toBe(true)
    // The first version's CSV says so.
    expect(scope3ReportCsv(first, labels)).toContain('# Change log: first version (no earlier approved version for reporting year 2025).')
  })

  test('integration wave 5: the stored CSV is rebuilt byte for byte from the stored report text, whatever the key order of the live results', () => {
    // The route lists its registers main first, then the additional ones in its own order (since I-12h `building_hotel` sorts
    // before `main`); the stored report text is canonical JSON (keys sorted). The CSV must not depend on that order, so
    // anyone holding the stored text re-derives the stored CSV, and the live CSV of the same results has the same bytes.
    const live = clone(fixture)
    const names = Object.keys(fixture.registerSha256s)
    expect(names.length).toBeGreaterThan(2)
    live.registerSha256s = Object.fromEntries([['main', fixture.registerSha256s.main!], ...[...names].filter(name => name !== 'main').reverse().map(name => [name, fixture.registerSha256s[name]!])])
    expect(Object.keys(live.registerSha256s)).not.toEqual([...Object.keys(live.registerSha256s)].sort())
    const document = buildScope3ReportDocument(meta(1, { results: live }))
    const stored = JSON.parse(scope3ReportText(document)) as Scope3ReportDocument
    expect(scope3ReportCsv(stored, labels)).toBe(scope3ReportCsv(document, labels))
    expect(scope3Csv(stored.results, labels)).toBe(scope3Csv(live, labels))
    // The register lines are listed by register name.
    const registerLines = scope3Csv(live, labels).split('\n').filter(line => line.startsWith('# Register '))
    expect(registerLines).toEqual([...names].sort().map(name => `# Register ${name}: sha256 ${fixture.registerSha256s[name]}`))
  })

  test('the decoder refuses anything the builder would not produce', () => {
    const document = JSON.parse(scope3ReportText(buildScope3ReportDocument(meta(1)))) as Record<string, any>
    const refused = (mutate: (d: Record<string, any>) => void, companyId = company) => { const copy = clone(document); mutate(copy); expect(() => validateScope3ReportDocument(copy, companyId)).toThrow() }
    refused(() => {}, '93100000-0000-4000-8000-0000000000ff')
    refused(d => { d.profile = 'neuvetra.scope3-report.v0' })
    refused(d => { d.extra = true })
    refused(d => { d.assertion.totals[1].subtotalKg = '1.0000' })
    refused(d => { d.assertion.knownSourceSubtotal = null })
    refused(d => { d.assertion.criteria = 'Some other standard' })
    refused(d => { d.baseYear.established = true })
    refused(d => { d.results.companyId = '93100000-0000-4000-8000-0000000000ff' })
    refused(d => { d.inputs.recordVersionIds = [] })
    refused(d => { d.changeLog.basis = 'previous_approved_version' })
    refused(d => { d.revision = 0 })
    refused(d => { d.reportingYear = 2024 })
  })
})

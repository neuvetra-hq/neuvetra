// BF-31a (the reader of Scope 3 report profile v4; Claude, 14 November 2026; BF-31 design 3, 5.3 A4/A7, 5.4). A v4
// document is v3 with derived lines' payload copies replaced by one `sourceRecords` entry per source record version. Every
// v4 document here is built by transforming a real v3 document with the writer's own packing rule (`scope3PackSourceRecords`),
// so the writer (BF-31b) and this reader share one definition. The v1-v3 validators are untouched (their bytes are pinned).
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  buildScope3ReportDocument, scope3ReportChangeLogBasis, scope3ReportCsv, scope3ReportFrozenLines, scope3ReportPreviousFromBasis, scope3ReportText,
  validateScope3ReportDocument, SCOPE3_REPORT_PROFILE, SCOPE3_REPORT_PROFILE_V3, SCOPE3_REPORT_PROFILE_V4, type Scope3ReportDocument, type Scope3ReportVersionSummary,
} from './scope3-report-document'
import {
  scope3PackSourceRecords, scope3SourceRecordFacts, scope3SourceRecordsProblem, validateScope3ReportDocumentV4, SCOPE3_SOURCE_RECORD_FACT_KEYS, type Scope3SourceRecordV4,
} from './scope3-report-v4'
import { validateScope3ReportDocumentV3 } from './scope3-report-v3'
import type { Scope3ResultsDocument, Scope3ResultsLine } from './scope3-trace'

const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex')
const file = (name: string) => readFileSync(new URL(name, import.meta.url))
const fixture = (): Scope3ResultsDocument => JSON.parse(readFileSync(new URL('../../../apps/site-web/src/lib/scope3-results.fixture.json', import.meta.url), 'utf8'))
const labels = { kind: (kind: string) => `kind ${kind}`, reason: (code: string) => `reason ${code}`, period: (start: string | null | undefined, end: string | null | undefined) => `${start} to ${end}` }
/** A synthetic stand-in for 0027's `payload_sha256` of a version (the real one is bound natively in BF-31b, A5). */
const activitySha = (versionId: string) => sha256(`synthetic activity ${versionId}`)
const preparer = '93100000-0000-4000-8000-0000000000a1'
const build = (results: Scope3ResultsDocument, revision = 1, previous: Parameters<typeof buildScope3ReportDocument>[0]['previous'] = null) =>
  buildScope3ReportDocument({ results, reportingYear: 2025, revision, setupVersionId: '93100000-0000-4000-8000-0000000000c1', consolidationApproach: 'operational_control', preparedBy: preparer, preparedAt: '2026-11-14T10:00:00.000Z', previous })
/** The v4 document of the same content as a v3 document: the writer's packing rule on its results, profile v4. */
const toV4 = (v3: Scope3ReportDocument) => ({ ...v3, profile: SCOPE3_REPORT_PROFILE_V4, results: scope3PackSourceRecords(v3.results, activitySha) }) as unknown as Scope3ReportDocument
const v4Of = (results = fixture()) => JSON.parse(scope3ReportText(toV4(build(results)))) as { results: { records: Array<Record<string, any>>; sourceRecords: Array<Record<string, any>>; lineBudget: Record<string, any> } } & Record<string, any>
const open = (document: unknown, company = fixture().companyId) => validateScope3ReportDocument(document, company)
const refused = (mutate: (d: ReturnType<typeof v4Of>) => void, reason: RegExp) => {
  const d = v4Of(); mutate(d)
  expect(() => open(d)).toThrow(reason)
}

/** Adds an energy-resold record (held, no result) and its derived 3D upstream line to the fixture results. */
function withEnergyResold(): Scope3ResultsDocument {
  const f = fixture(), base = f.records.find(row => row.derivedFrom === null && row.outcome === 'held')!
  const id = '93000000-0000-4000-8000-0000000010e1', version = '94000000-0000-4000-8000-0000000010e1'
  const own: Scope3ResultsLine = { ...structuredClone(base), recordId: id, versionId: version, kind: 'energy_resold', category: 3, derivedFrom: null, result: null, outcome: 'held',
    plan: { action: 'hold', status: 'input_needed', reasons: ['quantity_missing'], notes: [] }, payload: { gridBasis: 'subregion', zip: '94105', subregion: 'CAMX', utilityEiaId: null, resoldEnergyNotInScope2: true }, methodType: null, effectiveDataQuality: null }
  const upstream: Scope3ResultsLine = { ...structuredClone(own), kind: 'energy_resold_upstream', derivedFrom: { recordId: id, kind: 'energy_resold' }, plan: { action: 'hold', status: 'input_needed', reasons: ['energy_resold_record_held', 'quantity_missing'], notes: [] } }
  delete (own as { supersededSpendMemo?: unknown }).supersededSpendMemo; delete (upstream as { supersededSpendMemo?: unknown }).supersededSpendMemo
  f.records = [...f.records, own, upstream]
  f.lineBudget = { max: f.lineBudget!.max, used: f.records.length, remaining: f.lineBudget!.max - f.records.length }
  return f
}

describe('BF-31a: Scope 3 report profile v4 (reader only)', () => {
  test('the writer is unchanged: new versions are still v3; the v1-v3 validators are byte-identical to main', () => {
    expect(SCOPE3_REPORT_PROFILE).toBe(SCOPE3_REPORT_PROFILE_V3)
    expect(build(fixture()).profile).toBe(SCOPE3_REPORT_PROFILE_V3)
    expect(sha256(file('./scope3-report-v1.ts'))).toBe('b3a13e0c0b4c2bd56b88844791a4cabc512594036a3fc1cdf01ed5cdd625e5cb')
    expect(sha256(file('./scope3-report-v2.ts'))).toBe('111355e60c9552207ddbac95b2bb1f26c0cfcc3678c801c41598716def56be46')
    expect(sha256(file('./scope3-report-v3.ts'))).toBe(FROZEN_V3)
    // v4 is frozen from BF-31b on (the first v4 document); the writer must reuse it as is.
    expect(sha256(file('./scope3-report-v4.ts'))).toBe(FROZEN_V4)
  })

  test('the packing rule: derived lines lose their payload copy; each source version is listed once, sorted, with only its kind’s facts', () => {
    const f = fixture(), packed = scope3PackSourceRecords(f, activitySha)
    expect(packed.records.filter(row => row.derivedFrom !== null).every(row => row.payload === null)).toBe(true)
    expect(packed.records.filter(row => row.derivedFrom === null).map(row => row.payload)).toEqual(f.records.filter(row => row.derivedFrom === null).map(row => row.payload))
    // Everything but the derived payloads is unchanged (figures, results, order).
    const strip = (r: Scope3ResultsDocument) => ({ ...r, sourceRecords: undefined, records: r.records.map(row => ({ ...row, payload: row.derivedFrom ? null : row.payload })) })
    expect(JSON.stringify(strip(packed))).toBe(JSON.stringify(strip(f)))
    expect(packed.sourceRecords.map(e => [e.versionId, e.kind])).toEqual([
      ['94000000-0000-4000-8000-000000001001', 'electricity'], ['94000000-0000-4000-8000-000000001008', 'electricity'], ['94000000-0000-4000-8000-000000001009', 'natural_gas']])
    const electricity = f.records.find(row => row.kind === 'td_losses')!.payload as Record<string, unknown>
    expect(Object.keys(packed.sourceRecords[0]!).sort()).toEqual(['activitySha256', 'facts', 'kind', 'recordId', 'versionId'])
    expect(packed.sourceRecords[0]!.facts).toEqual(Object.fromEntries(SCOPE3_SOURCE_RECORD_FACT_KEYS.electricity.map(key => [key, electricity[key]])))
    expect(JSON.stringify(packed.sourceRecords)).not.toContain('instruments')
    // A missing allow-list key is written as null, never omitted; a key outside the list never appears.
    expect(scope3SourceRecordFacts('vehicle', { fuel: 'Diesel', instruments: [1] })).toEqual({ vehicleGroupId: null, fuel: 'Diesel', vehicleType: null, modelYear: null, gallons: null, vehicleCount: null, miles: null, fuelEconomy: null })
    expect(scope3SourceRecordFacts('energy_resold', { zip: '94105' })).toBeNull()
    expect(() => scope3SourceRecordFacts('hotel_stay', {})).toThrow()
    // Packing happens once: packed results cannot be packed again. A document with no derived lines gets an empty list.
    expect(() => scope3PackSourceRecords(packed, activitySha)).toThrow(/no source payload/)
    expect(scope3PackSourceRecords({ records: f.records.filter(row => row.derivedFrom === null) }, activitySha).sourceRecords).toEqual([])
  })

  test('A7: a v4 document built from a real v3 one opens with its own validator; the dispatcher reads it', () => {
    const d = v4Of()
    expect(open(d).profile).toBe(SCOPE3_REPORT_PROFILE_V4)
    expect(validateScope3ReportDocumentV4(d, fixture().companyId).results.sourceRecords).toHaveLength(3)
    // It is not v3, and v3's rules refuse it by profile (so no image reads a v4 document as v3).
    expect(() => validateScope3ReportDocumentV3(d, fixture().companyId)).toThrow(/document \(v3\)/)
    // An energy-resold source: null facts, its own full line in the same results.
    const resold = JSON.parse(scope3ReportText(toV4(build(withEnergyResold()))))
    const entry = resold.results.sourceRecords.find((e: Scope3SourceRecordV4) => e.kind === 'energy_resold')
    expect(entry).toMatchObject({ recordId: '93000000-0000-4000-8000-0000000010e1', facts: null })
    expect(open(resold).profile).toBe(SCOPE3_REPORT_PROFILE_V4)
  })

  test('5.4: each tampered v4 document is refused with its reason', () => {
    const gas = '94000000-0000-4000-8000-000000001009', elec = '94000000-0000-4000-8000-000000001001'
    refused(d => { d.results.sourceRecords = d.results.sourceRecords.filter(e => e.versionId !== gas) }, /fuel_upstream has no source record entry \(v4\)/)
    refused(d => { d.results.sourceRecords.splice(1, 0, structuredClone(d.results.sourceRecords[0])) }, /listed twice/)
    // Pointing at another version (the gas entry relabelled as the electricity version's twin): the gas line loses its entry.
    refused(d => { const e = d.results.sourceRecords.find(x => x.versionId === gas)!; e.versionId = elec; d.results.sourceRecords.sort((a, b) => a.versionId < b.versionId ? -1 : 1) }, /listed twice/)
    refused(d => { d.results.sourceRecords.find(x => x.versionId === gas)!.kind = 'distillate_no2'; d.results.sourceRecords.find(x => x.versionId === gas)!.facts = { consumption: { basis: 'measured', gallons: '1' }, statedHhvMmbtuPerGallon: null } }, /of another kind/)
    refused(d => { d.results.sourceRecords.find(x => x.versionId === gas)!.recordId = '93000000-0000-4000-8000-000000001001' }, /names another record/)
    refused(d => { d.results.sourceRecords[0]!.facts.instruments = [] }, /exactly the electricity keys/)
    refused(d => { delete d.results.sourceRecords[0]!.facts.site }, /exactly the electricity keys/)
    refused(d => { d.results.sourceRecords[0]!.facts.zip = 94105 }, /facts of a electricity source are malformed/)
    refused(d => { d.results.records.find(row => row.versionId === gas && row.derivedFrom)!.payload = { heatContent: null } }, /carries a payload/)
    refused(d => { d.results.records.find(row => row.kind === 'td_losses')!.payload = {} }, /carries a payload/)
    // Orphan: an entry no derived line uses (a Scope 3 record's own version).
    refused(d => { const own = d.results.records.find(row => row.derivedFrom === null)!; d.results.sourceRecords.push({ recordId: own.recordId, versionId: own.versionId, kind: 'electricity', activitySha256: 'a'.repeat(64), facts: d.results.sourceRecords[0]!.facts }); d.results.sourceRecords.sort((a, b) => a.versionId < b.versionId ? -1 : 1) }, /not used by any derived line/)
    refused(d => { d.results.sourceRecords.reverse() }, /not sorted by version/)
    refused(d => { d.results.sourceRecords[0]!.activitySha256 = 'A'.repeat(64) }, /invalid activity SHA-256/)
    refused(d => { d.results.sourceRecords[0]!.note = 'x' }, /wrong keys/)
    refused(d => { delete (d.results as Record<string, unknown>).sourceRecords }, /sourceRecords must be a list/)
    // Every entry's version is one of the document's inputs (checked on its own, after the lines).
    const d = v4Of(); d.inputs.recordVersionIds = d.inputs.recordVersionIds.filter((id: string) => id !== gas)
    expect(() => open(d)).toThrow(/\(v1\)|not one of the document's inputs/)
    expect(scope3SourceRecordsProblem([], [{ ...v4Of().results.sourceRecords[0] }])).toMatch(/not used by any derived line/)
    // An energy-resold source with facts, or without its own line, is refused.
    const resold = () => JSON.parse(scope3ReportText(toV4(build(withEnergyResold()))))
    const withFacts = resold(); withFacts.results.sourceRecords.find((e: Scope3SourceRecordV4) => e.kind === 'energy_resold').facts = { zip: '94105' }
    expect(() => open(withFacts)).toThrow(/energy-resold source has no facts/)
    const noOwnLine = resold().results
    noOwnLine.records = noOwnLine.records.filter((row: Scope3ResultsLine) => row.kind !== 'energy_resold')
    expect(scope3SourceRecordsProblem(noOwnLine.records, noOwnLine.sourceRecords)).toMatch(/has no full line of its own/)
    // A v3 document's checks still run under v4 (a v4 document is v3 plus the source records).
    refused(d => { d.results.lineBudget.used = 1 }, /line budget \(v3\)/)
  })

  test('A3: a v4 version against an approved v3 previous version (and back) shows no false differences; CSV and change-log basis identical but for the profile', () => {
    const results = fixture(), v3 = build(results)
    const v3Text = scope3ReportText(v3)
    const summary = { id: '93100000-0000-4000-8000-0000000000f1', companyId: results.companyId, reportingYear: 2025, revision: 1, previousId: null, setupVersionId: v3.inputs.setupVersionId, reason: null,
      reportSha256: sha256(v3Text), csvSha256: 'c'.repeat(64), engineSha256: results.methods[0]!.engineSha256, registerSha256s: results.registerSha256s, inputVersionCount: v3.inputs.recordVersionIds.length,
      createdBy: preparer, createdAt: '2026-11-14T10:00:01.000Z', openIssues: v3.results.readiness!.openIssues,
      approval: { approvedBy: '93100000-0000-4000-8000-0000000000a2', approvedAt: '2026-11-14T11:00:00.000Z', selfApproved: false, reportSha256: sha256(v3Text), acknowledgedOpenIssues: v3.results.readiness!.openIssues, selfApprovalConfirmed: false } } as Scope3ReportVersionSummary
    // Previous v3 read as the API reads it: from its stored change-log basis, and from its full document.
    for (const previous of [scope3ReportPreviousFromBasis(summary, scope3ReportChangeLogBasis(v3)), { summary, document: open(JSON.parse(v3Text)) }]) {
      const next = toV4(build(fixture(), 2, previous))
      // BF-31b's path: the change log computed from the packed results themselves.
      const packed = scope3PackSourceRecords(fixture(), activitySha)
      const fromPacked = { ...build(packed as Scope3ResultsDocument, 2, previous), profile: SCOPE3_REPORT_PROFILE_V4 } as unknown as Scope3ReportDocument
      for (const doc of [next, fromPacked]) {
        expect(doc.changeLog.records).toEqual({ added: [], removed: [], edited: [] })
        expect(doc.changeLog.mappings).toEqual([])
        expect(scope3ReportFrozenLines(doc, labels)).toContain('# Change log: no differences.')
        expect(open(JSON.parse(scope3ReportText(doc))).profile).toBe(SCOPE3_REPORT_PROFILE_V4)
      }
    }
    // And a later (v3-shaped) version against an approved v4 previous: no differences either.
    const v4 = toV4(v3), v4Text = scope3ReportText(v4)
    const v4Summary = { ...summary, reportSha256: sha256(v4Text), approval: { ...summary.approval!, reportSha256: sha256(v4Text) } }
    const back = build(fixture(), 2, scope3ReportPreviousFromBasis(v4Summary, scope3ReportChangeLogBasis(v4)))
    expect(back.changeLog.records).toEqual({ added: [], removed: [], edited: [] })
    expect(scope3ReportFrozenLines(back, labels)).toContain('# Change log: no differences.')
    // The stored CSV of the same content is byte-identical (the CSV never reads a derived line's payload).
    expect(scope3ReportCsv(v4, labels)).toBe(scope3ReportCsv(v3, labels))
    // The change-log basis differs only in the profile string.
    expect(scope3ReportChangeLogBasis(v4).replace(SCOPE3_REPORT_PROFILE_V4, SCOPE3_REPORT_PROFILE_V3)).toBe(scope3ReportChangeLogBasis(v3))
    // Certificates are gone from the v4 text; the v3 text of the same content still has them.
    expect(v3Text).toContain('"instruments"')
    expect(v4Text).not.toContain('"instruments"')
  })
})

/** Pins: v3 never changes; v4 is frozen with the first v4 document (BF-31b must not edit it). */
const FROZEN_V3 = '576a78551ecdb20dbdaeadc2ef1281cc7566205a95500e19f6b0ba847c1b5aa8'
const FROZEN_V4 = 'fc3fef7712329cdf59f280e383b276c0c86e8c2d298611876377f588f51cf023'

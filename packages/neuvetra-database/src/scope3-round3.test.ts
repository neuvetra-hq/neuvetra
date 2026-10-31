// Round 3, lane B (Claude, 31 October 2026): unit tests for the memory and line-budget changes.
// - Owner decision 6: the report text is written without the JSON round trip, byte for byte as before; the change log reads
//   only a slim basis of the previous approved document and gives the same log as from the full document.
// - EN-1: the spend import read-backs are single-table statements (no join for the planner to make quadratic).
// - Owner decision 7: 0030 counts lines as scope3ResultLines does, and enforces the cap in the import and in record saves.
import { describe, expect, test } from 'bun:test'
import { readMigrationManifest } from './staging-migrations'
import { scope3CanonicalJson, scope3CanonicalJsonText, type Scope3ResultsDocument } from './scope3-trace'
import { buildScope3ReportDocument, scope3ReportChangeLog, scope3ReportChangeLogBasis, scope3ReportPreviousBasis, scope3ReportPreviousFromBasis, scope3ReportText, type Scope3ReportPrevious } from './scope3-report-document'
import { SCOPE3_SPEND_IMPORT_READBACK_SQL } from './scope3-spend-imports'
import { scope3ImportRetryable } from './workspace'

const fixture: Scope3ResultsDocument = await Bun.file(new URL('../../../apps/site-web/src/lib/scope3-results.fixture.json', import.meta.url)).json()
const roundTrip = (value: unknown) => scope3CanonicalJson(JSON.parse(JSON.stringify(value)))

describe('round 3 (owner decision 6): the report text without the JSON round trip', () => {
  test('equals the round-trip canonical JSON for the results fixture, a report document, and every JSON.stringify edge', () => {
    expect(scope3CanonicalJsonText(fixture)).toBe(roundTrip(fixture))
    const document = buildScope3ReportDocument({ results: { ...fixture, records: fixture.records }, reportingYear: 2025, revision: 1, setupVersionId: '31050000-0000-4000-8000-000000000001', consolidationApproach: 'operational_control',
      preparedBy: '31010000-0000-4000-8000-000000000001', preparedAt: '2026-10-31T10:00:00.000Z', previous: null })
    expect(scope3ReportText(document)).toBe(roundTrip(document))
    // undefined, functions and symbols are left out of objects and are null in arrays (holes too); toJSON is used; -0, NaN,
    // Infinity, nested arrays, unicode and keys that need escaping, at every depth (inside and beyond the piecewise levels).
    const sparse: unknown[] = [1, , 3] // eslint-disable-line no-sparse-arrays
    const edge = { b: undefined, a: [undefined, () => 1, Symbol('s'), sparse, -0, Number.NaN, Number.POSITIVE_INFINITY], 'k "\\': 'é — ’', d: new Date('2026-10-31T00:00:00Z'), n: null,
      deep: { x: { y: { z: [{ q: undefined, r: [undefined, { s: 1 }] }] } } }, f: () => 2, t: { toJSON: (key: string) => `json:${key}` } }
    for (const levels of [0, 1, 2, 3, 6]) {
      expect(scope3CanonicalJsonText(edge, levels)).toBe(roundTrip(edge))
      expect(scope3CanonicalJsonText([edge, undefined, [edge]], levels)).toBe(roundTrip([edge, undefined, [edge]]))
    }
    expect(scope3CanonicalJsonText(undefined)).toBe('null')
    expect(scope3CanonicalJsonText('text')).toBe('"text"')
  })

  test('bounded canonical chunks offer cleanup without changing JSON edge semantics', () => {
    const edge = { z: '雪😀\ud800,"\n', a: [undefined, , -0, Number.NaN, Number.POSITIVE_INFINITY], omitted: undefined,
      nested: { toJSON: (key: string) => ({ key, value: '\udc00' }) } }
    const large = Array.from({ length: 600 }, () => edge)
    for (const levels of [1, 2, 3, 6]) {
      let checkpoints = 0
      expect(scope3CanonicalJsonText(large, levels, () => { checkpoints++ })).toBe(roundTrip(large))
      expect(checkpoints).toBeGreaterThan(1)
    }
  })

  test('the previous version\'s change-log basis is small and gives the same change log as the full document', () => {
    const summary = { id: '31060000-0000-4000-8000-000000000001', companyId: fixture.companyId, reportingYear: 2025, revision: 1, previousId: null, setupVersionId: '31050000-0000-4000-8000-000000000001', reason: null,
      reportSha256: 'a'.repeat(64), csvSha256: 'b'.repeat(64), engineSha256: fixture.methods[0]!.engineSha256, registerSha256s: fixture.registerSha256s, inputVersionCount: 0, createdBy: '31010000-0000-4000-8000-000000000001',
      createdAt: '2026-10-31T10:00:00.000Z', openIssues: [], approval: { approvedBy: '31010000-0000-4000-8000-000000000002', approvedAt: '2026-10-31T11:00:00.000Z', selfApproved: false, reportSha256: 'a'.repeat(64), acknowledgedOpenIssues: null, selfApprovalConfirmed: false } }
    const full = { summary, document: { profile: 'neuvetra.scope3-report.v2', companyId: fixture.companyId, reportingYear: 2025, revision: 1, results: fixture } } as unknown as Scope3ReportPrevious
    const slim = scope3ReportPreviousBasis(full)
    const changed: Scope3ResultsDocument = JSON.parse(JSON.stringify(fixture))
    changed.records = changed.records.slice(1).map((row, i) => i === 0 && row.result?.total ? { ...row, versionId: '31070000-0000-4000-8000-000000000001', revision: row.revision + 1, result: { ...row.result, total: { ...row.result.total, display: '1.0000' } } } : row)
    expect(scope3ReportChangeLog(slim, changed)).toEqual(scope3ReportChangeLog(full, changed))
    expect(scope3ReportChangeLog(slim, fixture)).toEqual(scope3ReportChangeLog(full, fixture))
    // The stored basis (0030 change_log_basis) gives the same change log too, and must name the summary's version.
    const stored = scope3ReportPreviousFromBasis(summary as never, scope3ReportChangeLogBasis(full.document as never))
    expect(scope3ReportChangeLog(stored, changed)).toEqual(scope3ReportChangeLog(full, changed))
    expect(() => scope3ReportPreviousFromBasis({ ...summary, revision: 2 } as never, scope3ReportChangeLogBasis(full.document as never))).toThrow('change-log basis')
    // The lines (what grows with the line cap) shrink to a fraction; coverage (15 categories) is kept whole.
    expect(JSON.stringify((slim.document.results as unknown as Scope3ResultsDocument).records).length).toBeLessThan(JSON.stringify(fixture.records).length / 3)
  })
})

describe('round 3 (EN-1, owner decision 7): database statements', () => {
  test('the import read-backs are single-table statements; the versions are found by record id', () => {
    for (const sql of Object.values(SCOPE3_SPEND_IMPORT_READBACK_SQL)) expect(sql).not.toMatch(/\bjoin\b/i)
    expect(SCOPE3_SPEND_IMPORT_READBACK_SQL.versions).toContain('record_id=any($2::uuid[]) and revision=1')
    // A lock timeout is retried once like a serialization failure; nothing else is.
    expect(['40001', '55P03', '57014', '22023'].map(code => scope3ImportRetryable(Object.assign(new Error('x'), { code })))).toEqual([true, true, false, false])
  })

  test('0030 enforces the 3,000-line cap in the import and in saves that add a Scope 3 line, counting lines as scope3ResultLines does', async () => {
    const sql = (await readMigrationManifest()).find(item => item.name === '0030_scope3_completion.sql')!.sql
    const routes = await Bun.file(new URL('../../../apps/site-api/src/workspace/scope3-results-routes.ts', import.meta.url)).text()
    expect(routes).toContain('export const MAX_SCOPE3_LINES = 3000')
    expect(sql.match(/neuvetra\.scope3_active_line_count\(target_company\)>3000 then raise exception 'Scope 3 line budget exceeded' using errcode='54N30'/g)?.length).toBe(2)
    // The count: one line per active Scope 3 record; with category 3 included, 3 per electricity record, 1 per fuel or vehicle
    // record and one more per resold-energy record (scope3ResultLines and SCOPE3_UPSTREAM_SOURCES).
    expect(sql).toContain("case when r.scope=3 then 1+case when r.kind='energy_resold' and c.yes then 1 else 0 end")
    expect(sql).toContain("when c.yes and r.kind='electricity' then 3 when c.yes and r.kind in('natural_gas','distillate_no2','vehicle') then 1 else 0 end")
    expect(routes).toContain('electricity.flatMap(record => [1, 2, 3]')
    // The import checks once at the end, so save_collection_activity skips its own lines (transaction-local setting).
    expect(sql).toContain("perform set_config('neuvetra.scope3_import_id',request->>'importId',true);")
    expect(sql).toContain("a#>>'{payload,importId}' is distinct from current_setting('neuvetra.scope3_import_id',true)")
  })
})

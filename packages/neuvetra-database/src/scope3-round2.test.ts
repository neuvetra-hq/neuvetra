// Round 2, lane B (Claude, 31 October 2026): the shared rules of owner decisions 5-10, ENG-10 and ACC-11 that are pure
// functions: the import retry's SQLSTATE, the capped data-quality label, the readiness gate, evidence support, setup
// descriptions, and the exclusion register and total for a screening conflict.
import { describe, expect, test } from 'bun:test'
import { scope3AssessmentDisclosures, scope3CappedDataQualityLabel, scope3ScreeningFromSetup, SCOPE3_SETUP_CATEGORY_TOKENS } from './scope3-coverage'
import { scope3ExclusionRegister, scope3TotalStatement } from './scope3-methodology'
import { scope3LineEvidenceLinked, scope3Readiness } from './scope3-trace'
import { scope3ImportRetryable } from './workspace'

describe('round 2 shared rules', () => {
  test('ENG-10: an import is retried on SQLSTATE 40001 only, never on message text', () => {
    expect(scope3ImportRetryable(Object.assign(new Error('anything at all'), { code: '40001' }))).toBe(true)
    expect(scope3ImportRetryable(Object.assign(new Error('Scope 3 import row 1 has the wrong possible duplicate'), { code: '22023' }))).toBe(false)
    expect(scope3ImportRetryable(new Error('Scope 3 import row 1 has the wrong possible duplicate'))).toBe(false)
    expect(scope3ImportRetryable(null)).toBe(false)
  })

  test('decision 9: the label shown is never better than fair while activity is not quantified, and says why', () => {
    expect(scope3CappedDataQualityLabel('very_good', true, false)).toEqual({ label: 'fair', engineLabel: 'very_good', capped: true, reasons: ['lines_not_quantified'] })
    expect(scope3CappedDataQualityLabel('good', false, true)).toEqual({ label: 'fair', engineLabel: 'good', capped: true, reasons: ['partial_boundary_not_documented'] })
    expect(scope3CappedDataQualityLabel('good', true, true).reasons).toEqual(['lines_not_quantified', 'partial_boundary_not_documented'])
    expect(scope3CappedDataQualityLabel('good', false, false)).toEqual({ label: 'good', engineLabel: 'good', capped: false, reasons: [] })
    expect(scope3CappedDataQualityLabel('poor', true, true)).toEqual({ label: 'poor', engineLabel: 'poor', capped: false, reasons: [] })
    expect(scope3CappedDataQualityLabel(null, true, false)).toEqual({ label: null, engineLabel: null, capped: false, reasons: [] })
  })

  test('decision 7: the readiness gate lists input needed, screening conflicts, lines for review and missing assessments of included categories', () => {
    const cat = (category: number, status: string, decision: string, assessment: unknown = null) => ({ category, status, screening: { decision, reason: null, description: null }, assessment }) as never
    const line = (category: number, status: string | null, plan: string | null = null, outcome = 'held') => ({ category, result: status ? { status, boundary: { minimumBoundary: 'met' } } : null, plan: { status: plan }, outcome }) as never
    const r = scope3Readiness([cat(1, 'input_needed', 'included', {}), cat(2, 'screening_conflict', 'excluded'), cat(3, 'calculated', 'included'), cat(4, 'calculated', 'not_screened'), cat(5, 'not_relevant', 'not_relevant')],
      [line(1, 'input_needed'), line(3, 'review_required'), line(4, 'review_required', 'withdrawn'), line(4, 'complete', null, 'calculated')])
    expect(r).toEqual({ ready: false, openIssues: [{ category: 1, code: 'input_needed' }, { category: 2, code: 'screening_conflict' }, { category: 3, code: 'needs_review' }, { category: 3, code: 'assessment_missing' }] })
    // MISSION 4.1 / v3: an included category needs an actual record even when its old status fixture says calculated.
    const included = [cat(1, 'calculated', 'included', {}), cat(2, 'excluded', 'excluded')]
    expect(scope3Readiness(included, [])).toEqual({ ready: false, openIssues: [{ category: 1, code: 'included_category_has_no_records' }] })
    expect(scope3Readiness(included, [line(1, 'complete', null, 'calculated')])).toEqual({ ready: true, openIssues: [] })
  })

  test('ACC-11: a line is supported when at least one linked file is neither missing nor rejected', () => {
    const f = (status: string) => ({ id: 'x', name: null, sha256: null, status }) as never
    expect([scope3LineEvidenceLinked({ evidence: [] }), scope3LineEvidenceLinked({ evidence: [f('missing'), f('rejected')] }), scope3LineEvidenceLinked({ evidence: [f('rejected'), f('pending')] })]).toEqual([false, false, true])
  })

  test('decision 6: setup descriptions of included categories are read, and either description satisfies the rule', () => {
    const rows = [{ scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[0]!, state: 'yes' as const, reason: '', details: '  Office supplies and IT services.  ' }, { scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[1]!, state: 'yes' as const, reason: '', details: ' ' },
      { scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[2]!, state: 'no' as const, reason: 'Not applicable here.', details: 'ignored' }]
    expect([...scope3ScreeningFromSetup(rows).descriptions]).toEqual([[1, 'Office supplies and IT services.']])
    expect(scope3AssessmentDisclosures('included', null, 'Office supplies.')).toEqual([])
    expect(scope3AssessmentDisclosures('included', { reasonCode: null, criteria: {} as never, magnitudeKind: null, activitiesIncluded: 'Laptops.' }, null)).toEqual([])
    expect(scope3AssessmentDisclosures('included', { reasonCode: null, criteria: {} as never, magnitudeKind: null, activitiesIncluded: ' ' }, ' ')).toEqual(['included_activities_not_described'])
  })

  test('decision 5: a screening conflict is not in the exclusion register, and its figure is in the total', () => {
    const row = (category: number, status: string, decision: string, subtotal: unknown) => ({ category, title: `C${category}`, status, subtotal, screening: { decision, reason: 'Screened out.', description: null }, assessment: null }) as never
    const rows = [row(7, 'screening_conflict', 'excluded', { display: '12.0000' }), row(8, 'excluded', 'excluded', null)]
    expect(scope3ExclusionRegister(rows).map(entry => entry.category)).toEqual([8])
    expect(scope3TotalStatement(rows)).toMatchObject({ basis: 'known_sources_only', includes: [7], excludes: [{ category: 8, status: 'excluded' }] })
  })
})

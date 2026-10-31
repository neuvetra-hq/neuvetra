/**
 * FROZEN. The validator of stored Scope 3 report documents of profile `neuvetra.scope3-report.v2` (round 2, owner decisions
 * 7, 8, 10 and 11; Claude, lane B, 31 October 2026). Never edit this file once a v2 version may exist: write a v3 validator
 * when the document changes. `scope3-report-frozen.test.ts` pins this file's SHA-256.
 *
 * v2 has v1's layout (the frozen v1 structure rules apply unchanged); its results also carry the readiness gate (owner
 * decision 7) and the active-line budget (owner decision 10), engine-held lines are `held` (owner decision 8) and
 * withdrawn records are counted, not listed. Structure and internal consistency only, never live wording or the live
 * catalog (ENG-4).
 */
import { SCOPE3_REPORT_PROFILE_V1, validateScope3ReportDocumentV1, type Scope3ReportDocumentV1, type Scope3ReportResultsV1 } from './scope3-report-v1'

export const SCOPE3_REPORT_PROFILE_V2 = 'neuvetra.scope3-report.v2' as const
export type Scope3ReadinessCodeV2 = 'input_needed' | 'screening_conflict' | 'needs_review' | 'assessment_missing'
export interface Scope3ReportResultsV2 extends Scope3ReportResultsV1 {
  readiness: { ready: boolean; openIssues: Array<{ category: number; code: Scope3ReadinessCodeV2 }> }
  lineBudget: { max: number; used: number; remaining: number }
}
export interface Scope3ReportDocumentV2 extends Omit<Scope3ReportDocumentV1, 'profile' | 'results'> { profile: typeof SCOPE3_REPORT_PROFILE_V2; results: Scope3ReportResultsV2 }

const CODES: readonly string[] = ['input_needed', 'screening_conflict', 'needs_review', 'assessment_missing']
function fail(what: string): never { throw new Error(`Invalid Scope 3 report ${what} (v2).`) }
const obj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** A stored v2 document: v1's frozen structure rules, then the v2 additions to its results. */
export function validateScope3ReportDocumentV2(value: unknown, companyId: string): Scope3ReportDocumentV2 {
  if (!obj(value) || value.profile !== SCOPE3_REPORT_PROFILE_V2) fail('document')
  validateScope3ReportDocumentV1({ ...(value as Record<string, unknown>), profile: SCOPE3_REPORT_PROFILE_V1 }, companyId)
  const results = (value as Record<string, unknown>).results as Record<string, unknown>
  const readiness = results.readiness
  if (!obj(readiness) || Object.keys(readiness).sort().join() !== 'openIssues,ready' || typeof readiness.ready !== 'boolean' || !Array.isArray(readiness.openIssues) || readiness.openIssues.length > 100) fail('readiness')
  const issues = (readiness as { openIssues: unknown[] }).openIssues
  if (readiness.ready !== (issues.length === 0)) fail('readiness')
  const seen = new Set<string>()
  for (const issue of issues) {
    if (!obj(issue) || Object.keys(issue).sort().join() !== 'category,code' || !Number.isSafeInteger(issue.category) || (issue.category as number) < 1 || (issue.category as number) > 15 || !CODES.includes(issue.code as string)) fail('readiness')
    const key = `${(issue as { category: number }).category}|${(issue as { code: string }).code}`
    if (seen.has(key)) fail('readiness')
    seen.add(key)
  }
  const budget = results.lineBudget, lines = (results.records as unknown[]).length
  if (!obj(budget) || Object.keys(budget).sort().join() !== 'max,remaining,used' || !Number.isSafeInteger(budget.max) || (budget.max as number) < 1 || budget.used !== lines || budget.remaining !== Math.max(0, (budget.max as number) - lines)) fail('line budget')
  // Owner decision 8: a line with a result that is not complete is held; a calculated line's result is complete.
  for (const row of results.records as Array<{ outcome: string; result: { status: string } | null; plan?: { status?: unknown } }>) {
    if (row.outcome === 'calculated' ? row.result?.status !== 'complete' : row.result !== null && !(row.outcome === 'held' && row.result.status !== 'complete')) fail('results line')
    if (obj(row.plan) && row.plan.status === 'withdrawn') fail('results line')
  }
  return value as unknown as Scope3ReportDocumentV2
}

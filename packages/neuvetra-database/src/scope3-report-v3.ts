/**
 * The frozen contract for newly prepared Scope 3 report v3: v1 structure, v2 line/readiness controls,
 * the included-empty readiness issue and optional currency provenance. No live catalog, wording or decoder imports.
 * Once published, change the document through a later profile, never by altering this validator.
 *
 * v3 has v1's layout (the frozen v1 structure rules apply unchanged); its results also carry the readiness gate (owner
 * decision 7) and the active-line budget (owner decision 10), engine-held lines are `held` (owner decision 8) and
 * withdrawn records are counted, not listed. Structure and internal consistency only, never live wording or the live
 * catalog (ENG-4).
 */
import { SCOPE3_REPORT_PROFILE_V1, validateScope3ReportDocumentV1, type Scope3ReportDocumentV1, type Scope3ReportResultsV1 } from './scope3-report-v1'

export const SCOPE3_REPORT_PROFILE_V3 = 'neuvetra.scope3-report.v3' as const
export type Scope3ReadinessCodeV3 = 'input_needed' | 'screening_conflict' | 'needs_review' | 'assessment_missing' | 'included_category_has_no_records'
export interface Scope3ReportResultsV3 extends Scope3ReportResultsV1 {
  readiness: { ready: boolean; openIssues: Array<{ category: number; code: Scope3ReadinessCodeV3 }> }
  lineBudget: { max: number; used: number; remaining: number }
}
export interface Scope3ReportDocumentV3 extends Omit<Scope3ReportDocumentV1, 'profile' | 'results'> { profile: typeof SCOPE3_REPORT_PROFILE_V3; results: Scope3ReportResultsV3 }

const CODES: readonly string[] = ['input_needed', 'screening_conflict', 'needs_review', 'assessment_missing', 'included_category_has_no_records']
function fail(what: string): never { throw new Error(`Invalid Scope 3 report ${what} (v3).`) }
const obj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** A stored v3 document: v1's frozen structure rules, then the v3 additions to its results. */
export function validateScope3ReportDocumentV3(value: unknown, companyId: string): Scope3ReportDocumentV3 {
  if (!obj(value) || value.profile !== SCOPE3_REPORT_PROFILE_V3) fail('document')
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
    if ('currencyConversion' in row && !validConversion(row as unknown as Record<string, unknown>)) fail('currency conversion')
  }
  return value as unknown as Scope3ReportDocumentV3
}

/** Frozen activity-money validation: original amount x USD/unit, half-even to cents. Never emissions arithmetic. */
function validConversion(row: Record<string, unknown>): boolean {
  const c = row.currencyConversion, q = row.quantity
  if (row.kind !== 'purchase_spend' || row.derivedFrom !== null || !obj(c) || !obj(q) || q.unit !== 'USD'
    || Object.keys(c).sort().join() !== 'amount,currency,rate,rateDate,rateSource,usd') return false
  if (typeof c.currency !== 'string' || !/^[A-Z]{3}$/.test(c.currency) || c.currency === 'USD'
    || typeof c.amount !== 'string' || !/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(c.amount)
    || typeof c.rate !== 'string' || !/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,8})?$/.test(c.rate) || !/[1-9]/.test(c.rate)
    || typeof c.usd !== 'string' || c.usd.length > 24 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(c.usd)
    || typeof q.value !== 'string' || q.value.length > 32 || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(q.value)
    || typeof c.rateSource !== 'string' || !c.rateSource.trim() || c.rateSource.length > 200 || /[\u0000-\u001f\u007f-\u009f]/.test(c.rateSource)
    || typeof c.rateDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.rateDate)) return false
  const date = new Date(`${c.rateDate}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== c.rateDate) return false
  const scaled = (s: string) => { const [w, f = ''] = s.split('.'); return { units: BigInt(w! + f), scale: f.length } }
  const a = scaled(c.amount), r = scaled(c.rate), scale = a.scale + r.scale, units = a.units * r.units
  let cents: bigint
  if (scale <= 2) cents = units * 10n ** BigInt(2 - scale)
  else { const divisor = 10n ** BigInt(scale - 2); cents = units / divisor; const remainder = units % divisor; if (remainder * 2n > divisor || (remainder * 2n === divisor && cents % 2n === 1n)) cents++ }
  const equalCents = (s: string) => { const n = scaled(s); return n.units * 100n === cents * 10n ** BigInt(n.scale) }
  return equalCents(c.usd) && equalCents(q.value)
}

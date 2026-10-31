/**
 * Test support (round 2, lane B; Claude, 31 October 2026; round 3 EN-9: moved out of the package's production src). Tests that edit a results response to build another case (a
 * line held instead of calculated, a status changed) restamp every field the web decoder re-derives from the lines, so
 * those tests still test what they edit: each category's lines without evidence, data-quality label shown and
 * methodology statement, the readiness gate and the line budget. Never used by the route or the decoder.
 */
import { scope3CategoryEvidenceAndQuality, scope3MethodologyStatement } from '../src/scope3-methodology'
import { scope3Readiness, type Scope3ResultsDocument } from '../src/scope3-trace'

export function scope3RestampResults<T extends Scope3ResultsDocument>(r: T): T {
  for (const row of r.coverage.categories) Object.assign(row, scope3CategoryEvidenceAndQuality(row, r.records))
  for (const row of r.coverage.categories) row.methodology = scope3MethodologyStatement(row, r.records, r.coverage.categories)
  r.readiness = scope3Readiness(r.coverage.categories, r.records)
  const max = r.lineBudget?.max ?? 3000
  r.lineBudget = { max, used: r.records.length, remaining: Math.max(0, max - r.records.length) }
  return r
}

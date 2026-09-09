import { record } from '../research-passages/release'
import type { VerifiedPassages } from '../research-passages/types'

export interface SourceCondition {
  readonly id: string
  readonly passage_id: string
  readonly source_quote: string
  /** Reviewed description of when this source condition matters, not a verdict. */
  readonly applicability: string
}
export interface ConditionCatalog {
  readonly schema_version: 1
  readonly release_sha256: string
  readonly reviewed_passage_ids: readonly string[]
  readonly conditions: readonly SourceCondition[]
}
export interface ConditionClaim { id: string; text: string; passage_ids: string[] }
export interface ConditionRow {
  condition_id: string
  applicability: 'applies' | 'not_applicable'
  preserved: boolean
  answer_quote: string | null
  explanation: string
}
export type ConditionReview = ConditionRow
export interface ConditionFailure {
  claim_id: string
  condition_id: string
  passage_id: string
  explanation: string
}
export class ConditionLedgerError extends Error {
  constructor(public readonly code: 'condition_catalog_invalid' | 'condition_ledger_invalid') { super(code) }
}
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const nonempty = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(value)
const catalogError = (): never => { throw new ConditionLedgerError('condition_catalog_invalid') }
const ledgerError = (): never => { throw new ConditionLedgerError('condition_ledger_invalid') }

/** The caller supplies an already verified release and separately pins/reviews
 * the catalog bytes. Exact quote binding cannot establish catalog completeness.
 */
export function parseConditionCatalog(raw: unknown, verified: VerifiedPassages): ConditionCatalog {
  if (!record(raw) || !exact(raw, ['schema_version', 'release_sha256', 'reviewed_passage_ids', 'conditions'])
    || raw.schema_version !== 1 || typeof raw.release_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(raw.release_sha256)
    || raw.release_sha256 !== verified.sha256 || !Array.isArray(raw.reviewed_passage_ids)
    || !Array.isArray(raw.conditions) || raw.conditions.length > 256) return catalogError()
  const passageIds = verified.passages.map(passage => passage.id)
  if (passageIds.length !== 18 || new Set(passageIds).size !== 18 || passageIds.some(value => !id(value))
    || raw.reviewed_passage_ids.length !== 18 || raw.reviewed_passage_ids.some(value => !id(value) || !passageIds.includes(value))
    || new Set(raw.reviewed_passage_ids).size !== 18) return catalogError()
  const seen = new Set<string>(), conditions: SourceCondition[] = []
  for (const condition of raw.conditions) {
    if (!record(condition) || !exact(condition, ['id', 'passage_id', 'source_quote', 'applicability'])
      || !id(condition.id) || seen.has(condition.id) || !id(condition.passage_id)
      || !nonempty(condition.source_quote, 12000) || !nonempty(condition.applicability, 2000)) return catalogError()
    const passage = verified.passages.find(passage => passage.id === condition.passage_id)
    if (!passage || !passage.text.includes(condition.source_quote)) return catalogError()
    seen.add(condition.id)
    conditions.push(Object.freeze({ id: condition.id, passage_id: condition.passage_id, source_quote: condition.source_quote, applicability: condition.applicability }))
  }
  return Object.freeze({ schema_version: 1, release_sha256: raw.release_sha256,
    reviewed_passage_ids: Object.freeze([...passageIds]), conditions: Object.freeze(conditions) })
}

/** claim.passage_ids must be the authoritative draft parser's own dependency
 * closure. Neighboring claims or the full retrieved corpus never add rows here.
 */
export function conditionsForClaim(catalog: ConditionCatalog, claim: ConditionClaim): SourceCondition[] {
  if (!id(claim.id) || !nonempty(claim.text, 850) || !Array.isArray(claim.passage_ids) || !claim.passage_ids.length
    || new Set(claim.passage_ids).size !== claim.passage_ids.length
    || claim.passage_ids.some(value => !id(value) || !catalog.reviewed_passage_ids.includes(value))) return ledgerError()
  return catalog.conditions.filter(condition => claim.passage_ids.includes(condition.passage_id))
}

/** Mechanical review binding only. A false not_applicable judgment or a
 * semantically inadequate exact answer quote can still pass these checks.
 * All returned failures require a negative condition assessment and an aligned
 * source-review issue; the caller must withhold or review a whole correction.
 */
export function validateClaimConditions(rawRows: unknown, claim: ConditionClaim, catalog: ConditionCatalog): { rows: ConditionRow[]; failures: ConditionFailure[] } {
  const required = conditionsForClaim(catalog, claim)
  if (!Array.isArray(rawRows) || rawRows.length !== required.length) return ledgerError()
  const indexed = new Map<string, ConditionRow>()
  for (const row of rawRows) {
    if (!record(row) || !exact(row, ['condition_id', 'applicability', 'preserved', 'answer_quote', 'explanation'])
      || !id(row.condition_id) || !required.some(condition => condition.id === row.condition_id) || indexed.has(row.condition_id)
      || row.applicability !== 'applies' && row.applicability !== 'not_applicable' || typeof row.preserved !== 'boolean'
      || typeof row.explanation !== 'string' || row.explanation.length > 2000) return ledgerError()
    if (row.applicability === 'applies') {
      if (row.preserved ? !nonempty(row.answer_quote, 850) || !claim.text.includes(row.answer_quote) : row.answer_quote !== null) return ledgerError()
    } else if (!row.preserved || row.answer_quote !== null || !row.explanation.trim()) return ledgerError()
    indexed.set(row.condition_id, { condition_id: row.condition_id, applicability: row.applicability as ConditionRow['applicability'],
      preserved: row.preserved, answer_quote: row.answer_quote as string | null, explanation: row.explanation })
  }
  const rows = required.map(condition => indexed.get(condition.id)!)
  const failures = required.flatMap(condition => {
    const row = indexed.get(condition.id)!
    return row.applicability === 'applies' && !row.preserved
      ? [{ claim_id: claim.id, condition_id: condition.id, passage_id: condition.passage_id, explanation: row.explanation }] : []
  })
  return { rows, failures }
}

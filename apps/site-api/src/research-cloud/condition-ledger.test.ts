import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { hash } from '../research-passages/release'
import type { PassageRelease } from '../research-passages/types'
import { conditionsForClaim, parseConditionCatalog, validateClaimConditions, type ConditionRow } from './condition-ledger'

// Existing approved source bytes, without network or the hidden question set.
// This exercises catalog binding; cloud release verification is tested elsewhere.
const bytes = readFileSync(new URL('../../../../data/research/releases/scope2-website.v1.json', import.meta.url))
const release = JSON.parse(bytes.toString('utf8')) as PassageRelease
const verified = { release, sha256: hash(bytes), passages: release.passages }
const first = release.passages[0]!, second = release.passages[1]!
const raw = () => ({ schema_version: 1, release_sha256: verified.sha256, reviewed_passage_ids: release.passages.map(p => p.id), conditions: [
  { id: 'C01', passage_id: first.id, source_quote: first.text.slice(0, 100), applicability: 'When relying on this source perspective.' },
  { id: 'C02', passage_id: second.id, source_quote: second.text.slice(0, 100), applicability: 'When the second source perspective applies.' },
] })
const catalog = () => parseConditionCatalog(raw(), verified)
const claim = { id: 'c1', text: 'This applies only within the stated source boundary.', passage_ids: [first.id, second.id] }
const rows = (): ConditionRow[] => ['C01', 'C02'].map(condition_id => ({ condition_id, applicability: 'applies', preserved: true, answer_quote: 'within the stated source boundary', explanation: '' }))

describe('reviewed source condition binding', () => {
  test('exact release pin and all reviewed passages are mandatory; reordered IDs do not change binding', () => {
    expect(catalog().conditions).toHaveLength(2)
    const reordered = raw(); reordered.reviewed_passage_ids.reverse()
    expect(parseConditionCatalog(reordered, verified)).toEqual(catalog())
    const wrong = raw(); wrong.release_sha256 = 'a'.repeat(64)
    const missing = raw(); missing.reviewed_passage_ids.pop()
    const duplicate = raw(); duplicate.reviewed_passage_ids[1] = duplicate.reviewed_passage_ids[0]!
    const unknown = raw(); unknown.reviewed_passage_ids[0] = 'unknown'
    for (const value of [wrong, missing, duplicate, unknown, { ...raw(), extra: true }, { ...raw(), schema_version: 2 }]) {
      expect(() => parseConditionCatalog(value, verified)).toThrow('condition_catalog_invalid')
    }
    expect(() => parseConditionCatalog(raw(), { ...verified, passages: verified.passages.slice(1) })).toThrow('condition_catalog_invalid')
  })
  test('condition quotes are exact contiguous source bytes in their named passage; duplicate/unknown conditions fail', () => {
    const invented = raw(); invented.conditions[0]!.source_quote = 'This invented statement is not an EPA quotation.'
    const gapped = raw(); gapped.conditions[0]!.source_quote = first.text.slice(0, 30) + '...' + first.text.slice(80, 100)
    const cross = raw(); cross.conditions[0]!.source_quote = second.text.slice(0, 100)
    const unknown = raw(); unknown.conditions[0]!.passage_id = 'unknown'
    const duplicate = raw(); duplicate.conditions[1]!.id = duplicate.conditions[0]!.id
    const extra = raw(); Object.assign(extra.conditions[0]!, { approval: true })
    const empty = raw(); empty.conditions[0]!.applicability = ' '
    for (const value of [invented, gapped, cross, unknown, duplicate, extra, empty]) {
      expect(() => parseConditionCatalog(value, verified)).toThrow('condition_catalog_invalid')
    }
  })
  test('parsed catalogs detach and freeze source content; only a claim own citations contribute required rows', () => {
    const source = raw(), parsed = parseConditionCatalog(source, verified)
    source.conditions[0]!.source_quote = 'Modified after parsing.'
    expect(parsed.conditions[0]!.source_quote).not.toBe(source.conditions[0]!.source_quote)
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(Object.isFrozen(parsed.conditions[0])).toBe(true)
    expect(conditionsForClaim(parsed, { ...claim, passage_ids: [first.id] }).map(c => c.id)).toEqual(['C01'])
    for (const passage_ids of [[], ['unknown'], [first.id, first.id]]) expect(() => conditionsForClaim(parsed, { ...claim, passage_ids })).toThrow('condition_ledger_invalid')
    const noConditions = { ...claim, passage_ids: [release.passages[17]!.id] }
    expect(validateClaimConditions([], noConditions, parsed)).toEqual({ rows: [], failures: [] })
  })
})

describe('per-claim model condition ledger', () => {
  test('all expected IDs appear exactly once; returned order follows catalog and unrelated rows cannot replace missing rows', () => {
    const parsed = catalog()
    expect(validateClaimConditions(rows().reverse(), claim, parsed).rows.map(r => r.condition_id)).toEqual(['C01', 'C02'])
    const duplicate = rows(); duplicate[1]!.condition_id = 'C01'
    const unknown = rows(); unknown[1]!.condition_id = 'unknown'
    const extra = rows(); Object.assign(extra[0]!, { verdict: 'pass' })
    for (const value of [null, rows().slice(1), [...rows(), rows()[0]], duplicate, unknown, extra]) {
      expect(() => validateClaimConditions(value, claim, parsed)).toThrow('condition_ledger_invalid')
    }
    expect(() => validateClaimConditions(rows(), { ...claim, passage_ids: [first.id] }, parsed)).toThrow('condition_ledger_invalid')
  })
  test('an applicable preserved condition needs an exact nonempty quote in this claim, not neighboring answer text', () => {
    for (const answer_quote of [null, '', ' ', 'Neighboring claim explains the condition.', 'within ... boundary', 12]) {
      const value = rows(); Object.assign(value[0]!, { answer_quote })
      expect(() => validateClaimConditions(value, claim, catalog())).toThrow('condition_ledger_invalid')
    }
    const original = rows(), result = validateClaimConditions(original, claim, catalog())
    original[0]!.answer_quote = 'Changed after validation.'
    expect(result.rows[0]!.answer_quote).toBe('within the stated source boundary')
  })
  test('applicable missing conditions return exact failure bindings and never rewrite the answer', () => {
    const value = rows(); value[1] = { condition_id: 'C02', applicability: 'applies', preserved: false, answer_quote: null, explanation: 'A source prerequisite is absent.' }
    const result = validateClaimConditions(value, claim, catalog())
    expect(result.failures).toEqual([{ claim_id: 'c1', condition_id: 'C02', passage_id: second.id, explanation: 'A source prerequisite is absent.' }])
    expect(claim.text).toBe('This applies only within the stated source boundary.')
    value[1]!.answer_quote = 'within the stated source boundary'
    expect(() => validateClaimConditions(value, claim, catalog())).toThrow('condition_ledger_invalid')
  })
  test('not_applicable requires true preservation, no quote and a nonempty explanation; no implicit status coercion', () => {
    const value = rows(); value[0] = { condition_id: 'C01', applicability: 'not_applicable', preserved: true, answer_quote: null, explanation: 'The claim does not discuss this conditional case.' }
    expect(validateClaimConditions(value, claim, catalog()).failures).toEqual([])
    for (const change of [{ preserved: false }, { answer_quote: claim.text }, { explanation: ' ' }, { applicability: 'unknown' }, { preserved: 'true' }, { explanation: null }]) {
      const invalid = structuredClone(value); Object.assign(invalid[0]!, change)
      expect(() => validateClaimConditions(invalid, claim, catalog())).toThrow('condition_ledger_invalid')
    }
  })
  test('mechanical validity cannot prove applicability or semantic preservation', () => {
    const falseExemption = rows().map(row => ({ ...row, applicability: 'not_applicable' as const, answer_quote: null, explanation: 'An incorrect but structurally valid model judgment.' }))
    expect(validateClaimConditions(falseExemption, claim, catalog()).failures).toEqual([])
    const weakQuote = rows().map(row => ({ ...row, answer_quote: 'This' }))
    expect(validateClaimConditions(weakQuote, claim, catalog()).failures).toEqual([])
    // The source reviewer and independent QA must challenge both residuals.
  })
})

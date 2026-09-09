import { dependencyClosure, PassageError, record } from '../research-passages/release'
import { validateConceptualNumbers } from '../research-passages/numeric-policy'
import { validateClaimConditions, type ConditionCatalog, type ConditionReview } from './condition-ledger'
import type { Passage, Plan } from '../research-passages/types'

export interface SupportQuote { passage_id: string; quote: string }
export interface CloudClaim { id: string; facet_id: string; text: string; passage_ids: string[]; support: SupportQuote[]; qualifications: string[] }
export interface Review {
  decision: 'pass' | 'fail'; decomposition_complete: boolean; complete: boolean; relevant: boolean; scope_valid: boolean; context_sufficient: boolean
  facets: { facet_id: string; complete: boolean; supported: boolean; claim_ids: string[] }[]
  claims: { id: string; supported: boolean; conditions_complete: boolean; modality_preserved: boolean; relationships_preserved: boolean; citations_sufficient: boolean; passage_ids: string[]; condition_reviews: ConditionReview[] }[]
  issues: { target_id: string; code: 'support' | 'condition' | 'modality' | 'relationship' | 'citation' | 'completeness' | 'scope' | 'decomposition' | 'context' | 'relevance'; explanation: string }[]
}
export const answerLimits = { maxClaims: 8, claimCharacters: 850, totalCharacters: 4000, maxQuotes: 8, quoteCharacters: 900 } as const
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const ids = (v: unknown, max = 32): v is string[] => Array.isArray(v) && v.length <= max && v.every(x => text(x, 120)) && new Set(v).size === v.length
const same = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x))
const fail = (code: 'draft_invalid' | 'support_not_verified'): never => { throw new PassageError(code) }

/** Exact quotes are traceable support anchors, never a substitute for semantic review. */
export function parseCloudDraft(raw: unknown, selected: Passage[], facets: Plan['facets'], versions: string[]): CloudClaim[] {
  if (!record(raw) || !exact(raw, ['answers']) || !Array.isArray(raw.answers)) return fail('draft_invalid')
  if (!raw.answers.length) throw new PassageError('draft_empty')
  if (!facets.length || raw.answers.length !== facets.length) return fail('draft_invalid')
  const groups = new Map<string, unknown[]>()
  for (const group of raw.answers) {
    if (!record(group) || !exact(group, ['facet_id', 'claims']) || !text(group.facet_id, 120) || !facets.some(f => f.id === group.facet_id) || groups.has(group.facet_id) || !Array.isArray(group.claims) || group.claims.length !== 1) return fail('draft_invalid')
    groups.set(group.facet_id, group.claims)
  }
  const claims: CloudClaim[] = []
  let size = 0
  for (const facet of facets) {
    const eligible = dependencyClosure(facet.passage_ids, selected)
    for (const item of groups.get(facet.id)!) {
      if (!record(item) || !exact(item, ['text', 'passage_ids', 'support']) || !text(item.text, answerLimits.claimCharacters) || !ids(item.passage_ids, 8) || !item.passage_ids.length || item.passage_ids.some(id => !eligible.some(p => p.id === id)) || !item.passage_ids.some(id => facet.passage_ids.includes(id)) || !Array.isArray(item.support) || !item.support.length || item.support.length > answerLimits.maxQuotes) return fail('draft_invalid')
      const context = dependencyClosure(item.passage_ids, selected)
      const support: SupportQuote[] = []
      for (const quote of item.support) {
        if (!record(quote) || !exact(quote, ['passage_id', 'quote']) || !text(quote.passage_id, 120) || !text(quote.quote, answerLimits.quoteCharacters)) return fail('draft_invalid')
        const p = context.find(p => p.id === quote.passage_id)
        if (!p || quote.quote.trim().length < 12 || !p.text.includes(quote.quote)) return fail('draft_invalid')
        if (support.some(s => s.passage_id === quote.passage_id && s.quote === quote.quote)) return fail('draft_invalid')
        support.push({ passage_id: quote.passage_id, quote: quote.quote })
      }
      if (item.passage_ids.some(id => !support.some(q => q.passage_id === id))) return fail('draft_invalid')
      size += item.text.length
      if (size > answerLimits.totalCharacters || claims.length >= answerLimits.maxClaims) return fail('draft_invalid')
      validateConceptualNumbers(item.text, [...context.map(p => p.text), ...versions])
      claims.push({ id: `c${claims.length + 1}`, facet_id: facet.id, text: item.text, passage_ids: context.map(p => p.id), support, qualifications: [...new Set(context.flatMap(p => p.qualifications))] })
    }
  }
  return claims
}

/** Parse complete aligned negative verdicts separately from the approval decision. */
export function parseCloudReview(raw: unknown, claims: CloudClaim[], facets: Plan['facets'], catalog: ConditionCatalog): Review {
  if (facets.some(f => f.id === 'answer' || claims.some(c => c.id === f.id)) || claims.some(c => c.id === 'answer')) return fail('support_not_verified')
  const flags = ['decomposition_complete', 'complete', 'relevant', 'scope_valid', 'context_sufficient']
  if (!record(raw) || !exact(raw, ['decision', ...flags, 'facets', 'claims', 'issues']) || !['pass', 'fail'].includes(String(raw.decision)) || flags.some(k => typeof raw[k] !== 'boolean') || !Array.isArray(raw.facets) || raw.facets.length !== facets.length || !Array.isArray(raw.claims) || raw.claims.length !== claims.length || !Array.isArray(raw.issues) || raw.issues.length > 16) return fail('support_not_verified')
  const seenFacets = new Set<string>(), seenClaims = new Set<string>()
  for (const f of raw.facets) {
    if (!record(f) || !exact(f, ['facet_id', 'complete', 'supported', 'claim_ids']) || !text(f.facet_id, 120) || !facets.some(p => p.id === f.facet_id) || seenFacets.has(f.facet_id) || typeof f.complete !== 'boolean' || typeof f.supported !== 'boolean' || !ids(f.claim_ids, 8) || !same(f.claim_ids, claims.filter(c => c.facet_id === f.facet_id).map(c => c.id))) return fail('support_not_verified')
    seenFacets.add(f.facet_id)
  }
  for (const c of raw.claims) {
    const checks = ['supported', 'conditions_complete', 'modality_preserved', 'relationships_preserved', 'citations_sufficient']
    if (!record(c) || !exact(c, ['id', ...checks, 'passage_ids', 'condition_reviews']) || !text(c.id, 120) || seenClaims.has(c.id) || checks.some(k => typeof c[k] !== 'boolean') || !ids(c.passage_ids)) return fail('support_not_verified')
    const expected = claims.find(p => p.id === c.id)
    if (!expected || !same(c.passage_ids, expected.passage_ids)) return fail('support_not_verified')
    try {
      const ledger = validateClaimConditions(c.condition_reviews, expected, catalog)
      if (ledger.failures.length && c.conditions_complete !== false) return fail('support_not_verified')
    } catch { return fail('support_not_verified') }
    seenClaims.add(c.id)
  }
  for (const issue of raw.issues) {
    if (!record(issue) || !exact(issue, ['target_id', 'code', 'explanation']) || !text(issue.target_id, 120) || !['answer', ...seenClaims, ...seenFacets].includes(issue.target_id) || !['support', 'condition', 'modality', 'relationship', 'citation', 'completeness', 'scope', 'decomposition', 'context', 'relevance'].includes(String(issue.code)) || !text(issue.explanation, 700)) return fail('support_not_verified')
  }
  const review = raw as unknown as Review
  const hasIssue = (id: string, code?: Review['issues'][number]['code']) => review.issues.some(i => i.target_id === id && (code === undefined || i.code === code))
  const globalMap = { decomposition: 'decomposition_complete', scope: 'scope_valid', context: 'context_sufficient', completeness: 'complete', relevance: 'relevant' } as const
  const claimMap = { support: 'supported', condition: 'conditions_complete', modality: 'modality_preserved', relationship: 'relationships_preserved', citation: 'citations_sufficient' } as const
  for (const issue of review.issues) {
    if (issue.target_id === 'answer') {
      if (!Object.hasOwn(globalMap, issue.code) || review[globalMap[issue.code as keyof typeof globalMap]] !== false) return fail('support_not_verified')
    } else {
      const claim = review.claims.find(c => c.id === issue.target_id)
      const facet = review.facets.find(f => f.facet_id === issue.target_id)
      if (claim) { if (!Object.hasOwn(claimMap, issue.code) || claim[claimMap[issue.code as keyof typeof claimMap]] !== false) return fail('support_not_verified') }
      else if (!facet || (issue.code === 'completeness' ? facet.complete !== false : issue.code === 'support' ? facet.supported !== false : true)) return fail('support_not_verified')
    }
  }
  for (const c of review.claims) {
    if (!c.conditions_complete && !hasIssue(c.id, 'condition') || !c.modality_preserved && !hasIssue(c.id, 'modality') || !c.relationships_preserved && !hasIssue(c.id, 'relationship') || !c.citations_sufficient && !hasIssue(c.id, 'citation') || !c.supported && !hasIssue(c.id)) return fail('support_not_verified')
  }
  for (const f of review.facets) {
    if (!f.complete && !hasIssue(f.facet_id, 'completeness')) return fail('support_not_verified')
    if (!f.supported && !hasIssue(f.facet_id, 'support') && !f.claim_ids.some(id => hasIssue(id))) return fail('support_not_verified')
  }
  for (const [code, flag] of Object.entries(globalMap)) {
    if (review[flag] !== false) continue
    const explainedByFacet = flag === 'complete' && review.facets.some(f => !f.complete && hasIssue(f.facet_id, 'completeness'))
    if (!explainedByFacet && !hasIssue('answer', code as keyof typeof globalMap)) return fail('support_not_verified')
  }
  const flagsPass = review.decomposition_complete && review.complete && review.relevant && review.scope_valid && review.context_sufficient && review.facets.every(f => f.complete && f.supported) && review.claims.every(c => c.supported && c.conditions_complete && c.modality_preserved && c.relationships_preserved && c.citations_sufficient)
  // Contradictory or unexplained verdicts never become correction instructions.
  if (review.decision === 'pass' ? !flagsPass || review.issues.length > 0 : flagsPass || review.issues.length === 0) return fail('support_not_verified')
  return review
}

export const mayCorrect = (review: Review): boolean => review.decision === 'fail' && review.decomposition_complete && review.scope_valid && review.context_sufficient && review.issues.every(i => !['scope', 'decomposition', 'context'].includes(i.code))

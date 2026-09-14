import { dependencyClosure, PassageError, record } from './release'
import type { CheckedClaim, Passage, Plan } from './types'
import { draftLimits, facetLimits } from './types'
import { validateConceptualNumbers } from './numeric-policy'

const keys = (v: Record<string, unknown>, expected: string[]) => Object.keys(v).length === expected.length && expected.every(k => Object.hasOwn(v, k))
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const list = (v: unknown, max = 16): v is string[] => Array.isArray(v) && v.length <= max && v.every(i => str(i, 120)) && new Set(v).size === v.length
const same = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id))
const invalid = (code: 'selection_invalid' | 'draft_invalid' | 'support_not_verified'): never => { throw new PassageError(code) }

export function validatePlan(raw: unknown, available: Passage[]): Plan {
  if (!record(raw) || !keys(raw, ['action', 'decision', 'passage_ids', 'facets', 'missing_context']) || !['conceptual_research', 'numeric_factor_selection', 'calculation', 'legal_applicability', 'company_diagnosis', 'unsupported'].includes(String(raw.action)) || !['answer', 'needs_input', 'unsupported', 'stale_or_conflicting'].includes(String(raw.decision)) || !list(raw.passage_ids, 8) || !Array.isArray(raw.facets) || raw.facets.length > 6 || !list(raw.missing_context, 3) || raw.missing_context.some(i => !['location', 'reporting_period', 'electricity_supply'].includes(i))) return invalid('selection_invalid')
  const passageIds = raw.passage_ids
  const facets: Plan['facets'] = []
  for (const item of raw.facets) {
    if (!record(item) || !keys(item, ['id', 'request', 'passage_ids']) || !str(item.id, 120) || !str(item.request, 240) || !list(item.passage_ids, 8) || !item.passage_ids.length || item.passage_ids.some(id => !passageIds.includes(id)) || facets.some(f => f.id === item.id)) return invalid('selection_invalid')
    facets.push({ id: item.id, request: item.request, passage_ids: item.passage_ids })
  }
  if (raw.passage_ids.some(id => !available.some(p => p.id === id))) return invalid('selection_invalid')
  if (raw.decision === 'answer') {
    if (!raw.passage_ids.length || !facets.length || raw.missing_context.length || raw.passage_ids.some(id => !facets.some(f => f.passage_ids.includes(id)))) return invalid('selection_invalid')
  } else if (raw.passage_ids.length || facets.length || (raw.decision === 'needs_input' ? !raw.missing_context.length : raw.missing_context.length > 0)) return invalid('selection_invalid')
  return { action: raw.action as Plan['action'], decision: raw.decision as Plan['decision'], passage_ids: raw.passage_ids, facets, missing_context: raw.missing_context }
}

export function validateDraft(raw: unknown, selected: Passage[], facets: Plan['facets'], sourceVersions: { id: string; title: string; version: string }[] = []): CheckedClaim[] {
  if (!facets.length || facets.length > draftLimits.maxClaims || !record(raw) || !keys(raw, ['answers']) || !Array.isArray(raw.answers)) return invalid('draft_invalid')
  if (!raw.answers.length) throw new PassageError('draft_empty')
  if (raw.answers.length !== facets.length) return invalid('draft_invalid')
  const groups = new Map<string, unknown[]>()
  for (const answer of raw.answers) {
    if (!record(answer) || !keys(answer, ['facet_id', 'claims']) || !str(answer.facet_id, 120) || !facets.some(f => f.id === answer.facet_id) || groups.has(answer.facet_id) || !Array.isArray(answer.claims)) return invalid('draft_invalid')
    if (!answer.claims.length) throw new PassageError('draft_empty')
    groups.set(answer.facet_id, answer.claims)
  }
  const claims: CheckedClaim[] = []
  let totalCharacters = 0
  const budget = facetLimits(facets.length)
  // Render in planned facet order, independent of provider group order.
  for (const facet of facets) {
    const items = groups.get(facet.id)
    if (!items || items.length > budget.max_claims) return invalid('draft_invalid')
    const eligible = dependencyClosure(facet.passage_ids, selected)
    let facetCharacters = 0
    for (const item of items) {
      if (!record(item) || !keys(item, ['text', 'passage_ids']) || !str(item.text, draftLimits.claimCharacters) || !list(item.passage_ids, 8) || !item.passage_ids.length || item.passage_ids.some(id => !eligible.some(p => p.id === id)) || !item.passage_ids.some(id => facet.passage_ids.includes(id))) return invalid('draft_invalid')
      totalCharacters += item.text.length; facetCharacters += item.text.length
      if (totalCharacters > draftLimits.totalCharacters || facetCharacters > budget.text_characters || claims.length >= draftLimits.maxClaims) return invalid('draft_invalid')
      // Reference closure and qualifications are mechanical source controls,
      // not proof that a cited paragraph fulfills the requested facet.
      const context = dependencyClosure(item.passage_ids, selected)
      validateConceptualNumbers(item.text, [...context.map(p => p.text), ...sourceVersions.filter(source => context.some(p => p.source_id === source.id)).flatMap(source => [source.title, source.version])])
      claims.push({ id: `c${claims.length + 1}`, facet_id: facet.id, text: item.text, passage_ids: context.map(p => p.id), qualifications: [...new Set(context.flatMap(p => p.qualifications))] })
    }
  }
  return claims
}

export function validateVerdict(raw: unknown, claims: CheckedClaim[], facets: Plan['facets']): void {
  if (!record(raw) || !keys(raw, ['decision', 'decomposition_complete', 'complete', 'relevant', 'scope_valid', 'context_sufficient', 'facets', 'claims']) || raw.decision !== 'pass' || raw.decomposition_complete !== true || raw.complete !== true || raw.relevant !== true || raw.scope_valid !== true || raw.context_sufficient !== true || !Array.isArray(raw.facets) || raw.facets.length !== facets.length || !Array.isArray(raw.claims) || raw.claims.length !== claims.length) return invalid('support_not_verified')
  const seenFacets = new Set<string>()
  for (const item of raw.facets) {
    if (!record(item) || !keys(item, ['facet_id', 'complete', 'supported', 'claim_ids']) || !str(item.facet_id, 120) || !facets.some(f => f.id === item.facet_id) || seenFacets.has(item.facet_id) || item.complete !== true || item.supported !== true || !list(item.claim_ids, draftLimits.maxClaims)) return invalid('support_not_verified')
    const expected = claims.filter(c => c.facet_id === item.facet_id).map(c => c.id)
    if (!expected.length || !same(item.claim_ids, expected)) return invalid('support_not_verified')
    seenFacets.add(item.facet_id)
  }
  const seen = new Set<string>()
  for (const item of raw.claims) {
    if (!record(item) || !keys(item, ['id', 'supported', 'qualifications_complete', 'passage_ids']) || !str(item.id, 120) || seen.has(item.id) || item.supported !== true || item.qualifications_complete !== true || !list(item.passage_ids)) return invalid('support_not_verified')
    const claim = claims.find(c => c.id === item.id)
    if (!claim || !same(item.passage_ids, claim.passage_ids)) return invalid('support_not_verified')
    seen.add(item.id)
  }
}

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { hash, parsePassageRelease } from '../research-passages/release'
import { parseUnitCatalog, selectedUnits, SOURCE_SHA } from './catalog'
import { capabilityInput, capabilityMatchesRequirement, LEGACY_CAPABILITY_SHA as CAPABILITY_SHA, LEGACY_CAPABILITY_UNIT_SHA as CAPABILITY_UNIT_SHA, parseCapabilities, validateSupportRequirements, type CapabilityCatalog, type SupportRequirement } from './capabilities'
import { questionTokens } from './question-contract'
import { parseSelection, parseSelectionReview, type Selection, type SelectionReview } from './selection'

const now = Date.parse('2026-09-12T12:00:00Z')
const expectedCapabilitySha = '230060af16b77bde32e253ca49e9676e2603e9ceebe165eae33c0ef87ce6e823'
const expectedUnitSha = 'adb43b8a9e90cbe85f382988dedc16e16f82f7a596e0bcf5f5e98ba2f84630cd'
const bytes = readFileSync(new URL('../../../../data/research/capabilities/scope2-website.epa-inquiry.v1.json', import.meta.url))
const unitBytes = readFileSync(new URL('../../../../data/research/answer-units/scope2-website.epa-inquiry.v1.json', import.meta.url))
const release = parsePassageRelease(JSON.parse(readFileSync(new URL('../../../../data/research/releases/scope2-website.v1.json', import.meta.url), 'utf8')), now)
const catalog = parseUnitCatalog(unitBytes, expectedUnitSha, { release, passages: release.passages, sha256: SOURCE_SHA }, now).catalog
const capabilities = parseCapabilities(bytes, expectedCapabilitySha, catalog, expectedUnitSha, now)
const fresh = (): CapabilityCatalog => JSON.parse(bytes.toString())
const changed = (mutate: (value: CapabilityCatalog) => void) => {
  const value = fresh()
  mutate(value)
  return Buffer.from(JSON.stringify(value))
}
const parseChanged = (mutate: (value: CapabilityCatalog) => void) => {
  const candidate = changed(mutate)
  // Recomputed test digests isolate structural checks; they are not release approvals.
  return parseCapabilities(candidate, hash(candidate), catalog, expectedUnitSha, now)
}
const requirement = (kind: SupportRequirement['kind'], subject: SupportRequirement['subject'], ids: string[] = [], limits: string[] = []): SupportRequirement => ({
  kind, subject, capability_ids: ids, blocking_limit_ids: limits,
})
const timing = () => requirement('conditional_rule', 'agreement_period_alignment', ['U16-C01'])
const generation = () => requirement('conditional_rule', 'generation_boundary', ['U07-C02'])
const missing = () => requirement('conditional_rule', 'unrepresented_subject')
const proof = (raw: unknown, options: Partial<Parameters<typeof validateSupportRequirements>[1]> = {}) => validateSupportRequirements(raw, {
  background: false, covered: true, appropriatelyResolved: true, ownUnitIds: ['U16'], capabilities, ...options,
})

describe('approved capability loader', () => {
  test('binds the exact reviewed 23 units and recursively freezes their own wording anchors', () => {
    expect(CAPABILITY_SHA).toBe(expectedCapabilitySha)
    expect(CAPABILITY_UNIT_SHA).toBe(expectedUnitSha)
    expect(hash(bytes)).toBe(expectedCapabilitySha)
    expect(capabilities.units.map(unit => unit.unit_id)).toEqual(catalog.units.map(unit => unit.id))
    expect(capabilities.review.expires_at).toBe(catalog.review.expires_at)
    expect(Object.isFrozen(capabilities)).toBe(true)
    expect(Object.isFrozen(capabilities.units[15]!.capabilities[0]!.anchor)).toBe(true)
    const input = capabilityInput(capabilities, 'U16')
    expect(input.capabilities[0]!.id).toBe('U16-C01')
    expect(input.capability_limits[0]!.id).toBe('U16-L01')
    expect(catalog.units[15]!.text.slice(...input.capabilities[0]!.anchor)).toBe(catalog.units[15]!.text.slice(0, 472))
    expect(() => capabilityInput(capabilities, 'U99')).toThrow('unit_catalog_invalid')
  })

  test('rejects changed bytes, an unbound digest, and a foreign unit-catalog digest', () => {
    expect(() => parseCapabilities(changed(v => { v.absence_policy += ' altered' }), expectedCapabilitySha, catalog, expectedUnitSha, now)).toThrow('unit_catalog_invalid')
    expect(() => parseCapabilities(bytes, 'not-a-digest', catalog, expectedUnitSha, now)).toThrow('unit_catalog_invalid')
    expect(() => parseCapabilities(bytes, expectedCapabilitySha, catalog, 'c59ffac9c6e824b81174aac7f52bf3a36dfed516a7340ff40ff8ba758518ef1f', now)).toThrow('unit_catalog_invalid')
    const invalidUtf8 = Uint8Array.from([0xff])
    expect(() => parseCapabilities(invalidUtf8, hash(invalidUtf8), catalog, expectedUnitSha, now)).toThrow('unit_catalog_invalid')
  })

  test('expires exactly at the reviewed deadline and cannot renew the source window', () => {
    expect(() => parseCapabilities(bytes, expectedCapabilitySha, catalog, expectedUnitSha, Date.parse(capabilities.review.expires_at))).toThrow('unit_catalog_stale')
    expect(() => parseChanged(v => { v.review.expires_at = '2026-09-16T00:00:00Z' })).toThrow('unit_catalog_stale')
    expect(() => parseChanged(v => { v.review.expires_at = 'not-a-date' })).toThrow('unit_catalog_stale')
  })

  const invalidCatalogs: [string, (v: CapabilityCatalog) => void][] = [
    ['source mismatch', v => { v.source_release_sha256 = '0'.repeat(64) }],
    ['condition mismatch', v => { v.condition_catalog_sha256 = '0'.repeat(64) }],
    ['unit binding mismatch', v => { v.unit_catalog_sha256 = '0'.repeat(64) }],
    ['unapproved status', v => { v.review.status = 'pending' }],
    ['unapproved source review', v => { v.review.source_review.disposition = 'pending' }],
    ['same author and reviewer', v => { v.review.qa_review.reviewer = v.review.source_review.reviewer }],
    ['missing review locator', v => { v.review.qa_review.record_path = '' }],
    ['future assembly', v => { v.provenance.assembled_at = '2026-09-13T00:00:00Z' }],
    ['unknown top-level field', v => { Reflect.set(v, 'extra_approval', true) }],
    ['missing unit', v => { v.units.pop() }],
    ['reordered units', v => { [v.units[0], v.units[1]] = [v.units[1]!, v.units[0]!] }],
    ['foreign capability ID', v => { v.units[0]!.capabilities[0]!.id = 'U02-C01' }],
    ['nonsequential capability ID', v => { v.units[0]!.capabilities[0]!.id = 'U01-C02' }],
    ['foreign limit ID', v => { v.units[0]!.limits[0]!.id = 'U02-L01' }],
    ['unknown kind', v => { Reflect.set(v.units[0]!.capabilities[0]!, 'kind', 'eligibility_approval') }],
    ['unknown subject', v => { Reflect.set(v.units[0]!.capabilities[0]!, 'subject', 'unrepresented_subject') }],
    ['negative anchor', v => { v.units[0]!.capabilities[0]!.anchor = [-1, 10] }],
    ['empty anchor', v => { v.units[0]!.capabilities[0]!.anchor = [10, 10] }],
    ['fractional anchor', v => { v.units[0]!.capabilities[0]!.anchor = [0.5, 10] }],
    ['anchor outside own text', v => { v.units[0]!.limits[0]!.anchor = [0, catalog.units[0]!.text.length + 1] }],
    ['whitespace-only anchor', v => { const space = catalog.units[0]!.text.indexOf(' '); v.units[0]!.capabilities[0]!.anchor = [space, space + 1] }],
  ]
  for (const [name, mutate] of invalidCatalogs) test(`rejects ${name} even with a matching test digest`, () => {
    expect(() => parseChanged(mutate)).toThrow('unit_catalog_invalid')
  })
})

describe('declared support consistency, not semantic proof', () => {
  test('accepts the declared timing and generation rule types only with their own capabilities', () => {
    expect(() => proof([timing()])).not.toThrow()
    expect(() => proof([generation()], { ownUnitIds: ['U07'] })).not.toThrow()
    expect(() => proof([timing(), generation()], { ownUnitIds: ['U16', 'U07'] })).not.toThrow()
  })

  test('does not infer a rule effect from a descriptive qualifier or general recommendation', () => {
    const descriptive = requirement('general_recommendation', 'reporting_methods', ['U02-C01'])
    expect(() => proof([descriptive], { ownUnitIds: ['U02'] })).not.toThrow()
    expect(() => proof([requirement('conditional_rule', 'reporting_methods', ['U02-C01'])], { ownUnitIds: ['U02'] })).toThrow('selection_review_invalid')
    expect(() => proof([descriptive, requirement('conditional_rule', 'grid_geography')], { ownUnitIds: ['U02'] })).toThrow('selection_review_invalid')
    expect(() => proof([requirement('conditional_rule', 'grid_geography', ['U08-C01'])], { ownUnitIds: ['U08'] })).not.toThrow()
  })

  test('rejects missing proof, unknown IDs, and strict wrong kinds or subjects', () => {
    for (const raw of [[], [requirement('conditional_rule', 'agreement_period_alignment')], [requirement('conditional_rule', 'agreement_period_alignment', ['U99-C01'])],
      [requirement('limitation', 'agreement_period_alignment', ['U16-C01'])], [requirement('conditional_rule', 'generation_boundary', ['U16-C01'])]]) {
      expect(() => proof(raw)).toThrow('selection_review_invalid')
    }
  })

  test('rejects a valid capability owned only by another part, including during a revision', () => {
    expect(() => proof([generation()])).toThrow('selection_review_invalid')
    expect(() => proof([generation()], { appropriatelyResolved: false })).toThrow('selection_review_invalid')
  })

  test('every declared requirement needs proof; one supported requirement does not cover another', () => {
    expect(() => proof([timing(), missing()])).toThrow('selection_review_invalid')
    expect(() => proof([timing(), missing()], { appropriatelyResolved: false })).not.toThrow()
  })

  test('blocking limits cannot approve an affirmative part but can explain an explicit boundary', () => {
    const blocked = requirement('conditional_rule', 'agreement_period_alignment', ['U16-C01'], ['U16-L01'])
    expect(() => proof([blocked])).toThrow('selection_review_invalid')
    expect(() => proof([blocked], { covered: false, ownUnitIds: [] })).not.toThrow()
    expect(() => proof([requirement('conditional_rule', 'agreement_period_alignment', [], ['U99-L01'])], { covered: false, ownUnitIds: [] })).toThrow('selection_review_invalid')
  })

  test('an unrepresented subject has no positive capability but may justify missing coverage', () => {
    expect(() => proof([missing()])).toThrow('selection_review_invalid')
    expect(() => proof([missing()], { covered: false, ownUnitIds: [] })).not.toThrow()
    expect(() => proof([requirement('conditional_rule', 'unrepresented_subject', ['U16-C01'])], { covered: false, ownUnitIds: [] })).toThrow('selection_review_invalid')
  })

  test('background has no requirements and duplicate or excessive requirements are rejected', () => {
    expect(() => proof([], { background: true, covered: false, ownUnitIds: [] })).not.toThrow()
    expect(() => proof([timing()], { background: true, covered: false })).toThrow('selection_review_invalid')
    expect(() => proof([timing(), timing()])).toThrow('selection_review_invalid')
    const six = [timing(), generation(), missing(), requirement('definition', 'accounting_methods'), requirement('definition', 'electricity_units'), requirement('explanation', 'factor_data_period')]
    expect(() => proof(six, { covered: false })).not.toThrow()
    expect(() => proof([...six, requirement('limitation', 'grid_factor_uncertainty')], { covered: false })).toThrow('selection_review_invalid')
    expect(() => proof([{ ...timing(), capability_ids: ['U16-C01', 'U16-C01'] }])).toThrow('selection_review_invalid')
  })
})

// The reviewer verdicts below are explicit synthetic declarations. Passing these
// tests demonstrates parser/type consistency, never natural-language task fit.
function answerPlan(chunks: { text: string; ids: string[] }[]): Selection {
  let start = 0
  const question = chunks.map(chunk => chunk.text).join(' ')
  return parseSelection({ decision: 'answer', reason: 'covered',
    question_contract: { operation: 'explain', parts: chunks.map((chunk, index) => {
      const part = { id: `q${index + 1}`, start_token: start, kind: 'request', resolution: 'covered', facet_ids: [`f${index + 1}`], context_ids: [] }
      start += questionTokens(chunk.text).length
      return part
    }) }, facets: chunks.map((chunk, index) => ({ id: `f${index + 1}`, unit_ids: chunk.ids })),
  }, question, catalog)
}
function rawReview(plan: Selection, requirements: SupportRequirement[][]): SelectionReview {
  return { decision: 'pass', decomposition_complete: true, relevant: true, scope_appropriate: true, context_appropriate: true, premise_handled: true, task_fit: true, proportionate: true,
    question_parts: plan.question_contract.parts.map((part, index) => ({ id: part.id, faithful: true, appropriately_resolved: true, support_requirements: requirements[index]! })),
    facets: plan.facets.map(facet => ({ id: facet.id, covered: true, unit_ids: selectedUnits(facet.unit_ids, catalog).map(unit => unit.id) })), issues: [] }
}
const review = (raw: unknown, plan: Selection) => parseSelectionReview(raw, plan,
  plan.decision === 'answer' ? selectedUnits([...new Set(plan.facets.flatMap(facet => facet.unit_ids))], catalog) : [], catalog, capabilities)
const timingPlan = () => answerPlan([{ text: 'Explain agreement period alignment.', ids: ['U16'] }])

describe('selection-review integration preserves declared verdicts', () => {
  test('accepts a multifacet review with each proof assigned to its own question part', () => {
    const plan = answerPlan([{ text: 'Explain agreement period alignment.', ids: ['U16'] }, { text: 'Explain electricity generation boundaries.', ids: ['U07'] }])
    const raw = rawReview(plan, [[timing()], [generation()]])
    expect(review(raw, plan)).toBe(raw)
    expect(raw.question_parts.map(part => part.support_requirements[0]!.capability_ids)).toEqual([['U16-C01'], ['U07-C02']])
  })

  test('rejects a foreign per-part proof without replacing the raw pass with a revision', () => {
    const plan = answerPlan([{ text: 'Explain agreement period alignment.', ids: ['U16'] }, { text: 'Explain electricity generation boundaries.', ids: ['U07'] }])
    const raw = rawReview(plan, [[generation()], [generation()]])
    const before = JSON.stringify(raw)
    expect(() => review(raw, plan)).toThrow('selection_review_invalid')
    expect(JSON.stringify(raw)).toBe(before)
    expect(raw.decision).toBe('pass')
  })

  test('rejects an affirmative pass with one supported and one missing need, leaving the raw review unchanged', () => {
    const plan = timingPlan(), raw = rawReview(plan, [[timing(), missing()]]), before = JSON.stringify(raw)
    expect(() => review(raw, plan)).toThrow('selection_review_invalid')
    expect(JSON.stringify(raw)).toBe(before)
  })

  test('accepts the same missing proof for an explicit whole-question boundary', () => {
    const question = 'Explain a concept absent from this release.'
    const plan = parseSelection({ decision: 'unsupported', reason: 'coverage_missing', facets: [], question_contract: { operation: 'explain',
      parts: [{ id: 'q1', start_token: 0, kind: 'request', resolution: 'coverage_missing', facet_ids: [], context_ids: [] }] } }, question, catalog)
    const raw = rawReview(plan, [[missing()]]), before = JSON.stringify(raw)
    expect(review(raw, plan)).toBe(raw)
    expect(JSON.stringify(raw)).toBe(before)
    expect(raw.facets).toEqual([])
  })

  test('accepts an explicit revision with unresolved missing support and aligned issues unchanged', () => {
    const plan = timingPlan(), raw = rawReview(plan, [[timing(), missing()]])
    raw.decision = 'revise'
    raw.question_parts[0]!.appropriately_resolved = false
    raw.facets[0]!.covered = false
    raw.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'The second declared need has no approved capability.' },
      { code: 'coverage', target_id: 'f1', explanation: 'This selection does not resolve the complete requested part.' }]
    const before = JSON.stringify(raw)
    expect(review(raw, plan)).toBe(raw)
    expect(JSON.stringify(raw)).toBe(before)
    expect(raw.decision).toBe('revise')
  })

  test('accepts a negative review using empty proof when the available capability belongs to another part', () => {
    const plan = answerPlan([{ text: 'Explain a generation boundary.', ids: ['U16'] }, { text: 'Explain another generation boundary.', ids: ['U07'] }])
    const raw = rawReview(plan, [[requirement('conditional_rule', 'generation_boundary')], [generation()]])
    raw.decision = 'revise'
    raw.question_parts[0]!.appropriately_resolved = false
    raw.facets[0]!.covered = false
    raw.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'The selected units for this part lack the required generation capability.' },
      { code: 'coverage', target_id: 'f1', explanation: 'Select a suitable unit for this facet; another facet cannot lend its support.' }]
    const before = JSON.stringify(raw)
    expect(review(raw, plan)).toBe(raw)
    expect(JSON.stringify(raw)).toBe(before)
    expect(raw.question_parts[0]!.support_requirements[0]!.capability_ids).toEqual([])
    expect(raw.question_parts[1]!.support_requirements[0]!.capability_ids).toEqual(['U07-C02'])
  })

  test('a material condition mislabeled background is challenged with faithful false and empty requirements', () => {
    const question = 'For a generation-boundary condition, explain agreement periods.'
    const plan = parseSelection({ decision: 'answer', reason: 'covered', facets: [{ id: 'f1', unit_ids: ['U16'] }], question_contract: { operation: 'explain', parts: [
      { id: 'q1', start_token: 0, kind: 'background', resolution: 'background', facet_ids: [], context_ids: [] },
      { id: 'q2', start_token: 4, kind: 'request', resolution: 'covered', facet_ids: ['f1'], context_ids: [] },
    ] } }, question, catalog)
    const raw = rawReview(plan, [[], [timing()]])
    raw.decision = 'revise'
    raw.question_parts[0]!.faithful = false
    raw.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'This condition is material and must be reclassified in the replacement plan.' }]
    const before = JSON.stringify(raw)
    expect(review(raw, plan)).toBe(raw)
    expect(JSON.stringify(raw)).toBe(before)
    expect(raw.question_parts[0]!.support_requirements).toEqual([])
    raw.question_parts[0]!.support_requirements = [generation()]
    expect(() => review(raw, plan)).toThrow('selection_review_invalid')
  })

  test('an explicit revise cannot excuse a wrong kind/subject or invent aligned issues', () => {
    const plan = timingPlan(), raw = rawReview(plan, [[requirement('limitation', 'agreement_period_alignment', ['U16-C01'])]])
    raw.decision = 'revise'
    raw.question_parts[0]!.appropriately_resolved = false
    raw.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'The requested claim is not supported.' }]
    const before = JSON.stringify(raw)
    expect(() => review(raw, plan)).toThrow('selection_review_invalid')
    expect(JSON.stringify(raw)).toBe(before)
    const unsupportedIssue = rawReview(plan, [[timing()]])
    unsupportedIssue.decision = 'revise'
    unsupportedIssue.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'A revision was requested without any false flag.' }]
    expect(() => review(unsupportedIssue, plan)).toThrow('selection_review_invalid')
  })
})

describe('mixed support IDs retain one exact proof per independent requirement', () => {
  const mixedGeneration = () => requirement('conditional_rule', 'generation_boundary', ['U07-C01', 'U07-C02'])

  test('accepts mixed own kinds in either order while preserving raw proof', () => {
    for (const ids of [['U07-C01', 'U07-C02'], ['U07-C02', 'U07-C01']]) {
      const raw = [requirement('conditional_rule', 'generation_boundary', ids)], before = JSON.stringify(raw)
      expect(() => proof(raw, { ownUnitIds: ['U07'] })).not.toThrow()
      expect(JSON.stringify(raw)).toBe(before)
    }
    expect(() => proof([requirement('conditional_rule', 'factor_update_adjustment', ['U18-C02', 'U18-C01'])], { ownUnitIds: ['U18'] })).not.toThrow()
  })

  test('allows additional own context of a different subject only alongside the exact required match', () => {
    const raw = [requirement('conditional_rule', 'generation_boundary', ['U16-C01', 'U07-C02'])]
    expect(() => proof(raw, { ownUnitIds: ['U16', 'U07'] })).not.toThrow()
    expect(() => proof([requirement('conditional_rule', 'generation_boundary', ['U16-C01'])], { ownUnitIds: ['U16', 'U07'] })).toThrow('selection_review_invalid')
  })

  test('rejects wrong-kind-only proof even when the right subject exists', () => {
    expect(() => proof([requirement('conditional_rule', 'generation_boundary', ['U07-C01'])], { ownUnitIds: ['U07'] })).toThrow('selection_review_invalid')
    expect(() => proof([requirement('conditional_rule', 'generation_boundary', ['U07-C01'])], { ownUnitIds: ['U07'], appropriatelyResolved: false })).toThrow('selection_review_invalid')
  })

  test('matching support never excuses unknown, foreign or duplicate additional IDs', () => {
    for (const ids of [['U07-C02', 'U99-C01'], ['U07-C02', 'U16-C01'], ['U07-C02', 'U07-C02']]) {
      expect(() => proof([requirement('conditional_rule', 'generation_boundary', ids)], { ownUnitIds: ['U07'] })).toThrow('selection_review_invalid')
    }
  })

  test('each independently declared requirement needs its own exact match', () => {
    const first = mixedGeneration()
    expect(() => proof([first, requirement('conditional_rule', 'agreement_period_alignment')], { ownUnitIds: ['U07', 'U16'] })).toThrow('selection_review_invalid')
    expect(() => proof([first, requirement('conditional_rule', 'agreement_period_alignment', ['U07-C01', 'U07-C02'])], { ownUnitIds: ['U07', 'U16'] })).toThrow('selection_review_invalid')
    expect(() => proof([first, timing()], { ownUnitIds: ['U07', 'U16'] })).not.toThrow()
  })

  test('mixed support cannot approve a blocked or unrepresented requirement', () => {
    expect(() => proof([{ ...mixedGeneration(), blocking_limit_ids: ['U07-L01'] }], { ownUnitIds: ['U07'] })).toThrow('selection_review_invalid')
    expect(() => proof([requirement('conditional_rule', 'unrepresented_subject', ['U07-C01', 'U07-C02'])], { ownUnitIds: ['U07'] })).toThrow('selection_review_invalid')
    expect(() => proof([mixedGeneration(), missing()], { ownUnitIds: ['U07'] })).toThrow('selection_review_invalid')
  })

  test('retains explicit boundary and valid negative review semantics', () => {
    expect(() => proof([missing()], { covered: false, ownUnitIds: [] })).not.toThrow()
    expect(() => proof([mixedGeneration(), missing()], { ownUnitIds: ['U07'], appropriatelyResolved: false })).not.toThrow()
    expect(() => proof([{ ...mixedGeneration(), blocking_limit_ids: ['U07-L01'] }], { covered: false, ownUnitIds: [] })).not.toThrow()
  })

  test('selection review accepts mixed own proof unchanged without strengthening its declared verdict', () => {
    const plan = answerPlan([{ text: 'Explain electricity generation boundaries.', ids: ['U07'] }])
    const raw = rawReview(plan, [[mixedGeneration()]]), before = JSON.stringify(raw)
    expect(review(raw, plan)).toBe(raw)
    expect(JSON.stringify(raw)).toBe(before)
    const negative = rawReview(plan, [[mixedGeneration(), missing()]])
    negative.decision = 'revise'
    negative.question_parts[0]!.appropriately_resolved = false
    negative.facets[0]!.covered = false
    negative.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'A second independent requirement is not represented.' },
      { code: 'coverage', target_id: 'f1', explanation: 'The selected units do not resolve the complete requested part.' }]
    const negativeBefore = JSON.stringify(negative)
    expect(review(negative, plan)).toBe(negative)
    expect(JSON.stringify(negative)).toBe(negativeBefore)
    expect(negative.decision).toBe('revise')
  })

  test('a multifacet pass cannot borrow an additional context ID from another part', () => {
    const plan = answerPlan([{ text: 'Explain electricity generation boundaries.', ids: ['U07'] }, { text: 'Explain agreement period alignment.', ids: ['U16'] }])
    const raw = rawReview(plan, [[requirement('conditional_rule', 'generation_boundary', ['U07-C02', 'U16-C01'])], [timing()]]), before = JSON.stringify(raw)
    expect(() => review(raw, plan)).toThrow('selection_review_invalid')
    expect(JSON.stringify(raw)).toBe(before)
    expect(raw.decision).toBe('pass')
  })
})


describe('Exact source-route targets', () => {
  test('every released route is matched by its action and subject, not by another route target', () => {
    const routes = capabilities.units.flatMap(unit => unit.capabilities.filter(cap => cap.kind === 'source_route').map(cap => ({ unit_id: unit.unit_id, cap })))
    expect(routes.length).toBeGreaterThan(3)
    for (const requested of routes) for (const offered of routes) {
      const needed = requirement('source_route', requested.cap.subject, [offered.cap.id])
      expect(capabilityMatchesRequirement(needed, offered.cap)).toBe(requested.cap.subject === offered.cap.subject)
      if (requested.cap.subject === offered.cap.subject) expect(() => proof([needed], { ownUnitIds: [offered.unit_id] })).not.toThrow()
      else expect(() => proof([needed], { ownUnitIds: [offered.unit_id] })).toThrow('selection_review_invalid')
    }
  })
  test('matching conceptual wording style alone cannot supply a route, and a foreign exact route cannot be borrowed', () => {
    expect(() => proof([requirement('source_route', 'activity_records', ['U04-C01'])], { ownUnitIds: ['U04'] })).toThrow('selection_review_invalid')
    expect(() => proof([requirement('source_route', 'grid_factor_source', ['U09-C01'])], { ownUnitIds: ['U04'] })).toThrow('selection_review_invalid')
    expect(() => proof([requirement('source_route', 'unrepresented_subject', ['U09-C01'])], { ownUnitIds: ['U09'] })).toThrow('selection_review_invalid')
    expect(() => proof([requirement('source_route', 'grid_factor_source', ['U09-C01'], ['U09-L01'])], { ownUnitIds: ['U09'] })).toThrow('selection_review_invalid')
  })
})

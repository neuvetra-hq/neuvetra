import { planTestInput } from './test-plan-input';
import { LEGACY_CAPABILITY_SHA as CAPABILITY_SHA, parseCapabilities, capabilityInput, type SupportRequirement } from './capabilities'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { hash, parsePassageRelease, PassageError } from '../research-passages/release'
import { CloudError } from '../research-cloud/repository'
import type { CloudEvidence, CloudRepository } from '../research-cloud/types'
import type { AttemptBudget } from '../research-cloud/budget'
import type { ComposedStageEvent } from './provider'
import { parseUnitCatalog, resolveUnitClosure, selectedUnits, titleTextCharacters, SOURCE_SHA, type UnitCatalog } from './catalog'
import { analyzeSelectionSize, parseSelection, parseSelectionReview, reviewIssuesNestedWireBytes, selectionReviewIssueBudget, type Selection, type SelectionReview } from './selection'
import { composedRequestBody, createComposedProvider, type ComposedStage } from './provider'
import { createComposedAnswerService } from './answer'
import { analysisInput } from './question-analysis'
import { questionFragment, questionIndex, questionTokens, type QuestionContract } from './question-contract'

// The source and QA reviewers approved these actual bytes separately. Altered
// catalog cases below are in-memory adversarial fixtures, never approvals.
const CATALOG_SHA = 'adb43b8a9e90cbe85f382988dedc16e16f82f7a596e0bcf5f5e98ba2f84630cd'
const NOW = Date.parse('2026-09-12T12:00:00Z')
const catalogBytes = readFileSync(new URL('../../../../data/research/answer-units/scope2-website.epa-inquiry.v1.json', import.meta.url))
const releaseBytes = readFileSync(new URL('../../../../data/research/releases/scope2-website.v1.json', import.meta.url))
const release = parsePassageRelease(JSON.parse(releaseBytes.toString()), NOW)
const verified = { release, passages: release.passages, sha256: SOURCE_SHA }
const catalog = parseUnitCatalog(catalogBytes, CATALOG_SHA, verified, NOW).catalog
const capabilityBytes = readFileSync(new URL('../../../../data/research/capabilities/scope2-website.epa-inquiry.v1.json', import.meta.url))
const capabilities = parseCapabilities(capabilityBytes, CAPABILITY_SHA, catalog, CATALOG_SHA, NOW)
// These mock proofs establish parser shape only, never natural-language semantics.
const mockRequirements = (part: { kind: string; resolution: string; facet_ids: string[] }, plan: { facets: { id: string; unit_ids: string[] }[] }): SupportRequirement[] => {
  if (part.kind === 'background') return []
  const own = plan.facets.filter(f => part.facet_ids.includes(f.id)).flatMap(f => selectedUnits(f.unit_ids, catalog).map(u => u.id))
  const cap = capabilities.units.find(u => own.includes(u.unit_id))?.capabilities[0]
  return cap ? [{ kind: cap.kind, subject: cap.subject, capability_ids: [cap.id], blocking_limit_ids: [] }] : [{ kind: 'explanation', subject: 'unrepresented_subject', capability_ids: [], blocking_limit_ids: [] }]
}
const binding = { scopeId: 'test-scope-c', buildId: 'test-build', namespace: 'test-namespace', releaseId: release.release_id, releaseVersion: release.version, releaseSha256: SOURCE_SHA, profileSha256: 'test-profile', sourceSha256: release.sources.map(s => s.sha256) }
const cloud: CloudEvidence = { verified, binding, candidateIds: ['S01'] }
const question = 'Explain electricity reporting and records.'
// Legacy semantic fixtures retain explicit expected server-derived ends. This
// fixture adapter emits the new start-only planner proposal; direct wire-shape
// rejection and boundary construction are tested in question-contract.test.ts.
const proposal = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || !('question_contract' in value)) return value
  const raw = value as Selection
  if (!raw.question_contract || !Array.isArray(raw.question_contract.parts)) return value
  return { ...raw, question_contract: { ...raw.question_contract, parts: raw.question_contract.parts.map(part => {
    if (!part || typeof part !== 'object') return part
    const { end_token: _expectedEnd, ...wire } = part
    return wire
  }) } }
}
const contract = (input = question): QuestionContract => ({ operation: 'explain', parts: [{ id: 'q1', start_token: 0, end_token: questionTokens(input).length, kind: 'request', resolution: 'covered', facet_ids: ['f1'], context_ids: [] }] })
const selection = (ids = ['U03'], input = question): Selection => ({ question_contract: contract(input), decision: 'answer', reason: 'covered', facets: [{ id: 'f1', unit_ids: ids }] })
const refusal = (reason: 'action_out_of_scope' | 'coverage_missing' | 'context_required' = 'action_out_of_scope', input = question): Selection => ({ question_contract: { ...contract(input), parts: [{ id: 'q1', start_token: 0, end_token: questionTokens(input).length, kind: reason === 'context_required' ? 'ambiguous_reference' : 'request', resolution: reason, facet_ids: [], context_ids: reason === 'context_required' ? ['referenced_subject'] : [] }] }, decision: reason === 'context_required' ? 'needs_input' : 'unsupported', reason, facets: [] })
const unitSet = (plan: Selection) => plan.decision === 'answer' ? selectedUnits([...new Set(plan.facets.flatMap(f => f.unit_ids))], catalog) : []
const pass = (plan = selection()): SelectionReview => ({ decision: 'pass', decomposition_complete: true, relevant: true, scope_appropriate: true, context_appropriate: true, premise_handled: true, task_fit: true, proportionate: true, question_parts: plan.question_contract.parts.map(p => ({ id: p.id, faithful: true, appropriately_resolved: true, support_requirements: mockRequirements(p, plan) })),
  facets: plan.facets.map(f => ({ id: f.id, covered: true, unit_ids: selectedUnits(f.unit_ids, catalog).map(u => u.id) })), issues: [] })
const revise = (plan = selection()): SelectionReview => ({ ...pass(plan), decision: 'revise', premise_handled: false, issues: [{ code: 'premise', target_id: 'answer', explanation: 'The selected explanation does not correct the material premise.' }] })
const changed = (edit: (value: UnitCatalog) => void) => { const value = structuredClone(catalog); edit(value); const bytes = Buffer.from(JSON.stringify(value)); return { value, bytes, sha: hash(bytes) } }

// Predeclared parser fixtures only: these types/proofs do not establish the
// meaning of a question. Analysis is fixed before any mocked plan or repair.
const analysisFixture = (p = selection()) => ({ operation: p.question_contract.operation, parts: p.question_contract.parts.map(part => ({
  id: part.id, start_token: part.start_token, kind: part.kind,
  requirements: mockRequirements(part, p).map(({ kind, subject }) => ({ kind, subject })),
  ambiguity_context_ids: [...part.context_ids],
})) })
const sourcePlan = (value: unknown): unknown => {
  if (value && typeof value === 'object' && 'alternative_selection' in value && Array.isArray(value.alternative_selection)) return { ...value, alternative_selection: value.alternative_selection.map(sourcePlan) }
  if (!value || typeof value !== 'object' || !('question_contract' in value)) return value
  const p = value as Selection
  if (!p.question_contract || !Array.isArray(p.question_contract.parts)) return value
  // These known canonical fixtures carry expected aggregate fields; the v6 mock wire omits them.
  const { decision: _expectedDecision, reason: _expectedReason, ...wire } = p
  return { ...wire, question_contract: { parts: p.question_contract.parts.map(({ id, resolution, facet_ids, context_ids }) => ({
    id, resolution: resolution === 'covered' ? 'source_available' : resolution === 'not_answered' ? 'withheld' : resolution, facet_ids, context_ids,
  })) } }
}
const sourceReview = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || !('question_parts' in value)) return value
  const v = value as SelectionReview
  if (!Array.isArray(v.question_parts)) return value
  return { ...v, question_parts: v.question_parts.map(({ support_requirements, ...part }) => ({ ...part,
    requirements: support_requirements.map(({ capability_ids, blocking_limit_ids }, i) => ({ id: `${part.id}-r${i + 1}`, capability_ids, blocking_limit_ids })), additional_requirements: [],
  })) }
}
function harness(outputs: unknown[] = [], options: { repository?: Partial<CloudRepository>; now?: () => number; remaining?: number; deadlineMs?: number; bytes?: Uint8Array; sha?: string; invoke?: (stage: ComposedStage, input: unknown, signal: AbortSignal) => Promise<unknown> } = {}) {
  const calls: { stage: ComposedStage; input: unknown }[] = [], loads: string[] = [], rechecks: unknown[] = []
  const fixtureAnalysis = (input: unknown) => {
    const original = (input as { original_question: string }).original_question
    const fixture = outputs.find(value => { try { parseSelection(proposal(value), original, catalog); return true } catch { return false } }) as Selection | undefined
    return analysisFixture(fixture ?? selection())
  }
  const repository: CloudRepository = { loadForQuestion: async q => { loads.push(q); return cloud }, recheck: async b => { rechecks.push(b) }, ...options.repository }
  const service = createComposedAnswerService({ repository, capabilityBytes, capabilitySha256: CAPABILITY_SHA, catalogBytes: options.bytes ?? catalogBytes, catalogSha256: options.sha ?? CATALOG_SHA, now: options.now ?? (() => NOW), deadlineMs: options.deadlineMs,
    provider: { model: 'offline-test-model', remaining: () => (options.remaining ?? 20) - calls.length, invoke: async (stage, input, signal) => {
      calls.push({ stage, input })
      const value = options.invoke ? await options.invoke(stage, input, signal) : stage === 'analyze' ? fixtureAnalysis(input) : outputs.shift()
      return stage === 'plan' ? sourcePlan(value) : stage === 'verify' ? sourceReview(value) : value
    } } })
  return { service, calls, loads, rechecks }
}

describe('Reviewed catalog trust boundary', () => {
  test('actual approved content has fixed pins, frozen units and complete required companions', () => {
    expect(hash(releaseBytes)).toBe(SOURCE_SHA)
    expect(hash(catalogBytes)).toBe(CATALOG_SHA)
    expect(catalog.units).toHaveLength(23)
    expect(Object.isFrozen(catalog.units[0])).toBe(true)
    expect(Object.isFrozen(catalog.units[0]!.support)).toBe(true)
    expect(selectedUnits(['U03'], catalog).map(u => u.id)).toEqual(['U01', 'U02', 'U03'])
  })
  test('a changed text cannot reuse the trusted digest; candidate or unreviewed catalogs cannot load', () => {
    const altered = changed(v => { v.units[0]!.text = 'Invented reporting obligations must be followed.' })
    expect(() => parseUnitCatalog(altered.bytes, CATALOG_SHA, verified, NOW)).toThrow('unit_catalog_invalid')
    for (const edit of [
      (v: UnitCatalog) => { v.review.status = 'candidate' },
      (v: UnitCatalog) => { v.review.source_review = null },
      (v: UnitCatalog) => { v.review.qa_review = v.review.source_review },
      (v: UnitCatalog) => { v.review.qa_review = { reviewer: 'other', reviewed_at: '2099-01-01T00:00:00Z', disposition: 'approved_private' } },
      (v: UnitCatalog) => { v.source_release_sha256 = '0'.repeat(64) },
      (v: UnitCatalog) => { v.condition_catalog_sha256 = '0'.repeat(64) },
    ]) { const x = changed(edit); expect(() => parseUnitCatalog(x.bytes, x.sha, verified, NOW)).toThrow('unit_catalog_invalid') }
    expect(() => parseUnitCatalog(catalogBytes, CATALOG_SHA, { ...verified, sha256: 'f'.repeat(64) }, NOW)).toThrow('unit_catalog_invalid')
  })
  test('catalog deadline cannot expire or exceed the source review deadline', () => {
    for (const date of ['2026-09-12T12:00:00Z', '2026-09-16T00:00:00Z', 'not-a-date']) {
      const x = changed(v => { v.review.expires_at = date })
      expect(() => parseUnitCatalog(x.bytes, x.sha, verified, NOW)).toThrow('unit_catalog_stale')
    }
  })
  test('own exact anchors and complete source dependency closure are mandatory', () => {
    for (const edit of [
      (v: UnitCatalog) => { v.units[0]!.support[0]!.quote = 'A quotation that does not occur in the source.' },
      (v: UnitCatalog) => { v.units[0]!.support[0]!.passage_id = 'S18' },
      (v: UnitCatalog) => { v.units[1]!.passage_ids = ['S02']; v.units[1]!.support = v.units[1]!.support.filter(s => s.passage_id === 'S02') },
      (v: UnitCatalog) => { v.units[1]!.support = v.units[1]!.support.filter(s => s.passage_id !== 'S01') },
    ]) { const x = changed(edit); expect(() => parseUnitCatalog(x.bytes, x.sha, verified, NOW)).toThrow('unit_catalog_invalid') }
  })
  test('unknown companions, dependency cycles and prohibited numerical result text refuse', () => {
    const foreign = changed(v => { v.units[0]!.required_unit_ids = ['U99'] })
    expect(() => parseUnitCatalog(foreign.bytes, foreign.sha, verified, NOW)).toThrow('selection_invalid')
    const cycle = changed(v => { v.units[0]!.required_unit_ids = ['U03'] })
    expect(() => parseUnitCatalog(cycle.bytes, cycle.sha, verified, NOW)).toThrow('unit_catalog_invalid')
    const numeric = changed(v => { v.units[0]!.text = 'The emission factor is zero kilograms CO2e per kWh.' })
    expect(() => parseUnitCatalog(numeric.bytes, numeric.sha, verified, NOW)).toThrow('numeric_output_not_allowed')
  })
  test('neutral catalog order and deduplicated closure do not depend on model ordering', () => {
    expect(selectedUnits(['U03', 'U01'], catalog).map(u => u.id)).toEqual(['U01', 'U02', 'U03'])
    expect(selectedUnits(['U01', 'U03'], catalog)).toEqual(selectedUnits(['U03'], catalog))
    const comparison = selectedUnits(['U13', 'U09'], catalog)
    expect(comparison.map(u => u.id)).toEqual(['U07', 'U08', 'U09', 'U10', 'U13', 'U16', 'U20'])
    expect(comparison.reduce((n, u) => n + u.text.length + u.title.length, 0)).toBeLessThanOrEqual(4000)
  })
  test('count and text caps refuse the whole composition instead of dropping companions', () => {
    expect(() => selectedUnits(['U03', 'U09', 'U13'], catalog)).toThrow('selection_too_large')
    const long = changed(v => { v.units.slice(0, 5).forEach(u => { u.text = 'x'.repeat(850) }) })
    expect(() => selectedUnits(['U01', 'U02', 'U03', 'U04', 'U05'], long.value)).toThrow('selection_too_large')
  })
})

describe('ID-only selection and independent coverage review', () => {
  test('source ranges preserve exact Unicode and whitespace without requiring model copies', () => {
    for (const input of ['  Explain\tgrid\r\nrecords.  ', 'Explain the meter’s “current estimate” and \u2018reviewed records\u2019.', 'A😀 e\u0301 — B.']) {
      const plan = selection(['U03'], input);
      expect(parseSelection(proposal(plan), input, catalog)).toEqual(plan);
      expect(questionFragment(input, plan.question_contract.parts[0]!)).toBe(input);
      expect(questionIndex(input).tokens.map(pair => pair[1]).join('')).toBe(input);
    }
  })
  test('unknown IDs, model prose, duplicate or extra fields, malformed or empty facets fail', () => {
    const valid = selection()
    for (const raw of [null, { ...valid, answer: 'You must report because EPA says so.' }, selection(['U99']), selection(['U01', 'U01']),
      { ...valid, facets: [] }, { ...valid, facets: [...valid.facets, ...valid.facets] },
      { ...valid, facets: [{ ...valid.facets[0], text: 'Invented text.' }] },
      { ...valid, facets: [{ ...valid.facets[0], id: 'f2' }] },
      { ...valid, facets: [{ ...valid.facets[0], question_fragment: 'invented question clause' }] },
    ]) expect(() => parseSelection(proposal(raw), question, catalog)).toThrow()
    expect(parseSelection(proposal(valid), question, catalog)).toEqual(valid)
  })
  test('refusal shape has no claims and reason must match its decision', () => {
    expect(parseSelection(proposal(refusal()), question, catalog).facets).toEqual([])
    expect(() => parseSelection(proposal({ ...refusal(), facets: selection().facets }), question, catalog)).toThrow()
    expect(() => parseSelection(proposal({ ...refusal(), reason: 'covered' }), question, catalog)).toThrow()
    expect(() => parseSelection(proposal({ decision: 'needs_input', reason: 'action_out_of_scope', facets: [] }), question, catalog)).toThrow()
  })
  test('every returned facet and companion must match the exact selected unit closure', () => {
    const plan = selection(), units = unitSet(plan)
    for (const edit of [
      (v: SelectionReview) => { v.facets = [] },
      (v: SelectionReview) => { v.facets[0]!.unit_ids = ['U03'] },
      (v: SelectionReview) => { v.facets[0]!.unit_ids.push('U99') },
      (v: SelectionReview) => { v.facets[0]!.id = 'f2' },
    ]) { const v = pass(plan); edit(v); expect(() => parseSelectionReview(v, plan, units, catalog, capabilities)).toThrow('selection_review_invalid') }
  })
  test('review verdicts and issues must align, including missing facets and premise correction', () => {
    const plan = selection(), units = unitSet(plan)
    expect(parseSelectionReview(revise(plan), plan, units, catalog, capabilities).decision).toBe('revise')
    const cases = [ { ...pass(plan), decision: 'revise' }, { ...revise(plan), decision: 'pass' }, { ...revise(plan), issues: [] },
      { ...pass(plan), issues: revise(plan).issues }, { ...revise(plan), issues: [{ code: 'scope', target_id: 'answer', explanation: 'Wrong flag.' }] },
      { ...pass(plan), facets: [{ ...pass(plan).facets[0], covered: false }], decision: 'fail', issues: [] } ]
    for (const raw of cases) expect(() => parseSelectionReview(raw, plan, units, catalog, capabilities)).toThrow('selection_review_invalid')
  })
  test('an independently reviewed correct refusal can pass; an unneeded refusal can require revision', () => {
    const plan = refusal()
    expect(parseSelectionReview(pass(plan), plan, [], catalog, capabilities).decision).toBe('pass')
    const wrong = { ...pass(plan), decision: 'revise', scope_appropriate: false, issues: [{ code: 'scope', target_id: 'answer', explanation: 'The catalog covers this conceptual request.' }] }
    expect(parseSelectionReview(wrong, plan, [], catalog, capabilities).decision).toBe('revise')
  })
})

describe('Complete question and requested operation contract', () => {
  const conditional = 'If the records are incomplete, explain electricity reporting.'
  const conditionalPlan = (): Selection => ({ ...selection(['U03'], conditional), question_contract: { operation: 'explain', parts: [
    { id: 'q1', start_token: 0, end_token: 5, kind: 'condition', resolution: 'covered', facet_ids: ['f1'], context_ids: [] },
    { id: 'q2', start_token: 5, end_token: 8, kind: 'request', resolution: 'covered', facet_ids: ['f1'], context_ids: [] },
  ] } })
  test('omitted, reordered, altered or overlapping conditions cannot pass an otherwise valid facet', () => {
    const p = conditionalPlan()
    expect(parseSelection(proposal(p), conditional, catalog)).toEqual(p)
    for (const edit of [
      (x: Selection) => { x.question_contract.parts = [{ ...x.question_contract.parts[1]!, id: 'q1' }] },
      (x: Selection) => { x.question_contract.parts.reverse(); x.question_contract.parts.forEach((p,i) => p.id = `q${i+1}`) },
      (x: Selection) => { x.question_contract.parts[0]!.start_token = 0.5 },
      (x: Selection) => { x.question_contract.parts[1]!.start_token = 0 },
      (x: Selection) => { x.question_contract.parts[0]!.facet_ids = ['f99'] },
      (x: Selection) => { x.question_contract.parts[0]!.facet_ids = [] },
      (x: Selection) => { Object.assign(x.question_contract.parts[0]!, { generated_answer: 'Invented conclusion' }) },
    ]) {
      const x = structuredClone(p); edit(x)
      expect(() => parseSelection(proposal(x), conditional, catalog)).toThrow('selection_invalid')
      x.facets[0]!.unit_ids = ['U03', 'U09', 'U13']
      expect(analyzeSelectionSize(proposal(x), conditional, catalog)).toBeNull()
    }
  })
  test('independent part review can reject a condition mislabeled as background despite complete bytes', async () => {
    // This demonstrates rejection of an adverse reviewer verdict, not that a
    // model will always detect semantic misclassification in actual questions.
    const p = conditionalPlan()
    Object.assign(p.question_contract.parts[0]!, { kind: 'background', resolution: 'background', facet_ids: [] })
    expect(parseSelection(proposal(p), conditional, catalog)).toEqual(p)
    const v = pass(p); v.decision = 'fail'; v.question_parts[0]!.faithful = false
    v.issues = [{ code: 'question_part', target_id: 'q1', explanation: 'The condition changes the requested conclusion and cannot be treated as background.' }]
    const h = harness([p, v]), a = await h.service.answer(conditional)
    expect(h.calls).toHaveLength(3); expect(a.status).toBe('needs_review'); expect(a.claims).toEqual([])
    expect(() => parseSelectionReview({ ...v, issues: [] }, p, unitSet(p), catalog, capabilities)).toThrow('selection_review_invalid')
  })
  test('task fit and proportionality are independent checks and cannot be silently approved', async () => {
    const p = selection(); p.question_contract.operation = 'prepare_inquiry'
    const bad = pass(p); bad.decision = 'fail'; bad.task_fit = false; bad.proportionate = false
    bad.issues = [
      { code: 'task_fit', target_id: 'answer', explanation: 'The background does not supply reviewed information requests.' },
      { code: 'proportionality', target_id: 'answer', explanation: 'The selection assumes an unmentioned product type.' },
    ]
    const h = harness([p, bad]), a = await h.service.answer(question)
    expect(a.reason_code).toBe('selection_not_verified'); expect(a.claims).toEqual([])
    for (const raw of [{ ...bad, decision: 'pass' }, { ...bad, issues: bad.issues.slice(0,1) }, { ...pass(p), question_parts: [] }])
      expect(() => parseSelectionReview(raw, p, unitSet(p), catalog, capabilities)).toThrow('selection_review_invalid')
  })
  test('known missing coverage preserves whole-question refusal without denying useful background', async () => {
    const input = 'Explain electricity reporting and evaluate the unavailable rule.'
    const p: Selection = { ...refusal('coverage_missing', input), question_contract: { operation: 'explain', parts: [
      { id: 'q1', start_token: 0, end_token: 3, kind: 'request', resolution: 'not_answered', facet_ids: [], context_ids: [] },
      { id: 'q2', start_token: 3, end_token: 8, kind: 'request', resolution: 'coverage_missing', facet_ids: [], context_ids: [] },
    ] } }
    const h = harness([p, pass(p)]), a = await h.service.answer(input)
    expect(h.calls).toHaveLength(3); expect(a.reason_code).toBe('coverage_missing'); expect(a.claims).toEqual([])
    expect(a.scope_gaps).toEqual([{ question_fragment: questionFragment(input, p.question_contract.parts[1]!), reason: 'coverage_missing', context_ids: [] }])
    expect(() => parseSelection(proposal({ ...p, decision: 'answer', reason: 'covered' }), input, catalog)).toThrow('selection_invalid')
  })
  test('clarification selects the unresolved referent rather than default company data', async () => {
    const input = 'Explain the effect of that requirement.'
    const p = refusal('context_required', input)
    p.question_contract.parts[0]!.context_ids = ['referenced_requirement']
    const h = harness([p, pass(p)]), a = await h.service.answer(input)
    expect(a.status).toBe('needs_input'); expect(a.missing_context).toEqual(['referenced_requirement'])
    expect(a.scope_gaps[0]!.context_ids).toEqual(['referenced_requirement']); expect(a.claims).toEqual([])
    for (const edit of [
      (x: Selection) => { x.question_contract.parts[0]!.context_ids = [] },
      (x: Selection) => { x.question_contract.parts[0]!.context_ids = ['customer_secret' as never] },
      (x: Selection) => { x.question_contract.parts[0]!.resolution = 'coverage_missing'; x.reason = 'coverage_missing'; x.decision = 'unsupported'; x.question_contract.parts[0]!.context_ids = [] },
    ]) { const x = structuredClone(p); edit(x); expect(() => parseSelection(proposal(x), input, catalog)).toThrow('selection_invalid') }
  })
  test('a known coverage gap remains distinct from a simultaneous reference ambiguity', async () => {
    const input = 'Explain that requirement and the unsupported target method.'
    const p: Selection = { ...refusal('coverage_missing', input), question_contract: { operation: 'explain', parts: [
      { id: 'q1', start_token: 0, end_token: 3, kind: 'ambiguous_reference', resolution: 'context_required', facet_ids: [], context_ids: ['referenced_requirement'] },
      { id: 'q2', start_token: 3, end_token: 8, kind: 'request', resolution: 'coverage_missing', facet_ids: [], context_ids: [] },
    ] } }
    const h = harness([p, pass(p)]), a = await h.service.answer(input)
    expect(a.status).toBe('unsupported'); expect(a.missing_context).toEqual([])
    expect(a.scope_gaps.map(g => g.reason)).toEqual(['context_required', 'coverage_missing'])
    expect(() => parseSelection(proposal({ ...p, reason: 'context_required', decision: 'needs_input' }), input, catalog)).toThrow('selection_invalid')
  })
  test('excluded execution cannot become an answer because conceptual units exist', () => {
    for (const operation of ['calculate', 'submit_or_file'] as const) {
      const p = selection(); p.question_contract.operation = operation
      expect(() => parseSelection(proposal(p), question, catalog)).toThrow('selection_invalid')
      const no = refusal(); no.question_contract.operation = operation
      expect(parseSelection(proposal(no), question, catalog)).toEqual(no)
    }
  })
  test('every question part needs an aligned independent verdict, and invented diagnostics cannot render', () => {
    const p = conditionalPlan(), v = pass(p)
    for (const raw of [
      { ...v, question_parts: v.question_parts.slice(0,1) },
      { ...v, question_parts: [...v.question_parts].reverse() },
      { ...v, question_parts: [null, v.question_parts[1]] },
      { ...v, issues: [{ code: 'question_part', target_id: 'q1', explanation: 'An unsupported diagnosis' }] },
      { ...v, question_parts: [{ ...v.question_parts[0], appropriately_resolved: false }, v.question_parts[1]] },
    ]) expect(() => parseSelectionReview(raw, p, unitSet(p), catalog, capabilities)).toThrow('selection_review_invalid')
  })
})

describe('Composed service release boundary', () => {
  test('known processing limits produce truthful messages without a connection retry or another stage', async () => {
    for (const code of ['provider_truncated', 'context_limit'] as const) {
      const h = harness([], { invoke: async () => { throw new PassageError(code) } }), value = await h.service.answer(question)
      expect(value.reason_code).toBe(code); expect(value.status).toBe('needs_review'); expect(value.claims).toEqual([])
      expect(value.message).toContain('processing limit')
      expect(value.message).not.toContain('connection'); expect(value.message).not.toContain('try again')
      expect(h.calls).toHaveLength(1); expect(value.correction_attempted).toBe(false)
    }
  })
  test('three stages release only exact reviewed text and labels after cloud rechecking', async () => {
    const p = selection(), h = harness([p, pass(p)]), value = await h.service.answer(question)
    expect(value.status).toBe('qualified')
    expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify'])
    expect(h.calls[0]!.input).toEqual(analysisInput(question))
    expect(h.calls[1]!.input).not.toHaveProperty('question_index')
    expect(h.calls[2]!.input).not.toHaveProperty('question_index')
    expect(h.loads).toEqual([question]); expect(h.rechecks).toEqual([binding])
    expect(value.claims.map(c => c.text)).toEqual(unitSet(p).map(u => u.text))
    expect(value.composition?.units).toEqual(unitSet(p).map(({ id, title, type }) => ({ id, title, type })))
    expect(value.composition?.wording).toBe('reviewed_verbatim')
    expect(value.composition?.sha256).toBe(CATALOG_SHA)
    expect(value.correction_attempted).toBe(false)
  })
  test('one whole-selection repair has at most five stages and a fresh independent review', async () => {
    const first = selection(['U01']), second = selection(['U03'])
    const h = harness([first, revise(first), second, pass(second)]), value = await h.service.answer(question)
    expect(value.status).toBe('qualified'); expect(value.correction_attempted).toBe(true)
    expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify', 'plan', 'verify'])
    expect((h.calls[3]!.input as any).question_analysis).toEqual((h.calls[1]!.input as any).question_analysis)
    expect((h.calls[4]!.input as any).question_analysis).toEqual((h.calls[1]!.input as any).question_analysis)
    expect(h.calls[3]!.input).toHaveProperty('correction_packet')
    expect(h.calls[4]!.input).not.toHaveProperty('correction_packet')
    expect(JSON.stringify(h.calls[4]!.input)).not.toContain('does not correct the material premise')
    expect(value.claims.map(c => c.id)).toEqual(['U01', 'U02', 'U03'])
  })
  test('failed correction and malformed review stop; injected planner prose gets only the shared structural correction', async () => {
    const p = selection()
    for (const [outputs, count, kind] of [ [[p, revise(p), p, revise(p)], 4, 'source_review'], [[p, { ...pass(p), text: 'Invented answer.' }], 2, null], [[{ ...p, text: 'Invented answer.' }, { ...p, text: 'Invented answer.' }], 2, 'selection_contract'] ] as [unknown[], number, 'source_review' | 'selection_contract' | null][]) {
      const h = harness(outputs), value = await h.service.answer(question)
      expect(value.claims).toEqual([]); expect(value.composition).toBeNull(); expect(value.retrieval).toBeNull()
      expect(h.calls).toHaveLength(count + 1)
      expect(value.correction_attempted).toBe(kind !== null)
      expect(value.correction_kind).toBe(kind)
    }
  })
  test('unsupported and context boundaries are independently reviewed and source-rechecked', async () => {
    for (const p of [refusal(), refusal('context_required')]) {
      const h = harness([p, pass(p)]), value = await h.service.answer(question)
      expect(value.status).toBe(p.decision === 'needs_input' ? 'needs_input' : 'unsupported')
      expect(h.calls).toHaveLength(3); expect(h.rechecks).toHaveLength(1)
      expect(value.claims).toEqual([]); expect(value.composition).toBeNull()
    }
  })
  test('cloud failure or identity-refresh failure prevents all model stages', async () => {
    for (const code of ['cloud_provider_unavailable', 'cloud_identity_unavailable', 'cloud_membership_invalid'] as const) {
      const h = harness([], { repository: { loadForQuestion: async () => { throw new CloudError(code) } } })
      const value = await h.service.answer(question)
      expect(value.reason_code).toBe(code); expect(value.claims).toEqual([]); expect(h.calls).toHaveLength(0)
    }
  })
  test('changed build or expired source at final recheck withholds a previously approved selection', async () => {
    for (const code of ['cloud_build_changed', 'cloud_source_stale', 'cloud_unauthorized'] as const) {
      const p = selection(), h = harness([p, pass(p)], { repository: { recheck: async () => { throw new CloudError(code) } } })
      const value = await h.service.answer(question)
      expect(value.reason_code).toBe(code); expect(value.claims).toEqual([]); expect(value.composition).toBeNull(); expect(h.calls).toHaveLength(3)
    }
  })
  test('insufficient allowance and pre-cancelled callers do not reach cloud or models', async () => {
    const noBudget = harness([], { remaining: 3 })
    expect((await noBudget.service.answer(question)).reason_code).toBe('budget_exhausted')
    expect(noBudget.loads).toEqual([]); expect(noBudget.calls).toEqual([])
    const cancelled = harness(), controller = new AbortController(); controller.abort()
    expect((await cancelled.service.answer(question, controller.signal)).reason_code).toBe('request_cancelled')
    expect(cancelled.loads).toEqual([])
  })
  test('budget exhaustion during verification fails closed without retry', async () => {
    const p = selection(), h = harness([], { invoke: async stage => { if (stage === 'analyze') return analysisFixture(p); if (stage === 'verify') throw new PassageError('budget_exhausted'); return p } })
    const value = await h.service.answer(question)
    expect(value.reason_code).toBe('budget_exhausted'); expect(value.claims).toEqual([]); expect(h.calls).toHaveLength(3)
  })
  test('cancellation holds the in-flight lock until pending work settles and starts no later stage', async () => {
    let releaseCall!: (value: unknown) => void
    const pending = new Promise(resolve => { releaseCall = resolve })
    const h = harness([], { invoke: async () => pending }), controller = new AbortController()
    const answer = h.service.answer(question, controller.signal)
    await Promise.resolve(); controller.abort()
    expect((await answer).reason_code).toBe('request_cancelled')
    expect((await h.service.answer(question)).reason_code).toBe('request_in_progress')
    releaseCall(selection()); await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.calls).toHaveLength(1); expect(h.rechecks).toEqual([])
  })
  test('timeout returns no partial answer and prevents stages after late completion', async () => {
    let releaseCall!: (value: unknown) => void
    const h = harness([], { deadlineMs: 5, invoke: async () => new Promise(resolve => { releaseCall = resolve }) })
    const value = await h.service.answer(question)
    expect(value.reason_code).toBe('request_timeout'); expect(value.claims).toEqual([])
    releaseCall(selection()); await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.calls).toHaveLength(1)
  })
  test('cancellation during reselection retains the consumed correction and never starts its final review', async () => {
    let releaseThird!: (value: unknown) => void, enteredThird!: () => void, call = 0
    const started = new Promise<void>(resolve => { enteredThird = resolve })
    const p = selection(), controller = new AbortController()
    const h = harness([], { invoke: async stage => {
      if (stage === 'analyze') return analysisFixture(p)
      call++
      if (call === 1) return p
      if (call === 2) return revise(p)
      return new Promise(resolve => { releaseThird = resolve; enteredThird() })
    } })
    const pending = h.service.answer(question, controller.signal)
    await started; controller.abort()
    const value = await pending
    expect(value.reason_code).toBe('request_cancelled'); expect(value.correction_attempted).toBe(true)
    expect(value.correction_kind).toBe('source_review'); expect(value.claims).toEqual([])
    releaseThird(p); await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify', 'plan']); expect(h.rechecks).toEqual([])
  })
  test('catalog expiry during model review cannot be hidden by a still-current source', async () => {
    let clock = Date.parse(catalog.review.expires_at) - 1000
    const p = selection(), h = harness([], { now: () => clock, invoke: async stage => { if (stage === 'analyze') return analysisFixture(p); if (stage === 'verify') { clock += 2000; return pass(p) } return p } })
    const value = await h.service.answer(question)
    expect(value.reason_code).toBe('unit_catalog_stale'); expect(value.claims).toEqual([])
  })
  test('status must not report ready after the unit review deadline expires', async () => {
    let clock = Date.parse(catalog.review.expires_at) - 1000
    const h = harness([], { now: () => clock })
    await h.service.initialize(); clock += 2000
    const status = await h.service.status()
    expect(status.readiness).toBe('unavailable'); expect(status.reason_code).toBe('unit_catalog_stale')
  })
})

function memoryBudget(): AttemptBudget & { reservations: { stage: string; digest: string }[] } {
  const reservations: { stage: string; digest: string }[] = []
  return { maxCalls: 20, reservations, remaining: () => 20 - reservations.length, reserve: (stage, digest) => { reservations.push({ stage, digest }); return reservations.length } }
}
const wire = (stage: ComposedStage, output: unknown) => ({ model: stage === 'plan' ? 'claude-sonnet-5' : 'claude-opus-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(output) }] })

describe('Bounded whole-selection size repair', () => {
  const oversized = () => selection(['U03', 'U09', 'U13'])
  test('a fully valid known-ID plan has exact union diagnostics without truncating its units', () => {
    const raw = oversized(), before = JSON.stringify(raw), closure = resolveUnitClosure(raw.facets[0]!.unit_ids, catalog)
    expect(() => parseSelection(proposal(raw), question, catalog)).toThrow('selection_too_large')
    const packet = analyzeSelectionSize(proposal(raw), question, catalog)!
    expect(packet.kind).toBe('selection_size'); expect(packet.previous_selection).toEqual(raw)
    expect(packet.closure_unit_ids).toEqual(closure.map(u => u.id)); expect(packet.closure_unit_ids.length).toBeGreaterThan(8)
    expect(packet.closure_title_text_characters).toBe(titleTextCharacters(closure))
    expect(packet.limits).toEqual({ maxUnits: 8, maxTitleTextCharacters: 4000 })
    expect(JSON.stringify(raw)).toBe(before)
    expect(analyzeSelectionSize(proposal(selection()), question, catalog)).toBeNull()
    expect(analyzeSelectionSize(proposal(refusal()), question, catalog)).toBeNull()
  })
  test('character-only overflow is repairable; every later facet still validates before size classification', () => {
    const fixture = changed(v => v.units.slice(0, 5).forEach(u => { u.text = 'x'.repeat(850) }))
    const raw = selection(['U01', 'U02', 'U03', 'U04', 'U05'])
    const packet = analyzeSelectionSize(proposal(raw), question, fixture.value)!
    expect(packet.closure_unit_ids).toHaveLength(5); expect(packet.closure_title_text_characters).toBeGreaterThan(4000)
    for (const bad of [
      { id: 'f2', question_fragment: 'records', unit_ids: ['U99'] },
      { id: 'f2', question_fragment: 'records', unit_ids: ['U01', 'U01'] },
      { id: 'f2', question_fragment: 'records', unit_ids: ['U01'], text: 'Injected prose' },
      { id: 'f2', question_fragment: 'not in the question', unit_ids: ['U01'] },
      null,
    ]) {
      const candidate = { ...oversized(), facets: [...oversized().facets, bad] }
      expect(() => parseSelection(proposal(candidate), question, catalog)).toThrow('selection_invalid')
      expect(analyzeSelectionSize(proposal(candidate), question, catalog)).toBeNull()
    }
  })
  test('direct selections over eight IDs are classified only after all IDs and companions are checked', () => {
    const many = selection(catalog.units.slice(0, 9).map(u => u.id))
    expect(() => parseSelection(proposal(many), question, catalog)).toThrow('selection_too_large')
    expect(analyzeSelectionSize(proposal(many), question, catalog)).not.toBeNull()
    many.facets[0]!.unit_ids[8] = 'U99'
    expect(() => parseSelection(proposal(many), question, catalog)).toThrow('selection_invalid')
    expect(analyzeSelectionSize(proposal(many), question, catalog)).toBeNull()
  })
  test('each model catalog card receives the complete exact server-computed companion cost', async () => {
    const p = selection(), h = harness([p, pass(p)])
    await h.service.answer(question)
    const input = h.calls[1]!.input as { unit_catalog: { id: string; closure_unit_ids: string[]; closure_title_text_characters: number }[] }
    expect(input.unit_catalog).toHaveLength(catalog.units.length)
    for (const card of input.unit_catalog) {
      const closure = resolveUnitClosure([card.id], catalog)
      expect(card.closure_unit_ids).toEqual(closure.map(u => u.id))
      expect(card.closure_title_text_characters).toBe(titleTextCharacters(closure))
    }
    expect(() => composedRequestBody('plan', input)).not.toThrow()
  })
  test('size-only whole reselection takes four stages and receives a fresh review without repair history', async () => {
    const repaired = selection(), h = harness([oversized(), { bundle_id: 'manual', alternative_selection: [repaired] }, pass(repaired)])
    const value = await h.service.answer(question)
    expect(value.status).toBe('qualified'); expect(value.correction_kind).toBe('selection_size'); expect(value.correction_attempted).toBe(true)
    expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'plan', 'verify'])
    expect(h.calls[2]!.input).toHaveProperty('correction_packet.kind', 'selection_size')
    expect(h.calls[3]!.input).not.toHaveProperty('correction_packet')
    expect(JSON.stringify(h.calls[3]!.input)).not.toContain('previous_selection_trust')
    expect(value.claims.map(c => c.text)).toEqual(unitSet(repaired).map(u => u.text))
    expect(h.rechecks).toEqual([binding])
  })
  test('size and semantic repair share one allowance; repeated overflow or failed review cannot trigger another', async () => {
    const p = selection()
    for (const [outputs, count, kind, reason] of [
      [[oversized(), { bundle_id: 'manual', alternative_selection: [oversized()] }], 2, 'selection_size', 'selection_too_large'],
      [[oversized(), { bundle_id: 'manual', alternative_selection: [p] }, revise(p)], 3, 'selection_size', 'selection_not_verified'],
      [[p, revise(p), oversized()], 3, 'source_review', 'selection_too_large'],
    ] as [unknown[], number, 'selection_size' | 'source_review', string][]) {
      const h = harness(outputs), value = await h.service.answer(question)
      expect(value.status).toBe('needs_review'); expect(value.reason_code).toBe(reason)
      expect(value.correction_kind).toBe(kind); expect(value.correction_attempted).toBe(true)
      expect(h.calls).toHaveLength(count + 1); expect(value.claims).toEqual([]); expect(h.rechecks).toEqual([])
    }
  })
  test('malformed later facets use structural diagnosis, never size repair or an unvalidated review', async () => {
    const raw = { ...oversized(), facets: [...oversized().facets, { id: 'f2', question_fragment: 'records', unit_ids: ['U99'] }] }
    const h = harness([raw, raw]), value = await h.service.answer(question)
    expect(value.status).toBe('needs_review'); expect(value.reason_code).toBe('selection_invalid')
    expect(value.correction_attempted).toBe(true); expect(value.correction_kind).toBe('selection_contract'); expect(h.calls).toHaveLength(3)
  })
  test('malformed nested coverage output is a review failure, not a connection failure', async () => {
    const p = selection(), h = harness([p, { ...pass(p), facets: [null] }]), value = await h.service.answer(question)
    expect(value.status).toBe('needs_review'); expect(value.reason_code).toBe('selection_review_invalid'); expect(h.calls).toHaveLength(3)
  })
  test('cancellation while size reselection is pending retains its metadata and starts no review', async () => {
    let releaseCall!: (value: unknown) => void, started!: () => void, calls = 0
    const entered = new Promise<void>(resolve => { started = resolve }), controller = new AbortController()
    const h = harness([], { invoke: async stage => { if (stage === 'analyze') return analysisFixture(); if (++calls === 1) return oversized(); return new Promise(resolve => { releaseCall = resolve; started() }) } })
    const pending = h.service.answer(question, controller.signal)
    await entered; controller.abort()
    const value = await pending
    expect(value.reason_code).toBe('request_cancelled'); expect(value.correction_kind).toBe('selection_size'); expect(value.correction_attempted).toBe(true)
    expect((await h.service.answer(question)).reason_code).toBe('request_in_progress')
    releaseCall(selection()); await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'plan']); expect(h.rechecks).toEqual([])
  })
  test('size-reselected answers still fail on expired explanations and final source drift', async () => {
    let clock = Date.parse(catalog.review.expires_at) - 1000, calls = 0
    const p = selection()
    const h = harness([], { now: () => clock, invoke: async stage => {
      if (stage === 'analyze') return analysisFixture(p)
      calls++; if (calls === 1) return oversized(); if (calls === 2) return { bundle_id: 'manual', alternative_selection: [p] }; clock += 2000; return pass(p)
    } })
    const expired = await h.service.answer(question)
    expect(expired.reason_code).toBe('unit_catalog_stale'); expect(expired.correction_kind).toBe('selection_size'); expect(expired.claims).toEqual([])
    const drift = harness([oversized(), { bundle_id: 'manual', alternative_selection: [p] }, pass(p)], { repository: { recheck: async () => { throw new CloudError('cloud_build_changed') } } })
    expect((await drift.service.answer(question)).reason_code).toBe('cloud_build_changed'); expect(drift.calls).toHaveLength(4)
  })
  test('private diagnostic bounds accept 2000 characters intact and reject 2001 without truncation', () => {
    const p = selection(), review = revise(p)
    review.issues[0]!.explanation = 'x'.repeat(2000)
    expect(parseSelectionReview(review, p, unitSet(p), catalog, capabilities).issues[0]!.explanation).toHaveLength(2000)
    review.issues[0]!.explanation += 'x'
    expect(() => parseSelectionReview(review, p, unitSet(p), catalog, capabilities)).toThrow('selection_review_invalid')
    expect(review.issues[0]!.explanation).toHaveLength(2001)
  })
  const embeddedIssueBytes = (issues: SelectionReview['issues']) => Buffer.byteLength(JSON.stringify({ content: JSON.stringify({ issues }) }), 'utf8')
    - Buffer.byteLength(JSON.stringify({ content: JSON.stringify({ issues: [] }) }), 'utf8') + 2
  const issueBoundary = (fill: string, target = 8192): SelectionReview['issues'] => {
    const issues = Array.from({ length: 4 }, () => ({ code: 'premise', target_id: 'answer', explanation: 'a' }))
    for (const issue of issues) {
      let low = 0, high = Math.floor(1999 / fill.length)
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        issue.explanation = 'a' + fill.repeat(middle)
        if (embeddedIssueBytes(issues) <= target) low = middle; else high = middle - 1
      }
      issue.explanation = 'a' + fill.repeat(low)
    }
    const remainder = target - embeddedIssueBytes(issues)
    const last = issues.find(i => i.explanation.length + remainder <= 2000)!
    last.explanation += 'a'.repeat(remainder)
    return issues
  }
  test('aggregate issue budget measures exact nested UTF8 for ASCII, four-byte Unicode, quotes and backslashes at the boundary', () => {
    expect(selectionReviewIssueBudget.maximum_nested_wire_utf8_bytes).toBe(8192)
    for (const fill of ['x', '😀', '"', '\\']) {
      const p = selection(), review = revise(p)
      for (const target of [8191, 8192]) {
        review.issues = issueBoundary(fill, target)
        expect(review.issues.every(i => i.explanation.length <= 2000)).toBe(true)
        expect(embeddedIssueBytes(review.issues)).toBe(target)
        expect(reviewIssuesNestedWireBytes(review.issues)).toBe(target)
        const original = JSON.stringify(review)
        expect(parseSelectionReview(review, p, unitSet(p), catalog, capabilities).issues).toEqual(review.issues)
        expect(JSON.stringify(review)).toBe(original)
      }
      review.issues.find(i => i.explanation.length < 2000)!.explanation += 'a'
      expect(embeddedIssueBytes(review.issues)).toBe(8193)
      const original = JSON.stringify(review)
      expect(() => parseSelectionReview(review, p, unitSet(p), catalog, capabilities)).toThrow('selection_review_invalid')
      expect(JSON.stringify(review)).toBe(original)
    }
    const p = selection(), review = revise(p)
    review.issues = Array.from({ length: 25 }, () => ({ code: 'premise', target_id: 'answer', explanation: 'a' }))
    expect(parseSelectionReview(review, p, unitSet(p), catalog, capabilities).issues).toHaveLength(25)
    review.issues.push({ ...review.issues[0]! })
    expect(() => parseSelectionReview(review, p, unitSet(p), catalog, capabilities)).toThrow('selection_review_invalid')
  })
  test('oversized review stops the service before correction while exact-boundary review reaches one unchanged correction', async () => {
    for (const fill of ['x', '😀', '"', '\\']) {
      const p = selection(), review = revise(p)
      review.issues = issueBoundary(fill)
      review.issues.find(i => i.explanation.length < 2000)!.explanation += 'a'
      const before = JSON.stringify(review), h = harness([p, review, p, pass(p)])
      const result = await h.service.answer(question)
      expect(result.reason_code).toBe('selection_review_invalid')
      expect(result.correction_attempted).toBe(false)
      expect(result.claims).toEqual([])
      expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify'])
      expect(JSON.stringify(review)).toBe(before)
    }
    const p = selection(), review = revise(p); review.issues = issueBoundary('"')
    const h = harness([p, review, p, pass(p)]), result = await h.service.answer(question)
    expect(result.status).toBe('qualified')
    expect(h.calls.map(c => c.stage)).toEqual(['analyze', 'plan', 'verify', 'plan', 'verify'])
    const correction = h.calls[3]!.input as any
    expect(correction.correction_packet.review.issues).toEqual(review.issues)
    const empty = structuredClone(correction); empty.correction_packet.review.issues = []
    const actualBytes = Buffer.byteLength(composedRequestBody('plan', correction)) - Buffer.byteLength(composedRequestBody('plan', empty)) + 2
    expect(actualBytes).toBe(8192)
    const prompt = JSON.parse(composedRequestBody('verify', {})).system as string
    expect(prompt).toContain('8192 UTF-8 bytes')
    expect(prompt).toContain('hard maximum 2000')
    expect(prompt).toContain('Up to 25')
  })
  test('both stage requests carry the general whole-question, actual-causation and excluded-action policy', () => {
    // This proves policy delivery, not live model compliance; independent live
    // coverage evaluation remains necessary after the implementation freeze.
    for (const stage of ['plan', 'verify'] as const) {
      const system: string = JSON.parse(composedRequestBody(stage, planTestInput())).system
      expect(system).toContain('General or hypothetical questions about possible drivers')
      expect(system).toContain('actual cause of a particular company outcome cannot be done from general guidance alone')
      expect(system).toContain('whole-question refusal is correct even when other facets are covered')
      expect(system).toContain('must not demand a partial answer or nonempty answer facets')
      expect(system).toContain('Do not override a correct planner boundary by substituting a qualified explanatory answer')
    }
  })
})

describe('Composed provider transport', () => {
  test('an oversized evidence and diagnostic packet reserves nothing and is never trimmed or sent', async () => {
    const budget = memoryBudget(), events: ComposedStageEvent[] = []; let fetches = 0
    const provider = createComposedProvider({ apiKey: 'offline', budget, onStage: event => events.push(event), fetch: async () => { fetches++; throw new Error('must not send') } })
    const input = { ...planTestInput('a '.repeat(999) + 'a?'), question_index: questionIndex('a '.repeat(999) + 'a?'), capability_catalog_sha256: CAPABILITY_SHA,
      unit_catalog: catalog.units.map(unit => ({ ...unit, ...capabilityInput(capabilities, unit.id) })),
      correction_packet: { review: { issues: Array.from({ length: 25 }, (_, i) => ({ code: 'question_part', target_id: `q${i % 12 + 1}`, explanation: 'x'.repeat(2000) })) } } }
    const before = JSON.stringify(input)
    await expect(provider.invoke('plan', input, new AbortController().signal)).rejects.toThrow('context_limit')
    expect(budget.reservations).toEqual([]); expect(fetches).toBe(0); expect(events).toEqual([])
    expect(JSON.stringify(input)).toBe(before)
  })
  test('bounded ID-only request grammar has no drafting stage or truncating preflight', () => {
    const body = JSON.parse(composedRequestBody('plan', planTestInput(question)))
    expect(body.model).toBe('claude-sonnet-5'); expect(body.thinking.type).toBe('disabled')
    expect(body.output_config.format.schema.additionalProperties).toBe(false)
    expect(Object.keys(body.output_config.format.schema.properties)).toEqual(['question_contract', 'facets'])
    expect(() => composedRequestBody('verify', { question: '漢'.repeat(30000) })).toThrow('context_limit')
  })
  test('reserves before fixed-destination I/O and never logs secrets or retries transport failure', async () => {
    const budget = memoryBudget(), events: ComposedStageEvent[] = []; let count = 0
    const provider = createComposedProvider({ apiKey: 'offline-only-private-key', budget, onStage: e => events.push(e), fetch: async (url, init) => {
      count++; expect(budget.reservations).toHaveLength(1); expect(url).toBe('https://api.anthropic.com/v1/messages'); expect(init.redirect).toBe('error')
      throw new Error('offline-only-private-key provider payload')
    } })
    await expect(provider.invoke('plan', planTestInput(question), new AbortController().signal)).rejects.toThrow('provider_failure')
    expect(count).toBe(1); expect(budget.reservations).toHaveLength(1)
    expect(budget.reservations[0]!.digest).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(events)).not.toContain('offline-only-private-key')
  })
  test('wrong model, truncation, extra output blocks and oversized response cannot release JSON', async () => {
    const variants = [ { ...wire('verify', {}), model: 'other-model' }, { ...wire('verify', {}), stop_reason: 'max_tokens' },
      { ...wire('verify', {}), content: [{ type: 'text', text: '{}' }, { type: 'text', text: '{}' }] },
      { ...wire('verify', {}), content: [{ type: 'tool_use' }] },
      { ...wire('verify', {}), content: [{ type: 'text', text: 'x'.repeat(260000) }] } ]
    for (const raw of variants) {
      const budget = memoryBudget(), provider = createComposedProvider({ apiKey: 'offline', budget, fetch: async () => Response.json(raw) })
      await expect(provider.invoke('verify', {}, new AbortController().signal)).rejects.toThrow(raw.stop_reason === 'max_tokens' ? 'provider_truncated' : 'provider_failure')
      expect(budget.reservations).toHaveLength(1)
    }
  })
  test('thinking and unrelated usage fields never enter recorded stage output', async () => {
    const events: ComposedStageEvent[] = [], raw = { ...wire('verify', pass()), content: [{ type: 'thinking', thinking: 'private-thought-marker', signature: 'private-signature' }, ...wire('verify', pass()).content], usage: { input_tokens: 10, output_tokens: 20, extra: 'private-extra' } }
    const provider = createComposedProvider({ apiKey: 'offline', budget: memoryBudget(), onStage: e => events.push(e), fetch: async () => Response.json(raw) })
    expect(await provider.invoke('verify', {}, new AbortController().signal)).toEqual(pass())
    expect(events).toHaveLength(2); expect(events[1]!.usage).toEqual({ input_tokens: 10, output_tokens: 20 })
    expect(JSON.stringify(events)).not.toContain('private-thought-marker'); expect(JSON.stringify(events)).not.toContain('private-signature'); expect(JSON.stringify(events)).not.toContain('private-extra')
  })
  test('a concurrent or pre-cancelled request cannot reserve or make another network call', async () => {
    const budget = memoryBudget(); let finish!: (response: Response) => void
    const provider = createComposedProvider({ apiKey: 'offline', budget, fetch: async () => new Promise(resolve => { finish = resolve }) })
    const first = provider.invoke('plan', planTestInput(), new AbortController().signal)
    await expect(provider.invoke('plan', planTestInput(), new AbortController().signal)).rejects.toThrow('request_in_progress')
    const controller = new AbortController(); controller.abort()
    await expect(provider.invoke('plan', planTestInput(), controller.signal)).rejects.toThrow('request_cancelled')
    expect(budget.reservations).toHaveLength(1)
    finish(Response.json(wire('plan', refusal()))); expect(await first).toEqual(refusal())
  })
})

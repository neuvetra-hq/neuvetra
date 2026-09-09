import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { hash, parsePassageRelease, PassageError } from '../research-passages/release'
import { CloudError } from '../research-cloud/repository'
import type { CloudEvidence, CloudRepository } from '../research-cloud/types'
import type { AttemptBudget } from '../research-cloud/budget'
import type { StageEvent } from '../research-cloud/provider'
import { parseUnitCatalog, resolveUnitClosure, selectedUnits, titleTextCharacters, SOURCE_SHA, type UnitCatalog } from './catalog'
import { analyzeSelectionSize, parseSelection, parseSelectionReview, type Selection, type SelectionReview } from './selection'
import { composedRequestBody, createComposedProvider, type ComposedStage } from './provider'
import { createComposedAnswerService } from './answer'

// The source and QA reviewers approved these actual bytes separately. Altered
// catalog cases below are in-memory adversarial fixtures, never approvals.
const CATALOG_SHA = 'c59ffac9c6e824b81174aac7f52bf3a36dfed516a7340ff40ff8ba758518ef1f'
const NOW = Date.parse('2026-09-12T12:00:00Z')
const catalogBytes = readFileSync(new URL('../../../../data/research/answer-units/scope2-website.v1.json', import.meta.url))
const releaseBytes = readFileSync(new URL('../../../../data/research/releases/scope2-website.v1.json', import.meta.url))
const release = parsePassageRelease(JSON.parse(releaseBytes.toString()), NOW)
const verified = { release, passages: release.passages, sha256: SOURCE_SHA }
const catalog = parseUnitCatalog(catalogBytes, CATALOG_SHA, verified, NOW).catalog
const binding = { scopeId: 'test-scope-c', buildId: 'test-build', namespace: 'test-namespace', releaseId: release.release_id, releaseVersion: release.version, releaseSha256: SOURCE_SHA, profileSha256: 'test-profile', sourceSha256: release.sources.map(s => s.sha256) }
const cloud: CloudEvidence = { verified, binding, candidateIds: ['S01'] }
const question = 'Explain electricity reporting and records.'
const selection = (ids = ['U03']): Selection => ({ decision: 'answer', reason: 'covered', facets: [{ id: 'f1', question_fragment: 'electricity reporting', unit_ids: ids }] })
const refusal = (): Selection => ({ decision: 'unsupported', reason: 'action_out_of_scope', facets: [] })
const unitSet = (plan: Selection) => plan.decision === 'answer' ? selectedUnits([...new Set(plan.facets.flatMap(f => f.unit_ids))], catalog) : []
const pass = (plan = selection()): SelectionReview => ({ decision: 'pass', decomposition_complete: true, relevant: true, scope_appropriate: true, context_appropriate: true, premise_handled: true,
  facets: plan.facets.map(f => ({ id: f.id, covered: true, unit_ids: selectedUnits(f.unit_ids, catalog).map(u => u.id) })), issues: [] })
const revise = (plan = selection()): SelectionReview => ({ ...pass(plan), decision: 'revise', premise_handled: false, issues: [{ code: 'premise', target_id: 'answer', explanation: 'The selected explanation does not correct the material premise.' }] })
const changed = (edit: (value: UnitCatalog) => void) => { const value = structuredClone(catalog); edit(value); const bytes = Buffer.from(JSON.stringify(value)); return { value, bytes, sha: hash(bytes) } }

function harness(outputs: unknown[] = [], options: { repository?: Partial<CloudRepository>; now?: () => number; remaining?: number; deadlineMs?: number; bytes?: Uint8Array; sha?: string; invoke?: (stage: ComposedStage, input: unknown, signal: AbortSignal) => Promise<unknown> } = {}) {
  const calls: { stage: ComposedStage; input: unknown }[] = [], loads: string[] = [], rechecks: unknown[] = []
  const repository: CloudRepository = { loadForQuestion: async q => { loads.push(q); return cloud }, recheck: async b => { rechecks.push(b) }, ...options.repository }
  const service = createComposedAnswerService({ repository, catalogBytes: options.bytes ?? catalogBytes, catalogSha256: options.sha ?? CATALOG_SHA, now: options.now ?? (() => NOW), deadlineMs: options.deadlineMs,
    provider: { model: 'offline-test-model', remaining: () => (options.remaining ?? 20) - calls.length, invoke: async (stage, input, signal) => { calls.push({ stage, input }); return options.invoke ? options.invoke(stage, input, signal) : outputs.shift() } } })
  return { service, calls, loads, rechecks }
}

describe('Reviewed catalog trust boundary', () => {
  test('actual approved content has fixed pins, frozen units and complete required companions', () => {
    expect(hash(releaseBytes)).toBe(SOURCE_SHA)
    expect(hash(catalogBytes)).toBe(CATALOG_SHA)
    expect(catalog.units).toHaveLength(22)
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
  test('question fragments accept only straight and curly quote equivalence without rewriting either input', () => {
    // Mechanical quote fixtures are not greenhouse-gas semantic acceptance cases.
    const curly = 'Explain the meter\u2019s \u201ccurrent estimate\u201d and \u2018reviewed records\u2019.'
    const straight = 'Explain the meter\'s "current estimate" and \'reviewed records\'.'
    const fragment = (text: string, ids = ['U03']): Selection => ({ ...selection(ids), facets: [{ id: 'f1', question_fragment: text, unit_ids: ids }] })
    for (const [input, excerpt] of [[curly, straight.slice(8, -1)], [straight, curly.slice(8, -1)], [curly, curly.slice(8, -1)], [straight, straight.slice(8, -1)]]) {
      const plan = fragment(excerpt!), before = structuredClone(plan)
      expect(parseSelection(plan, input!, catalog)).toEqual(before)
      expect(plan).toEqual(before)
      const oversized = fragment(excerpt!, ['U03', 'U09', 'U13'])
      expect(analyzeSelectionSize(oversized, input!, catalog)?.previous_selection).toEqual(oversized)
    }
    const input = 'Explain the meter\u2019s currently approved estimate and dated records.'
    for (const excerpt of [
      "the meter's currently rejected estimate", // Changed word.
      "the meter's Currently approved estimate", // Changed case.
      "the meter's approved estimate", // An internal qualifier was removed.
      "the meter's currently approved dated records", // Noncontiguous pieces.
      "the meter's  currently approved estimate", // Whitespace is not normalized.
      'the meter\u02bcs currently approved estimate', // Other apostrophe-like code points stay distinct.
    ]) {
      expect(() => parseSelection(fragment(excerpt), input, catalog)).toThrow('selection_invalid')
      expect(analyzeSelectionSize(fragment(excerpt, ['U03', 'U09', 'U13']), input, catalog)).toBeNull()
    }
  })
  test('unknown IDs, model prose, duplicate or extra fields, malformed or empty facets fail', () => {
    const valid = selection()
    for (const raw of [null, { ...valid, answer: 'You must report because EPA says so.' }, selection(['U99']), selection(['U01', 'U01']),
      { ...valid, facets: [] }, { ...valid, facets: [...valid.facets, ...valid.facets] },
      { ...valid, facets: [{ ...valid.facets[0], text: 'Invented text.' }] },
      { ...valid, facets: [{ ...valid.facets[0], id: 'f2' }] },
      { ...valid, facets: [{ ...valid.facets[0], question_fragment: 'invented question clause' }] },
    ]) expect(() => parseSelection(raw, question, catalog)).toThrow()
    expect(parseSelection(valid, question, catalog)).toEqual(valid)
  })
  test('refusal shape has no claims and reason must match its decision', () => {
    expect(parseSelection(refusal(), question, catalog).facets).toEqual([])
    expect(() => parseSelection({ ...refusal(), facets: selection().facets }, question, catalog)).toThrow()
    expect(() => parseSelection({ ...refusal(), reason: 'covered' }, question, catalog)).toThrow()
    expect(() => parseSelection({ decision: 'needs_input', reason: 'action_out_of_scope', facets: [] }, question, catalog)).toThrow()
  })
  test('every returned facet and companion must match the exact selected unit closure', () => {
    const plan = selection(), units = unitSet(plan)
    for (const edit of [
      (v: SelectionReview) => { v.facets = [] },
      (v: SelectionReview) => { v.facets[0]!.unit_ids = ['U03'] },
      (v: SelectionReview) => { v.facets[0]!.unit_ids.push('U99') },
      (v: SelectionReview) => { v.facets[0]!.id = 'f2' },
    ]) { const v = pass(plan); edit(v); expect(() => parseSelectionReview(v, plan, units, catalog)).toThrow('selection_review_invalid') }
  })
  test('review verdicts and issues must align, including missing facets and premise correction', () => {
    const plan = selection(), units = unitSet(plan)
    expect(parseSelectionReview(revise(plan), plan, units, catalog).decision).toBe('revise')
    const cases = [ { ...pass(plan), decision: 'revise' }, { ...revise(plan), decision: 'pass' }, { ...revise(plan), issues: [] },
      { ...pass(plan), issues: revise(plan).issues }, { ...revise(plan), issues: [{ code: 'scope', target_id: 'answer', explanation: 'Wrong flag.' }] },
      { ...pass(plan), facets: [{ ...pass(plan).facets[0], covered: false }], decision: 'fail', issues: [] } ]
    for (const raw of cases) expect(() => parseSelectionReview(raw, plan, units, catalog)).toThrow('selection_review_invalid')
  })
  test('an independently reviewed correct refusal can pass; an unneeded refusal can require revision', () => {
    const plan = refusal()
    expect(parseSelectionReview(pass(plan), plan, [], catalog).decision).toBe('pass')
    const wrong = { ...pass(plan), decision: 'revise', scope_appropriate: false, issues: [{ code: 'scope', target_id: 'answer', explanation: 'The catalog covers this conceptual request.' }] }
    expect(parseSelectionReview(wrong, plan, [], catalog).decision).toBe('revise')
  })
})

describe('Composed service release boundary', () => {
  test('two stages release only exact reviewed text and labels after cloud rechecking', async () => {
    const p = selection(), h = harness([p, pass(p)]), value = await h.service.answer(question)
    expect(value.status).toBe('qualified')
    expect(h.calls.map(c => c.stage)).toEqual(['plan', 'verify'])
    expect(h.loads).toEqual([question]); expect(h.rechecks).toEqual([binding])
    expect(value.claims.map(c => c.text)).toEqual(unitSet(p).map(u => u.text))
    expect(value.composition?.units).toEqual(unitSet(p).map(({ id, title, type }) => ({ id, title, type })))
    expect(value.composition?.wording).toBe('reviewed_verbatim')
    expect(value.composition?.sha256).toBe(CATALOG_SHA)
    expect(value.correction_attempted).toBe(false)
  })
  test('one whole-selection repair has at most four stages and a fresh independent review', async () => {
    const first = selection(['U01']), second = selection(['U03'])
    const h = harness([first, revise(first), second, pass(second)]), value = await h.service.answer(question)
    expect(value.status).toBe('qualified'); expect(value.correction_attempted).toBe(true)
    expect(h.calls.map(c => c.stage)).toEqual(['plan', 'verify', 'plan', 'verify'])
    expect(h.calls[2]!.input).toHaveProperty('correction_packet')
    expect(h.calls[3]!.input).not.toHaveProperty('correction_packet')
    expect(JSON.stringify(h.calls[3]!.input)).not.toContain('does not correct the material premise')
    expect(value.claims.map(c => c.id)).toEqual(['U01', 'U02', 'U03'])
  })
  test('failed correction, malformed review and injected answer prose never gain another attempt', async () => {
    const p = selection()
    for (const [outputs, count] of [ [[p, revise(p), p, revise(p)], 4], [[p, { ...pass(p), text: 'Invented answer.' }], 2], [[{ ...p, text: 'Invented answer.' }], 1] ] as [unknown[], number][]) {
      const h = harness(outputs), value = await h.service.answer(question)
      expect(value.claims).toEqual([]); expect(value.composition).toBeNull(); expect(value.retrieval).toBeNull()
      expect(h.calls).toHaveLength(count)
      expect(value.correction_attempted).toBe(count === 4)
      expect(value.correction_kind).toBe(count === 4 ? 'source_review' : null)
    }
  })
  test('unsupported and context boundaries are independently reviewed and source-rechecked', async () => {
    for (const p of [refusal(), { decision: 'needs_input', reason: 'context_required', facets: [] } as Selection]) {
      const h = harness([p, pass(p)]), value = await h.service.answer(question)
      expect(value.status).toBe(p.decision === 'needs_input' ? 'needs_input' : 'unsupported')
      expect(h.calls).toHaveLength(2); expect(h.rechecks).toHaveLength(1)
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
      expect(value.reason_code).toBe(code); expect(value.claims).toEqual([]); expect(value.composition).toBeNull(); expect(h.calls).toHaveLength(2)
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
    const p = selection(), h = harness([], { invoke: async stage => { if (stage === 'verify') throw new PassageError('budget_exhausted'); return p } })
    const value = await h.service.answer(question)
    expect(value.reason_code).toBe('budget_exhausted'); expect(value.claims).toEqual([]); expect(h.calls).toHaveLength(2)
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
    const h = harness([], { invoke: async () => {
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
    expect(h.calls.map(c => c.stage)).toEqual(['plan', 'verify', 'plan']); expect(h.rechecks).toEqual([])
  })
  test('catalog expiry during model review cannot be hidden by a still-current source', async () => {
    const x = changed(v => { v.review.expires_at = new Date(NOW + 1000).toISOString() })
    let clock = NOW
    const p = selection(), h = harness([], { bytes: x.bytes, sha: x.sha, now: () => clock, invoke: async stage => { if (stage === 'verify') { clock += 2000; return pass(p) } return p } })
    const value = await h.service.answer(question)
    expect(value.reason_code).toBe('unit_catalog_stale'); expect(value.claims).toEqual([])
  })
  test('status must not report ready after the unit review deadline expires', async () => {
    const x = changed(v => { v.review.expires_at = new Date(NOW + 1000).toISOString() })
    let clock = NOW
    const h = harness([], { bytes: x.bytes, sha: x.sha, now: () => clock })
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
    expect(() => parseSelection(raw, question, catalog)).toThrow('selection_too_large')
    const packet = analyzeSelectionSize(raw, question, catalog)!
    expect(packet.kind).toBe('selection_size'); expect(packet.previous_selection).toEqual(raw)
    expect(packet.closure_unit_ids).toEqual(closure.map(u => u.id)); expect(packet.closure_unit_ids.length).toBeGreaterThan(8)
    expect(packet.closure_title_text_characters).toBe(titleTextCharacters(closure))
    expect(packet.limits).toEqual({ maxUnits: 8, maxTitleTextCharacters: 4000 })
    expect(JSON.stringify(raw)).toBe(before)
    expect(analyzeSelectionSize(selection(), question, catalog)).toBeNull()
    expect(analyzeSelectionSize(refusal(), question, catalog)).toBeNull()
  })
  test('character-only overflow is repairable; every later facet still validates before size classification', () => {
    const fixture = changed(v => v.units.slice(0, 5).forEach(u => { u.text = 'x'.repeat(850) }))
    const raw = selection(['U01', 'U02', 'U03', 'U04', 'U05'])
    const packet = analyzeSelectionSize(raw, question, fixture.value)!
    expect(packet.closure_unit_ids).toHaveLength(5); expect(packet.closure_title_text_characters).toBeGreaterThan(4000)
    for (const bad of [
      { id: 'f2', question_fragment: 'records', unit_ids: ['U99'] },
      { id: 'f2', question_fragment: 'records', unit_ids: ['U01', 'U01'] },
      { id: 'f2', question_fragment: 'records', unit_ids: ['U01'], text: 'Injected prose' },
      { id: 'f2', question_fragment: 'not in the question', unit_ids: ['U01'] },
      null,
    ]) {
      const candidate = { ...oversized(), facets: [...oversized().facets, bad] }
      expect(() => parseSelection(candidate, question, catalog)).toThrow('selection_invalid')
      expect(analyzeSelectionSize(candidate, question, catalog)).toBeNull()
    }
  })
  test('direct selections over eight IDs are classified only after all IDs and companions are checked', () => {
    const many = selection(catalog.units.slice(0, 9).map(u => u.id))
    expect(() => parseSelection(many, question, catalog)).toThrow('selection_too_large')
    expect(analyzeSelectionSize(many, question, catalog)).not.toBeNull()
    many.facets[0]!.unit_ids[8] = 'U99'
    expect(() => parseSelection(many, question, catalog)).toThrow('selection_invalid')
    expect(analyzeSelectionSize(many, question, catalog)).toBeNull()
  })
  test('each model catalog card receives the complete exact server-computed companion cost', async () => {
    const p = selection(), h = harness([p, pass(p)])
    await h.service.answer(question)
    const input = h.calls[0]!.input as { unit_catalog: { id: string; closure_unit_ids: string[]; closure_title_text_characters: number }[] }
    expect(input.unit_catalog).toHaveLength(catalog.units.length)
    for (const card of input.unit_catalog) {
      const closure = resolveUnitClosure([card.id], catalog)
      expect(card.closure_unit_ids).toEqual(closure.map(u => u.id))
      expect(card.closure_title_text_characters).toBe(titleTextCharacters(closure))
    }
    expect(() => composedRequestBody('plan', input)).not.toThrow()
  })
  test('size-only whole reselection takes three stages and receives a fresh review without repair history', async () => {
    const repaired = selection(), h = harness([oversized(), repaired, pass(repaired)])
    const value = await h.service.answer(question)
    expect(value.status).toBe('qualified'); expect(value.correction_kind).toBe('selection_size'); expect(value.correction_attempted).toBe(true)
    expect(h.calls.map(c => c.stage)).toEqual(['plan', 'plan', 'verify'])
    expect(h.calls[1]!.input).toHaveProperty('correction_packet.kind', 'selection_size')
    expect(h.calls[2]!.input).not.toHaveProperty('correction_packet')
    expect(JSON.stringify(h.calls[2]!.input)).not.toContain('previous_selection_trust')
    expect(value.claims.map(c => c.text)).toEqual(unitSet(repaired).map(u => u.text))
    expect(h.rechecks).toEqual([binding])
  })
  test('size and semantic repair share one allowance; repeated overflow or failed review cannot trigger another', async () => {
    const p = selection()
    for (const [outputs, count, kind, reason] of [
      [[oversized(), oversized()], 2, 'selection_size', 'selection_too_large'],
      [[oversized(), p, revise(p)], 3, 'selection_size', 'selection_not_verified'],
      [[p, revise(p), oversized()], 3, 'source_review', 'selection_too_large'],
    ] as [unknown[], number, 'selection_size' | 'source_review', string][]) {
      const h = harness(outputs), value = await h.service.answer(question)
      expect(value.status).toBe('needs_review'); expect(value.reason_code).toBe(reason)
      expect(value.correction_kind).toBe(kind); expect(value.correction_attempted).toBe(true)
      expect(h.calls).toHaveLength(count); expect(value.claims).toEqual([]); expect(h.rechecks).toEqual([])
    }
  })
  test('malformed later facets after an overflow never spend a correction or review call', async () => {
    const raw = { ...oversized(), facets: [...oversized().facets, { id: 'f2', question_fragment: 'records', unit_ids: ['U99'] }] }
    const h = harness([raw]), value = await h.service.answer(question)
    expect(value.status).toBe('needs_review'); expect(value.reason_code).toBe('selection_invalid')
    expect(value.correction_attempted).toBe(false); expect(h.calls).toHaveLength(1)
  })
  test('malformed nested coverage output is a review failure, not a connection failure', async () => {
    const p = selection(), h = harness([p, { ...pass(p), facets: [null] }]), value = await h.service.answer(question)
    expect(value.status).toBe('needs_review'); expect(value.reason_code).toBe('selection_review_invalid'); expect(h.calls).toHaveLength(2)
  })
  test('cancellation while size reselection is pending retains its metadata and starts no review', async () => {
    let releaseCall!: (value: unknown) => void, started!: () => void, calls = 0
    const entered = new Promise<void>(resolve => { started = resolve }), controller = new AbortController()
    const h = harness([], { invoke: async () => { if (++calls === 1) return oversized(); return new Promise(resolve => { releaseCall = resolve; started() }) } })
    const pending = h.service.answer(question, controller.signal)
    await entered; controller.abort()
    const value = await pending
    expect(value.reason_code).toBe('request_cancelled'); expect(value.correction_kind).toBe('selection_size'); expect(value.correction_attempted).toBe(true)
    expect((await h.service.answer(question)).reason_code).toBe('request_in_progress')
    releaseCall(selection()); await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.calls.map(c => c.stage)).toEqual(['plan', 'plan']); expect(h.rechecks).toEqual([])
  })
  test('size-reselected answers still fail on expired explanations and final source drift', async () => {
    let clock = NOW, calls = 0
    const fixture = changed(v => { v.review.expires_at = new Date(NOW + 1000).toISOString() }), p = selection()
    const h = harness([], { bytes: fixture.bytes, sha: fixture.sha, now: () => clock, invoke: async () => {
      calls++; if (calls === 1) return oversized(); if (calls === 2) return p; clock += 2000; return pass(p)
    } })
    const expired = await h.service.answer(question)
    expect(expired.reason_code).toBe('unit_catalog_stale'); expect(expired.correction_kind).toBe('selection_size'); expect(expired.claims).toEqual([])
    const drift = harness([oversized(), p, pass(p)], { repository: { recheck: async () => { throw new CloudError('cloud_build_changed') } } })
    expect((await drift.service.answer(question)).reason_code).toBe('cloud_build_changed'); expect(drift.calls).toHaveLength(3)
  })
  test('private diagnostic bounds accept 2000 characters intact and reject 2001 without truncation', () => {
    const p = selection(), review = revise(p)
    review.issues[0]!.explanation = 'x'.repeat(2000)
    expect(parseSelectionReview(review, p, unitSet(p), catalog).issues[0]!.explanation).toHaveLength(2000)
    review.issues[0]!.explanation += 'x'
    expect(() => parseSelectionReview(review, p, unitSet(p), catalog)).toThrow('selection_review_invalid')
    expect(review.issues[0]!.explanation).toHaveLength(2001)
  })
  test('both stage requests carry the general whole-question, actual-causation and excluded-action policy', () => {
    // This proves policy delivery, not live model compliance; independent live
    // coverage evaluation remains necessary after the implementation freeze.
    for (const stage of ['plan', 'verify'] as const) {
      const system: string = JSON.parse(composedRequestBody(stage, {})).system
      expect(system).toContain('General or hypothetical questions about possible drivers')
      expect(system).toContain('actual cause of a particular company outcome cannot be done from general guidance alone')
      expect(system).toContain('whole-question refusal is correct even when other facets are covered')
      expect(system).toContain('must not demand a partial answer or nonempty answer facets')
      expect(system).toContain('Do not override a correct planner boundary by substituting a qualified explanatory answer')
    }
  })
})

describe('Composed provider transport', () => {
  test('bounded ID-only request grammar has no drafting stage or truncating preflight', () => {
    const body = JSON.parse(composedRequestBody('plan', { question }))
    expect(body.model).toBe('claude-sonnet-5'); expect(body.thinking.type).toBe('disabled')
    expect(body.output_config.format.schema.additionalProperties).toBe(false)
    expect(Object.keys(body.output_config.format.schema.properties)).toEqual(['decision', 'reason', 'facets'])
    expect(() => composedRequestBody('verify', { question: '漢'.repeat(30000) })).toThrow('context_limit')
  })
  test('reserves before fixed-destination I/O and never logs secrets or retries transport failure', async () => {
    const budget = memoryBudget(), events: StageEvent[] = []; let count = 0
    const provider = createComposedProvider({ apiKey: 'offline-only-private-key', budget, onStage: e => events.push(e), fetch: async (url, init) => {
      count++; expect(budget.reservations).toHaveLength(1); expect(url).toBe('https://api.anthropic.com/v1/messages'); expect(init.redirect).toBe('error')
      throw new Error('offline-only-private-key provider payload')
    } })
    await expect(provider.invoke('plan', { question }, new AbortController().signal)).rejects.toThrow('provider_failure')
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
    const events: StageEvent[] = [], raw = { ...wire('verify', pass()), content: [{ type: 'thinking', thinking: 'private-thought-marker', signature: 'private-signature' }, ...wire('verify', pass()).content], usage: { input_tokens: 10, output_tokens: 20, extra: 'private-extra' } }
    const provider = createComposedProvider({ apiKey: 'offline', budget: memoryBudget(), onStage: e => events.push(e), fetch: async () => Response.json(raw) })
    expect(await provider.invoke('verify', {}, new AbortController().signal)).toEqual(pass())
    expect(events).toHaveLength(2); expect(events[1]!.usage).toEqual({ input_tokens: 10, output_tokens: 20 })
    expect(JSON.stringify(events)).not.toContain('private-thought-marker'); expect(JSON.stringify(events)).not.toContain('private-signature'); expect(JSON.stringify(events)).not.toContain('private-extra')
  })
  test('a concurrent or pre-cancelled request cannot reserve or make another network call', async () => {
    const budget = memoryBudget(); let finish!: (response: Response) => void
    const provider = createComposedProvider({ apiKey: 'offline', budget, fetch: async () => new Promise(resolve => { finish = resolve }) })
    const first = provider.invoke('plan', {}, new AbortController().signal)
    await expect(provider.invoke('plan', {}, new AbortController().signal)).rejects.toThrow('request_in_progress')
    const controller = new AbortController(); controller.abort()
    await expect(provider.invoke('plan', {}, controller.signal)).rejects.toThrow('request_cancelled')
    expect(budget.reservations).toHaveLength(1)
    finish(Response.json(wire('plan', refusal()))); expect(await first).toEqual(refusal())
  })
})

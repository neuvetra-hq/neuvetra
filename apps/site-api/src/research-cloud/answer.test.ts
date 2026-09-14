import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createCloudAnswerService } from './answer'
import { parseCloudDraft, parseCloudReview as parseSourceReview, mayCorrect, type CloudClaim, type Review } from './answer-contract'
import { createCloudRoutes } from './routes'
import { dependencyClosure, hash, parsePassageRelease, PassageError } from '../research-passages/release'
import type { CloudEvidence, CloudRepository } from './types'
import type { Plan, Stage } from '../research-passages/types'

const bytes = readFileSync(new URL('../../../../data/research/releases/scope2-passages.v1.json', import.meta.url))
const release = parsePassageRelease(JSON.parse(bytes.toString()), Date.parse('2026-09-09T04:00:00Z'))
const verified = { release, passages: release.passages, sha256: hash(bytes) }
const testCatalog = { schema_version: 1 as const, release_sha256: verified.sha256, reviewed_passage_ids: release.passages.map(p => p.id), conditions: [] }
const parseCloudReview = (raw: unknown, claims: CloudClaim[], facets: Plan['facets']) => parseSourceReview(raw, claims, facets, testCatalog)
const binding = { scopeId: 'scope', buildId: 'build', namespace: 'namespace', releaseId: release.release_id, releaseVersion: release.version, releaseSha256: hash(bytes), profileSha256: 'profile', sourceSha256: release.sources.map(s => s.sha256) }
const evidence: CloudEvidence = { verified, binding, candidateIds: ['S01'] }
const plan: Plan = { action: 'conceptual_research', decision: 'answer', passage_ids: ['S01'], facets: [{ id: 'f1', request: 'Compare methods.', passage_ids: ['S01'] }], missing_context: [] }
const selected = dependencyClosure(['S01'], release.passages)
const passage = selected.find(p => p.id === 'S01')!
const draft = () => ({ answers: [{ facet_id: 'f1', claims: [{ text: 'The guidance distinguishes average grid emissions from contractual electricity-purchasing information.', passage_ids: ['S01'], support: [{ passage_id: 'S01', quote: passage.text.slice(0, 200) }] }] }] })
const claims = () => parseCloudDraft(draft(), selected, plan.facets, [])
export function passingReview(items: CloudClaim[], facets = plan.facets): Review {
  return { decision: 'pass', decomposition_complete: true, complete: true, relevant: true, scope_valid: true, context_sufficient: true,
    facets: facets.map(f => ({ facet_id: f.id, complete: true, supported: true, claim_ids: items.filter(c => c.facet_id === f.id).map(c => c.id) })),
    claims: items.map(c => ({ id: c.id, supported: true, conditions_complete: true, modality_preserved: true, relationships_preserved: true, citations_sufficient: true, passage_ids: c.passage_ids, condition_reviews: [] })), issues: [] }
}
function negative(): Review { const review = passingReview(claims()); review.decision = 'fail'; review.claims[0]!.conditions_complete = false; review.issues = [{ target_id: 'c1', code: 'condition', explanation: 'A necessary source condition is absent.' }]; return review }
function harness(outputs: unknown[], options: { repository?: Partial<CloudRepository>; deadlineMs?: number; remaining?: number; invoke?: (stage: Stage, input: unknown, signal: AbortSignal) => Promise<unknown> } = {}) {
  const calls: { stage: Stage; input: unknown }[] = [], loads: string[] = [], rechecks: unknown[] = []
  const repository: CloudRepository = { loadForQuestion: async q => { loads.push(q); return evidence }, recheck: async b => { rechecks.push(b) }, ...options.repository }
  const service = createCloudAnswerService({ repository, conditionCatalog: testCatalog, deadlineMs: options.deadlineMs, provider: { model: 'test-model', remaining: () => options.remaining ?? 20,
    invoke: async (stage, input, signal) => { calls.push({ stage, input }); return options.invoke ? options.invoke(stage, input, signal) : outputs.shift() } } })
  return { service, calls, loads, rechecks }
}
describe('Cloud answer integrity and correction', () => {
  test('real source anchors and dependency references are preserved', () => {
    const value = claims()
    expect(value[0]!.id).toBe('c1'); expect(value[0]!.passage_ids).toEqual(selected.map(p => p.id))
    expect(value[0]!.support[0]!.quote).toBe(passage.text.slice(0, 200))
  })
  test('invented anchors and quotes borrowed from uncited context fail', () => {
    const d = draft(); d.answers[0]!.claims[0]!.support[0]!.quote = 'A fabricated supporting quotation.'
    expect(() => parseCloudDraft(d, selected, plan.facets, [])).toThrow('draft_invalid')
    d.answers[0]!.claims[0]!.support[0] = { passage_id: 'S18', quote: 'A fabricated supporting quotation.' }
    expect(() => parseCloudDraft(d, selected, plan.facets, [])).toThrow('draft_invalid')
  })
  test('every explicit citation needs its own anchor; missing facets and numerical output fail', () => {
    const d = draft(); d.answers[0]!.claims[0]!.support = []
    expect(() => parseCloudDraft(d, selected, plan.facets, [])).toThrow('draft_invalid')
    expect(() => parseCloudDraft({ answers: [] }, selected, plan.facets, [])).toThrow('draft_empty')
    const n = draft(); n.answers[0]!.claims[0]!.text = 'Your emissions are 23 tonnes CO2e.'
    expect(() => parseCloudDraft(n, selected, plan.facets, [])).toThrow('numeric_output_not_allowed')
  })
  test('aligned negative verdict is valid data but not approval', () => {
    expect(parseCloudReview(negative(), claims(), plan.facets).decision).toBe('fail')
    expect(mayCorrect(negative())).toBe(true)
    const n = negative(); n.scope_valid = false; n.issues.push({ target_id: 'answer', code: 'scope', explanation: 'Scope is not valid.' })
    expect(mayCorrect(parseCloudReview(n, claims(), plan.facets))).toBe(false)
  })
  test('malformed, contradictory and unaligned verdicts cannot trigger correction', () => {
    const a = negative(); a.claims[0]!.id = 'another'
    expect(() => parseCloudReview(a, claims(), plan.facets)).toThrow('support_not_verified')
    const b = negative(); b.decision = 'pass'
    expect(() => parseCloudReview(b, claims(), plan.facets)).toThrow('support_not_verified')
    const c = negative(); c.issues = []
    expect(() => parseCloudReview(c, claims(), plan.facets)).toThrow('support_not_verified')
    const d = passingReview(claims()); d.facets[0]!.claim_ids = []
    expect(() => parseCloudReview(d, claims(), plan.facets)).toThrow('support_not_verified')
  })
  test('cloud retrieval occurs before planning and final recheck before display', async () => {
    const h = harness([plan, draft(), passingReview(claims())])
    const answer = await h.service.answer('A new way of asking a conceptual question')
    expect(answer.status).toBe('qualified'); expect(answer.retrieval?.mode).toBe('cloud')
    expect(h.loads).toEqual(['A new way of asking a conceptual question']); expect(h.rechecks).toEqual([binding])
    expect(h.calls.map(c => c.stage)).toEqual(['plan', 'draft', 'verify'])
    expect(answer.claims[0]!.text).toBe(draft().answers[0]!.claims[0]!.text)
  })
  test('one complete correction followed by a fresh review, not a positive-verdict retry', async () => {
    const h = harness([plan, draft(), negative(), draft(), passingReview(claims())])
    const answer = await h.service.answer('Explain these methods')
    expect(answer.status).toBe('qualified'); expect(answer.correction_attempted).toBe(true)
    expect(answer.correction_kind).toBe('source_review')
    expect(h.calls.map(c => c.stage)).toEqual(['plan', 'draft', 'verify', 'draft', 'verify'])
    expect(h.calls[3]!.input).toHaveProperty('correction_packet')
    expect(h.calls[4]!.input).not.toHaveProperty('correction_packet')
    expect(JSON.stringify(h.calls[4]!.input)).not.toContain('necessary source condition is absent')
  })
  test('a bounded draft contract violation shares the sole correction allowance and uses four stages', async () => {
    const tooMany = draft(); tooMany.answers[0]!.claims = Array.from({ length: 9 }, () => structuredClone(draft().answers[0]!.claims[0]!))
    const h = harness([plan, tooMany, draft(), passingReview(claims())])
    const answer = await h.service.answer('Explain the methods')
    expect(answer.status).toBe('qualified'); expect(answer.correction_kind).toBe('draft_contract')
    expect(answer.correction_attempted).toBe(true); expect(h.calls.map(c => c.stage)).toEqual(['plan','draft','draft','verify'])
    expect(h.calls[2]!.input).toHaveProperty('correction_packet.kind', 'draft_contract')
    expect(h.calls[3]!.input).not.toHaveProperty('correction_packet'); expect(h.rechecks).toEqual([binding])
    expect(JSON.stringify(h.calls[3]!.input)).not.toContain('claim_count_exceeded')
  })
  test('a contract repair cannot get a second semantic correction or release a still-invalid draft', async () => {
    const invalid = draft(); invalid.answers[0]!.claims[0]!.support[0]!.quote = 'A non-contiguous invented quote.'
    const semantic = harness([plan, invalid, draft(), negative()])
    const withheld = await semantic.service.answer('Explain')
    expect(withheld.reason_code).toBe('support_not_verified'); expect(withheld.correction_kind).toBe('draft_contract')
    expect(withheld.claims).toEqual([]); expect(semantic.calls).toHaveLength(4)
    const structural = harness([plan, invalid, invalid])
    expect((await structural.service.answer('Explain')).reason_code).toBe('draft_invalid'); expect(structural.calls).toHaveLength(3)
  })
  test('malformed, unknown source and quantitative drafts are not repairable', async () => {
    const unknown = draft(); unknown.answers[0]!.claims[0]!.passage_ids = ['S99']
    const numeric = draft(); numeric.answers[0]!.claims[0]!.text = 'Your emissions are 23 tonnes CO2e.'
    for (const candidate of [null, { answers: [] }, { answers: 'invalid' }, unknown, numeric]) {
      const h = harness([plan, candidate]); const answer = await h.service.answer('Explain')
      expect(answer.claims).toEqual([]); expect(answer.correction_attempted).toBe(false); expect(answer.correction_kind).toBeNull(); expect(h.calls).toHaveLength(2)
    }
  })
  test('causal, attribution and absence defects require an aligned relationship assessment', () => {
    const review = passingReview(claims()); review.decision = 'fail'; review.claims[0]!.relationships_preserved = false
    expect(() => parseCloudReview(review, claims(), plan.facets)).toThrow('support_not_verified')
    review.issues = [{ target_id: 'c1', code: 'relationship', explanation: 'The cited paragraph does not establish the attributed causal relationship.' }]
    expect(parseCloudReview(review, claims(), plan.facets).decision).toBe('fail')
    review.claims[0]!.relationships_preserved = true
    expect(() => parseCloudReview(review, claims(), plan.facets)).toThrow('support_not_verified')
  })
  test('second negative withholds the entire answer and stops at five stages', async () => {
    const h = harness([plan, draft(), negative(), draft(), negative()])
    const answer = await h.service.answer('Explain these methods')
    expect(answer.reason_code).toBe('support_not_verified'); expect(answer.claims).toEqual([]); expect(answer.evidence).toEqual([])
    expect(h.calls).toHaveLength(5); expect(h.rechecks).toHaveLength(0)
  })
  test('scope, decomposition and context failures do not permit revision', async () => {
    for (const flag of ['scope_valid', 'decomposition_complete', 'context_sufficient'] as const) {
      const review = negative(); review[flag] = false
      review.issues.push({ target_id: 'answer', code: flag === 'scope_valid' ? 'scope' : flag === 'decomposition_complete' ? 'decomposition' : 'context', explanation: 'The whole-answer assessment failed.' })
      const h = harness([plan, draft(), review])
      expect((await h.service.answer('Explain these methods')).claims).toEqual([])
      expect(h.calls).toHaveLength(3)
    }
  })
  test('issues must explain the corresponding failed assessment, including target collisions', () => {
    const two = [...claims(), { ...claims()[0]!, id: 'c2' }]
    const r = passingReview(two); r.decision = 'fail'; r.claims[0]!.supported = false
    r.issues = [{ target_id: 'c2', code: 'condition', explanation: 'This points at a passing different claim.' }]
    expect(() => parseCloudReview(r, two, plan.facets)).toThrow('support_not_verified')
    const n = negative(); n.claims[0]!.modality_preserved = false
    expect(() => parseCloudReview(n, claims(), plan.facets)).toThrow('support_not_verified')
    expect(() => parseCloudReview(negative(), claims(), [{ ...plan.facets[0]!, id: 'c1' }])).toThrow('support_not_verified')
  })
  test('source withdrawal before release withholds a passed draft', async () => {
    const h = harness([plan, draft(), passingReview(claims())], { repository: { recheck: async () => { throw new PassageError('source_stale') } } })
    const answer = await h.service.answer('Explain these methods')
    expect(answer.status).toBe('stale_or_conflicting'); expect(answer.claims).toEqual([]); expect(answer.retrieval).toBeNull()
  })
  test('cloud authorization failure prevents all model calls; insufficient budget prevents cloud I/O', async () => {
    const h = harness([], { repository: { loadForQuestion: async () => { throw new Error('sensitive raw transport failure') } } })
    const answer = await h.service.answer('Explain these methods')
    expect(answer.status).toBe('unavailable'); expect(JSON.stringify(answer)).not.toContain('sensitive'); expect(h.calls).toHaveLength(0)
    const b = harness([], { remaining: 4 }); expect((await b.service.answer('Explain')).reason_code).toBe('budget_exhausted'); expect(b.loads).toHaveLength(0)
  })
  test('conceptual queries do not request company context; numerical choice can do so', async () => {
    const h = harness([{ action: 'conceptual_research', decision: 'needs_input', passage_ids: [], facets: [], missing_context: ['location'] }])
    expect((await h.service.answer('How are regional factors sourced?')).missing_context).toEqual([])
    const n = harness([{ action: 'numeric_factor_selection', decision: 'needs_input', passage_ids: [], facets: [], missing_context: ['location'] }])
    expect((await n.service.answer('Which factor applies to our building?')).missing_context).toEqual(['location'])
  })
  test('cancelled uncooperative provider cannot start later stages; lock remains held until settlement', async () => {
    let done!: (v: unknown) => void
    const h = harness([], { deadlineMs: 15, invoke: () => new Promise(resolve => { done = resolve }) })
    const result = await h.service.answer('Explain')
    expect(result.reason_code).toBe('request_timeout')
    expect((await h.service.answer('Another')).reason_code).toBe('request_in_progress')
    done(plan); await new Promise(resolve => setTimeout(resolve, 5)); expect(h.calls).toHaveLength(1)
  })
  test('cancellation after correction starts retains truthful attempt metadata', async () => {
    const controller = new AbortController(), values = [plan, draft(), negative()]
    let finish!: (v: unknown) => void, attempt = 0
    const h = harness([], { invoke: async () => { attempt++; if (attempt <= 3) return values.shift(); controller.abort(); return new Promise(resolve => { finish = resolve }) } })
    const answer = await h.service.answer('Explain', controller.signal)
    expect(answer.correction_attempted).toBe(true); expect(answer.reason_code).toBe('request_cancelled'); expect(h.calls).toHaveLength(4)
    expect(answer.claims).toEqual([]); finish(draft())
    await new Promise(resolve => setTimeout(resolve, 5)); expect(h.calls).toHaveLength(4)
  })
  test('local route rejects foreign origins/hosts, extra tenant fields and malformed requests before provider', async () => {
    const h = harness([]), app = createCloudRoutes(h.service, ['http://localhost:5174'])
    const post = (host: string, origin: string, body: unknown) => app.handle(new Request(`${host}/research/answer`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
    expect((await post('http://localhost:3012', 'https://evil.example', { question: 'Explain' })).status).toBe(403)
    expect((await post('http://evil.example', 'http://localhost:5174', { question: 'Explain' })).status).toBe(403)
    expect((await post('http://localhost:3012', 'http://localhost:5174', { question: 'Explain', scope_id: 'other' })).status).toBe(422)
    expect(h.calls).toHaveLength(0)
  })
})

describe('source condition ledger controls whole-answer release', () => {
  const catalog = { ...testCatalog, conditions: [{ id: 'required-1', passage_id: 'S01', source_quote: passage.text.slice(0,80), applicability: 'Synthetic condition for validator tests.' }] }
  test('missing rows and an applicable missing condition cannot coexist with a passing review', () => {
    const r=passingReview(claims())
    expect(()=>parseSourceReview(r,claims(),plan.facets,catalog)).toThrow('support_not_verified')
    r.claims[0]!.condition_reviews=[{condition_id:'required-1',applicability:'applies',preserved:false,answer_quote:null,explanation:'A source prerequisite is absent.'}]
    expect(()=>parseSourceReview(r,claims(),plan.facets,catalog)).toThrow('support_not_verified')
    r.decision='fail';r.claims[0]!.conditions_complete=false;r.issues=[{target_id:'c1',code:'condition',explanation:'The source prerequisite is absent from c1.'}]
    expect(parseSourceReview(r,claims(),plan.facets,catalog).decision).toBe('fail')
    expect(mayCorrect(parseSourceReview(r,claims(),plan.facets,catalog))).toBe(true)
  })
  test('catalog integrity failure stops before planning',async()=>{
    let calls=0
    const service=createCloudAnswerService({repository:{loadForQuestion:async()=>evidence,recheck:async()=>{}},conditionCatalog:{...testCatalog,release_sha256:'0'.repeat(64)},provider:{model:'test',remaining:()=>20,invoke:async()=>{calls++;return plan}}})
    const result=await service.answer('A general conceptual question')
    expect(result.reason_code).toBe('condition_catalog_invalid');expect(result.status).toBe('unavailable');expect(result.claims).toEqual([]);expect(calls).toBe(0)
    await expect(service.initialize()).rejects.toThrow('condition_catalog_invalid')
  })
})

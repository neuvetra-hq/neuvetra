import { describe, expect, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import catalog from '../../../../data/research/answer-units/scope2-website.epa-acquisition.v1.json'
import release from '../../../../data/research/releases/scope2-website.v1.json'
import publicQualifications from '../data/reviewed-qualifications.json'
import { answerHeading, isResearchAnswer, qualificationNotes, requestResearchAnswer, type ResearchAnswer } from './research-api'
import { isResearchPreviewPaused, PREVIEW_PAUSED_MESSAGE, requestResearchConnection } from './research-maintenance'

function answer(unitIds = ['U01', 'U02', 'U03']): ResearchAnswer {
  const units = catalog.units.filter(u => unitIds.includes(u.id))
  const ids = new Set(units.flatMap(u => u.passage_ids)), passages = release.passages.filter(p => ids.has(p.id))
  return { answer_mode: 'cloud_reviewed_composition', status: 'qualified', message: 'Offline controlled response.',
    claims: units.map(u => ({ id: u.id, text: u.text, evidence_ids: [...u.passage_ids], qualifications: [...new Set(passages.filter(p => u.passage_ids.includes(p.id)).flatMap(p => p.qualifications))] })),
    evidence: passages.map(p => ({ id: p.id, source_id: p.source_id, locator: p.locator, excerpt: p.text })),
    sources: release.sources.map(({ id, title, version, status, canonical_url }) => ({ id, title, version, status, canonical_url })),
    release: { id: release.release_id, version: release.version, sha256: catalog.source_release_sha256 }, provider: { mode: 'live', model: 'offline-controlled' }, missing_context: [], scope_gaps: [], correction_attempted: false, correction_kind: null,
    retrieval: { mode: 'cloud', store: 'Supabase', search: 'Pinecone', build_id: '63f0190c-9694-46db-9ea8-85445a80f6be', release_sha256: catalog.source_release_sha256, candidate_ids: ['S01'], selected_ids: passages.map(p => p.id), checked_at: '2026-09-12T12:00:00Z' },
    composition: { catalog_id: catalog.catalog_id, version: catalog.version, sha256: '97b2c4e0f4121c1d2ea7fa33d569f53344193f12a80e9d1349577c3a86e17e50', wording: 'reviewed_verbatim', units: units.map(({ id, title, type }) => ({ id, title, type: type as 'source_summary' | 'reviewed_interpretation' })) } }
}

describe('Reviewed composition browser contract', () => {
  test('new supplier inquiry requires exact reviewed wording and its own complete references', () => {
    const inquiry = answer(['U23'])
    expect(isResearchAnswer(inquiry)).toBe(true)
    expect(inquiry.composition!.version).toBe('3-epa-acquisition')
    expect(inquiry.claims[0]!.evidence_ids).toEqual(['S06', 'S11', 'S12', 'S15'])
    const altered = structuredClone(inquiry); altered.claims[0]!.text = altered.claims[0]!.text.replace('If an applicable purchasing agreement is being used, ', '')
    expect(isResearchAnswer(altered)).toBe(false)
    const incomplete = structuredClone(inquiry); incomplete.claims[0]!.evidence_ids = ['S06', 'S11', 'S12']
    expect(isResearchAnswer(incomplete)).toBe(false)
    const old = answer(); old.composition!.version = '1'; old.composition!.sha256 = 'c59ffac9c6e824b81174aac7f52bf3a36dfed516a7340ff40ff8ba758518ef1f'
    expect(isResearchAnswer(old)).toBe(false)
    inquiry.correction_attempted = true; inquiry.correction_kind = 'selection_contract'
    expect(isResearchAnswer(inquiry)).toBe(true)
  })
  test('standalone acquisition guide renders its long exact wording and all own references', () => {
    const guide = answer(['U24'])
    expect(isResearchAnswer(guide)).toBe(true)
    expect(guide.claims[0]!.text.length).toBe(2170)
    expect(guide.claims[0]!.evidence_ids).toEqual(['S06','S07','S08','S09','S10','S11','S12','S15','S18'])
    const shortened = structuredClone(guide); shortened.claims[0]!.text = shortened.claims[0]!.text.slice(0, 850)
    expect(isResearchAnswer(shortened)).toBe(false)
    const missing = structuredClone(guide); missing.claims[0]!.evidence_ids = missing.claims[0]!.evidence_ids.filter(id => id !== 'S15')
    expect(isResearchAnswer(missing)).toBe(false)
    const excess = answer(['U24','U23','U13','U09','U07','U08','U10','U16'])
    expect(isResearchAnswer(excess)).toBe(false)
  })
  test('the public note projection exactly matches the pinned source without exporting private provenance', () => {
    const bytes = readFileSync(new URL('../../../../data/research/releases/scope2-website.v1.json', import.meta.url))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f')
    expect(publicQualifications).toEqual(release.passages.map(({ id, qualifications }) => ({ id, qualifications })))
    expect(publicQualifications).toHaveLength(18)
    expect(publicQualifications.every(row => Object.keys(row).join(',') === 'id,qualifications')).toBe(true)
  })
  test('excluded actions take precedence in the heading while true coverage gaps keep their meaning', () => {
    const a: ResearchAnswer = { ...answer(), status: 'unsupported', claims: [], evidence: [], sources: [], retrieval: null, composition: null, scope_gaps: [{ question_fragment: 'Explain the missing concept.', reason: 'coverage_missing', context_ids: [] }] }
    expect(isResearchAnswer(a)).toBe(true)
    expect(answerHeading(a)).toBe('More source coverage is needed')
    a.scope_gaps!.push({ question_fragment: 'Then file our report.', reason: 'action_out_of_scope', context_ids: [] })
    expect(isResearchAnswer(a)).toBe(true)
    expect(answerHeading(a)).toBe('This request is outside the preview')
    a.scope_gaps!.reverse()
    expect(answerHeading(a)).toBe('This request is outside the preview')
  })
  test('operator pause blocks status, reconnect and submission before any network request', async () => {
    const fetcher = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network must not be reached while paused'))
    const signal = new AbortController().signal, question = 'A question retained in the input.'
    try {
      expect(isResearchPreviewPaused('true')).toBe(true)
      for (const value of [undefined, '', 'false', false, 'TRUE']) expect(isResearchPreviewPaused(value)).toBe(false)
      expect(await requestResearchConnection(signal, true)).toBe('paused')
      expect(await requestResearchConnection(signal, true)).toBe('paused')
      await expect(requestResearchAnswer(question, signal, true)).rejects.toThrow(PREVIEW_PAUSED_MESSAGE)
      expect(fetcher).not.toHaveBeenCalled()
    } finally { fetcher.mockRestore() }
  })
  test('an absent pause flag preserves ordinary status behavior', async () => {
    const fetcher = spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ readiness: 'ready' }))
    const signal = new AbortController().signal
    try {
      expect(await requestResearchConnection(signal)).toBe('ready')
      expect(fetcher).toHaveBeenCalledWith('/research-api/status', { signal })
    } finally { fetcher.mockRestore() }
  })
  test('source notes appear once while keeping every exact claim association and prerequisite', () => {
    const a = answer(), before = structuredClone(a), notes = qualificationNotes(a)
    expect(notes.length).toBe(new Set(a.claims.flatMap(c => c.qualifications)).size)
    expect(notes.length).toBeLessThan(a.claims.reduce((n,c) => n+c.qualifications.length, 0))
    for (const claim of a.claims) expect(notes.filter(n => n.claim_ids.includes(claim.id)).map(n => n.text)).toEqual(claim.qualifications)
    expect(a).toEqual(before)
    a.claims[0]!.qualifications = []
    expect(isResearchAnswer(a)).toBe(false)
    const injected = answer(); injected.claims[0]!.qualifications.push('Unreviewed new condition')
    expect(isResearchAnswer(injected)).toBe(false)
  })
  test('reviewed context and coverage gaps are distinct, bounded, and tied to exact fixed context identifiers', () => {
    const a: ResearchAnswer = { ...answer(), status: 'needs_input', claims: [], evidence: [], sources: [], retrieval: null, composition: null, missing_context: ['referenced_requirement'], scope_gaps: [{ question_fragment: 'that requirement', reason: 'context_required', context_ids: ['referenced_requirement'] }] }
    expect(isResearchAnswer(a)).toBe(true)
    expect(isResearchAnswer({ ...a, missing_context: ['location', 'reporting_period', 'electricity_supply'] })).toBe(false)
    expect(isResearchAnswer({ ...a, scope_gaps: [{ ...a.scope_gaps![0], context_ids: ['customer_secret'] }] })).toBe(false)
    expect(isResearchAnswer({ ...a, scope_gaps: [] })).toBe(false)
    const mixed: ResearchAnswer = { ...a, status: 'unsupported', missing_context: [], scope_gaps: [...a.scope_gaps!, { question_fragment: 'the unsupported method', reason: 'coverage_missing', context_ids: [] }] }
    expect(isResearchAnswer(mixed)).toBe(true)
    expect(isResearchAnswer({ ...mixed, status: 'needs_input', missing_context: ['referenced_requirement'] })).toBe(false)
    expect(isResearchAnswer({ ...answer(), scope_gaps: mixed.scope_gaps })).toBe(false)
  })
  test('actual approved unit text, own references and interpretation labels decode', () => {
    const value = answer()
    expect(isResearchAnswer(value)).toBe(true)
    expect(value.composition!.units.map(u => u.type)).toEqual(['source_summary', 'source_summary', 'reviewed_interpretation'])
    value.correction_attempted = true; value.correction_kind = 'source_review'
    expect(isResearchAnswer(value)).toBe(true)
  })
  test('changed prose, titles, labels, IDs or catalog/source pins cannot be displayed', () => {
    const mutations: ((a: ResearchAnswer) => void)[] = [
      a => { a.claims[0]!.text += ' Accordingly, every company must report.' },
      a => { a.composition!.units[0]!.title = 'Why EPA requires this' },
      a => { a.composition!.units[2]!.type = 'source_summary' },
      a => { a.claims[0]!.id = 'U99'; a.composition!.units[0]!.id = 'U99' },
      a => { a.composition!.sha256 = '0'.repeat(64) },
      a => { a.release!.sha256 = '0'.repeat(64); a.retrieval!.release_sha256 = '0'.repeat(64) },
    ]
    for (const mutate of mutations) { const a = answer(); mutate(a); expect(isResearchAnswer(a)).toBe(false) }
  })
  test('companion omission, arbitrary ordering, foreign citations and metadata injection are rejected', () => {
    const missing = answer(); missing.claims = missing.claims.filter(c => c.id !== 'U01'); missing.composition!.units = missing.composition!.units.filter(u => u.id !== 'U01')
    expect(isResearchAnswer(missing)).toBe(false)
    const reversed = answer(); reversed.claims.reverse(); reversed.composition!.units.reverse()
    expect(isResearchAnswer(reversed)).toBe(false)
    const foreign = answer(); foreign.claims[0]!.evidence_ids.push('S18')
    expect(isResearchAnswer(foreign)).toBe(false)
    const injected = answer(); Object.assign(injected.composition!.units[0]!, { explanation: 'Unreviewed text.' })
    expect(isResearchAnswer(injected)).toBe(false)
  })
  test('draft-repair metadata belongs to the old generated mode and cannot label composed answers', () => {
    const value = answer(); value.correction_attempted = true; value.correction_kind = 'draft_contract'
    expect(isResearchAnswer(value)).toBe(false)
  })
  test('size reselection metadata is mode-specific and requires an actual correction', () => {
    const value = answer(); value.correction_attempted = true; value.correction_kind = 'selection_size'
    expect(isResearchAnswer(value)).toBe(true)
    expect(isResearchAnswer({ ...value, correction_attempted: false })).toBe(false)
    const oldMode = { ...value, answer_mode: 'cloud_passage_grounded' as const }
    delete oldMode.composition
    expect(isResearchAnswer(oldMode)).toBe(false)
  })
  test('safe refusal carries neither composition nor residual answer; old modes cannot carry composition', () => {
    const a: ResearchAnswer = { ...answer(), status: 'unsupported', claims: [], evidence: [], sources: [], retrieval: null, composition: null, scope_gaps: [{ question_fragment: 'Do this excluded action.', reason: 'action_out_of_scope', context_ids: [] }] }
    expect(isResearchAnswer(a)).toBe(true)
    expect(isResearchAnswer({ ...a, composition: answer().composition })).toBe(false)
    expect(isResearchAnswer({ ...a, claims: answer().claims })).toBe(false)
    expect(isResearchAnswer({ ...answer(), answer_mode: 'cloud_passage_grounded' })).toBe(false)
  })
})

 test('neutral unanswered remainder is not a public gap or support claim',()=>{
 const a:ResearchAnswer={...answer(),status:'unsupported',claims:[],evidence:[],sources:[],retrieval:null,composition:null,scope_gaps:[{question_fragment:'the unclear reference',reason:'context_required',context_ids:['referenced_subject']},{question_fragment:'the independent unsupported effect',reason:'coverage_missing',context_ids:[]}]};
 expect(isResearchAnswer(a)).toBe(true);
 for(const reason of ['withheld','not_answered','source_available']) expect(isResearchAnswer({...a,scope_gaps:[...a.scope_gaps!,{question_fragment:'neutral remainder',reason,context_ids:[]}]})).toBe(false);
 });

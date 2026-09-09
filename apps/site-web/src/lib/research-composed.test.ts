import { describe, expect, test } from 'bun:test'
import catalog from '../../../../data/research/answer-units/scope2-website.v1.json'
import release from '../../../../data/research/releases/scope2-website.v1.json'
import { isResearchAnswer, type ResearchAnswer } from './research-api'

function answer(): ResearchAnswer {
  const units = catalog.units.filter(u => ['U01', 'U02', 'U03'].includes(u.id))
  const ids = new Set(units.flatMap(u => u.passage_ids)), passages = release.passages.filter(p => ids.has(p.id))
  return { answer_mode: 'cloud_reviewed_composition', status: 'qualified', message: 'Offline controlled response.',
    claims: units.map(u => ({ id: u.id, text: u.text, evidence_ids: [...u.passage_ids], qualifications: [...new Set(passages.filter(p => u.passage_ids.includes(p.id)).flatMap(p => p.qualifications))] })),
    evidence: passages.map(p => ({ id: p.id, source_id: p.source_id, locator: p.locator, excerpt: p.text })),
    sources: release.sources.map(({ id, title, version, status, canonical_url }) => ({ id, title, version, status, canonical_url })),
    release: { id: release.release_id, version: release.version, sha256: catalog.source_release_sha256 }, provider: { mode: 'live', model: 'offline-controlled' }, missing_context: [], correction_attempted: false, correction_kind: null,
    retrieval: { mode: 'cloud', store: 'Supabase', search: 'Pinecone', build_id: '63f0190c-9694-46db-9ea8-85445a80f6be', release_sha256: catalog.source_release_sha256, candidate_ids: ['S01'], selected_ids: passages.map(p => p.id), checked_at: '2026-09-12T12:00:00Z' },
    composition: { catalog_id: catalog.catalog_id, version: catalog.version, sha256: 'c59ffac9c6e824b81174aac7f52bf3a36dfed516a7340ff40ff8ba758518ef1f', wording: 'reviewed_verbatim', units: units.map(({ id, title, type }) => ({ id, title, type: type as 'source_summary' | 'reviewed_interpretation' })) } }
}

describe('Reviewed composition browser contract', () => {
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
    const a: ResearchAnswer = { ...answer(), status: 'unsupported', claims: [], evidence: [], sources: [], retrieval: null, composition: null }
    expect(isResearchAnswer(a)).toBe(true)
    expect(isResearchAnswer({ ...a, composition: answer().composition })).toBe(false)
    expect(isResearchAnswer({ ...a, claims: answer().claims })).toBe(false)
    expect(isResearchAnswer({ ...answer(), answer_mode: 'cloud_passage_grounded' })).toBe(false)
  })
})

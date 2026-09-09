import { afterEach, expect, test } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkMechanical, prepareEvaluation, evaluateWebsiteComposed, FIXTURE_SHA256, RELEASE_SHA256, ENDPOINT, ORIGIN, type PreparedEvaluation } from './evaluate-website-composed'
import type { ResearchAnswer } from '../../apps/site-web/src/lib/research-api'
import catalog from '../../data/research/answer-units/scope2-website.v1.json'

const root = process.cwd(), directories: string[] = []
const prefix = path.join(os.tmpdir(), 'neuvetra-composed-evaluator-test-')
const unitPath = 'data/research/answer-units/scope2-website.v1.json'
const sourcePath = 'data/research/releases/scope2-website.v1.json'
const conditionPath = 'data/research/conditions/scope2-website.v1.json'
const fixtureBytes = readFileSync(path.join(root, 'evaluations/research-qa/website-cloud-acceptance.v1.json'))
function setup(caseIds = ['W01'], beforePrepare?: (directory: string) => void) {
  const directory = mkdtempSync(prefix); directories.push(directory)
  mkdirSync(path.join(directory, '.superpowers'))
  const files = ['tools/research/evaluate-website-composed.ts', 'apps/site-web/src/lib/research-api.ts', sourcePath, conditionPath, unitPath,
    'apps/site-api/src/research-composed-server.ts', 'apps/site-api/src/research-cloud-server.ts', 'apps/site-api/src/research-passages-server.ts']
  for (const dir of ['apps/site-api/src/research-composed', 'apps/site-api/src/research-cloud', 'apps/site-api/src/research-passages', 'apps/site-api/src/research']) {
    files.push(...readdirSync(path.join(root, dir)).filter(f => f.endsWith('.ts')).map(f => `${dir}/${f}`))
  }
  for (const file of files) { const destination = path.join(directory, file); mkdirSync(path.dirname(destination), { recursive: true }); copyFileSync(path.join(root, file), destination) }
  beforePrepare?.(directory)
  const prepared = prepareEvaluation({ fixtureBytes, fixtureSha256: FIXTURE_SHA256, caseIds, repoRoot: directory })
  return { directory, prepared, outputPath: path.join(directory, '.superpowers', 'run.jsonl') }
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    // Each target was created by this suite; verify its resolved temporary path
    // before deleting it. No workspace or user-supplied path is removed.
    const resolved = path.resolve(directory)
    expect(resolved.startsWith(path.resolve(prefix))).toBe(true)
    expect(path.dirname(resolved)).toBe(path.resolve(os.tmpdir()))
    rmSync(resolved, { recursive: true })
  }
})
function answer(evidence: PreparedEvaluation['evidence']): ResearchAnswer {
  const units = catalog.units.filter(u => ['U01', 'U02', 'U03'].includes(u.id))
  const ids = new Set(units.flatMap(u => u.passage_ids)), passages = evidence.passages.filter(p => ids.has(p.id))
  return { answer_mode: 'cloud_reviewed_composition', status: 'qualified', message: 'Offline controlled response.',
    claims: units.map(u => ({ id: u.id, text: u.text, evidence_ids: [...u.passage_ids], qualifications: [...new Set(passages.filter(p => u.passage_ids.includes(p.id)).flatMap(p => p.qualifications))] })),
    evidence: passages.map(p => ({ id: p.id, source_id: p.source_id, locator: p.locator, excerpt: p.text })),
    sources: evidence.sources.map(({ id, title, version, status, canonical_url }) => ({ id, title, version, status, canonical_url })),
    release: { id: evidence.release_id, version: evidence.version, sha256: RELEASE_SHA256 }, provider: { mode: 'live', model: 'offline-controlled' }, missing_context: [], correction_attempted: false, correction_kind: null,
    retrieval: { mode: 'cloud', store: 'Supabase', search: 'Pinecone', build_id: '63f0190c-9694-46db-9ea8-85445a80f6be', release_sha256: RELEASE_SHA256, candidate_ids: ['S01'], selected_ids: passages.map(p => p.id), checked_at: '2026-09-12T12:00:00Z' },
    composition: { catalog_id: catalog.catalog_id, version: catalog.version, sha256: 'c59ffac9c6e824b81174aac7f52bf3a36dfed516a7340ff40ff8ba758518ef1f', wording: 'reviewed_verbatim', units: units.map(({ id, title, type }) => ({ id, title, type: type as 'source_summary' | 'reviewed_interpretation' })) } }
}
const status = (remaining_stages: number) => ({ service: 'neuvetra-research-cloud', answer_mode: 'cloud_reviewed_composition', data_connection: 'cloud', readiness: 'ready', remaining_stages })
const response = (value: unknown) => Response.json(value)
const events = (file: string): Record<string, unknown>[] => readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line))

test('actual reviewed composition passes mechanical checks while semantic coverage remains independently pending', () => {
  const s = setup(), item = s.prepared.cases[0]!, result = checkMechanical(answer(s.prepared.evidence), item, s.prepared.evidence)
  expect(result.mechanical_checks_passed).toBe(true); expect(result.semantic_review).toBe('pending')
  expect(s.prepared.pins[unitPath]).toBe('c59ffac9c6e824b81174aac7f52bf3a36dfed516a7340ff40ff8ba758518ef1f')
  expect(s.prepared.pins[conditionPath]).toBe('063adbadbe9c70493a81228931c4e4ec4a833633d12c83e2ab48616bd876d2c6')
  expect(s.prepared.pins['apps/site-api/src/research-composed/provider.ts']).toMatch(/^[a-f0-9]{64}$/)
})
test('altered evidence, source metadata, qualification, unit prose and catalog pin fail mechanical review', () => {
  const s = setup(), item = s.prepared.cases[0]!
  const mutations: ((a: ResearchAnswer) => void)[] = [
    a => { a.evidence[0]!.excerpt = 'Invented supporting passage.' },
    a => { a.sources[0]!.version = 'Invented latest edition' },
    a => { a.claims[0]!.qualifications.push('Unreviewed added condition.') },
    a => { a.claims[0]!.text += ' New generated causal claim.' },
    a => { a.composition!.sha256 = '0'.repeat(64) },
    a => { a.claims[0]!.evidence_ids = ['S02'] },
  ]
  for (const mutate of mutations) { const a = answer(s.prepared.evidence); mutate(a); expect(checkMechanical(a, item, s.prepared.evidence).mechanical_checks_passed).toBe(false) }
})
test('one first attempt uses only the question, fixed loopback and origin, and a flushed exclusive journal', async () => {
  const s = setup(), calls: { url: string; init: RequestInit }[] = [], packets = [status(40), answer(s.prepared.evidence), status(38)]
  const result = await evaluateWebsiteComposed({ ...s, fetch: async (url, init) => {
    calls.push({ url, init })
    expect(events(s.outputPath).at(-1)!.event).toBe(calls.length === 1 ? 'status_before_started' : calls.length === 2 ? 'answer_started' : 'status_after_started')
    return response(packets.shift())
  } })
  expect(result.state).toBe('recorded'); expect(result.semantic_review).toBe('pending')
  expect(result.cases[0]!.stages_consumed).toBe(2); expect(result.cases[0]!.mechanical_checks_passed).toBe(true)
  expect(calls.map(c => c.url)).toEqual([`${ENDPOINT}/research/status`, `${ENDPOINT}/research/answer`, `${ENDPOINT}/research/status`])
  expect(calls.every(c => c.init.redirect === 'error' && (c.init.headers as Record<string, string>).Origin === ORIGIN && c.init.signal instanceof AbortSignal)).toBe(true)
  expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ question: s.prepared.cases[0]!.question })
  expect(events(s.outputPath).map(e => e.sequence)).toEqual(events(s.outputPath).map((_, i) => i))
  expect(events(s.outputPath).at(-1)!.event).toBe('run_finished')
})
test('answered results bind exactly to initial, size-corrected or review-corrected stage counts', async () => {
  for (const [kind, expected] of [[null, 2], ['selection_size', 3], ['source_review', 4]] as const) {
    for (const stages of [2, 3, 4]) {
      const s = setup(), a = answer(s.prepared.evidence); a.correction_kind = kind; a.correction_attempted = kind !== null
      const packets = [status(40), a, status(40 - stages)]
      const result = await evaluateWebsiteComposed({ ...s, fetch: async () => response(packets.shift()) })
      expect(result.cases[0]!.answered_stage_count_valid).toBe(stages === expected)
      expect(result.cases[0]!.mechanical_checks_passed).toBe(stages === expected)
    }
  }
  const s = setup(), a = answer(s.prepared.evidence); a.correction_kind = 'draft_contract'; a.correction_attempted = true
  const packets = [status(40), a, status(36)]
  expect((await evaluateWebsiteComposed({ ...s, fetch: async () => response(packets.shift()) })).cases[0]!.mechanical_checks_passed).toBe(false)
})
test('completed unsupported and context decisions also require the independent review stage', async () => {
  for (const outcome of ['unsupported', 'needs_input'] as const) {
    for (const stages of [1, 2]) {
      const s = setup(), a: ResearchAnswer = { ...answer(s.prepared.evidence), status: outcome, claims: [], evidence: [], sources: [], composition: null, retrieval: null, missing_context: outcome === 'needs_input' ? ['location'] : [] }
      const packets = [status(40), a, status(40 - stages)]
      const result = await evaluateWebsiteComposed({ ...s, fetch: async () => response(packets.shift()) })
      expect(result.cases[0]!.answered_stage_count_valid).toBe(stages === 2)
      expect(result.cases[0]!.mechanical_checks_passed).toBe(stages === 2)
      expect(result.cases[0]!.outcome_aligned).toBe(false)
    }
  }
})
test('uncertain transport preserves one failed POST and stops without a retry or next question', async () => {
  const s = setup(['W01', 'W02']); let count = 0
  const result = await evaluateWebsiteComposed({ ...s, fetch: async () => { count++; if (count === 1) return response(status(40)); throw new Error('private transport payload must not enter journal') } })
  expect(count).toBe(2); expect(result.stop_reason).toBe('answer_outcome_uncertain')
  expect(events(s.outputPath).some(e => e.event === 'answer_failed' && e.outcome === 'uncertain' && e.retry_attempts === 0)).toBe(true)
  expect(readFileSync(s.outputPath, 'utf8')).not.toContain('private transport payload')
})
test('budget admission needs four remaining stages and inconsistent counters stop after recording the response', async () => {
  const a = setup(); let count = 0
  expect((await evaluateWebsiteComposed({ ...a, fetch: async () => { count++; return response(status(3)) } })).stop_reason).toBe('service_not_ready')
  expect(count).toBe(1)
  const b = setup(['W01', 'W02']), packets = [status(40), answer(b.prepared.evidence), status(41)]
  const result = await evaluateWebsiteComposed({ ...b, fetch: async () => response(packets.shift()) })
  expect(result.stop_reason).toBe('counter_inconsistent'); expect(result.cases).toHaveLength(1)
  expect(events(b.outputPath).some(e => e.event === 'answer_received')).toBe(true)
})
test('existing output and paths outside the private evaluation folder refuse before transport', async () => {
  const s = setup(); let calls = 0; const fetch = async () => { calls++; return response(status(40)) }
  writeFileSync(s.outputPath, 'preserve this original record')
  await expect(evaluateWebsiteComposed({ ...s, fetch })).rejects.toBeInstanceOf(Error)
  expect(readFileSync(s.outputPath, 'utf8')).toBe('preserve this original record')
  const t = setup()
  await expect(evaluateWebsiteComposed({ ...t, outputPath: path.join(t.directory, 'outside.jsonl'), fetch })).rejects.toThrow('output_outside_private_root')
  expect(calls).toBe(0)
})
test('runtime or policy file drift after preparation refuses before transport', async () => {
  for (const file of ['apps/site-api/src/research-composed/answer.ts', unitPath, conditionPath, sourcePath]) {
    const s = setup(); writeFileSync(path.join(s.directory, file), 'changed bytes')
    let calls = 0
    await expect(evaluateWebsiteComposed({ ...s, fetch: async () => { calls++; return response(status(40)) } })).rejects.toThrow('runtime_files_changed')
    expect(calls).toBe(0)
  }
})
test('preparation itself rejects changed reviewed source and policy pins', () => {
  for (const [file, code] of [[unitPath, 'unit_catalog_pin_mismatch'], [conditionPath, 'condition_pin_mismatch'], [sourcePath, 'release_pin_mismatch']]) {
    expect(() => setup(['W01'], directory => writeFileSync(path.join(directory, file!), '{}'))).toThrow(code)
  }
  expect(() => prepareEvaluation({ fixtureBytes: Buffer.from('{}'), fixtureSha256: FIXTURE_SHA256, caseIds: ['W01'], repoRoot: root })).toThrow('fixture_pin_mismatch')
})
test('sealed preparations reject altered questions, evidence, pins and cloned or foreign state', async () => {
  for (const field of ['question', 'evidence', 'pins', 'clone']) {
    const s = setup(); let calls = 0
    if (field === 'question') s.prepared.cases[0]!.question = 'Altered question'
    if (field === 'evidence') s.prepared.evidence.passages[0]!.text = 'Altered source text'
    if (field === 'pins') s.prepared.pins = {}
    if (field === 'clone') s.prepared = structuredClone(s.prepared)
    await expect(evaluateWebsiteComposed({ ...s, fetch: async () => { calls++; return response(status(40)) } })).rejects.toThrow('preparation_changed_or_untrusted')
    expect(calls).toBe(0)
  }
})

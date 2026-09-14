import { test, expect, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { selectQuestionCases, checkMechanical, prepareEvaluation, evaluateWebsiteCloud, RELEASE_SHA256, FIXTURE_SHA256, ENDPOINT, ORIGIN, type PreparedEvaluation } from './evaluate-website-cloud'

const root = process.cwd(), directories: string[] = []
const item = { id: 'W01', question: 'Synthetic conceptual question?', expected_outcome: 'answer' as const }
const source = { id: 'source', title: 'Offline source', version: '1', status: 'published_guidance', canonical_url: 'https://www.epa.gov/example', sha256: 'a'.repeat(64) }
const evidence = { release_id: 'scope2-website', version: '1', sources: [source], extractions: [{ sha256: 'b'.repeat(64), source_sha256: source.sha256 }], passages: [
  { id: 'S01', source_id: 'source', text: 'A synthetic reviewed paragraph.', locator: 'Page 1', required_passage_ids: ['S02'], qualifications: [] },
  { id: 'S02', source_id: 'source', text: 'A synthetic context paragraph.', locator: 'Page 2', required_passage_ids: [], qualifications: ['Synthetic qualification.'] },
] }
function setup(caseIds = ['W01']) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'neuvetra-website-evaluator-test-')); directories.push(directory)
  mkdirSync(path.join(directory, '.superpowers'))
  const files = ['tools/research/evaluate-website-cloud.ts','apps/site-web/src/lib/research-api.ts','data/research/releases/scope2-website.v1.json','data/research/conditions/scope2-website.v1.json',
    'apps/site-api/src/research-cloud-server.ts','apps/site-api/src/research-passages-server.ts']
  for (const dir of ['apps/site-api/src/research-cloud','apps/site-api/src/research-passages','apps/site-api/src/research']) {
    files.push(...readdirSync(path.join(root,dir)).filter(f => f.endsWith('.ts')).map(f => `${dir}/${f}`))
  }
  for (const f of files) { mkdirSync(path.dirname(path.join(directory,f)),{recursive:true}); copyFileSync(path.join(root,f),path.join(directory,f)) }
  // Parse through the real sealed path. No hidden prompts are printed; model and
  // network behavior remain synthetic. Pure contract tests below use invented text.
  const prepared = prepareEvaluation({ fixtureBytes: readFileSync(path.join(root,'evaluations/research-qa/website-cloud-acceptance.v1.json')),
    fixtureSha256: FIXTURE_SHA256, caseIds, repoRoot: directory })
  const pinFile = path.join(directory,'apps/site-api/src/research-cloud/answer.ts')
  return { directory, pinFile, prepared, outputPath: path.join(directory, '.superpowers', 'run.jsonl') }
}
afterEach(() => { for (const directory of directories.splice(0)) { expect(directory.startsWith(path.join(os.tmpdir(), 'neuvetra-website-evaluator-test-'))).toBe(true); rmSync(directory, { recursive: true }) } })
function answer(data: PreparedEvaluation['evidence'] = evidence) { return {
  answer_mode: 'cloud_passage_grounded', status: 'qualified', message: 'Offline test only.',
  claims: [{ id: 'c1', text: 'Synthetic explanation.', qualifications: [...new Set(data.passages.flatMap(p => p.qualifications))].sort(), evidence_ids: data.passages.map(p=>p.id) }],
  evidence: data.passages.map(p => ({ id: p.id, source_id: p.source_id, locator: p.locator, excerpt: p.text })),
  sources: data.sources, release: { id: 'scope2-website', version: '1', sha256: RELEASE_SHA256 }, provider: { mode: 'live', model: 'offline-controlled-provider' }, missing_context: [], correction_attempted: false, correction_kind: null as 'draft_contract'|'source_review'|null,
  retrieval: { mode: 'cloud', store: 'Supabase', search: 'Pinecone', build_id: '63f0190c-9694-46db-9ea8-85445a80f6be', release_sha256: RELEASE_SHA256, candidate_ids: [data.passages[0]!.id], selected_ids: data.passages.map(p=>p.id), checked_at: '2026-09-09T07:00:00Z' },
} }
const status = (remaining_stages: number) => ({ service: 'neuvetra-research-cloud', answer_mode: 'cloud_passage_grounded', data_connection: 'cloud', readiness: 'ready', remaining_stages })
const response = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { 'Content-Type': 'application/json' } })
const events = (file: string) => readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line))

test('fixture selection sends only question contract, preserves explicit outcomes and refuses duplicate/unknown IDs', () => {
  const f = { schema_version: 1, fixture_id: 'offline', question_cases: [{ ...item, required_facets: ['never send me'], forbidden_claims: ['QA only'], support_ids: ['S01'] },
    { id: 'W02', question: 'Synthetic missing context?', expected_outcome: 'needs_context', acceptable_statuses: ['needs_input','unsupported'] }] }
  expect(selectQuestionCases(f, ['W01'])).toEqual([item])
  expect(selectQuestionCases(f, ['W02'])[0]!.acceptable_statuses).toEqual(['needs_input','unsupported'])
  expect(() => selectQuestionCases(f, ['W01','W01'])).toThrow('invalid_case_selection')
  expect(() => selectQuestionCases(f, ['W99'])).toThrow('invalid_fixture_case')
  expect(() => selectQuestionCases({ ...f, question_cases: [f.question_cases[0],f.question_cases[0]] }, ['W01'])).toThrow('invalid_fixture')
})
test('mechanical source checks reject altered passage, missing dependency/qualification, wrong pin and unsafe source URL', () => {
  expect(checkMechanical(answer(), item, evidence).mechanical_checks_passed).toBe(true)
  for (const change of ['text','dependency','qualification','extra_qualification','pin','url']) {
    const a = answer()
    if (change === 'text') a.evidence[0]!.excerpt = 'Invented quote'
    if (change === 'dependency') { a.claims[0]!.evidence_ids = ['S01']; a.evidence = a.evidence.slice(0,1) }
    if (change === 'qualification') { a.claims[0]!.qualifications = []; a.status = 'supported' }
    if (change === 'extra_qualification') a.claims[0]!.qualifications.push('An invented extra condition.')
    if (change === 'pin') { a.release.sha256 = '0'.repeat(64); a.retrieval.release_sha256 = a.release.sha256 }
    if (change === 'url') a.sources = [{ ...source, canonical_url: 'https://untrusted.example/document' }]
    expect(checkMechanical(a, item, evidence).mechanical_checks_passed).toBe(false)
  }
  expect(checkMechanical(answer(), { ...item, expected_outcome: 'safe_boundary' }, evidence).outcome_aligned).toBeNull()
  // A deliberately unrelated claim still needs independent semantic judgment.
  const unrelated = answer(); unrelated.claims[0]!.text = 'An unrelated unsupported nonnumeric claim.'
  expect(checkMechanical(unrelated, item, evidence).semantic_review).toBe('pending')
  const stale = { ...answer(), status:'stale_or_conflicting', claims:[], evidence:[], sources:[], retrieval:null }
  expect(checkMechanical(stale,{...item,expected_outcome:'unsupported'},evidence).outcome_aligned).toBe(false)
})
test('single first attempt uses fixed loopback/origin, only question, and flushed ordered evidence without semantic pass', async () => {
  const s = setup(), calls: { url: string; init: RequestInit }[] = []
  const packets = [status(40), answer(s.prepared.evidence), status(37)]
  const result = await evaluateWebsiteCloud({ ...s, fetch: async (url, init) => {
    calls.push({ url, init }); const rows = events(s.outputPath)
    expect(rows.at(-1).event).toBe(calls.length === 1 ? 'status_before_started' : calls.length === 2 ? 'answer_started' : 'status_after_started')
    return response(packets.shift())
  } })
  expect(result.state).toBe('recorded'); expect(result.semantic_review).toBe('pending'); expect(result.cases[0]!.stages_consumed).toBe(3)
  expect(calls.map(c => c.url)).toEqual([`${ENDPOINT}/research/status`,`${ENDPOINT}/research/answer`,`${ENDPOINT}/research/status`])
  expect(calls.every(c => c.init.redirect === 'error' && (c.init.headers as Record<string,string>).Origin === ORIGIN && c.init.signal instanceof AbortSignal)).toBe(true)
  expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ question: s.prepared.cases[0]!.question })
  expect(calls[0]!.init.body).toBeUndefined()
  expect(events(s.outputPath).map(e => e.sequence)).toEqual(events(s.outputPath).map((_,i) => i))
  expect(events(s.outputPath).at(-1).event).toBe('run_finished')
})
test('uncertain transport stops after one POST with safe failure, no retry or next question', async () => {
  const s = setup(['W01','W02']); let calls = 0
  const result = await evaluateWebsiteCloud({ ...s, fetch: async () => { calls++; if (calls === 1) return response(status(40)); throw Error('secret provider text must never be saved') } })
  expect(calls).toBe(2); expect(result.stop_reason).toBe('answer_outcome_uncertain')
  expect(events(s.outputPath).some(e => e.event === 'answer_failed' && e.outcome === 'uncertain')).toBe(true)
  expect(readFileSync(s.outputPath,'utf8')).not.toContain('secret provider text')
})
test('not-ready budget refuses answer; counter increases halt remaining cases after saving actual response', async () => {
  const a = setup(); let calls = 0
  const notReady = await evaluateWebsiteCloud({ ...a, fetch: async () => { calls++; return response(status(4)) } })
  expect(notReady.stop_reason).toBe('service_not_ready'); expect(calls).toBe(1)
  const b = setup(['W01','W02']); const packets = [status(40),answer(b.prepared.evidence),status(41)]; calls = 0
  const changed = await evaluateWebsiteCloud({ ...b, fetch: async () => { calls++; return response(packets.shift()) } })
  expect(changed.stop_reason).toBe('counter_inconsistent'); expect(calls).toBe(3); expect(changed.cases.length).toBe(1)
})
test('existing output, changed runtime pin and paths outside private root refuse before network', async () => {
  const s = setup(); let calls = 0; const fetch = async () => { calls++; return response(status(40)) }
  writeFileSync(s.outputPath, 'preserve this')
  await expect(evaluateWebsiteCloud({ ...s, fetch })).rejects.toBeInstanceOf(Error)
  expect(readFileSync(s.outputPath,'utf8')).toBe('preserve this')
  writeFileSync(s.pinFile,'changed')
  await expect(evaluateWebsiteCloud({ ...s, fetch })).rejects.toThrow('runtime_files_changed')
  const t = setup()
  await expect(evaluateWebsiteCloud({ ...t, outputPath: path.join(root,'outside.jsonl'), fetch })).rejects.toThrow('output_outside_private_root')
  expect(calls).toBe(0)
})
test('safe explicit abstention and invalid response are recorded distinctly without retries or semantic success', async () => {
  const s = setup()
  const a = { ...answer(), status: 'unsupported', claims: [], evidence: [], sources: [], retrieval: null }
  let packets: unknown[] = [status(40),a,status(39)]
  const valid = await evaluateWebsiteCloud({ ...s, fetch: async () => response(packets.shift()) })
  expect(valid.cases[0]!.outcome_aligned).toBe(false); expect(valid.semantic_review).toBe('pending')
  const t = setup(); packets = [status(40),{ message: 'bad payload' },status(39)]
  const invalid = await evaluateWebsiteCloud({ ...t, fetch: async () => response(packets.shift()) })
  expect(invalid.state).toBe('recorded'); expect(invalid.cases.length).toBe(1)
  expect(invalid.cases[0]!.mechanical_checks_passed).toBe(false)
})
test('sealed fixture, evidence, pins and root reject mutation or foreign preparations before I/O', async () => {
  for (const field of ['case','evidence','pins','fixture','root','clone']) {
    const s=setup(); let calls=0
    if(field==='case') s.prepared.cases[0]!.question='Altered after preparation'
    if(field==='evidence') s.prepared.evidence.passages[0]!.text='Altered source'
    if(field==='pins') s.prepared.pins={}
    if(field==='fixture') s.prepared.fixture_id='changed'
    if(field==='root') s.prepared.repoRoot=root
    if(field==='clone') s.prepared=structuredClone(s.prepared)
    await expect(evaluateWebsiteCloud({...s,fetch:async()=>{calls++;return response(status(40))}})).rejects.toThrow('preparation_changed_or_untrusted')
    expect(calls).toBe(0)
  }
})
test('successful stage counts bind exactly to explicit correction kind; unknown or contradictory metadata never passes',async()=>{
  for(const [kind,stages] of [[null,3],['draft_contract',4],['source_review',5]] as const) {
    for(const wrong of [false,true]) {
      const s=setup(),a=answer(s.prepared.evidence);a.correction_kind=kind;a.correction_attempted=kind!==null
      const packets=[status(40),a,status(40-(wrong?(stages===4?5:4):stages))]
      const result=await evaluateWebsiteCloud({...s,fetch:async()=>response(packets.shift())})
      expect(result.cases[0]!.answered_stage_count_valid).toBe(!wrong)
      expect(result.cases[0]!.mechanical_checks_passed).toBe(!wrong)
    }
  }
  for(const fields of [{correction_kind:'unknown',correction_attempted:true},{correction_kind:'source_review',correction_attempted:false},{correction_kind:null,correction_attempted:true}]) {
    const s=setup(),a={...answer(s.prepared.evidence),...fields},packets=[status(40),a,status(35)]
    const result=await evaluateWebsiteCloud({...s,fetch:async()=>response(packets.shift())})
    expect(result.cases[0]!.mechanical_checks_passed).toBe(false)
  }
})

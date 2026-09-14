/** Explicit local evaluation only. Imports perform no I/O. No ENV, credentials,
 * automatic retries or semantic-success claim. The fixture does not authorize I/O.
 * An exclusive JSONL journal retains every flushed first-attempt event; the caller
 * may save the returned complete result separately with its own exclusive writer.
 */
import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync, writeSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { isResearchAnswer, type ResearchAnswer } from '../../apps/site-web/src/lib/research-api'

export const ENDPOINT = 'http://127.0.0.1:3016'
export const ORIGIN = 'http://localhost:5174'
export const FIXTURE_SHA256 = '9a97060e47b46dd6d6729967b51692ab38f89b91e5c0be74ad46bf3f037625cc'
export const RELEASE_SHA256 = '38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f'
const RELEASE_PATH = 'data/research/releases/scope2-website.v1.json'
const MAX_RESPONSE = 1_000_000
type Row = Record<string, unknown>
type Outcome = 'answer' | 'needs_context' | 'unsupported' | 'safe_boundary'
interface Case { id: string; question: string; expected_outcome: Outcome; acceptable_statuses?: string[] }
interface Source { id: string; title: string; version: string; status: string; canonical_url: string; sha256: string }
interface Passage { id: string; source_id: string; text: string; locator: string; required_passage_ids: string[]; qualifications: string[] }
interface Evidence { release_id: string; version: string; sources: Source[]; passages: Passage[]; extractions: { sha256: string; source_sha256: string }[] }
export interface PreparedEvaluation { repoRoot: string; fixture_sha256: string; fixture_id: string; cases: Case[]; pins: Record<string, string>; evidence: Evidence }
const preparations = new WeakMap<PreparedEvaluation, { digest: string; snapshot: PreparedEvaluation }>()
export class EvaluationError extends Error { constructor(public readonly code: string) { super(code) } }
const need = (ok: unknown, code: string): void => { if (!ok) throw new EvaluationError(code) }
const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v)
export const sha256 = (v: Uint8Array | string) => createHash('sha256').update(v).digest('hex')
function json(bytes: Uint8Array): unknown { try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new EvaluationError('invalid_json') } }
function readPinned(file: string): Buffer { const info = lstatSync(file); need(info.isFile() && !info.isSymbolicLink() && info.size <= 2_000_000, 'invalid_pin_file'); return readFileSync(file) }

/** Kept pure for offline fixture-contract tests. Never sends QA metadata to API. */
export function selectQuestionCases(value: unknown, ids: string[]): Case[] {
  need(record(value) && value.schema_version === 1 && typeof value.fixture_id === 'string' && Array.isArray(value.question_cases), 'invalid_fixture')
  const raw = value as Row, rows = raw.question_cases as unknown[]
  need(ids.length > 0 && ids.length <= 18 && new Set(ids).size === ids.length && ids.every(id => /^W\d{2}$/.test(id)), 'invalid_case_selection')
  need(rows.every(record) && new Set(rows.map(r => (r as Row).id)).size === rows.length, 'invalid_fixture')
  return ids.map(id => {
    const c = rows.find(r => (r as Row).id === id) as Row | undefined
    need(c && typeof c.question === 'string' && c.question.trim().length > 0 && c.question.length <= 2000
      && ['answer', 'needs_context', 'unsupported', 'safe_boundary'].includes(String(c.expected_outcome)), 'invalid_fixture_case')
    if (c!.acceptable_statuses !== undefined) need(Array.isArray(c!.acceptable_statuses) && c!.acceptable_statuses.every(x => typeof x === 'string' && ['supported','qualified','needs_input','unsupported','stale_or_conflicting','needs_review','unavailable'].includes(x)), 'invalid_fixture_case')
    return { id, question: c!.question as string, expected_outcome: c!.expected_outcome as Outcome,
      ...(c!.acceptable_statuses === undefined ? {} : { acceptable_statuses: [...c!.acceptable_statuses as string[]] }) }
  })
}

export function prepareEvaluation(options: { fixtureBytes: Uint8Array; fixtureSha256: string; caseIds: string[]; repoRoot: string }): PreparedEvaluation {
  need(options.fixtureSha256 === FIXTURE_SHA256 && sha256(options.fixtureBytes) === FIXTURE_SHA256, 'fixture_pin_mismatch')
  const fixture = json(options.fixtureBytes), cases = selectQuestionCases(fixture, options.caseIds), repoRoot = realpathSync(options.repoRoot)
  const pins: Record<string, string> = {}
  const paths = ['tools/research/evaluate-website-cloud.ts', 'apps/site-web/src/lib/research-api.ts', 'data/research/conditions/scope2-website.v1.json', RELEASE_PATH]
  for (const dir of ['apps/site-api/src/research-cloud', 'apps/site-api/src/research-passages', 'apps/site-api/src/research']) {
    for (const f of readdirSync(path.join(repoRoot, dir)).sort()) if (f.endsWith('.ts')) paths.push(`${dir}/${f}`)
  }
  for (const f of ['apps/site-api/src/research-cloud-server.ts', 'apps/site-api/src/research-passages-server.ts']) paths.push(f)
  for (const relative of paths.sort()) pins[relative] = sha256(readPinned(path.join(repoRoot, relative)))
  need(pins[RELEASE_PATH] === RELEASE_SHA256, 'release_pin_mismatch')
  const evidence = json(readPinned(path.join(repoRoot, RELEASE_PATH))) as Evidence
  need(evidence.release_id === 'scope2-website' && evidence.version === '1' && Array.isArray(evidence.sources) && Array.isArray(evidence.passages) && Array.isArray(evidence.extractions), 'invalid_release')
  // These are approved release declarations. Cloud repository separately verifies
  // remote bytes; this evaluator does not pretend it downloaded original objects.
  need(evidence.sources.length === 1 && evidence.sources[0]!.sha256 === '14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3'
    && evidence.extractions.length === 1 && evidence.extractions[0]!.source_sha256 === evidence.sources[0]!.sha256
    && evidence.extractions[0]!.sha256 === '6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4', 'source_pin_mismatch')
  const prepared = { repoRoot, fixture_sha256: FIXTURE_SHA256, fixture_id: (fixture as Row).fixture_id as string, cases, pins, evidence }
  preparations.set(prepared, { digest: sha256(JSON.stringify(prepared)), snapshot: structuredClone(prepared) })
  return prepared
}
function unchanged(prepared: PreparedEvaluation) { for (const [f, pin] of Object.entries(prepared.pins)) need(sha256(readPinned(path.join(prepared.repoRoot, f))) === pin, 'runtime_files_changed') }

export function checkMechanical(value: unknown, item: Case, evidence: Evidence) {
  const decoder_valid = isResearchAnswer(value), checks: Record<string, boolean> = { decoder_valid }
  if (!decoder_valid) return { checks, mechanical_checks_passed: false, outcome_aligned: false, semantic_review: 'pending' as const }
  const a = value as ResearchAnswer, answered = a.status === 'supported' || a.status === 'qualified'
  checks.cloud_mode = a.answer_mode === 'cloud_passage_grounded'
  checks.release_pin = a.release === null ? !answered : a.release.id === evidence.release_id && a.release.version === evidence.version && a.release.sha256 === RELEASE_SHA256
  if (answered) {
    checks.source_metadata = a.sources.every(s => evidence.sources.some(original => ['id','title','version','status','canonical_url'].every(k => s[k as keyof typeof s] === original[k as keyof Source])))
    checks.exact_passages = a.evidence.every(e => evidence.passages.some(p => p.id === e.id && p.source_id === e.source_id && p.text === e.excerpt && p.locator === e.locator))
    checks.selected_ids_known = !!a.retrieval && [...a.retrieval.candidate_ids, ...a.retrieval.selected_ids].every(id => evidence.passages.some(p => p.id === id))
    checks.claim_context_closed = a.claims.every(c => {
      const cited = c.evidence_ids.map(id => evidence.passages.find(p => p.id === id))
      if (!cited.every(p => p && p.required_passage_ids.every(dep => c.evidence_ids.includes(dep)))) return false
      const expected = [...new Set(cited.flatMap(p => p!.qualifications))].sort()
      return JSON.stringify([...c.qualifications].sort()) === JSON.stringify(expected)
    })
  }
  const defaults: Record<Exclude<Outcome, 'safe_boundary'>, string[]> = { answer: ['supported','qualified'], needs_context: ['needs_input'], unsupported: ['unsupported'] }
  const outcome_aligned = item.expected_outcome === 'safe_boundary' ? null : (item.acceptable_statuses ?? defaults[item.expected_outcome]).includes(a.status)
  return { checks, mechanical_checks_passed: Object.values(checks).every(Boolean), outcome_aligned, semantic_review: 'pending' as const }
}
function budget(value: unknown): number {
  need(record(value) && value.service === 'neuvetra-research-cloud' && value.answer_mode === 'cloud_passage_grounded'
    && value.data_connection === 'cloud' && Number.isInteger(value.remaining_stages) && Number(value.remaining_stages) >= 0 && Number(value.remaining_stages) <= 200, 'status_invalid')
  return Number((value as Row).remaining_stages)
}
type Fetch = (url: string, init: RequestInit) => Promise<Response>
async function request(fetcher: Fetch, route: 'status' | 'answer', question?: string) {
  const response = await fetcher(`${ENDPOINT}/research/${route}`, { method: route === 'status' ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(route === 'answer' ? 245000 : 30000),
    headers: { Origin: ORIGIN, ...(route === 'answer' ? { 'Content-Type': 'application/json' } : {}) }, ...(route === 'answer' ? { body: JSON.stringify({ question }) } : {}) })
  need(response.body !== null, 'response_empty')
  const reader = response.body!.getReader(), chunks: Uint8Array[] = []; let size = 0
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; need(size <= MAX_RESPONSE, 'response_too_large'); chunks.push(part.value) } }
  finally { await reader.cancel().catch(() => {}) }
  const bytes = Buffer.concat(chunks)
  let body: unknown
  try { body = json(bytes) } catch { return { http_status: response.status, body: null, invalid_json_text: new TextDecoder().decode(bytes) } }
  return { http_status: response.status, body }
}

export async function evaluateWebsiteCloud(options: { prepared: PreparedEvaluation; outputPath: string; fetch?: Fetch; now?: () => number }) {
  const sealed = preparations.get(options.prepared)
  need(sealed && sealed.digest === sha256(JSON.stringify(options.prepared)), 'preparation_changed_or_untrusted')
  const p = structuredClone(sealed!.snapshot), fetcher = options.fetch ?? fetch, now = options.now ?? Date.now
  unchanged(p)
  need(path.isAbsolute(options.outputPath) && path.extname(options.outputPath) === '.jsonl', 'invalid_output_path')
  const privateRoot = realpathSync(path.join(p.repoRoot, '.superpowers')), parent = realpathSync(path.dirname(options.outputPath))
  const relative = path.relative(privateRoot, parent)
  need(relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)), 'output_outside_private_root')
  const fd = openSync(options.outputPath, 'wx', 0o600)
  let sequence = 0, stop_reason: string | null = null
  const results: Row[] = []
  const save = (event: Row) => { const line = Buffer.from(JSON.stringify({ sequence: sequence++, recorded_at: new Date(now()).toISOString(), ...event }) + '\n'); let offset = 0; while (offset < line.length) { const n = writeSync(fd, line, offset); need(n > 0, 'journal_failed'); offset += n } fsyncSync(fd) }
  try {
    save({ event: 'run_started', endpoint: ENDPOINT, origin: ORIGIN, fixture_id: p.fixture_id, fixture_sha256: p.fixture_sha256,
      case_ids: p.cases.map(c => c.id), pins: p.pins, runtime_pin_origin: 'local_files_coordinator_must_bind_to_server_launch', source_pins: { origin: 'approved_release_declarations', sources: p.evidence.sources.map(s => s.sha256), extractions: p.evidence.extractions.map(e => e.sha256) }, semantic_review: 'pending', automatic_retries: 0 })
    for (const item of p.cases) {
      unchanged(p)
      save({ event: 'status_before_started', case_id: item.id })
      const before = await request(fetcher, 'status'); save({ event: 'status_before', case_id: item.id, ...before })
      const remaining = budget(before.body)
      need(before.http_status === 200 && (before.body as Row).readiness === 'ready' && remaining >= 5, 'service_not_ready')
      const started = now()
      save({ event: 'answer_started', case_id: item.id, question: item.question, expected_outcome: item.expected_outcome, counters_before: remaining })
      let response: Awaited<ReturnType<typeof request>>
      try { response = await request(fetcher, 'answer', item.question) }
      catch (error) { save({ event: 'answer_failed', case_id: item.id, duration_ms: now() - started, error: error instanceof EvaluationError ? error.code : 'transport_failed', outcome: 'uncertain', retry_attempts: 0 }); throw new EvaluationError('answer_outcome_uncertain') }
      const duration = now() - started
      save({ event: 'answer_received', case_id: item.id, duration_ms: duration, ...response })
      save({ event: 'status_after_started', case_id: item.id })
      const after = await request(fetcher, 'status'); save({ event: 'status_after', case_id: item.id, ...after })
      const afterRemaining = budget(after.body), consumed = remaining - afterRemaining
      const mechanical = checkMechanical(response.body, item, p.evidence)
      const answered = isResearchAnswer(response.body) && ['supported','qualified'].includes(response.body.status)
      const correction = (response.body as ResearchAnswer | null)?.correction_kind
      const expectedStages = correction === null ? 3 : correction === 'draft_contract' ? 4 : correction === 'source_review' ? 5 : null
      const answered_stage_count_valid = !answered || consumed === expectedStages
      const result = { ...item, response: response.body, http_status: response.http_status, duration_ms: duration, counters_before: remaining, counters_after: afterRemaining, stages_consumed: consumed,
        counter_consistent: after.http_status === 200 && consumed >= 0 && consumed <= 5, ...mechanical,
        http_success: response.http_status === 200, answered_stage_count_valid,
        mechanical_checks_passed: response.http_status === 200 && mechanical.mechanical_checks_passed && answered_stage_count_valid }
      results.push(result); save({ event: 'case_completed', result })
      need(result.counter_consistent, 'counter_inconsistent')
    }
    unchanged(p)
  } catch (error) {
    stop_reason = error instanceof EvaluationError ? error.code : 'evaluation_failed'
    save({ event: 'run_stopped', reason: stop_reason, completed_cases: results.length })
  } finally { try { save({ event: 'run_finished', state: stop_reason ? 'stopped' : 'recorded', stop_reason, completed_cases: results.length, semantic_review: 'pending' }) } finally { closeSync(fd) } }
  return { state: stop_reason ? 'stopped' : 'recorded', stop_reason, fixture_sha256: p.fixture_sha256, pins: p.pins, cases: results, semantic_review: 'pending', automatic_retries: 0 }
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2), allowed = new Set(['--fixture','--fixture-sha256','--case-ids','--output']), values = new Map<string,string>()
    need(args.length === 8, 'invalid_arguments')
    for (let i=0;i<args.length;i+=2) { need(allowed.has(args[i]!) && !values.has(args[i]!) && !!args[i+1], 'invalid_arguments'); values.set(args[i]!,args[i+1]!) }
    const prepared = prepareEvaluation({ fixtureBytes: readPinned(values.get('--fixture')!), fixtureSha256: values.get('--fixture-sha256')!, caseIds: values.get('--case-ids')!.split(','), repoRoot: process.cwd() })
    const result = await evaluateWebsiteCloud({ prepared, outputPath: path.resolve(values.get('--output')!) })
    console.log(JSON.stringify({ state: result.state, stop_reason: result.stop_reason, recorded_cases: result.cases.length, semantic_review: result.semantic_review }))
    if (result.state === 'stopped') process.exitCode = 1
  } catch (error) { console.error(JSON.stringify({ error: error instanceof EvaluationError ? error.code : 'evaluation_failed' })); process.exitCode = 1 }
}

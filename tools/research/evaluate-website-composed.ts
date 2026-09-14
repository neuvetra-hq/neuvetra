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
  const fixture = json(options.fixtureBytes), cases = selectQuestionCases(fixture, options.caseIds)
  return preparePinnedCases(options.repoRoot, FIXTURE_SHA256, (fixture as Row).fixture_id as string, cases)
}

/** Separately pinned, question-only inputs. No QA answers, source pages or labels
 * are accepted here, and this cannot replace the immutable baseline fixture. */
export function prepareQuestionOnlyEvaluation(options: { fixtureBytes: Uint8Array; fixtureSha256: string; caseIds: string[]; repoRoot: string }): PreparedEvaluation {
  need(/^[a-f0-9]{64}$/.test(options.fixtureSha256) && sha256(options.fixtureBytes) === options.fixtureSha256 && options.fixtureSha256 !== FIXTURE_SHA256, 'fixture_pin_mismatch')
  const fixture = json(options.fixtureBytes)
  need(record(fixture) && Object.keys(fixture).sort().join(',') === 'fixture_id,question_cases,schema_version'
    && fixture.schema_version === 1 && typeof fixture.fixture_id === 'string' && /^[a-z0-9-]{1,100}$/.test(fixture.fixture_id)
    && Array.isArray(fixture.question_cases), 'invalid_question_only_fixture')
  const rows = (fixture as Row).question_cases as Row[]
  need(rows.length > 0 && rows.length <= 16 && rows.every(r => record(r) && Object.keys(r).sort().join(',') === 'id,question'
    && typeof r.id === 'string' && /^[A-Z][A-Z0-9-]{1,39}$/.test(r.id) && typeof r.question === 'string' && r.question.trim().length > 0 && r.question.length <= 2000)
    && new Set(rows.map(r => r.id)).size === rows.length, 'invalid_question_only_fixture')
  need(options.caseIds.length > 0 && new Set(options.caseIds).size === options.caseIds.length && options.caseIds.every(id => rows.some(r => r.id === id)), 'invalid_case_selection')
  const cases: Case[] = options.caseIds.map(id => ({ id, question: rows.find(r => r.id === id)!.question as string, expected_outcome: 'safe_boundary' }))
  return preparePinnedCases(options.repoRoot, options.fixtureSha256, (fixture as Row).fixture_id as string, cases,
    ['tools/research/evaluate-website-questions.ts'])
}

function preparePinnedCases(root: string, fixtureSha: string, fixtureId: string, cases: Case[], extraPaths: string[] = []): PreparedEvaluation {
  const repoRoot = realpathSync(root)
  const pins: Record<string, string> = {}
  const paths = ['tools/research/evaluate-website-composed.ts', 'apps/site-web/src/lib/research-api.ts',
    'apps/site-web/src/lib/research-maintenance.ts', 'apps/site-web/src/data/reviewed-qualifications.json',
    'apps/site-web/src/components/ResearchAnswerPanel.tsx', 'apps/site-web/vite.config.ts',
    'data/research/conditions/scope2-website.v1.json', 'data/research/answer-units/scope2-website.v1.json',
    'data/research/answer-units/scope2-website.epa-inquiry.v1.json', 'data/research/capabilities/scope2-website.epa-inquiry.v1.json', 'data/research/answer-units/scope2-website.epa-acquisition.v1.json', 'data/research/capabilities/scope2-website.epa-acquisition.v1.json', 'data/research/capabilities/scope2-website.epa-route.v1.json', 'data/research/capabilities/scope2-website.epa-limitations.v1.json', RELEASE_PATH, ...extraPaths]
  for (const dir of ['apps/site-api/src/research-composed', 'apps/site-api/src/research-cloud', 'apps/site-api/src/research-passages', 'apps/site-api/src/research']) {
    for (const f of readdirSync(path.join(repoRoot, dir)).sort()) if (f.endsWith('.ts')) paths.push(`${dir}/${f}`)
  }
  for (const f of ['apps/site-api/src/research-composed-server.ts', 'apps/site-api/src/research-cloud-server.ts', 'apps/site-api/src/research-passages-server.ts']) paths.push(f)
  for (const relative of paths.sort()) pins[relative] = sha256(readPinned(path.join(repoRoot, relative)))
  need(pins[RELEASE_PATH] === RELEASE_SHA256, 'release_pin_mismatch')
  need(pins['data/research/answer-units/scope2-website.v1.json'] === 'c59ffac9c6e824b81174aac7f52bf3a36dfed516a7340ff40ff8ba758518ef1f', 'unit_catalog_pin_mismatch')
  need(pins['data/research/answer-units/scope2-website.epa-inquiry.v1.json'] === 'adb43b8a9e90cbe85f382988dedc16e16f82f7a596e0bcf5f5e98ba2f84630cd', 'unit_catalog_pin_mismatch')
  need(pins['data/research/capabilities/scope2-website.epa-inquiry.v1.json'] === '230060af16b77bde32e253ca49e9676e2603e9ceebe165eae33c0ef87ce6e823', 'capability_catalog_pin_mismatch')
  need(pins['data/research/answer-units/scope2-website.epa-acquisition.v1.json'] === '97b2c4e0f4121c1d2ea7fa33d569f53344193f12a80e9d1349577c3a86e17e50', 'unit_catalog_pin_mismatch')
  need(pins['data/research/capabilities/scope2-website.epa-acquisition.v1.json'] === 'd768f4beea51ae5cf8cc1ca21f8e7eba8ecdc00dd7994e118ed1a55f15b138fe', 'capability_catalog_pin_mismatch')
  need(pins['data/research/capabilities/scope2-website.epa-route.v1.json'] === '379447e6a7b6c8b4d1db2749e179afd20965b617cfb8c6693a61feb4d4a791d5', 'capability_catalog_pin_mismatch')
  need(pins['data/research/capabilities/scope2-website.epa-limitations.v1.json'] === 'a7724c245fed1fd3a9dd08a82886c107b54905693039150f33359b2ed629e2c2', 'capability_catalog_pin_mismatch')
  need(pins['data/research/conditions/scope2-website.v1.json'] === '063adbadbe9c70493a81228931c4e4ec4a833633d12c83e2ab48616bd876d2c6', 'condition_pin_mismatch')
  const evidence = json(readPinned(path.join(repoRoot, RELEASE_PATH))) as Evidence
  need(evidence.release_id === 'scope2-website' && evidence.version === '1' && Array.isArray(evidence.sources) && Array.isArray(evidence.passages) && Array.isArray(evidence.extractions), 'invalid_release')
  // These are approved release declarations. Cloud repository separately verifies
  // remote bytes; this evaluator does not pretend it downloaded original objects.
  need(evidence.sources.length === 1 && evidence.sources[0]!.sha256 === '14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3'
    && evidence.extractions.length === 1 && evidence.extractions[0]!.source_sha256 === evidence.sources[0]!.sha256
    && evidence.extractions[0]!.sha256 === '6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4', 'source_pin_mismatch')
  const prepared = { repoRoot, fixture_sha256: fixtureSha, fixture_id: fixtureId, cases, pins, evidence }
  preparations.set(prepared, { digest: sha256(JSON.stringify(prepared)), snapshot: structuredClone(prepared) })
  return prepared
}
function unchanged(prepared: PreparedEvaluation) { for (const [f, pin] of Object.entries(prepared.pins)) need(sha256(readPinned(path.join(prepared.repoRoot, f))) === pin, 'runtime_files_changed') }

export function checkMechanical(value: unknown, item: Case, evidence: Evidence) {
  const decoder_valid = isResearchAnswer(value), checks: Record<string, boolean> = { decoder_valid }
  if (!decoder_valid) return { checks, mechanical_checks_passed: false, outcome_aligned: false, semantic_review: 'pending' as const }
  const a = value as ResearchAnswer, answered = a.status === 'supported' || a.status === 'qualified'
  checks.cloud_mode = a.answer_mode === 'cloud_reviewed_composition'
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
  need(record(value) && value.service === 'neuvetra-research-cloud' && value.answer_mode === 'cloud_reviewed_composition'
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

export interface RuntimeBinding { run_id: string; manifest_sha256: string; profile_sha256: string; process_id: number; port: 3016 }
export async function evaluateWebsiteComposed(options: { prepared: PreparedEvaluation; outputPath: string; fetch?: Fetch; now?: () => number; runtimeBinding?: RuntimeBinding; stageCeiling?: number; stopOnMechanicalFailure?: boolean }) {
  const sealed = preparations.get(options.prepared)
  need(sealed && sealed.digest === sha256(JSON.stringify(options.prepared)), 'preparation_changed_or_untrusted')
  const p = structuredClone(sealed!.snapshot), fetcher = options.fetch ?? fetch, now = options.now ?? Date.now
  unchanged(p)
  const runtimeBinding = options.runtimeBinding ? structuredClone(options.runtimeBinding) : undefined
  const stageCeiling = options.stageCeiling ?? p.cases.length * 5
  need(options.stopOnMechanicalFailure === undefined || typeof options.stopOnMechanicalFailure === 'boolean', 'invalid_mechanical_stop_policy')
  const stopOnMechanicalFailure = options.stopOnMechanicalFailure === true
  need(Number.isInteger(stageCeiling) && stageCeiling >= p.cases.length * 5 && stageCeiling <= 200, 'invalid_stage_ceiling')
  const checkBinding = (body: unknown) => {
    if (runtimeBinding) need(record(body) && record(body.runtime_binding)
      && Object.entries(runtimeBinding).every(([key, value]) => (body.runtime_binding as Row)[key] === value), 'runtime_binding_mismatch')
  }
  need(path.isAbsolute(options.outputPath) && path.extname(options.outputPath) === '.jsonl', 'invalid_output_path')
  const privateRoot = realpathSync(path.join(p.repoRoot, '.superpowers')), parent = realpathSync(path.dirname(options.outputPath))
  const relative = path.relative(privateRoot, parent)
  need(relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)), 'output_outside_private_root')
  const fd = openSync(options.outputPath, 'wx', 0o600)
  let sequence = 0, stop_reason: string | null = null, totalConsumed = 0
  const results: Row[] = []
  const save = (event: Row) => { const line = Buffer.from(JSON.stringify({ sequence: sequence++, recorded_at: new Date(now()).toISOString(), ...event }) + '\n'); let offset = 0; while (offset < line.length) { const n = writeSync(fd, line, offset); need(n > 0, 'journal_failed'); offset += n } fsyncSync(fd) }
  try {
    save({ event: 'run_started', endpoint: ENDPOINT, origin: ORIGIN, fixture_id: p.fixture_id, fixture_sha256: p.fixture_sha256,
      case_ids: p.cases.map(c => c.id), pins: p.pins, runtime_binding: runtimeBinding ?? null, stage_ceiling: stageCeiling, stop_on_mechanical_failure: stopOnMechanicalFailure, runtime_pin_origin: runtimeBinding ? 'coordinator_launch_manifest_and_process_status' : 'local_files_coordinator_must_bind_to_server_launch', source_pins: { origin: 'approved_release_declarations', sources: p.evidence.sources.map(s => s.sha256), extractions: p.evidence.extractions.map(e => e.sha256) }, semantic_review: 'pending', automatic_retries: 0 })
    for (const item of p.cases) {
      unchanged(p)
      save({ event: 'status_before_started', case_id: item.id })
      const before = await request(fetcher, 'status'); save({ event: 'status_before', case_id: item.id, ...before })
      checkBinding(before.body)
      const remaining = budget(before.body)
      need(before.http_status === 200 && (before.body as Row).readiness === 'ready' && remaining >= 5 && stageCeiling - totalConsumed >= 5, 'service_not_ready')
      const started = now()
      save({ event: 'answer_started', case_id: item.id, question: item.question, expected_outcome: item.expected_outcome, counters_before: remaining })
      let response: Awaited<ReturnType<typeof request>>
      try { response = await request(fetcher, 'answer', item.question) }
      catch (error) { save({ event: 'answer_failed', case_id: item.id, duration_ms: now() - started, error: error instanceof EvaluationError ? error.code : 'transport_failed', outcome: 'uncertain', retry_attempts: 0 }); throw new EvaluationError('answer_outcome_uncertain') }
      const duration = now() - started
      save({ event: 'answer_received', case_id: item.id, duration_ms: duration, ...response })
      save({ event: 'status_after_started', case_id: item.id })
      const after = await request(fetcher, 'status'); save({ event: 'status_after', case_id: item.id, ...after })
      checkBinding(after.body)
      const afterRemaining = budget(after.body), consumed = remaining - afterRemaining
      totalConsumed += consumed
      const mechanical = checkMechanical(response.body, item, p.evidence)
      const answered = isResearchAnswer(response.body) && ['supported','qualified'].includes(response.body.status)
      const correction = (response.body as ResearchAnswer | null)?.correction_kind
      const expectedStages = correction === null ? 3 : correction === 'selection_size' || correction === 'selection_contract' ? 4 : correction === 'source_review' ? 5 : null
      const reviewedOutcome = answered || (isResearchAnswer(response.body) && ['unsupported','needs_input'].includes(response.body.status))
      const answered_stage_count_valid = !reviewedOutcome || consumed === expectedStages
      const result = { ...item, response: response.body, http_status: response.http_status, duration_ms: duration, counters_before: remaining, counters_after: afterRemaining, stages_consumed: consumed,
        counter_consistent: after.http_status === 200 && consumed >= 0 && consumed <= 5, ...mechanical,
        http_success: response.http_status === 200, answered_stage_count_valid,
        mechanical_checks_passed: response.http_status === 200 && mechanical.mechanical_checks_passed && answered_stage_count_valid }
      results.push(result); save({ event: 'case_completed', result })
      need(result.counter_consistent, 'counter_inconsistent')
      // A provider rejection is shared infrastructure failure, not a distinct
      // semantic outcome to keep sampling. Retain its first response and stop.
      need(!(record(response.body) && ['provider_failure', 'provider_timeout', 'request_timeout'].includes(String(response.body.reason_code))), 'provider_request_failed')
      // This explicit campaign policy preserves the first response before stopping.
      // A valid technical boundary or semantic mismatch alone is not a mechanics failure.
      need(!stopOnMechanicalFailure || result.mechanical_checks_passed, 'mechanical_checks_failed')
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
    const result = await evaluateWebsiteComposed({ prepared, outputPath: path.resolve(values.get('--output')!) })
    console.log(JSON.stringify({ state: result.state, stop_reason: result.stop_reason, recorded_cases: result.cases.length, semantic_review: result.semantic_review }))
    if (result.state === 'stopped') process.exitCode = 1
  } catch (error) { console.error(JSON.stringify({ error: error instanceof EvaluationError ? error.code : 'evaluation_failed' })); process.exitCode = 1 }
}

/** Bounded single-process successor. CLI is implemented separately; importing does no I/O. */
import { closeSync, fsyncSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createPassageLoader, hash, PassageError } from '../../apps/site-api/src/research-passages/release';
import { createComposedAnswerService } from '../../apps/site-api/src/research-composed/answer';
import { composedRequestBody, createComposedProvider, openrouterProfileSha256, type ComposedStageEvent } from '../../apps/site-api/src/research-composed/provider';
import { estimateOpenRouterNanoUsd, openrouterPolicy, type OpenRouterStage, type OpenRouterSpending } from '../../apps/site-api/src/research-composed/openrouter';
import { analysisInput } from '../../apps/site-api/src/research-composed/question-analysis';
import { SOURCE_SHA } from '../../apps/site-api/src/research-composed/catalog';
import { CAPABILITY_SHA } from '../../apps/site-api/src/research-composed/capabilities';
import { catalogPath, capabilityPath, question, runId } from './m69-canary';

export function exclusive(file: string, value: unknown) {
  const bytes = JSON.stringify(value) + '\n';
  const fd = openSync(file, 'wx', 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  return hash(bytes);
}
export const stageOrder = ['analyze', 'plan', 'verify'] as const;
export const reservationNanoUsd = 3_948_410_000;
export function validNext(prior: readonly string[], stage: string) {
  const next = [...prior, stage];
  return next.length <= 5 && [['analyze','plan','verify'], ['analyze','plan','plan','verify'], ['analyze','plan','verify','plan','verify']].some(route => next.every((s,i) => s === route[i]));
}

/** Uses verified original PDF/extraction, with no cloud/index/tenant claim. */
export async function executeCanary(options: {
  root: string; directory: string; apiKey: string;
  transport?: (url: string, init: RequestInit) => Promise<Response>;
}) {
  const started = performance.now(), phases: string[] = [];
  const receipts: { attempt: number; stage: OpenRouterStage; reservation: number; settled: number | null; uncertain: boolean; dispatched: boolean }[] = [];
  let calls = 0, reserved = 0, logical = 0, sealed = false;
  const read = (file: string) => readFileSync(path.join(options.root, file));
  const journal = (name: string, value: unknown) => { if (sealed) throw Error('m69_already_sealed'); return exclusive(path.join(options.directory, name), value); };
  const loader = createPassageLoader({ releasePath: path.join(options.root, 'data/research/releases/scope2-website.v1.json'),
    expectedSha256: SOURCE_SHA, sourceRoots: ['C:/Users/nimab/Neuvetra/research-sources'] });
  const initial = await loader();
  const binding = { scopeId: runId, buildId: 'local-pinned-corpus', namespace: 'no-cloud-index',
    releaseId: initial.release.release_id, releaseVersion: initial.release.version, releaseSha256: SOURCE_SHA,
    profileSha256: openrouterProfileSha256, sourceSha256: initial.release.sources.map(s => s.sha256) };
  const spending: OpenRouterSpending = {
    check(stage, body) {
      if (!validNext(phases, stage) || receipts.some(r => r.settled === null || r.uncertain)) throw new PassageError('budget_exhausted');
      if (reserved + estimateOpenRouterNanoUsd(stage, body) > reservationNanoUsd) throw new PassageError('budget_exhausted');
    },
    reserve(attempt, stage, body) {
      spending.check(stage, body);
      const value = estimateOpenRouterNanoUsd(stage, body);
      if (attempt !== receipts.length + 1) throw new PassageError('budget_exhausted');
      journal(`attempt-${attempt}-reserved.json`, { attempt, stage, request_body_sha256: hash(body), request_body_bytes: Buffer.byteLength(body), reservation_nano_usd: value });
      journal(`attempt-${attempt}-request.json`, { body_utf8: body });
      receipts.push({ attempt, stage, reservation: value, settled: null, uncertain: false, dispatched: false });
      phases.push(stage); reserved += value;
    },
    settle(attempt, cost, source) {
      const item = receipts[attempt - 1];
      if (!item || !item.dispatched || item.settled !== null || !Number.isSafeInteger(cost) || cost < 0) throw Error('m69_settlement_refused');
      journal(`attempt-${attempt}-settled.json`, { attempt, cost_nano_usd: cost, cost_source: source });
      item.settled = cost;
      if (cost > item.reservation) { item.uncertain = true; throw Error('m69_cost_exceeds_reservation'); }
    },
    uncertain(attempt) {
      const item = receipts[attempt - 1];
      if (!item) throw Error('m69_missing_attempt');
      item.uncertain = true;
      journal(`attempt-${attempt}-uncertain.json`, { attempt, native_settled_nano_usd: item.settled, dispatched: item.dispatched });
    },
  };
  const events: { path: string; sha256: string }[] = [];
  const provider = createComposedProvider({ apiKey: options.apiKey, transport: 'openrouter', spending,
    budget: { maxCalls: 5, remaining: () => 5 - logical, reserve(stage) {
      if (logical >= 5 || !validNext(phases, stage)) throw new PassageError('budget_exhausted');
      logical++; return logical;
    } },
    fetch: async (url, init) => {
      if (url !== openrouterPolicy.endpoint || init.method !== 'POST' || init.redirect !== 'error') throw Error('m69_transport_refused');
      const item = receipts.at(-1);
      if (!item || item.dispatched || calls >= 5) throw Error('m69_dispatch_refused');
      journal(`attempt-${item.attempt}-dispatch-intent.json`, { attempt: item.attempt, recorded_at: new Date().toISOString() });
      // Intent is durable before transport; a crash in this interval remains uncertain.
      item.dispatched = true; calls++;
      return (options.transport ?? fetch)(url, init);
    },
    onStage(event: ComposedStageEvent) {
      const { input, output, ...safe } = event;
      const value = { ...safe, input_sha256: input === undefined ? null : hash(JSON.stringify(input)), output_sha256: output === undefined ? null : hash(JSON.stringify(output)) };
      const file = `stage-${event.attempt}-${event.phase}.json`;
      events.push({ path: file, sha256: journal(file, value) });
    },
  });
  const pending = new Set<Promise<unknown>>();
  const trackedProvider = { model: provider.model, remaining: provider.remaining, invoke: (...args: Parameters<typeof provider.invoke>) => {
    const task = provider.invoke(...args); pending.add(task); void task.then(() => pending.delete(task), () => pending.delete(task)); return task;
  } };
  const service = createComposedAnswerService({ provider: trackedProvider,
    catalogBytes: read(catalogPath), catalogSha256: '97b2c4e0f4121c1d2ea7fa33d569f53344193f12a80e9d1349577c3a86e17e50',
    capabilityBytes: read(capabilityPath), capabilitySha256: CAPABILITY_SHA,
    repository: { async loadForQuestion() { const verified = await loader(); return { verified, binding, candidateIds: verified.passages.map(p => p.id) }; },
      async recheck() { await loader(); } },
  });
  let outcome: unknown = null, reason = 'not_started';
  try {
    await service.initialize();
    const serviceOutcome = await service.answer(question, AbortSignal.timeout(240000));
    if (serviceOutcome && typeof serviceOutcome === 'object') {
      const raw = serviceOutcome as Record<string, unknown>;
      const providerRecord = raw.provider && typeof raw.provider === 'object' ? raw.provider as Record<string, unknown> : {};
      const retrievalRecord = raw.retrieval && typeof raw.retrieval === 'object' ? raw.retrieval as Record<string, unknown> : null;
      outcome = { ...raw,
        provider: { ...providerRecord, mode: options.transport ? 'provider_disabled_fixture' : 'live' },
        retrieval: retrievalRecord === null ? null : { ...retrievalRecord, mode: 'local', store: 'verified_local_files', search: 'none' },
      };
    } else outcome = serviceOutcome;
    reason = 'terminal_answer';
    journal('answer.json', outcome);
  } catch { reason = 'runtime_failure'; }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const drained = await Promise.race([Promise.allSettled([...pending]).then(() => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 5000); })]);
  if (timer) clearTimeout(timer);
  if (!drained) { reason = 'shutdown_incomplete'; for (const receipt of receipts) if (receipt.settled === null) receipt.uncertain = true; }
  const answerStatus = outcome && typeof outcome === 'object' && 'status' in outcome ? outcome.status : null;
  const closure = { schema_version: 1, kind: 'm69_canary_closure', run_id: runId,
    execution_mode: options.transport ? 'provider_disabled_fixture' : 'live_provider',
    provider_requests: options.transport ? 0 : calls,
    reason, answer_status: answerStatus, answer_success: drained && ['qualified','supported'].includes(String(answerStatus)), question_sha256: hash(question), provider_transport_invocations: calls, logical_stages: logical,
    stages: phases, receipts, stage_events: events,
    known_settled_nano_usd: receipts.reduce((sum, r) => sum + (r.settled ?? 0), 0),
    exact_total_nano_usd: receipts.every(r => r.settled !== null && !r.uncertain) ? receipts.reduce((sum, r) => sum + r.settled!, 0) : null,
    elapsed_ms: Math.round(performance.now() - started), retries: 0, carry: 0,
    answer_sha256: outcome === null ? null : hash(JSON.stringify(outcome) + '\n'),
    source_binding: 'verified_local_original_and_extraction_no_cloud_retrieval',
    live_answer_accuracy: 'requires_independent_post_terminal_grading', controlled_exit: drained };
  journal('closure.json', closure);
  sealed = true;
  validateClosure(options.directory);
  return closure;
}

/** Read back durable bytes and reject cross-record corruption before printing a closure. */
export function validateClosure(directory: string) {
  const read = (file: string) => readFileSync(path.join(directory,file));
  const parse = (file: string) => JSON.parse(read(file).toString());
  const need = (ok: unknown) => { if (!ok) throw Error('m69_closure_invalid'); };
  const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
  const boolean = (value: unknown) => typeof value === 'boolean';
  const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const c = parse('closure.json');
  need(c.kind === 'm69_canary_closure' && c.run_id === runId && c.question_sha256 === hash(question));
  need(['provider_disabled_fixture','live_provider'].includes(c.execution_mode));
  need(integer(c.provider_requests) && integer(c.provider_transport_invocations) && integer(c.logical_stages));
  need(integer(c.known_settled_nano_usd) && (c.exact_total_nano_usd === null || integer(c.exact_total_nano_usd)));
  need(integer(c.elapsed_ms) && c.retries === 0 && c.carry === 0 && boolean(c.answer_success) && boolean(c.controlled_exit));
  need(Array.isArray(c.receipts) && c.receipts.length <= 5 && Array.isArray(c.stages) && c.stages.length === c.receipts.length);
  need(c.logical_stages === c.receipts.length);
  need(c.execution_mode === 'provider_disabled_fixture' ? c.provider_requests === 0 : c.provider_requests === c.provider_transport_invocations);
  need(c.source_binding === 'verified_local_original_and_extraction_no_cloud_retrieval');
  let known = 0, reserved = 0, calls = 0;
  const stageInputs = new Map<number, unknown>(), settlementSources = new Map<number, string>();
  for (const [index,r] of c.receipts.entries()) {
    need(r && typeof r === 'object' && r.attempt === index + 1 && r.stage === c.stages[index] && validNext(c.stages.slice(0,index),r.stage));
    need(integer(r.reservation) && (r.settled === null || integer(r.settled)) && boolean(r.uncertain) && boolean(r.dispatched));
    const a = parse(`attempt-${r.attempt}-reserved.json`), body = parse(`attempt-${r.attempt}-request.json`).body_utf8;
    need(a.attempt === r.attempt && a.stage === r.stage && typeof body === 'string' && a.request_body_sha256 === hash(body) && a.request_body_bytes === Buffer.byteLength(body));
    need(a.reservation_nano_usd === r.reservation && r.reservation === estimateOpenRouterNanoUsd(r.stage,body));
    const request = JSON.parse(body);
    const stage = r.stage as OpenRouterStage;
    need(Array.isArray(request.messages) && request.messages.length === 1 && request.messages[0]?.role === 'user' && typeof request.messages[0]?.content === 'string');
    const stageInput = JSON.parse(request.messages[0].content);
    need(body === composedRequestBody(stage, stageInput, 'openrouter'));
    if (stage === 'analyze') need(equal(stageInput, analysisInput(question)));
    stageInputs.set(r.attempt, stageInput);
    reserved += r.reservation;
    if (r.dispatched) { need(parse(`attempt-${r.attempt}-dispatch-intent.json`).attempt === r.attempt); calls++; }
    if (r.settled !== null) { const s = parse(`attempt-${r.attempt}-settled.json`); need(s.attempt === r.attempt && s.cost_nano_usd === r.settled && ['response','generation'].includes(s.cost_source)); settlementSources.set(r.attempt, s.cost_source); known += r.settled; }
    if (r.uncertain) { const u = parse(`attempt-${r.attempt}-uncertain.json`); need(u.attempt === r.attempt && u.native_settled_nano_usd === r.settled && u.dispatched === r.dispatched); }
    need(r.settled === null || r.dispatched);
    need(r.settled === null || r.settled <= r.reservation || (r.uncertain && index === c.receipts.length - 1));
    need(!r.uncertain || index === c.receipts.length - 1);
  }
  need(reserved <= reservationNanoUsd && calls === c.provider_transport_invocations && c.known_settled_nano_usd === known);
  need(c.exact_total_nano_usd === (c.receipts.every((r:any) => r.settled !== null && r.uncertain === false) ? known : null));
  const attemptFiles = readdirSync(directory).filter(f => /^attempt-\d+-(reserved|request|dispatch-intent|settled|uncertain)\.json$/.test(f)).sort();
  const expectedAttemptFiles = c.receipts.flatMap((r:any) => [`attempt-${r.attempt}-reserved.json`,`attempt-${r.attempt}-request.json`, ...(r.dispatched ? [`attempt-${r.attempt}-dispatch-intent.json`] : []), ...(r.settled !== null ? [`attempt-${r.attempt}-settled.json`] : []), ...(r.uncertain ? [`attempt-${r.attempt}-uncertain.json`] : [])]).sort();
  need(equal(attemptFiles, expectedAttemptFiles));
  const files = readdirSync(directory).filter(f => /^stage-\d+-(started|completed|failed)\.json$/.test(f)).sort();
  need(Array.isArray(c.stage_events) && new Set(c.stage_events.map((e:any) => e.path)).size === c.stage_events.length);
  need(JSON.stringify(files) === JSON.stringify(c.stage_events.map((e:any) => e.path).sort()));
  let completedStages = 0;
  for (const [index,r] of c.receipts.entries()) {
    const startedPath = `stage-${r.attempt}-started.json`, completedPath = `stage-${r.attempt}-completed.json`, failedPath = `stage-${r.attempt}-failed.json`;
    need(files.includes(startedPath));
    need(files.includes(completedPath) !== files.includes(failedPath));
    const started = parse(startedPath);
    need(started.stage === r.stage && started.attempt === r.attempt && started.phase === 'started' && started.input_sha256 === hash(JSON.stringify(stageInputs.get(r.attempt))) && started.output_sha256 === null);
    const completed = files.includes(completedPath), terminal = parse(completed ? completedPath : failedPath);
    need(terminal.stage === r.stage && terminal.attempt === r.attempt && terminal.phase === (completed ? 'completed' : 'failed'));
    need(terminal.input_sha256 === null && (completed ? digest(terminal.output_sha256) : terminal.output_sha256 === null));
    need(integer(terminal.elapsed_ms));
    const terminalCost = terminal.openrouter_cost;
    if (r.settled === null) need(terminalCost === undefined);
    else {
      need(terminalCost?.cost_nano_usd === r.settled && terminalCost?.cost_source === settlementSources.get(r.attempt));
      if (terminal.openrouter && Object.hasOwn(terminal.openrouter, 'cost_nano_usd')) {
        need(terminal.openrouter.cost_nano_usd === r.settled && terminal.openrouter.cost_source === settlementSources.get(r.attempt));
      }
    }
    if (completed) {
      completedStages++;
      const stage = r.stage as OpenRouterStage;
      need(terminal.http_status === 200 && terminal.stop_reason === 'end_turn');
      need(terminal.openrouter?.requested_model === openrouterPolicy.models[stage]);
      need([openrouterPolicy.models[stage], openrouterPolicy.canonical_models[openrouterPolicy.models[stage]]].includes(terminal.openrouter?.response_model));
      need(terminal.openrouter?.selected_provider === 'Anthropic' && terminal.openrouter?.reported_attempt === 1 && terminal.openrouter?.is_byok === false);
      need(r.settled !== null && terminal.openrouter?.cost_nano_usd === r.settled && terminal.openrouter?.cost_source === settlementSources.get(r.attempt));
    } else {
      need(typeof terminal.code === 'string' && terminal.code.length > 0 && index === c.receipts.length - 1);
    }
  }
  for (const event of c.stage_events) need(event && typeof event.path === 'string' && digest(event.sha256) && hash(read(event.path)) === event.sha256);
  if(c.answer_sha256 !== null) {
    need(digest(c.answer_sha256) && hash(read('answer.json')) === c.answer_sha256);
    const answer = parse('answer.json'); need(answer.status === c.answer_status);
    if (answer.retrieval !== null) need(answer.retrieval?.mode === 'local' && answer.retrieval?.store === 'verified_local_files' && answer.retrieval?.search === 'none');
    need(answer.provider?.mode === (c.execution_mode === 'provider_disabled_fixture' ? 'provider_disabled_fixture' : 'live'));
  } else need(!readdirSync(directory).includes('answer.json') && c.answer_status === null);
  const successfulStatus = ['qualified','supported'].includes(String(c.answer_status));
  need(c.answer_success === (c.controlled_exit && successfulStatus));
  if (c.answer_success) {
    need(c.reason === 'terminal_answer' && c.exact_total_nano_usd !== null && c.receipts.length >= 3);
    need(completedStages === c.receipts.length);
    need(['analyze,plan,verify','analyze,plan,plan,verify','analyze,plan,verify,plan,verify'].includes(c.stages.join(',')));
    need(c.receipts.every((r:any) => r.dispatched && r.settled !== null && r.uncertain === false));
  }
  return c;
}

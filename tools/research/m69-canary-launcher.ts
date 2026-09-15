/** Compile this launcher for paid use. No live switch exists on the preparation tool. */
import { readFileSync, realpathSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { hash } from '../../apps/site-api/src/research-passages/release';
import { executeCanary, exclusive, reservationNanoUsd } from './m69-canary-runtime';
import { runId, question, deadline } from './m69-canary';
import { openrouterPolicy } from '../../apps/site-api/src/research-composed/openrouter';

export const boundRoot = 'C:/Users/nimab/.codex/worktrees/7b4b/Neuvetra';
const samePath = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

const need = (ok: unknown) => { if (!ok) throw Error('m69_launch_refused'); };
const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function validateAdmission(a: any, candidateSha: string, executableSha: string, now = Date.now()) {
  need(a?.kind === 'm69_exact_paid_authorization' && a.run_id === runId && a.one_use === true);
  need(a.candidate_sha256 === candidateSha && a.executable_sha256 === executableSha);
  need(a.question_sha256 === hash(question) && a.reservation_nano_usd === reservationNanoUsd);
  need(a.board_authorized === true && a.maximum_stages === 5 && a.retry === false && a.carry === false);
  need(a.source_mode === 'verified_local_corpus_no_cloud_index' && a.customer_data === false);
  need(a.internal_estimate_not_provider_cap_acknowledged === true && digest(a.board_decision_sha256));
  need(digest(a.independent_review_sha256) && digest(a.source_review_sha256) && digest(a.account_evidence_sha256) && digest(a.endpoint_evidence_sha256));
  need(typeof a.nonce === 'string' && /^[A-Za-z0-9_-]{43}$/.test(a.nonce));
  const issued = Date.parse(a.issued_at), expires = Date.parse(a.expires_at);
  need(Number.isFinite(issued) && Number.isFinite(expires) && issued <= now && now - issued <= 60000 && expires > now && expires - issued <= 300000);
  need(now + 240000 < Date.parse(deadline));
  return true;
}

export async function main(args: string[]) {
  if (args[0] === '--rehearse') {
    need(args.length === 4 && samePath(realpathSync(args[1]!), boundRoot));
    need(samePath(realpathSync(process.execPath), path.join(boundRoot, '.superpowers/m69-build/m69-canary.exe')));
    const area = path.resolve(args[3]!);
    need(samePath(path.dirname(area), path.join(boundRoot,'.superpowers')) && /^m69-rehearsal-[a-z0-9-]+$/.test(path.basename(area)) && !existsSync(area));
    const fixture = JSON.parse(readFileSync(args[2]!, 'utf8'));
    need(fixture.kind === 'm69_synthetic_provider_fixture' && fixture.question_sha256 === hash(question) && Array.isArray(fixture.responses) && fixture.responses.length <= 5);
    mkdirSync(area);
    let cursor = 0;
    const closure = await executeCanary({ root: boundRoot, directory: area, apiKey: 'synthetic-provider-disabled', transport: async () => {
      const response = fixture.responses[cursor++]; need(response !== undefined); return Response.json(response);
    } });
    process.stdout.write(JSON.stringify(closure) + '\n'); return;
  }
  need(args.length === 3);
  const [rootArg, candidateArg, admissionArg] = args;
  const root = realpathSync(rootArg!), candidateBytes = readFileSync(candidateArg!), admissionBytes = readFileSync(admissionArg!);
  need(samePath(root, boundRoot));
  const candidate = JSON.parse(candidateBytes.toString()), admission = JSON.parse(admissionBytes.toString());
  const executable = realpathSync(process.execPath);
  need(samePath(executable, path.join(boundRoot, '.superpowers/m69-build/m69-canary.exe')));
  validateAdmission(admission, hash(candidateBytes), hash(readFileSync(executable)));
  need(candidate.kind === 'm69_reviewable_live_candidate' && candidate.run_id === runId && candidate.reservation_nano_usd === reservationNanoUsd);
  need(Array.isArray(candidate.pins) && candidate.pins.length > 30);
  for (const pin of candidate.pins) {
    need(typeof pin.path === 'string' && !path.isAbsolute(pin.path) && !pin.path.split(/[\\/]/).includes('..') && digest(pin.sha256));
    const target = realpathSync(path.join(root, pin.path));
    need(path.relative(root, target) !== '..' && !path.relative(root, target).startsWith(`..${path.sep}`));
    need(hash(readFileSync(target)) === pin.sha256);
  }
  let credentialSha: string | undefined;
  for (const [name, expected] of [['board-decision.json', admission.board_decision_sha256], ['independent-review.json', admission.independent_review_sha256], ['source-review.json', admission.source_review_sha256],
    ['account-evidence.json', admission.account_evidence_sha256], ['endpoint-evidence.json', admission.endpoint_evidence_sha256]]) {
    const bytes = readFileSync(path.join(path.dirname(admissionArg!), name)); need(hash(bytes) === expected);
    const record = JSON.parse(bytes.toString());
    need(record.disposition === 'pass' && record.candidate_sha256 === hash(candidateBytes));
    const when = Date.parse(record.recorded_at); need(Number.isFinite(when) && when <= Date.now());
    if (name.includes('account') || name.includes('endpoint')) need(Date.now() - when <= 300000);
    if (name === 'board-decision.json') need(record.authority === 'board' && record.maximum_stages === 5 && record.reservation_nano_usd === reservationNanoUsd && record.question_sha256 === hash(question) && record.source_mode === admission.source_mode && record.internal_estimate_not_provider_cap_acknowledged === true);
    if (name === 'account-evidence.json') {
      need(record.provider === 'OpenRouter' && Number.isSafeInteger(record.available_balance_nano_usd) && record.available_balance_nano_usd >= reservationNanoUsd && record.pending_or_uncertain_cost === false && record.existing_configured_account === true && digest(record.credential_sha256));
      need(record.paid_training_enabled === false && record.free_publishing_enabled === false && record.request_overrides_allowed === true && record.disabled_plugins?.length === openrouterPolicy.plugins.length && openrouterPolicy.plugins.every(p => record.disabled_plugins.includes(p.id)));
      need(record.input_output_logging_enabled === false && record.data_use_opt_ins_disabled === true);
      credentialSha = record.credential_sha256;
    }
    if (name === 'endpoint-evidence.json') {
      need(record.provider === 'Anthropic' && record.transport_endpoint === openrouterPolicy.endpoint && record.fallbacks === false && record.speed === 'standard');
      for (const stage of ['analyze','plan','verify'] as const) {
        const e = record.stages?.[stage];
        need(e?.requested_model === openrouterPolicy.models[stage] && e.canonical_model === openrouterPolicy.canonical_models[openrouterPolicy.models[stage]] && e.provider_tag === 'anthropic');
        need(e.prompt_usd_per_million === Number(openrouterPolicy.max_price[stage].prompt) && e.completion_usd_per_million === Number(openrouterPolicy.max_price[stage].completion));
        need(e.maximum_input_cache_usd_per_million <= openrouterPolicy.input_reservation_nano_usd_per_token[stage] / 1000 && e.maximum_input_cache_usd_per_million >= 0 && e.structured_output_supported === true);
      }
    }
    if (name === 'source-review.json') need(record.expires_at === deadline && record.scope === 'internal_public_synthetic_epa_only');
  }
  // This fixed, exclusive run directory makes failed admission after consumption non-retryable.
  const area = path.join(root, '.superpowers', runId);
  need(!existsSync(area)); mkdirSync(path.dirname(area), { recursive: true }); mkdirSync(area);
  exclusive(path.join(area, 'authorization-consumed.json'), { run_id: runId, admission_sha256: hash(admissionBytes), nonce_sha256: hash(admission.nonce), candidate_sha256: hash(candidateBytes), executable_sha256: hash(readFileSync(executable)), consumed_at: new Date().toISOString(), reusable: false });
  // The authorized operator supplies only the existing configured provider key on stdin.
  // No broad environment export, cloud reader, customer store, or key file is opened.
  let credential = '';
  try {
    const bytes = await Promise.race([Bun.stdin.bytes(), new Promise<never>((_, reject) => setTimeout(() => reject(Error('m69_credential_timeout')), 10000))]);
    need(bytes.byteLength > 10 && bytes.byteLength < 1024);
    credential = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
    need(!/\s/.test(credential) && hash(credential) === credentialSha);
    const closure = await executeCanary({ root, directory: area, apiKey: credential });
    process.stdout.write(JSON.stringify(closure) + '\n');
  } catch {
    exclusive(path.join(area, 'launcher-failure.json'), { run_id: runId, reason: 'launcher_failed', provider_requests: null, accounting: 'inspect_durable_attempt_and_closure_records_never_infer_zero', retry: false });
    throw Error('m69_launcher_failed');
  } finally { credential = ''; }
}
if (import.meta.main) main(process.argv.slice(2)).catch(() => { process.stderr.write('m69_launch_refused\n'); process.exitCode = 1; });

/** Offline-only canary preparation. Never imports credentials or dispatches a request. */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { hash, parsePassageRelease } from '../../apps/site-api/src/research-passages/release';
import { analysisInput } from '../../apps/site-api/src/research-composed/question-analysis';
import { composedRequestBody, openrouterProfileSha256, profileSha256 } from '../../apps/site-api/src/research-composed/provider';
import { estimateOpenRouterNanoUsd, openrouterPolicy } from '../../apps/site-api/src/research-composed/openrouter';
import { parseUnitCatalog, SOURCE_SHA } from '../../apps/site-api/src/research-composed/catalog';
import { parseCapabilities, CAPABILITY_SHA } from '../../apps/site-api/src/research-composed/capabilities';

export const question = 'For a yearly purchased-electricity report, what source records should we collect for electricity entering a facility, and what should we check if both a commodity supplier and the local utility invoice the same consumption?';
export const runId = 'm69-electricity-records-canary-01';
export const deadline = '2026-09-15T23:20:32Z';
export const catalogPath = 'data/research/answer-units/scope2-website.epa-acquisition.v1.json';
export const capabilityPath = 'data/research/capabilities/scope2-website.epa-limitations.v1.json';
const catalogSha = '97b2c4e0f4121c1d2ea7fa33d569f53344193f12a80e9d1349577c3a86e17e50';

export function prepare(root: string, now = Date.now()) {
  const read = (file: string) => readFileSync(path.join(root, file));
  const releasePath = 'data/research/releases/scope2-website.v1.json';
  const releaseBytes = read(releasePath);
  const release = parsePassageRelease(JSON.parse(releaseBytes.toString()), now);
  // This is a catalog structural check, not a verified local/cloud source loader.
  const verifiedShape = { release, passages: release.passages, sha256: SOURCE_SHA };
  const catalog = parseUnitCatalog(read(catalogPath), catalogSha, verifiedShape, now).catalog;
  const capabilities = parseCapabilities(read(capabilityPath), CAPABILITY_SHA, catalog, catalogSha, now);
  const body = composedRequestBody('analyze', analysisInput(question), 'openrouter');
  const analyze = estimateOpenRouterNanoUsd('analyze', body);
  const plan = estimateOpenRouterNanoUsd('plan', 'x'.repeat(64000));
  const verify = estimateOpenRouterNanoUsd('verify', 'x'.repeat(64000));
  const paths = [releasePath, catalogPath, capabilityPath, 'tools/research/m69-canary.ts', 'tools/research/m69-canary-runtime.ts', 'tools/research/m69-canary-launcher.ts'];
  for (const folder of ['research-composed', 'research-cloud', 'research-passages']) {
    const dir = `apps/site-api/src/${folder}`;
    for (const file of readdirSync(path.join(root, dir)).sort()) {
      if (file.endsWith('.ts') && !file.endsWith('.test.ts')) paths.push(`${dir}/${file}`);
    }
  }
  return {
    schema_version: 1, kind: 'm69_offline_canary_preparation', run_id: runId,
    prepared_at: new Date(now).toISOString(), base_commit: 'ad008741e4d3750af7de6e4791e2adc524c6713d',
    executable_live_candidate: false, paid_authorization: false, provider_requests: 0,
    question, question_sha256: hash(question), initial_request_body_utf8: body,
    initial_request_body_sha256: hash(body), initial_request_body_bytes: Buffer.byteLength(body),
    question_visibility: 'new_development_canary_not_statistically_held_out',
    source: { committed_release_sha256: hash(releaseBytes), runtime_release_sha256: SOURCE_SHA,
      approved_passages: release.review.approved_passage_ids, answer_units: catalog.units.length,
      capability_units: capabilities.units.length, review_deadline: deadline,
      original_source_and_extraction_verified: false, commercial_runtime_approval: false },
    provider: { endpoint: openrouterPolicy.endpoint, models: openrouterPolicy.models,
      canonical_models: openrouterPolicy.canonical_models, routing: openrouterPolicy.routing,
      semantic_profile_sha256: profileSha256, transport_profile_sha256: openrouterProfileSha256 },
    proposed_limits: { questions: 1, max_stages: 5, initial_sequence: ['analyze', 'plan', 'verify'],
      corrections: 1, retries: 0, carry: 0, concurrent_questions: 1,
      stage_timeout_ms: 180000, question_timeout_ms: 240000 },
    reservation: { currency: 'USD', analyze_nano_usd: analyze, plan_nano_usd: plan,
      verify_nano_usd: verify, total_nano_usd: analyze + 2 * plan + 2 * verify,
      guaranteed_provider_cap: false, expected_cost_usd: null,
      basis: 'Existing estimator: exact analyze bytes; 64000-byte plan/verify ceiling; framing and 25% margin. Recheck current endpoint price and account before admission.' },
    gates: ['independent source/product/security review', 'verified original PDF/extraction and runtime source binding',
      'reviewed compiled live successor with one-use authorization and exact closure',
      'fresh endpoint/account/machine evidence', 'fresh board decision on exact spend and run scope'],
    pins: paths.sort().map(file => ({ path: file, sha256: hash(read(file)) })),
  };
}

if (import.meta.main) {
  if (process.argv.slice(2).length) throw Error('m69_preparation_accepts_no_live_arguments');
  process.stdout.write(JSON.stringify(prepare(path.resolve(import.meta.dir, '../..')), null, 2) + '\n');
}

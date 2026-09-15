import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { executeCanary, validateClosure } from '../../tools/research/m69-canary-runtime';
import { openrouterPolicy } from '../../apps/site-api/src/research-composed/openrouter';

const root = path.resolve(import.meta.dir, '../..');
const analysis = { operation: 'explain', parts: [{ id: 'q1', start_token: 0, kind: 'request', requirements: [
  { kind: 'source_route', subject: 'activity_records' },
  { kind: 'conditional_rule', subject: 'duplicate_consumption' },
], ambiguity_context_ids: [] }] };
const plan = { question_contract: { parts: [{ id: 'q1', resolution: 'source_available', facet_ids: ['f1','f2'], context_ids: [] }] }, facets: [
  { id: 'f1', unit_ids: ['U04'] }, { id: 'f2', unit_ids: ['U05'] },
] };
const review = { decision: 'pass', decomposition_complete: true, relevant: true, scope_appropriate: true, context_appropriate: true, premise_handled: true, task_fit: true, proportionate: true,
  question_parts: [{ id: 'q1', faithful: true, appropriately_resolved: true, requirements: [
    { id: 'q1-r1', capability_ids: ['U04-C02'], blocking_limit_ids: [] },
    { id: 'q1-r2', capability_ids: ['U05-C01'], blocking_limit_ids: [] },
  ], additional_requirements: [] }],
  facets: [
    { id: 'f1', covered: true, unit_ids: ['U04'] },
    { id: 'f2', covered: true, unit_ids: ['U05'] },
  ], issues: [] };

function envelope(bodyText: string, output: unknown) {
  const body = JSON.parse(bodyText);
  return { model: body.model, provider: 'Anthropic', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(output) }],
    usage: { input_tokens: 100, output_tokens: 10, cost: 0.001, is_byok: false, speed: 'standard' },
    openrouter_metadata: { requested: body.model, strategy: 'direct', attempt: 1, is_byok: false,
      endpoints: { total: 1, available: [{ provider: 'Anthropic', model: body.model, selected: true }] }, pipeline: [] } };
}

test('frozen question produces a claim-level cited qualified answer through the actual runtime', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'm69-product-success-'));
  let cursor = 0;
  const outputs = [analysis, plan, review];
  try {
    const closure = await executeCanary({ root, directory, apiKey: 'synthetic-provider-disabled', transport: async (_url, init) => {
      const body = String(init.body); return Response.json(envelope(body, outputs[cursor++]));
    } });
    expect(closure.execution_mode).toBe('provider_disabled_fixture');
    expect(closure.stages).toEqual(['analyze','plan','verify']);
    expect(closure.answer_status).toBe('qualified');
    expect(closure.provider_requests).toBe(0);
    expect(closure.exact_total_nano_usd).toBe(3_000_000);
    expect(validateClosure(directory).controlled_exit).toBe(true);
    const answer = JSON.parse(readFileSync(path.join(directory, 'answer.json'), 'utf8'));
    expect(answer.claims.map((claim: any) => claim.id)).toEqual(['U04','U05']);
    expect(answer.claims.every((claim: any) => claim.evidence_ids.length > 0 && claim.qualifications.length > 0)).toBe(true);
    expect(answer.evidence.every((item: any) => /^S(0[1-9]|1[0-8])$/.test(item.id))).toBe(true);
    expect(answer.sources.map((source: any) => source.id)).toEqual(['epa-electricity-2023']);
    expect(answer.provider.mode).toBe('provider_disabled_fixture');
    expect(answer.retrieval).toMatchObject({ mode: 'local', store: 'verified_local_files', search: 'none' });
  } finally { rmSync(directory, { recursive: true }); }
});

test('compiled candidate policy remains direct Anthropic with fallback and plugins disabled', () => {
  expect(openrouterPolicy.routing.only).toEqual(['anthropic']);
  expect(openrouterPolicy.routing.allow_fallbacks).toBe(false);
  expect(openrouterPolicy.plugins.every((plugin) => plugin.enabled === false)).toBe(true);
});

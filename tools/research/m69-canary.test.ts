import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { executeCanary, validNext, reservationNanoUsd } from './m69-canary-runtime';
import { prepare, question } from './m69-canary';
import { openrouterPolicy } from '../../apps/site-api/src/research-composed/openrouter';
import { validateAdmission } from './m69-canary-launcher';
const root = path.resolve(import.meta.dir, '../..');
const wire = (text: unknown) => ({model: openrouterPolicy.models.analyze, provider:'Anthropic', stop_reason:'end_turn', content:[{type:'text',text}], usage:{cost:0.001},openrouter_metadata:{requested:openrouterPolicy.models.analyze,strategy:'direct',attempt:1,is_byok:false,endpoints:{total:1,available:[{provider:'Anthropic',model:openrouterPolicy.models.analyze,selected:true}]}}});
test('exact five-stage reservation and no retry or stale source bypass', () => {
  const prepared = prepare(root);
  expect(prepared.reservation.total_nano_usd).toBe(reservationNanoUsd);
  expect(prepared.question).toBe(question);
  expect(validNext([], 'analyze')).toBe(true);
  expect(validNext(['analyze','plan'], 'verify')).toBe(true);
  for(const [prior,next] of [[[], 'plan'],[['analyze'],'verify'],[['analyze','plan','verify','plan','verify'],'plan']] as [string[],string][]) expect(validNext(prior,next)).toBe(false);
  expect(() => prepare(root, Date.parse('2026-09-15T23:20:32Z'))).toThrow();
  expect(() => validateAdmission({}, 'a'.repeat(64), 'b'.repeat(64))).toThrow();
});
for(const scenario of ['content_shape','inner_json','transport'] as const) test(`actual provider decoder records ${scenario} with no second dispatch`, async () => {
  const directory = mkdtempSync(path.join(tmpdir(),'m69-canary-test-'));
  try {
    const result = await executeCanary({root,directory,apiKey:'synthetic-never-networked',transport:async()=> {
      if(scenario === 'transport') throw Error('synthetic-sensitive-marker');
      return Response.json(wire(scenario === 'content_shape' ? [] : '{invalid'));
    }});
    expect(result.execution_mode).toBe('provider_disabled_fixture');
    expect(result.provider_requests).toBe(0);
    expect(result.provider_transport_invocations).toBe(1);
    expect(result.stages).toEqual(['analyze']);
    const answer = JSON.parse(readFileSync(path.join(directory,'answer.json'),'utf8'));
    expect(answer.reason_code).toBe('provider_failure'); expect(answer.claims).toEqual([]);
    expect(result.exact_total_nano_usd).toBe(scenario === 'transport' ? null : 1000000);
    const failure = readFileSync(path.join(directory,'stage-1-failed.json'),'utf8');
    expect(failure).not.toContain('synthetic-sensitive-marker');
    expect(JSON.parse(failure).failure_detail).toBe(scenario === 'transport' ? 'awaiting_headers' : scenario);
  } finally { rmSync(directory,{recursive:true}); }
});

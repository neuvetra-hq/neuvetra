import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { executeCanary, validNext } from '../../tools/research/m69-canary-runtime';
import { openrouterPolicy } from '../../apps/site-api/src/research-composed/openrouter';

const root = path.resolve(import.meta.dir, '../..');
const wire = (cost: unknown) => ({ model: openrouterPolicy.models.analyze, provider: 'Anthropic', stop_reason: 'end_turn',
  content: [{ type: 'text', text: '{invalid-sensitive-prose' }], usage: { cost },
  openrouter_metadata: { requested: openrouterPolicy.models.analyze, strategy: 'direct', attempt: 1, is_byok: false,
    endpoints: { total: 1, available: [{ provider: 'Anthropic', model: openrouterPolicy.models.analyze, selected: true }] } } });
async function scenario(run: (directory: string) => Promise<void>) {
  const directory = mkdtempSync(path.join(tmpdir(), 'm69-security-'));
  try { await run(directory); }
  finally { const resolved = path.resolve(directory); if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(resolved).startsWith('m69-security-')) throw Error('cleanup_refused'); rmSync(resolved, { recursive: true }); }
}
test('stage automaton excludes re-analysis, duplicate verify and a second correction', () => {
  for (const [prior, next] of [ [[], 'verify'], [['analyze'], 'analyze'], [['analyze','plan','verify'], 'verify'],
    [['analyze','plan','plan','verify'], 'plan'], [['analyze','plan','verify','plan','verify'], 'plan'] ] as [string[], string][]) expect(validNext(prior, next)).toBe(false);
});
for (const cost of [-1, '0.001', null]) test(`invalid native cost ${JSON.stringify(cost)} preserves uncertainty and stops`, () => scenario(async directory => {
  let calls = 0;
  const closure = await executeCanary({ root, directory, apiKey: 'synthetic-security-only', transport: async () => { calls++; return Response.json(wire(cost)); } });
  expect(calls).toBe(1); expect(closure.exact_total_nano_usd).toBeNull();
  expect(closure.provider_requests).toBe(0); expect(closure.provider_transport_invocations).toBe(1);
  const answer = JSON.parse(readFileSync(path.join(directory, 'answer.json'), 'utf8'));
  expect(answer.status).toBe('unavailable'); expect(answer.claims).toEqual([]);
  for (const file of readdirSync(directory)) expect(readFileSync(path.join(directory, file), 'utf8')).not.toContain('invalid-sensitive-prose');
}));
test('native settlement above reservation never permits another dispatch', () => scenario(async directory => {
  const closure = await executeCanary({ root, directory, apiKey: 'synthetic-security-only', transport: async () => Response.json(wire(99)) });
  expect(closure.provider_transport_invocations).toBe(1); expect(closure.exact_total_nano_usd).toBeNull();
  expect(closure.known_settled_nano_usd).toBe(99_000_000_000);
}));
test('timeout closure waits until transport and stage bookkeeping stop', () => scenario(async directory => {
  const originalTimeout = AbortSignal.timeout;
  // Only the externally supplied whole-question deadline is shortened. No paid transport.
  AbortSignal.timeout = (ms: number) => originalTimeout(ms === 240000 ? 25 : ms);
  let finished = false;
  try {
    const closure = await executeCanary({ root, directory, apiKey: 'synthetic-security-only', transport: async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); finished = true; throw Error('synthetic-late-abort');
    } });
    const before = readdirSync(directory).sort();
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(finished).toBe(true);
    expect(readdirSync(directory).sort()).toEqual(before);
    expect(closure.controlled_exit).toBe(true);
  } finally { AbortSignal.timeout = originalTimeout; }
}));

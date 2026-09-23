import { createHash } from 'node:crypto';

export const FROZEN_REF = '1042348f2d4849246771fee4be77fe590c34ab8a';
export const INITIAL_WORKFLOW_SHA256 = '4a7810550658b732741992a79152527348f1b6fdd8c0340c5e0dc0015e7f9a14';
export const INITIAL_GATE_SHA256 = '69c819b80bb94caeeaf0c6fe5bd241cd94691fecbf05c39985136b60bb037d85';
export const HISTORICAL_INVENTORY_SHA256 = 'e1d0cd97046e21b308894d5f8757f8fc1fa580550e3ec700aa7ab0e1519bbb92';
export const HISTORICAL_ROUTE_SHA256 = 'ab5018c64668dfe197755849aee1a2b3c5947f6c3da21e8d18869e998f3f9e01';
export const CURRENT_ROUTE_SHA256 = 'fd9b1115130d523629e58b5fcef06fe5355eedc8afd12d6dacc998623c89ff37';

export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const check: (value: unknown, message: string) => asserts value = (value, message) => { if (!value) throw new Error(message); };
const multiset = (values: string[]) => [...new Map(values.map((value) => [value, values.filter((item) => item === value).length])).entries()].sort();
const tests = (source: string) => [...source.matchAll(/[A-Za-z0-9_./-]+\.test\.ts/g)].map((match) => match[0]);
const patterns = (source: string) => [...source.matchAll(/--test-name-pattern "([^"]+)"/g)].map((match) => match[1]);

export function validateWorkflowHistoryMove(before: string, after: string, expectedAfterSha256: string) {
  check(sha256(after) === expectedAfterSha256, 'workflow hash');
  const beforeTests = tests(before);
  const afterTests = tests(after);
  const newGate = 'evaluations/research-qa/m78-get-historical-gates.test.ts';
  check(afterTests.filter((path) => path === newGate).length === 1, 'one current regression');
  check(JSON.stringify(multiset(beforeTests)) === JSON.stringify(multiset(afterTests.filter((path) => path !== newGate))), 'historical test multiset');
  check(JSON.stringify(patterns(before).sort()) === JSON.stringify(patterns(after).sort()), 'test filters retained');
  check(after.includes(`ref: ${FROZEN_REF}\n          path: .legacy-m78`), 'frozen checkout');
  check((after.match(/working-directory: \.legacy-m78/g) ?? []).length === 4, 'four frozen steps');
  const exact = [
    'bun test tools/staging/check-m78-continuation2.test.ts tools/staging/check-m78-continuation3.test.ts',
    'bun test evaluations/research-qa/m78-continuation2-independent.test.ts --test-name-pattern "union covers|failed diagnostic intent"',
    'bun test evaluations/research-qa/m78-continuation3-independent.test.ts --test-name-pattern "admission challenges|diagnostic failure after login"',
    'bun test tools/staging/check-m78-continuation4.test.ts --test-name-pattern "^exact173 source union"',
    'bun test evaluations/research-qa/m78-continuation4-independent.test.ts --test-name-pattern "^portable"',
  ];
  for (const command of exact) check(after.includes(command), 'missing exact command: ' + command);
  const currentScope = after.match(/- name: Scope 1 GET preservation and finite diagnostic guards\n        run: ([^\n]+)/)?.[1] ?? '';
  check(currentScope.includes('m78-continuation4-get-perf-probe.test.ts'), 'current probe test');
  check(currentScope.includes('m78-get-guard-independent.test.ts'), 'current guard test');
  check(currentScope.includes('m78-get-local-comparison-independent.test.ts'), 'current comparison fixture test');
  check(currentScope.includes('m78-get-local-comparison-independent-actual.test.ts'), 'current comparison actual test');
  check(currentScope.includes('m78-get-historical-gates.test.ts'), 'current historical-refusal test');
  const currentMain = after.match(/- name: Independent Scope 1 browser decoding and recovery admission\n        run: ([^\n]+)/)?.[1] ?? '';
  check(!currentMain.includes('check-m78-continuation2.test.ts') && !currentMain.includes('check-m78-continuation3.test.ts'), 'old full suites removed from current tree');
  return { historicalTestsRetained: beforeTests.length, addedCurrentRegressions: 1, retainedPatterns: patterns(before).length, frozenSteps: 4 };
}

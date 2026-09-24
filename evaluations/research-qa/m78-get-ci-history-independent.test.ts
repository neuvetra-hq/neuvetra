import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CURRENT_ROUTE_SHA256, FROZEN_REF, HISTORICAL_INVENTORY_SHA256, HISTORICAL_ROUTE_SHA256, INITIAL_GATE_SHA256, INITIAL_WORKFLOW_SHA256, sha256, validateWorkflowHistoryMove } from './m78-get-ci-history-independent-review';

const archiveBytes = await readFile('evaluations/research-qa/m78-get-ci-history-independent-source.json');
const archive: any = JSON.parse(archiveBytes.toString('utf8'));
const files = new Map<string, any>(archive.files.map((item: any) => [item.label, item]));
const source = (label: string) => files.get(label).text as string;

test('candidate2 workflow retains every prior test and exact filter while moving historical gates', () => {
  expect(sha256(archiveBytes)).toBe('b7f7a908e599096bc8a0a8bcf830cc727979667cabbc283187fd0e769c2bb415');
  expect(archive.status).toBe('ci_history_candidate2_source_frozen');
  expect(archive.baseCommit).toBe('7f7a30634d655f2763d5ababf8e9df00a8841df0');
  expect(archive.frozenRef).toBe(FROZEN_REF);
  expect(files.size).toBe(8);
  for (const item of files.values()) expect(sha256(item.text)).toBe(item.sha256);
  expect(files.get('workflow_candidate2').sha256).toBe(INITIAL_WORKFLOW_SHA256);
  const result = validateWorkflowHistoryMove(source('workflow_before'), source('workflow_candidate2'), INITIAL_WORKFLOW_SHA256);
  expect(result.addedCurrentRegressions).toBe(1);
  expect(result.retainedPatterns).toBe(4);
  expect(result.frozenSteps).toBe(4);
});

test('frozen ref materialization preserves all 173 pins and current route stays distinct', async () => {
  expect(files.get('frozen_inventory').sha256).toBe(HISTORICAL_INVENTORY_SHA256);
  expect(files.get('frozen_route').sha256).toBe(HISTORICAL_ROUTE_SHA256);
  expect(files.get('current_route').sha256).toBe(CURRENT_ROUTE_SHA256);
  const pins: { path: string; sha256: string }[] = JSON.parse(source('frozen_inventory'));
  expect(pins).toHaveLength(173);
  expect(pins.find((pin) => pin.path === 'apps/site-api/src/workspace/m78-routes.ts')?.sha256).toBe(HISTORICAL_ROUTE_SHA256);
  const frozenRoot = existsSync('.legacy-m78') ? '.legacy-m78' : '.superpowers/m78-get-ci-history';
  for (const pin of pins) expect(sha256(await readFile(join(frozenRoot, pin.path)))).toBe(pin.sha256);
  expect(sha256(await readFile('apps/site-api/src/workspace/m78-routes.ts'))).toBe(CURRENT_ROUTE_SHA256);
});

test('candidate2 repairs only the stale historical route equality in the guard suite', async () => {
  const first = source('guard_test_first_review');
  const repaired = source('guard_test_candidate2');
  expect(files.get('guard_test_candidate2').sha256).toBe('5426aadcdeb299fc15ccc63cc88bda7e0534bfaf43b352b45edb215279a88872');
  const oldBlock = "  const original = await readFile('apps/site-api/src/workspace/m78-routes.ts', 'utf8');\n  expect(baseline.replace(/^\\/\\*\\* Frozen baseline route fixture[^\\n]*\\n/, '').replace('createM78RoutesBaseline', 'createM78Routes')).toBe(original);";
  const newBlock = "  const originalPin = result.sourcePins.find((pin: {path: string; sha256: string}) => pin.path === 'apps/site-api/src/workspace/m78-routes.ts');\n  expect(originalPin?.sha256).toBe('ab5018c64668dfe197755849aee1a2b3c5947f6c3da21e8d18869e998f3f9e01');\n  expect(sha(baseline.replace(/^\\/\\*\\* Frozen baseline route fixture[^\\n]*\\n/, '').replace('createM78RoutesBaseline', 'createM78Routes'))).toBe(originalPin.sha256);";
  expect(repaired).toContain(newBlock);
  expect(repaired.replace(newBlock, oldBlock)).toBe(first);
  expect(sha256(await readFile('evaluations/research-qa/m78-continuation4-get-perf-result.json'))).toBe('c0e7b9d455087318043e749a777ce8274493a22a736b48e0a94d8d6518b9a112');
  expect(sha256(await readFile('evaluations/research-qa/m78-continuation4-get-perf-probe.ts'))).toBe('8ffb4f7470e9b139201001b80b7a14f629f7d56a5f67187044e54dfb7492eb17');
});

test('current historical rejection regression remains exact', () => {
  expect(files.get('historical_gate_candidate2').sha256).toBe(INITIAL_GATE_SHA256);
  const gate = source('historical_gate_candidate2');
  expect(gate).toContain("for (const gate of [m78Continuation2SourcePins, m78Continuation3SourcePins, m78Continuation4SourcePins])");
  expect(gate).toContain("rejects.toThrow('Admitted155 graph changed')");
  expect(gate).toContain(CURRENT_ROUTE_SHA256);
  expect(gate).toContain(HISTORICAL_ROUTE_SHA256);
});

test('workflow validator refuses lost tests, changed ref, working directory or filter', () => {
  const before = source('workflow_before');
  const after = source('workflow_candidate2');
  const changedTest = after.replace(' tools/staging/check-m78-continuation3.test.ts', '');
  expect(() => validateWorkflowHistoryMove(before, changedTest, sha256(changedTest))).toThrow('historical test multiset');
  const changedRef = after.replace(FROZEN_REF, '0'.repeat(40));
  expect(() => validateWorkflowHistoryMove(before, changedRef, sha256(changedRef))).toThrow('frozen checkout');
  const changedDirectory = after.replace('        working-directory: .legacy-m78\n', '');
  expect(() => validateWorkflowHistoryMove(before, changedDirectory, sha256(changedDirectory))).toThrow('four frozen steps');
  const changedFilter = after.replace('union covers|failed diagnostic intent', 'union covers');
  expect(() => validateWorkflowHistoryMove(before, changedFilter, sha256(changedFilter))).toThrow('test filters retained');
});

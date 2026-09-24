import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXPECTED_COMPARISON, sha256, validateM78GetLocalComparison } from './m78-get-local-comparison-independent-review';

const ROOT = resolve(import.meta.dir, '../..');
const resultPath = resolve(ROOT, 'evaluations/research-qa/m78-get-local-comparison-result.json');
const sourcePath = resolve(ROOT, 'evaluations/research-qa/m78-get-local-comparison-source.json');
const inventoryPath = resolve(ROOT, 'evaluations/research-qa/m78-continuation4-preparation-source-pins.json');
const RESULT_SHA256 = 'caae59a5d5704c53b6d61f901d30dee55be01b7f890c62e7d6e5c1b1b7931417';
const SOURCE_ARCHIVE_SHA256 = 'a3bec8644f040ec875ee4f7eb8d3fbf4c181bd7d4281b517644c35f189842f9e';
const clone = <T>(value: T): T => structuredClone(value);
const actualBytes = readFileSync(resultPath);
const actual: any = JSON.parse(actualBytes.toString('utf8'));
const sourceBytes = readFileSync(sourcePath);
const source: any = JSON.parse(sourceBytes.toString('utf8'));

test('actual frozen result and portable operator source archive are exactly bound', () => {
  expect(sha256(actualBytes)).toBe(RESULT_SHA256);
  expect(sha256(sourceBytes)).toBe(SOURCE_ARCHIVE_SHA256);
  expect(source.status).toBe('m78_get_local_comparison_frozen_operator_source');
  expect(source.files).toHaveLength(5);
  for (const file of source.files) expect(sha256(file.text)).toBe(file.sha256);
  const byPath = new Map<string, any>(source.files.map((file: any) => [file.path, file]));
  const helper = byPath.get('.superpowers/m78-get-route-comparative.ts');
  const admissionFile = byPath.get('.superpowers/m78-get-route-comparative-admission.json');
  expect(helper.sha256).toBe(EXPECTED_COMPARISON.helperSha256);
  expect(admissionFile.sha256).toBe(EXPECTED_COMPARISON.admissionSha256);
  expect((helper.text.match(/await verify\(\)/g) ?? [])).toHaveLength(2);
  expect(helper.text).toContain("p.path===ROUTE?admission.afterRouteSha256:p.sha256");
  expect(helper.text).toContain("check(same(beforeDigest,afterDigest),'Base-table data changed')");
  expect(helper.text).toContain("await Promise.allSettled([Promise.resolve().then(()=>runtime?.close()),Promise.resolve().then(()=>admin?.close())])");

  const admission = JSON.parse(admissionFile.text);
  expect(admission.status).toBe('m78_get_route_comparative_source_admitted');
  expect(admission.beforeRouteSha256).toBe(EXPECTED_COMPARISON.beforeRouteSha256);
  expect(admission.afterRouteSha256).toBe(EXPECTED_COMPARISON.afterRouteSha256);
  expect(admission.routeReview.sha256).toBe(EXPECTED_COMPARISON.routeReviewSha256);
  expect(admission.guardReview.sha256).toBe(EXPECTED_COMPARISON.guardReviewSha256);
  expect(actual.extraPins).toEqual(admission.extraPins);
  for (const pin of admission.extraPins as { path: string; sha256: string }[]) {
    if (pin.path === '.superpowers/m78-get-route-comparative.ts') expect(pin.sha256).toBe(helper.sha256);
    else expect(sha256(readFileSync(resolve(ROOT, pin.path)))).toBe(pin.sha256);
  }
  const routeReceipt = JSON.parse(readFileSync(resolve(ROOT, admission.routeReview.path), 'utf8'));
  expect([routeReceipt.status, routeReceipt.reviewerId, routeReceipt.materialFindingsOpen, routeReceipt.candidateRouteSha256]).toEqual([
    'm78_get_route_independent_source_review_passed', '/root/m78_transport_probe', 0, EXPECTED_COMPARISON.afterRouteSha256,
  ]);
  const guardReceipt = JSON.parse(readFileSync(resolve(ROOT, admission.guardReview.path), 'utf8'));
  expect([guardReceipt.status, guardReceipt.reviewerId, guardReceipt.materialFindingsOpen, guardReceipt.candidateGuardSha256]).toEqual([
    'm78_get_probe_guard_independent_review_passed', '/root/m78_transport_probe', 0, EXPECTED_COMPARISON.guardSha256,
  ]);
  const helperReceipt = JSON.parse(readFileSync(resolve(ROOT, 'evaluations/research-qa/m78-get-root-comparative-review-result.json'), 'utf8'));
  expect([helperReceipt.status, helperReceipt.reviewerId, helperReceipt.materialFindingsOpen, helperReceipt.candidateHelperSha256]).toEqual([
    'm78_get_root_comparative_source_review_passed', '/root/m78_transport_probe', 0, EXPECTED_COMPARISON.helperSha256,
  ]);
  expect(validateM78GetLocalComparison(actual).measuredSamples).toBe(57);
});

test('current closure is the 172 retained historical pins plus the accepted route', () => {
  const inventoryBytes = readFileSync(inventoryPath);
  expect(sha256(inventoryBytes)).toBe(EXPECTED_COMPARISON.historicalInventorySha256);
  const pins: { path: string; sha256: string }[] = JSON.parse(inventoryBytes.toString('utf8'));
  expect(pins).toHaveLength(173);
  for (const pin of pins) {
    const expected = pin.path === 'apps/site-api/src/workspace/m78-routes.ts' ? EXPECTED_COMPARISON.afterRouteSha256 : pin.sha256;
    expect(sha256(readFileSync(resolve(ROOT, pin.path)))).toBe(expected);
  }
});

test('actual evidence refuses altered count, hash, header and sample ordinal', () => {
  const count = clone(actual); count.cases.pop(); expect(() => validateM78GetLocalComparison(count)).toThrow('case count');
  const body = clone(actual); body.cases[4].samples[2].bodySha256 = '0'.repeat(64); expect(() => validateM78GetLocalComparison(body)).toThrow('stable response');
  const header = clone(actual); for (const sample of header.cases.find((item: any) => item.operation === 'after_report').samples) sample.headers[0][1] += '-changed'; expect(() => validateM78GetLocalComparison(header)).toThrow('before/after response');
  const ordinal = clone(actual); ordinal.cases[0].samples[3].sample = 2; expect(() => validateM78GetLocalComparison(ordinal)).toThrow('measured ordinal');
});

test('actual evidence refuses altered digest, cleanup, closure and write counters', () => {
  const digest = clone(actual); digest.tableDigestsAfter.sha256 = '1'.repeat(64); expect(() => validateM78GetLocalComparison(digest)).toThrow('tableDigestsAfter');
  const cleanup = clone(actual); cleanup.localConnectionsClosed = false; expect(() => validateM78GetLocalComparison(cleanup)).toThrow('connection closure');
  const closure = clone(actual); closure.historicalSources = 172; expect(() => validateM78GetLocalComparison(closure)).toThrow('source closure');
  const write = clone(actual); write.applicationWrites = 1; expect(() => validateM78GetLocalComparison(write)).toThrow('zero external/write counters');
});

test('actual evidence refuses changed direct and optimized structural counts', () => {
  const direct = clone(actual); direct.cases.find((item: any) => item.operation === 'direct_version').samples[0].sqlQueries = 44; expect(() => validateM78GetLocalComparison(direct)).toThrow('direct structure');
  const optimized = clone(actual); optimized.cases.find((item: any) => item.operation === 'after_report_proof').samples[1].stateReads = 2; expect(() => validateM78GetLocalComparison(optimized)).toThrow('after structure');
  const baseline = clone(actual); baseline.cases.find((item: any) => item.operation === 'before_report').samples[1].sqlQueries = 85; expect(() => validateM78GetLocalComparison(baseline)).toThrow('before structure');
});

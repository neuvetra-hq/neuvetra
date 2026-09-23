import { createHash } from 'node:crypto';

export const EXPECTED_COMPARISON = Object.freeze({
  admissionSha256: '517718573822d0010056361844960c124f2fd6f2cf51537cf504e4da61d237c0',
  helperSha256: '7da53e0014fc6f499b8341c03246388244b608e76f2da10742f56808d34b0fbc',
  routeReviewSha256: '00a054d0dee57117a0b689ccfb6c62550286870ad6819d1f0308686061796e6a',
  guardReviewSha256: 'c61f9fded47337615d33941cacb05d20a0d096ae93e2a73fc1e996ca5d2765b8',
  helperReviewSha256: 'cad16a6ae5f87a0c2fbafd9f5670bb3ad6e79eea2e71fc9e0bcffc2299e06d16',
  historicalInventorySha256: 'e1d0cd97046e21b308894d5f8757f8fc1fa580550e3ec700aa7ab0e1519bbb92',
  beforeRouteSha256: 'ab5018c64668dfe197755849aee1a2b3c5947f6c3da21e8d18869e998f3f9e01',
  afterRouteSha256: 'fd9b1115130d523629e58b5fcef06fe5355eedc8afd12d6dacc998623c89ff37',
  guardSha256: '8ffb4f7470e9b139201001b80b7a14f629f7d56a5f67187044e54dfb7492eb17',
  baselineFixtureSha256: '8ebe51aec86d8e5990a6f8391bb8e823c7cd661d2d7369e3b35909ef74722de3',
  tableDigest: 'cec9b5e4ef42e38acea843f0ebba92b39cf2b42c1f6c137f6ed62d575fec5d64',
  companyId: '8b90c706-1710-494d-b12d-02eef88eacb7',
  reportId: 'de6bc76f-9fbf-461a-8e2d-b5f8d6097a86',
  versionId: '146977ae-a4ac-4985-8158-aa6c581d71d2',
  database: 'm78_ops_continuation_20260922',
});

const direct = ['direct_register', 'direct_version', 'direct_report'] as const;
const routes = ['register', 'version', 'version_export', 'version_proof', 'report', 'report_download', 'report_snapshot', 'report_proof'] as const;
const expectedOperations = [...direct, ...routes.map((name) => `before_${name}`), ...routes.map((name) => `after_${name}`)];
const check: (value: unknown, message: string) => asserts value = (value, message) => { if (!value) throw new Error(message); };
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const hex = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

export function validateM78GetLocalComparison(result: any) {
  const x = EXPECTED_COMPARISON;
  check(result?.status === 'm78_get_route_local_comparison_passed', 'comparison status');
  check(result.admissionSha256 === x.admissionSha256, 'admission binding');
  check(result.historicalSourceInventorySha256 === x.historicalInventorySha256, 'historical inventory binding');
  check(result.sourcesVerifiedBeforeAndAfter === true && result.historicalSources === 173, 'source closure');
  check(result.beforeRouteSha256 === x.beforeRouteSha256 && result.afterRouteSha256 === x.afterRouteSha256, 'route bindings');
  check(result.database === x.database && result.companyId === x.companyId, 'local target binding');
  check(result.reportId === x.reportId && result.versionId === x.versionId, 'retained identity binding');
  check(result.hostCalls === 0 && result.applicationWrites === 0 && result.httpPostRequests === 0, 'zero external/write counters');
  check(result.warmupsPerCase === 1 && result.measuredSamplesPerCase === 3, 'sample contract');
  check(result.noHostedTimingOrSlaClaim === true, 'timing limitation');
  check(result.localConnectionsClosed === true, 'connection closure');
  check(result.digestScope === '121 neuvetra base-table row sets; no sequence/settings/external-effect claim', 'digest scope');
  for (const side of ['tableDigestsBefore', 'tableDigestsAfter'] as const) {
    check(result[side]?.tableCount === 121 && result[side]?.sha256 === x.tableDigest, side);
  }
  check(same(result.tableDigestsBefore, result.tableDigestsAfter), 'digest equality');
  check(Array.isArray(result.cases) && result.cases.length === 19, 'case count');
  check(same(result.cases.map((item: any) => item.operation), expectedOperations), 'case order');
  const byName = new Map<string, any>();
  for (const item of result.cases) {
    check(!byName.has(item.operation), 'unique operation');
    byName.set(item.operation, item);
    check(Array.isArray(item.samples) && item.samples.length === 4, 'four samples ' + item.operation);
    check(item.samples[0]?.phase === 'warmup' && item.samples[0]?.sample === 0, 'warmup ordinal ' + item.operation);
    for (let index = 1; index < 4; index++) check(item.samples[index]?.phase === 'measured' && item.samples[index]?.sample === index, 'measured ordinal ' + item.operation);
    const first = item.samples[0];
    check(hex(first.bodySha256) && Number.isInteger(first.bytes) && first.bytes > 0, 'body evidence ' + item.operation);
    check(Array.isArray(first.headers) && first.headers.every((pair: unknown) => Array.isArray(pair) && pair.length === 2 && pair.every((value) => typeof value === 'string')), 'headers ' + item.operation);
    for (const sample of item.samples) {
      check(sample.bodySha256 === first.bodySha256 && sample.bytes === first.bytes && sample.status === first.status && same(sample.headers, first.headers), 'stable response ' + item.operation);
      for (const field of ['transactions', 'sqlQueries', 'stateReads', 'corporateReads'] as const) check(Number.isInteger(sample[field]) && sample[field] >= 0, field + ' ' + item.operation);
      check(finite(sample.sqlMs) && finite(sample.totalMs) && sample.sqlMs <= sample.totalMs, 'timing values ' + item.operation);
    }
    const measured = item.samples.slice(1).map((sample: any) => sample.totalMs).sort((a: number, b: number) => a - b);
    check(item.medianMs === measured[1] && item.maxMs === measured[2], 'timing summary ' + item.operation);
    const route = item.operation.startsWith('before_') || item.operation.startsWith('after_');
    check(item.samples.every((sample: any) => sample.status === (route ? 200 : null) && same(sample.headers, route ? first.headers : [])), 'status/header kind ' + item.operation);
  }
  for (const name of routes) {
    const before = byName.get(`before_${name}`), after = byName.get(`after_${name}`);
    check(before && after, 'paired route ' + name);
    check(before.samples.every((sample: any) => sample.bodySha256 === after.samples[0].bodySha256 && sample.bytes === after.samples[0].bytes && sample.status === after.samples[0].status && same(sample.headers, after.samples[0].headers)), 'before/after response ' + name);
    const root = name === 'register';
    check(before.samples.every((sample: any) => sample.stateReads === (root ? 1 : 2) && sample.sqlQueries === (root ? 44 : 86) && sample.corporateReads === (root ? 10 : 20) && sample.transactions === (root ? 2 : 3)), 'before structure ' + name);
    check(after.samples.every((sample: any) => sample.stateReads === 1 && sample.sqlQueries === 44 && sample.corporateReads === 10 && sample.transactions === 2), 'after structure ' + name);
  }
  for (const name of direct) check(byName.get(name).samples.every((sample: any) => sample.stateReads === 1 && sample.sqlQueries === 42 && sample.corporateReads === 10 && sample.transactions === 1), 'direct structure ' + name);
  return {
    status: 'm78_get_route_local_comparison_independently_validated',
    cases: 19,
    routePairs: 8,
    measuredSamples: 57,
    beforeSpecificStateReads: 2,
    afterSpecificStateReads: 1,
    beforeSpecificSqlQueries: 86,
    afterSpecificSqlQueries: 44,
    tableDigest: x.tableDigest,
  };
}

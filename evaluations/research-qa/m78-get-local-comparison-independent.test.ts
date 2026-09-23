import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { EXPECTED_COMPARISON, validateM78GetLocalComparison } from './m78-get-local-comparison-independent-review';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const routes = ['register', 'version', 'version_export', 'version_proof', 'report', 'report_download', 'report_snapshot', 'report_proof'] as const;

function fixture(): any {
  const make = (operation: string) => {
    const route = operation.startsWith('before_') || operation.startsWith('after_');
    const root = operation.endsWith('register');
    const beforeSpecific = operation.startsWith('before_') && !root;
    const bodyName = operation.replace(/^(before|after)_/, '');
    const samples = Array.from({ length: 4 }, (_, sample) => ({
      phase: sample === 0 ? 'warmup' : 'measured', sample,
      transactions: route ? (beforeSpecific ? 3 : 2) : 1,
      sqlQueries: beforeSpecific ? 86 : (route ? 44 : 42),
      stateReads: beforeSpecific ? 2 : 1,
      corporateReads: beforeSpecific ? 20 : 10,
      sqlMs: 10 + sample,
      totalMs: 20 + sample,
      bytes: 100 + bodyName.length,
      bodySha256: hash(bodyName),
      status: route ? 200 : null,
      headers: route ? [['cache-control', 'no-store'], ['content-type', 'application/json']] : [],
    }));
    return { operation, samples, medianMs: 22, maxMs: 23 };
  };
  return {
    status: 'm78_get_route_local_comparison_passed',
    admissionSha256: EXPECTED_COMPARISON.admissionSha256,
    historicalSourceInventorySha256: EXPECTED_COMPARISON.historicalInventorySha256,
    sourcesVerifiedBeforeAndAfter: true,
    historicalSources: 173,
    extraPins: [],
    beforeRouteSha256: EXPECTED_COMPARISON.beforeRouteSha256,
    afterRouteSha256: EXPECTED_COMPARISON.afterRouteSha256,
    database: EXPECTED_COMPARISON.database,
    companyId: EXPECTED_COMPARISON.companyId,
    reportId: EXPECTED_COMPARISON.reportId,
    versionId: EXPECTED_COMPARISON.versionId,
    hostCalls: 0,
    applicationWrites: 0,
    httpPostRequests: 0,
    tableDigestsBefore: { tableCount: 121, sha256: EXPECTED_COMPARISON.tableDigest },
    tableDigestsAfter: { tableCount: 121, sha256: EXPECTED_COMPARISON.tableDigest },
    digestScope: '121 neuvetra base-table row sets; no sequence/settings/external-effect claim',
    warmupsPerCase: 1,
    measuredSamplesPerCase: 3,
    cases: [make('direct_register'), make('direct_version'), make('direct_report'), ...routes.map((name) => make(`before_${name}`)), ...routes.map((name) => make(`after_${name}`))],
    noHostedTimingOrSlaClaim: true,
    localConnectionsClosed: true,
  };
}

const clone = <T>(value: T): T => structuredClone(value);

test('positive exact 19-case comparison is accepted', () => {
  expect(validateM78GetLocalComparison(fixture())).toEqual({
    status: 'm78_get_route_local_comparison_independently_validated', cases: 19, routePairs: 8, measuredSamples: 57,
    beforeSpecificStateReads: 2, afterSpecificStateReads: 1, beforeSpecificSqlQueries: 86, afterSpecificSqlQueries: 44,
    tableDigest: EXPECTED_COMPARISON.tableDigest,
  });
});

test('altered case count, body hash and header pair are refused', () => {
  const count = fixture(); count.cases.pop(); expect(() => validateM78GetLocalComparison(count)).toThrow('case count');
  const body = fixture(); body.cases[12]!.samples[2]!.bodySha256 = hash('changed'); expect(() => validateM78GetLocalComparison(body)).toThrow('stable response');
  const header = fixture(); for (const sample of header.cases.find((item: any) => item.operation === 'after_report')!.samples) sample.headers[0]![1] = 'public'; expect(() => validateM78GetLocalComparison(header)).toThrow('before/after response');
});

test('altered sample shape, digest and cleanup are refused', () => {
  const samples = fixture(); samples.cases[0]!.samples.pop(); expect(() => validateM78GetLocalComparison(samples)).toThrow('four samples');
  const ordinal = fixture(); ordinal.cases[0]!.samples[1]!.sample = 2; expect(() => validateM78GetLocalComparison(ordinal)).toThrow('measured ordinal');
  const digest = fixture(); digest.tableDigestsAfter.sha256 = hash('changed'); expect(() => validateM78GetLocalComparison(digest)).toThrow('tableDigestsAfter');
  const cleanup = fixture(); cleanup.localConnectionsClosed = false; expect(() => validateM78GetLocalComparison(cleanup)).toThrow('connection closure');
});

test('altered query structure, source closure and zero-write counters are refused', () => {
  const queries = fixture(); queries.cases.find((item: any) => item.operation === 'after_report')!.samples[3]!.sqlQueries = 45; expect(() => validateM78GetLocalComparison(queries)).toThrow('after structure');
  const sources = fixture(); sources.sourcesVerifiedBeforeAndAfter = false; expect(() => validateM78GetLocalComparison(sources)).toThrow('source closure');
  const writes = fixture(); writes.applicationWrites = 1; expect(() => validateM78GetLocalComparison(writes)).toThrow('zero external/write counters');
  const admission = fixture(); admission.admissionSha256 = hash('changed'); expect(() => validateM78GetLocalComparison(admission)).toThrow('admission binding');
});

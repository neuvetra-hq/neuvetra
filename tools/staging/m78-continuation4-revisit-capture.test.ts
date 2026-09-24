import { expect, test } from 'bun:test';
import {
  buildM78Continuation4RevisitObservation,
  createM78Continuation4RevisitCapture,
  type M78CapturedObservation,
  type M78RevisitCaptureSet,
} from './m78-continuation4-revisit-capture';
import {
  M78_CONTINUATION4_REVISIT_OBSERVATION,
  runM78Continuation4RevisitWithCapture,
  writeM78Continuation4RevisitObservation,
} from './check-m78-continuation4-revisit';

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex');
const company = '8b90c706-1710-494d-b12d-02eef88eacb7';
const host = 'https://www.neuvetra.ai';
const root = `/workspace-api/workspace/${company}`;

test('one-call wrapper returns the original unread Response, preserves init and skips auth bodies', async () => {
  const calls: { raw: RequestInfo | URL; init?: RequestInit }[] = [];
  const appResponse = Response.json({ retained: true });
  const authResponse = Response.json({ access_token: 'synthetic-secret-token' });
  const transport = (async (raw: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ raw, init });
    return String(raw).startsWith('https://icockcoguyadhryzydvl.supabase.co') ? authResponse : appResponse;
  }) as typeof fetch;
  const capture = createM78Continuation4RevisitCapture(transport, company);
  const signal = AbortSignal.timeout(30_000);
  const init: RequestInit = { method: 'GET', redirect: 'error', signal, headers: { authorization: 'Bearer private' } };
  const returned = await capture.fetch(`${host}${root}/scope1-inventory`, init);
  expect(returned).toBe(appResponse);
  expect(returned.bodyUsed).toBe(false);
  expect(calls[0]!.init).toBe(init);
  const authReturned = await capture.fetch(
    'https://icockcoguyadhryzydvl.supabase.co/auth/v1/token?grant_type=password',
    { method: 'POST', body: 'private-password' },
  );
  expect(authReturned).toBe(authResponse);
  expect(authReturned.bodyUsed).toBe(false);
  const finished = await capture.finish();
  expect(calls).toHaveLength(2);
  expect(finished.requests).toBe(1);
  expect(finished.observations.get(`${root}/scope1-inventory`)?.json).toEqual({ retained: true });
  expect(JSON.stringify([...finished.observations.values()])).not.toContain('secret');
  expect(JSON.stringify([...finished.observations.values()])).not.toContain('private');
  expect(returned.bodyUsed).toBe(false);
  expect(await returned.json()).toEqual({ retained: true });
});

test('changed duplicate responses fail capture without changing either fetch result', async () => {
  let calls = 0;
  const transport = (async () => Response.json({ version: ++calls })) as unknown as typeof fetch;
  const capture = createM78Continuation4RevisitCapture(transport, company);
  const first = await capture.fetch(`${host}${root}/scope1-inventory`);
  const second = await capture.fetch(`${host}${root}/scope1-inventory`);
  expect(first.bodyUsed).toBe(false);
  expect(second.bodyUsed).toBe(false);
  await expect(capture.finish()).rejects.toThrow('revisit capture failed');
  expect(calls).toBe(2);
});

test('enforces shared concurrent aggregate, per-response, and request boundaries while originals stay unread', async () => {
  const aggregate = createM78Continuation4RevisitCapture(
    (async () => new Response('123456')) as unknown as typeof fetch,
    company,
    { responseBytes: 6, aggregateBytes: 10, requests: 2 },
  );
  const aggregateResponses = await Promise.all([
    aggregate.fetch(`${host}${root}/scope1-inventory`),
    aggregate.fetch(`${host}${root}/corporate-inventories`),
  ]);
  expect(aggregateResponses.every((response) => !response.bodyUsed)).toBe(true);
  await expect(aggregate.finish()).rejects.toThrow('revisit capture failed');

  const perResponse = createM78Continuation4RevisitCapture(
    (async () => new Response('123456')) as unknown as typeof fetch,
    company,
    { responseBytes: 5, aggregateBytes: 20, requests: 1 },
  );
  const oversized = await perResponse.fetch(`${host}${root}/scope1-inventory`);
  expect(oversized.bodyUsed).toBe(false);
  await expect(perResponse.finish()).rejects.toThrow('revisit capture failed');

  const requestCount = createM78Continuation4RevisitCapture(
    (async () => new Response('{}')) as unknown as typeof fetch,
    company,
    { responseBytes: 2, aggregateBytes: 4, requests: 1 },
  );
  const requestResponses = await Promise.all([
    requestCount.fetch(`${host}${root}/scope1-inventory`),
    requestCount.fetch(`${host}${root}/corporate-inventories`),
  ]);
  expect(requestResponses.every((response) => !response.bodyUsed)).toBe(true);
  await expect(requestCount.finish()).rejects.toThrow('revisit capture failed');
});

function capturedFixture() {
  const observations = new Map<string, M78CapturedObservation>();
  const addJson = (route: string, value: unknown) => {
    const text = JSON.stringify(value);
    observations.set(route, { route, sha256: sha(text), byteLength: Buffer.byteLength(text), json: value });
  };
  const addBytes = (route: string, text: string) => {
    observations.set(route, { route, sha256: sha(text), byteLength: Buffer.byteLength(text) });
  };
  const emptyScope1 = {
    process: { versions: [], reports: [] },
    inventory: { versions: [], reports: [] },
  };
  const registers = {
    corporate: { versions: [] },
    gas: { worksheets: [] },
    mobile: { worksheets: [] },
    fleet: { versions: [], reports: [] },
    diesel: { worksheets: [] },
    equipment: { versions: [], reports: [] },
    fugitive: { worksheets: [], population: { versions: [], reports: [] } },
  };
  addJson(`${root}/scope1-inventory`, emptyScope1);
  for (const [family, base] of [
    ['corporate', 'corporate-inventories'],
    ['gas', 'stationary-natural-gas'],
    ['mobile', 'mobile-diesel'],
    ['fleet', 'controlled-fleet'],
    ['diesel', 'stationary-diesel'],
    ['equipment', 'stationary-equipment'],
    ['fugitive', 'fugitive-sources'],
  ] as const) addJson(`${root}/${base}`, registers[family]);

  const annualId = '10000000-0000-4000-8000-000000000001';
  const packId = '10000000-0000-4000-8000-000000000002';
  const reportId = '10000000-0000-4000-8000-000000000003';
  const billId = '10000000-0000-4000-8000-000000000004';
  addJson(root, { companyName: 'Synthetic' });
  addJson(`${root}/bills/${billId}`, { id: billId });
  addJson(`${root}/inventories/2023/scope2`, { inventory: true });
  addJson(`${root}/annual-registers/2023`, { register: true });
  addJson(`${root}/annual-inventories/2023/scope2`, { id: annualId });
  const annualRoot = `${root}/annual-inventories/${annualId}`;
  addJson(`${annualRoot}/evidence-packs/current`, { id: packId });
  addJson(`${annualRoot}/draft-reports/current`, { id: reportId });
  addJson(`${annualRoot}/draft-reports/${reportId}/decisions/current`, { accepted: true });
  addJson(`${root}/electricity-worksheet`, { worksheet: 64 });
  addJson(`${root}/source-electricity-worksheet`, { worksheet: 66 });
  addJson(`${root}/annual-electricity-worksheet`, { worksheet: 67 });
  addJson(`${root}/annual-electricity-evidence`, { evidence: 68 });
  addJson(`${root}/source-electricity-worksheet/sources`, { sources: [] });
  for (const base of ['electricity-worksheet', 'source-electricity-worksheet', 'annual-electricity-worksheet', 'annual-electricity-evidence']) {
    addJson(`${root}/${base}/reports`, { reports: [] });
  }
  addBytes(`${annualRoot}/evidence-packs/${packId}/download`, 'pack-bytes');
  addBytes(`${annualRoot}/draft-reports/${reportId}/download`, 'report-bytes');
  const aggregateBytes = [...observations.values()].reduce((sum, value) => sum + value.byteLength, 0);
  return {
    captures: { requests: observations.size, aggregateBytes, observations } satisfies M78RevisitCaptureSet,
    emptyScope1,
    registers,
  };
}

function evidence() {
  return {
    workspaceId: company,
    journal: {
      path: '.superpowers/m78-hosted-continuation4.jsonl',
      sha256: 'a'.repeat(64),
      head: 'b'.repeat(64),
      events: 500,
    },
    gate: { path: '.superpowers/m78-continuation4-exercise-gate.json', sha256: 'c'.repeat(64) },
    journeyGate: { reviewedApplicationCommit: 'd'.repeat(40) },
    sourcePins: Array.from({ length: 173 }, (_, index) => ({
      path: `source/${index}.ts`,
      sha256: index.toString(16).padStart(64, '0'),
    })),
    captureStartedAt: '2026-01-01T00:00:00.000Z',
    captureCompletedAt: '2026-01-01T00:01:00.000Z',
    observedAt: '2026-01-01T00:01:01.000Z',
  };
}

const identityDecoders = {
  scope1: async (value: unknown) => value,
  corporate: (value: unknown) => value,
  gas: (value: unknown) => value,
  mobile: (value: unknown) => value,
  fleet: (value: unknown) => value,
  diesel: (value: unknown) => value,
  equipment: (value: unknown) => value,
  fugitive: async (value: unknown) => value,
};

test('builds exact fresh observation from captured responses and refuses a missing response', async () => {
  const fixture = capturedFixture();
  const result = await buildM78Continuation4RevisitObservation(fixture.captures, evidence(), identityDecoders as any);
  expect(result).toMatchObject({
    status: 'm78_continuation4_revisit_observed',
    workspaceId: company,
    scope1: fixture.emptyScope1,
    registers: fixture.registers,
    downloads: {},
    m78bytes: {},
    capture: { authBodiesCaptured: 0, extraNetworkRequests: 0 },
  });
  expect(result.legacy.downloads).toEqual({
    m63_pack: { sha256: sha('pack-bytes'), byteLength: 10 },
    m63_report: { sha256: sha('report-bytes'), byteLength: 12 },
  });
  expect(Object.keys(result.legacy.records)).toHaveLength(17);
  expect(result.sourcePins).toHaveLength(173);

  const missing = capturedFixture();
  missing.captures.observations.delete(`${root}/scope1-inventory`);
  await expect(buildM78Continuation4RevisitObservation(missing.captures, evidence(), identityDecoders as any))
    .rejects.toThrow('missing capture');
});

test('capture failure is reported only after the unchanged runner finishes cleanup', async () => {
  let response = 0;
  let cleanupFinished = false;
  const transport = (async () => Response.json({ changed: ++response })) as unknown as typeof fetch;
  const runner = (async (_input: any, options: any) => {
    await options.fetch(`${host}${root}/scope1-inventory`);
    await options.fetch(`${host}${root}/scope1-inventory`);
    cleanupFinished = true;
    return { status: 'passed', stage: 'complete', allCreatedAuthSessionsClosed: true };
  }) as any;
  let writes = 0;
  const result = await runM78Continuation4RevisitWithCapture(
    { mode: 'revisit', roster: { workspaceId: company }, gate: {} } as any,
    { gate: evidence().gate, sourcePins: evidence().sourcePins },
    {
      fetch: transport,
      run: runner,
      io: {
        read: async () => null,
        append: async () => { writes += 1; },
      },
    },
  );
  expect(cleanupFinished).toBe(true);
  expect(result).toMatchObject({ status: 'failed', stage: 'revisit_capture', coreJourneyStatus: 'passed' });
  expect(writes).toBe(0);
});

test('a failed core result drains pending capture work before return without masking the core failure', async () => {
  let cloneCompleted = false;
  const transport = (async () => new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      await Bun.sleep(10);
      controller.enqueue(new TextEncoder().encode('{}'));
      controller.close();
      cloneCompleted = true;
    },
  }))) as unknown as typeof fetch;
  const runner = (async (_input: any, options: any) => {
    await options.fetch(`${host}${root}/scope1-inventory`);
    return { status: 'failed', stage: 'synthetic_core_failure', allCreatedAuthSessionsClosed: true };
  }) as any;
  const result = await runM78Continuation4RevisitWithCapture(
    { mode: 'revisit', roster: { workspaceId: company }, gate: {} } as any,
    { gate: evidence().gate, sourcePins: evidence().sourcePins },
    {
      fetch: transport,
      run: runner,
      io: { read: async () => null, append: async () => undefined },
    },
  );
  expect(cloneCompleted).toBe(true);
  expect(result).toMatchObject({ status: 'failed', stage: 'synthetic_core_failure' });
});

test('observation writer uses the exclusive new path and returns its exact pin', async () => {
  const appends: any[] = [];
  const observation = { status: 'm78_continuation4_revisit_observed', fresh: true };
  const pin = await writeM78Continuation4RevisitObservation(
    { append: async (...args: any[]) => { appends.push(args); } } as any,
    observation,
  );
  expect(appends).toHaveLength(1);
  expect(appends[0]![0]).toBe(M78_CONTINUATION4_REVISIT_OBSERVATION);
  expect(appends[0]![2]).toBe(true);
  expect(pin).toEqual({ path: M78_CONTINUATION4_REVISIT_OBSERVATION, sha256: sha(appends[0]![1]) });
});

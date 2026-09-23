import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const candidateRoot = 'C:/Users/nimab/.codex/worktrees/m78-get-performance/Neuvetra';
const routePath = `${candidateRoot}/apps/site-api/src/workspace/m78-routes.ts`;
const executableFixturePath = 'evaluations/research-qa/m78-get-route-independent-candidate3-fixture.ts';
const baselinePath = `${candidateRoot}/apps/site-api/src/workspace/m78-get-route-baseline-fixture.ts`;
const originalPath = 'apps/site-api/src/workspace/m78-routes.ts';
const candidateSha256 = 'fd9b1115130d523629e58b5fcef06fe5355eedc8afd12d6dacc998623c89ff37';
const originalSha256 = 'ab5018c64668dfe197755849aee1a2b3c5947f6c3da21e8d18869e998f3f9e01';
const company = '10000000-0000-4000-8000-000000000001';
const otherCompany = '10000000-0000-4000-8000-000000000002';
const actor = '10000000-0000-4000-8000-000000000003';
const origin = 'http://localhost:47821';
const ids = {
  process: { stream: '20000000-0000-4000-8000-000000000001', version: '20000000-0000-4000-8000-000000000002', report: '20000000-0000-4000-8000-000000000003' },
  inventory: { stream: '30000000-0000-4000-8000-000000000001', version: '30000000-0000-4000-8000-000000000002', report: '30000000-0000-4000-8000-000000000003' },
} as const;

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const row = (family: 'process_screen' | 'inventory') => {
  const id = ids[family === 'process_screen' ? 'process' : 'inventory'];
  const version = { id: id.version, companyId: company, streamId: id.stream, family, statements: [], activity: {}, versionSha256: 'a'.repeat(64) };
  return {
    id,
    envelope: { version, proof: { family } },
    report: { id: id.report, companyId: company, streamId: id.stream, family, versionId: id.version, snapshotJson: JSON.stringify({ proof: { family } }), html: `<p>${family}</p>` },
  };
};
const register = () => {
  const process = row('process_screen');
  const inventory = row('inventory');
  return {
    process: { streamId: process.id.stream, versions: [process.envelope.version], reports: [process.report] },
    inventory: { streamId: inventory.id.stream, versions: [inventory.envelope.version], reports: [inventory.report] },
  };
};

type Counts = { root: number; version: number; report: number; writes: number };
const database = (overrides: Record<string, unknown> = {}) => {
  const counts: Counts = { root: 0, version: 0, report: 0, writes: 0 };
  const db = {
    hasStagingAccess: async () => true,
    canManageWorkspace: async () => true,
    findScope1: async () => { counts.root++; return register(); },
    findScope1Version: async (_u: string, _c: string, stream: string, id: string) => {
      counts.version++;
      for (const family of ['process_screen', 'inventory'] as const) {
        const value = row(family);
        if (value.id.stream === stream && value.id.version === id) return value.envelope;
      }
      return null;
    },
    findScope1Report: async (_u: string, _c: string, stream: string, id: string) => {
      counts.report++;
      for (const family of ['process_screen', 'inventory'] as const) {
        const value = row(family);
        if (value.id.stream === stream && value.id.report === id) return value.report;
      }
      return null;
    },
    saveProcessScreen: async () => { counts.writes++; return row('process_screen').envelope; },
    saveScope1Inventory: async () => { counts.writes++; return row('inventory').envelope; },
    reviewScope1Version: async () => { counts.writes++; return {}; },
    createScope1Report: async () => { counts.writes++; return row('inventory').report; },
    ...overrides,
  };
  return { counts, db };
};

const loadFactory = async () => {
  const bytes = await readFile(routePath);
  expect(sha(bytes)).toBe(candidateSha256);
  return (await import(pathToFileURL(executableFixturePath).href)).createM78Routes as (deps: any) => (request: Request) => Promise<Response>;
};
const makeRoute = async (db: any, staging = true) => (await loadFactory())({
  database: { ...db, hasStagingAccess: async () => staging },
  origin,
  authorities: {},
  policy: null,
  validateUser: async (token: string) => token === 'valid' ? { id: actor, email: null, phone: null, fullName: null } : null,
});
const call = (route: (request: Request) => Promise<Response>, path: string, token = 'valid') => route(new Request(`${origin}/workspace/${company}/${path}`, { headers: { authorization: `Bearer ${token}`, origin } }));

test('baseline fixture is the exact historical route under documented symbol transformation and POST tail is unchanged', async () => {
  const originalBytes = await readFile(originalPath);
  const candidateBytes = await readFile(routePath);
  const baselineBytes = await readFile(baselinePath);
  const executableFixture = await readFile(executableFixturePath, 'utf8');
  expect(sha(originalBytes)).toBe(originalSha256);
  expect(sha(candidateBytes)).toBe(candidateSha256);
  expect(sha(baselineBytes)).toBe('8ebe51aec86d8e5990a6f8391bb8e823c7cd661d2d7369e3b35909ef74722de3');
  const original = originalBytes.toString('utf8');
  const candidate = candidateBytes.toString('utf8');
  const reconstructed = baselineBytes.toString('utf8').replace(/^\/\*\* Frozen baseline route fixture[^\n]*\n/, '').replace('createM78RoutesBaseline', 'createM78Routes');
  expect(reconstructed).toBe(original);
  const recoveredCandidate = executableFixture
    .replace(/^\/\*\* QA import-path adaptation[^\n]*\n/, '')
    .replaceAll('../../packages/', '../../../../packages/')
    .replace("'../../apps/site-api/src/lib/auth'", "'../lib/auth'");
  expect(recoveredCandidate).toBe(candidate);
  const start = " if(request.method!=='GET'&&request.method!=='POST')";
  const originalStart = original.indexOf(start);
  const candidateStart = candidate.indexOf(start);
  expect(original.slice(0, originalStart)).toBe(candidate.slice(0, candidateStart));
  const originalPost = original.indexOf(' if(id||operation)return respond(405', originalStart);
  const candidatePost = candidate.indexOf(' if(id||operation)return respond(405', candidateStart);
  expect(original.slice(originalPost)).toBe(candidate.slice(candidatePost));
});

test('valid direct version and report reads use one specific getter and no root or writer', async () => {
  for (const family of ['process_screen', 'inventory'] as const) {
    const value = row(family);
    const prefix = family === 'process_screen' ? 'process-screen' : 'scope1-inventory';
    const fixture = database();
    const route = await makeRoute(fixture.db);
    const version = await call(route, `${prefix}/${value.id.stream}/versions/${value.id.version}`);
    const report = await call(route, `${prefix}/${value.id.stream}/reports/${value.id.report}`);
    expect(version.status).toBe(200);
    expect(await version.json()).toEqual(value.envelope);
    expect(report.status).toBe(200);
    expect(await report.json()).toEqual(value.report);
    expect(fixture.counts).toEqual({ root: 0, version: 1, report: 1, writes: 0 });
  }
});

test('every mismatched returned identity falls back and releases no direct bytes', async () => {
  const good = row('inventory');
  for (const [kind, mutate] of [
    ['version', (value: any) => { value.version.id = ids.process.version; }],
    ['version', (value: any) => { value.version.companyId = otherCompany; }],
    ['version', (value: any) => { value.version.streamId = ids.process.stream; }],
    ['version', (value: any) => { value.version.family = 'process_screen'; }],
    ['report', (value: any) => { value.id = ids.process.report; }],
    ['report', (value: any) => { value.companyId = otherCompany; }],
    ['report', (value: any) => { value.streamId = ids.process.stream; }],
    ['report', (value: any) => { value.family = 'process_screen'; }],
  ] as const) {
    const value: any = structuredClone(kind === 'version' ? good.envelope : good.report);
    mutate(value);
    const fixture = database(kind === 'version'
      ? { findScope1Version: async () => { fixture.counts.version++; return value; } }
      : { findScope1Report: async () => { fixture.counts.report++; return value; } });
    const route = await makeRoute(fixture.db);
    const id = kind === 'version' ? good.id.version : good.id.report;
    const response = await call(route, `scope1-inventory/${good.id.stream}/${kind}s/${id}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: `Scope 1 ${kind} not found.` });
    expect(fixture.counts.root).toBe(1);
    expect(fixture.counts.writes).toBe(0);
  }
});

test('actual cross-family request keeps generic 404 and asynchronous fallback errors remain mapped', async () => {
  const process = row('process_screen');
  for (const [kind, id] of [['version', process.id.version], ['report', process.id.report]] as const) {
    const fixture = database();
    const route = await makeRoute(fixture.db);
    const response = await call(route, `scope1-inventory/${process.id.stream}/${kind}s/${id}`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Scope 1 record not found.' });
    expect(fixture.counts.root).toBe(1);
  }
  for (const [error, status, body] of [
    [Object.assign(Error('denied'), { code: '42501' }), 403, { error: 'Forbidden.' }],
    [Object.assign(Error('capacity'), { code: '54000' }), 422, { error: 'Scope 1 history capacity reached; retained records remain readable.', code: 'history_limit' }],
    [Object.assign(Error('invalid'), { code: '22023' }), 422, { error: 'Invalid or unsupported Scope 1 input.' }],
    [Error('corrupt'), 503, { error: 'Scope 1 records could not be verified.' }],
  ] as const) {
    const fixture = database({
      findScope1Report: async () => { fixture.counts.report++; return null; },
      findScope1: async () => { fixture.counts.root++; await Promise.resolve(); throw error; },
    });
    const route = await makeRoute(fixture.db);
    const response = await call(route, `scope1-inventory/${ids.inventory.stream}/reports/${ids.inventory.report}`);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
    expect(fixture.counts).toEqual({ root: 1, version: 0, report: 1, writes: 0 });
  }
});

test('authentication and staging refusals occur before direct or root getters', async () => {
  const fixture = database();
  const route = await makeRoute(fixture.db);
  const path = `scope1-inventory/${ids.inventory.stream}/reports/${ids.inventory.report}`;
  expect((await call(route, path, 'invalid')).status).toBe(401);
  const staged = await makeRoute(fixture.db, false);
  expect((await call(staged, path)).status).toBe(403);
  expect(fixture.counts).toEqual({ root: 0, version: 0, report: 0, writes: 0 });
});

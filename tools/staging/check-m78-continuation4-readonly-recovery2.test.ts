import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { decodeScope1Register } from '../../apps/site-web/src/lib/m78-api';
import { decodeCorporateRegister } from '../../apps/site-web/src/lib/m71-api';
import { decodeGasRegister } from '../../apps/site-web/src/lib/m73-api';
import { decodeMobileRegister } from '../../apps/site-web/src/lib/m74-api';
import { decodeFleetRegister } from '../../apps/site-web/src/lib/m75-api';
import { decodeGeneratorRegister } from '../../apps/site-web/src/lib/m76-diesel-api';
import { decodeStationaryRegister } from '../../apps/site-web/src/lib/m76-api';
import { decodeFugitiveRegister } from '../../apps/site-web/src/lib/m77-api';
import { m78CanonicalJson as canonical } from '../../packages/neuvetra-database/src/m78-validation';
import { buildM78ReadonlyFailure2FixtureDownloads, loadM78ReadonlyFailure2Fixture } from '../../evaluations/research-qa/m78-readonly-failure-review2-fixture';
import { M78_READONLY_RECOVERY2_AUTH, M78_READONLY_RECOVERY2_HOST, M78_READONLY_RECOVERY2_PATHS, evaluateM78ReadonlyRecovery2Capture, reconstructM78ReadonlyRecovery2Artifacts, runM78Continuation4ReadonlyRecovery2, verifyM78ReadonlyRecovery2PreAuth, type Recovery2Admission } from './check-m78-continuation4-readonly-recovery2';
import type { RecoveryAuth, RecoveryIO } from './check-m78-continuation4-readonly-recovery';

const sha = (value: string | Uint8Array) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const clone = <T>(value: T): T => structuredClone(value);
async function text(path: string) { return readFile(path, 'utf8'); }
async function admission() {
  const files = {
    mainText: '.superpowers/m78-hosted-continuation4.jsonl', diagnosticText: '.superpowers/m78-hosted-continuation4-diagnostics.jsonl', baselineResultText: 'evaluations/research-qa/m78-continuation4-baseline-independent-result.json', exerciseGateText: '.superpowers/m78-continuation4-exercise-gate.json', providerObservationText: 'evaluations/research-qa/m78-continuation4-failure-http-observation.json', browserObservationText: 'evaluations/research-qa/m78-continuation4-browser-http-observation.json', failureReviewText: 'evaluations/research-qa/m78-continuation4-exercise-failure-qa-result.json', failedRecoveryJournalText: '.superpowers/m78-continuation4-readonly-recovery.jsonl', failedRecoveryDiagnosticText: '.superpowers/m78-continuation4-readonly-recovery-diagnostics.jsonl', failedRecoveryReviewText: 'evaluations/research-qa/m78-readonly-failure-review2-result.json',
  } as const;
  const loaded: any = {}; for (const [key, path] of Object.entries(files)) loaded[key] = await text(path);
  const source = await text('tools/staging/check-m78-continuation4-readonly-recovery2.ts'), pins = Array.from({ length: 173 }, (_, index) => { const path = index === 0 ? 'tools/staging/check-m78-continuation4-readonly-recovery2.ts' : `synthetic://recovery2/${index}`, value = index === 0 ? source : `recovery2-pin-${index}`; return { path, value, sha256: sha(value) }; }), currentSourcePins = pins.map(({ path, sha256 }) => ({ path, sha256 }));
  loaded.currentSourcePins = currentSourcePins;
  loaded.currentSourceGateText = JSON.stringify({ status: 'm78_continuation4_readonly_recovery2_source_admitted', historicalExerciseGateSha256: '9fe233c964b8c40f6c7a9871eecf75a318e7a800f2ec14570c6803288ff9dce7', failedRecoverySha256: '0c2062c12db60f0e65c21f0fcc17122a95a11ba689d04f18c51c0652f887aca8', failedRecoveryDiagnosticsSha256: 'e2e56cc5b3220b1d138023e945e38c9d2dfeca26a15bcd4a35b2cd71d33ff57c', failedRecoveryReviewSha256: sha(loaded.failedRecoveryReviewText), sourcePins: currentSourcePins, sourcePinsSha256: sha(canonical(currentSourcePins)), runtime: { commit: '9'.repeat(40), deploymentId: 'synthetic-recovery2', imageDigest: 'sha256:' + '3'.repeat(64) } });
  loaded.load = async (path: string) => pins.find(pin => pin.path === path)!.value;
  return loaded as Recovery2Admission;
}

function proofVersion(all: any[], pin: any) { const raw = all.find(version => version.id === pin.id && version.versionSha256 === pin.sha256); if (!raw) throw Error('missing proof version'); return raw; }
function reportProof(family: 'fleet' | 'equipment', baseline: any, response: any) {
  const snapshot = JSON.parse(response.snapshotJson), reconciliation = snapshot.reconciliation, corporate = baseline.registers.corporate.versions, coverageRaw = reconciliation.coveragePin ? proofVersion(corporate, reconciliation.coveragePin) : null;
  const coverageVersion = coverageRaw ? { ...clone(coverageRaw), review: reconciliation.coverageReviewPin ? (coverageRaw.review?.id === reconciliation.coverageReviewPin.id && coverageRaw.review.decisionSha256 === reconciliation.coverageReviewPin.sha256 ? clone(coverageRaw.review) : (() => { throw Error('coverage review pin'); })()) : null } : null;
  const boundRaw = proofVersion(corporate, { id: snapshot.version.activity.coverageVersionId, sha256: snapshot.version.activity.coverageVersionSha256 }), boundCoverageVersion = { ...clone(boundRaw), review: coverageVersion?.id === boundRaw.id ? clone(coverageVersion.review) : null };
  if (family === 'fleet') {
    const all = baseline.registers.mobile.worksheets.flatMap((worksheet: any) => worksheet.versions), workpaperVersions = reconciliation.workpaperPins.map((pin: any) => { const raw = proofVersion(all, pin.version); return { ...clone(raw), review: pin.decision ? (raw.review?.id === pin.decision.id && raw.review.decisionSha256 === pin.decision.sha256 ? clone(raw.review) : (() => { throw Error('mobile review pin'); })()) : null }; });
    return { reportId: response.id, proof: { coverageVersion, boundCoverageVersion, workpaperVersions } };
  }
  const gas = baseline.registers.gas.worksheets.flatMap((worksheet: any) => worksheet.versions), diesel = baseline.registers.diesel.worksheets.flatMap((worksheet: any) => worksheet.versions), resolve = (all: any[], pin: any) => { const raw = proofVersion(all, pin.version); return { ...clone(raw), review: pin.decision ? (raw.review?.id === pin.decision.id && raw.review.decisionSha256 === pin.decision.sha256 ? clone(raw.review) : (() => { throw Error('equipment review pin'); })()) : null }; };
  return { reportId: response.id, proof: { coverageVersion, boundCoverageVersion, gasWorkpaperVersions: reconciliation.workpaperPins.filter((pin: any) => pin.family === 'natural_gas').map((pin: any) => resolve(gas, pin)), dieselWorkpaperVersions: reconciliation.workpaperPins.filter((pin: any) => pin.family === 'stationary_diesel').map((pin: any) => resolve(diesel, pin)) } };
}

test('preauth binds the exact closed recovery failure, independent failure2 review and separate source gate', async () => {
  const input = await admission(), result = await verifyM78ReadonlyRecovery2PreAuth(input); expect(result.reconciled.operationTriplesVerified).toBe(37); expect(result.historicalSourcePins).toHaveLength(173); expect(result.failedReview.materialFindingsOpen).toBe(0);
  const changed = { ...input, failedRecoveryJournalText: input.failedRecoveryJournalText + ' ' }; await expect(verifyM78ReadonlyRecovery2PreAuth(changed)).rejects.toThrow('preserved failed recovery bytes');
});

test('real nonempty archived baseline reconstructs mobile, fleet and equipment bytes with separate exact proof envelopes', async () => {
  const { baseline, reports } = await loadM78ReadonlyFailure2Fixture(), company = baseline.scope1.companyId, rosterArtifacts: any = { fleet: {}, equipment: {} };
  expect(await decodeScope1Register(baseline.scope1, company)).toEqual(baseline.scope1);
  for (const [family, decode] of [['corporate', decodeCorporateRegister], ['gas', decodeGasRegister], ['mobile', decodeMobileRegister], ['fleet', decodeFleetRegister], ['diesel', decodeGeneratorRegister], ['equipment', decodeStationaryRegister], ['fugitive', decodeFugitiveRegister]] as const) expect(await decode(baseline.registers[family], company)).toEqual(baseline.registers[family]);
  let count = 0; for (const family of ['fleet', 'equipment'] as const) for (const metadata of baseline.registers[family].reports) { const response = reports.get(metadata.id)?.response; expect(response).toBeDefined(); const proofEnvelope = reportProof(family, baseline, response); expect(sha(canonical(proofEnvelope))).toBe(baseline.downloads[family]['proof_' + metadata.id]); rosterArtifacts[family][metadata.id] = { html: response.html, snapshotJson: response.snapshotJson, proofEnvelope, htmlCapture: ++count, snapshotCapture: ++count, proofCapture: ++count }; }
  const actual = await reconstructM78ReadonlyRecovery2Artifacts(baseline.scope1, baseline.registers, {}, rosterArtifacts), selected = buildM78ReadonlyFailure2FixtureDownloads(baseline, reports); expect(actual.downloads.mobile).toEqual(selected.mobile); expect(actual.downloads.fleet).toEqual(selected.fleet); expect(actual.downloads.equipment).toEqual(selected.equipment); expect(actual.downloads).toEqual(baseline.downloads); expect(actual.m78bytes).toEqual(baseline.m78bytes); expect(count).toBe(24); expect(Object.keys(actual.downloads.mobile).some(key => key.startsWith('statement_'))).toBeFalse();
}, 30_000);

function rawCapture(body: Uint8Array, headers: Record<string, string> = {}) { const base = { sequence: 1, previousSha256: null, profile: 'm78-continuation4-readonly-recovery2-raw-capture-v1', status: 'captured_unreviewed', requestOrdinal: 5, route: 'application:/workspace-api/workspace/:id/scope1-inventory', responseStatus: 200, headers, encoding: 'base64', body: Buffer.from(body).toString('base64'), bodySha256: sha(body), byteLength: body.byteLength, createdAt: '2026-09-23T03:00:00.000Z' }, event = { ...base, sha256: sha(canonical(base)) }; return JSON.stringify(event) + '\n'; }
test('offline raw capture preserves BOM and malformed UTF-8 bytes exactly and rejects secrets or mutation', () => {
  for (const body of [new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), new Uint8Array([0xc3, 0x28, 0xff])]) expect(evaluateM78ReadonlyRecovery2Capture(rawCapture(body))[0]!.bodySha256).toBe(sha(body));
  expect(() => evaluateM78ReadonlyRecovery2Capture(rawCapture(new Uint8Array([1]), { authorization: 'private' }))).toThrow('raw capture secret header');
  expect(() => evaluateM78ReadonlyRecovery2Capture(rawCapture(new Uint8Array([1])).replace('AQ==', 'Ag=='))).toThrow();
});

function memory() { const values = new Map<string, string>(), writes: string[] = []; const io: RecoveryIO = { read: async path => values.get(path) ?? null, append: async (path, value, exclusive) => { if (exclusive && values.has(path)) throw Error('exists'); writes.push(path); values.set(path, (values.get(path) ?? '') + value); } }; return { io, values, writes }; }
test('runner durably captures raw application bytes before decode failure, excludes auth bodies and closes known sessions', async () => {
  const store = memory(), input = await admission(), calls: { url: string; init: RequestInit }[] = [], malformed = new Uint8Array([0xef, 0xbb, 0xbf, 0xc3, 0x28]);
  const transport = (async (raw: RequestInfo | URL, init: RequestInit = {}) => { const url = String(raw); calls.push({ url, init }); if (url.startsWith(M78_READONLY_RECOVERY2_AUTH)) return new Response(url.includes('/logout') ? null : 'private-token-body', { status: url.includes('/logout') ? 204 : 200 }); const auth = new Headers(init.headers).get('authorization'); if (!auth) return Response.json({ error: 'Authentication required.' }, { status: 401, headers: { 'cache-control': 'no-store' } }); if (auth === 'Bearer outsider') return Response.json({ error: 'Forbidden.' }, { status: 403, headers: { 'cache-control': 'no-store' } }); return new Response(malformed, { status: 200, headers: { 'cache-control': 'no-store', 'content-type': 'application/json' } }); }) as typeof fetch;
  const auth: RecoveryAuth = { open: async (role, request) => { await request(M78_READONLY_RECOVERY2_AUTH + '/auth/v1/token', { method: 'POST', body: 'private-request' }); return { role, subject: role, authorization: 'Bearer ' + role, status: 200 }; }, close: async (_session, request) => (await request(M78_READONLY_RECOVERY2_AUTH + '/auth/v1/logout?scope=local', { method: 'POST', body: 'private-request' })).status };
  const result = await runM78Continuation4ReadonlyRecovery2({ admission: input, io: store.io, fetch: transport, auth, expectedSubjects: { manager1: 'manager1', manager2: 'manager2', member: 'member', outsider: 'outsider' }, readLegacy: async () => { throw Error('legacy not reached'); } });
  expect(result.status).toBe('failed'); expect(result.failureCategory).toBe('decode'); expect(result.failureStage).toStartWith('decode:application:'); expect(calls.filter(call => call.url.includes('/logout'))).toHaveLength(4); expect(store.values.has(M78_READONLY_RECOVERY2_PATHS.observation)).toBeFalse();
  const captureText = store.values.get(M78_READONLY_RECOVERY2_PATHS.rawCapture)!; expect(captureText).not.toContain('private-token-body'); expect(captureText).not.toContain('private-request'); const captured = evaluateM78ReadonlyRecovery2Capture(captureText); expect(captured).toHaveLength(3); expect(captured[2]!.bodySha256).toBe(sha(malformed)); expect(calls.every(call => call.init.keepalive === false && call.init.redirect === 'error' && call.init.signal instanceof AbortSignal)).toBeTrue();
});

test('duplicate evidence refuses before auth and application mutation never dispatches', async () => {
  const input = await admission(), duplicate = memory(); duplicate.values.set(M78_READONLY_RECOVERY2_PATHS.rawCapture, '{}\n'); let transports = 0;
  await expect(runM78Continuation4ReadonlyRecovery2({ admission: input, io: duplicate.io, fetch: (async () => { transports++; return new Response(); }) as unknown as typeof fetch, auth: {} as RecoveryAuth, expectedSubjects: {} as any, readLegacy: async () => { throw Error(); } })).rejects.toThrow('exclusive recovery2 path exists'); expect(transports).toBe(0);
  const store = memory(), calls: string[] = [], auth: RecoveryAuth = { open: async (_role, request) => { await request(M78_READONLY_RECOVERY2_HOST + '/workspace-api/workspace/x/scope1-inventory', { method: 'POST' }); throw Error('unreachable'); }, close: async () => 204 };
  const result = await runM78Continuation4ReadonlyRecovery2({ admission: input, io: store.io, fetch: (async raw => { calls.push(String(raw)); return new Response(); }) as typeof fetch, auth, expectedSubjects: { manager1: '1', manager2: '2', member: '3', outsider: '4' }, readLegacy: async () => { throw Error(); } }); expect(result.status).toBe('failed'); expect(result.applicationPostRequests).toBe(0); expect(calls).toHaveLength(0); expect(store.values.has(M78_READONLY_RECOVERY2_PATHS.observation)).toBeFalse();
});

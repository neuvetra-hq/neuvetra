import { expect, test } from 'bun:test';
import { m78CanonicalJson as canonical } from '../../packages/neuvetra-database/src/m78-validation';
import { M78_READONLY_RECOVERY_LOCK, M78_READONLY_RECOVERY_PATHS, type RecoveryIO } from '../../tools/staging/check-m78-continuation4-readonly-recovery';
import { M78_READONLY_RECOVERY2_LOCK, M78_READONLY_RECOVERY2_PATHS } from '../../tools/staging/check-m78-continuation4-readonly-recovery2';
import {
  M78_READONLY_REVISIT2_LOCK,
  M78_READONLY_REVISIT2_PATHS,
  M78_READONLY_REVISIT2_RUNTIME,
  runM78ReadonlyRevisit2,
  verifyM78ReadonlyRevisit2Admission,
  type ReadonlyRevisit2Dependencies,
  type ReadonlyRevisit2Input,
} from '../../tools/staging/m78-readonly-revisit2';

const sha = (value: string | Uint8Array) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const line = (digit: string) => JSON.stringify({ sha256: digit.repeat(64) }) + '\n';
function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial)), writes: string[] = [];
  const io: RecoveryIO = {
    read: async path => values.get(path) ?? null,
    append: async (path, text, exclusive) => { if (exclusive && values.has(path)) throw Error('exists'); writes.push(path); values.set(path, (values.get(path) ?? '') + text); },
  };
  return { io, values, writes };
}
function runtime() { return { ...M78_READONLY_REVISIT2_RUNTIME }; }
function restart(resultSha256: string, observationSha256: string, sourceGateSha256: string) {
  const admission = { status: 'm78_readonly_recovery2_restart_admitted', recoveryResultSha256: resultSha256, recoveryObservationSha256: observationSha256, recoverySourceGateSha256: sourceGateSha256, restartRequestsAuthorized: 1, revisitApplicationPostsAuthorized: 0, runtime: runtime() };
  const admissionText = json(admission), admissionSha256 = sha(admissionText);
  const request = { status: 'm78_readonly_recovery2_restart_requested', recoveryResultSha256: resultSha256, restartAdmissionSha256: admissionSha256, reason: 'scope1_persistence_verification', requestId: 'restart-2-1', requestedAt: '2026-09-23T04:01:00.000Z', runtime: runtime() };
  const requestText = json(request), requestSha256 = sha(requestText);
  const acknowledgmentText = json({ data: { deploymentRestart: true } }), acknowledgmentSha256 = sha(acknowledgmentText);
  const startup = { status: 'm78_readonly_recovery2_restart_startup_observed', requestSha256, acknowledgmentSha256, requestId: request.requestId, startupEvents: 1, providerStartup: { event: 'staging_started', timestamp: '2026-09-23T04:02:00.000Z' }, observedAt: '2026-09-23T04:03:00.000Z', ready: { status: 'ready', schemaVersion: 21, legacyContainmentVerified: true }, runtime: runtime() };
  const startupText = json(startup), startupSha256 = sha(startupText);
  const review = { status: 'm78_readonly_recovery2_restart_independently_verified', reviewerId: '/root/m78_transport_probe', materialFindingsOpen: 0, recoveryResultSha256: resultSha256, restartAdmissionSha256: admissionSha256, requestSha256, acknowledgmentSha256, startupSha256, exactlyOneStartup: true, runtime: runtime() };
  const independentText = json(review), independentSha256 = sha(independentText);
  return { admissionText, admissionSha256, requestText, requestSha256, acknowledgmentText, acknowledgmentSha256, startupText, startupSha256, independentText, independentSha256 };
}

async function fixture(options: { changed?: string; failed?: boolean; usedPath?: boolean; missingLock?: boolean; unsupported?: boolean } = {}) {
  const failedJournal = 'failed-recovery-journal\n', failedDiagnostics = 'failed-recovery-diagnostics\n';
  const acceptedObservation: any = {
    status: 'm78_continuation4_readonly_recovery2_observed', observedAt: '2026-09-23T04:00:00.000Z',
    scope1: { reconciliation: { sourceUnion: Array.from({ length: 10 }, (_, index) => 'source-' + index), totals: { company: { kgCo2eExact: '126850.17632025' } } } },
    registers: { corporate: { versions: [] }, gas: {}, mobile: {}, fleet: {}, diesel: {}, equipment: {}, fugitive: {} },
    downloads: { report: { sha256: '1'.repeat(64), byteLength: 1 } }, m78bytes: { snapshot: { sha256: '2'.repeat(64), byteLength: 2 } },
    fullReports: { report: { id: 'report' } }, legacy: { retained: true },
  };
  const observationText = json(acceptedObservation), recoveryJournalText = line('1'), recoveryDiagnosticText = line('2'), recoveryRawCaptureText = line('3');
  const acceptedGateText = json({ status: 'm78_continuation4_readonly_recovery2_source_admitted', runtime: runtime(), sourcePins: [{ path: 'tools/staging/check-m78-continuation4-readonly-recovery2.ts', sha256: '4'.repeat(64) }] });
  const freshGateText = json({ status: 'm78_continuation4_readonly_recovery2_source_admitted', runtime: runtime(), sourcePins: [{ path: 'tools/staging/m78-readonly-revisit2.ts', sha256: '5'.repeat(64) }] });
  const admission: any = { journalSha256: sha(recoveryJournalText), journalHead: '1'.repeat(64), diagnosticsSha256: sha(recoveryDiagnosticText), diagnosticsHead: '2'.repeat(64), rawCaptureSha256: sha(recoveryRawCaptureText), rawCaptureHead: '3'.repeat(64), observationSha256: sha(observationText), currentSourceGateSha256: sha(acceptedGateText) };
  const inputs: any = { mainText: 'main', diagnosticText: 'diagnostic', baselineResultText: 'baseline', exerciseGateText: 'exercise', providerObservationText: 'provider', browserObservationText: 'browser', failureReviewText: 'failure-review', failedRecoveryJournalText: failedJournal, failedRecoveryDiagnosticText: failedDiagnostics, failedRecoveryReviewText: 'failed-review', recoveryJournalText, recoveryDiagnosticText, recoveryRawCaptureText, observationText, currentSourceGateText: acceptedGateText };
  const independentResult = { status: 'm78_independent_continuation4_readonly_recovery2_passed', reviewerId: '/root/m78_transport_probe', materialFindingsOpen: 0, actualRecoveryAccepted: true, restartAuthorizedByThisResult: false, revisitAuthorizedByThisResult: false, applicationPostRequests: 0, allCreatedAuthSessionsClosed: true, unknownAuthSessions: 0, reviewAdmission: admission, journalSha256: admission.journalSha256, diagnosticsSha256: admission.diagnosticsSha256, rawCaptureSha256: admission.rawCaptureSha256, observationSha256: admission.observationSha256, currentSourceGateSha256: admission.currentSourceGateSha256, runtime: runtime(), completedAt: '2026-09-23T04:00:00.000Z' };
  const independentResultText = json(independentResult), independentResultSha256 = sha(independentResultText);
  const failedLock = '{"profile":"failed-recovery-lock"}\n', recovery2Lock = '{"profile":"recovery2-lock"}\n', revisit2Lock = '{"profile":"revisit2-lock"}\n';
  const initial: Record<string, string> = {
    [M78_READONLY_RECOVERY_PATHS.journal]: failedJournal,
    [M78_READONLY_RECOVERY_PATHS.diagnostics]: failedDiagnostics,
    [M78_READONLY_RECOVERY_LOCK]: failedLock,
    [M78_READONLY_RECOVERY2_PATHS.journal]: recoveryJournalText,
    [M78_READONLY_RECOVERY2_PATHS.diagnostics]: recoveryDiagnosticText,
    [M78_READONLY_RECOVERY2_PATHS.rawCapture]: recoveryRawCaptureText,
    [M78_READONLY_RECOVERY2_PATHS.observation]: observationText,
    [M78_READONLY_RECOVERY2_LOCK]: recovery2Lock,
  };
  if (!options.missingLock) initial[M78_READONLY_REVISIT2_LOCK] = revisit2Lock;
  if (options.usedPath) initial[M78_READONLY_REVISIT2_PATHS.journal] = 'used';
  const store = memory(initial), after = structuredClone(acceptedObservation);
  if (options.changed) after[options.changed] = { changed: true };
  const newJournal = line('a'), newDiagnostics = line('b'), newCapture = line('c'), newObservation = json(after);
  const runner: any = { admission: { ...inputs, currentSourceGateText: freshGateText, currentSourcePins: JSON.parse(freshGateText).sourcePins, load: async () => '' }, expectedSubjects: { manager1: '1', manager2: '2', member: '3', outsider: '4' }, fetch: async () => new Response(), auth: {}, readLegacy: async () => ({}) };
  let runCalls = 0, verifyCalls = 0;
  const verifyRecovery2 = (async () => { verifyCalls++; return { status: 'm78_independent_continuation4_readonly_recovery2_passed', actualRecoveryAccepted: true, applicationPostRequests: 0, allCreatedAuthSessionsClosed: true, unknownAuthSessions: 0 }; }) as any;
  const runRecovery2 = (async (value: any) => {
    runCalls++; expect(value.fetch).toBe(runner.fetch); expect(value.auth).toBe(runner.auth); expect(value.admission).toBe(runner.admission); expect(value.readLegacy).toBe(runner.readLegacy);
    if (options.failed) return { status: 'failed', applicationPostRequests: 0, allCreatedAuthSessionsClosed: true, unknownAuthSessions: 0, failureStage: 'decode:test', failureCategory: 'decode' };
    if (options.unsupported) await value.io.append('.superpowers/unsupported', 'x', true);
    expect(await value.io.read(M78_READONLY_RECOVERY2_PATHS.journal)).toBeNull();
    await value.io.append(M78_READONLY_RECOVERY2_PATHS.journal, newJournal, true);
    await value.io.append(M78_READONLY_RECOVERY2_PATHS.diagnostics, newDiagnostics, true);
    await value.io.append(M78_READONLY_RECOVERY2_PATHS.rawCapture, newCapture, true);
    await value.io.append(M78_READONLY_RECOVERY2_PATHS.observation, newObservation, true);
    return { status: 'passed', applicationPostRequests: 0, allCreatedAuthSessionsClosed: true, unknownAuthSessions: 0, failureStage: null, failureCategory: null };
  }) as any;
  const input: ReadonlyRevisit2Input = {
    acceptedRecovery: { inputs, admission, independentResultText, independentResultSha256, failedRecoveryLockSha256: sha(failedLock), recovery2LockSha256: sha(recovery2Lock) },
    restart: restart(independentResultSha256, admission.observationSha256, admission.currentSourceGateSha256),
    runner, io: store.io, revisit2LockSha256: sha(revisit2Lock),
  };
  const dependencies: ReadonlyRevisit2Dependencies = { runRecovery2, verifyRecovery2 };
  const preserved = new Map([...store.values].filter(([path]) => path !== M78_READONLY_REVISIT2_LOCK));
  return { input, dependencies, store, preserved, calls: () => ({ runCalls, verifyCalls }) };
}

test('source-only positive remaps all four paths, preserves prior evidence and compares retained state', async () => {
  const value = await fixture(), result = await runM78ReadonlyRevisit2(value.input, value.dependencies);
  expect(result.status).toBe('m78_readonly_revisit2_passed'); expect(result.applicationPostRequests).toBe(0); expect(result.retainedStateExact).toBeTrue(); expect(result.restartAuthorizedByThisResult).toBeFalse();
  expect(value.store.writes).toEqual(Object.values(M78_READONLY_REVISIT2_PATHS)); expect(value.calls()).toEqual({ runCalls: 1, verifyCalls: 2 });
  for (const [path, text] of value.preserved) expect(value.store.values.get(path)).toBe(text);
});

test('unavailable or altered recovery2 and restart receipts refuse before the runner', async () => {
  const mutations: Array<(input: ReadonlyRevisit2Input) => void> = [
    input => { const result = JSON.parse(input.acceptedRecovery.independentResultText); result.actualRecoveryAccepted = false; input.acceptedRecovery.independentResultText = json(result); input.acceptedRecovery.independentResultSha256 = sha(input.acceptedRecovery.independentResultText); },
    input => { const gate = JSON.parse(input.runner.admission.currentSourceGateText); gate.runtime.imageDigest = 'sha256:' + '0'.repeat(64); input.runner.admission.currentSourceGateText = json(gate); },
    input => { const request = JSON.parse(input.restart.requestText); request.reason = 'autopause'; input.restart.requestText = json(request); input.restart.requestSha256 = sha(input.restart.requestText); },
    input => { input.restart.acknowledgmentText = json({ data: { deploymentRestart: false } }); input.restart.acknowledgmentSha256 = sha(input.restart.acknowledgmentText); },
    input => { const startup = JSON.parse(input.restart.startupText); startup.startupEvents = 2; input.restart.startupText = json(startup); input.restart.startupSha256 = sha(input.restart.startupText); },
    input => { const review = JSON.parse(input.restart.independentText); review.materialFindingsOpen = 1; input.restart.independentText = json(review); input.restart.independentSha256 = sha(input.restart.independentText); },
  ];
  for (const mutate of mutations) { const value = await fixture(); mutate(value.input); await expect(runM78ReadonlyRevisit2(value.input, value.dependencies)).rejects.toThrow(); expect(value.calls().runCalls).toBe(0); expect(value.store.writes).toHaveLength(0); }
});

test('chronology, used paths and both durable predecessor locks fail closed', async () => {
  const chronology = await fixture(), startup = JSON.parse(chronology.input.restart.startupText); startup.providerStartup.timestamp = '2026-09-23T03:59:00.000Z'; chronology.input.restart.startupText = json(startup); chronology.input.restart.startupSha256 = sha(chronology.input.restart.startupText); const review = JSON.parse(chronology.input.restart.independentText); review.startupSha256 = chronology.input.restart.startupSha256; chronology.input.restart.independentText = json(review); chronology.input.restart.independentSha256 = sha(chronology.input.restart.independentText); await expect(verifyM78ReadonlyRevisit2Admission(chronology.input, chronology.dependencies.verifyRecovery2)).rejects.toThrow('chronology');
  for (const options of [{ usedPath: true }, { missingLock: true }]) { const value = await fixture(options); await expect(runM78ReadonlyRevisit2(value.input, value.dependencies)).rejects.toThrow(); expect(value.calls().runCalls).toBe(0); }
  const changedLock = await fixture(); changedLock.input.acceptedRecovery.recovery2LockSha256 = '0'.repeat(64); await expect(runM78ReadonlyRevisit2(changedLock.input, changedLock.dependencies)).rejects.toThrow('recovery2 lock'); expect(changedLock.calls().runCalls).toBe(0);
});

test('every retained state family is compared exactly after the full evaluator', async () => {
  for (const key of ['scope1', 'registers', 'downloads', 'm78bytes', 'fullReports', 'legacy']) { const value = await fixture({ changed: key }); await expect(runM78ReadonlyRevisit2(value.input, value.dependencies)).rejects.toThrow('retained recovery2 state ' + key); expect(value.calls()).toEqual({ runCalls: 1, verifyCalls: 2 }); }
});

test('runner failure remains failed and unsupported IO cannot touch an unowned path', async () => {
  const failed = await fixture({ failed: true }), result = await runM78ReadonlyRevisit2(failed.input, failed.dependencies); expect(result).toEqual({ status: 'failed', failureStage: 'decode:test', failureCategory: 'decode', applicationPostRequests: 0, allCreatedAuthSessionsClosed: true, unknownAuthSessions: 0 }); expect(failed.store.writes).toHaveLength(0);
  const unsupported = await fixture({ unsupported: true }); await expect(runM78ReadonlyRevisit2(unsupported.input, unsupported.dependencies)).rejects.toThrow('revisit2 append path'); expect(unsupported.store.writes).toHaveLength(0);
});

test('fixture itself retains exact canonical before and after state in the positive case', async () => {
  const value = await fixture(), before = JSON.parse(value.input.acceptedRecovery.inputs.observationText); await runM78ReadonlyRevisit2(value.input, value.dependencies); const after = JSON.parse(value.store.values.get(M78_READONLY_REVISIT2_PATHS.observation)!); expect(canonical(after.scope1)).toBe(canonical(before.scope1)); expect(canonical(after.fullReports)).toBe(canonical(before.fullReports));
});

test('candidate1 finding: coordinated lock bytes and adjacent hashes are accepted', async () => {
  const value = await fixture();
  const failed = '{"profile":"substituted-failed-lock"}\n';
  const recovery2 = '{"profile":"substituted-recovery2-lock"}\n';
  const revisit2 = '{"profile":"substituted-revisit2-lock"}\n';
  value.store.values.set(M78_READONLY_RECOVERY_LOCK, failed);
  value.store.values.set(M78_READONLY_RECOVERY2_LOCK, recovery2);
  value.store.values.set(M78_READONLY_REVISIT2_LOCK, revisit2);
  value.input.acceptedRecovery.failedRecoveryLockSha256 = sha(failed);
  value.input.acceptedRecovery.recovery2LockSha256 = sha(recovery2);
  value.input.revisit2LockSha256 = sha(revisit2);
  const result = await runM78ReadonlyRevisit2(value.input, value.dependencies);
  expect(result.status).toBe('m78_readonly_revisit2_passed');
});

test('candidate1 finding: restart may be stale when revisit begins', async () => {
  const value = await fixture();
  value.input.runner.now = () => '2027-09-23T04:03:00.000Z';
  const admitted = await verifyM78ReadonlyRevisit2Admission(value.input, value.dependencies.verifyRecovery2);
  expect(admitted.startup.observedAt).toBe('2026-09-23T04:03:00.000Z');
});

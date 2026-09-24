import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { reviewM78Recovery2RestartActual, type RestartActualInputs } from './m78-recovery2-restart-actual-independent-review';

const sha = (value: string | Uint8Array) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n');
const runtime = { commit: '9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e', deploymentId: 'f6d77b2e-6886-429b-a4d2-4873c9199ce8', imageDigest: 'sha256:3e4c2c91591a5598a85f63b4099b1b4890588ce79ec832b21b7d284b5aa89d1b', autodeploy: false } as const;
const ready = { status: 'ready', profile: 'neuvetra.private-synthetic-staging.v1', schemaVersion: 21, legacyContainmentVerified: true };
const helpers = [
  { path: '.superpowers/m78-recovery2-validate-for-restart.ts', sha256: '78a21f7f8db113734e14ee2eb8bbbc0cac06cfe4c12743a8b2bc7567e92da3fb' },
  { path: '.superpowers/m78-recovery2-restart-admit.py', sha256: '35481c139aace400135e00e0b16eefcf94292592f442011c8ef390b0415b9105' },
  { path: '.superpowers/m78-recovery2-request-restart.py', sha256: 'd0c1b19e51c02f9d016cd5e95e1c3b15c70b73f3ffa8a3d80f2b42894c45d8e7' },
  { path: '.superpowers/m78-recovery2-collect-startup.py', sha256: '45b0776cca680bf7657bbca6e1b493fa835d15d733129b3b82134b9c9bc796ef' },
];
const collector2 = { path: '.superpowers/m78-recovery2-collect-startup2.py', sha256: 'bbc03eba8ed216dbfca55b083a9de648790bb530eb98d1e55ad10918f6b0dddb' } as const;

async function fixture() {
  const actualBytes = new Uint8Array(await readFile('evaluations/research-qa/m78-readonly-recovery2-actual-independent-result.json'));
  const actual = JSON.parse(Buffer.from(actualBytes).toString());
  const currentBytes = new Map<string, Uint8Array>();
  for (const row of [...helpers, ...Object.values(actual.evidence) as any[]]) currentBytes.set(row.path, new Uint8Array(await readFile(row.path)));
  currentBytes.set(collector2.path, new Uint8Array(await readFile(collector2.path)));
  const sourceReview = { status: 'm78_recovery2_restart_independent_source_review_passed', reviewerId: '/root', materialFindingsOpen: 0, snapshot: { sha256: '2863eb990c145c53c0febd19e536f793d014174441ed543a2f2874ae94ba25a2' }, sourcePins: helpers };
  const admission: any = { status: 'm78_readonly_recovery2_restart_admitted', admittedAt: '2026-09-23T04:10:00.000Z', recoveryResultSha256: sha(actualBytes), restartRequestsAuthorized: 1, revisitApplicationPostsAuthorized: 0, runtime, actualQa: { path: 'evaluations/research-qa/m78-readonly-recovery2-actual-independent-result.json', sha256: sha(actualBytes) }, restartHelperPins: helpers, validatedRecovery: { status: 'm78_readonly_recovery2_restart_validation_passed' }, providerState: { observedAt: '2026-09-23T04:09:00.000Z', deployment: { id: runtime.deploymentId, status: 'SUCCESS', commit: runtime.commit, imageDigest: runtime.imageDigest }, activeDeployments: 1, autodeploy: false, ready, deploymentRowsSha256: '1'.repeat(64), autodeployResponseSha256: '2'.repeat(64) } };
  const admissionBytes = json(admission);
  const request: any = { status: 'm78_readonly_recovery2_restart_requested', recoveryResultSha256: sha(actualBytes), restartAdmissionSha256: sha(admissionBytes), reason: 'scope1_persistence_verification', requestId: '12345678-1234-4123-8123-123456789abc', requestedAt: '2026-09-23T04:11:00.000Z', runtime, validatedRecovery: admission.validatedRecovery };
  const requestBytes = json(request), acknowledgmentBytes = json({ data: { deploymentRestart: true } });
  const startupEvent = { event: 'staging_started', timestamp: '2026-09-23T04:12:00.000Z' }, logsBytes = new TextEncoder().encode(JSON.stringify(startupEvent) + '\n');
  const startup: any = { status: 'm78_readonly_recovery2_restart_startup_observed', requestSha256: sha(requestBytes), acknowledgmentSha256: sha(acknowledgmentBytes), requestId: request.requestId, startupEvents: 1, providerStartup: startupEvent, observedAt: '2026-09-23T04:14:00.000Z', ready, runtime, providerEvidence: { collectionUntil: '2026-09-23T04:13:00.000Z', startupLogsSha256: sha(logsBytes), deploymentRowsSha256: '3'.repeat(64), autodeployResponseSha256: '4'.repeat(64), collector: collector2 } };
  return { input: { actualBytes, sourceReviewBytes: json(sourceReview), admissionBytes, requestBytes, acknowledgmentBytes, startupBytes: json(startup), logsBytes, currentBytes } satisfies RestartActualInputs, admission, request, startup };
}

test('synthetic exact restart chain produces only the adapter receipt contract', async () => {
  const { input } = await fixture(), result = reviewM78Recovery2RestartActual(input);
  expect(result.status).toBe('m78_readonly_recovery2_restart_independently_verified');
  expect(result.reviewerId).toBe('/root/m78_transport_probe'); expect(result.materialFindingsOpen).toBe(0); expect(result.exactlyOneStartup).toBeTrue();
  expect(result.recoveryResultSha256).toBe('eaa2f3e35e3e7b939a15aa9122fdddfea19625eefc484d305ecce656d4491bd1'); expect(result.runtime).toEqual(runtime);
  expect(result.startupCollector).toEqual(collector2); expect(result.originalAdmissionHelperPinsPreserved).toBeTrue();
});

test('mutated chain fields, bytes, source and chronology are refused', async () => {
  const variants: Array<(value: Awaited<ReturnType<typeof fixture>>) => void> = [
    value => { value.admission.restartRequestsAuthorized = 2; value.input.admissionBytes = json(value.admission); },
    value => { value.request.reason = 'generic_restart'; value.input.requestBytes = json(value.request); },
    value => { value.request.restartAdmissionSha256 = '0'.repeat(64); value.input.requestBytes = json(value.request); },
    value => { value.input.acknowledgmentBytes = json({ data: { deploymentRestart: false } }); },
    value => { value.startup.startupEvents = 2; value.input.startupBytes = json(value.startup); },
    value => { value.input.logsBytes = new TextEncoder().encode('{"event":"staging_started","timestamp":"different"}\n'); },
    value => { value.startup.providerStartup.timestamp = value.request.requestedAt; value.input.startupBytes = json(value.startup); },
    value => { value.input.currentBytes.set(helpers[0].path, new TextEncoder().encode('changed')); },
    value => { value.startup.providerEvidence.collector.sha256 = '0'.repeat(64); value.input.startupBytes = json(value.startup); },
  ];
  for (const mutate of variants) { const value = await fixture(); mutate(value); expect(() => reviewM78Recovery2RestartActual(value.input)).toThrow(); }
});

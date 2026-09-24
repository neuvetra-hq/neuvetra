import { open, readFile } from 'node:fs/promises';
import { m78CanonicalJson as canonical } from '../../packages/neuvetra-database/src/m78-validation';

const ACTUAL_PATH = 'evaluations/research-qa/m78-readonly-recovery2-actual-independent-result.json';
const ACTUAL_SHA = 'eaa2f3e35e3e7b939a15aa9122fdddfea19625eefc484d305ecce656d4491bd1';
const SOURCE_REVIEW_PATH = 'evaluations/research-qa/m78-recovery2-restart-root-source-result.json';
const PATHS = {
  admission: '.superpowers/m78-recovery2-restart-admission.json',
  request: '.superpowers/m78-recovery2-restart-request.json',
  acknowledgment: '.superpowers/m78-recovery2-restart-ack.json',
  startup: '.superpowers/m78-recovery2-restart-startup.json',
  logs: '.superpowers/m78-recovery2-restart-startup-logs.jsonl',
} as const;
const HELPERS = [
  { path: '.superpowers/m78-recovery2-validate-for-restart.ts', sha256: '78a21f7f8db113734e14ee2eb8bbbc0cac06cfe4c12743a8b2bc7567e92da3fb' },
  { path: '.superpowers/m78-recovery2-restart-admit.py', sha256: '35481c139aace400135e00e0b16eefcf94292592f442011c8ef390b0415b9105' },
  { path: '.superpowers/m78-recovery2-request-restart.py', sha256: 'd0c1b19e51c02f9d016cd5e95e1c3b15c70b73f3ffa8a3d80f2b42894c45d8e7' },
  { path: '.superpowers/m78-recovery2-collect-startup.py', sha256: '45b0776cca680bf7657bbca6e1b493fa835d15d733129b3b82134b9c9bc796ef' },
] as const;
const COLLECTOR2 = { path: '.superpowers/m78-recovery2-collect-startup2.py', sha256: 'bbc03eba8ed216dbfca55b083a9de648790bb530eb98d1e55ad10918f6b0dddb' } as const;
const RUNTIME = { commit: '9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e', deploymentId: 'f6d77b2e-6886-429b-a4d2-4873c9199ce8', imageDigest: 'sha256:3e4c2c91591a5598a85f63b4099b1b4890588ce79ec832b21b7d284b5aa89d1b', autodeploy: false } as const;
const READY = { status: 'ready', profile: 'neuvetra.private-synthetic-staging.v1', schemaVersion: 21, legacyContainmentVerified: true } as const;
const sha = (value: string | Uint8Array) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const check: (value: unknown, label: string) => asserts value = (value, label) => { if (!value) throw Error('Recovery2 restart independent review refused: ' + label); };
const same = (left: unknown, right: unknown) => canonical(left) === canonical(right);
const parsedTime = (value: unknown, label: string) => { const result = Date.parse(String(value)); check(Number.isFinite(result), label); return result; };
const parse = (bytes: Uint8Array, label: string) => { try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw Error('Recovery2 restart independent review refused: ' + label); } };

export type RestartActualInputs = {
  actualBytes: Uint8Array;
  sourceReviewBytes: Uint8Array;
  admissionBytes: Uint8Array;
  requestBytes: Uint8Array;
  acknowledgmentBytes: Uint8Array;
  startupBytes: Uint8Array;
  logsBytes: Uint8Array;
  currentBytes: ReadonlyMap<string, Uint8Array>;
};

export function reviewM78Recovery2RestartActual(input: RestartActualInputs) {
  check(sha(input.actualBytes) === ACTUAL_SHA, 'accepted actual recovery2 bytes');
  const actual = parse(input.actualBytes, 'actual recovery2 JSON');
  check(actual.status === 'm78_independent_continuation4_readonly_recovery2_passed'
    && actual.reviewerId === '/root/m78_transport_probe' && actual.materialFindingsOpen === 0
    && actual.actualRecoveryAccepted === true && actual.restartAuthorizedByThisResult === false && actual.revisitAuthorizedByThisResult === false
    && actual.applicationPostRequests === 0 && actual.allCreatedAuthSessionsClosed === true && actual.unknownAuthSessions === 0
    && same(actual.runtime, RUNTIME), 'accepted actual recovery2 contract');
  check(actual.evidence && Object.keys(actual.evidence).length === 10, 'exact actual recovery2 evidence');
  for (const row of Object.values(actual.evidence) as any[]) {
    const bytes = input.currentBytes.get(row.path);
    check(bytes && sha(bytes) === row.sha256, 'actual recovery2 evidence ' + row.path);
  }

  const sourceReview = parse(input.sourceReviewBytes, 'source review JSON');
  check(sourceReview.status === 'm78_recovery2_restart_independent_source_review_passed'
    && sourceReview.reviewerId === '/root' && sourceReview.materialFindingsOpen === 0
    && sourceReview.snapshot?.sha256 === '2863eb990c145c53c0febd19e536f793d014174441ed543a2f2874ae94ba25a2', 'accepted restart source review');
  const sourceMap = new Map((sourceReview.sourcePins as any[]).map(row => [row.path, row.sha256]));
  for (const helper of HELPERS) {
    check(sourceMap.get(helper.path) === helper.sha256, 'source review helper ' + helper.path);
    const bytes = input.currentBytes.get(helper.path); check(bytes && sha(bytes) === helper.sha256, 'current helper ' + helper.path);
  }
  const collector2Bytes = input.currentBytes.get(COLLECTOR2.path);
  check(collector2Bytes && sha(collector2Bytes) === COLLECTOR2.sha256, 'current repaired startup collector');

  const admissionSha256 = sha(input.admissionBytes), requestSha256 = sha(input.requestBytes), acknowledgmentSha256 = sha(input.acknowledgmentBytes), startupSha256 = sha(input.startupBytes);
  const admission = parse(input.admissionBytes, 'admission JSON'), request = parse(input.requestBytes, 'request JSON');
  const acknowledgment = parse(input.acknowledgmentBytes, 'acknowledgment JSON'), startup = parse(input.startupBytes, 'startup JSON');
  check(admission.status === 'm78_readonly_recovery2_restart_admitted' && admission.recoveryResultSha256 === ACTUAL_SHA
    && admission.restartRequestsAuthorized === 1 && admission.revisitApplicationPostsAuthorized === 0 && same(admission.runtime, RUNTIME)
    && admission.actualQa?.path === ACTUAL_PATH && admission.actualQa.sha256 === ACTUAL_SHA
    && same(admission.restartHelperPins, HELPERS), 'restart admission');
  check(admission.providerState?.deployment?.id === RUNTIME.deploymentId && admission.providerState.deployment.status === 'SUCCESS'
    && admission.providerState.deployment.commit === RUNTIME.commit && admission.providerState.deployment.imageDigest === RUNTIME.imageDigest
    && admission.providerState.activeDeployments === 1 && admission.providerState.autodeploy === false && same(admission.providerState.ready, READY)
    && /^[a-f0-9]{64}$/.test(admission.providerState.deploymentRowsSha256)
    && /^[a-f0-9]{64}$/.test(admission.providerState.autodeployResponseSha256), 'admission provider state');
  check(request.status === 'm78_readonly_recovery2_restart_requested' && request.recoveryResultSha256 === ACTUAL_SHA
    && request.restartAdmissionSha256 === admissionSha256 && request.reason === 'scope1_persistence_verification'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.requestId)
    && same(request.runtime, RUNTIME) && same(request.validatedRecovery, admission.validatedRecovery), 'durable restart request');
  check(same(acknowledgment, { data: { deploymentRestart: true } }), 'exact provider acknowledgment');
  check(startup.status === 'm78_readonly_recovery2_restart_startup_observed' && startup.requestSha256 === requestSha256
    && startup.acknowledgmentSha256 === acknowledgmentSha256 && startup.requestId === request.requestId && startup.startupEvents === 1
    && startup.providerStartup?.event === 'staging_started' && same(startup.ready, READY) && same(startup.runtime, RUNTIME), 'startup receipt');
  const expectedLogs = new TextEncoder().encode(JSON.stringify(startup.providerStartup) + '\n');
  check(Buffer.from(input.logsBytes).equals(Buffer.from(expectedLogs)) && startup.providerEvidence?.startupLogsSha256 === sha(input.logsBytes)
    && /^[a-f0-9]{64}$/.test(startup.providerEvidence.deploymentRowsSha256)
    && /^[a-f0-9]{64}$/.test(startup.providerEvidence.autodeployResponseSha256)
    && same(startup.providerEvidence.collector, COLLECTOR2), 'sanitized startup logs, provider hashes and repaired collector provenance');
  const actualClosed = parsedTime(actual.completedAt, 'actual recovery closure time'), admitted = parsedTime(admission.admittedAt, 'admission time');
  const providerObserved = parsedTime(admission.providerState.observedAt, 'provider admission observation time'), requested = parsedTime(request.requestedAt, 'request time');
  const started = parsedTime(startup.providerStartup.timestamp, 'startup event time'), collectionUntil = parsedTime(startup.providerEvidence.collectionUntil, 'collection time'), observed = parsedTime(startup.observedAt, 'startup observation time');
  check(actualClosed < providerObserved && providerObserved <= admitted && admitted < requested && requested < started && started <= collectionUntil && collectionUntil <= observed, 'full restart chronology');
  return {
    status: 'm78_readonly_recovery2_restart_independently_verified' as const,
    reviewerId: '/root/m78_transport_probe', materialFindingsOpen: 0,
    recoveryResultSha256: ACTUAL_SHA, restartAdmissionSha256: admissionSha256,
    requestSha256, acknowledgmentSha256, startupSha256, exactlyOneStartup: true,
    startupCollector: COLLECTOR2, originalAdmissionHelperPinsPreserved: true,
    runtime: RUNTIME,
  };
}

async function fromDisk(): Promise<RestartActualInputs> {
  const actualBytes = await readFile(ACTUAL_PATH), sourceReviewBytes = await readFile(SOURCE_REVIEW_PATH);
  const actual = parse(actualBytes, 'actual recovery2 JSON'), paths = new Set<string>([...HELPERS.map(row => row.path), COLLECTOR2.path]);
  for (const row of Object.values(actual.evidence) as any[]) paths.add(row.path);
  const currentBytes = new Map<string, Uint8Array>(); for (const path of paths) currentBytes.set(path, await readFile(path));
  return { actualBytes, sourceReviewBytes, admissionBytes: await readFile(PATHS.admission), requestBytes: await readFile(PATHS.request), acknowledgmentBytes: await readFile(PATHS.acknowledgment), startupBytes: await readFile(PATHS.startup), logsBytes: await readFile(PATHS.logs), currentBytes };
}

if (import.meta.main) {
  const result = reviewM78Recovery2RestartActual(await fromDisk());
  const file = await open('evaluations/research-qa/m78-recovery2-restart-actual-independent-result.json', 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(result, null, 2) + '\n'); await file.sync(); } finally { await file.close(); }
  console.log(JSON.stringify({ status: result.status, exactlyOneStartup: result.exactlyOneStartup }));
}

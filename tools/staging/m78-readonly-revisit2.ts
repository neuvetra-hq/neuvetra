/** Post-restart GET-only revisit2 adapter. Imports are inert; root owns locks, credentials and execution. */
import { m78CanonicalJson as canonical } from '../../packages/neuvetra-database/src/m78-validation';
import {
  M78_READONLY_RECOVERY_PATHS,
  M78_READONLY_RECOVERY_LOCK,
  type RecoveryIO,
} from './check-m78-continuation4-readonly-recovery';
import {
  M78_READONLY_RECOVERY2_PATHS,
  M78_READONLY_RECOVERY2_LOCK,
  runM78Continuation4ReadonlyRecovery2,
  type Recovery2RunInput,
} from './check-m78-continuation4-readonly-recovery2';
import {
  verifyM78Continuation4ReadonlyRecovery2,
  type Recovery2ReviewAdmission,
} from '../../evaluations/research-qa/m78-readonly-recovery2-corrected-review';

export const M78_READONLY_REVISIT2_RUNTIME = {
  commit: '9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e',
  deploymentId: 'f6d77b2e-6886-429b-a4d2-4873c9199ce8',
  imageDigest: 'sha256:3e4c2c91591a5598a85f63b4099b1b4890588ce79ec832b21b7d284b5aa89d1b',
  autodeploy: false,
} as const;
export const M78_READONLY_REVISIT2_PATHS = {
  journal: '.superpowers/m78-continuation4-readonly-revisit2.jsonl',
  diagnostics: '.superpowers/m78-continuation4-readonly-revisit2-diagnostics.jsonl',
  rawCapture: '.superpowers/m78-continuation4-readonly-revisit2-raw-capture.jsonl',
  observation: '.superpowers/m78-continuation4-readonly-revisit2-observation.json',
} as const;
export const M78_READONLY_REVISIT2_LOCK = M78_READONLY_REVISIT2_PATHS.journal + '.lock';
const ACCEPTED_RECOVERY2_RESULT_SHA256 = 'eaa2f3e35e3e7b939a15aa9122fdddfea19625eefc484d305ecce656d4491bd1';
const FAILED_RECOVERY_LOCK_TEXT = '{"profile":"m78-readonly-recovery-exclusive-v1"}\n';
const RECOVERY2_LOCK_TEXT = '{"profile":"m78-readonly-recovery2-exclusive-v1"}\n';
export const M78_READONLY_REVISIT2_LOCK_TEXT = '{"profile":"m78-readonly-revisit2-exclusive-v1"}\n';

const sha = (value: string | Uint8Array) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const check: (value: unknown, message: string) => asserts value = (value, message) => { if (!value) throw Error(message); };
const same = (left: unknown, right: unknown) => canonical(left) === canonical(right);
const time = (value: unknown, label: string) => { const parsed = Date.parse(String(value)); check(Number.isFinite(parsed), label + ' time'); return parsed; };
const pinnedJson = (text: string, expectedSha256: string, label: string) => { check(/^[a-f0-9]{64}$/.test(expectedSha256) && sha(text) === expectedSha256, label + ' pin'); return JSON.parse(text); };
const exactRuntime = (value: any) => value
  && value.commit === M78_READONLY_REVISIT2_RUNTIME.commit
  && value.deploymentId === M78_READONLY_REVISIT2_RUNTIME.deploymentId
  && value.imageDigest === M78_READONLY_REVISIT2_RUNTIME.imageDigest
  && value.autodeploy === false;
const ready21 = (value: any) => value?.status === 'ready' && value.schemaVersion === 21 && value.legacyContainmentVerified === true;
const chainHead = (text: string, label: string) => { check(text.endsWith('\n'), label + ' newline'); const lines = text.trimEnd().split('\n'); check(lines.length > 0, label + ' events'); const head = JSON.parse(lines.at(-1)!).sha256; check(/^[a-f0-9]{64}$/.test(head), label + ' head'); return head as string; };

type Recovery2Inputs = Parameters<typeof verifyM78Continuation4ReadonlyRecovery2>[0];
export type AcceptedRecovery2 = {
  inputs: Recovery2Inputs;
  admission: Recovery2ReviewAdmission;
  independentResultText: string;
  independentResultSha256: string;
};
export type Recovery2RestartEvidence = {
  admissionText: string;
  admissionSha256: string;
  requestText: string;
  requestSha256: string;
  acknowledgmentText: string;
  acknowledgmentSha256: string;
  startupText: string;
  startupSha256: string;
  independentText: string;
  independentSha256: string;
};
export type ReadonlyRevisit2Input = {
  acceptedRecovery: AcceptedRecovery2;
  restart: Recovery2RestartEvidence;
  runner: Omit<Recovery2RunInput, 'io'>;
  io: RecoveryIO;
};
export type ReadonlyRevisit2Dependencies = {
  runRecovery2: typeof runM78Continuation4ReadonlyRecovery2;
  verifyRecovery2: typeof verifyM78Continuation4ReadonlyRecovery2;
  now: () => number;
};
const defaults: ReadonlyRevisit2Dependencies = {
  runRecovery2: runM78Continuation4ReadonlyRecovery2,
  verifyRecovery2: verifyM78Continuation4ReadonlyRecovery2,
  now: Date.now,
};

export async function verifyM78ReadonlyRevisit2Admission(
  input: ReadonlyRevisit2Input,
  verifyRecovery2: typeof verifyM78Continuation4ReadonlyRecovery2 = verifyM78Continuation4ReadonlyRecovery2,
) {
  const evaluated = await verifyRecovery2(input.acceptedRecovery.inputs, input.acceptedRecovery.admission);
  check(evaluated.status === 'm78_independent_continuation4_readonly_recovery2_passed'
    && evaluated.actualRecoveryAccepted === true
    && evaluated.applicationPostRequests === 0
    && evaluated.allCreatedAuthSessionsClosed === true
    && evaluated.unknownAuthSessions === 0,
  'accepted actual recovery2 evaluator');

  check(input.acceptedRecovery.independentResultSha256 === ACCEPTED_RECOVERY2_RESULT_SHA256, 'exact accepted recovery2 result');
  const result = pinnedJson(input.acceptedRecovery.independentResultText, input.acceptedRecovery.independentResultSha256, 'accepted recovery2 result');
  check(result.status === 'm78_independent_continuation4_readonly_recovery2_passed'
    && result.reviewerId === '/root/m78_transport_probe'
    && result.materialFindingsOpen === 0
    && result.actualRecoveryAccepted === true
    && result.restartAuthorizedByThisResult === false
    && result.revisitAuthorizedByThisResult === false
    && result.applicationPostRequests === 0
    && result.allCreatedAuthSessionsClosed === true
    && result.unknownAuthSessions === 0,
  'independently accepted actual recovery2');
  check(same(result.reviewAdmission, input.acceptedRecovery.admission)
    && result.journalSha256 === input.acceptedRecovery.admission.journalSha256
    && result.diagnosticsSha256 === input.acceptedRecovery.admission.diagnosticsSha256
    && result.rawCaptureSha256 === input.acceptedRecovery.admission.rawCaptureSha256
    && result.observationSha256 === input.acceptedRecovery.admission.observationSha256
    && result.currentSourceGateSha256 === input.acceptedRecovery.admission.currentSourceGateSha256
    && result.evidence?.evaluator?.path === 'evaluations/research-qa/m78-readonly-recovery2-corrected-review.ts'
    && result.evidence.evaluator.sha256 === 'c45f948482a53b9e2f2ba87c1b754bb70a6f2ced079dbf8b4d85657d7b77fa78'
    && result.evidence?.rootEvaluation?.path === '.superpowers/m78-readonly-recovery2-corrected-evaluation.json'
    && result.correctionReview?.frozenEvaluatorSha256 === '4324a96546228070f4d16b0ed6a25cbe02d56d6412d48829d1b60e176db708c1'
    && result.correctionReview.correctedEvaluatorSha256 === 'c45f948482a53b9e2f2ba87c1b754bb70a6f2ced079dbf8b4d85657d7b77fa78'
    && result.correctionReview.all37ActualPayloadsValidated === true && result.correctionReview.all37UnexpectedFieldMutationsRejected === true
    && exactRuntime(result.runtime),
  'accepted recovery2 evidence and runtime');

  const freshGate = JSON.parse(input.runner.admission.currentSourceGateText);
  check(freshGate.status === 'm78_continuation4_readonly_recovery2_source_admitted'
    && exactRuntime(freshGate.runtime)
    && Array.isArray(freshGate.sourcePins)
    && freshGate.sourcePins.some((pin: any) => pin.path === 'tools/staging/m78-readonly-revisit2.ts')
    && freshGate.sourcePins.some((pin: any) => pin.path === 'evaluations/research-qa/m78-readonly-recovery2-corrected-review.ts' && pin.sha256 === 'c45f948482a53b9e2f2ba87c1b754bb70a6f2ced079dbf8b4d85657d7b77fa78')
    && sha(input.runner.admission.currentSourceGateText) !== input.acceptedRecovery.admission.currentSourceGateSha256,
  'fresh revisit2 source gate');
  const old = input.acceptedRecovery.inputs, current = input.runner.admission;
  for (const key of ['mainText', 'diagnosticText', 'baselineResultText', 'exerciseGateText', 'providerObservationText', 'browserObservationText', 'failureReviewText', 'failedRecoveryJournalText', 'failedRecoveryDiagnosticText', 'failedRecoveryReviewText'] as const) check(current[key] === old[key], 'runner evidence identity ' + key);

  const restartAdmission = pinnedJson(input.restart.admissionText, input.restart.admissionSha256, 'restart2 admission');
  const request = pinnedJson(input.restart.requestText, input.restart.requestSha256, 'restart2 request');
  const acknowledgment = pinnedJson(input.restart.acknowledgmentText, input.restart.acknowledgmentSha256, 'restart2 acknowledgment');
  const startup = pinnedJson(input.restart.startupText, input.restart.startupSha256, 'restart2 startup');
  const review = pinnedJson(input.restart.independentText, input.restart.independentSha256, 'restart2 independent review');
  check(restartAdmission.status === 'm78_readonly_recovery2_restart_admitted'
    && restartAdmission.recoveryResultSha256 === input.acceptedRecovery.independentResultSha256
    && restartAdmission.recoveryObservationSha256 === input.acceptedRecovery.admission.observationSha256
    && restartAdmission.recoverySourceGateSha256 === input.acceptedRecovery.admission.currentSourceGateSha256
    && restartAdmission.restartRequestsAuthorized === 1
    && restartAdmission.revisitApplicationPostsAuthorized === 0
    && exactRuntime(restartAdmission.runtime),
  'restart2 admission');
  check(request.status === 'm78_readonly_recovery2_restart_requested'
    && request.recoveryResultSha256 === input.acceptedRecovery.independentResultSha256
    && request.restartAdmissionSha256 === input.restart.admissionSha256
    && request.reason === 'scope1_persistence_verification'
    && typeof request.requestId === 'string' && request.requestId.length > 0
    && exactRuntime(request.runtime),
  'restart2 request');
  check(same(acknowledgment, { data: { deploymentRestart: true } }), 'restart2 provider acknowledgment');
  check(startup.status === 'm78_readonly_recovery2_restart_startup_observed'
    && startup.requestSha256 === input.restart.requestSha256
    && startup.acknowledgmentSha256 === input.restart.acknowledgmentSha256
    && startup.requestId === request.requestId
    && startup.startupEvents === 1
    && startup.providerStartup?.event === 'staging_started'
    && ready21(startup.ready)
    && exactRuntime(startup.runtime),
  'restart2 startup');
  check(review.status === 'm78_readonly_recovery2_restart_independently_verified'
    && review.reviewerId === '/root/m78_transport_probe'
    && review.materialFindingsOpen === 0
    && review.recoveryResultSha256 === input.acceptedRecovery.independentResultSha256
    && review.restartAdmissionSha256 === input.restart.admissionSha256
    && review.requestSha256 === input.restart.requestSha256
    && review.acknowledgmentSha256 === input.restart.acknowledgmentSha256
    && review.startupSha256 === input.restart.startupSha256
    && review.exactlyOneStartup === true
    && exactRuntime(review.runtime),
  'restart2 independent review');
  const recoveryClosed = time(result.completedAt, 'recovery2 closure');
  const requested = time(request.requestedAt, 'restart2 request');
  const providerStarted = time(startup.providerStartup.timestamp, 'provider startup');
  const observed = time(startup.observedAt, 'restart2 observation');
  check(recoveryClosed < requested && requested < providerStarted && providerStarted <= observed, 'recovery2 restart chronology');
  return { evaluated, result, freshGate, restartAdmission, request, acknowledgment, startup, review };
}

function remapIO(io: RecoveryIO): RecoveryIO {
  const mapping: ReadonlyMap<string, string> = new Map([
    [M78_READONLY_RECOVERY2_PATHS.journal, M78_READONLY_REVISIT2_PATHS.journal],
    [M78_READONLY_RECOVERY2_PATHS.diagnostics, M78_READONLY_REVISIT2_PATHS.diagnostics],
    [M78_READONLY_RECOVERY2_PATHS.rawCapture, M78_READONLY_REVISIT2_PATHS.rawCapture],
    [M78_READONLY_RECOVERY2_PATHS.observation, M78_READONLY_REVISIT2_PATHS.observation],
  ]);
  return {
    read: async path => { const target = mapping.get(path); check(target, 'revisit2 read path'); return io.read(target); },
    append: async (path, text, exclusive) => { const target = mapping.get(path); check(target, 'revisit2 append path'); return io.append(target, text, exclusive); },
  };
}

export async function runM78ReadonlyRevisit2(input: ReadonlyRevisit2Input, dependencies: ReadonlyRevisit2Dependencies = defaults) {
  const admitted = await verifyM78ReadonlyRevisit2Admission(input, dependencies.verifyRecovery2);
  const restartObservedAt = time(admitted.startup.observedAt, 'restart2 observation'), preflightAge = dependencies.now() - restartObservedAt;
  check(preflightAge >= 0 && preflightAge <= 15 * 60 * 1000, 'fresh restart2 before revisit');
  const originals = new Map<string, string | null>();
  const preserve = async (path: string, expected?: string | null) => { const text = await input.io.read(path); if (expected !== undefined) check(text === expected, 'accepted evidence bytes ' + path); originals.set(path, text); return text; };
  await preserve(M78_READONLY_RECOVERY_PATHS.journal, input.acceptedRecovery.inputs.failedRecoveryJournalText);
  await preserve(M78_READONLY_RECOVERY_PATHS.diagnostics, input.acceptedRecovery.inputs.failedRecoveryDiagnosticText);
  await preserve(M78_READONLY_RECOVERY_PATHS.observation, null);
  const failedLock = await preserve(M78_READONLY_RECOVERY_LOCK); check(failedLock === FAILED_RECOVERY_LOCK_TEXT, 'failed recovery lock');
  await preserve(M78_READONLY_RECOVERY2_PATHS.journal, input.acceptedRecovery.inputs.recoveryJournalText);
  await preserve(M78_READONLY_RECOVERY2_PATHS.diagnostics, input.acceptedRecovery.inputs.recoveryDiagnosticText);
  await preserve(M78_READONLY_RECOVERY2_PATHS.rawCapture, input.acceptedRecovery.inputs.recoveryRawCaptureText);
  await preserve(M78_READONLY_RECOVERY2_PATHS.observation, input.acceptedRecovery.inputs.observationText);
  const recovery2Lock = await preserve(M78_READONLY_RECOVERY2_LOCK); check(recovery2Lock === RECOVERY2_LOCK_TEXT, 'recovery2 lock');
  for (const path of Object.values(M78_READONLY_REVISIT2_PATHS)) check(await input.io.read(path) === null, 'exclusive revisit2 path');
  const revisitLock = await input.io.read(M78_READONLY_REVISIT2_LOCK); check(revisitLock === M78_READONLY_REVISIT2_LOCK_TEXT, 'revisit2 lock held');

  const result = await dependencies.runRecovery2({ ...input.runner, io: remapIO(input.io) });
  for (const [path, text] of originals) check(await input.io.read(path) === text, 'accepted evidence changed ' + path);
  if (result.status !== 'passed') return {
    status: 'failed' as const,
    failureStage: result.failureStage,
    failureCategory: result.failureCategory,
    applicationPostRequests: result.applicationPostRequests,
    allCreatedAuthSessionsClosed: result.allCreatedAuthSessionsClosed,
    unknownAuthSessions: result.unknownAuthSessions,
  };
  check(result.applicationPostRequests === 0 && result.allCreatedAuthSessionsClosed === true && result.unknownAuthSessions === 0, 'revisit2 runner closure');
  const journalText = await input.io.read(M78_READONLY_REVISIT2_PATHS.journal);
  const diagnosticText = await input.io.read(M78_READONLY_REVISIT2_PATHS.diagnostics);
  const rawCaptureText = await input.io.read(M78_READONLY_REVISIT2_PATHS.rawCapture);
  const observationText = await input.io.read(M78_READONLY_REVISIT2_PATHS.observation);
  check(journalText && diagnosticText && rawCaptureText && observationText, 'complete revisit2 evidence');
  const attemptStarted = JSON.parse(journalText.split('\n', 1)[0]!); const revisitAge = time(attemptStarted.createdAt, 'revisit2 attempt') - restartObservedAt;
  check(attemptStarted.kind === 'attempt_started' && revisitAge >= 0 && revisitAge <= 15 * 60 * 1000, 'restart2 to revisit2 timing');
  const reviewAdmission: Recovery2ReviewAdmission = {
    journalSha256: sha(journalText), journalHead: chainHead(journalText, 'revisit2 journal'),
    diagnosticsSha256: sha(diagnosticText), diagnosticsHead: chainHead(diagnosticText, 'revisit2 diagnostics'),
    rawCaptureSha256: sha(rawCaptureText), rawCaptureHead: chainHead(rawCaptureText, 'revisit2 raw capture'),
    observationSha256: sha(observationText),
    currentSourceGateSha256: sha(input.runner.admission.currentSourceGateText),
  };
  const reviewInputs: Recovery2Inputs = {
    ...input.acceptedRecovery.inputs,
    recoveryJournalText: journalText,
    recoveryDiagnosticText: diagnosticText,
    recoveryRawCaptureText: rawCaptureText,
    observationText,
    currentSourceGateText: input.runner.admission.currentSourceGateText,
  };
  const evaluated = await dependencies.verifyRecovery2(reviewInputs, reviewAdmission);
  check(evaluated.status === 'm78_independent_continuation4_readonly_recovery2_passed'
    && evaluated.applicationPostRequests === 0
    && evaluated.allCreatedAuthSessionsClosed === true
    && evaluated.unknownAuthSessions === 0,
  'full revisit2 evaluator');
  const before = JSON.parse(input.acceptedRecovery.inputs.observationText), after = JSON.parse(observationText);
  for (const key of ['scope1', 'registers', 'downloads', 'm78bytes', 'fullReports', 'legacy'] as const) check(same(after[key], before[key]), 'retained recovery2 state ' + key);
  check(after.scope1?.reconciliation?.sourceUnion?.length === 10
    && after.scope1?.reconciliation?.totals?.company?.kgCo2eExact === '126850.17632025',
  'retained scope1 total and source union');
  return {
    status: 'm78_readonly_revisit2_passed' as const,
    applicationPostRequests: 0,
    allCreatedAuthSessionsClosed: true,
    unknownAuthSessions: 0,
    retainedStateExact: true,
    acceptedRecoveryResultSha256: input.acceptedRecovery.independentResultSha256,
    restartStartupSha256: input.restart.startupSha256,
    journalSha256: reviewAdmission.journalSha256,
    diagnosticsSha256: reviewAdmission.diagnosticsSha256,
    rawCaptureSha256: reviewAdmission.rawCaptureSha256,
    observationSha256: reviewAdmission.observationSha256,
    currentSourceGateSha256: reviewAdmission.currentSourceGateSha256,
    restartAuthorizedByThisResult: false,
    furtherRevisitAuthorizedByThisResult: false,
  };
}

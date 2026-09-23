import { open, readFile } from 'node:fs/promises';
import { m78CanonicalJson as canonical } from '../../packages/neuvetra-database/src/m78-validation';
import { verifyM78Continuation4ReadonlyRecovery2, type Recovery2ReviewAdmission } from './m78-readonly-recovery2-corrected-review';

const PATHS = {
  executionGate: '.superpowers/m78-readonly-revisit2-execution-admission.json',
  sourceGate: '.superpowers/m78-readonly-revisit2-source-gate.json',
  result: '.superpowers/m78-readonly-revisit2-execution-result.json',
  journal: '.superpowers/m78-continuation4-readonly-revisit2.jsonl',
  diagnostics: '.superpowers/m78-continuation4-readonly-revisit2-diagnostics.jsonl',
  rawCapture: '.superpowers/m78-continuation4-readonly-revisit2-raw-capture.jsonl',
  observation: '.superpowers/m78-continuation4-readonly-revisit2-observation.json',
  revisitLock: '.superpowers/m78-continuation4-readonly-revisit2.jsonl.lock',
  failedLock: '.superpowers/m78-continuation4-readonly-recovery.jsonl.lock',
  recovery2Lock: '.superpowers/m78-continuation4-readonly-recovery2.jsonl.lock',
  acceptedObservation: '.superpowers/m78-continuation4-readonly-recovery2-observation.json',
} as const;
const INPUT_PATHS = {
  mainText: '.superpowers/m78-hosted-continuation4.jsonl', diagnosticText: '.superpowers/m78-hosted-continuation4-diagnostics.jsonl',
  baselineResultText: 'evaluations/research-qa/m78-continuation4-baseline-independent-result.json', exerciseGateText: '.superpowers/m78-continuation4-exercise-gate.json',
  providerObservationText: 'evaluations/research-qa/m78-continuation4-failure-http-observation.json', browserObservationText: 'evaluations/research-qa/m78-continuation4-browser-http-observation.json', failureReviewText: 'evaluations/research-qa/m78-continuation4-exercise-failure-qa-result.json',
  failedRecoveryJournalText: '.superpowers/m78-continuation4-readonly-recovery.jsonl', failedRecoveryDiagnosticText: '.superpowers/m78-continuation4-readonly-recovery-diagnostics.jsonl', failedRecoveryReviewText: 'evaluations/research-qa/m78-readonly-failure-review2-result.json',
} as const;
const EXPECTED_GATE = '4cf6a5b38f2d6f0576fcfc7e84948ed5a84a5a09dac3752d5d101c82645bb2dd';
const EXPECTED_SOURCE_GATE = '18db508d322173dd08b09ef887f572724946a1efea1665ff80a42a0c706d8b02';
const EXPECTED_ACTUAL = 'eaa2f3e35e3e7b939a15aa9122fdddfea19625eefc484d305ecce656d4491bd1';
const EXPECTED_RESTART = '70211489b2413cd5d324574e225256893470c293160763e28f16f6b5216d7d00';
const EXPECTED_FAILED_LOCK = '67f0dbf763d4586f58199c4ffe08baf52570bdc67734661d7add29b711d72883';
const EXPECTED_RECOVERY2_LOCK = '365024f0fd2d0107b30fb63d86e0115c12894ba5844dcf1656b505501f65f71f';
const EXPECTED_REVISIT_LOCK = new Bun.CryptoHasher('sha256').update('{"profile":"m78-readonly-revisit2-exclusive-v1"}\n').digest('hex');
const sha = (value: string | Uint8Array) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const check: (value: unknown, label: string) => asserts value = (value, label) => { if (!value) throw Error('Revisit2 actual independent review refused: ' + label); };
const same = (left: unknown, right: unknown) => canonical(left) === canonical(right);
const parse = (value: string, label: string) => { try { return JSON.parse(value); } catch { throw Error('Revisit2 actual independent review refused: ' + label); } };
const chain = (text: string, label: string) => {
  check(text.endsWith('\n'), label + ' newline'); const rows = text.trimEnd().split('\n').map((line, index) => parse(line, label + ' line ' + index));
  check(rows.length > 0 && /^[a-f0-9]{64}$/.test(rows.at(-1)?.sha256), label + ' chain head'); return { rows, head: rows.at(-1).sha256 as string };
};

export type Revisit2ActualInput = {
  executionGateText: string; sourceGateText: string; resultText: string;
  journalText: string; diagnosticsText: string; rawCaptureText: string; observationText: string;
  acceptedObservationText: string; failedLockText: string; recovery2LockText: string; revisitLockText: string;
  common: Record<keyof typeof INPUT_PATHS, string>;
  currentBytes: ReadonlyMap<string, Uint8Array>;
};

export async function reviewM78ReadonlyRevisit2Actual(input: Revisit2ActualInput) {
  check(sha(input.executionGateText) === EXPECTED_GATE && sha(input.sourceGateText) === EXPECTED_SOURCE_GATE, 'exact execution and source gates');
  const gate = parse(input.executionGateText, 'execution gate JSON'), source = parse(input.sourceGateText, 'source gate JSON'), result = parse(input.resultText, 'execution result JSON');
  check(gate.status === 'm78_readonly_revisit2_execution_admitted' && gate.applicationPostRequests === 0
    && gate.workspaceId === '8b90c706-1710-494d-b12d-02eef88eacb7' && gate.sourceGate?.sha256 === EXPECTED_SOURCE_GATE
    && Array.isArray(gate.pins) && gate.pins.length === 205 && new Set(gate.pins.map((row: any) => row.path)).size === 205, 'execution admission');
  for (const pin of gate.pins) { const bytes = input.currentBytes.get(pin.path); check(bytes && sha(bytes) === pin.sha256, 'execution pin ' + pin.path); }
  const pinMap = new Map(gate.pins.map((row: any) => [row.path, row.sha256]));
  check(pinMap.get('evaluations/research-qa/m78-readonly-recovery2-actual-independent-result.json') === EXPECTED_ACTUAL
    && pinMap.get('evaluations/research-qa/m78-recovery2-restart-actual-independent-result.json') === EXPECTED_RESTART
    && pinMap.get(PATHS.sourceGate) === EXPECTED_SOURCE_GATE, 'accepted recovery, restart and source pins');
  check(source.status === 'm78_continuation4_readonly_recovery2_source_admitted'
    && Array.isArray(source.sourcePins) && source.sourcePins.length === 188
    && new Set(source.sourcePins.map((row: any) => row.path)).size === 188
    && source.sourcePins.every((row: any) => pinMap.get(row.path) === row.sha256), 'exact 188-source closure');

  check(sha(input.failedLockText) === EXPECTED_FAILED_LOCK && sha(input.recovery2LockText) === EXPECTED_RECOVERY2_LOCK
    && sha(input.revisitLockText) === EXPECTED_REVISIT_LOCK, 'unchanged durable locks');
  const journal = chain(input.journalText, 'journal'), diagnostics = chain(input.diagnosticsText, 'diagnostics'), rawCapture = chain(input.rawCaptureText, 'raw capture');
  const admission: Recovery2ReviewAdmission = {
    journalSha256: sha(input.journalText), journalHead: journal.head,
    diagnosticsSha256: sha(input.diagnosticsText), diagnosticsHead: diagnostics.head,
    rawCaptureSha256: sha(input.rawCaptureText), rawCaptureHead: rawCapture.head,
    observationSha256: sha(input.observationText), currentSourceGateSha256: sha(input.sourceGateText),
  };
  const evaluated = await verifyM78Continuation4ReadonlyRecovery2({
    ...input.common,
    recoveryJournalText: input.journalText,
    recoveryDiagnosticText: input.diagnosticsText,
    recoveryRawCaptureText: input.rawCaptureText,
    observationText: input.observationText,
    currentSourceGateText: input.sourceGateText,
  }, admission);
  check(evaluated.status === 'm78_independent_continuation4_readonly_recovery2_passed'
    && evaluated.requests === 97 && evaluated.applicationPostRequests === 0
    && evaluated.allCreatedAuthSessionsClosed === true && evaluated.unknownAuthSessions === 0
    && evaluated.addedTypedRecords === 37 && evaluated.reports === 5 && evaluated.rosterArtifactReads === 24
    && evaluated.sourceUnion === 10 && evaluated.grossKgCo2eExact === '126850.17632025', 'corrected full evaluator');
  check(result.status === 'm78_readonly_revisit2_passed' && result.applicationPostRequests === 0
    && result.allCreatedAuthSessionsClosed === true && result.unknownAuthSessions === 0 && result.retainedStateExact === true
    && result.acceptedRecoveryResultSha256 === EXPECTED_ACTUAL && result.restartStartupSha256 === '41bdf0c8eb25e38a7a3acdeab96dc9038217e7c698058b0c08757819a66aebc1'
    && result.journalSha256 === admission.journalSha256 && result.diagnosticsSha256 === admission.diagnosticsSha256
    && result.rawCaptureSha256 === admission.rawCaptureSha256 && result.observationSha256 === admission.observationSha256
    && result.currentSourceGateSha256 === admission.currentSourceGateSha256
    && result.restartAuthorizedByThisResult === false && result.furtherRevisitAuthorizedByThisResult === false, 'execution result');
  const before = parse(input.acceptedObservationText, 'accepted observation JSON'), after = parse(input.observationText, 'revisit observation JSON');
  for (const key of ['scope1', 'registers', 'downloads', 'm78bytes', 'fullReports', 'legacy']) check(same(after[key], before[key]), 'retained state ' + key);
  check(after.scope1?.reconciliation?.sourceUnion?.length === 10 && after.scope1?.reconciliation?.totals?.company?.kgCo2eExact === '126850.17632025', 'retained total and sources');
  return {
    status: 'm78_readonly_revisit2_actual_independently_passed' as const,
    reviewerId: '/root/m78_transport_probe', materialFindingsOpen: 0, actualRevisitAccepted: true,
    executionAdmissionSha256: EXPECTED_GATE, sourceGateSha256: EXPECTED_SOURCE_GATE,
    journalSha256: admission.journalSha256, journalHead: admission.journalHead,
    diagnosticsSha256: admission.diagnosticsSha256, diagnosticsHead: admission.diagnosticsHead,
    rawCaptureSha256: admission.rawCaptureSha256, rawCaptureHead: admission.rawCaptureHead,
    observationSha256: admission.observationSha256, executionResultSha256: sha(input.resultText),
    requests: 97, applicationPostRequests: 0, allCreatedAuthSessionsClosed: true, unknownAuthSessions: 0,
    retainedStateExact: true, addedTypedRecords: 37, sourceUnion: 10, reports: 5, grossKgCo2eExact: '126850.17632025',
    predecessorLocksUnchanged: true, furtherRestartAuthorized: false, furtherRevisitAuthorized: false,
  };
}

async function fromDisk(): Promise<Revisit2ActualInput> {
  const executionGateText = await readFile(PATHS.executionGate, 'utf8'), gate = parse(executionGateText, 'execution gate JSON');
  const currentBytes = new Map<string, Uint8Array>(); for (const pin of gate.pins) currentBytes.set(pin.path, await readFile(pin.path));
  const common = Object.fromEntries(await Promise.all(Object.entries(INPUT_PATHS).map(async ([key, path]) => [key, await readFile(path, 'utf8')]))) as Revisit2ActualInput['common'];
  return {
    executionGateText, sourceGateText: await readFile(PATHS.sourceGate, 'utf8'), resultText: await readFile(PATHS.result, 'utf8'),
    journalText: await readFile(PATHS.journal, 'utf8'), diagnosticsText: await readFile(PATHS.diagnostics, 'utf8'), rawCaptureText: await readFile(PATHS.rawCapture, 'utf8'), observationText: await readFile(PATHS.observation, 'utf8'),
    acceptedObservationText: await readFile(PATHS.acceptedObservation, 'utf8'), failedLockText: await readFile(PATHS.failedLock, 'utf8'), recovery2LockText: await readFile(PATHS.recovery2Lock, 'utf8'), revisitLockText: await readFile(PATHS.revisitLock, 'utf8'),
    common, currentBytes,
  };
}

if (import.meta.main) {
  const result = await reviewM78ReadonlyRevisit2Actual(await fromDisk());
  const file = await open('evaluations/research-qa/m78-readonly-revisit2-actual-independent-result.json', 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(result, null, 2) + '\n'); await file.sync(); } finally { await file.close(); }
  console.log(JSON.stringify({ status: result.status, retainedStateExact: result.retainedStateExact }));
}

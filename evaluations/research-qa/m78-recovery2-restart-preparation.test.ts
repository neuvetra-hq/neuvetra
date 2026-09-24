import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { validateM78Recovery2ForRestart } from '../../.superpowers/m78-recovery2-validate-for-restart';

const sha = (value: string | Uint8Array) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const bytes = (value: unknown) => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value) + '\n');
const runtime = { commit: '9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e', deploymentId: 'f6d77b2e-6886-429b-a4d2-4873c9199ce8', imageDigest: 'sha256:3e4c2c91591a5598a85f63b4099b1b4890588ce79ec832b21b7d284b5aa89d1b', autodeploy: false };
async function fixture() {
  const evidencePaths = {
    rootEvaluation: '.superpowers/m78-readonly-recovery2-corrected-evaluation.json', journal: '.superpowers/m78-continuation4-readonly-recovery2.jsonl', diagnostics: '.superpowers/m78-continuation4-readonly-recovery2-diagnostics.jsonl', rawCapture: '.superpowers/m78-continuation4-readonly-recovery2-raw-capture.jsonl', observation: '.superpowers/m78-continuation4-readonly-recovery2-observation.json', sourceGate: '.superpowers/m78-readonly-recovery2-source-gate.json', failedRecoveryLock: '.superpowers/m78-continuation4-readonly-recovery.jsonl.lock', recovery2Lock: '.superpowers/m78-continuation4-readonly-recovery2.jsonl.lock', evaluator: 'evaluations/research-qa/m78-readonly-recovery2-corrected-review.ts', runner: 'tools/staging/check-m78-continuation4-readonly-recovery2.ts',
  };
  const allPaths = { mainText: '.superpowers/m78-hosted-continuation4.jsonl', diagnosticText: '.superpowers/m78-hosted-continuation4-diagnostics.jsonl', baselineResultText: 'evaluations/research-qa/m78-continuation4-baseline-independent-result.json', exerciseGateText: '.superpowers/m78-continuation4-exercise-gate.json', providerObservationText: 'evaluations/research-qa/m78-continuation4-failure-http-observation.json', browserObservationText: 'evaluations/research-qa/m78-continuation4-browser-http-observation.json', failureReviewText: 'evaluations/research-qa/m78-continuation4-exercise-failure-qa-result.json', failedRecoveryJournalText: '.superpowers/m78-continuation4-readonly-recovery.jsonl', failedRecoveryDiagnosticText: '.superpowers/m78-continuation4-readonly-recovery-diagnostics.jsonl', failedRecoveryReviewText: 'evaluations/research-qa/m78-readonly-failure-review2-result.json', recoveryJournalText: evidencePaths.journal, recoveryDiagnosticText: evidencePaths.diagnostics, recoveryRawCaptureText: evidencePaths.rawCapture, observationText: evidencePaths.observation, currentSourceGateText: evidencePaths.sourceGate };
  const admission = { journalSha256: '', journalHead: '1'.repeat(64), diagnosticsSha256: '', diagnosticsHead: '2'.repeat(64), rawCaptureSha256: '', rawCaptureHead: '3'.repeat(64), observationSha256: '', currentSourceGateSha256: '' };
  const values = new Map<string, Uint8Array>();
  for (const path of Object.values(allPaths)) values.set(path, bytes('fixture ' + path));
  values.set(evidencePaths.observation, bytes({ status: 'm78_continuation4_readonly_recovery2_observed', currentSourceGateSha256: '' }));
  values.set(evidencePaths.failedRecoveryLock, bytes('{"profile":"m78-readonly-recovery-exclusive-v1"}\n'));
  values.set(evidencePaths.recovery2Lock, bytes('{"profile":"m78-readonly-recovery2-exclusive-v1"}\n'));
  values.set(evidencePaths.evaluator, new Uint8Array(await readFile(evidencePaths.evaluator)));
  values.set(evidencePaths.runner, new Uint8Array(await readFile(evidencePaths.runner)));
  const historicalEvaluatorPath = 'evaluations/research-qa/m78-readonly-recovery2-independent-review.ts'; values.set(historicalEvaluatorPath, new Uint8Array(await readFile(historicalEvaluatorPath)));
  const indirectPins = Array.from({ length: 180 }, (_, index) => ({ path: `synthetic/transitive-${index}.ts`, sha256: '' })); for (const pin of indirectPins) { const value = bytes('source ' + pin.path); values.set(pin.path, value); pin.sha256 = sha(value); }
  const sourcePins = [{ path: historicalEvaluatorPath, sha256: sha(values.get(historicalEvaluatorPath)!) }, { path: evidencePaths.runner, sha256: sha(values.get(evidencePaths.runner)!) }, ...indirectPins];
  values.set(evidencePaths.sourceGate, bytes({ status: 'm78_continuation4_readonly_recovery2_source_admitted', runtime: { commit: runtime.commit, deploymentId: runtime.deploymentId, imageDigest: runtime.imageDigest }, sourcePins }));
  Object.assign(admission, { journalSha256: sha(values.get(evidencePaths.journal)!), diagnosticsSha256: sha(values.get(evidencePaths.diagnostics)!), rawCaptureSha256: sha(values.get(evidencePaths.rawCapture)!), observationSha256: sha(values.get(evidencePaths.observation)!), currentSourceGateSha256: sha(values.get(evidencePaths.sourceGate)!) });
  values.set(evidencePaths.observation, bytes({ status: 'm78_continuation4_readonly_recovery2_observed', currentSourceGateSha256: admission.currentSourceGateSha256 })); admission.observationSha256 = sha(values.get(evidencePaths.observation)!);
  const evaluated = { status: 'm78_independent_continuation4_readonly_recovery2_passed', actualRecoveryAccepted: true, applicationPostRequests: 0, allCreatedAuthSessionsClosed: true, unknownAuthSessions: 0, addedTypedRecords: 37, reports: 5, rosterArtifactReads: 24, sourceUnion: 10, grossKgCo2eExact: '126850.17632025', hostedCalls: 0 };
  const rootEvaluation = { ...evaluated, admission, evaluatorSha256: sha(values.get(evidencePaths.evaluator)!) }; values.set(evidencePaths.rootEvaluation, bytes(rootEvaluation));
  const evidence = Object.fromEntries(Object.entries(evidencePaths).map(([key, path]) => [key, { path, sha256: sha(values.get(path)!) }]));
  const qa: any = { ...evaluated, reviewerId: '/root/m78_transport_probe', materialFindingsOpen: 0, restartAuthorizedByThisResult: false, revisitAuthorizedByThisResult: false, completedAt: '2026-09-23T05:00:00.000Z', runtime: { ...runtime }, reviewAdmission: admission, evidence, journalSha256: admission.journalSha256, diagnosticsSha256: admission.diagnosticsSha256, rawCaptureSha256: admission.rawCaptureSha256, observationSha256: admission.observationSha256, currentSourceGateSha256: admission.currentSourceGateSha256, correctionReview: { frozenEvaluatorSha256: sha(values.get(historicalEvaluatorPath)!), correctedEvaluatorSha256: sha(values.get(evidencePaths.evaluator)!), all37ActualPayloadsValidated: true, all37UnexpectedFieldMutationsRejected: true } };
  const qaPath = 'evaluations/research-qa/m78-readonly-recovery2-actual-independent-result.json'; const qaBytes = bytes(qa); values.set(qaPath, qaBytes);
  let verifyCalls = 0; const dependencies: any = { read: async (path: string) => { const value = values.get(path); if (!value) throw Error('missing ' + path); return value; }, verify: async () => { verifyCalls++; return evaluated; } };
  return { qaPath, qaBytes, qa, values, dependencies, calls: () => verifyCalls };
}

test('validator binds exact independent actual QA, evidence, locks, runtime and frozen evaluator rerun', async () => {
  const value = await fixture(), result = await validateM78Recovery2ForRestart(value.qaPath, sha(value.qaBytes), value.dependencies);
  expect(result.status).toBe('m78_readonly_recovery2_restart_validation_passed'); expect(result.actualQa.sha256).toBe(sha(value.qaBytes)); expect(result.runtime.autodeploy).toBeFalse(); expect(value.calls()).toBe(1);
});

test('changed receipt, evidence, lock, runtime or evaluator result refuses', async () => {
  const cases: Array<(value: Awaited<ReturnType<typeof fixture>>) => void> = [
    value => { value.qa.actualRecoveryAccepted = false; value.values.set(value.qaPath, bytes(value.qa)); },
    value => { value.values.set(value.qa.evidence.recovery2Lock.path, bytes('substituted lock')); },
    value => { value.qa.runtime.imageDigest = 'sha256:' + '0'.repeat(64); value.values.set(value.qaPath, bytes(value.qa)); },
    value => { value.qa.evidence.evaluator.sha256 = '0'.repeat(64); value.values.set(value.qaPath, bytes(value.qa)); },
    value => { value.values.set('synthetic/transitive-37.ts', bytes('changed indirect dependency')); },
  ];
  for (const mutate of cases) { const value = await fixture(), originalSha = sha(value.qaBytes); mutate(value); await expect(validateM78Recovery2ForRestart(value.qaPath, originalSha, value.dependencies)).rejects.toThrow(); }
  const resultMismatch = await fixture(); resultMismatch.dependencies.verify = async () => ({ status: 'failed' }); await expect(validateM78Recovery2ForRestart(resultMismatch.qaPath, sha(resultMismatch.qaBytes), resultMismatch.dependencies)).rejects.toThrow('frozen evaluator result');
});

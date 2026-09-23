import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { verifyExerciseFailure } from './m78-continuation4-exercise-failure-qa-check';

async function fixture() {
  return {
    mainText: await readFile('.superpowers/m78-hosted-continuation4.jsonl', 'utf8'),
    diagnosticText: await readFile('.superpowers/m78-hosted-continuation4-diagnostics.jsonl', 'utf8'),
    baselineResultText: await readFile('evaluations/research-qa/m78-continuation4-baseline-independent-result.json', 'utf8'),
    exerciseGateText: await readFile('.superpowers/m78-continuation4-exercise-gate.json', 'utf8'),
    providerObservationText: await readFile('evaluations/research-qa/m78-continuation4-failure-http-observation.json', 'utf8'),
    browserObservationText: await readFile('evaluations/research-qa/m78-continuation4-browser-http-observation.json', 'utf8'),
  };
}

test('reconciles the exact closed failed exercise without granting success', async () => {
  const result = await verifyExerciseFailure(await fixture());
  expect(result).toMatchObject({
    status: 'm78_continuation4_exercise_failure_independently_reconciled',
    materialFindingsOpen: 1,
    baselinePrefixPreserved: true,
    diagnosticBaselinePrefixPreserved: true,
    operationTriplesVerified: 37,
    distinctVerifiedIdentities: 37,
    repeatedApplicationPostRequests: 0,
    applicationPostRequests: 37,
    timeout: {
      ordinal: 384,
      route: 'application:/workspace-api/workspace/:id/scope1-inventory/:id/reports/:id/snapshot',
      category: 'timeout',
      clientElapsedMs: 30_011,
      providerStatus: 499,
      laterBrowserSuccessDurationMs: 90_427,
      preciseCauseEstablished: false,
    },
    mainLogins: 4,
    mainLogouts: 4,
    unknownAuthSessions: 0,
    allCreatedAuthSessionsClosed: true,
    legacyStageReached: false,
    successEvaluatorExecuted: false,
    restartExecuted: false,
    revisitExecuted: false,
  });
});

test('refuses any changed closed journal bytes', async () => {
  const input = await fixture();
  input.mainText = input.mainText.replace('"applicationPostRequests":37', '"applicationPostRequests":36');
  await expect(verifyExerciseFailure(input)).rejects.toThrow('main bytes');
});

test('refuses changed sanitized provider evidence', async () => {
  const input = await fixture();
  input.providerObservationText = input.providerObservationText.replace('"httpStatus": 499', '"httpStatus": 200');
  await expect(verifyExerciseFailure(input)).rejects.toThrow('provider observation bytes');
});

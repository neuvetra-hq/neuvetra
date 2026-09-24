import { readFile, writeFile } from 'node:fs/promises';
import { verifyExerciseFailure } from './m78-continuation4-exercise-failure-qa-check';

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex');
const check: (value: unknown, message: string) => asserts value = (value, message) => {
  if (!value) throw new Error(message);
};
const paths = {
  main: '.superpowers/m78-hosted-continuation4.jsonl',
  diagnostics: '.superpowers/m78-hosted-continuation4-diagnostics.jsonl',
  baseline: 'evaluations/research-qa/m78-continuation4-baseline-independent-result.json',
  gate: '.superpowers/m78-continuation4-exercise-gate.json',
  provider: 'evaluations/research-qa/m78-continuation4-failure-http-observation.json',
  browser: 'evaluations/research-qa/m78-continuation4-browser-http-observation.json',
} as const;
const [mainText, diagnosticText, baselineResultText, exerciseGateText, providerObservationText, browserObservationText] =
  await Promise.all(Object.values(paths).map((path) => readFile(path, 'utf8')));
const verified = await verifyExerciseFailure({
  mainText,
  diagnosticText,
  baselineResultText,
  exerciseGateText,
  providerObservationText,
  browserObservationText,
});
for (const forbidden of [
  'evaluations/research-qa/m78-continuation4-exercise-evaluated-result.json',
  'evaluations/research-qa/m78-continuation4-exercise-actual-qa-result.json',
  '.superpowers/m78-continuation-restart-requested.json',
  '.superpowers/m78-continuation-restart-ack.json',
  '.superpowers/m78-continuation-final-restart-verified.json',
  '.superpowers/m78-continuation4-revisit-gate.json',
  '.superpowers/m78-continuation4-revisit-observation.json',
]) check(!(await Bun.file(forbidden).exists()), `forbidden success/restart artifact ${forbidden}`);

const evidence = Object.entries(paths).map(([kind, path], index) => ({
  kind,
  path,
  sha256: sha([mainText, diagnosticText, baselineResultText, exerciseGateText, providerObservationText, browserObservationText][index]!),
}));
const output = {
  ...verified,
  reviewerId: '/root/m78_transport_probe',
  exerciseAccepted: false,
  fullLifecycleAccepted: false,
  actualExercisePassReceiptWritten: false,
  evidence,
  materialFindings: [
    {
      id: 'EXERCISE-PRESERVATION-TIMEOUT',
      severity: 'material',
      status: 'open',
      summary: 'The closed exercise failed during a read-only final report snapshot request after all 37 writes were verified.',
      limitation: 'The matching provider 499 and a later 90.427-second browser success establish latency observations, not the precise internal cause.',
    },
  ],
  safeNextAdmission: {
    applicationPostRequestsAllowed: 0,
    rerunExerciseWriter: false,
    restartAllowed: false,
    revisitAllowed: false,
    recommendation: 'Diagnose or explicitly accept the snapshot-route latency, then independently review a zero-write preservation-only recovery that resumes from the closed failed journal and revalidates current state before any restart or revisit.',
  },
  rootProviderAndBrowserObservationsIndependentlyReproduced: false,
  qaNetworkUsed: false,
  qaCredentialsRead: false,
  qaDatabaseUsed: false,
  qaJournalWrites: false,
};
await writeFile(
  'evaluations/research-qa/m78-continuation4-exercise-failure-qa-result.json',
  JSON.stringify(output, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(JSON.stringify({ status: output.status, materialFindingsOpen: output.materialFindingsOpen }));

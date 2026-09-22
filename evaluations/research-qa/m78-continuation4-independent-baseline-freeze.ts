import { readFile } from "node:fs/promises";

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");
const pins = [
  {
    path: "evaluations/research-qa/m78-continuation4-baseline-independent-review.ts",
    sha256: "c71d714244c5608ab0cb20112f4290de5bab018b67524c2fb039742bba0598a7",
  },
  {
    path: "evaluations/research-qa/m78-continuation4-baseline-review.test.ts",
    sha256: "886ed6a807ddcc9e18ee9fbd8665460a4d255c3b782376bf988c5338ce38c181",
  },
  {
    path: "evaluations/research-qa/m78-continuation4-independent-baseline.test.ts",
    sha256: "f33ddaf99d19e7891419c48f7280446d6b92dcff25901ad6e183329d9292dbdd",
  },
  {
    path: ".github/workflows/verify.yml",
    sha256: "6154249fe6905e2dd68fa8a3b6cf587d5f1e5f005f2ac52a1daeb1b56427dbb5",
  },
] as const;
for (const pin of pins) {
  if (sha(await readFile(pin.path)) !== pin.sha256) throw new Error(`changed reviewed source: ${pin.path}`);
}

const resultPath = "evaluations/research-qa/m78-continuation4-independent-baseline-result.json";
const result = {
  status: "m78_independent_continuation4_baseline_evaluator_passed",
  reviewerId: "/root/m78_transport_probe",
  reviewedAt: "2026-09-22",
  admission: "evaluator_source_only",
  evaluator: pins[0],
  authorTests: pins[1],
  independentTests: pins[2],
  workflow: pins[3],
  checks: {
    combined: { tests: 8, assertions: 30, failures: 0 },
    author: { tests: 7, assertions: 28, failures: 0 },
    independent: { tests: 1, assertions: 2, failures: 0 },
    rootReportedTargetedTypeScript: "passed",
  },
  rejects: {
    exactPriorFailedJournal: true,
    exactInterruptedJournal: true,
    changedTransportKeepalive: true,
    changedTransportRetries: true,
    rehashedTimeoutWithoutHeaders: true,
    rehashedMissingLogout: true,
    changedSourceOrEvidenceClosure: true,
    staleOrWrongRuntime: true,
  },
  requires: {
    sourcePins: 173,
    historicalEvidencePins: 9,
    applicationPostRequests: 0,
    unknownAuthSessions: 0,
    allCreatedAuthSessionsClosed: true,
    transport: { runtime: "bun-fetch", pooling: "disabled", keepalive: false, retries: 0 },
  },
  hostedBaselineAccepted: false,
  hostedExerciseAccepted: false,
  fullLifecycleVerified: false,
  networkUsed: false,
  databaseUsed: false,
  credentialsOpened: false,
  officialJournalsWritten: false,
};
await Bun.write(resultPath, `${JSON.stringify(result, null, 2)}\n`);

const paths = [
  pins[0].path,
  pins[1].path,
  pins[2].path,
  "evaluations/research-qa/m78-continuation4-independent-baseline-review.md",
  "evaluations/research-qa/m78-continuation4-independent-baseline-freeze.ts",
  resultPath,
];
const files = await Promise.all(paths.map(async (path) => {
  const text = await readFile(path, "utf8");
  return { path, sha256: sha(text), text };
}));
const snapshot = {
  task_id: "M78-CONTINUATION4-BASELINE-EVALUATOR-REVIEW-01",
  status: "candidate1_complete_pending_root_acceptance",
  files,
};
const snapshotPath = "operations/agent-improvement/snapshots/M78-CONTINUATION4-BASELINE-EVALUATOR-REVIEW-01-CANDIDATE1.json";
await Bun.write(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({
  result: { path: resultPath, sha256: sha(await readFile(resultPath)) },
  snapshot: { path: snapshotPath, sha256: sha(await readFile(snapshotPath)) },
}));

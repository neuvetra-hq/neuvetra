import { readFile } from "node:fs/promises";
import { verifyM78Continuation4BaselineAuthMethods } from "./m78-continuation4-lifecycle-qa-baseline-auth";

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");
const read = (path: string) => readFile(path, "utf8");
const check: (value: unknown, message: string) => asserts value = (value, message) => {
  if (!value) throw new Error(message);
};

const reviewedCandidate = {
  path: "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-REVIEW-PREP-01-CANDIDATE3.json",
  sha256: "51edfe895ed02eecdee165debe7fe0d242b0c07ff014b0e29c23bf4a9c3d18ae",
};
const rejectedCandidates = [
  {
    path: "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-REVIEW-PREP-01-CANDIDATE1.json",
    sha256: "9e9dbbdf84df0d05f445565c85658f486edc8b3d12f026ef3a6d066d270dabae",
    reason: "missing diagnostic, recipe, retained-state and restart-freshness bindings",
  },
  {
    path: "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-REVIEW-PREP-01-CANDIDATE2.json",
    sha256: "ce1f2fc4048a47a26f329b71e4f4c0b9f307851debdafcec56b7f2685f362970",
    reason: "restart freshness measured from exercise closure instead of revisit admission",
  },
];
const actualPins = [
  {
    path: ".superpowers/m78-hosted-continuation4.jsonl",
    sha256: "ef4d8ebaa36b447d4dfa7cf8e6636b263d587a4b29c899d875f3e5401eedf3d5",
  },
  {
    path: ".superpowers/m78-hosted-continuation4-diagnostics.jsonl",
    sha256: "b98846b6ce33c0d943a73437f13ba83390a4c63d3ab3547729b4926d7573bf40",
  },
  {
    path: ".superpowers/m78-continuation4-closed-baseline-admission.json",
    sha256: "97ae4bc8aa3fa7fa567eb7fef1faae698901f6dd91cd0704d2838d7724b1f95b",
  },
  {
    path: ".superpowers/m78-continuation4-closed-baseline-admission.py",
    sha256: "2f2e238e63c780503335582cf5bd25729efb66590c323cc04dd7b7114aaa3fdc",
  },
  {
    path: ".superpowers/m78-continuation4-baseline-gate.json",
    sha256: "34a1b7a8773120169264f5ce500490e87b8118f6ebfca2b8cabe2e6527a6b5e5",
  },
  {
    path: "evaluations/research-qa/m78-continuation4-baseline-independent-result.json",
    sha256: "57fc10f6ee4dce55ced4060aa1d41cbd5a125eac3bd58d99bbad7c37ef1daddf",
  },
];

for (const pin of [reviewedCandidate, ...rejectedCandidates, ...actualPins]) {
  check(sha(await readFile(pin.path)) === pin.sha256, `changed evidence: ${pin.path}`);
}

const candidate = JSON.parse(await read(reviewedCandidate.path));
check(candidate.candidate === 3 && candidate.files?.length === 3, "candidate3 shape");
for (const entry of candidate.files) {
  const live = await read(entry.path);
  check(sha(live) === entry.sha256, `candidate file hash: ${entry.path}`);
  check(live === entry.text, `candidate embedded text: ${entry.path}`);
}

const official = JSON.parse(await read(actualPins[5]!.path));
check(
  official.status === "m78_independent_continuation4_hosted_baseline_passed" &&
    official.gateSha256 === actualPins[4]!.sha256 &&
    official.prefixSha256 === actualPins[0]!.sha256 &&
    official.diagnosticSha256 === actualPins[1]!.sha256 &&
    official.requests === 285 &&
    official.applicationPostRequests === 0 &&
    official.allCreatedAuthSessionsClosed === true &&
    official.unknownAuthSessions === 0,
  "official baseline result",
);
const strictAuth = verifyM78Continuation4BaselineAuthMethods(await read(actualPins[1]!.path));

const baselineSupplementPath =
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-baseline-actual-result.json";
const baselineSupplement = JSON.parse(await read(baselineSupplementPath));
check(
  baselineSupplement.status === "m78_continuation4_actual_baseline_qa_admitted" &&
    baselineSupplement.admission.gateSha256 === actualPins[4]!.sha256 &&
    baselineSupplement.officialBaselineResult.sha256 === actualPins[5]!.sha256 &&
    baselineSupplement.strictAuthVerifier.result.tokens === 8 &&
    baselineSupplement.strictAuthVerifier.result.logouts === 8 &&
    baselineSupplement.strictAuthVerifier.result.allAuthMethodsPost === true,
  "baseline QA supplement",
);

const resultPath = "evaluations/research-qa/m78-continuation4-lifecycle-qa-result.json";
const result = {
  status: "m78_continuation4_lifecycle_evaluator_independent_review_passed",
  reviewerId: "/root/m78_transport_probe",
  reviewedAt: new Date().toISOString(),
  admission: "offline_evaluator_preparation_plus_exact_closed_baseline",
  reviewedCandidate,
  rejectedCandidates,
  candidateFiles: candidate.files.map(({ path, sha256 }: { path: string; sha256: string }) => ({ path, sha256 })),
  checks: {
    combinedTests: { tests: 14, assertions: 863, failures: 0 },
    strictTypeScript: "passed",
    candidateSnapshotJson: "passed",
    candidateEmbeddedText: "passed",
    actualBaselineStrictAuth: strictAuth,
  },
  lifecycleEvidence: {
    exactRecipeOperations: 37,
    exactReportIdentities: 5,
    exerciseOnlySessionClosures: 16,
    fullLifecycleSessionClosures: 24,
    applicationPostRequestsByPhase: [0, 37, 0],
    grossKgCo2eExact: "126850.17632025",
    continuousJournalAndDiagnosticHashChains: true,
    diagnosticOrdinalResetPerPhase: true,
    restartFreshnessMeasuredAtRevisit: true,
    independentDecodedRevisitObservationRequired: true,
  },
  escapedBaselineEvaluatorFinding: {
    reproduced: true,
    description: "accepted baseline evaluator admits a rehashed GET token fixture",
    actualBaselineAffected: false,
    exactBaselineStrictVerifierPassed: true,
  },
  actualBaseline: {
    accepted: true,
    supplement: {
      path: baselineSupplementPath,
      sha256: sha(await readFile(baselineSupplementPath)),
    },
    officialResultRerunByQa: false,
    requests: 285,
    requestErrors: 0,
    applicationPostRequests: 0,
    authSessionsClosed: 8,
    unknownAuthSessions: 0,
  },
  portableCi: {
    qaSelector: null,
    reason: "independent QA fixture reads preserved local .superpowers evidence",
    recommendedAuthorTest: "evaluations/research-qa/m78-continuation4-lifecycle-independent.test.ts",
  },
  actualExerciseAccepted: false,
  fullLifecycleAccepted: false,
  qaNetworkUsed: false,
  qaDatabaseUsed: false,
  qaCredentialsUsed: false,
  officialJournalsModified: false,
  authorFilesModified: false,
};
await Bun.write(resultPath, `${JSON.stringify(result, null, 2)}\n`);

const reviewedPaths = [
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-review.md",
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-review.test.ts",
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-baseline-auth.ts",
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-baseline-actual.md",
  baselineSupplementPath,
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-freeze.ts",
  resultPath,
];
const files = await Promise.all(
  reviewedPaths.map(async (path) => {
    const text = await read(path);
    return { path, sha256: sha(text), text };
  }),
);
const snapshot = {
  task_id: "M78-CONT4-LIFECYCLE-INDEPENDENT-REVIEW-01",
  status: "candidate1_complete_pending_root_acceptance",
  reviewedCandidate,
  actualBaselinePins: actualPins,
  files,
};
const snapshotPath =
  "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-INDEPENDENT-REVIEW-01-CANDIDATE1.json";
await Bun.write(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  JSON.stringify({
    result: { path: resultPath, sha256: sha(await readFile(resultPath)) },
    snapshot: { path: snapshotPath, sha256: sha(await readFile(snapshotPath)) },
  }),
);

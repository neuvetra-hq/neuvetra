import { readFile } from "node:fs/promises";
import { m78Continuation4SourcePins, M78_CONTINUATION4_EVIDENCE_PINS } from "../../tools/staging/m78-continuation4-source-pins";

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");
const read = (path: string) => readFile(path, "utf8");

const candidate = {
  path: "operations/agent-improvement/snapshots/M78-TRANSPORT-CONTINUATION-PREP-01-CANDIDATE3.json",
  sha256: "14dd03be623702e0c08308e789533f9679b3afa141d46dd915dfb18fa3f8dd2d",
};
const sourceReceipt = {
  path: "evaluations/research-qa/m78-continuation4-preparation-source-pins.json",
  sha256: "e1d0cd97046e21b308894d5f8757f8fc1fa580550e3ec700aa7ab0e1519bbb92",
};
const privateArtifacts = [
  { path: ".superpowers/m78-private-continuation4-journey.ps1", sha256: "3cef7393da74fb2b670a4c847409c2c87f9a30ad04c6b9cca92be30707026abe" },
  { path: ".superpowers/m78-continuation4-preflight.ts", sha256: "d27b1cc0fe15ba55494461485dc00c55b57b2a7a44f055983209f388e67aeae9" },
  { path: ".superpowers/m78-continuation4-refresh-runtime.py", sha256: "47f9cadd43320d333a37e5995be6dc72d9385c2b149a38c1529311f57bf5554f" },
] as const;
const workflow = {
  path: ".github/workflows/verify.yml",
  sha256: "6154249fe6905e2dd68fa8a3b6cf587d5f1e5f005f2ac52a1daeb1b56427dbb5",
};

for (const pin of [candidate, sourceReceipt, workflow, ...privateArtifacts]) {
  const bytes = await readFile(pin.path);
  if (sha(bytes) !== pin.sha256) throw new Error(`changed reviewed artifact: ${pin.path}`);
}
const sourcePins = await m78Continuation4SourcePins();
if (sourcePins.length !== 173) throw new Error("wrong source pin count");
if (JSON.stringify(sourcePins) !== JSON.stringify(JSON.parse(await read(sourceReceipt.path)))) {
  throw new Error("source receipt differs from collector");
}
for (const pin of sourcePins) {
  if (sha(await readFile(pin.path)) !== pin.sha256) throw new Error(`changed source: ${pin.path}`);
}
for (const pin of M78_CONTINUATION4_EVIDENCE_PINS) {
  if (sha(await readFile(pin.path)) !== pin.sha256) throw new Error(`changed evidence: ${pin.path}`);
}

const resultPath = "evaluations/research-qa/m78-continuation4-independent-result.json";
const result = {
  status: "m78_independent_continuation4_preparation_passed",
  reviewerId: "/root/m78_transport_probe",
  reviewedAt: "2026-09-22",
  admission: "source_preparation_only",
  candidateSnapshot: candidate,
  sourceReceipt,
  sourcePinCount: sourcePins.length,
  sourcePins,
  historicalEvidencePinCount: M78_CONTINUATION4_EVIDENCE_PINS.length,
  evidencePins: M78_CONTINUATION4_EVIDENCE_PINS,
  privateArtifacts,
  workflow,
  checks: {
    focused: { tests: 14, assertions: 450, failures: 0 },
    portableCi: { tests: 2, assertions: 14, failures: 0 },
    sourceClosureCi: { tests: 1, assertions: 179, failures: 0 },
    runtimeEvaluator: { cases: 28, matched: 28, positive: 4, refusals: 24, hostedCalls: 0, officialOutputs: 0 },
    strictTypeScript: "passed",
    powerShellParse: "passed",
    agentOpsValidation: "passed",
  },
  transport: {
    runtime: "bun-fetch",
    pooling: "disabled",
    keepalive: false,
    retries: 0,
    timeoutMs: 30000,
    requestIdentityPreserved: true,
    responseIdentityPreserved: true,
  },
  authClosure: {
    composedFakeLogins: 3,
    composedFakeLogouts: 3,
    applicationPostRequests: 0,
    unknownAuthSessions: 0,
    allCreatedAuthSessionsClosed: true,
    priorEvidenceBytesPreserved: true,
  },
  actualBaselineAccepted: false,
  hostedExecutionAccepted: false,
  providerCause: "not_established",
  networkUsed: false,
  databaseUsed: false,
  credentialsOpened: false,
  originalsModified: false,
};
await Bun.write(resultPath, `${JSON.stringify(result, null, 2)}\n`);

const reviewedPaths = [
  "evaluations/research-qa/m78-continuation4-independent-review.md",
  "evaluations/research-qa/m78-continuation4-independent-runtime.py",
  "evaluations/research-qa/m78-continuation4-independent-runtime-result.json",
  "evaluations/research-qa/m78-continuation4-independent.test.ts",
  "evaluations/research-qa/m78-continuation4-independent-private.test.ts",
  "evaluations/research-qa/m78-continuation4-independent-freeze.ts",
  resultPath,
];
const files = await Promise.all(reviewedPaths.map(async (path) => {
  const text = await read(path);
  return { path, sha256: sha(text), text };
}));
const snapshot = {
  task_id: "M78-CONTINUATION4-INDEPENDENT-REVIEW-01",
  status: "candidate1_complete_pending_root_acceptance",
  reviewedCandidate: candidate,
  files,
};
const snapshotPath = "operations/agent-improvement/snapshots/M78-CONTINUATION4-INDEPENDENT-REVIEW-01-CANDIDATE1.json";
await Bun.write(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({
  result: { path: resultPath, sha256: sha(await readFile(resultPath)) },
  snapshot: { path: snapshotPath, sha256: sha(await readFile(snapshotPath)) },
}));

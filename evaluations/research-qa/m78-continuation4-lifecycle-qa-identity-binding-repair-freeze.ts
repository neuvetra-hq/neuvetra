import { readFile } from "node:fs/promises";

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");
const read = (path: string) => readFile(path, "utf8");

const reviewedCandidate = {
  path: "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-REVIEW-PREP-01-CANDIDATE4.json",
  sha256: "440fa15695a713a41999619624e9f2c76879c74fed56758255a93d441f77f89a",
};
const historicalPins = [
  {
    path: "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-IDENTITY-BINDING-SUPPLEMENT-01-CANDIDATE1.json",
    sha256: "7fa04c8f1261e522f58c101a538e286604c656679ec41941b7e707c534aaa8ef",
  },
  {
    path: "evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-result.json",
    sha256: "12947a1b3365b4a339ed4133ee7b15577a14d4a5a12d960143c7d84d4f247a49",
  },
  {
    path: "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-INDEPENDENT-REVIEW-01-CANDIDATE1.json",
    sha256: "24ffda388ca5a14eca996896ad09ce45c1c65b0043eeb3fade611defb2d52943",
  },
];
for (const pin of [reviewedCandidate, ...historicalPins]) {
  if (sha(await readFile(pin.path)) !== pin.sha256) throw new Error(`changed evidence: ${pin.path}`);
}

const candidate = JSON.parse(await read(reviewedCandidate.path));
if (candidate.candidate !== 4 || candidate.files?.length !== 3) throw new Error("candidate4 shape");
for (const entry of candidate.files) {
  const live = await read(entry.path);
  if (sha(live) !== entry.sha256 || live !== entry.text) throw new Error(`candidate4 mismatch: ${entry.path}`);
}

const resultPath =
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-repair-result.json";
const result = JSON.parse(await read(resultPath));
if (
  result.status !== "m78_continuation4_lifecycle_evaluator_independent_review_passed" ||
  result.reviewerId !== "/root/m78_transport_probe" ||
  JSON.stringify(result.candidateFiles) !==
    JSON.stringify(candidate.files.map(({ path, sha256 }: { path: string; sha256: string }) => ({ path, sha256 })))
) throw new Error("repair result binding");

const reviewedPaths = [
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-repair.test.ts",
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-repair.md",
  resultPath,
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-repair-freeze.ts",
];
const files = await Promise.all(reviewedPaths.map(async (path) => {
  const text = await read(path);
  return { path, sha256: sha(text), text };
}));
const snapshot = {
  task_id: "M78-CONT4-LIFECYCLE-IDENTITY-BINDING-SUPPLEMENT-01",
  status: "candidate2_repair_passed_pending_root_acceptance",
  reviewedCandidate,
  historicalPins,
  files,
};
const snapshotPath =
  "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-IDENTITY-BINDING-SUPPLEMENT-01-CANDIDATE2.json";
await Bun.write(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({
  result: { path: resultPath, sha256: sha(await readFile(resultPath)) },
  snapshot: { path: snapshotPath, sha256: sha(await readFile(snapshotPath)) },
}));

import { readFile } from "node:fs/promises";

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");
const read = (path: string) => readFile(path, "utf8");

const sourcePins = [
  {
    path: ".superpowers/m78-continuation4-finalize-exercise-gate.py",
    sha256: "cd496234137851eea7e32c6dbef62d23f4e3281181e7b739f5d17badbc491b09",
  },
  {
    path: ".superpowers/m78-continuation4-evaluate-exercise.ts",
    sha256: "59ddb7aa6a076eeb58158e08c5b439bc4b73c1c66cd439510f6c12eab9c3f3cc",
  },
  {
    path: "evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-repair-result.json",
    sha256: "206130bed4adcad7fc6608d9d98fbb3f4c94d92a960abdfb8a995d816e50a7f3",
  },
];
for (const pin of sourcePins) {
  if (sha(await readFile(pin.path)) !== pin.sha256) throw new Error(`changed source: ${pin.path}`);
}

const reviewedPaths = [
  "evaluations/research-qa/m78-continuation4-exercise-helper-review.json",
  "evaluations/research-qa/m78-continuation4-exercise-helper-review.md",
  "evaluations/research-qa/m78-continuation4-exercise-helper-review-freeze.ts",
];
const files = await Promise.all(reviewedPaths.map(async (path) => {
  const text = await read(path);
  return { path, sha256: sha(text), text };
}));
const snapshot = {
  task_id: "M78-CONT4-EXERCISE-HELPER-REVIEW-01",
  status: "candidate1_complete_pending_root_acceptance",
  sourcePins,
  files,
};
const snapshotPath =
  "operations/agent-improvement/snapshots/M78-CONT4-EXERCISE-HELPER-REVIEW-01-CANDIDATE1.json";
await Bun.write(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({
  review: { path: reviewedPaths[0], sha256: sha(await readFile(reviewedPaths[0]!)) },
  snapshot: { path: snapshotPath, sha256: sha(await readFile(snapshotPath)) },
}));

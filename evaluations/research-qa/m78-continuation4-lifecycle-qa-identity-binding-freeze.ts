import { readFile } from "node:fs/promises";

const sha = (value: string | Uint8Array) =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");
const read = (path: string) => readFile(path, "utf8");

const sourcePins = [
  {
    path: "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-REVIEW-PREP-01-CANDIDATE3.json",
    sha256: "51edfe895ed02eecdee165debe7fe0d242b0c07ff014b0e29c23bf4a9c3d18ae",
  },
  {
    path: "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-INDEPENDENT-REVIEW-01-CANDIDATE1.json",
    sha256: "24ffda388ca5a14eca996896ad09ce45c1c65b0043eeb3fade611defb2d52943",
  },
  {
    path: "evaluations/research-qa/m78-continuation4-lifecycle-independent-review.ts",
    sha256: "a90c14b4793c77ca5544d0cac7149da5fb36eb0c1d09779164b4c1bf6bbc128f",
  },
];
for (const pin of sourcePins) {
  if (sha(await readFile(pin.path)) !== pin.sha256) throw new Error(`changed source: ${pin.path}`);
}

const reviewedPaths = [
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-supplement.test.ts",
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-supplement.md",
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-result.json",
  "evaluations/research-qa/m78-continuation4-lifecycle-qa-identity-binding-freeze.ts",
];
const files = await Promise.all(
  reviewedPaths.map(async (path) => {
    const text = await read(path);
    return { path, sha256: sha(text), text };
  }),
);
const snapshot = {
  task_id: "M78-CONT4-LIFECYCLE-IDENTITY-BINDING-SUPPLEMENT-01",
  status: "finding_confirmed_rework_required",
  sourcePins,
  files,
};
const snapshotPath =
  "operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-IDENTITY-BINDING-SUPPLEMENT-01-CANDIDATE1.json";
await Bun.write(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({
  snapshot: { path: snapshotPath, sha256: sha(await readFile(snapshotPath)) },
  result: {
    path: reviewedPaths[2],
    sha256: sha(await readFile(reviewedPaths[2]!)),
  },
}));

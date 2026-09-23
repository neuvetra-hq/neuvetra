import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const files = [
  'evaluations/research-qa/m78-get-local-comparison-independent-review.ts',
  'evaluations/research-qa/m78-get-local-comparison-independent.test.ts',
  'evaluations/research-qa/m78-get-local-comparison-independent-actual.test.ts',
  'evaluations/research-qa/m78-get-local-comparison-independent-review.md',
  'evaluations/research-qa/m78-get-local-comparison-independent-result.json',
  'evaluations/research-qa/m78-get-local-comparison-result.json',
  'evaluations/research-qa/m78-get-local-comparison-source.json',
  'evaluations/research-qa/m78-get-local-comparison-independent-freeze.ts',
];
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const snapshot = {
  task_id: 'M78-GET-LOCAL-COMPARISON-REVIEW-01',
  status: 'actual_local_comparison_independently_passed',
  candidate: 1,
  reviewed_result: {
    path: 'evaluations/research-qa/m78-get-local-comparison-result.json',
    sha256: 'caae59a5d5704c53b6d61f901d30dee55be01b7f890c62e7d6e5c1b1b7931417',
  },
  files: files.map((path) => {
    const bytes = readFileSync(path);
    return { path, sha256: hash(bytes), text: bytes.toString('utf8') };
  }),
};
writeFileSync(
  'operations/agent-improvement/snapshots/M78-GET-LOCAL-COMPARISON-REVIEW-01-CANDIDATE1.json',
  JSON.stringify(snapshot, null, 2) + '\n',
  { flag: 'wx' },
);

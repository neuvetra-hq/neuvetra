# Independent CI repair review — 2026-09-26

Verdict: **PASS for the bounded local CI repair**, against the seven exact source hashes in `hosted-setup-01-ci-repair-result.json`. Before/after hashes matched. Reviewer `/root/hosted_qa` authored no product changes. This does not establish remote CI success, image build success, hosted deployment or customer readiness.

## Findings and preservation

Two intermediate defects were returned to the author and corrected: the current M78 guard test incorrectly expected the frozen historical source pin to accept changed `hosted.ts`; the image smoke manifest expected23 while its readiness stub still reported22. See `hosted-setup-01-ci-repair-first-findings.json` for the first observations and limitations.

The final guard test preserves the exact candidate4 probe and snapshot bytes, verifies their original hashes, requires the historical probe to reject the changed source, and separately checks the current callers against the unchanged finite set of20 allowed SQL templates. The third hosted read reuses an existing lock template; no new allowed SQL template or frozen source pin is introduced. Historical result/baseline tests and adversarial template refusals passed. This is current compatibility evidence, not permission to run the historical performance probe on changed sources.

Migration21/22 names and SHA pins remain unchanged. Migration23 is admitted only at position23 with its exact name and independently recomputed normalized source SHA `d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb`. Independent negatives changed every admitted suffix name/hash, reordered22/23 and added24; all refused. Historical manifest *shapes*21/22 remain accepted by the validator. The clone loader still requires all source receipts to match the current checkout manifest before cloning and never upgrades an older clone automatically. Existing exact loopback target restrictions remain in place.

All three revised hosted-test expectations were reproduced on a new synthetic native PostgreSQL fixture: restricted runtime readiness23, idempotent migration receipt count23 with unchanged legacy rows, and reopened runtime readiness23. Full historical `hosted.test.ts` lifecycle was not rerun by this reviewer.

The workflow now expects23 including exact0023 filename and its readiness mock reports23. The exact workflow initialization block was executed against the current staging server locally, stubbing only asset verification: health/ready/config returned200, unauthenticated session401, all with no-store. This is not a Docker image, built asset or Python calculation smoke run; those remain gates for the next remote CI run.

Run-record changes use schema-valid artifact/hash objects and enum values while preserving local scope, unknown measured model/cost and the pending hosted gate. No professional, hosted or beta readiness inference is made.

## Executed checks

- `bun test evaluations/research-qa/hosted-setup-01-ci-repair.test.ts evaluations/research-qa/m78-get-guard-independent.test.ts evaluations/research-qa/m80-ci-schema-regression.test.ts evaluations/research-qa/hosted-setup-01-ui-native-client.test.ts`: **7 passed, 0 failed, 207 assertions**, Bun1.3.12. Includes actual web client through mounted server to restricted native PostgreSQL.
- `python -B tools/agent_ops.py validate`: **valid**,11 roles,288 runs.
- `git diff --check`: passed; Git reported an informational CRLF-to-LF normalization warning for the DATA run record.

Durable additions: this review, `hosted-setup-01-ci-repair.test.ts`, `hosted-setup-01-ci-repair-result.json`, and `hosted-setup-01-ci-repair-first-findings.json`. Existing `hosted-setup-01-ui-native-client-result.json` was refreshed by the actual integration rerun. No product files, Git state, live deployment or customer data were modified by the reviewer. The authorized synthetic loopback cluster remains available as requested.

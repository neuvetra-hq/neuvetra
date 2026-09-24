# M78 recovery2 restart preparation

## Verdict

The recovery2-aware restart helpers are prepared as source only. They have not requested a restart, called the provider, opened credentials, contacted the hosted application, or written any restart evidence. The accepted actual recovery2 receipt is pinned at SHA-256 `eaa2f3e35e3e7b939a15aa9122fdddfea19625eefc484d305ecce656d4491bd1`. The fixed runtime is commit `9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e`, deployment `f6d77b2e-6886-429b-a4d2-4873c9199ce8`, image `sha256:3e4c2c91591a5598a85f63b4099b1b4890588ce79ec832b21b7d284b5aa89d1b`, schema 21, and `autodeploy:false`.

## Contract

The validator checks the independent actual result, its exact ten evidence entries, the corrected evaluator at `c45f948482a53b9e2f2ba87c1b754bb70a6f2ced079dbf8b4d85657d7b77fa78`, the preserved historical evaluator at `4324a96546228070f4d16b0ed6a25cbe02d56d6412d48829d1b60e176db708c1`, the recovery2 runner, both durable predecessor locks, and the complete 182-entry source closure. It rejects duplicate, malformed, missing, or changed source pins and reruns the corrected full evaluator read only. The frozen actual result passed this validator offline.

Admission is the only step that may inspect current provider state, and only under its explicit `--execute` entry. It requires one active successful fixed deployment, disabled automatic deployment, and exact schema-21 readiness. The admission freezes all four helper hashes so reviewed helper bytes cannot drift between admission, request, and collection.

The request helper requires a fresh admission and provider observation. It durably writes one exclusive intent before making one `deploymentRestart` call for `scope1_persistence_verification`. A failed, uncertain, or unexpected outcome retains the intent, writes no acknowledgment, and cannot be retried by the helper. A successful exact acknowledgment is written once.

The collector revalidates the recovery and all helper hashes, checks the fixed provider state again, and reads only deployment startup logs and readiness. It requires exactly one unique `staging_started` event after the request. `collectionUntil` bounds the log query; `observedAt` is recorded only after readiness completes and must not precede collection. It writes sanitized provider evidence and one exclusive startup receipt.

## Focused validation and limits

Two TypeScript tests passed with 10 assertions, six Python boundary tests passed, targeted strict TypeScript and Python syntax checks passed, and the validator passed against the exact frozen actual recovery2 receipt. Tests cover indirect source drift, evidence and lock changes, helper drift before request or collection, stale admission, wrong provider state, uncertain restart without retry, and ambiguous startup.

Root review found the first draft did not rehash all 182 transitive source pins, did not freeze all four helper bytes through the action chain, and recorded the final observation timestamp too early. The current candidate repairs all three findings. No actual restart or provider action is authorized by this preparation result; root still owns independent source review, final admission, and any explicit execution.

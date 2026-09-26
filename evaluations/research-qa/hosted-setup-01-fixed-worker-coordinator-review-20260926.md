# HOSTED-SETUP-FIXED-WORKER-COORDINATOR-QA-01

2026-09-26. Coordinator-led separate review turn by `/root`, who did not author the four worker/supervisor files. Specialist QA capacity was occupied; this is explicitly a bounded process-mechanics review, not independent acceptance of an integrated hosted upgrade. The author's exact hashes were rechecked after this review and matched.

## Verdict

**Bounded PASS for the fixed one-shot process boundary.** The supervisor reserves an exclusive external attempt journal before launching a fixed private worker, verifies the reviewed-at-rest artifact, controls Bun flags/environment/stdin and limits output. The worker claims one invocation, obtains the genuine artifact SQL lock, opens the dedicated adapter lazily at the one permitted transaction call, owns close, and returns only a restricted status/hash. Its current repository has no `hosted-setup-artifact-bindings.ts`; the authentic path therefore refuses before database construction. This PASS does not authorize a live launch.

The separately reviewed runner and dedicated adapter fit the static worker types. The reconciliation runner calls the original-transaction-resolution observer before its one read-only transaction. The worker's counter and the supervisor's fresh process enforce a single adapter/transaction at their own construction site. A trusted binding module could still create its own connection or side effects; that future module requires its own review and cannot inherit this verdict.

## Challenges and evidence

- Independently reran both delivered suites on installed Bun 1.3.12: **7 passed, 48 assertions**, including real fresh child execution, controlled ambient `.env`/preload inputs, one adapter/transaction, refusal before adapter on missing binding/preflight failure, second-transaction refusal, separate reconciliation PID, bounded kill with unrelated child left alive, tampered artifact refusal, abrupt exit and unexpected stderr.
- Independently ran strict TypeScript on all four files against current actual runner/client interfaces: **PASS**.
- Inspected the fixed import graph and child/parent lifecycle. Source, dependency, runtime and supervisor bytes are checked by the existing verifier before spawn, and the worker checks its own source-root entrypoint and pg resolution. Failure, timeout or malformed output remains `refused_or_uncertain` with `noAutomaticRetry:true`; no child exit is treated as proof of rollback.
- Source/test hashes after tests: worker `1b13adb2e63fdfcc2adf298ce7653b93d7fff94ce75ab665bc0d8c6f388ea765`; supervisor `258faea55ed095d79d3f6680830763945d9f5fb88abf3123d456fb5f3837d009`; worker test `0804a4b249ac11147555114123a02f79a34cb26457a51da3ba1a21814e76f890`; supervisor test `6a458f5df1686ada80a02009a2b2edb5742d094bf231b6e217af284fb7a45c5f`.

## Limits and next gate

The process tests substitute synthetic runner, adapter and binding modules inside a pinned archive. No authentic publication producer, current restore/fingerprint, deployment stop/review, exact TLS/primary binding or original-server-transaction-resolution module exists in this delivered component. There was no native PostgreSQL run through this new worker, provider action or live migration. The outer timeout begins after artifact verification; slow preflight cannot enter the database but is not bound by that worker timer. Trusted-host and parent-directory durability limits remain. Keep the launcher inert until a clean-head artifact and fixed binding module receive integrated independent native review.

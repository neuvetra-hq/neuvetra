# M78-CONT-CI-PORTABILITY-01

2026-09-22. Author: `/root/resume_recovery`; root independently reviews and publishes.

Remote commit `d139628` failed role-record validation. Its historical record remains in Git. The tracked-only verifier reproduces the private inspection locator failure, then separately reproduces the Windows backslash locator failure after correcting only the first locator in memory.

Only two evidence locators in `M78-CONTINUATION-NATIVE-01.json` changed:

- AC-01 now resolves the already tracked `M78-CONTINUATION-NATIVE-01-INSPECT.json` snapshot. Its embedded inspection receipt hashes exactly to `c3fc47aef0a671a5dd4eb462f90af3ec892c51274d36973018e53f66717077b9` and records the original successful read-only inspection of `m78_ops_continuation_20260922`.
- AC-02 now uses forward slashes for `evaluations/research-qa/m78-continuation-native-result.json`. Its unchanged bytes hash to `beeeb7873bb71a58916a95912c8c3a21d85a24e95ad5f31226726f950116cb30`.

Validation invokes the repository's actual `validate_run` with an additional exact-case, Git-tracked-only, POSIX locator gate. All six unique evidence/artifact locators resolve; historical snapshot hash remains exact. A semantic comparison against the failed commit proves that outcome, review, artifact hashes and every other field remain unchanged. This is an equivalent checkout-availability check, not a claim that Linux ran locally. Root retains the remote failure and will run CI on publication.

I authored the continuation and executed its previously authorized local run. This is an author repair, not independent acceptance. No native or hosted request, database operation, private artifact mutation, product source edit or rerun occurred. Historical outcome and snapshots remain unchanged.

Reproduce: `python evaluations/research-qa/m78-continuation-ci-portability.py`.

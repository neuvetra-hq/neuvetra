# M78 continuation 4 identity-binding QA supplement

## Finding

Confirmed material evaluator gap in frozen candidate 3. The evaluator validates the exact operation-name sequence and validates that all 37 verified identities are distinct members of the decoded current graph, but it does not join each operation to the identity produced by that operation.

The supplemental fixture exchanges the complete `verifiedIdentity` objects between these two valid same-kind operations:

- `m78_rebind_natural_gas_625a3fd6-4218-426c-97fa-69c1fee862b4`
- `m78_rebind_natural_gas_76e4e7e0-f4c9-40bd-b133-21e534401cae`

Their operation names, intent routes, outcomes, response hashes, final decoded state and diagnostics remain unchanged. Both identities remain distinct, both remain present in the final graph and the main journal is fully rehashed and rebound. The complete frozen evaluator still returns `m78_independent_continuation4_exercise_passed`.

## Impact

An evidence journal can attribute one valid version to the wrong recipe operation while preserving the expected aggregate state and identity set. This breaks operation-to-result provenance needed to show that each named source/review action produced its claimed record. It does not demonstrate incorrect final totals or an actual hosted-data mutation.

## Required repair

Bind every recipe operation's exact name, intent route, expected family and parent identifier to its verified identity and to the correct typed record in the decoded current state. A rebind identity must resolve to the version for the source or roster named by that operation. Its paired review identity must reference that rebind version through the expected `versionId` and `versionSha256` and resolve to the corresponding typed current review. Report/version operations need the equivalent typed parent and record binding.

Candidate 3 and the original QA receipt remain immutable historical evidence. Exercise admission is held pending a candidate 4 that rejects this exact swapped-identity fixture. No network, authentication, database, credentials, hosted calls, official journals or author files were used or changed.

## Validation

The reproduction passes one test with six assertions on Bun 1.3.12, meaning the mutation is successfully admitted by candidate 3. Strict targeted TypeScript passes. This local fixture reads preserved `.superpowers` evidence and has no portable CI selector.

# HOSTED-SETUP-ACCEPTED-RESTORE-QA-02 — targeted independent review

2026-09-26. **PASS for the repaired fixed historical restore/fingerprint evidence verifier only.** `ACCEPTED-RESTORE-QA-F01 [P2]` is resolved in the reviewed Candidate 2 bytes. The first FAIL remains preserved in `hosted-setup-01-accepted-restore-independent-review.md`; this pass does not rewrite that result or expand the historical scope.

Reviewer: `/root/hosted_upgrade`, independently assigned Head of QA for the root-authored repair. This execution context did not author the verifier, author tests, historical restore/fingerprint observations or their reviews. Requested compute was gpt-6-astra/high; observed model, effort, token use and cost were not exposed. QA changed only this report. No hosted or local database, provider, archive, ENV export, product code, operations record or Git state was read or changed.

## F01 recheck

`exact` now reads the caller's `bytes` and `sha256` properties once into private primitive locals, validates the retained string and returns it. The receipt and derivation parsers consume those exact returned strings. Review artifacts are also hashed from one retained read. No subsequent access to a caller-owned artifact property remains in the verifier.

The original accepted-first/forged-later adversarial pattern was rerun with a forged receipt whose project was changed. The verifier read `bytes` once, retained the accepted bytes and returned the schema-22 binding. This is the correct result: the later getter value was never observed or parsed. The reverse getter returned forged bytes first and accepted bytes later; it was refused after one read. Equivalent claimed-SHA getters were read once: accepted-first passed, wrong-SHA-first was refused.

A separate all-artifact challenge installed getters for both `bytes` and `sha256` on the restore observation, restore review, fingerprint derivation and fingerprint review. Every getter threw if accessed twice. Verification passed and the observed counts were exactly one byte read and one SHA read for each of all four artifacts.

The author regression additionally covers both parsed artifacts, both review artifacts and the reverse forged-first path. No gap from F01 was reproduced.

## Historical evidence boundary

The four fixed evidence hashes, strict UTF-8 byte semantics and previously reviewed cross-field relationships remain unchanged:

| Artifact | SHA-256 |
|---|---|
| Corrected actual-restore observation v2 | `166c578f9909234ed7c127c7c9a957dcb2a726b46cea4ff1bfefd09e7f633f1a` |
| Independent actual-restore review | `11d1a2dd91d71bb8fa2761a0580055f1cb181216f8b743b1a99f5fdf9124379f` |
| Actual fingerprint derivation | `e75c9a68fe2a57614a4562f84534ff442ee807fc5aa93d0b2c7b5bfde0a58495` |
| Independent actual-fingerprint review 2 | `1539d64122f457f65fe5a2774dbe3c76511611505ba93f6f13f4fb29e7e49164` |

The restore observation and fingerprint derivation agree on project, source receipt/archive, source/restored state and restore result. The derivation binds the accepted source snapshot, 27-row external-default-ACL digest and schema-22 database fingerprint. Both explicitly deny upgrade authority; the derivation records `sourceCurrentnessObserved:false` and requires a live hosted preflight.

The fixed `operatorId:'root'` and restore-review identity `/root/hosted_recovery_qa` remain distinct and supported by the restore evidence. The fingerprint result's second independent review was a separate ephemeral read-only QA execution, so the singular restore-review identity must not be described as authorship of every pinned review. The exact fingerprint-review hash preserves that separate review.

## Checks and exact Candidate 2 bytes

| Check | Result |
|---|---|
| `bun test tools/staging/hosted-setup-accepted-restore.test.ts --timeout 30000` | 3 passed, 0 failed, 21 assertions |
| Focused TypeScript compile of verifier and test | passed, no diagnostics |
| Original accepted-first/forged-later getter | one read; retained accepted bytes parsed |
| Reverse forged-first/accepted-later getter | refused after one read |
| Accepted-first and wrong-first claimed-SHA getters | one read each; accepted and refused respectively |
| Throw-on-second-read getters on all four artifacts | passed; one byte and one SHA read per artifact |

One initial ad hoc QA command did not execute because the test script accidentally declared two duplicate variable names. It produced only a Bun parse error and no behavioral result. The corrected command then produced the results recorded above.

| File | SHA-256 |
|---|---|
| `tools/staging/hosted-setup-accepted-restore.ts` | `a5f4e5feb5aa5d651d222413f075142ca200171272cacb60b732470625342395` |
| `tools/staging/hosted-setup-accepted-restore.test.ts` | `de1971900825d1f18eccb15779c0f05d06c0aa8daf303f4f6c102404517719ac` |
| Preserved first independent FAIL | `dade4326ce31775358ace06f9bfd0d129bf706ad10efc4c3d8ecb81bde44fb21` |

## Limits and disposition

This pass establishes only that the reviewed function binds those four frozen text artifacts to the accepted historical schema-22 fingerprint without the F01 split-read. It does not reobserve the encrypted archive, retained clone, current hosted database, application write gate, provider Auth/storage, publication head or executable migration source. The restore represents one company, not the two-company hosted demonstration. The separate source-lock QA failure and all live sequencing gates remain outside this verdict. This review grants no migration, deployment or current-hosted-state authority.

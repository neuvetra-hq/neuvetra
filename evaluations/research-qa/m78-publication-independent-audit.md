# M78 publication evidence audit and repair acceptance

Task `M78-PUBLICATION-INDEPENDENT-AUDIT-01`; reviewer `/root/m78_cont3_review`; repair author `/root`. Requested registry critical QA route remains GPT-6 Astra/high. This assignment reused the existing reviewer context; no fresh compute dispatch occurred and actual inherited model/effort is unknown. The reviewer did not author the representation supplement or modify any original artifact.

## Final verdict

**PASS for the bounded publication evidence repair**, after one material finding and one repair cycle. Independently accepted supplement:

`operations/agent-improvement/snapshots/M78-PUBLICATION-BYTE-REPRESENTATION-SUPPLEMENT-01.json`

SHA-256 `b4c541e82996dd76694d22de64966061407dd174e82bab4369028212b8063cf7`.

This verdict does not accept publication completion, remote CI, runtime, cleanup execution, hosted baseline, restart, browser demonstration or customer release. Root retains those separate gates.

## Preserved first finding: PUB-BYTES-01

Initial read-only audit of 59 untracked continuation3/interrupted-session review artifacts, runs and snapshots found ten embedded texts whose LF-normalized bytes did not reproduce their stated hashes. The corresponding original files still matched those hashes using CRLF bytes. The historical snapshot files themselves matched their run-record artifact pins. This was a material reproducibility defect, not source/execution drift. The failure was reported before any repair; it remains a first-review failure.

Affected snapshot entries, all source paths under `.superpowers/`:

| Snapshot filename | Original source filenames |
| --- | --- |
| M78-INTERRUPTED-SESSION-CLEANUP-SOURCE-01-CANDIDATE2.json | m78-private-interrupted-session-cleanup.ps1; m78-interrupted-session-cleanup-v2.ts; m78-private-interrupted-session-cleanup-v2.ps1 |
| M78-INTERRUPTED-SESSION-CLEANUP-V3-REVIEW-01-CANDIDATE1.json | m78-interrupted-session-cleanup-v3.ts; m78-private-interrupted-session-cleanup-v3.ps1 |
| M78-INTERRUPTED-SESSION-OBSERVER-01-CANDIDATE1.json | m78-private-interrupted-session-observe.ps1 |
| M78-INTERRUPTED-SESSION-POSTOBSERVER-01-CANDIDATE1.json | m78-interrupted-session-postobserve.ts; m78-private-interrupted-session-postobserve.ps1 |
| M78-PLATFORM-INTERRUPTION-REVIEW-01-CANDIDATE1.json | m78-platform-resume-observation.json |
| M78-SESSION-CLEANUP-DIAGNOSTIC-REVIEW-01-CANDIDATE1.json | m78-private-session-cleanup-diagnose.ps1 |

## Independent repair verification

Executed `python evaluations/research-qa/m78-publication-independent-byte-review.py`. This verifier reads local files and prints metadata only; it does not execute embedded source or write results.

All checks passed: exact supplied supplement SHA; exactly the ten independently identified unique pairs; each original snapshot still matches its recorded SHA and existing run artifact pin; each supplemental text encodes to bytes exactly equal to the live original and its unchanged SHA; each historical embedded text equals only CRLF-to-LF normalization of that same original. All six historical snapshots and ten source pins are preserved. No other representation or source change is admitted. The supplement adds an exact-byte representation alongside the original failure; it does not rewrite history.

## Portable evidence and privacy audit

The sole private run criterion locator found initially was the known actual-disposition criterion. Root corrected it to the existing public `M78-INTERRUPTED-SESSION-ACTUAL-DISPOSITION-01-CANDIDATE1.json` snapshot. Independently verified the corrected reference, absence of the old private criterion locator, and unchanged snapshot SHA `7f12eb25e1cd33767e1228e788e2b502b271d1adfe85aa5b033d790e40a89157`. No additional missing/private criterion, review, compute or metric evidence locator was found in the initial audited runs. Artifact and reviewed-artifact pins resolved correctly. Private paths inside source-admission metadata are provenance references, not a requirement to publish the private files or execute their tests in CI.

Inspected public review JSON and embedded private source, plus targeted credential-pattern scans. No credential values, JWTs, private keys or customer data were identified. Password/token literals found are labeled synthetic fixtures; PostgreSQL URL matches are passwordless loopback test URLs. Provider session ID fields in the interruption result are null. The material contains synthetic roster UUIDs, timestamps, repository/runtime identity, local operator paths and credential-file path references; these are operational metadata, not the contents of credentials or environment exports. This is a bounded inspection, not a general data-loss-prevention guarantee. Unrelated untracked dumps and temporary directories were outside the intended publication set and must remain excluded.

The supplement preserves precisely the same source content already inspected, restoring carriage returns only, so it introduces no additional semantic private content. Existing CI guidance remains unchanged: public author tests and the reviewed portable independent subset only. The new byte verifier requires local private originals and must not be added to public CI unchanged.

## Next owner and limits

Root may accept these reviewer artifacts and include the immutable supplement and audit in the bounded publication set. Preserve all historical snapshots; verify exact staged and committed bytes, complete local evidence checks, and observe required remote checks before declaring publication complete. No source, original snapshot, shared ledger, host, network, credential or database action was performed by this reviewer. Applicable lesson L02: distinguish raw bytes from normalized text and verify published blob hashes. Final open findings for this bounded audit: zero.

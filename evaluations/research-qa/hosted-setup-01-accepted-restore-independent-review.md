# HOSTED-SETUP-ACCEPTED-RESTORE-QA-01 — independent review

2026-09-26. **FAIL for the exact-artifact verifier. ACCEPTED-RESTORE-QA-F01 [P2] must be repaired before this function is used by the upgrade runner.** The four hardcoded hashes and their historical cross-field relationships are correct, but the function can hash one `bytes` value and parse another from the same caller-supplied artifact object. This verdict does not reopen the separately accepted historical restore or fingerprint reviews.

Reviewer: `/root/hosted_upgrade`, independently assigned Head of QA for this root-authored verifier. This execution context did not author `hosted-setup-accepted-restore.ts`, its test, the historical restore/fingerprint observations or their independent reviews. Requested compute was gpt-6-astra/high; observed model, effort, token use and cost were not exposed. QA changed only this report. No hosted or local database, provider, archive, ENV export, product code, operations record or Git state was read or changed.

## ACCEPTED-RESTORE-QA-F01 [P2]: split property reads break exact-byte identity

Location: `tools/staging/hosted-setup-accepted-restore.ts:24-28`, called at lines 35-39.

`exact` reads `artifact.bytes` once for the type check and again for SHA-256. `parse` then reads it a third time. JavaScript permits a structurally valid `PinnedArtifact` to expose `bytes` through a getter, so those reads are not guaranteed to return the same string.

A safe local reproducer supplied the exact accepted corrected restore observation on the hash read, then supplied a different valid JSON observation on the parse read. The parsed observation changed `status` to `forged-unreviewed-observation` and set `clusterStopped:false` and `clusterDataRetained:false`, while retaining the fields that the verifier explicitly checks. Observed result:

```json
{"statefulGetterAccepted":true,"bytesGetterReads":3,"forgedClusterStopped":false,"bindingExactApplicationPreserved":true}
```

The function returned an accepted binding. The same issue applies to the derivation artifact because it follows the same `exact` then `parse` sequence. Ordinary `Uint8Array`, `Buffer`, null, array and object values were refused, and permuting the restore observation with the fingerprint derivation was refused; those checks do not close the stateful-property path.

Required repair: read each `bytes` and `sha256` property exactly once into local primitive values at entry, validate and hash the retained string, and parse that same retained string. A small helper should return the validated private string so parsing cannot reread the caller object. Add regressions with stateful getters for both parsed artifacts and confirm review artifacts are also hashed from a single retained read.

## Historical pins and cross-field review

The exact evidence files match every hardcoded SHA-256:

| Artifact | SHA-256 |
|---|---|
| Corrected actual-restore observation v2 | `166c578f9909234ed7c127c7c9a957dcb2a726b46cea4ff1bfefd09e7f633f1a` |
| Independent actual-restore review | `11d1a2dd91d71bb8fa2761a0580055f1cb181216f8b743b1a99f5fdf9124379f` |
| Actual fingerprint derivation | `e75c9a68fe2a57614a4562f84534ff442ee807fc5aa93d0b2c7b5bfde0a58495` |
| Independent actual-fingerprint review 2 | `1539d64122f457f65fe5a2774dbe3c76511611505ba93f6f13f4fb29e7e49164` |

All four files decode and re-encode byte-for-byte under strict UTF-8. Their raw sizes are 2,087; 11,459; 1,371; and 1,635 bytes respectively. Hashing the decoded JavaScript strings therefore preserves the exact current file bytes for these artifacts. Invalid UTF-8 or a BOM/newline change would produce different bytes and fail the fixed pins; this verifier is appropriately limited to these four text artifacts and is not a binary-archive verifier.

The corrected restore observation and derivation agree on project, source receipt, source archive, source state, restored state and restore result. The derivation additionally binds the accepted source snapshot, 27-row external-default-ACL digest and expected schema-22 database fingerprint. Both preserve the application/catalog/tenant claims and explicitly deny migration authority; the derivation also says current hosted state was not observed and a live preflight is required. The differing source/restored state hashes are the reviewed 27-external-default-ACL normalization, not falsely asserted raw equality.

The returned `operatorId:'root'` agrees with the root-authored execution observations. The returned `independentReviewerId:'/root/hosted_recovery_qa'` agrees with the accepted actual-restore reviewer and remains distinct from the operator. The fingerprint result's second independent review was performed by a separate ephemeral read-only QA session recorded in its provenance, so the singular returned reviewer ID must be understood as the restore-review identity; it is not evidence that `/root/hosted_recovery_qa` authored every pinned review. The exact fingerprint-review hash separately preserves that review. Any future operator input or report must retain this distinction.

## Checks and reviewed bytes

| Check | Result |
|---|---|
| `bun test tools/staging/hosted-setup-accepted-restore.test.ts --timeout 30000` | 2 passed, 0 failed, 11 assertions |
| Focused TypeScript compile of verifier and test | passed, no diagnostics |
| Strict UTF-8 raw-byte round trip for all four artifacts | all exact |
| Wrong ordinary artifact types and permuted artifact roles | refused |
| Stateful `bytes` getter serving accepted bytes for hashing and forged bytes for parsing | incorrectly accepted |

Exact implementation bytes reviewed:

| File | SHA-256 |
|---|---|
| `tools/staging/hosted-setup-accepted-restore.ts` | `b9b1a2dc6fa02f2d3c79232d1f9ce71248368c2e5ea6d3b1f653af48a5a62b31` |
| `tools/staging/hosted-setup-accepted-restore.test.ts` | `e1ae5771c836fd57c11bb8097fdd5330298e162e46c4ea5ef3bb297335a3ad29` |

## Limits and disposition

This review accepts the consistency of the four frozen historical files but fails the current exact-artifact API implementation. Even after F01 is repaired, the binding is historical only. It does not reobserve the encrypted archive, retained clone, current hosted schema, source currentness, application write gate, provider Auth/storage, publication head or executable migration source. The actual restore covered one company, not the required two-company hosted demonstration. The prior source-lock QA failure is separate and remains unresolved by this artifact. No migration or deployment authority follows from this review.

# Fresh restore evidence binder — author handoff

2026-09-26. Task HOSTED-SETUP-FRESH-RESTORE-BINDER-01. Author /root/compose_qa, assigned software-engineering for this new task. This context authored this binder and its tests and **cannot independently review them**. Root owns subsequent independent QA and integration. Requested registered critical route gpt-5.6-sol/high; follow-up reuse cannot apply a model override and observed model/effort are unknown. Prior QA work by this context concerned different components.

Status: implemented and locally tested; independent acceptance pending. No actual new backup, restore, review issuance, live preflight or migration was performed. Only two new code files, this report and the separate author run record were written. No existing source, shared ledger, provider, database or Git state was changed.

## Frozen candidate

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-fresh-restore-binding.ts | 4a7c434537916be019f1f1af80d258d170f92ba7d7d5ef171ca67ae364eb189e |
| tools/staging/hosted-setup-fresh-restore-binding.test.ts | 79f894173b5fe1d179aa318e05896bcca97eb6c34b195d4cd54c8fb047ce7a91 |

## Behavior and integration contract

`verifyFreshHostedSetupRestore(evidence, externallyTrustedPolicy, nowUtc)` performs no I/O and returns exactly `AcceptedRestoreBinding`. It does not reference the historical 09:09 artifact hashes. `restoreReceiptSha256` maps to the supplied new restore-observation hash; `restoreReviewSha256` to its separate structured review; `fingerprintDerivationSha256` to the existing derivation output; `fingerprintDerivationReviewSha256` to the separate structured fingerprint review. The singular `independentReviewerId` is the restore reviewer; the fingerprint review has its own separately pinned reviewer identity.

The runner's four-argument verifier dependency will need a coordinator-owned adapter that supplies the whole evidence package and external policy and compares the four incoming artifacts to those exact bindings. This task does not install that adapter or change the runner. Invoke this verifier with trusted current time immediately at integration; its output is ordinary frozen data, not a durable authorization token.

Evidence includes actual encrypted archive bytes; exact source receipt and decrypted snapshot text; exact restored-state text; actual restore-result text; new restore observation; existing fingerprint-derivation result; and two new review envelopes. Each is externally SHA-pinned. Source-state and restored-state semantic hashes, expected fingerprint, and the external default-ACL digest are independently pinned too. The verifier retains artifact strings once before parsing, copies binary bytes, and refuses shared-memory archive buffers. Canonical compact or producer pretty-with-LF JSON prevents duplicate-key/escaped-key ambiguity. Policy accessors/prototypes are refused rather than executed.

It validates backup receipt/archive/snapshot/dump/state relationships with the actual existing recovery bundle validator, rechecks normalized source/restored-state preservation, and verifies ordered unique source ACL rows. Only the existing derivation's supported 27-row external-ACL scope is admitted; the digest is dynamic, not historical. The source and restored state hashes are deliberately allowed to differ because reviewed external-schema ACL exclusions are part of the accepted application-only normalization. Role, sequence, table/row and tenant-access drift in the normalized state refuses.

It checks actual restore-result claims and local clone identity; the new observation binds the same source/result/derivation chain to a loopback PostgreSQL 17 clone, schema 22, operator, chronological restore and derivation completion, stopped/retained clone and absent listener. Source receipt creation must be at or after an **external** notBeforeUtc cutoff and at most external maxAgeMs old; maxAgeMs cannot exceed 24 hours. The operator must choose the current authorized refresh cutoff; the verifier never invents one from incoming evidence. Reviews must occur after the whole observation chain and not after trusted now. Unknown/null review checks, unknown scope, malformed dates, false preservation, stale data or mismatched identities refuse.

## New review authority contract and missing live dependency

There is no existing dynamic authenticated review format that can safely turn historical Markdown into approval of a different backup. This implementation therefore requires new strict `neuvetra.hosted-setup.fresh-restore-review.v1` envelopes with stage restore or fingerprint. An envelope must contain accepted verdict, externally configured operator/reviewer identity, canonical reviewedUtc, zero material findings, exact subjectSha256, explicit exclusion/currentness flags and exact stage-specific checks.

`freshRestoreReviewSubjectSha256(policy)` hashes the complete validated policy except the two review hashes, avoiding circular hashing. Review identities, evidence pins, freshness cutoff, max age, source/restored state, fingerprint and ACL scope are included. Reviewers must independently verify that subject. The operator then separately pins each issued review's exact bytes. The helper only computes a review subject; it does not issue or sign an acceptance.

Restore review requires actualPostgres17RestoreVerified, archiveSnapshotPairVerified, applicationPreservationVerified and tenantControlsVerified, all true. Fingerprint review separately requires coherentSnapshotVerified, quietSequenceWritersVerified, fingerprintIndependentlyDerived and externalDefaultAclScopeVerified, all true. Both reviewers must differ from the operator. One independent person may review both stages, but separate exact stage reviews remain required. Every envelope must deny current-hosted observation and upgrade authority and require live hosted preflight.

**Missing live authority:** independently authenticated issuance/acquisition of these new review envelopes and a trusted operator-supplied policy/time. No production producer or authenticator for them exists in these files. Old Markdown, an unissued review, missing pins or unknown review checks cannot produce a binding. JSON and hashes establish integrity and relationships, not origin: a caller who forges all evidence and the external trust policy is outside the trusted-host boundary. No cryptographic or accredited-review claim is made.

## Validation and preserved history

Windows/PowerShell, Bun 1.3.12. All checks used synthetic fixtures and mocked transaction-scoped inputs to the real existing pure derivation contract; no PostgreSQL connection was opened. The test fixture adapts existing derivation setup and calls `deriveExpectedHostedSetupFingerprint` with explicit synthetic seams, then calls the actual new public verifier. Fake encrypted archive bytes are visibly synthetic fixtures and are not evidence of DPAPI decryption or real restoration.

- `bun test tools/staging/hosted-setup-fresh-restore-binding.test.ts`: **10 passed, 0 failed, 113 expectations**.
- Focused `bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --types bun tools/staging/hosted-setup-fresh-restore-binding.ts tools/staging/hosted-setup-fresh-restore-binding.test.ts`: **exit 0**. Actual AcceptedRestoreBinding return type is checked directly.
- Initial 8-test/105-expectation run also passed; two additional ACL/authority cases were then added and the final checks above passed. No test or type-check failure occurred. While writing the author run record, PowerShell refused assignment to a notes property absent from the base template; the record was written without notes. The property was then explicitly added and the evidence hashes refreshed. This administrative failure did not execute or change the verifier.

Negative cases cover every artifact's external pin, stale/future/cutoff time, source receipt relationships, operator-as-reviewer, wrong reviewer/stage/subject, open findings, missing/null checks, legacy Markdown, repinned false result/observation/derivation, nonlocal/PG16 clone, changed precise-row/sequence/tenant state, ACL reorder/duplicate/content/count after coordinated source repinning, duplicate/escaped JSON keys, extra fields, review-role permutation, one-read getters, policy accessor rejection, shared/empty archive, and absent review authority. Positive tests use two different new archive chains and verify exact output identities and frozen output.

The first accepted-restore FAIL (ACCEPTED-RESTORE-QA-F01 split reads) and fingerprint FAIL (FINGERPRINT-QA-F01 incoherent catalog capture) remain untouched. This binder addresses the former through retained values, and requires explicit independent review of the repaired coherent derivation and quiet sequence-writer scope for the latter. It does not rerun those native tests or retroactively accept historical failures.

## Limits for independent QA

Actual restoration, private archive decryption-to-snapshot pairing, execution provenance, coherent PG17 capture, quiet sequence writers and independent reviewer identity cannot be proven by these bytes alone; they require the independently authenticated reviews. The verifier validates their precise review contract and corroborating byte/state relationships. External ACL handling remains application-only; provider Auth/storage recovery is excluded. Source hosted currentness remains false. A fresh hosted fingerprint under the separately held writer gate, publication, stop/resume binding, durable journal and mutation authorization remain separate. This report is an author handoff, not an independent PASS or permission to launch.
# M80 v2 restore compatibility memo

Independent security/reliability planning review. This is not source acceptance, a rehearsal pass, or a migration gate. ACTUAL-RESTORE-F01 remains open. No code execution, database access, source edit, Git, ENV or provider action occurred for this task.

## Minimum versioned consumer changes

| Boundary | Required change | Preserve |
| --- | --- | --- |
| Backup restore/rehearsal writer | Emit a distinct preservation receipt/profile with explicit raw source/restored hashes, normalized hashes, proof profile, excluded-external-ACL count and exact trigger multiplicity evidence. Bind proof and receipts to the actual archive and common final completion time. | Raw archive/snapshot, original receipts and failed journals. A normalized equality claim must not replace unequal raw hashes. |
| Preparation and once/gate validator | Version the closed rehearsal schema and expected preservation receipt body. Verify the full typed normalization proof and exact raw receipt pins; distinguish restore normalization from same-database migration preservation. | Freshness, actual table inventory, content hashes, schema21→22 receipts, held4/RLS/direct-write checks, independent gates and predecessor chains. |
| Executor | Version preparation imports, accepted review/source pins and the fresh-rehearsal check. Use the additive raw schema22-delta wrapper for the actual migration observer, including restart reconciliation. | Raw captured pre-migration state, raw target/current-state hashes, durable source receipt, size/duplicate-key checks, zero-session mutation preflight, ack/readiness/reconcile rules and close-after-operation lifetime. |
| Input composer and optional bundle composer | Map the real v2 receipt/proof explicitly; use the reviewed preparation/executor successor imports and pins. Missing or mismatched proof must refuse. | Exact actual provenance and publication/check evidence; do not fabricate a v1 receipt or set legacy raw equality true. |

Existing capture, archive and read-only observation formats need not change merely because a disposable restore compares a normalized projection. Keep their raw application-state identity unchanged. Existing immutable C3 transport/collector dependencies may remain historical dependencies if no bytes change; they do not automatically approve the new restore consumer. A future stop/recovery target refresh is a separate operational requirement because the original attempts are consumed.

## Evidence and concrete hazards

- Accepted C3 `m80-backup-core.ts` lines283–300 compares the entire raw restored state, then uses `some`/`Set` membership for old internal triggers during migration. That latter check loses duplicate counts. The successor must subtract the old trigger multiset from the after-state, refusing any missing old occurrence and allowing only reviewed new-table constraint additions.
- Prep C6 `m80-foundation-hosted-prepare-v2.ts` lines307–310 closes the rehearsal keys and requires equal `sourceMetadataSha256`/`restoredMetadataSha256` plus `oldMetadataExact:true`. Line370 constructs preservation.v1 with those claims. A truthful normalized receipt is intentionally incompatible and needs a versioned consumer.
- C9 `m80-foundation-executor.ts` line300 checks the old rehearsal flags; lines498–508 compare raw current state to reviewed target/gate hashes; lines520–522 call the raw migration delta validator. Do not feed normalized restored state into those live raw checks. Migration is an in-place comparison: external default ACLs must remain exact there.
- The draft additive `m80-backup-v2-core.ts` has the right split: normalized restore proof versus `assertM80BackupV2RawSchema22Delta`, with raw ACL equality and trigger multiset subtraction before the old validator. It remains unfrozen/unaccepted. Its external-ACL check should reject empty schema strings, and canonical sorting should use explicit ordinal comparison rather than environment-sensitive default `localeCompare`.

## Required focused integration demonstration

Use actual newly generated v2 receipts through the new preparation validator and bundle/executor validators. Refuse v1 substitution, forged normalized equality, changed proof count/hash, global/application ACL changes, and lost duplicate triggers. Rehearse migration from the restored raw baseline; separately prove actual same-database raw ACL preservation and fresh-process reconciliation. Keep deterministic operation-scope/intent paths compatible so a consumer version change cannot bypass an existing lock. No original attempt may be replayed.

The suggested changes above are the minimum semantic integration surface, not approval of any unfrozen implementation.

## Source observations

Observed 2026-09-25T02:47:55.525809+00:00. Draft v2 hash identifies an observation only, not a frozen candidate.

- `.superpowers/m80-backup-core.ts`: `01e88cafc1eb9f1613589d09e3dcfc20ba7c45f93c5321959fdd72cf371aaa2f`
- `.superpowers/m80-foundation-hosted-prepare-v2.ts`: `82e2a01469a4d85cb77a71f53f55275a044952046d23bdf8aaff9f710e7c14b5`
- `.superpowers/m80-foundation-hosted-once-v2.ts`: `5db678e1332a75c08aa63d9052dedbb15a096266f28dfab9139685f7772daf74`
- `.superpowers/m80-foundation-executor.ts`: `4cf676a7f93e664800205146afcb45621d6018d1e821c7bcf7c2c5d7a48f18fb`
- `.superpowers/m80-backup-v2-core.ts`: `d926d6246f1f6210293c3034b9aa4f48687e626720319fe37cb2f511ee6ce088`

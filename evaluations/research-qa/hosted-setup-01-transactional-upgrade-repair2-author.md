# HOSTED-SETUP-TXN-REPAIR2 — author handoff

Date: 2026-09-26. Author: `/root/txn_runner`, software-engineering specialist reporting to CTO. Critical role registry route requested `gpt-5.6-sol` / `high`; observed model, reasoning effort, token use and cost are unavailable to this execution context. Scope was limited to `tools/staging/hosted-setup-transactional-upgrade.ts`, its focused test and this evidence note.

## Candidate

This inert local candidate repairs only QA2 TXN-QA2-F05 and F06. It performs no provider, network, database, deployment, restart, Git, ENV or secret action on import or during these checks.

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-transactional-upgrade.ts` | `1cd07dc9789aec7f42b19c3951fde8c52844ff556e888ba0618d9b028bf719a4` |
| `tools/staging/hosted-setup-transactional-upgrade.test.ts` | `7cb2ced67fbb77f17fa01c9b0a99854c3b5cd1a9a6bbb8b34e2f66a86d8ab339` |
| QA2 source report | `420255755be40f095565c20a393ae4f827934b8a6698463cd09e0d7c3dc6761c` |

The prior frozen candidate hashes were `b0a53121ed4fdffb59a2d5a006ce18e65a64da8b80805def02770cc7878775d2` for source and `30d86bc0e41b68c6aafd6dc881dba52372ef93efa0ee05d6e709491312fe8f2d` for the focused test.

## Repair behavior

### F05 — raw journal path validation

`privateInput` now reads the caller's journal path once, requires a primitive absolute string before calling `resolve`, and retains the normalized private copy across later awaits. Existing external-to-repository validation remains in place. Relative parent paths, Windows drive-relative paths and a relative path followed by a process-cwd change all refuse before journal or database activity.

### F06 — immutable evidence and stable journal handles

Relation inventory arrays are frozen when created. The locked evidence event receives separate frozen table and sequence arrays. The success receipt and its `accessExclusiveTables` array are frozen, and every journal record object is frozen before crossing the callback boundary.

The runner reads `append` and `close` once immediately after the journal is opened, validates those exact values, binds them to the returned journal and uses only the captured functions for all later events and cleanup. A callback that replaces `journal.append` and `journal.close` after the reservation cannot drop the locked, pending-commit or resolved-commit events. Attempts to replace or mutate the lock and sequence arrays do not affect the journal evidence or returned receipt.

The concrete journal implementation remains responsible for actual durable persistence. Callback isolation cannot prove that an injected journal writes its input.

## Verification

```powershell
bun test tools/staging/hosted-setup-transactional-upgrade.test.ts --timeout 30000
bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-transactional-upgrade.ts tools/staging/hosted-setup-transactional-upgrade.test.ts
```

Results:

- Focused suite: **15 passed, 0 failed, 89 expectations** on Bun 1.3.12.
- Focused strict TypeScript: **PASS**, exit 0 with no diagnostics.
- New path regression confirms single getter read and zero journal/database activity for relative parent and drive-relative input; the cwd-change case also refuses without side effects.
- New PGlite adversarial regression runs the complete schema-22 to schema-23 transaction with a journal that tries to forge both arrays and replaces both methods during the first append. It records all four required statuses, preserves real lock evidence in the receipt, reads each method getter once and calls the original close once.
- Existing tests continue to cover one physical transaction, server timeout configuration observation, restore/source/maintenance binding, rollback on mismatch, uncertain commit, reconciliation and no replay.

## Retained limits

QA2 TXN-QA2-F07 is intentionally unchanged. The installed Bun/postgres client fatal-timeout teardown path remains a separate database-adapter task requiring native evidence. This candidate supplies no live execution authority. It does not establish authenticated source closure, a concrete provider transport, live deployment topology, original-transaction resolution, or external journal durability. Independent QA must review these frozen bytes before integration.

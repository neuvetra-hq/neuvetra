# ARTIFACT-LAUNCH-REPAIR-01 — author repair handoff

2026-09-26. Author `/root/artifact_launcher`, security/reliability implementation under CEO/CTO. Requested critical route remains `gpt-6-astra/high`; observed model/effort, tokens and cost unknown. Independent acceptance is pending. The earlier author report and independent first-review findings remain historical evidence; neither was edited.

Both reported P2 defects were reproduced against the original frozen source with newly written targeted regressions: **0 pass, 2 fail**. The binding getter entered the inner operation and consumed migration before the intended outer operation; the checkout junction alias was accepted. Repairs below address those failures without introducing an operational launcher or changing the artifact profiles.

## Repairs

1. `withArtifactSource` now claims `validating` immediately after its private single-use check, before `canonical(candidate)` can invoke caller getters. During validation, both recursive wrapper entry and direct `migrate()` calls are refused. Only a successful exact binding check and function check transition to `active`. The encompassing `finally` consumes the lock after validation failure, operation failure or success. This intentionally means a mismatched binding now consumes the attempted lock; the test that separately exercises operation failure uses a fresh fixture capability.
2. Every `activeCheckoutRoots` entry is now passed through the existing regular-directory and resolved-realpath checks before overlap testing. Direct symlink/junction roots and aliasing in parent directories are rejected; missing, inaccessible or nondirectory exclusions fail closed. Exclusion roots may not be silently omitted. This is a trusted-host path check, not protection from hostile concurrent filesystem remapping.

## Verification

- `bun test tools/staging/hosted-setup-artifact-source.test.ts --timeout 30000`: **12 passed, 0 failed, 69 assertions**, Bun 1.3.12.
- Installed TypeScript strict check of the two changed files: **PASS**, no diagnostics.
- New getter test invokes recursive wrapper entry and direct migration from the binding getter, then verifies both refusals, zero inner operations, exactly one intended outer operation, exactly one synthetic transaction and original migration-23 SQL. A subsequent wrapper entry is refused.
- New filesystem test creates real Windows junctions for a direct source-root alias and an alias in a parent directory, and verifies both refusals. It also verifies rejection of a missing root and a regular file supplied as an exclusion, then accepts the unchanged normal-root control with `launchAuthorized: false`.
- Existing tests still pass for publication/artifact mismatches, complete inventories, private SQL after backing-file changes, caller input mutation, normalized digests, consumed capabilities, controlled Bun environment/config inputs and uncertain deadline outcome. Latest retained synthetic launch-input probe: `C:/Users/nimab/AppData/Local/Temp/hosted-artifact-launch-probe-ErE0qn/`.

No hosted action, database connection, secret access, publication or Git mutation occurred. No existing runner, adapter, provider, ledger or reviewer report was edited. Author writes are limited to the two owned source/test files, this new report and synthetic temporary fixtures. Test children exited. The test suite still uses a synthetic database adapter and receipt/archive fixtures; it does not establish authentic publication, archive extraction, real dependency resolution, native transaction preservation or an operational worker. All operational limits in the original author report remain in force.

## Exact repair candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-source.ts` | `3e1069aba42eca77a861f9c395c966269758a79a16207c53c19b15b6c8d4c691` |
| `tools/staging/hosted-setup-artifact-source.test.ts` | `4a57883a54b387cf1356ecacfda5e05c80a792cbc230be0f8bce2ddc1c9992c9` |

Next owner: independent QA for targeted rerun against these hashes; root for any later integration. `launchAuthorized: false`, `executionArtifactSha256` and the deliberately versioned `withArtifactSource` contract remain unchanged.

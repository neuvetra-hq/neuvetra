# HOSTED-SETUP-SCHEMA-BRIDGE-01 — author handoff

Date: 2026-09-26. Role: software-engineering specialist under the CTO sponsor. Requested critical route: `gpt-5.6-sol` / `high`; the execution tools did not expose the applied model, effort, token use or cost, so observed settings remain unknown. Base checkout: detached `f8bde80515ce69830add7ac543bca96cd49c27ff` with preserved shared in-progress work.

## Outcome

**READY FOR INDEPENDENT QA; no live action authorized or performed.** The hosted runtime now has a narrow schema-22 readiness bridge for only the pinned existing synthetic project `icockcoguyadhryzydvl`, only with explicit existing-project reuse, verified legacy containment, the exact first 22 reviewed migration receipts and the complete 23-migration image manifest. Schema 22 remains refused for every other project and any missing, additional, reordered or changed receipt fails closed.

The API may start and return `/ready` 200 on that exact contained schema-22 target. Existing config, session and legacy workspace routing remain available under their existing authentication, staging-access, membership, origin and rate-limit controls. A valid general company setup request still passes the outer authentication and staging-access checks, then returns controlled 503 without calling any schema-23 setup method. The same runtime check opens the setup route only after it observes exact schema 23. Startup and request readiness never run migrations.

## Changed artifacts

| Artifact | SHA-256 | Git blob |
| --- | --- | --- |
| `packages/neuvetra-database/src/hosted.ts` | `1af0a88b08c37ee0f73ca8dd2f56ce96e54ee5d145a6902ee86753f7d740b1ff` | `5451662e41edf3b1b4ef0d4ab9d86684f39bcd41` |
| `packages/neuvetra-database/src/hosted.test.ts` | `b4a64f8b4f756febdf09a5e5d97c6609074b138c0e27bf047b5a2e24f8a905a2` | `a47bcd8eba9f4a539698223f5d017cdfa62b6ca0` |
| `apps/site-api/src/staging/server.ts` | `4375613c62e40ecd34a592d5f06622143c1a196780d92b99fb859b6b44651b2d` | `fae7c6344e0b4aae8245e927b48fa291dc77a532` |
| `apps/site-api/src/staging/server.test.ts` | `e1a56099c53ce05681c7cd9ecb091d811f761aeee22d3a6cb7483910425d6bda` | `58b649343278481512b4212397e4900614a138b5` |

The pre-existing shared adapter candidate had independent QA pins `842055547bea75f6aeaf6ec7c2396da90b889631e21705854c3df08e20a2d30c` for `hosted.ts` and `4d86d6ff965a1e52f53eb8d214183259d2f05324178b3db6b0c3637bea2fd830` for `hosted.test.ts`. This readiness-only change preserves its transaction implementation but changes both file bytes, so that earlier source verdict is stale for the integrated files until targeted independent re-review.

## Criterion evidence

1. **Exact, bounded schema acceptance:** the pure receipt test accepts 23 generally, accepts 22 only for the pinned existing project with reuse confirmed, and refuses nonexisting-project 22, unconfirmed reuse, schema 21, a changed schema-22 hash and an incomplete 22-entry image manifest.
2. **Activation readiness and setup closure:** the staging server test observes `/ready` 200 with `schemaVersion: 22`, config 200 and an authenticated legacy session 200. The setup route returns 401 without authentication, then 503 for an authorized admitted user while the setup database method remains uncalled. After the same readiness source changes to 23, the setup method is called and its test fixture returns 404.
3. **Strict other-target behavior:** nonexisting-project schema 22 and unknown schema 24 both close the database and refuse server creation. Existing-project containment remains required at startup and on every workspace API request.
4. **No hidden migration:** `HostedWorkspaceDatabase.create()` still performs only target validation, containment audit, role/metadata checks and receipt reads. The bridge function has no database mutation path. The native fixture observed no `neuvetra.company_setup_versions` table at schema 22; only an explicit operator migration created it before the schema-23 readiness check.
5. **Actual PostgreSQL comparison:** a fresh loopback PostgreSQL 17.11 cluster reproduced contained schema 22, returned readiness 22 through the real restricted runtime role, explicitly migrated to 23, and returned readiness 23 from the same runtime object. The complete native suite passed **10 tests / 133 expectations**. Fixture `shared-adapter-legacy-7b4226170f584b8686d83d0e8950a6fa`, port `65065`; stop exit `0`, final status exit `3` (no server running).

## Checks

- `bun test packages/neuvetra-database/src/hosted.test.ts apps/site-api/src/staging/server.test.ts`: **13 passed, 9 opt-in native tests skipped, 0 failed, 110 expectations**.
- `packages/neuvetra-database/src/hosted-adapter-native.ps1 -Suite legacy`: **10 passed, 0 failed, 133 expectations** on Bun 1.3.12 / PostgreSQL 17.11; cluster stopped cleanly.
- `bun run typecheck` in `packages/neuvetra-database`: **PASS**, no diagnostics.
- `bun run typecheck` in `apps/site-api`: **PASS**, no diagnostics.
- `git diff --check` over the four changed source/test files: **PASS**.

The native run emitted the retained `pg@8.23.0` deprecation warning for concurrent `client.query()` dispatch in the previously reviewed shared adapter during the large legacy preservation test. The suite passed; this bridge did not alter that transaction code, and this handoff does not resolve or waive the warning.

## Preserved first failures

- The first native bridge run on fixture `shared-adapter-legacy-59a3e8b9f80d438f802bfe57431234e9`, port `65039`, failed before accepting schema 22 because a stock PostgreSQL cluster retains `PUBLIC` usage on the `public` schema and therefore did not reproduce the already-reviewed existing-project containment prerequisite. The harness stopped that exact cluster with stop exit `0` and status exit `3`. The test fixture was corrected to revoke that stock grant before the comparison; product code was unchanged by the repair.
- Initial sandboxed focused tests could not read this managed worktree (`EPERM`). The same exact tests passed with approved worktree access. Two initial typecheck command forms invoked Bun from the wrong working directory and did not execute the scripts; the final package-local commands passed.

## Assumptions and limits

- This bridge is pinned to manifest length 23 and bridge version 22. A future migration count fails closed until this temporary policy is deliberately reviewed.
- The real hosted schema-22 receipt hashes, containment and runtime role were not contacted in this task. Native evidence uses synthetic loopback data and reviewed migrations.
- No Railway deployment, image activation, scale change, Site-Web stop, hosted backup, hosted migration, database mutation, browser demonstration, Git commit or push occurred. Do not describe the new image as live or activated from this evidence.
- Current maintenance-stop/runner evidence names the prior Site-Web deployment ID and commit. Root must rebind and independently review those controls against the newly observed reviewed bridge image before any live stop or upgrade. This author did not edit that workstream.
- The intended operational sequence still needs independent integrated review: publish and verify the exact reviewed image, observe schema-22 `/ready` on that image, scale Site-Web to zero, run the separately accepted one-shot schema-23 transaction, then scale the same exact image to one and reconcile. A health response alone does not prove image identity or authorize replay.
- Independent QA must review the exact hashes above. This author is not the release reviewer.

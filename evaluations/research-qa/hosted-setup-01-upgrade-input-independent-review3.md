# HOSTED-SETUP-SAFETY-QA3 — runner and source-lock independent review

2026-09-26. **PASS for the bounded repaired runner and synchronous source-lock manifest interface.** Former runner F01–F03 and the residual asynchronous binding race are closed in the exact bytes below. No new material runner defect was found. **Live integration remains blocked** by reviewer-identity coupling, the separate gate-adapter diagnostic finding, and unimplemented/unaccepted runtime and provider controls. This PASS grants no hosted authority.

Reviewer `/root/source_lock_holistic_qa`, independent Head of QA/security reviewer, CEO sponsor. This context authored earlier independent reviews but none of these sources or tests. Requested critical gpt-6-astra/high; observed compute, tokens and cost unknown. Read the complete affected code/tests, prior failed runner reviews, source-lock boundary and concrete accepted-restore contract; retained applicable AGENTS/QA/security/board instructions. Only the assigned review reports were written. No code, operations, Git, ENV, credential, hosted/provider or external/native database mutation occurred. Existing tests exercised local embedded PGlite; added probes used in-memory adapters.

## Evidence map

| Criterion | Independent disposition |
| --- | --- |
| Former async restore mutation | Both already-fulfilled and genuinely pending Promise returns are now rejected immediately with `Synchronous verifier binding required`, before any journal or migration call. The mutation timing that passed QA2 cannot supply evidence to the runner. |
| Other asynchronous bindings | Promise-returning publication, gate wrapper, inner gate binding and migration manifest all refuse at runtime. Rejection is not merely a TypeScript annotation. |
| Synchronous copying | Restore/publication results are copied before the first runner await. Independent synchronous microtask mutation retained the original valid result. Required primitive fields are captured once by `privateScalars`; exact downstream value/digest checks remain. |
| Fresh held-gate observations | The gate wrapper and binding are synchronous; observer function is captured, the binding is privately copied/frozen and validated, and that exact copy is passed to the observer. Independent mutations to original gate fields while the observer awaited did not change the supplied copy. Valid control observed the gate three times. |
| Strict true | False, undefined, null, numeric 1, string `true` and boxed Boolean(true) all refused. A failed second observation prevented migration; a failed third observation produced postcommit reconciliation with one migration already returned. |
| Private manifest / former F03 | A complete synchronous manifest and pinned migration method are both mandatory. Missing either refuses before journal/migration; disk-backed manifest fallback is removed. Ordered migration names, SQL digests and private frozen rows remain enforced. Existing late-manifest regression requires reconciliation rather than reporting false success. |
| Immutable async fingerprints/results | A fingerprint object returned across an async boundary refuses before migration; a migration-result object refuses with reconciliation after the migration returned. Primitive JSON strings are required. Independently mutating source fingerprint objects after serializing and resolving their strings did not change the captured observations. |
| Journal / former F02 | Independent cwd mutation retained the exact invocation-time absolute journal path. Module-anchored outside-repository checks and default parent realpath checks remain. Existing exclusive journal and chained-sync tests passed. This is not a hostile-filesystem atomic no-follow guarantee. |
| Single use / no retry | Existing source-lock single-use and runner preflight/uncertain/postcommit/receipt-failure cases passed. Independent gate failure at stage 2 had zero migration calls; failure at stage 3 had one and required reconciliation. Correct operator journaling across processes remains necessary. |

The trust boundary is explicit: a supplied authenticator or fresh observer must truthfully check the captured evidence/target. Strict true is not proof that an arbitrary callback performed that work. Function snapshots also cannot freeze mutable values inside an adapter's closure. Concrete adapters require separate review.

## Synthetic composition of the actual source lock and runner

I independently constructed the actual source lock using real module-anchored migration files and synthetic runtime attestation/authentication. I supplied its synchronous manifest getter and immutable-source wrapper directly to the runner, and serialized the actual pinned migration result through `canonical(await lock.migrate(connection, project))`. The connection was an in-memory adapter implementing the fixed-target audit and migration query contract; no real database was connected.

Observed outcome:

- Synchronous manifest getter returned an array, not a Promise. Mutating a returned clone left subsequent reads unchanged.
- Normalized actual 23-migration manifest SHA-256: `ec11c9b39bb706f64c970745d0d122ec5fb76b480ea0cd2362d685c8b2620452`.
- Exactly one simulated transaction and one execution of the exact retained migration-23 SQL string.
- Three fresh gate observations and `hosted_setup_schema23_committed_and_observed` synthetic result.

This establishes compatibility of the changed interfaces and pinned execution path under synthetic dependencies. It does not authenticate loaded code, prove PostgreSQL preservation, implement a provider transport or establish current hosted state. The source-lock authenticator in this probe intentionally returned true for synthetic claims, so the probe cannot be cited as runtime-authenticity evidence.

## Reviewer identity remains an integration blocker

One input `independentReviewerId` is still compared against historical restore, publication and stop reviewers. The accepted-restore helper returns `/root/hosted_recovery_qa`. An independent probe supplied a distinct actual publication reviewer and the runner correctly refused with `Publication review not accepted` before mutation.

This is a restrictive contract, not false attribution that has already occurred. It nevertheless blocks truthful integration when the stage reviews have different real owners. Do not relabel later reviews as the historical reviewer. Root should separately bind each stage's reviewer to its exact artifact and preserve operator/reviewer independence. A final integration approver can be additional metadata; it must not replace historical reviewer provenance. Reuse of one identity is valid only if that exact reviewer actually performs all required reviews. Resolve and independently review this constraint before live composition.

## Checks actually run

- Four focused suites on Bun 1.3.12: source lock, upgrade runner, gate adapter and underlying write gate — **40 passed, 0 failed, 232 assertions**. The separate adapter still has an independently found defect despite this green aggregate.
- Strict TypeScript with ES2022/ESNext, bundler resolution, Bun types and skipLibCheck across the same four sources and tests — passed, no diagnostics.
- Reviewer-written runner stdin probe — **34 independently counted checks passed**, covering the former async races, runtime sync refusal, strict-true behavior, all three observer stages, input/output ownership, missing pinned dependencies, journal path and reviewer mismatch.
- Separate actual-source-lock/in-memory-runner composition passed as described above.

Commands:

```text
bun test tools/staging/hosted-setup-upgrade.test.ts tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-write-gate-adapter.test.ts tools/staging/hosted-setup-write-gate.test.ts --timeout 30000
bun x tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --strict --skipLibCheck tools/staging/hosted-setup-upgrade.ts tools/staging/hosted-setup-upgrade.test.ts tools/staging/hosted-setup-source-lock.ts tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-write-gate-adapter.ts tools/staging/hosted-setup-write-gate-adapter.test.ts tools/staging/hosted-setup-write-gate.ts tools/staging/hosted-setup-write-gate.test.ts
```

Local tests and report writing required bounded managed-worktree access escalation. No permanent probe source was added. Native PostgreSQL, hosted/provider state, real launcher/authenticator, concrete privileged-writer hold, hostile filesystem races and actual operator execution were not tested.

## Exact reviewed bytes

Initial and final hashes matched.

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-upgrade.ts` | `52a760180b2f8de3a25fb0cc47b67a659d9d6174af6c6bf055d51614544cef5c` |
| `tools/staging/hosted-setup-upgrade.test.ts` | `8c6900aa36709e469949b97a65aedf99674c2b36ea337ed5aded09278cebc674` |
| `tools/staging/hosted-setup-source-lock.ts` | `b52b9f1d5347976b9bcb226917b40186e08a825dc2e4b78f1efe4a951053a20c` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `0fe36ace2fe71398ca79d9400c164a94fddd9472f9af7ff6da036c1f41500ce2` |

The earlier source-lock and runner reviews remain historical records for their exact hashes; this report supplies the new bounded changed-interface review. It does not approve a future imported closure containing further changes.

Next owner: root/CTO. Preserve failed history, record bounded component acceptance, resolve truthful stage-reviewer identities, repair the gate adapter, and obtain separate concrete runtime/transport/continuous-writer-control integration review. Fresh restore/currentness, publication, durable execution and postcommit reconciliation gates remain before any hosted upgrade.

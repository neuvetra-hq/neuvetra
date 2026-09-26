# HOSTED-SETUP-SOURCE-LOCK-QA-05 — independent repair-4 review

2026-09-26. **PASS for the bounded source-lock component.** F04 [P1] and F05 [P2] from independent review 4 are repaired in the exact bytes below. No new material defect was found in this targeted review. This verdict covers private artifact/SQL pinning, validation and at-most-once invocation under the declared trusted dependencies. It does **not** accept an external runtime authenticator/launcher, complete loaded-code discovery, current hosted authority or a schema-23 upgrade.

Reviewer: `/root/source_lock_holistic_qa`, task HOSTED-SETUP-SOURCE-LOCK-QA-05. This context authored the preceding independent review but did not author the implementation, tests or author handoff. Requested route gpt-6-astra/high; observed compute, token use and cost unknown. QA role hash remains `0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94`. The previous operating, board and corporate context and holistic boundary review remain applicable. I read the complete changed source/test and repair-4 handoff, and confirmed the migration and upgrade dependencies are unchanged. Reviews 1–4 remain preserved failures.

Only this report was written. No candidate/code/operations/Git edit, secret access, hosted/provider action or external/native database connection occurred. The existing suite uses ephemeral embedded PGlite; my independent probes used an in-memory adapter and synthetic attestation claims. Local test execution and report writing required bounded managed-worktree permission escalation.

## Finding dispositions

**F04 — repaired.** The lock now copies and hashes invocation-time artifact bytes, parses those private bytes and snapshots required fields before the first await. The verifier receives a distinct copy and returns only a strict boolean authentication result. It cannot supply replacement parsed evidence. The private parsed snapshot is never shared with it.

I independently recreated the original synchronous microtask: the artifact declares `runtimePreloads: ['unreviewed-preload.ts']`; the verifier parses its copy, queues a microtask clearing its parsed list, and returns `true`. I verified the microtask ran and cleared the verifier-owned list. The exported lock refused the artifact with `Runtime preloads and custom loaders are not permitted.` The exact bad artifact retains its bad evidence regardless of the verifier's private view.

Additional independent handoff challenges:

- Valid synchronous and asynchronous `true` authentication succeeded.
- `false`, undefined, null, numeric 1, string `true`, boxed Boolean(true), and a parsed attestation object all refused with the strict-authentication check. Returning the former evidence object is no longer a compatible API.
- Verifier byte-copy mutation after an asynchronous yield refused.
- Synchronous verifier scheduling byte mutation in a microtask refused.
- Retained verifier bytes mutated during the later executable-realpath await refused at the second byte-integrity check.

These results establish private evidence ownership and strict authentication-result handling. A deliberately dishonest verifier can still return `true`; authenticating identity and pre-import provenance remains its separately reviewed responsibility. The tests do not pretend that a stub returning `true` proves executable authenticity.

**F05 — repaired.** Runtime pins require an object with string path and string digest before validation. Canonical segments and resolved repository containment are checked. I recomputed both the closure and exact artifact hashes for every malformed pin so refusal could not be attributed to a stale closure. The original `zz/../../outside.ts` traversal and one-element array digest both refused. Additional leading traversal, dot segment, empty segment, absolute path, backslash path and drive-qualified path cases refused. The array digest is rejected before regex coercion or any nested mutable digest is retained.

## Regression and scope coverage

| Boundary | Result |
| --- | --- |
| Prior F01 | Existing module-anchored cwd independence, symlink/junction refusal and exact process/module/root/closure mismatch checks passed. This remains static path validation plus reviewed SQL digest enforcement, not an atomic hostile-filesystem no-follow mechanism or proof of loaded code. |
| Prior F02 | Existing invocation-byte mutation during pending head observation and reviewed-closure mutation during pending verification tests passed. Private evidence now comes from the synchronous invocation-time parse. |
| Prior F03 | Independently repeated both fields' missing/null/string/object/nonempty variants: all 10 refused. Explicit empty control succeeded. |
| Broader artifact schema | Independently supplied string PID, string findings count, string boolean flag, array closure digest, null preload entry and null pin entry: all refused. Required values are no longer accepted by primitive coercion. |
| Pinned SQL | Existing backing-file mutation and manifest-copy mutation regressions passed. My independent caller-clone mutation left subsequent returned manifest and executed migration SQL unchanged. |
| At-most-once | While a synthetic transaction was pending, independent competing wrapper and migrate calls refused. Exactly one transaction and original migration-23 SQL execution occurred; the consumed wrapper refused later entry. This is per-lock-instance at-most-once invocation, not guaranteed successful commit or a cross-process once-only reservation. |
| External launcher and operator integration | Not established; excluded from PASS. All coupled methods must still be wired from the same lock, with a trusted adapter and independently accepted runtime authenticator/launcher. |

No changed dependency invalidated the previous narrowed SQL analysis. The independent normalized manifest observation remains 23 migrations with SHA-256 `ec11c9b39bb706f64c970745d0d122ec5fb76b480ea0cd2362d685c8b2620452`.

## Checks actually performed

- Bun 1.3.12, `bun test tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-upgrade.test.ts --timeout 30000`: **20 passed, 0 failed, 115 assertions**.
- `bun x tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --strict --skipLibCheck tools/staging/hosted-setup-source-lock.ts tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-upgrade.ts`: passed, no diagnostics.
- Separate reviewer-written stdin probe: **43 independently counted checks passed**, including F04, matching-closure F05 cases, synchronous/asynchronous authentication, three verifier-copy mutation timings, malformed evidence, clone isolation and concurrent single-use execution. No permanent probe source was added.

No native PostgreSQL, hostile OS path-swap stress test, actual external runtime authenticator, live operator integration, provider or hosted state check was run. Full unrelated repository checks were not repeated. Embedded PGlite is local regression evidence only.

## Exact reviewed bytes

Initial and final hashes matched before report delivery.

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-source-lock.ts` | `8201172e25271da9dd3625ece7976dc002639adfb11d9ec9a996e240a82f0a5c` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `0fe36ace2fe71398ca79d9400c164a94fddd9472f9af7ff6da036c1f41500ce2` |
| `packages/neuvetra-database/src/staging-migrations.ts` | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |
| `tools/staging/hosted-setup-upgrade.ts` | `2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c` |
| Repair-4 author handoff | `17c143d7a2db1c380c7011cb375914d8b33c1062a05245167d0decc555232dec` |
| Preserved independent review 4 | `913fb066139725026023ffa28854f0d240e91bc8c31a7c60bd650872b0844ad2` |

Next owner: root/CTO for bounded component acceptance and separately reviewed concrete integration. Complete the trusted pre-import authenticator/immutable-runtime mechanism, full loaded-module closure, exact publication and operator contracts, restore/currentness evidence, continuously held writer gate, durable journal and reconciliation before considering hosted execution. This report grants no migration, deployment, invitation or hosted mutation authority.

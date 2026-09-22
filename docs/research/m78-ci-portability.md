# M78 CI portability follow-up

Task M78-CI-PORTABILITY-01. Author /root/m78_security, QA role at root's direction. Requested critical Astra/high; inherited observed compute unknown. Root provides independent final review. This is a test/fixture repair, not independent reapproval of the author's earlier M78 runtime or operator implementation.

## Observed failure and scope

Published candidate b37b899 CI log .superpowers/m78-ci-failure-105083017383.log shows seven test failures: the exclusive journal's relative .tmp parent did not exist; the journey test required a private PowerShell wrapper; five recipe tests required an ignored old author receipt. This follow-up preserves those failures and every accepted earlier report/snapshot. No runtime/source gates, migration, database, host, credentials or Git operations are changed.

## Changes and provenance

- The shared hosted-database test's exclusive journal uses a uniquely created operating-system temporary directory, preserves EEXIST and exact two-event assertions, closes its handle, and removes only its newly created directory. /root/m77_backend applies this narrowly coordinated patch while owning concurrent restore work; this task does not overwrite that file.
- The journey test reads the already public immutable M78-HOSTED-JOURNEY-REVIEW-01-CANDIDATE4-ACCEPTED.json snapshot. Its retained .superpowers/m78-private-journey.ps1 UTF8 text must hash to41158e4212ac4cf14f0b09cfe29aedc2fd4c0c7b478860d5a215e309254cbc6c. All pre-unseal ordering and independent-review checks remain. This tests the exact reviewed wrapper source, never executes it, and does not assert that a later private wrapper still matches it. Actual execution retains root's separate current source gate.
- New public fixture evaluations/research-qa/fixtures/m78-hosted-plan-fictional.json contains only the complete unchanged final register from historical author receipt m78_author_native_1789617520395-result.json (receipt SHA1b40bd77bdb795efbb3b10fca658211bb23e3033191dc27e59dd3f95dc259572). It excludes the receipt's local database/operator metadata and users roster. Exact compact final-register bytes:4,799,583; SHAee115a94cddaca62b0e13c459b1c32fd120e6de929ff8fca37c74957334c7028. Each fixture load verifies that pin. All five original recipe assertions retain the complete proof/coverage input rather than a hand-built replacement. This historical input is not a current migration or release receipt.

Privacy review before extraction checked credential/email/connection/private-key field names, connection URLs, private-key blocks and JWT-shaped values: none found. All nested synthetic flags are true. Coverage, equipment, activity, issuer and evidence descriptions reviewed are explicitly fictional demonstration material; UUIDs identify that fictional fixture. The retained wrapper snapshot contains source and private-file references, not credentials; no private config was opened or unsealed.

## Verification

The two repaired fixture consumers pass locally:9tests234assertions. An initial independent-directory copy of139 public source/fixture files excluded .superpowers, .tmp, .git and node_modules. All five recipe tests passed; the journey module required the normal postgres dependency. That setup failure is retained in M78-CI-PORTABILITY-01-CLEAN-INITIAL.json, not relabeled success. The next clean setup copied locked postgres3.4.9 but initially lacked the normal @neuvetra/database workspace alias;16tests passed and the remaining import refused. That setup result is preserved as CLEAN-FINAL.json. A source-drift guard then refused the concurrently changed journey resolver map before tests. The final export was rebuilt from the new complete maps and includes an internal workspace alias pointing only to its own copied packages/neuvetra-database. No link resolves to the original checkout or private data.

Applicable lessons: L01 exercises the actual clean-file boundary that the local run missed; L02 pins reviewed immutable wrapper/fixture provenance. No skips, environment-based passes or production-gate bypasses are introduced.

## Final frozen result

Shared test writer /root/m77_backend applied the isolated temporary-directory patch and froze the shared test at427aa54ccd8b625272800853683b5f66237247be55a05177c24fd6c06262cf23. Other concurrent restore assertions in that file remain under that workstream's review, not implicitly approved by this portability task.

Final clean-copy proof: operations/agent-improvement/snapshots/M78-CI-PORTABILITY-01-CLEAN-FINAL3.json, SHAaf194c1ce979ff0d99aa7826028de82ed075afd9cfa295f2a41c9adf7090518f.151public source/fixture files were copied to a new OS temporary directory, preserving exact source pins in the proof. .superpowers, .tmp and .git were absent. Only the locked postgres3.4.9 dependency was copied (37files, tree SHA59c9dd300bb5697ff4294e6b55011fca0afaa9c51211159797a1296fd6709185), plus one workspace alias inside that clean directory. No network install, database or hosted call ran. All3requested test files passed20tests/399assertions in687ms. The OS temporary exclusive-journal directory was created and cleaned by the test.

Strict targeted TypeScript checking also passed on the exact final test bytes in the original workspace. It initially exposed an existing string-key inference in the recipe test; the key tuple is now marked as const, with no assertion or runtime behavior change. CLEAN-FINAL2 preserves the earlier passing20test run before that type-only edit; CLEAN-FINAL3 is the final byte binding. This is a local Windows/Bun1.3.12 clean-export reproduction, not a claimed GitHub rerun or Linux observation. Root must still publish and verify the new remote CI head.

Reproduction uses the returned m78JourneySourcePins/hostedSourcePins maps plus these two independent tests, the public fixture, package manifest and existing reviewed-wrapper snapshot; copy those exact files to a fresh directory, supply the locked dependency and in-directory workspace alias, verify private directories absent, then run Bun test on the three named files. No ignored-file fallback or test skip exists.

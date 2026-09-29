# M80 normalized executor consumer, 2026-09-25

## Boundary

This candidate is an offline, injected-transport successor to the accepted M80 executor Candidate 9. It does not access hosted databases, provider APIs, credentials, environment exports, private backup archives, Git, or production data. It creates no live intent, attempt, observation, outcome, admission, migration, or deployment record.

The candidate adds four versioned files and leaves the accepted Candidate 9 executor, private bridge, composer, preparation helpers, backup helpers, snapshots, and journals byte-exact:

- `.superpowers/m80-foundation-executor-v2.ts`
- `.superpowers/m80-foundation-executor-v2.test.ts`
- `.superpowers/m80-executor-private-v2.ps1`
- `.superpowers/m80-stage-bundle-compose-v2.ts`

## Exact dependencies

The executor source binds the normalized preparation Candidate 2 snapshot at `operations/agent-improvement/snapshots/M80-NORMALIZED-PREP-CONSUMER-20260925-CANDIDATE2.json`, SHA-256 `4f3b373176ad4db420d733435a79bc7fa462801a79cfea18c319d58270d5a8dd`. Independent review passed in `evaluations/research-qa/m80-normalized-prep-consumer-independent-20260925-review.json`, SHA-256 `7d3bde1e999da276985a14a566d789ba21dc8e95dade19f62ec2ea55a236489b`, with QA deliverable SHA-256 `e47f64f03c408af22715cae808244368116b38d977bb8bec60f54d0900b70b97`.

The source closure also includes backup normalization Candidate 2 at `operations/agent-improvement/snapshots/M80-RESTORE-NORMALIZATION-V2-20260925-CANDIDATE2.json`, SHA-256 `7e9f265c54720e47af46aab0e4e099d23946d91b1337731db2dc603dd2807daa`. Independent review passed in `evaluations/research-qa/m80-restore-normalization-v2-independent-20260925-candidate2-review.json`, SHA-256 `f480bfbcc296d38d1752593c6e13ab786cad8b483caf9fd0df1fda8e50af983b`, with QA deliverable SHA-256 `576b3d9f2988ef1658bd885345c993f5bb2ba2fbc2ec1db716dd73c5a67339d5`.

The closure expands the 23 accepted Candidate 9 dependency artifacts rather than embedding the 3.3 MB Candidate 9 snapshot as a nested artifact. It adds the concrete preparation and backup snapshots, so recursive source validation rehashes their current nested source files before an attempt.

## Behavior

The v2 executor requires `normalizationProof` in the plan, bundle, evidence loader, and expected-body validation. The proof stays distinct from the raw backup and migration state:

- source and restored raw hashes remain explicit;
- normalization proves only the reviewed restore-equivalence categories;
- migration captures the raw restored schema-21 application state;
- migration execution and reconciliation call `assertM80BackupV2RawSchema22Delta`, including trigger multiplicity, against the same database before and after migration.

The versioned composer validates and carries the exact normalization proof plus the complete predecessor chain. It creates no gate, review, intent, or evidence. The private bridge accepts only the existing named-export credential route and calls the fixed v2 entrypoint; it does not discover environment exports.

Operation-scope hashes and deterministic intent, outcome, attempt, source, provider-acknowledgement, pending-observation, and bundle paths are unchanged across versions. The v2 tests compare these paths directly with Candidate 9. All Candidate 9 lifecycle controls remain: source-size refusal before mutation, duplicate-key parsing, durable journals, no ambiguous replay, fresh observer reconciliation, exact provider acknowledgement identity and chronology, readiness checks, session-aware deployment observation, and awaiting asynchronous work before closing the database.

## Author checks

- `bun test ./.superpowers/m80-foundation-executor-v2.test.ts`: 23 tests, 84 assertions, pass.
- Targeted TypeScript check for the executor, tests, and composer: pass.
- Bun bundle of `.superpowers/m80-foundation-executor-v2.ts`: pass, 221.12 KB.
- Bun bundle of `.superpowers/m80-stage-bundle-compose-v2.ts`: pass, 157.22 KB.

The tests use injected transports and temporary journals only. They cover exact durable-path identity, recursive dependency closure, normalization-proof propagation and mutation refusal before attempt creation, raw migration-delta use, private-bridge input refusal, pending and uncertain reconciliation, provider acknowledgement binding, and database-close ordering.

## Integration and decision boundary

Root's actual input composer must provide a validated preparation v3 plan, gate, sealed intent, exact predecessors, normalization proof, and the v2 source-review receipt. Root also owns the provider transport and any eventual credential-bearing invocation. This candidate is not authorized for hosted execution, and it is not integrated-release ready until this executor candidate passes independent review and root records acceptance.

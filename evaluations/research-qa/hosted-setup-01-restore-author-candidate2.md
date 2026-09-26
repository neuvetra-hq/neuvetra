# HOSTED-SETUP-RECOVERY-01 — Candidate2 author handoff

2026-09-26. Requested gpt-6-astra/high; observed compute and cost unknown. Candidate2 is ready for separate independent review, not approved for hosted recovery or migration.

## Preserved failures and corrections

Candidate1 independently failed with two P1 false acceptances. `hosted-setup-01-restore-independent-review.md` and `hosted-setup-01-restore-independent-native.ts` remain unchanged: distinct PostgreSQL numeric/JSONB values collapsed through JavaScript number decoding, and granted views were omitted from preservation/access checks. The original author pass was inadequate for those cases. This repair does not relabel that review as passed.

Candidate2 changes only `tools/staging/hosted-setup-restore-core.ts`. The other three helper files remain byte-identical. The paired API, DPAPI transport, Auth dependencies, durable reservations, absent-target local restore, role checks, and exclusions are unchanged. No hosted transport was added.

- The recovery-specific table capture replaces every legacy content digest with SHA-256 over `to_jsonb(t)::text` returned as text by PostgreSQL. It sorts complete row strings and per-row hashes while retaining multiplicity and empty tables. Tenant probes use the same lossless text; only company identifiers and key-presence flags are extracted separately by SQL. No JSON numeric value passes through JavaScript Number for a preservation or tenant-row digest. Historical shared `m78-inventory.ts` is unchanged; its catalog capture remains a dependency, and its original content digests are replaced before returning the Candidate2 state.
- The recovery profile is now `neuvetra.hosted-setup.recovery.v2`; states declare `rowEncoding: postgres-jsonb-text.v1`. Old v1/unversioned bundles fail closed and cannot inherit the corrected guarantee.
- A complete `pg_class` relation-kind gate runs before capture. Only ordinary non-inherited tables, indexes, and sequences are supported. Views, materialized views, foreign tables, partitioned tables/indexes/partitions, inheritance participants, and other unsupported relation kinds fail with `HS_RECOVERY_UNSUPPORTED_RELATION_SURFACE`. There is no blanket view-security claim: this candidate refuses views, including safe views. It does not call a foreign relation before rejecting it. Unsupported source relations fail before dump; unsupported restored relations fail before preservation acceptance. Future support requires explicit catalog/access coverage and review.

## Native evidence actually exercised

`bun evaluations/research-qa/hosted-setup-01-restore-author-candidate2-native.ts` passed on a new disposable loopback PostgreSQL17 cluster with an actual exported-snapshot custom dump, CurrentUser DPAPI seal/unseal and absent-target restore. The harness completed **29 named checks**, retained synthetic temporary files outside the repository and stopped its own cluster in `finally`.

The native regressions separately changed stored numeric and nested JSONB integers from 9007199254740992 to 9007199254740993, changed adjacent 30-decimal-place numeric and nested JSONB fractions, and removed one of two identical rows. Exact text readback was used; both preservation and tenant-row digests detected the drift. Restoring baseline values restored a passing comparison. A granted owner-security view demonstrably returned two rows to the outsider; capture refused the original view and its changed definition. Materialized, partitioned, inherited and foreign relations were separately created and refused. The foreign wrapper has no handler and opens no external connection. A source-side granted view was refused before the supplied dump callback ran.

The prior adversarial cases were rerun in Candidate2: wrong receipt/archive hashes and bytes, wrong target/role, old unpaired archive, occupied target, consumed journal replay, role-attribute drift, changed sequence/policy/tenant evidence, removed empty table, and direct native history-row readback. Synthetic source includes two tenants plus outsider; production pre-upgrade requirement remains every existing represented member-company plus outsider, not creating a new company.

Candidate2 initially had two author-native failed attempts after the new pristine restore and first numeric-drift check. The test's baseline reset bound a JSON string directly as `jsonb`, causing driver encoding to change it into a JSON string value. Diagnostic output was limited to safe check names. Explicit `text::jsonb` and `text::numeric` fixture casts repaired that test input; the final complete run passed. This failure history is retained, separate from Candidate1's substantive independent failures.

`bun test evaluations/research-qa/hosted-setup-01-restore-author-candidate2.test.ts` exercises target/actor/error contracts and v1/encoding refusal: **4 passed, 0 failed, 13 expectations**.

## Limits and next owner

Root must arrange independent re-review of these exact Candidate2 bytes, then separately review the real source transport and local role plan. No hosted credentials, provider connection, real archive, Git or operations ledger was touched. Backup transport endpoint/TLS/tool/snapshot arguments remain the caller's trusted boundary; the previous automatic-review rejection of a hosted wrapper remains recorded in the Candidate1 handoff, and was not bypassed. Root owns that separate workstream.

A snapshot is a consistent historical view, not proof of current-world freshness. Root must establish the quiet interval, fresh source/stage observations and exact reviewed upgrade gate. Auth recovery remains UUID/UID-function stubs only; provider accounts/sessions/storage are excluded. PostgreSQL row text preserves PostgreSQL JSONB's stored numeric representation; it does not recover lexical JSON that PostgreSQL already normalized at ingestion. Unsupported relation types require a future reviewed extension, not normalization or a waiver. Full API/storage/export/job tenant testing and the hosted board demonstration remain separate.

Freeze manifest: `hosted-setup-01-restore-author-candidate2-hashes.json`. It binds the four helper files, Candidate2 tests/handoff, and read-only legacy inventory dependency. Original Candidate1 and QA files are not overwritten. Root owns publication and status.

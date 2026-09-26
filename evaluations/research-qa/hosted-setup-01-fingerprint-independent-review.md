# HOSTED-SETUP-FINGERPRINT-QA-01 — independent review

2026-09-26. **FAIL. FINGERPRINT-QA-F01 [P1] must be resolved before using this candidate to establish an accepted source fingerprint.** The author suite passes, but a native inter-snapshot policy change is falsely accepted with tenantControlsVerified and applicationCatalogEquivalent both true.

Reviewer: /root/hosted_recovery_qa, independently dispatched critical Head of QA, no authorship of product implementation or author test. Requested gpt-6-astra/high; inherited observed settings and resource costs unknown. Read the QA role, board brief, accepted actual-restore review, Candidate3 recovery and Candidate2 upgrade evidence. This task used only synthetic fixtures and fresh temporary clusters on dynamically allocated ports excluding55479. No actual private archive, retained actual clone, hosted/provider connection, ENV export, Git, shared ledger or product file was used or modified.

## FINGERPRINT-QA-F01 [P1]: second catalog capture can certify a changed access policy

Location: tools/staging/hosted-setup-fingerprint-derivation.ts:176–195, especially line189; resulting affirmative claims at lines204–206.

The first capture at line176 runs captureRestoredState in its own read-only repeatable-read transaction and asserts complete preservation against the historical snapshot. That transaction ends. The call at line189 starts a separate snapshotHostedSetupDatabase transaction. The checks between the two returned representations cover row hashes, roles/memberships, default ACLs and sequence state; they do not bind the second capture's policies, functions, triggers, table flags or other catalog definitions to the already accepted recovery state. Lines197–198 adopt the entire second catalog into the expected source fingerprint.

A committed catalog change during this gap can therefore alter the expected fingerprint while retaining affirmative claims derived from the earlier state. This is a local consistency defect, distinct from the correctly disclosed absence of current hosted evidence.

### Native reproducer and observed result

The independent test reuses the frozen author's synthetic fixture setup to avoid changing its receipt, DPAPI, actual dump/restore or exact22-migration assumptions, then adds a new writer interleaving. No fabricated recovery-state or fingerprint return value is used for this regression.

1. Create a fresh native PostgreSQL17.11 source with precise numeric/nested JSONB data, member/outsider RLS, sequence state, one application default ACL and27 external ACL rows.
2. Run the actual paired synthetic backup, DPAPI unseal and absent-target local restore. Pristine derivation passes.
3. Start another derivation with the production first capture unchanged. Its snapshot hook opens a separate actual connection immediately before invoking the real production snapshotHostedSetupDatabase function.
4. That writer commits ALTER POLICY precise ON neuvetra.precise_records USING (true), then closes.
5. The real second capture completes. Derivation returns successfully.
6. A fresh restricted outsider connection directly reads **one row** from precise_records. The regression expects refusal and fails because acceptance is true.

Observed fingerprints:
- Before policy change: ed60b721143c09306608d05707a1386287da8b39d7bffab2937d3ce9402a6a8e.
- Accepted changed fingerprint: 1a2f31b6f2ed9f4ad033f3c034fa1e43c0a234e05c988c7495fb0326fd7ed616.
- Returned tenantControlsVerified:true, applicationCatalogEquivalent:true, sourceCurrentnessObserved:false.

The dependency hook only deterministically schedules a real independent writer in the production transaction gap; it does not invent an otherwise impossible database result. A quiet caller might avoid the interleaving, but no continuously held local write gate is required or evidenced by this API.

Required repair: bind recovery preservation and the complete returned fingerprint catalog to the same verified transactional snapshot, or enforce and verify a concrete immutable local-clone/write boundary that prevents this gap. Comparing only the currently selected fields is insufficient. Ensure the repair covers every returned catalog component and preserves sequence-currentness limitations; sequences still need appropriate quiet-writer controls. Re-run this native regression and the existing precision, sequence, ACL, identity and unsupported-relation checks. Preserve this FAIL and its first result.

## Passed checks and execution evidence

Workdir: C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra. Bun1.3.12; native postgres --version independently returned17.11.

| Execution | Result |
| --- | --- |
| bun test tools/staging/hosted-setup-fingerprint-derivation.test.ts | 6 pass,0 fail,1 native skip,17 expectations |
| Same author test with HOSTED_SETUP_FINGERPRINT_NATIVE=1 | 7 pass,0 fail,28 expectations |
| bun test evaluations/research-qa/hosted-setup-01-fingerprint-independent.test.ts with the same synthetic-test flag | 10 pass,1 fail,42 expectations |

Independent added passing cases reject:
- Reordered, duplicated, renamed and ACL-modified external rows with recomputed snapshot/receipt/restore-result pins while retaining the independently supplied external-row digest.
- Reordered and duplicate external rows even after recomputing that external digest, through the canonical ordering/unique owner-schema-kind checks.
- Second-snapshot runtime-role drift, changed application default ACL, sequence is_called drift and a changed precise-row digest.
- Wrong database identity and a non-loopback address.

The rerun author cases additionally exercised native sequence-value drift and an actual owner-security view exposing one outsider row before the unsupported-relation refusal; forged receipt pins, forged migration-authorized restore result, numeric/role drift and noncanonical JSON were refused. Exact first22 receipt checks and explicit false currentness/authorization flags remain useful but do not fix F01.

The failed independent test still executed its finally cleanup. Its dynamically selected port was63050, and exact postmaster.opts bound it to C:/Users/nimab/AppData/Local/Temp/hosted-setup-fingerprint-native-lgfhsz/data. A separate exact pg_ctl status returned3/no server; OS listener count on63050 was0. Synthetic data/journals remained retained. No cluster on55479 was started or touched.

## Exact reviewed bytes

All three submitted candidate hashes matched before execution and at completion. The five listed dependency hashes also match the accepted baseline.

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-fingerprint-derivation.ts | 2e3149e2809ddb17efa979a66de2bd5ebbad73d4932787f14eb79f0a2cce41e9 |
| tools/staging/hosted-setup-fingerprint-derivation.test.ts | 43a098998f4299ba4aa5be69ceba06d5c57ac34fda42d57594491879227d9dba |
| evaluations/research-qa/hosted-setup-01-fingerprint-derivation-author.md | e24aa84d86187284a03c1e396cbaab07f9f4a8da4929ff5736caab3c13b9c3ed |
| tools/staging/hosted-setup-restore-core.ts | 3add141768b2bde620627148bba5311c8689f19cf078ad8b23fe51417d92fc6b |
| tools/staging/hosted-setup-backup.ts | 4ceeddd0f8e1021e5f65492b30ee08dc21fab409b5b01f8e40cbf26c5f74e66f |
| tools/staging/hosted-setup-restore-io.ts | 6eb5f90da057e302bbc8ad91c81933e748ce8705b699bed53838aba5d451da71 |
| tools/staging/hosted-setup-upgrade.ts | 2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c |
| tools/staging/m78-inventory.ts | ea93686812910082438bf8ecfd9ef8756dddd6048897d369a494e0fdd700f40a |
| evaluations/research-qa/hosted-setup-01-fingerprint-independent.test.ts | d4c5c8d78eee9b9377f8ee46d20678417e51d898f7a7f58bb6696dca43b81ea7 |
| evaluations/research-qa/hosted-setup-01-fingerprint-independent-result.json | 948c478e0c13e4943e1f4ec8d0f4a2d4f6a5533a58df568e1f2d833afe7350e8 |

## Limits and handoff

Exact byte pins and self-consistent receipts are integrity checks, not independent source approval or authenticity. A caller who replaces all evidence and pins can construct a different internally consistent history; the future concrete verifier must bind pins,27-row external ACL digest and derivation to the corrected actual-restore observation and independent acceptance. This function does not decrypt its supplied archive itself; that plaintext-to-encrypted pairing depends on accepted prior unseal evidence. The intentionally injectable dependencies likewise require a trusted reviewed caller.

A repaired historical derivation still cannot claim the hosted database remains current. Exact live source/project/schema/fingerprint comparison under a continuously held writer gate, immutable reviewed migration bytes, publication proof, no-replay journal, postcommit validation, provider/Auth/storage exclusions and deployment remain separate integration gates. QA did not perform those operations or authorize migration. Prior actual-restore acceptance remains unchanged; this FAIL concerns the new derivation implementation.


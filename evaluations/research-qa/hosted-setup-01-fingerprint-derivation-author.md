
# HOSTED-SETUP-FINGERPRINT-01 — author handoff

2026-09-26. **Candidate ready for independent QA of the bounded local derivation only. It does not establish current hosted state and does not authorize migration.**

Author: `/root/hosted_upgrade`, software-engineering role under CTO. Requested compute was gpt-5.6-sol/high; observed model, effort, token use and cost were not exposed. Work used only the rolling PR6 worktree. No hosted source, provider, actual archive, secret, ENV export, Git, deployment, migration, shared status or board file was read or mutated.

## Delivered boundary

`tools/staging/hosted-setup-fingerprint-derivation.ts` derives the expected schema-22 `HostedSetupFingerprint` SHA-256 from an independently produced local restore and four caller-pinned byte artifacts:

1. the exact compact plaintext Candidate3 snapshot;
2. the exact pretty-line Candidate3 receipt;
3. the exact encrypted archive bytes; and
4. the exact pretty-line local restore result.

There are no default artifact pins. The function checks every supplied byte digest, exact JSON serialization and exact top-level key set. Candidate3 `validateBundle` then verifies the snapshot/receipt/dump/state binding. The restore result must remain `hostedMigrationAuthorized:false`, bind the exact receipt bytes and bind both the source and recaptured restored-state hashes.

The local clone must be PostgreSQL 17 on loopback, have the exact restore-result database identity, carry the fixed project/profile, and have exactly the first 22 current migration receipts. The derivation recaptures Candidate3 state and the Candidate2 upgrade fingerprint. It compares lossless PostgreSQL `to_jsonb(t)::text` row hashes, roles, memberships, application/global default ACLs and sequence `last_value/is_called`. Candidate3 and Candidate2 both refuse every neuvetra view, materialized view, foreign table, partition or inheritance surface.

The source snapshot must contain exactly 27 external-schema default ACL rows and they must match a separately supplied SHA-256 with no default. Only after proving that the restored clone contains no external default ACL rows and that its application/global ACLs equal the source subset does the derivation replace the local fingerprint's default ACL array with the full receipt-bound source array. The returned expected fingerprint hash therefore represents the full source catalog boundary while application rows and catalog come from the independently restored clone.

The result deliberately records:

- `sourceCurrentnessObserved:false`
- `liveHostedPreflightRequired:true`
- `independentReviewRequired:true`
- `upgradeAuthorized:false`

A later live schema-22 preflight must compare the full current hosted fingerprint to the independently accepted derived hash while the write gate is held. This derivation does not infer that the hosted source stayed unchanged after the historical exported snapshot.

## Focused and native evidence

- Focused Bun run: **6 pass, 0 fail, 1 native skip, 17 expectations**.
- Native run with `HOSTED_SETUP_FINGERPRINT_NATIVE=1`: **7 pass, 0 fail, 28 expectations**, PostgreSQL **17.11**, 4.18 seconds in the final frozen run.
- Focused TypeScript compilation of the implementation and test: pass with no diagnostics.

The native case starts a fresh PostgreSQL cluster on a dynamically selected loopback port that is explicitly rejected if it equals 55479. It creates one synthetic company plus an outsider, exact first-22 receipts, a high-precision numeric/JSONB row, `fugitive_audit_sequence_seq`, one application default ACL and 27 external-schema default ACL rows. It performs the actual Candidate3 exported-snapshot paired DPAPI backup and PostgreSQL custom dump, restores into an absent database, independently recaptures Candidate3 state, and derives the expected fingerprint.

Negative cases cover forged receipt bytes, a re-pinned forged restore result, missing and changed external ACL evidence, role drift, high-precision row drift, sequence `last_value` drift, noncanonical JSON, wrong clone identity and unsupported relations. The native view case first proves a granted owner-security view returns one row to the outsider, then proves derivation refuses the relation surface.

Two earlier native attempts timed out before a verdict. The first fixture process-control implementation drained `pg_ctl` pipes that remained inherited by the server; process control was corrected to use ignored streams. A later diagnostic reused one max-one connection across multiple independent observations and reached the test transaction idle timeout. The final fixture opens a fresh clone connection for each bounded one-time observation, matching the intended one-shot derivation use. Each final cluster stopped in `finally`; no port 55479 fixture was launched.

## Exact candidate bytes

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-fingerprint-derivation.ts` | `2e3149e2809ddb17efa979a66de2bd5ebbad73d4932787f14eb79f0a2cce41e9` |
| `tools/staging/hosted-setup-fingerprint-derivation.test.ts` | `43a098998f4299ba4aa5be69ceba06d5c57ac34fda42d57594491879227d9dba` |

Reviewed dependencies observed unchanged for this candidate:

| Dependency | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-restore-core.ts` | `3add141768b2bde620627148bba5311c8689f19cf078ad8b23fe51417d92fc6b` |
| `tools/staging/hosted-setup-backup.ts` | `4ceeddd0f8e1021e5f65492b30ee08dc21fab409b5b01f8e40cbf26c5f74e66f` |
| `tools/staging/hosted-setup-restore-io.ts` | `6eb5f90da057e302bbc8ad91c81933e748ce8705b699bed53838aba5d451da71` |
| `tools/staging/hosted-setup-upgrade.ts` | `2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c` |
| `tools/staging/m78-inventory.ts` | `ea93686812910082438bf8ecfd9ef8756dddd6048897d369a494e0fdd700f40a` |

## Open integration and QA gates

This candidate intentionally did not read or bind the retained actual archive/clone. The future accepted-restore verifier must bind the derivation artifact to the exact corrected actual-restore v2 observation and its independent review, along with their exact byte pins. A restore-result assertion alone is not an independent acceptance. The external-default-ACL digest must be independently derived from those same accepted source bytes; an operator-entered digest without source/review binding must fail closed.

Independent QA should rerun both focused and native cases, inspect exact source closure, and challenge a source snapshot with 27 reordered, duplicated, renamed or ACL-modified external rows. It should also verify that later live preflight compares the full current fingerprint and cannot relabel this historical derivation as currentness evidence.

For migration-source immutability, the safest concrete integration is to normalize and hash the full migration manifest once, keep that exact in-memory manifest (including SQL bytes) as the sole migration input, and bind it to independently verified exact remote head and source-closure receipts before entering the one-time operation. `migratePrivateStaging` currently rereads migration SQL from disk, so wrapping that reread with a hash check still leaves a change window. The one-time path should execute the already reviewed in-memory entries and reject any attempt to reread or reconstruct them. The same in-memory object/hash must drive preflight receipts, execution and postcommit receipt validation. This is an open source-lock integration requirement and was not changed by this candidate.

A focused root-level ESLint invocation was attempted but did not run because this repository has no root eslint.config file; configs exist only in individual web apps and do not cover these staging tools. This is recorded as an unavailable check, not a pass. The focused TypeScript compilation and Bun tests are the applicable completed checks.

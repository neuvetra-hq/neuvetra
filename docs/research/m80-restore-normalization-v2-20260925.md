# M80 restore normalization v2 candidate

Date: 2026-09-25. This is an additive, offline repair candidate for the metadata mismatch found after the first actual application-only backup restore. It is not an accepted repair, an actual-archive rehearsal result, a migration intent, or authority to change schema, admit a company, deploy, or operate against hosted infrastructure.

The accepted Backup Candidate 3 files, snapshots, journals, encrypted archive, failed disposable clone, preparation sources and executor sources were not changed. No hosted database, provider, environment export, credential, network, Git, admission or deployment action occurred.

## Bounded repair

The new core performs two separate comparisons and keeps their hashes distinct:

1. **Hosted source to disposable schema-21 restore.** It retains all global default-ACL rows represented by schema `*` and all `neuvetra`-scoped rows, validates every default-ACL row, sorts retained rows with deterministic code-unit comparison and requires them to match exactly. A restored external-schema ACL is refused. Source external-schema-specific ACLs may be excluded from only this application-equivalence comparison. Internal triggers are compared as a canonically sorted semantic multiset with exact duplicate count. Content and every other inventory, ACL/RLS, function, object, sequence, role, membership, dependency and migration-receipt component remain exact.
2. **Disposable schema 21 to schema 22 in the same database.** This path uses the raw restored state. It retains the original exact migration delta checks, requires raw default ACLs to stay byte-semantically equal and adds trigger multiset subtraction so losing one occurrence of a duplicated old internal trigger fails. Only new internal triggers whose constraint table is one of the six reviewed schema-22 tables may remain after subtracting every old occurrence.

Raw source/restored application-state and metadata hashes remain explicit. Normalized metadata hashes are separate fields. A normalized hash is never used as a source application-state hash, target-state hash or same-database migration hash.

Before issuing any proof, the v2 core recomputes both raw content hashes from table row hashes plus migration receipts, both raw metadata hashes from the exact unnormalized metadata projections, and both application-state hashes from their raw content and metadata hashes. A caller cannot substitute a coordinated-looking raw hash string and have the proof echo it.

Malformed default-ACL rows fail closed. The accepted shape requires the exact keys `acl`, `kind`, `owner`, and `schema`; nonempty owner and schema identifiers of at most 63 UTF-8 bytes with no NUL; a supported PostgreSQL default object kind; and a nonempty ACL value with no NUL. The literal schema `*` is retained conservatively because the inherited query also represents a global ACL with `*`.

Child-process stderr is consumed but never copied to receipts, journals or public output. Failures emit only bounded `M80_V2_*` codes. Every rehearsal gets a fresh database name and new exclusive directory; no helper drops, resets, overwrites or reuses a database or journal.

The runtime boundary now proves all six new tables grant `SELECT` and deny `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` to `neuvetra_runtime`; the new sequence denies `SELECT`, `USAGE`, and `UPDATE`. Its live write probe is the semantically valid no-op `DELETE ... WHERE false`, and only PostgreSQL SQLSTATE `42501` counts as permission denial. Constraint errors, connection failures and missing error codes refuse the rehearsal.

## Versioned receipt contract

The normalization receipt profile is `neuvetra.m80.foundation-restore-normalization-proof.v2`. Its exact fields are:

- `profile`, `completedAt`, `disposableDatabaseName`, `sourceBackupReceiptSha256`
- `sourceContentSha256`, `restoredContentSha256`
- `sourceRawApplicationStateSha256`, `restoredRawApplicationStateSha256`
- `sourceRawMetadataSha256`, `restoredRawMetadataSha256`
- `sourceExternalDefaultAclRowsExcluded`, `restoredExternalDefaultAclRows`
- `scopedDefaultAclRowsExact`
- `sourceInternalTriggerRows`, `restoredInternalTriggerRows`
- `internalTriggerSemanticMultisetExact`, `allOtherInventoryMetadataExact`
- `sourceNormalizedMetadataSha256`, `restoredNormalizedMetadataSha256`, `normalizedMetadataExact`

The preservation receipt profile is `neuvetra.m80.foundation-hosted-preservation-receipt.v2`. Its exact fields are:

- `profile`, `completedAt`, `disposableDatabaseName`, `sourceBackupReceiptSha256`
- `normalizationProof: { path, sha256 }`
- `sourceContentSha256`, `restoredContentSha256`
- `sourceRawApplicationStateSha256`, `restoredRawApplicationStateSha256`
- `sourceNormalizedMetadataSha256`, `restoredNormalizedMetadataSha256`
- `oldContentExact`, `applicationMetadataEquivalent`, `rawMetadataHashesEqual`

The normalized proof requires restored external ACL count zero, exact scoped ACLs, exact trigger semantic multiplicity, exact remaining metadata, exact content, and equal normalized metadata hashes. `rawMetadataHashesEqual` is descriptive and may be false after a valid application-only restore; it cannot replace the proof.

The schema-21 restore receipt and schema-22 migration rehearsal receipt retain their accepted v1 profiles because their semantics did not change. The new preservation v2 receipt replaces the v1 preservation claim; it does not reuse `oldMetadataExact` for a normalized comparison.

## Author verification

Pure/native-boundary tests passed 10 tests, 40 assertions. They cover external ACL omission, global and application ACL refusal, literal `*` retention, null/empty/NUL/overlength/extra-key ACL refusal, trigger permutation, omitted/changed/extra/duplicate triggers, duplicated old-trigger loss during migration, expected new-table triggers, other metadata changes, content changes, raw hash forgery, the exact table/sequence privilege matrix and permission-code discrimination. Targeted TypeScript checking and a Bun production bundle pass.

Three isolated synthetic native attempts were retained:

- `m80_backup_foundation_1790304796547` failed because the new test expected registry status `held` while the accepted migration uses `held_candidate`.
- `m80_backup_foundation_1790304843177` failed because the new test set an unused actor setting instead of the inherited JWT subject claim.
- `m80_backup_foundation_1790304944838` passed schema-21 custom-dump restore, exact application equivalence, raw schema-21-to-22 preservation, four `held_candidate` rows, forced RLS, runtime SELECT-only access, direct-write denial and zero operator admission. Its exclusive directory is `.superpowers/m80-backup-v2-rehearsal-1790304944838`.
- `m80_backup_foundation_1790305760489` passed the Candidate 2 successor with recomputed raw hashes, exact table/sequence privileges and the SQLSTATE-specific no-op write denial. Its exclusive directory is `.superpowers/m80-backup-v2-rehearsal-1790305760489`.

The two author failures were in new assertions after restore and migration completed. Their clones and append-only journals remain retained; neither was retried or rewritten. Candidate 1 then failed independent review because its write probe treated every error as denial and its exported proof API did not independently recompute raw hashes. Candidate 2 repairs both findings. The passing source is a local synthetic schema-21 source with zero default-ACL rows, so it does not constitute the required actual-archive proof of 27 excluded external rows.

## Compatibility map

| Consumer | Required successor behavior |
| --- | --- |
| Backup capture and encrypted archive | Keep the accepted v1 raw snapshot, raw source application-state hash, custom dump and encrypted archive formats. Collect a new backup if freshness is required; never rewrite a timestamp. |
| Restore | Keep the v1 restore receipt. Add and pin the normalization v2 receipt and preservation v2 receipt from the same completed rehearsal. |
| Preparation | A separate versioned successor must read and validate both v2 receipt files and their byte pins; bind identical completion time, database, backup receipt, content, raw hashes and normalized hashes; accept `rawMetadataHashesEqual` only as a boolean while requiring application equivalence. |
| Once-only journal | The versioned preparation/once consumer must retain the exact existing operation-scope formula and deterministic intent/outcome paths. New receipt versions cannot reset or bypass historical locks. |
| Bundle composer | A later versioned composer must require the accepted versioned preparation plan/gate/intent and cannot translate v2 proof facts into v1 `oldMetadataExact`. |
| Hosted executor | A later accepted successor must keep raw state capture, target/gate hashes, the durable raw migration-source receipt and raw same-database default-ACL comparison. It must also apply the exact old-trigger multiset subtraction during migration observation and reconciliation. Normalized hashes cannot be target or application-state hashes. |

Current Prep Candidate 6 and Executor Candidate 9 do not understand these v2 receipts and therefore cannot authorize a live sequence using this candidate. Their accepted bytes remain historical evidence. Consumer integration and independent review are separate gates.

## Frozen dependencies and candidate source pins

- accepted Backup Candidate 3 snapshot: `d29eb944ce0db89d30258ff514c8c3226b518bf59fd669d7e09b2040b8c8431d`
- accepted backup core: `01e88cafc1eb9f1613589d09e3dcfc20ba7c45f93c5321959fdd72cf371aaa2f`
- accepted local rehearsal: `ecce35bd3f96e642511e6630db30618b65455a7f0468d24ae9f29af44aa9d4ee`
- accepted seal helper: `85358f1512a092b885ac5db00bc3f4afb698cbbc38836aed9a73715fb3c55f23`
- independently accepted diagnosis review: `03a86604d440ae53d2841b4a4bd606b863c6974eb83c9cf1f21893282a041697`
- independent integration-boundary memo: `2ff91bf1edae62c9466b36226e8cefe10184a1accc2acc52a7bec4627f95a010`
- `.superpowers/m80-backup-v2-core.ts`: `5580afe97449038a4d5a693e2fe7fa2c5aa0f38595a68af32354bc064d9af36e`
- `.superpowers/m80-backup-v2-core.test.ts`: `1524c86d790fdfb4cf93fe07553473c1245645db665550594c77c0409a78f2a7`
- `.superpowers/m80-backup-v2-rehearsal.ts`: `abcfb2cc929ccbd1d0431d9d61a3df36a54934b607f01bdf757445c652872b4a`

The candidate source pins above require independent current-byte verification. No actual archived backup was opened or restored by this candidate run. A new disposable actual-archive rehearsal may occur only after source acceptance and must write a new exclusive directory and clone.

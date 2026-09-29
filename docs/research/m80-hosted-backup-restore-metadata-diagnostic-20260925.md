# M80 hosted backup restore metadata diagnostic

Date: 2026-09-25. This is a sanitized, read-only diagnostic of the first actual hosted application-only backup restore. It is not a repair, rehearsal pass, migration authorization or schema-22 result.

The exact encrypted archive SHA-256 `cad84e68dac90cb703814f9ff10bb116c615ebe13c860f54d630910ece8483fd`, backup receipt SHA-256 `d0d235e14266b87d19a92fc410574ae91196529521521e816fec713518a9e0ae`, and decrypted snapshot SHA-256 `cdcf897468466a05897b745784e8057cec18ed999f3bb7ffa733d8425b0cb270` were already fixed by the failed rehearsal. The archive was unsealed only in memory with the accepted DPAPI helper. The retained disposable local clone was inspected in a repeatable-read, read-only transaction. No decrypted snapshot, identifier, account value, credential or row value was written to this report or snapshot.

The archive, receipt, failed clone, failed exclusive journal and accepted Candidate 3 files were not modified. No hosted, provider, network, Git, migration, admission or deployment action occurred.

## Finding

The application restore is content-exact. The source and restored content SHA-256 are both `65d68c06c843da60841902a8fe0d3b8c9ff9131d1dc8edaad3a05035545f25c7`. Table inventory, row hashes, migration receipts, table ACL/RLS state, schema ACL, functions, table objects, sequences, roles, memberships and external dependencies also match exactly.

The raw metadata hash differs for exactly two reasons:

1. **Out-of-scope default privileges.** The hosted database snapshot contains 27 `pg_default_acl` rows. Every one is scoped to a schema outside `neuvetra`; none is global. The application-only dump intentionally contains only the `neuvetra` schema, so the disposable restore contains zero of those provider-schema rows. When both sides are limited to global default privileges plus privileges scoped to `neuvetra`, they match exactly. External schema-specific defaults cannot affect object creation in `neuvetra` and are outside the documented provider-recovery boundary.
2. **Generated trigger ordering.** Both sides contain 998 internal-trigger semantic rows. Their canonical semantic multisets, including multiplicity, are identical. Their array order differs because the query orders by generated internal trigger names and then removes those names and definitions before hashing. Restore creates new internal trigger identifiers, so identifier order is not a stable semantic order.

The differing metadata and application-state hashes therefore do not identify lost application metadata. The accepted validator still behaved correctly by failing closed on facts it had not been reviewed to normalize. The failed rehearsal remains failed.

## Why local review did not expose it

The retained local schema-21 QA source contains zero default-ACL rows, matching its fresh local restore. It therefore did not exercise a provider database with unrelated schema-specific default privileges. The local dump and restore also happened to satisfy the raw internal-trigger ordering check during the pre-migration comparison; the test suite did not deliberately permute generated internal-trigger identifiers while keeping the semantic multiset fixed.

The helper's child-process wrapper reads child stderr but discards it and reports only `Private child process failed.` This did not cause the metadata mismatch, because restore completed and schema 21 verification passed, but it made the failure less diagnosable. Any successor should record a bounded sanitized stage/error code in its private exclusive journal without copying database output or secrets.

## Minimum repair proposal

Preserve Candidate 3 and its journals unchanged. Implement a versioned successor with one explicit application-metadata normalization function used symmetrically for source and restored states:

- retain default-ACL rows only when `schema` is `neuvetra` or `*` (global), and sort them canonically;
- strip generated internal-trigger name and definition fields as today, then sort the remaining semantic rows canonically while preserving duplicate count;
- leave every other metadata component unchanged and exact.

The restore gate must additionally prove the raw difference is confined to those two reviewed categories:

- every omitted source default-ACL row is schema-specific and outside `neuvetra`;
- neither side has an omitted global or `neuvetra` default-ACL row;
- internal-trigger counts and canonical semantic multisets are identical; and
- content and all other metadata components remain byte-semantically exact.

A successor preservation receipt may call normalized source/restored metadata hashes equal only after those checks pass. It must keep exact content hashes, old-table inventory, migration receipts, ACL/RLS, function, sequence, role, membership and dependency checks. It must not import provider schemas into the application-only dump or recreate provider default privileges in the disposable database.

Required independent challenges include a permuted trigger order that passes; a missing, added or changed semantic trigger that refuses; an external schema default-ACL row that is explicitly classified out of scope; and any global or `neuvetra` default-ACL mismatch that refuses. The actual pinned archive must then be restored into a new disposable database and new exclusive rehearsal directory. The retained failed clone and journal cannot be reused or overwritten.

No migration intent or schema-22 action may follow until the versioned repair and actual fresh rehearsal pass independent review. If the existing backup receipt is no longer fresh enough for the accepted preparation chronology, root must collect a new backup rather than relabel its timestamp.

## Reviewed source pins inspected

- `.superpowers/m80-backup-core.ts`: `01e88cafc1eb9f1613589d09e3dcfc20ba7c45f93c5321959fdd72cf371aaa2f`
- `.superpowers/m80-backup-local-rehearsal.ts`: `ecce35bd3f96e642511e6630db30618b65455a7f0468d24ae9f29af44aa9d4ee`
- `.superpowers/m80-backup-seal.ps1`: `85358f1512a092b885ac5db00bc3f4afb698cbbc38836aed9a73715fb3c55f23`
- `tools/staging/m78-inventory.ts`: `ea93686812910082438bf8ecfd9ef8756dddd6048897d369a494e0fdd700f40a`
- `tools/staging/m73-common.ts`: `a47f8904fab503272173e3db8f39144f52d3b3d4eb14da03784349ac88466ab7`
- accepted Backup Candidate 3 snapshot: `d29eb944ce0db89d30258ff514c8c3226b518bf59fd669d7e09b2040b8c8431d`


# Running independent M75 checks

These checks are reviewer authored. M75 production/UI/backend/operators were authored by other agents. The native fixture population helper is author-owned setup, not the test oracle. Do not run against hosted or customer databases.

## Pure and browser decoders

From repository root with installed workspace dependencies:

```text
bun test evaluations/research-qa/m75-independent-classification.test.ts evaluations/research-qa/m75-independent-renderer.test.ts evaluations/research-qa/m75-independent-decoder.test.ts
```

The retained `m75-independent-native-proof.json` contains synthetic historical M71/M74 bytes; decoder tests need no database and make no network calls.

## Isolated native lifecycle and direct SQL

Requires the repository's synthetic PostgreSQL test cluster on127.0.0.1:55463, operator role `m63_test_admin`, runtime role `neuvetra_runtime`, Python, and an explicitly selected synthetic template. There are no passwords or hosted credentials. The scripts create new `m75_qa_*` databases; they never mutate the template. Existing migration receipts must match exact repository migration bytes; missing migrations are applied only to the new clone.

Set `M75_QA_TEMPLATE=m63_integration` for the CI baseline. The local historical default is `m74_ops_restore17_1789509920941`. Both fixtures are populated with new synthetic actors/company; no retained local company/actor UUID is required.

```text
M75_INDEPENDENT_NATIVE=enabled M75_QA_TEMPLATE=m63_integration bun test evaluations/research-qa/m75-independent-native.test.ts
M75_QA_TEMPLATE=m63_integration bun run evaluations/research-qa/m75-independent-direct-sql.ts
bun run evaluations/research-qa/m75-independent-sql-parity.ts
```

Use platform-appropriate environment assignment in PowerShell. The native lifecycle uses a four-connection pool and explicit awaited error handling. The direct SQL script forces rollback after every attempted function call, including valid controls, and checks retained version counts. It exits nonzero for any invalid admission or rejected positive control. It is a real database boundary check, not a mocked HTTP test. Both produce reviewer-owned JSON evidence files. The lifecycle also refreshes the fully synthetic browser fixture.

The SQL parity script reads the independently created direct-probe clone name from its result file, rejects a migration-hash mismatch, and runs reviewer-chosen classification scenarios against native SQL roster findings/reconciliation/renderer. It also compares escaped markup and literal template/replacement markers. It does not create a database or write application data.

## Actual component transitions

Run the local component server from repository root:

```text
bun run evaluations/research-qa/m75-ui-server.ts
```

In a second terminal:

```text
node --experimental-strip-types evaluations/research-qa/m75-independent-ui.ts
```

The server bundles the actual React component and imported application modules in memory and serves only127.0.0.1:55675. The test resolves Playwright from the existing FrontDesk dev dependency. On Windows it uses installed Chrome; other platforms use the installed Playwright Chromium runtime. `M75_BROWSER_EXECUTABLE` may explicitly select an installed executable. No Auth/provider/host connection is used. All workspace HTTP is intercepted with the synthetic fixture. Shut down the server after testing. This local component check does not prove hosted Auth, persistence, print appearance or physical/PDF output.

## Recovery comparison

```text
bun run evaluations/research-qa/m75-independent-recovery.ts SOURCE_SYNTHETIC_DB RESTORED_SYNTHETIC_DB evaluations/research-qa/m75-recovery-result.json
```

Only names matching the script's local fixture allowlist are accepted. Both targets are read-only. The collector independently compares all application rows, retained text values, definitions, policies and ACLs; it does not use operator recovery/inventory code as its oracle. Compare the exact final candidate after restoration, and record limitations of same-cluster role observations. This command does not itself execute the restore or decrypt a backup.

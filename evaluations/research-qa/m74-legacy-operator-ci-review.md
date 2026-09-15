# M74 legacy operator CI correction — independent review

2026-09-15. Reviewer `/root/m74_cto`; root authored the test correction and owns publication. Requested critical Astra/high; observed settings remain unknown in reused context. This reviewer previously authored the M74 technical contract and QA artifacts, not the M73 operator helper or this test change.

**Pass.** The test now expects the frozen M73 helper to refuse repository manifests newer than16 for both requested schema15 and16, before any database query. The independent baseline15 digest and SQL16 pin remain checked. No helper, SQL, product behavior or existing M74 acceptance record changed.

The original failure was independently reproduced:3 tests passed,1 failed because the test expected admission while the repository contained17 migrations. Review also caught a test-only manifest15 edge: both SQL16 assertions needed appropriate manifest-length guards. Root corrected those guards before final acceptance.

Validation of the final exact test:

- Actual repository manifest17: M73/M74 operator suites plus independent M74 operator-gate suite **16 passed,158 assertions**.
- Isolated mock manifest15: the actual revised M73 test file **4 passed,26 assertions**.
- Isolated mock manifest16: the actual revised M73 test file **4 passed,27 assertions**.
- A separate13-assertion helper matrix confirmed valid15/16 admission, missing/reordered/changed receipt refusal and zero database queries for17. All queries in these tests were in-memory stubs; no database connection occurred.
- Strict TypeScript checking passed. The mock preload is `.tmp/m74-legacy-operator-review-preload.ts`; it changes only the selected manifest in its isolated test process.

Exact reviewed SHA-256 values:

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/m73-operators.test.ts` | `efb63c0609dc017a27da0c03e54ebd487f695397fb21fe18b1480166426ecd5b` |
| Unchanged `tools/staging/m73-common.ts` | `a47f8904fab503272173e3db8f39144f52d3b3d4eb14da03784349ac88466ab7` |
| Unchanged `0016_stationary_natural_gas.sql` | `aa4968c63087f353b5bf80d64bced67270bc5ad17f715393b40313bb57f7f732` |

This accepts the bounded test correction. It does not claim remote CI completion, publication, hosted migration or deployment.

# Continuation4 GET route optimization candidate

## Candidate behavior

This isolated candidate changes only GET dispatch in `apps/site-api/src/workspace/m78-routes.ts`. A valid version path calls `findScope1Version` once. A valid report path calls `findScope1Report` once. Both specific getters still construct and verify the complete Scope 1 state, including upstream provenance, retained records, request/audit fingerprints, response capacity, tenant access, stream identity, and family identity. The candidate does not add a direct-row read or weaken proof validation.

Root register and retained statement paths continue to call `findScope1`. All POST dispatch, validation, manager checks, status mapping, timeout behavior, and response construction remain unchanged. The candidate adds no retry or timeout increase.

For a null or identity-mismatched specific result, including a returned ID different from the requested ID, the route performs one root read only as a refusal fallback. That fallback distinguishes the existing generic wrong-company/wrong-stream/cross-family response (`Scope 1 record not found.`) from the existing specific missing-version/report response. It is awaited inside the route's `try`, so permission and corruption failures retain the existing 403/503 mapping.

## Portable verification

`m78-get-route-baseline-fixture.ts` is an exact portable copy of historical route SHA-256 `ab5018c64668dfe197755849aee1a2b3c5947f6c3da21e8d18869e998f3f9e01`, with only the exported factory name changed and a provenance comment added. Differential tests compare exact status, every response header, and body bytes for process and inventory version metadata/export/proof and report metadata/HTML/snapshot/proof. Each valid candidate response uses the specific getter and records zero root calls, while the baseline records one root call.

Additional tests cover root register and statement reads, null and non-null fallback, exact requested IDs, actual cross-family stream/identity combinations, wrong company/stream/family, rejected fallback promises, signed-out and staging denial, SQLSTATE 42501, corruption, malformed IDs, unsupported methods, the POST manager gate, and one valid report writer dispatch. The combined targeted and portable unit run passed 12 tests with 157 assertions; three native tests remained skipped by their existing environment guard. Targeted strict TypeScript passed.

Root review rejected the first candidate because its fallback promise escaped the route `try` and its direct wrong-family response did not preserve the generic cross-family refusal. Candidate1 remains frozen. A second pre-freeze candidate repaired those issues, but independent review found that it did not compare the returned record ID to the requested ID. Candidate2 remains frozen. Candidate3 awaits every fallback and requires exact requested ID, company, stream, and family identity before releasing bytes; new regression cases reproduce all findings.

## Limits and next gate

No native database, hosted application, provider, credential, or application write was used. This candidate has no measured performance claim and no release admission.

After source and independent QA, the mandatory comparative local run remains pending: one warm-up plus three measured calls for direct register/version/report and the real version/report GET variants, recording individual/median/maximum timing, query/state/corporate-read counts, exact status/header/body hashes, and all 121 table digests before and after. A changed router also requires a fresh complete source inventory, publication checks, exact deployment proof, and a new runtime/recovery gate before any recovery execution.

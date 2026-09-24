# M75 independent shared-wiring addendum

Reviewed 2026-09-16 UTC by `/root/m74_accounting`, independent of M75 production authorship. Requested QA compute Astra/high; inherited runtime setting unobserved. This supplements the accepted module/native/UI review, not a new customer or hosted-release approval.

## Result

**Pass for the inspected local integration candidate. No open blocker.** The exact 13-file raw SHA256 map is `m75-integration-pins.json`, SHA256 `20a3a32a346981a0141f70188f7d6d0b2328f6a022a763aaa3d689f1b54c0277`. All 14 production/setup pins from `m75-independent-candidate2-pins.json` were rechecked unchanged. Canonical migration18 remains `76c8a17a46d96b40ed98213ceb3cf79caf564c5a639583197bd0adaf1c8a98f3`.

Two release-blocking stale schema17 checks were found in the shared CI wiring and repaired by root: the Docker image migration-manifest smoke expected17 entries, and the native hosted test expected17 migration receipts. The reviewed final versions require18; the image smoke additionally checks the exact `0018_controlled_fleet.sql` slot. These findings were not failures of the accepted M75 calculation/reconciliation implementation.

## Evidence

- Reviewed workflow native fixture ordering, independent native/direct SQL/parity commands and local hosted-helper invocation. Inspected Docker build/runtime copies for M75 route, contract, validation, report and migration dependencies.
- Reviewed staging dispatch and existing authentication/origin/body-limit wrappers; database methods retain actor-scoped read and trusted-write transactions. Schema readiness and migration manifest require18. The fleet panel uses the actor/company key and existing navigation; scoped CSS retains responsive overflow/wrapping.
- Added reviewer-owned `m75-integration.test.ts` through the actual `createStagingServer` composition. It verifies exact retained register forwarding with the actor/company, missing/revoked access, wrong origin, oversized body, malformed path and unsupported verb, response security headers, schema17 startup refusal and database closure. Auth and database adapters are synthetic; this is a composition check, not another claim of native persistence or real provider authentication.
- Executed `bun test evaluations/research-qa/m75-integration.test.ts apps/site-api/src/staging/server.test.ts tools/staging/m74-operators.test.ts`: **16 tests passed, 171 assertions, zero failures**. The M74 test-only repair rejects a manifest newer than its frozen16/17 baseline before any query; the legacy operator is unchanged.

The workflow and Dockerfile were source-reviewed here; this addendum does not claim an independent Docker build or remote CI execution. Root owns operator safety, deployed-host verification, remote-head/required-check publication and the final deployment decision. Existing synthetic-profile, incomplete Scope1 and unreleased-method restrictions remain in force.

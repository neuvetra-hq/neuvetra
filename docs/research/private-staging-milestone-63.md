# M63: private staging for the synthetic inventory workflow

Board approved September 14, 2026 after PR #3 merged at 0127b9e12358b4e2d687acec1be30365d3e293a4. Status: implementation and independent verification in progress. New rolling delivery branch codex/m63-private-staging is necessary because PR #3 is closed.

## User outcome

An approved tester signs in with a real account, opens the existing synthetic company inventory, prepares or reviews its evidence pack and report according to their role, signs out and returns later to the same stored versions. A second approved manager records an exact-report decision. The demonstration stays synthetic, incomplete, unreleased and without professional assurance.

## Acceptance

1. Reuse the existing Railway Site-Web service and Supabase test project as expressly authorized by the board. Private access requires an explicit roster, isolated company data and reviewed containment of all legacy application grants. Preserve a recovery backup before modifying the existing schema.
2. Server-verified real identities, explicit active tester roster and company membership. No local synthetic token or public signup grants workspace access.
3. Dedicated non-owner database runtime role without RLS bypass; transactions bind identity locally; direct ACL and pooled concurrent-identity checks fail closed.
4. Existing deterministic calculations, exact evidence bytes, versioned lineage, review separation and stored-integrity checks survive the adapter change.
5. Hosted persistence survives application/database connection restarts. Reopening a different browser finds the authorized existing workspace and evidence.
6. A real PostgreSQL backup restores exact identities, IDs, bytes, timestamps, nulls, hashes, decisions and audit evidence into a separate target. Restored access boundaries are tested.
7. A dedicated build includes only the intended web/API, pinned calculation code and synthetic assets. Ordinary public build behavior remains separate.
8. Sanitized operational logs, health/readiness signals, bounded requests and a tested rollback procedure. A plan or mocked test is not a live recovery drill.
9. Independent QA on exact integrated code, local meaningful checks and exact remote CI; preserve initial findings and repairs.
10. Private hosted demonstration with approved testers and an explicit cost boundary before declaring hosted acceptance. No email invitations are sent without recipient-specific authorization.

## Assignment and ownership

CEO performs product framing and owns frontend, build/operations integration, cloud inventory and board records. CTO owns architecture and API/staging composition. Data specialist owns packages/neuvetra-database and migration/role/persistence behavior. Independent QA owns challenge probes and review evidence. Critical Astra/high requested for the three specialist contexts; actual settings remain unknown unless observed. Each has a role run record.

## Dated infrastructure observations

The signed-in Railway Neuvetra-AI project 119f3652-9d84-4d16-983c-1a17c0fd1aaa shows only its production environment and existing public Site/Langfuse services. No staging resources have been created. Supabase project icockcoguyadhryzydvl in the Neuvetra PRO organization shows main/PRODUCTION and a current public.users RLS-disabled warning. The board confirms all existing data is test data and authorizes schema and public-service changes. Shared-project configuration requires explicit reuse confirmation and a clean legacy application-grant audit.

Supabase supports separate branch instances with unique Auth/API credentials and data-less defaults, but also clones configuration and Edge Functions. A branch would still need inspection/containment and must never be merged back as a staging shortcut. The board superseded the fresh-target proposal: reuse current capacity and avoid additional hosting cost. First tester is nima.birgani@gmail.com. Railway persistent CLI authorization was specifically approved for the existing Neuvetra-AI project; no paid target was provisioned.

During dashboard sign-in, the browser tool emitted credentials in a transient OAuth redirect URL. Values were not copied into project files or agent messages. The temporary dashboard session was signed out and the sign-in page verified. Revocation of every upstream OAuth credential was not independently verified. Subsequent auth-state reads suppress raw output and redact redirect fragments; this is an actual handling limitation, not evidence of outside use.

## Evidence references

- Architecture: m63-technical-plan.md
- Independent review: ../../evaluations/research-qa/milestone63-private-staging.md
- Existing gates: pr3-merge-readiness-milestone-62.md
- Official isolated branches: https://supabase.com/docs/guides/deployment/branching
- Branch usage: https://supabase.com/docs/guides/platform/manage-your-usage/branching
- Empty Railway environments: https://docs.railway.com/environments
- Railway cost controls: https://docs.railway.com/pricing/cost-control

Local PostgreSQL 17.11 was provisioned as a disposable loopback-only test runtime. Its smoke backup/restore is not yet the full application drill. No system service or production database was changed. Stop the test cluster after integrated verification.

## Recovery and current validation

Existing Supabase test data was backed up over CA/hostname-verified TLS before schema changes. The 395,860-byte custom archive is encrypted with Windows DPAPI for the current Windows identity outside Git; decryption and SHA-256 verification passed (`43a641fc13aac5065391de10b61548d58454a84c610d112a04998d27ca81d31d`). This is not a cloud restore claim. Independent local PostgreSQL application restore preserved 32 tables and 496 rows, with report/hash/access replay passing; integrated review remains ongoing.

## September 14 cloud execution

The exact independently reviewed containment plan v2 (`68e0ca48f3ffb9c1b0da60df477514c6c7e7b4d6a83e8bd2d9b38e489781fbb9`) passed an atomic rollback rehearsal, then all 31 statements committed and migrations 0001–0009 applied. The first 34-statement plan failed with SQLSTATE 42501 on provider-owner default privileges and rolled back completely. The revised policy explicitly inventories the three deferred provider-admin statements; all existing endpoint object grants and effective schema/database boundaries must remain closed. Unknown application schemas fail readiness.

Real Supabase password sign-in, getUser verification and restricted SQL readiness pass for four synthetic QA accounts: two managers and one member are rostered; the outsider is refused. The first provisioning attempt stopped at encrypted-storage setup after four Auth-only accounts were created (no roster or email); those unused test accounts require cleanup. Retrying with the configured PowerShell runtime succeeded and kept credentials in a DPAPI-encrypted file outside Git. The board account is provisioned without sharing or setting a board password; the approved board sign-in email was later sent and Gmail delivery confirmed.

Auth default return URL is now `https://www.neuvetra.ai`; the retired localhost callback was removed and the UI shows no extra redirect URLs. Data API exposes only public/graphql_public, with zero exposed tables/functions observed. Automatic new-table exposure was disabled in the dashboard. A fresh catalog still verifies containment and explicitly retains the provider-owned default ACL residual. Managed-schema review accepts the bounded private-testing surface; provider realtime.subscription RLS remains disabled but that schema is not exposed through Data API.

Draft PR #4 publishes candidate `4f454718c4050c432b1599f1edc91940f3edcf2e`; all five remote checks pass. The initial automatic publication review rejected an unverified destination; verifying private repository ownership/admin access and the merged PR3 resolved that restriction without further user approval. No secrets were included; secret-pattern matches were intentionally invalid unit-test fixtures.

Railway's generic environment edit reported no changes and left settings intact. The purpose-built source command successfully connected the verified repository/branch; its first attempted build used old settings and failed (`51567735-5415-4497-a263-b41d36f1ae8f`). Dashboard changes then set root `/`, Dockerfile.staging, CI gating and `/ready`. Deployment `a0b88ee1-a3a2-4d7b-a742-40faede1a781` successfully deployed the reviewed commit. Existing deployment `b2de8ce1-f7b4-4f04-a484-cde43b9dc2ee`, old repository commit `de2a8c819da9a5f2e4d63833df6979fd04a404b4`, and encrypted prior Railway configuration are retained for recovery.

## Hosted verification and recovery evidence

The live site and readiness endpoint pass. Real provider identities pass deployed manager/member access (200), outsider refusal (403) and signed-out refusal (401). The hosted synthetic evidence-to-report-to-distinct-manager-review journey passes. A local receipt save initially failed on the existing OneDrive directory; the repaired writer preserved the already-created records and saved a resumable verification receipt. A read-only follow-up after Railway restart preserves the exact archive/report/review hashes with zero application POSTs. Provider logout204 is an acknowledgement of refresh-session logout, not proof that an existing access JWT expires immediately.

The application-only cloud backup (317,154 bytes; SHA-256 c71f862fae79d8bffffa976245764e544dd4f5dfea59647d92c7573430616a5f) was independently restored into a fresh loopback PostgreSQL target. All 31 tables/54 rows and catalog ownership, policies, ACLs and function definitions match the source manifest; original saved artifact hashes, restricted access and archive replay pass. Provider Auth was not restored; the local target uses five ID-only Auth fixtures. DPAPI recovery depends on this Windows identity/profile and is not a portable off-device disaster-recovery system.

Monitoring currently means active Railway health checks/restart policy and structured sanitized request logs. There is no newly configured proactive alert service or scheduled backup automation. The first board email was delivered at 2026-09-14T19:13:09Z with subject Confirm Your Signup; browser confirmation and board feedback remain pending.

Railway restart of a0b88ee1 passed a zero-write exact-baseline journey. Redeploying the same reviewed commit created a532badf-8199-4304-8797-ef6bbc72f45e; the provider Rollback action restored a0b88ee1's build and variables as successful deployment 77f75a77-4e79-4949-b71b-b39f72b5e978. A second read-only journey passes with zero application POSTs and identical immutable hashes. This demonstrates compatible deployment/variable rollback, not reversing database migrations or provider Auth state. [Hosted journey](m63-hosted-journey.json), [recovery](m63-hosted-recovery.json), [independent restore](../../evaluations/research-qa/m63-cloud-restore.json).

Unused first-attempt Auth test identities were disabled by reversible provider bans after a dry-run identified exactly four IDs, with all application-schema Auth references checked and board/current QA identities excluded. No data was deleted. The first cleanup dry-run failed closed on credential-format validation; the next failed closed on an invalid backend-TLS assumption; both were repaired and independently reviewed before the successful dry-run and ban. [Cleanup receipt](m63-test-account-cleanup.json).

## Board-reported browser failure M63-F03

The first signed-in board revisit rejected an otherwise successful saved-bill response: The calculation response was not recognized. Root reproduced the actual browser failure and independent QA's real-hosted-response probe failed at frontend calculation guard line161 with HTTP200 and zero application writes. The calculation comparator incorrectly treated JSON object property order as material. The bounded repair compares exact JSON keys/types/values recursively while preserving array order; all factor, method, amount, hash, lineage and release-status checks remain. The same hosted response passes the repaired decoder, and the hosted-only wording now acknowledges persistent hosted storage without changing synthetic/incomplete/unreleased status.

This is an escaped browser-contract defect after technical API/recovery acceptance, not a clean first-pass success. Role records count the shared incident once at milestone level; L04 now explicitly requires real hosted responses through frontend decoders plus a signed-in saved-workflow revisit. [Independent follow-up](../../evaluations/research-qa/m63-browser-contract.md). Full frontend-chain and postdeployment browser verification remain pending at this entry.

The full real-response/frontend-contract check now passes for manager and read-only member: 22 hosted GETs, zero application POSTs, exact saved calculation/inventory/archive/report/review decoders and corrupted in-memory counterexample refusals. Prior failed and minimal passing runs remain in [the append-only receipt](m63-browser-contract.json). Postdeployment browser rendering remains the final check.

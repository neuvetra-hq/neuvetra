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

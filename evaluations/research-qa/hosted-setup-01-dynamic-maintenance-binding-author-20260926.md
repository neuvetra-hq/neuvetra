# Dynamic maintenance image binding — author handoff

Task `HOSTED-SETUP-DYNAMIC-MAINTENANCE-BINDING-01`, 2026-09-26. Owner `/root` acting as CTO coordinator. Scope: the local one-transaction runner's reviewed stop identity and its synthetic compose fixture. No provider scaling, database migration, credential, shared Git or hosted write was performed by this change.

The earlier runner required yesterday's Site-Web deployment `40546ef7` and commit `75d8ec4b`, so it could never accept a stop of the newly active reviewed bridge. The fixed target now contains only the exact project/environment/service/region. The `reviewed-maintenance-stop-binding.v2` and `maintenance-stop.v2` contract requires a UUID deployment, pinned `sha256:` image digest and deployed commit equal to the input's reviewed product head. Its project/environment/service/region and availability-only claims remain checked. There is no caller-selectable alternative target. The stop receipt/review issuer and fresh provider observation remain separate required dependencies; this change does not authenticate them.

Frozen local candidate SHA-256:

- `tools/staging/hosted-setup-transactional-upgrade.ts`: `93eb9c31c16862f875449079a740880f6f02310a897121a7701c1a16f52fe203`
- `tools/staging/hosted-setup-transactional-upgrade.test.ts`: `fbedbee79c95f5c7fe29c4210e71de6e53673fd59f85ed355398f775456f03f2`
- `tools/staging/hosted-setup-transaction-compose.ts`: `5b096a18f4c69d4aa3781b6d3a359378a1df69f0761b49f00721255252696174`

Focused tests: 18 passed, 0 failed, 162 assertions. The native compose test used fresh local PostgreSQL 17 and checked commit/rollback/timeout/replay in distinct processes. Focused strict TypeScript passed. An initial run had one fixture-only failure because it expected the old error text; the source refused the drifted service, the assertion was corrected, and the full run passed. Tests explicitly refuse yesterday's commit, malformed deployment ID and malformed image digest before opening the transaction journal.

Independent QA is assigned to `/root/compose_qa`; acceptance is pending. The active bridge image observation is a separate point-in-time provider record. Authentic new-image stop/resume, fresh backup/restore, external review issuance, integrated worker and published exact-head checks remain required before schema 23.

# Company setup schema 23: operator handoff

This is the local implementation for the first hosted setup increment. No hosted migration, backup, restore, provisioning, deployment or real invitation was executed by this change.

## Upgrade and preservation

Use the existing reviewed operator migration boundary after a fresh backup and independently accepted restore rehearsal. The manifest accepts schema 22 only when all existing migration hashes and the target identity match. Schema 23 is one transaction. Never apply its SQL piecemeal or edit migrations 1–22.

Eight new tables retain company-scoped setup snapshots, entities, relationships, locations, screening, changes and request receipts. Prior M71/M78/M80 tables and records remain. Four geography CHECK constraints on `companies` and `facilities` are widened from US/CA literals to country-code and region-text format checks. This intentional metadata change must be classified in the preservation comparison; no existing geographic value is rewritten. New versioned locations can reference an existing facility only in the same company. They preserve geography independently and never infer an eGRID subregion.

The operator-only `provision_company_setup_workspace(uuid,uuid,text,text,text,boolean)` requires an existing Auth user, an unused company UUID and unassigned owner, a name starting `Synthetic `, and explicit synthetic confirmation. It creates company, owner membership and active staging admission atomically. It creates no fake facility or reporting boundary. It is SECURITY INVOKER and grants no execution to public, authenticated or runtime roles. Provider identity creation and approval belong to the access workstream.

The runtime receives SELECT only on new tables and EXECUTE only on the reviewed save entrypoint. Save locks active admission and manager membership, then the company, and checks idempotency before predecessor conflict. Replays remain subject to current authorization. Corrections append snapshots; deleting an entity from the latest draft preserves earlier versions. JSON keys and types are closed, request size is limited to 250,000 bytes of database JSON text, each list to 500 entries and history to 1,000 versions. Unknown ownership/dates remain null. Negative and not-applicable screening both require reasons and have distinct states. Review acknowledgment is a customer fact, not accounting approval or assurance.

## Rollback

Before transaction commit, rollback leaves schema 22 and existing rows unchanged. After commit, preserve schema 23 and every accepted setup version. Disable new setup writes or deploy a compatible schema-23 application while diagnosing. The old schema-22-pinned application will fail readiness against 23; do not describe a blind application downgrade as a working rollback. Corrections append compensating versions. Never drop the new tables or remove accepted rows to make old startup checks pass.

If a full restoration is necessary, restore the verified encrypted backup into a separate reviewed target first and reconcile all writes after that backup. Replacing hosted data requires the board's specific approval. A schema-22 backup alone does not contain setup versions saved after upgrade. The legacy geographic CHECKs cannot be reinstated after non-CA rows exist without a separate compatibility decision; never truncate or rewrite those rows.

## Author validation and limits

`bun test src/company-setup.test.ts` in this package: six tests, 37 assertions passed on PGlite, with all 22 prior migrations, populated M71/M78 synthetic history sentinels, and a genuine M80 setup version seeded before the upgrade. Exact legacy row comparison passed before and after new saves; isolation, guessed IDs, foreign references, reason requirements, immutability, replay, stale writes and revocation passed. `bun run typecheck` passed. Independent native PostgreSQL and integrated API/browser review are separate evidence and remain owned by QA/coordinator.

No collection plan, activity, evidence object store, readiness calculation, source release or emissions calculation is introduced here. This schema is for synthetic setup drafts, and its presence does not establish customer or assurance readiness.

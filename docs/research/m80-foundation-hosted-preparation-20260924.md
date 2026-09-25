# M80 hosted foundation preparation

Date: 2026-09-24. Task `M80-FOUNDATION-HOSTED-PREP-20260924`; software-engineering preparer `/root/m80_foundation_runtime`; root is the sole eventual hosted executor. Requested route `gpt-5.6-sol/high`; observed model and effort are unavailable. Role prompt SHA-256 `a9ab5574fe2ef1e940cb1950e6ae69da008ff71ba1f857b6a63b45d53240a52b`.

This work supplies **offline evidence validators and durable journal preparation**. It does not execute a migration, fixture admission, deployment, provider request, backup, restore, database query, Git action or network request. A generated plan fixes three separate eventual actions in order: migration, admission and deployment. Every plan says `executionAuthorized: false` until an independent security reviewer creates a fresh exact execution gate. Root remains the only eventual executor.

The accepted runtime pins are:

- Candidate 2 snapshot SHA-256 `40c4ac822ef2d045457ade7dd63d471813178c8f3a585425be58eb81013de59b`.
- Migration `0022_scope1_beta_foundation.sql` SHA-256 `0ee148b366e803e8cf28187393f9e5a6f19b29f5bb54578e359db7cbcd795e35`.
- Root local-runtime closure SHA-256 `953cdda7f40b808be09f05aef2bc1b8ac271136f980774bb07c9d20aaa79aac6`.

No current hosted input file or execution plan is included. Current provider, application, backup, restored rehearsal, publication-head, integration-acceptance and target-admission observations remain unset and therefore fail closed.

## Helpers

`.superpowers/m80-foundation-hosted-prepare.ts` accepts one closed, secret-free JSON file and verifies referenced bytes and typed receipt contents before producing a new exclusive plan file. Each timestamp and role is a JSON string, never a coercible array or number. It requires:

- a byte-pinned fresh private synthetic baseline showing schema 21, exactly 21 receipts, the actual current non-receipt table count, application readiness at 21, successful current deployment identity, paused automatic deployment, synthetic-only data and an explicit requirement to establish write quiescence before execution. The baseline does not claim that a maintenance switch exists or is enabled;
- a fresh exact final publication head plus the six named successful checks, root publication review and accepted integration result;
- the three accepted runtime pins above;
- an application-only, synthetic-only encrypted backup receipt bound to the exact observed application-state digest;
- a fresh disposable restore and schema-21-to-22 preservation rehearsal from that backup, with the same freshly observed hosted non-receipt table count, 21 old receipts, exact old content and metadata, the six expected new tables, exact new-table counts (four migration-seeded HELD release records and zero rows in the other five), forced RLS, runtime SELECT-only privileges, direct-write denial, no admission and closed connections; and
- a byte-pinned fresh observation of one existing synthetic company and one existing owner/admin membership, with no company, user, role or permission creation.

The accepted local runtime evidence recorded 120 old non-receipt tables. The input retains `historicalReferenceNonReceiptTableCount: 120` only as a comparison value. It separately requires `observedNonReceiptTableCount` from the current hosted target and requires the backup/restore rehearsal to preserve that observed value. The historical local count never substitutes for a hosted inventory.

The helper opens every referenced receipt, verifies its exact byte hash, and validates a closed receipt body against the corresponding target, publication, integration, backup, restore, preservation, rehearsal or admission facts. It rejects contradictory self-asserted summaries, unsafe paths, duplicate/unknown JSON fields, stale observations, unexpected checks, changed runtime pins, secret-shaped keys/values and oversized input. Plan output is confined to one basename directly below `.superpowers`; absolute, nested, backslash, traversal and linked-parent escapes refuse. The preparation plan expires after four hours and remains unauthorized. Each stage additionally needs a fresh, stage-specific independent gate and target observation no older than fifteen minutes.

`.superpowers/m80-foundation-hosted-once.ts` persists only evidence. `seal` opens the gate's actual security-review, integration-acceptance and stage-target receipt bytes, checks their pins and closed typed contents, and creates one exclusive durable intent for exactly one stage. The independent receipt identifies its reviewer and the distinct implementation author and binds the exact plan, operation, stage, reviewed head, project, environment and service. Its output path is deterministic from the target project, accepted M80 milestone, runtime Candidate 2 and migration 0022, rather than supplied by the caller. Regenerating a semantically equivalent plan therefore resolves to the same stage lock; changing a timestamp or filename cannot bypass an existing or uncertain intent. Each intent/outcome writer opens the new file exclusively, writes all bytes, explicitly syncs the file and closes it before reporting completion. A write, sync or close failure rejects without a success message and retains any created marker so a later attempt cannot replay blindly. `record` requires the actual intent and post-intent authoritative-observation files and converts them into `verified_success`, `verified_failure_do_not_retry` or `uncertain_do_not_retry`. An existing intent/outcome is never overwritten. Admission requires the full migration intent/gate/observation/outcome chain; deployment requires both full migration and admission chains. The successor gate and intent must be observed after predecessor success. The validator recomputes predecessor outcome semantics from the actual intent and observation; rewriting an unknown or failed outcome to say success cannot advance. Failure or uncertainty never authorizes the next stage and never permits automatic retry.

## Preparation command

After root has collected all fresh receipts into a new input file and an independent reviewer has accepted the helper source, prepare the still-unauthorized plan:

```powershell
bun .superpowers/m80-foundation-hosted-prepare.ts `
  .superpowers/m80-foundation-hosted-input-<timestamp>.json `
  .superpowers/m80-foundation-hosted-plan-<timestamp>.json
```

Expected output is `prepared_offline_review_required` with `executionAuthorized: false`. The exact plan bytes then require independent security review. For each stage, the reviewer creates a fresh gate with that stage name, a current target schema/receipt/application-state observation, exact project/environment/service, the plan byte hash, plan semantic hash, accepted Candidate 2 and migration hashes, final reviewed publication head, exact checks, security-review receipt, integration-acceptance receipt, root-only execution and no-retry acceptance. Each gate expires no more than fifteen minutes after review. Those three receipt paths must exist and their exact bytes must match the pins stored in the gate; strings inside the gate are not substitutes.

The stage gate evidence uses these closed bodies:

| File | Exact facts required |
| --- | --- |
| Security review | profile `neuvetra.m80.foundation-hosted-security-review.v1`; review time; `pass`; actual independent reviewer ID; implementation author `/root/m80_foundation_runtime`; `independent: true`; exact plan pin/semantic hash/operation scope/stage/project; final head; Candidate 2 and migration hashes; `materialFindingsOpen: 0`. |
| Integration acceptance | profile `neuvetra.m80.foundation-hosted-integration-acceptance.v1`; publication observation time; `pass`; final head; Candidate 2 and migration hashes; runtime and UI integration both accepted. |
| Stage target | profile `neuvetra.m80.foundation-hosted-stage-target-observation.v1`; observation time; exact stage/project/environment/service; schema and receipt count `21/21` before migration or `22/22` afterward; current application-state SHA-256; quiescence mechanism exactly `provider_deployment_stopped_and_origin_readiness_unavailable`; zero active deployments; origin readiness unavailable; no active application writes observed. |
| Gate | profile `neuvetra.m80.foundation-hosted-execution-gate.v1`; exact stage; review/expiry; `pass`; root operator; independent reviewer; exact plan and the three receipt pins above; final head/check fact; target identity/state; Candidate 2/migration hashes; root-only executor and no-automatic-retry acceptance. |

The migration rehearsal receipt binds the exact new-table row counts: `scope1_beta_release_records: 4`; `scope1_beta_audit`, `scope1_beta_fixture_admissions`, `scope1_beta_requests`, `scope1_beta_setup_heads` and `scope1_beta_setup_versions`: `0`. It also requires `releaseRecordsExactFourHeld: true`. The four rows are canonical migration-seeded HELD records, not effective releases and not evidence of operator admission.

Every referenced JSON file uses `JSON.stringify(value, null, 2) + "\n"` with UTF-8/LF for its byte pin. The gate and plan themselves use that same serialization. A differently formatted or changed file refuses, even if its parsed values seem equivalent.

Seal the first intent only after that review:

```powershell
bun .superpowers/m80-foundation-hosted-once.ts seal `
  <plan.json> <fresh-migration-gate.json> migration `
  - - - - - -
```

The helper prints its deterministic `.superpowers/m80-foundation-hosted-<operation-scope>-migration-intent.json` path. This command makes no database or provider request. If that path exists, or the retained migration intent has an absent/uncertain outcome, stop and inspect authoritative state. The CLI accepts no alternate intent output path.

## Eventual operator action 1: migration

An independently reviewed private executor, which is outside this task, must consume the sealed intent and an approved credential supplied through its private input channel. It must call the existing explicit operator entrypoint exactly once:

```ts
await migratePrivateStaging(connection, {
  expectedProjectRef: plan.target.projectRef,
  syntheticTargetConfirmed: true,
  reuseExistingProject: true,
})
```

The existing command that invokes this entrypoint is:

```powershell
bun packages/neuvetra-database/src/staging-operator.ts migrate
```

The private process must supply only its protected environment channel: `NEUVETRA_STAGING_MIGRATION_DATABASE_URL`, matching `NEUVETRA_STAGING_PROJECT_REF`, `NEUVETRA_STAGING_REUSE_EXISTING=confirmed`, `NEUVETRA_STAGING_TARGET_CONFIRMED=synthetic-test-data`, and one reviewed CA source. Do not put those values in the command line, gate, logs or repository. This command is not called by either preparation helper.

There is no implemented application maintenance-mode switch. Before sealing the migration gate, root must stop the exact current provider deployment, observe zero other active deployments for the reviewed project/environment/service, observe the origin readiness endpoint unavailable, and then confirm no active application writer. That provider-stop evidence is the enforceable write-quiescence mechanism currently admitted by the gate. An operator-session table-lock alternative remains only an unreviewed design option and is not accepted by these helpers.

Immediately before the call the executor must reverify that quiescence evidence, target/project containment, schema 21, receipt count 21, current source bytes and the sealed intent. It must not accept an already-schema-22 target as proof that its own request succeeded. Immediately afterward it must authoritatively verify schema 22, exactly 22 receipts, the exact migration name/hash and full old content/metadata preservation. A transport interruption, missing terminal receipt, unexpected schema or inability to persist the outcome becomes `unknown`; root records `uncertain_do_not_retry` and stops.

Record only an authoritative migration observation:

```powershell
bun .superpowers/m80-foundation-hosted-once.ts record `
  <migration-intent.json> <migration-authoritative-observation.json>
```

That observation's success body contains profile `neuvetra.m80.foundation-hosted-outcome-observation.v1`, a time at or after the intent, stage `migration`, outcome `definitive_success`, and an exact state containing project/environment/service, schema 22, 22 receipts, migration name/hash and both old-content and old-metadata equality set true. Failure or uncertainty uses an empty `authoritativeState` and cannot advance.

No historical M78 helper, blanket old receipt, prior lock, or earlier migration result grants permission to run this action.

## Eventual operator action 2: existing-company admission

After migration is `verified_success`, seal the admission intent using the migration outcome:

```powershell
bun .superpowers/m80-foundation-hosted-once.ts seal `
  <plan.json> <fresh-admission-gate.json> admission `
  <migration-intent.json> `
  <migration-authoritative-observation.json> `
  <migration-outcome.json> `
  - - -
```

The eventual private database executor binds `$1` to the reviewed existing synthetic company UUID and `$2` to the reviewed existing owner/admin user UUID, then executes exactly this statement once:

```sql
insert into neuvetra.scope1_beta_fixture_admissions
  (company_id, fixture_profile_id, fixture_version, fixture_sha256, active, admitted_by)
select c.id,
  'm80-synthetic-scope1-foundation-v1',
  1,
  '2c6a9f78cded2a209bf536969e4ea389baa7fe1633c8ef63fad0c22826f77dc1',
  true,
  m.user_id
from neuvetra.companies c
join neuvetra.company_members m on m.company_id = c.id
where c.id = $1::uuid
  and m.user_id = $2::uuid
  and m.role in ('owner', 'admin')
returning company_id, fixture_profile_id, fixture_version,
  fixture_sha256, active, admitted_by;
```

Exactly one row must return and read back with the same values. Zero, multiple, conflicting or uncertain rows stop the sequence. The operator may not create a company, user, membership, role or permission. No real-company row is eligible.

The admission success observation uses the same observation profile with stage `admission`; it binds project/environment/service, row count 1, the exact reviewed company and manager UUIDs, fixture profile/version/hash. Record it with the same `record <intent> <observation>` command before considering deployment.

## Eventual operator action 3: deployment

After both earlier outcomes are `verified_success`, seal the deployment intent:

```powershell
bun .superpowers/m80-foundation-hosted-once.ts seal `
  <plan.json> <fresh-deployment-gate.json> deployment `
  <migration-intent.json> `
  <migration-authoritative-observation.json> `
  <migration-outcome.json> `
  <admission-intent.json> `
  <admission-authoritative-observation.json> `
  <admission-outcome.json>
```

The eventual provider request must identify exactly `plan.actions.deployment.environmentId`, `serviceId` and final reviewed `commitSha`. The one reviewed GraphQL statement is:

```graphql
mutation {
  serviceInstanceDeployV2(
    environmentId: "<plan.actions.deployment.environmentId>"
    serviceId: "<plan.actions.deployment.serviceId>"
    commitSha: "<plan.actions.deployment.commitSha>"
  )
}
```

The private executor remains unimplemented in this preparation. It must persist the sealed intent before transport, submit that exact mutation once through the approved private provider channel, and retain the raw response as private evidence without copying credentials or request headers. It must never infer success from a returned deployment ID or client timeout. Success requires a later authoritative provider observation of `SUCCESS` for that exact project/environment/service/deployment/commit plus application readiness at schema 22. Automatic deployment remains paused. Record the authoritative observation with `record`; uncertainty stops without retry.

The deployment success observation uses the same observation profile with stage `deployment`; it binds project/environment/service, provider deployment ID/status, exact commit, schema 22 and `readinessOk: true`. The observation time must follow its intent. A response that cannot establish all of these fields records uncertainty.

## Post-deployment acceptance boundary

Provider success is not postdeployment setup acceptance. The retained local integration acceptance used controlled Auth substitutes and validates the integrated decoder/runtime contract; it does not prove actual hosted identity behavior. After deployment, root must separately obtain actual real-Auth setup acceptance for exact image/commit, schema-22 readiness, authenticated owner/admin save, member view-only behavior with `canManage: false`, foreign-tenant concealment, immutable version history, held-only output and absence of calculations, exports and invitations. That real-Auth result is a postdeployment gate, not a circular prerequisite for migration or deployment. The provider remains stopped until deployment; normal availability resumes only after these checks and a reviewed recovery decision.

## Candidate history and remaining boundary

Hosted-preparation Candidates 1, 2, 3 and 4 are preserved review artifacts. Candidate 1 trusted self-hashed predecessor outcomes, shallow plan facts and receipt pins without reading typed contents; accepted a pre-intent observation and coercible timestamp/role arrays; and allowed a lexical output-path escape. Candidate 2 added deep reconstruction and typed contents but still allowed an unknown or failed observation to be relabeled as a successful predecessor, allowed a successor intent/gate to predate its prerequisite, and accepted nested arrays in exact scalar lists. Candidate 3 recomputed outcome semantics and current-stage chronology but did not reapply the gate-after-prerequisite invariant while reconstructing the historic admission stage inside a deployment chain. Candidate 4 passed the semantic and exclusive-create recheck but its writer did not explicitly sync before reporting success. Candidate 5 retains Candidate 4's predecessor chronology and provider-stop quiescence contract and adds create-new, write, sync and close completion semantics with fail-closed marker retention. Candidate 5 requires independent review of its exact bytes before any preparation plan can be used.

The tools never claim a hosted executor was implemented or tested. Their offline tests cover closed inputs, freshness, exact scalar types, byte pins and typed receipt contents, deep plan reconstruction, independent gate evidence, same-target predecessor chains, stage ordering, post-intent authoritative success validation, uncertainty blocking, deterministic operation identity, output confinement, exclusive creation and explicit file sync. Backup creation, restore, hosted migration, admission, provider deployment and live recovery remain separate root-owned operations requiring fresh current evidence and independent review.

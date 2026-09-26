# HOSTED-SETUP-SAFETY-QA3 — write-gate adapter Candidate 2 independent review

2026-09-26. **FAIL: new GATE-ADAPTER-F05 [P1], incorrect PostgreSQL role-limit reporting routine.** Prior F01–F03 are repaired in the tested boundary. F04 now distinguishes role-specific diagnostic fields, but its positive condition pins the wrong PostgreSQL routine, so authentic role-limit evidence is rejected after the gate has already attempted stop/fence actions. **Live integration is not approved.**

Reviewer `/root/source_lock_holistic_qa`, independent Head of QA/security reviewer, CEO sponsor. This context authored neither adapter candidate nor its tests and is independent of the earlier adapter reviewer. Requested critical gpt-6-astra/high; observed settings, tokens and cost unknown. Read operating/QA/security instructions, board context retained from the active assignment, prior adapter QA1 failure, Candidate2 source/test/repair handoff, underlying gate and relevant runner integration. Only the assigned review reports were written. No provider/hosted call, credential resolution, ENV, Git, code edit or external/native database action occurred. Tests and probes used injected synthetic clients. Official PostgreSQL sources were read for diagnostic semantics.

## GATE-ADAPTER-F05 [P1]: accepted reporting routine is not PostgreSQL 17's role-limit routine

Location: `tools/staging/hosted-setup-write-gate-adapter.ts:264-267`, particularly `result.routine === 'InitPostgres'`.

PostgreSQL 17 emits the role connection-limit FATAL from `InitializeSessionUserId` in `miscinit.c`: function declaration at lines 714–716; role-limit check/report at lines 820–827. The emitted code is the too-many-connections condition and the message identifies the role. See [official PostgreSQL 17 source](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/init/miscinit.c). PostgreSQL's protocol documentation defines field R as the reporting source-code routine; it does not mean the outer startup caller. See [official error-field documentation](https://www.postgresql.org/docs/17/protocol-error-fields.html).

The Candidate2 predicate requires `InitPostgres`, and both its positive fixture and author handoff repeat that incorrect value. This is a source-grounded diagnostic contract error, not merely an untested network assumption.

Independent synthetic check, after successful exact runtime-credential preflight and accepted limit-zero mutation, supplied:

```json
{
  "kind": "role-connection-limit-refusal",
  "serverReached": true,
  "authenticated": false,
  "credentialAccepted": true,
  "role": "neuvetra_runtime",
  "projectRef": "icockcoguyadhryzydvl",
  "database": "postgres",
  "endpointFingerprintSha256": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "sqlState": "53300",
  "severity": "FATAL",
  "routine": "InitializeSessionUserId",
  "message": "too many connections for role \"neuvetra_runtime\""
}
```

Observed `runtimeLoginRefused()` result: **false**. Changing only `routine` to **InitPostgres** produced **true**. Thus an authentic-shaped PostgreSQL 17 role-limit diagnostic is rejected and the source-inconsistent synthetic diagnostic is accepted. This is false acceptance at the injected diagnostic-schema boundary; no claim is made that an actual PostgreSQL server emitted the incorrect combination, or that any live client has fabricated it.

A separate integrated in-memory gate probe preserved successful credential preflight, then returned the authentic-shaped diagnostic after limit zero. Observed sequence and result:

- Synthetic mutation clients called exactly `scale`, `limit`, `terminate`.
- No held receipt written.
- Error `HS_GATE_OUTCOME_UNCERTAIN_KEEP_STOPPED`.
- Final in-memory journal status `gate-outcome-uncertain-keep-old-app-stopped-and-reconcile`.

This is why the defect is P1 for the one-time operation: a correctly preserved PostgreSQL 17 diagnostic prevents successful completion after disruptive gate actions have begun. The fail-closed result and no-retry behavior are appropriate once uncertainty exists, but the diagnostic predicate makes that failure systematic for the expected role-limit response.

Required repair: use the reporting routine supported by the actual reviewed PostgreSQL version/transport and retain exact server-field provenance. Add the authentic-shaped positive case and the wrong-routine negative case; do not rewrite a server routine into InitPostgres in the transport. Keep unrelated capacity, authentication and network refusals negative. If supporting another engine/version or localized diagnostic profile, explicitly version and independently validate that profile rather than loosening everything to SQLSTATE 53300.

## Prior findings and evidence map

| Finding/boundary | Disposition |
| --- | --- |
| F01 malformed active flags | Repaired. Independently supplied missing, null, string `true`, numeric 1, numeric 0 and object markers on a second positive-replica deployment: all rejected by `DEPLOYMENT_ACTIVE_FLAG_REFUSED`. Existing integrated test confirms no held receipt or scale with malformed deployment evidence. |
| F02 authorization/client replacement | Repaired for exported input binding. During a pending inventory request I replaced the admin handle, changed the nested runtime reference and replaced the mutation method. Only original frozen handles and captured methods were used. Existing stateful getter test confirms single reads. Captured methods remain dependent on their trusted implementation and internal state. |
| F03 overlapping CAS | Repaired. Independently pending scale prevented both overlapping observation and second scale. Request version remained configuration-1. Response prior configuration-2 refused; the uncertain adapter refused another scale. The response is now compared to the request-local value. |
| F04 causal diagnosis | Improved but not accepted until F05 is fixed. Credential preflight, exact role/project/database/endpoint, severity/state/message and credential-accepted flags are required. Independently tested global capacity, database capacity, wrong endpoint/role/state/severity/database and missing credential proof: all returned false. Correct native reporting routine still fails. |
| Mutation uncertainty | Existing invalid scale/session-termination cases pass and preserve blocked adapter state. Client exceptions or malformed results after a mutation do not authorize replay through the same instance. This is not a durable global once-only ledger. |
| Privileged session accounting | Independent idle privileged session remains allowed with count zero; a transaction-open privileged session counts as one. Existing integrated gate rejects sampled active privileged writers. Neither observation blocks future privileged activity. |
| Routine set | Independent replacement of all 66 signatures with sorted unique `unexpected.*` names still passes. This is the documented cardinality-only boundary, not an approved exact routine-set identity claim. |
| Transport authenticity/completeness | Unestablished. The adapter consumes asserted inventories and diagnostics; it does not itself enumerate Railway/DB state or authenticate a server's claimed fields. |

## Continuous privileged-writer hold remains a live blocker

`HOSTED_SETUP_PRIVILEGED_WRITER_HOLD` still correctly says `unresolved-provider-admin-continuous-write-exclusion`. Idle postgres/provider-admin sessions and credentials may write after the sample. This adapter does not revoke privileged access, enforce a continuous administrative freeze or hold a global database write lock. Runtime role limit zero, terminated runtime sessions and scale-to-zero are not proof of all-writer exclusion.

Before live use, root needs independently reviewed continuous privileged-writer control spanning preflight, migration, postcommit observation and durable receipt persistence. The actual provider CAS primitive, complete service/environment/deployment pagination, exact database endpoint, client disposal after preflight, authentic error-field transport, scheduler/escalation coverage and exact runtime routine-set policy also remain concrete integration work. The current tests and source declarations do not implement those clients or prove their observations.

The existing gate module's mutable input/path behavior and the runner's single-reviewer identity contract are outside this adapter repair; an actual operator composition still needs review. No prior gate/component receipt can stand in for continuous current authority.

## Checks actually run

- Four focused Bun 1.3.12 suites (runner, source lock, adapter, underlying gate): **40 passed, 0 failed, 232 assertions**.
- Strict TypeScript across those four sources/tests, ES2022/ESNext, bundler resolution, Bun types and skipLibCheck: passed, no diagnostics. The earlier Candidate1 strict fixture compile failure is repaired.
- Reviewer-written synthetic adapter probe: **25 independently counted checks**, including repaired active flags/handle/CAS boundaries, the new positive/negative routine mismatch and documented privileged/routine-set limits.
- Separate integrated authentic-shaped-diagnostic probe reproduced the post-mutation refusal without writing a disk receipt or contacting a provider/database.
- Read the official PostgreSQL 17 role-limit implementation and protocol error-field definition; relevant source lines are recorded above. The author-linked `postinit.c` contains other startup capacity checks, but is not where the role-limit report is emitted.

The exact combined test and compiler commands are recorded in the companion `hosted-setup-01-upgrade-input-independent-review3.md`. Local execution/report writing required bounded managed-worktree permission escalation. No permanent probe source was added. No actual PostgreSQL connection-limit experiment, real transport, provider CAS, credentials or hosted state was used.

## Exact reviewed bytes

Initial and final hashes matched.

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-write-gate-adapter.ts` | `98261364869c3d897cc5f77e5e36a0064b9986992e5198bf7c498b8646de2074` |
| `tools/staging/hosted-setup-write-gate-adapter.test.ts` | `0f5c205893356caac5f0999db4a3515b79d9b0db374ce0b5a7e20dd70ac8f127` |
| `tools/staging/hosted-setup-write-gate.ts` | `893abc3034ef930e2458647036cc624d02a6fe74c2719527e2e72db71450f8c0` |
| Repair author handoff | `83ad7e354ac173453e581bee7e27dfdde2aef2655db5e82e186f98fb15dee189` |
| Imported runner/hash helper | `52a760180b2f8de3a25fb0cc47b67a659d9d6174af6c6bf055d51614544cef5c` |

Next owner: adapter author under root/CTO to repair F05, preserve QA1 and this FAIL, and return exact bytes with authentic diagnostic regressions. Then independent targeted review and separate concrete transport/continuous-writer integration review. No live gate, migration, deployment or hosted mutation authority is granted.

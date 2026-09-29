# Hosted setup gate transport independent review

Date: 2026-09-26. Task: HOSTED-SETUP-GATE-TRANSPORT-QA-01. Independent reviewer: `/root/source_lock_holistic_qa`, QA/security under CEO sponsor. Reviewer did not author candidate. Requested critical gpt-6-astra/high; observed model/effort/cost unknown. Applied AGENTS and QA/security role instructions. Read-only candidate review; no external network, actual credential resolution, provider/database connection, Git or ENV actions.

## Verdict

**FAIL for the claimed concrete transport/complete inventory contract.** Local tests and strict TypeScript pass, but independent probes demonstrate fabricated provider inactivity, a successful runtime connection being reclassified as login refusal, and retained mutable dependency references. SQL inspection also finds incomplete writer/scheduler discovery. The safe no-CAS refusal is accepted and prevents this frozen Railway transport from completing the existing live gate; none of the findings asserts that a real held gate or hosted mutation occurred.

## F01 [P1] Database inventory asserts completeness despite omitted writer capabilities

Source lines 206-213 and 259. The other-writers query tests INSERT/UPDATE/DELETE on r/p/f relations and EXECUTE on neuvetra routines. It does not test TRUNCATE-only privileges, column-only write grants, writes through views, sequence privileges, or usable SET ROLE paths into ordinary owner/writer roles. The escalation query considers elevated role attributes and direct admin-option membership, but not an ordinary non-login role that can own/write application data. Such a role need not have superuser/BYPASSRLS/CREATEROLE flags. Normal non-runtime sessions are also excluded from the privileged-session result.

A minimal native acceptance witness to add is a separate ordinary LOGIN role with only schema USAGE and TRUNCATE on one legacy table, no executable application functions and none of the elevated attributes. It can change application data, but no predicate in the current other-writers query represents its TRUNCATE privilege. A second witness is runtime membership with SET enabled and INHERIT disabled in an ordinary non-login table owner/writer role, with admin option false. These are **source-derived witnesses, not native SQL experiments run in this review**.

The scheduler query filters active pg_cron jobs by command text containing neuvetra. An active `select public.refresh_app()` job can call a function that writes application tables without containing that string. Extension-name matching is not a complete inventory of scheduled/indirect writers. Returning scheduledWriterJobs empty and complete true is unsupported for those cases.

Required repair if this transport remains in scope: implement and independently test a complete explicitly bounded privilege/role/sequence/view closure, and fail closed on unclassified active jobs or callable external-schema writer paths. An honest unsupported/incomplete result is acceptable; complete true from these predicates is not. Do not silently convert the scope to a provider-wide administrative exclusion claim.

## F02 [P1] Railway inactive deployment evidence is invented from latestDeployment

Source line 135 initializes every enumerated deployment to active false and regions empty. Line 159 sets only latestDeployment active and assigns that deployment the service instance's region configuration. The GraphQL request supplies no per-deployment live replica evidence that proves every other successful deployment stopped.

Independent HTTP-mock probe changed the second page's formerly REMOVED deployment to SUCCESS, preserving exact project/service/environment and all other fields. Observed:

```json
{"probe":"second-success-inventory","complete":true,"deployments":[{"status":"SUCCESS","active":true,"regions":[{"region":"us-east4-eqdc4a","replicas":1}]},{"status":"SUCCESS","active":false,"regions":[]}],"adapterAccepted":true}
```

This does not assert the second synthetic deployment was actually running; it proves unknown live state was converted into affirmative inactive evidence, which the reviewed adapter accepts. Full cursor traversal is not full active-replica observation. The relevant operational overlap possibility is described in Railway's deployment reference, previously read in the design review: https://docs.railway.com/deployments/reference. No fresh website/API request was made for this QA assignment.

Required repair: obtain authoritative active deployment/replica state for every relevant deployment/environment, or refuse ambiguous concurrent SUCCESS/overlap states. Do not synthesize zero live replicas from absence of an activity field or from latestDeployment alone. Current API field availability remains unverified.

## F03 [P1] Connection-cleanup errors can become affirmative role-limit evidence

Source withConnection lines 193-198 wraps use in finally-close. attemptRuntimeLogin lines 290-310 catches failures from the entire resolver/connect/query/endpoint/close chain and classifies any object bearing kind postgres-connect-failure as a startup failure.

Independent composed transport/adapter probe completed known-good preflight, set the synthetic role limit zero and terminated synthetic runtime sessions. The next connector returned a successful runtime connection; its identity and target queries both succeeded. Only close() then threw the authentic-shaped structured diagnostic below. The adapter nevertheless accepted runtimeLoginRefused true:

```json
{"probe":"close-failure-misclassified","refused":true,"successfulRuntimeQueries":2}
```

Injected close failure fields were kind postgres-connect-failure, category server, serverReached/credentialAccepted true, SQLSTATE 53300, severity FATAL, routine InitializeSessionUserId, exact message `too many connections for role "neuvetra_runtime"`, and the same fixed hostname/port/TLS certificate digest/server version 170011 as preflight. This was a synthetic injected contract challenge, not an authentic server failure or a claim that a normal driver's close operation emits that diagnostic.

Reproducer core: wrap fixture postgres.connect; for the final runtime attempt retain the successful connection/query/endpoint methods but replace close with a function throwing that structured object. Then invoke adapter.runtimeLoginRefused after the standard preflight/limit/termination sequence. Current output is true despite two successful SQL queries.

Required repair: classify a connect failure only at the connect boundary and only before a connection exists. Once connected, identity/query/endpoint/disposal failure must produce refusal/uncertainty, never proof that login was denied. Carry immutable authenticated startup provenance from the concrete connector; a shape discriminator anywhere in the call chain is insufficient.

## F04 [P2] Dependency references remain swappable and raw transport exceptions escape

Factories freeze returned clients but retain the mutable deps object. graphql repeatedly reads deps.secrets/deps.http; withConnection repeatedly reads deps.secrets/deps.postgres. Independent probe constructed the clients, then replaced deps.http.post; the replacement was invoked. It threw a synthetic marker and the marker escaped unchanged:

```json
{"probe":"dependency-swap-and-error","replacementCalls":1,"unsanitized":true}
```

This reopens the caller-replacement boundary that the adapter explicitly snapshots. Moreover, only returned GraphQL error bodies are sanitized; exceptions from HTTP/resolver/admin connection/query/close can retain raw messages, possibly including transport-sensitive values. No real secret was used or exposed in this probe.

Required repair: snapshot/bind dependency methods at factory construction and capture relevant operation input before awaits. Normalize outward exceptions at these boundaries without copying raw error messages/connection strings; preserve uncertainty internally without making errors affirmative evidence. Test dependency replacement during pending resolution and sensitive synthetic markers in thrown errors.

## Exact-target and authenticity limitations

Read-only inventory and connected runtime probes check actual identity, staging target and endpoint evidence. However, independent mutation-path command tracing found no gate:identity or gate:target query in setRoleConnectionLimit or terminateRoleSessions, and neither path calls endpointEvidence. They rely on URL validation and the injected connector rather than independently checking the newly opened connection before mutation. Require exact-target/TLS verification on every mutation connection before accepting this as a concrete operational transport.

The endpoint fingerprint hashes configured project/database labels with connector-asserted TLS certificate/version. It is not itself authenticated project evidence. A failed runtime startup relies on the connector's unimplemented provenance assertions; the diagnostic mapper is not a native PostgreSQL driver implementation. The HTTP, TLS-aware connector and secret resolver remain injected responsibilities. The required Railway GraphQL fields are partly speculative/acknowledged unavailable in the author handoff. Query shape, token scope, complete live pagination and actual response semantics have not been validated here. Missing fields fail closed, but mocked success cannot establish a usable authentic transport.

The role count query supplies schema receipt count, not exact migration hashes. The adapter checks schema version 22; the runner still owns exact approved schema receipt/source validation. Ordinary session-statistics observations and read-only catalog transactions do not create a continuous writer hold.

## Passing checks and limitations of tests

- Frozen focused suites: **25 pass, 0 fail, 139 assertions**, Bun 1.3.12.
- Strict TypeScript for transport source/test: exit 0, no diagnostics.
- Independent negative-control probe: **10 checks passed**. Construction had zero fixture calls; valid-target scale refused ATOMIC_CAS_UNAVAILABLE_NO_MUTATION before resolver/HTTP; duplicate deployment ID/cursor, missing hasNextPage, unknown deployment status, wrong environment/project and GraphQL errors all refused.
- Four independent observation/phase/dependency/target probes produced the outputs recorded above. They used only in-memory fixtures imported from declarations before the first test via Bun.Transpiler. No permanent probe files or external calls.
- No native SQL grants, scheduler jobs, real PostgreSQL failure, provider introspection, TLS transport or credential handling were exercised. SQL-coverage findings are explicit static analysis rather than fabricated native test results.

Commands:

```text
bun test tools/staging/hosted-setup-gate-transport.test.ts tools/staging/hosted-setup-write-gate-adapter.test.ts tools/staging/hosted-setup-write-gate.test.ts
bun x tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --strict --skipLibCheck tools/staging/hosted-setup-gate-transport.ts tools/staging/hosted-setup-gate-transport.test.ts
```

## Frozen evidence and next owner

Initial/final hashes match the assignment.

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-gate-transport.ts | 88a12ecc8422b9acd2cc686980444f48bd94c43f1ae7c4ac58d3c9e65b913aca |
| tools/staging/hosted-setup-gate-transport.test.ts | e914f02d381aa0556105e35589a20aec7f5876acc9f895bd4ceaa45d82bfa39e |
| evaluations/research-qa/hosted-setup-01-gate-transport-author.md | 3980758ebaacb2b44a68418affa9abff39724cce596e2f402f8c0c2d270f3588 |

Next owner: root/CTO. Given the proposed locked-transaction maintenance design, decide whether to retire/de-scope this CAS-dependent gate transport instead of expanding it. If retained or reused, return F01-F04 and per-mutation target checks to the author and require independent exact-byte review. Safe no-CAS refusal is not a release blocker that must be bypassed; it is an honest unsupported operation. No live stop, migration, deployment or publication authority is granted.

Only this assigned report was written permanently. No source, shared operations/notes, Git, external network/provider/database, ENV or real secret actions occurred. Bounded managed-worktree permission escalation was used for local mock tests and report writing.

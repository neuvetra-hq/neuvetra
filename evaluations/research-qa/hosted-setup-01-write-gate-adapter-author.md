# Hosted setup write-gate adapter — author handoff

Date: 2026-09-26  
Task: `HOSTED-SETUP-GATE-ADAPTER-01`  
Role: security/reliability engineer under the CTO  
Requested compute: Astra/high  
Observed compute: unknown (not exposed in this worker)  
Review status: **author candidate; independent review required**

## Bounded result

The new `tools/staging/hosted-setup-write-gate-adapter.ts` adapts separately authorized Railway and PostgreSQL clients to the already reviewed `HostedSetupGateOperations` interface. Importing and constructing it perform no network, provider, database, filesystem, environment, logging, or secret-resolution action. All effectful clients and opaque secret handles are injected.

It binds the existing exact project/profile, Railway project/environment/service, prior deployment/commit, region, and PostgreSQL runtime role. It refuses:

- incomplete Railway service or Relay-style deployment pagination (`enumerationComplete`, pages read, node count, and `hasNextPage` must close consistently);
- more than one active deployment, any unlisted active region, any replica on an inactive deployment, or drift from the exact prior deployment identity;
- source auto-deploy, image auto-update, scheduled deployment, pending deployment, or pending configuration changes;
- a scale result without the exact target, exact all-zero region set, successful application, and a compare-and-swap configuration version transition;
- incomplete PostgreSQL inventory; project/profile/schema/role drift; superuser or BYPASSRLS runtime role; direct table/column writes; routine-set drift from the observed 66-signature cardinality; privilege-escalation paths; another application writer role; scheduled writer jobs; or malformed/duplicated sessions;
- an inconclusive `ALTER ROLE ... CONNECTION LIMIT 0` result or incomplete runtime-session termination;
- network, DNS, TLS, timeout, authentication, wrong-project, wrong-role, or wrong-SQLSTATE outcomes as proof of login refusal. Only a server-reached PostgreSQL refusal for the exact runtime role/project with SQLSTATE `53300` is accepted.

The adapter passes the same opaque authorization-handle objects only to their purpose-matched client. It neither resolves nor serializes secret values. The implementation deliberately contains no Railway token lookup, PostgreSQL connection string, `process.env`, provider SDK singleton, `fetch`, console output, or top-level execution.

## Railway semantics and injected-client boundary

Railway documents `railway scale REGION=0` as an environment patch that removes replicas from that region, including multiple region assignments, and documents its public API as GraphQL with Relay pagination. The adapter therefore requests a complete service/deployment inventory, requires pagination closure, examines every returned deployment and region, and sends one exact region-zero patch with a configuration-version precondition. It does not request a redeploy. References:

- https://docs.railway.com/cli/scale
- https://docs.railway.com/deployments/scaling
- https://docs.railway.com/integrations/api/manage-services
- https://docs.railway.com/integrations/api/graphql-overview

The authorized Railway client remains responsible for authentic GraphQL transport, traversing every Relay page, and producing the declared full inventory. The authorized PostgreSQL client remains responsible for transactionally obtaining the declared complete role, ACL, routine, job, and session inventory. These transports are intentionally outside this adapter and require their own review before live use. A caller-supplied assertion is not live evidence by itself.

## Explicit unresolved hold

`HOSTED_SETUP_PRIVILEGED_WRITER_HOLD` is fixed to `unresolved-provider-admin-continuous-write-exclusion`. The adapter counts active or transaction-open privileged sessions so the gate component refuses sampled activity. It does not terminate provider/admin sessions, revoke privileged credentials, acquire a global database lock, or prevent an idle privileged account from writing after an observation. Zero sampled privileged activity is not a continuous exclusion lease.

Before migration execution, a separately reviewed operator control must continuously prevent provider/admin writes from the initial preflight through migration commit and receipt persistence, or execution must fail closed. The adapter does not claim that requirement is satisfied. The existing gate receipt's `providerPrivilegedSessionsExcluded: true` remains an explicit limitation, not an approval.

## Local validation

No hosted provider or database call was made. No ENV file, token, connection string, archive, or retained restore clone was read. No Git command or shared status/operations file was changed.

Commands run from `C:\Users\nimab\.codex\worktrees\inventory-plan-delivery\Neuvetra`:

```text
bun test tools/staging/hosted-setup-write-gate-adapter.test.ts
5 pass, 0 fail, 42 assertions

bunx tsc --noEmit --skipLibCheck --moduleResolution bundler --module preserve --target es2022 --types bun tools/staging/hosted-setup-write-gate-adapter.ts tools/staging/hosted-setup-write-gate-adapter.test.ts
exit 0, no diagnostics
```

The tests cover inert construction and an integrated synthetic gate acquisition; exact opaque-handle routing; complete deployment-page and region checks; inactive replicas; automatic and pending provider changes; target drift; direct or escalated database writers; routine cardinality drift; jobs; malformed sessions; sampled privileged activity; exact connection-limit/login refusal semantics; and inconclusive scale/termination results.

## Non-claims and next review

This candidate is not a live launcher, migration authorization, provider approval, secret authorization, proof of current hosted state, or continuous privileged-writer hold. It has not been independently reviewed. Independent QA should challenge the injected-client completeness contract, Relay traversal/read consistency, configuration-version compare-and-swap semantics, provider auto-deploy coverage, PostgreSQL catalog and scheduled-job coverage, SQLSTATE `53300` interpretation, secret-handle behavior, and the unresolved privileged/admin hold before any live integration.

# Hosted setup write-gate adapter repair — author handoff

Date: 2026-09-26  
Task: `HOSTED-SETUP-GATE-ADAPTER-REPAIR-01`  
Role: security/reliability engineer under the CTO  
Requested compute: Astra/high  
Observed compute: unknown (not exposed in this worker)  
Status: **Candidate 2 author repair; independent re-review required**

## Repair scope

This candidate changes only:

- `tools/staging/hosted-setup-write-gate-adapter.ts`
- `tools/staging/hosted-setup-write-gate-adapter.test.ts`
- this new repair handoff

It preserves the first independent FAIL at `evaluations/research-qa/hosted-setup-01-write-gate-adapter-independent-review.md`. No gate-component, migration, shared operation, provider, database, ENV, secret, archive, or Git action occurred.

## Findings addressed

### F01 — deployment active-state ambiguity

Every returned deployment must now have `active` with the primitive boolean type before the active set is derived. Positive replicas are permitted only on the strictly active exact deployment. A missing, null-like, string, or numeric active marker cannot avoid either active-set or inactive-replica checks.

Regressions cover string and numeric `active`, a missing active field, extra active deployment, inactive positive replica, extra active region, incomplete pagination, and an integrated gate attempt that proves a malformed positive-replica row cannot produce a held receipt or reach scale.

### F02 — mutable handle/client substitution

Construction now reads each target field, authorization purpose/reference, client object, and client method into private local snapshots before any asynchronous work. Authorization snapshots are frozen and are the only handles forwarded. Client functions are read once and bound to the originally supplied client object. Later enclosing-property replacement, nested reference mutation, or client-method replacement cannot retarget an observation or mutation.

Regressions mutate the input properties and client methods while a database observation is pending, then prove that only the originally captured purpose/reference values and methods are used. Stateful authorization and method getters are also read exactly once.

### F03 — provider CAS/interleaving

Provider operations are mutually exclusive. Scale captures the exact observed configuration version in a local before awaiting the client and compares the result's prior version to that request-local value. An overlapping observation is refused. A scale attempt is single-use; any thrown call or invalid/ambiguous result leaves provider state uncertain and permanently refuses further adapter provider operations. After a valid result, subsequent observations must report the exact returned configuration version and zero replicas.

The independent request-v1/response-prior-v2 scenario now fails. The regression also confirms the overlapping observation is rejected and the uncertain adapter does not permit another observation or retry.

Database operations now use the same exclusive, no-retry treatment for connection-limit and session-termination mutations. An uncertain mutation result cannot authorize another attempt through the same adapter instance.

### F04 — role-specific connection refusal

Generic SQLSTATE `53300` is no longer representable as acceptable proof. Before changing the role limit, the adapter uses the exact captured runtime credential to require a successful connection to the exact project/database/endpoint fingerprint with `role`, `sessionUser`, and `currentUser` all equal to `neuvetra_runtime`. It binds subsequent catalog observations and the refusal to that endpoint fingerprint.

After the catalog-observed connection limit becomes zero, the adapter accepts only a server-reached, credential-accepted startup refusal with all of:

- exact runtime role, project, database, and previously proved endpoint fingerprint;
- SQLSTATE `53300` and severity `FATAL`;
- PostgreSQL routine `InitPostgres`;
- exact diagnostic `too many connections for role "neuvetra_runtime"`.

Authentication, network, DNS, TLS, timeout, connected, wrong endpoint, wrong role/project, general database capacity, reserved-slot exhaustion, wrong routine/severity/message, and refusal without the known-good credential preflight fail closed. This contract still depends on an independently reviewed PostgreSQL transport preserving authentic server error fields; the adapter cannot make a caller-supplied diagnostic truthful.

PostgreSQL references used for the distinction:

- https://www.postgresql.org/docs/17/errcodes-appendix.html
- https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/init/postinit.c

## Local evidence

From `C:\Users\nimab\.codex\worktrees\inventory-plan-delivery\Neuvetra`:

```text
bun test tools/staging/hosted-setup-write-gate-adapter.test.ts tools/staging/hosted-setup-write-gate.test.ts
15 pass, 0 fail, 94 assertions

bunx tsc --noEmit --strict --skipLibCheck --moduleResolution bundler --module esnext --target es2022 --types bun tools/staging/hosted-setup-write-gate-adapter.ts tools/staging/hosted-setup-write-gate-adapter.test.ts
exit 0, no diagnostics
```

The strict fixture failure reported at Candidate 1 line 143 is corrected with the client interface and explicit `string[]` result typing.

## Preserved limits and live blocker

This remains an inert injected-client adapter, not an executable provider/PostgreSQL transport. Pagination closure, provider version preconditions, authentic error diagnostics, catalog completeness, scheduler coverage, and endpoint fingerprints must be implemented and independently reviewed in the eventual clients. Runtime routine validation still binds cardinality/sorted uniqueness, not an approved 66-signature digest; live integration must supply a separately accepted exact routine-set binding if that stronger claim is required.

Most critically, `HOSTED_SETUP_PRIVILEGED_WRITER_HOLD` remains `unresolved-provider-admin-continuous-write-exclusion`. Sampling zero active privileged sessions does not prevent an idle provider/admin credential from writing after the sample. This adapter does not revoke or terminate privileged access and does not acquire a global database write hold. A separately reviewed continuous privileged-writer suppression from preflight through migration commit and receipt persistence remains a live blocker. Candidate 2 makes no live execution, migration, or publication claim.

# HOSTED-SETUP-GATE-ADAPTER-QA-01 — independent review

Date: 2026-09-26. **Component verdict: FAIL. Live integration verdict: NOT APPROVED.** Three independently reproduced adapter defects break deployment completeness, validated authorization binding and scale-request/result binding. A separate PostgreSQL diagnostic gap prevents SQLSTATE 53300 alone from proving the specific role-limit cause. Local happy-path and supplied negative tests pass; those do not establish provider/client controls.

Reviewer: `/root/write_gate_qa`, independent QA context. This context reviewed the underlying gate component but authored neither the adapter nor its tests. Requested route: gpt-6-astra/high; observed route/cost: unknown. Context inspected: board rebuild brief, agent operating/QA rules retained from this assignment sequence, reviewed gate source and prior gate reviews, adapter source/test/handoff, historical all-writers and gate-capability observations. Only this report was written. No hosted/provider/database/Git action, credential resolution or candidate edit occurred. Local probes used synthetic injected clients. Public primary-source documentation was read for provider and PostgreSQL semantics.

## Findings

### GATE-ADAPTER-F01 — P1: a malformed active flag can hide a second live deployment

Location: adapter lines 138-146. The active set uses `row.active === true`, but the inactive-replica check uses `!row.active`; the row shape never requires a boolean. A second deployment with `active: 'true'` or `active: 1` is therefore excluded from the active set and also excluded from inactive replica enforcement.

Independent repro: retain the exact expected active deployment and add/modify the second deployment to have either malformed flag and one replica in another region/environment. `observeProvider()` succeeds and returns only the expected deployment. Both variants passed despite the explicitly reported additional positive replica. This is an API-validation defect; it does not require omitted pagination or a dishonest completeness assertion.

Repair: require `typeof row.active === 'boolean'` for every returned row before deriving the active set; enforce positive-replica constraints using strict booleans. Add missing/null/string/number active-field cases and an integrated gate case that proves no held receipt is possible while a malformed second row reports a replica.

### GATE-ADAPTER-F02 — P1: validated authorization handles can be replaced before mutations

Location: lines 177-185 and 201-213. Construction validates the three handles, but each operation rereads the mutable `input` object. Freezing the returned adapter does not freeze or capture its input. `readonly` on the handle interface is not a runtime control and does not make the enclosing input property immutable.

Independent repro: create an adapter from valid synthetic handles; replace `input.postgresAdminAuthorization` with `{purpose:'postgres-runtime', reference:'vault://replacement/wrong-role'}`; call `setRuntimeConnectionLimitZero()`. The injected mutation client receives that replacement handle and the adapter accepts its otherwise valid result. No revalidation occurs. A different same-purpose project/credential reference can likewise replace the reviewed one. In a real implementation, the mutation would be attempted before its result could detect a wrong target.

Repair: synchronously capture validated handle identities and stable purpose/reference values at construction. Preserve them through each request, reject later changes where identity must be retained, and pin the reviewed client methods or explicitly enforce immutable client ownership. Test property replacement and nested reference mutation while prior observations are pending. Do not resolve or print actual secrets.

### GATE-ADAPTER-F03 — P1: scale result is compared with a mutable later observation rather than its own request

Location: lines 193-199. `expectedConfigurationVersion` is sent from `lastProviderVersion`, but after the await the result is compared against the then-current shared variable. Another observation can update it during the scale call.

Independent promise repro:

1. `observeProvider()` reports `v1`.
2. Begin `scaleSiteWebToZero()` and hold the injected scale promise pending; its request contains `expectedConfigurationVersion: 'v1'`.
3. Change synthetic inventory to `v2` and complete another `observeProvider()`.
4. Resolve the pending scale with `priorConfigurationVersion: 'v2'`, `configurationVersion: 'v3'`, applied true and valid target/zero regions.
5. Scale succeeds even though the returned prior version differs from the request it is acknowledging.

Repair: capture the exact requested version in a private local before awaiting and compare response prior-version with that local. Serialize mutation state or reject overlapping operations so a later observation cannot silently retarget an in-flight request or overwrite its state. Preserve uncertain outcomes; do not retry an already attempted mutation automatically. The integrated gate currently calls these operations sequentially, but the exported adapter contract does not enforce exclusive ownership and should not claim request-bound CAS validation while this public interleaving passes.

### GATE-ADAPTER-F04 — P1 for live role-fence proof: 53300 does not identify the role-limit cause

Location: result type around lines 102-107 and predicate at 214. PostgreSQL defines 53300 as the general `too_many_connections` condition. PostgreSQL 17 also raises that condition for database connection limits and reserved/global connection-slot exhaustion, not only the runtime role's limit. See the official [error-code table](https://www.postgresql.org/docs/17/errcodes-appendix.html) and [PostgreSQL 17 startup implementation](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/init/postinit.c), database-limit branch at source lines 356-363 and reserved-slot branches at 894-907.

The injected result schema has no causal discriminator or retained server diagnostic. An independent synthetic response with the accepted project/role/code and an added diagnostic marker `reason: 'global-reserved-slots-exhausted'` returns true because that marker is ignored. This probe does not claim any live server exhausted connections; it demonstrates that this API has no way to reject an unrelated capacity cause. Catalog limit zero and a sampled refusal are useful separate observations, but transient unrelated capacity cannot prove that the configured role fence caused the refusal.

Before live use, make the trusted transport distinguish a verified role-limit rejection from database/global/pool capacity, wrong credentials and network/TLS/DNS/timeout failures. Define sanitized, exact server-diagnostic evidence and endpoint/role binding; fail closed when causality is ambiguous. If the intended claim is only that one new connection failed at one instant, narrow the claim explicitly and do not use it as causal proof of the lasting runtime fence. No actual PostgreSQL connection-limit exercise was performed here.

## Test evidence and typecheck distinction

| Check | Observed result |
| --- | --- |
| `bun test tools/staging/hosted-setup-write-gate-adapter.test.ts tools/staging/hosted-setup-write-gate.test.ts`, Bun 1.3.12 | 11 pass, 0 fail, 80 assertions |
| Author's exact non-strict focused TypeScript command | Pass, no diagnostics |
| Same focused source/test check with `--strict`, ESNext module and bundler resolution | Fail: adapter test line 143 assigns `remainingPids: string[]` to inferred `never[]` |
| Malformed extra deployment `active: 'true'`, positive replica | Incorrectly accepted |
| Malformed extra deployment `active: 1`, positive replica | Incorrectly accepted |
| Replace admin input handle after construction | Replacement wrong-purpose handle forwarded; mutation accepted |
| Concurrent provider observation changes scale prior-version comparison | Request v1 / response prior v2 incorrectly accepted |
| Replace all 66 routine identities while retaining count/order/uniqueness | Accepted; cardinality-only limitation confirmed |
| General-capacity 53300 synthetic result | Returns true; role-specific cause not represented |

Author command independently reproduced:

```text
bun x tsc --noEmit --skipLibCheck --moduleResolution bundler --module preserve --target es2022 --types bun tools/staging/hosted-setup-write-gate-adapter.ts tools/staging/hosted-setup-write-gate-adapter.test.ts
```

The stricter compile failure is a test-fixture inference issue, not evidence of hosted malfunction. Repository base configuration enables strictness; type the client fixture explicitly or give `remainingPids` its intended string-array type. The report preserves the successful author command separately from the stricter reviewer result. Execution required reviewed permission escalation to read/run Bun in the managed worktree. No external/provider calls were made by tests or probes.

## Accepted controls and remaining coverage

- Construction is inert; constants bind the expected project/profile, Railway project/service/environment, deployment/commit/region and runtime role. Supplied tests confirm the integrated synthetic gate order, successful request counts, no handle values in receipts/journals and failure on several identity/automation/writer cases.
- Pagination flags/counts, zero pending changes and all three automation booleans are strictly checked. Returned active region coverage is constrained and nonzero inactive replicas are rejected when flags are valid. These are checks of the declared inventory; no GraphQL Relay traversal, snapshot consistency, environment enumeration or authentic target transport is implemented here. Duplicate deployment identities and omission detection still require concrete collector review.
- Railway documents zero replicas through a single environment patch without a separate redeploy. The [official scale documentation](https://docs.railway.com/cli/scale) supports that behavior. It does not, by itself, prove the adapter's abstract configuration-version CAS can be implemented atomically by the eventual client. Independently review the actual endpoint/precondition behavior and ambiguity handling.
- Database completeness, role safety, zero direct table/column privileges, empty escalation/other-writer/job lists and session shapes are checked. However the adapter does not query PostgreSQL catalogs or schedulers; `complete` and empty lists are transport assertions. The eventual inventory must include inherited/SET ROLE paths, security-definer functions/procedures, all relevant schemas and external/pool/job writers. Historical capability observation at 10:39:32 UTC explicitly contains no ALTER ROLE or termination proof.
- Runtime routine validation establishes 66 sorted unique nonempty signatures, not equality to 66 approved signatures or definitions. Independent replacement of all names with `unexpected.*` retained acceptance. The author calls this cardinality drift detection, which is accurate; an exact reviewed routine-set guarantee needs a retained expected signature/digest binding and cannot be inferred from the historical count.
- Both active and transaction-open privileged sessions contribute to the sampled activity count. Idle privileged sessions remain allowed. This is an honest exclusion already identified in the component review; `HOSTED_SETUP_PRIVILEGED_WRITER_HOLD` does not enforce a hold. The historical all-writers observation lists writable postgres/supabase_admin accounts and explicitly disclaims global exclusion. An independently reviewed continuous operator control remains a live blocker.
- Network, DNS, TLS, timeout, authentication-refusal, connected and wrong-code cases tested by the supplied suite return false. Mutation result shape checks reject unchanged scale versions, wrong region/target/role/limit/tag and reported incomplete termination in the tested branches. A success-shaped response is not proof of the requested external action; authenticity and durable reconciliation remain trusted-client responsibilities.
- The underlying gate's durable journal, same-path replay refusal and post-stop uncertainty behavior remain bounded by its prior review. The adapter is neither a one-time launcher nor a global execution ledger. Injected clients must not be substituted between validated observations and mutations; no live operator composition has been accepted.

## Exact reviewed bytes

Hashes collected before tests and rechecked before report delivery:

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-write-gate-adapter.ts` | `a6901111f0abdcd5420f994942e0ffcfe309fe0577505f68380bc424da836cca` |
| `tools/staging/hosted-setup-write-gate-adapter.test.ts` | `db4db9c8305a8673b4d4f4e4b164fc66a26945f9fa0adc1baad6b36b9cf8009f` |
| `evaluations/research-qa/hosted-setup-01-write-gate-adapter-author.md` | `1c02be023daa3ca464191a3f876520587d6a9fa03555430fc0b31e1da0859efc` |
| `tools/staging/hosted-setup-write-gate.ts` | `893abc3034ef930e2458647036cc624d02a6fe74c2719527e2e72db71450f8c0` |

Next owner: adapter author under root/CTO. Preserve this first FAIL, repair the independently reproduced boundary defects, resolve the diagnostic contract, and return changed bytes and adversarial regressions for independent review. No component or live integration acceptance is granted by this report.
# HOSTED-SETUP-WRITE-GATE-QA-01 independent review

Date: 2026-09-26. Reviewer: separate `/root/write_gate_qa` execution context, security/reliability role, QA sponsor. The reviewer did not author the candidate. Requested compute: gpt-6-astra/high; observed model/effort and cost: unknown. Role prompt SHA-256: `3b3c1d31d5e5e35bf90ad971d4511a7693b7f14d12f2eb7ac0ed4723cc0b79d3`.

**Verdict: FAIL. Do not use these candidate bytes to authorize a live operator integration or schema upgrade.** Strict observation validation has a reproducible fail-open defect. The broader held-gate claim also lacks a continuous hold/fencing contract. Local sequencing and several failure controls work, but they do not establish actual Railway or PostgreSQL controls. No hosted mutation, provider query, credential access, database connection, Git action or candidate edit was performed by this reviewer.

## Reviewed versions

Exact on-disk SHA-256 values before testing (rechecked before report delivery):

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-write-gate.ts` | `095a48a70b13a0097dac332713efb1a2a37e581f2e84ab815f39cc95de8ffbd6` |
| `tools/staging/hosted-setup-write-gate.test.ts` | `03827e74bc83946eba933e846d795623d69c80e09dc6954b240987bf109792f9` |

Context inspected: agent operating model and security role; repository instructions; leading board report, continuation and task-ledger sections; corporate direction and roadmap; agent improvement instructions, role route and lessons; the board's `C:/Users/nimab/Neuvetra/notes/briefs/2026-09-25-hosted-setup-rebuild-brief.md`; and `evaluations/research-qa/hosted-setup-01-all-writers-observation-20260926.json`. The latter is explicitly historical read-only design input, not a held gate. The candidate's imported `hash` implementation in `hosted-setup-upgrade.ts` was read as supporting context; this is not a review of that whole dependency graph. Lessons applied: L06 malformed and missing fields; L01 stale observations during pending operations; L05 uncertain outcomes and no replay.

## Findings

### WG-F01 — P1: unknown privilege flags pass as known-safe, and an untyped login result can pass as refusal

At line 98, `!value.runtimeRoleSuperuser && !value.runtimeRoleBypassRls` accepts absent fields, `null`, zero and empty strings. Independent runs deleting both fields, and separately setting both to null, each performed scale/limit/terminate and returned `application-writer-gate-held`. The caller has supplied no evidence that the role is nonsuperuser or NOBYPASSRLS. TypeScript declarations do not validate runtime provider/SQL adapter results.

At line 108, `check(await ops.runtimeLoginRefused(), ...)` accepts any truthy value. An independent probe returning the string `'false'` produced a receipt with `runtimeLoginRefused: true`. This does not prove the current typed fixture or a future correctly implemented adapter returns a string; it demonstrates the public boundary is not fail-closed against malformed observation data.

Required repair: insist on explicit `=== false` for both unsafe privilege flags and `=== true` for successful login refusal evidence. Exercise missing, null and wrong-type values in the real exported boundary. The adapter must distinguish the expected database refusal from timeout, DNS, transport or wrong-credential errors; this module currently has no typed refusal evidence for that distinction.

### WG-F02 — P1 for live integration: a sampled observation is promoted to a held gate without fencing intervening changes

`held()` (lines 104-108) reads provider, then database, then awaits a login probe. Neither the interface nor receipt binds a lease, provider configuration generation, deployed instance inventory, database lock or other continuing ownership mechanism. Independent probes demonstrated:

1. Begin with valid initial state. During the final `observeDatabase()` call (recognizable by runtime connection limit zero), set provider replicas back to 1, then return the valid database observation. Acquisition returns a held receipt claiming `providerReplicas: 0`, while mock actual replicas are 1.
2. During `runtimeLoginRefused()`, set privileged active sessions to 1 and return true. Acquisition returns a held receipt claiming `privilegedActiveSessions: 0`, while mock actual count is 1.

These are synthetic interleavings, not a claim that live Railway or PostgreSQL exhibited either race. The first alone does not establish resumed application writes because the runtime limit remains zero; it does falsify the receipt's exact provider-state claim. The second exposes the known privileged-writer exclusion: the historical inventory explicitly says provider/operator sessions can write. Repeating observations can narrow a race window but cannot itself establish a continuous stop.

Required disposition: define the gate honestly as a bounded application-role stop and supply independently reviewed operator/provider controls that maintain the expected service/deployment configuration; explicitly exclude and control privileged writers through the actual upgrade transaction and preservation checks. If a true continuously held gate is claimed, return an enforceable lease/lock ownership contract with invalidation and bind its use to the upgrade. A stale receipt alone must never authorize a later mutation. Review the resulting adapter and upgrade integration before any live use.

## Independent execution and evidence

`bun test tools/staging/hosted-setup-write-gate.test.ts` on Bun 1.3.12: **4 pass, 0 fail, 28 assertions**. The first sandbox invocation returned EPERM before loading tests (0 pass, 1 fail, 1 error). A reviewed permission escalation allowed the same local-only test command; no hosted action occurred. This environmental failure is preserved here rather than reported as a candidate test failure.

A separate in-memory probe imported the unchanged module with actual exported constants. Provider/database operations and journal/receipt writers were mock callbacks; no files or external connections were created by that probe. Observed outcomes:

| Probe | Observed result |
| --- | --- |
| Delete superuser and bypass-RLS fields | Incorrect held receipt; scale, limit, terminate called |
| Set both privilege fields to null | Incorrect held receipt; scale, limit, terminate called |
| Login callback returns string `false` | Incorrect held receipt with refusal true |
| Resume provider during final database observation | Incorrect zero-replica held receipt; actual mock replicas 1 |
| Start privileged activity during login probe | Incorrect zero-privileged-activity receipt; actual mock count 1 |
| Receipt writer throws after stop | `HS_GATE_OUTCOME_UNCERTAIN_KEEP_STOPPED`; no automatic reopen |
| Journal reservation append throws | `HS_GATE_REFUSED_BEFORE_MUTATION`; zero provider/DB mutations |
| Independently change each of 8 provider fields | 8/8 refusals before mutation |

Provider fields individually challenged: projectId, environmentId, serviceId, deploymentId, deployedCommit, region, replicas, deploymentStatus. These establish strict matching against module constants, not that the constants or API observations describe today's live service.

Minimal reproducible changes to the supplied fixture, each run in a fresh fixture with acquisition inputs otherwise unchanged:

```ts
// WG-F01: each currently returns a held receipt.
delete (f.currentDatabase as any).runtimeRoleSuperuser;
delete (f.currentDatabase as any).runtimeRoleBypassRls;
// Separate run:
(f.currentDatabase as any).runtimeRoleSuperuser = null;
(f.currentDatabase as any).runtimeRoleBypassRls = null;
// Separate run:
f.ops.runtimeLoginRefused = (async () => 'false') as any;

// WG-F02: separate run, provider resumes after final provider sample.
f.ops.observeDatabase = async () => {
  if (f.currentDatabase.runtimeConnectionLimit === 0)
    f.currentProvider.replicas = 1;
  return {...f.currentDatabase};
};
// Separate run, privileged activity begins after DB sample.
f.ops.runtimeLoginRefused = async () => {
  f.currentDatabase.privilegedActiveSessions = 1;
  return true;
};
```

## Controls that passed and remaining boundaries

- Initial provider identity/commit/region/status/single-replica checks reject observed mismatch before mutation. Schema 22, runtime identity, exact connection limit, integer session counts, zero other application writers and zero privileged active sessions are checked. The supplied tests exercise mismatched commit, privileged/application writer counts and initial limit.
- The default journal uses exclusive creation, hash-linked sequence entries and file sync before the first mutation. Reusing the same journal path is refused. Supplied tests exercised the real temporary journal and receipt paths. Independent fault injection confirmed failed reservation causes no mutations and failed receipt persistence remains uncertain without auto-reopening. Storage-device crash durability and Windows ACL protection were not tested; mode 0600 alone is not reviewed Windows ACL evidence.
- Replay prevention is scoped to the chosen journal pathname. Inputs permit a fresh filename and contain no fixed durable operation identity or accepted-journal registry. Integration must pin and preserve the authoritative attempt path, never reinterpret uncertainty as permission to start over. No replay of a live attempt was performed.
- `writerInventorySha256` and `gateCapabilitySha256` are only syntactically checked and copied. Their underlying bytes, provenance, freshness, acceptance and relation to the current target are not verified by this module. Separate concrete integration must supply that evidence. This is an explicit dependency, not a claim that this orchestration library already validates inventory.
- `otherApplicationWriterRoles: 0` compresses a material inventory into a number. A live adapter must include role memberships/role assumption, direct and column grants, executable write-capable security-definer routines, pooled sessions, job writers and every relevant application schema. The historical inventory records 66 runtime-executable routines, 212 for each of postgres/supabase_admin, and privileged sessions. Its own limitations require membership and privileged-access review.
- `privilegedActiveSessions: 0` does not attest that idle privileged sessions cannot begin a write or that no privileged transaction is open. `providerPrivilegedSessionsExcluded: true` accurately signals an exclusion but does not resolve it. No global database write lock or provider/operator suppression was tested.
- The provider interface represents a single deployment and region. It cannot independently prove absence of other active deployments, regions, replicas or automatic redeployment. The adapter must enumerate and validate that coverage and maintain the stop through the actual upgrade.
- Receipt failures can leave an earlier `application-writer-gate-held` journal entry followed by uncertainty. Consumers must require the completed receipt and reconcile the entire journal; they must not accept an intermediate status line alone. The synthetic receipt-failure probe confirmed this sequence.
- Paths are checked lexically relative to process cwd; this is not a canonical repository-root/symlink privacy boundary. Keep exact private paths under reviewed operator ownership. No path traversal or ACL exercise was performed.

## Next owner and acceptance

Root/CTO owns repairs and concrete operator integration. Preserve this first FAIL and the original reviewed hashes. Return strict-validation fixes and the explicit continuing-hold/privileged-writer disposition for targeted independent review. Then independently exercise the real target adapter, capability evidence, durable attempt identity, current writer inventory and exact publication/upgrade composition before live use. Supplied local tests do not prove provider stop behavior, database capability, current deployment identity, or safe hosted mutation. The task handoff says the live site remains on schema 22/prior application with no held gate; this reviewer did not independently refresh that live state.
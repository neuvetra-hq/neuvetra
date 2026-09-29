# Hosted setup write-gate adapter repair 2 — author handoff

Date: 2026-09-26  
Task: `HOSTED-SETUP-GATE-ADAPTER-REPAIR2`  
Role: security/reliability engineer under the CTO; CEO sponsor  
Requested compute: critical `gpt-6-astra`/high  
Observed compute: unknown (not exposed in this worker)  
Status: **Candidate 3 author repair; independent review required**

## Bounded repair

Candidate 3 repairs only `GATE-ADAPTER-F05` from `hosted-setup-01-write-gate-adapter-independent-review2.md`. PostgreSQL 17 emits the role-specific connection-limit report from `InitializeSessionUserId` in `src/backend/utils/init/miscinit.c`. The adapter and realistic positive fixture now require the exact protocol routine field `InitializeSessionUserId`. They no longer accept the source-inconsistent `InitPostgres` value.

The predicate remains narrow. Acceptance still requires the prior known-good exact runtime credential and endpoint preflight, catalog-observed role limit zero, server reached, credential accepted, the exact runtime role/project/database/endpoint fingerprint, SQLSTATE `53300`, severity `FATAL`, routine `InitializeSessionUserId`, and exact role-specific message `too many connections for role "neuvetra_runtime"`.

The existing regression now explicitly refuses:

- `InitPostgres` even when every other field and the role-specific message match;
- reserved/global-capacity wording;
- a different role and its corresponding message;
- a different endpoint fingerprint;
- authentication refusal;
- network, DNS, TLS, and timeout failures;
- a successful connection after the role fence.

Primary sources:

- PostgreSQL 17 role-limit implementation: https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/init/miscinit.c
- PostgreSQL error-response routine field: https://www.postgresql.org/docs/17/protocol-error-fields.html
- PostgreSQL error codes: https://www.postgresql.org/docs/17/errcodes-appendix.html

## Local validation

Run from `C:\Users\nimab\.codex\worktrees\inventory-plan-delivery\Neuvetra`:

```text
bun test tools/staging/hosted-setup-write-gate-adapter.test.ts tools/staging/hosted-setup-write-gate.test.ts
15 pass, 0 fail, 97 assertions

bunx tsc --noEmit --strict --skipLibCheck --moduleResolution bundler --module esnext --target es2022 --types bun tools/staging/hosted-setup-write-gate-adapter.ts tools/staging/hosted-setup-write-gate-adapter.test.ts
exit 0, no diagnostics
```

No hosted/provider/database call, ENV or secret access, archive access, Git action, or shared operations edit occurred.

## Preserved limits

This remains an inert adapter over injected transports. Authentic error-field transport, endpoint binding, provider pagination/CAS, catalog and scheduler completeness, and the exact approved runtime routine set still require separate implementation and independent review.

The continuous privileged/admin writer hold remains unresolved. Sampled zero privileged activity does not exclude a later write from an idle provider/admin credential. The adapter neither revokes privileged access nor holds a global database write fence. A separately reviewed continuous hold from preflight through migration commit, postcommit checks, and durable receipt persistence remains a live blocker. Candidate 3 grants no live gate, migration, deployment, or publication authority.

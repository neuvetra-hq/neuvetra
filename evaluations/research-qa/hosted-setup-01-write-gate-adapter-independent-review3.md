# Hosted setup write-gate adapter independent review 3

Date: 2026-09-26. Task: HOSTED-SETUP-SAFETY-QA4. Independent QA/security reviewer: `/root/source_lock_holistic_qa`; CEO sponsor. Requested registry compute: critical gpt-6-astra/high. Observed model, effort and cost: unknown. Reviewer did not author the candidate. Applied repository AGENTS and QA/security role instructions; prior FAIL reports remain unchanged.

## Verdict

**PASS, bounded Candidate 3 adapter component.** GATE-ADAPTER-F05 [P1] is repaired. No new material defect found in this exact diagnostic change or the retested F01-F04 boundaries. This does not approve a live write gate, migration, deployment or publication. Concrete authenticated transports and continuous privileged/admin write exclusion remain missing integration requirements.

## Primary evidence and exact positive result

Re-read the official [PostgreSQL 17 miscinit.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/init/miscinit.c): function declaration at lines 714-716, role-limit condition and report at 820-827. The reporting routine is InitializeSessionUserId. The [protocol definition](https://www.postgresql.org/docs/17/protocol-error-fields.html), lines 93-96, defines field R as the reporting source routine. Candidate line 267 now matches this profile. This source verification was read-only, not a native PostgreSQL connection experiment.

After a successful exact-credential preflight and catalog-observed role limit zero, I independently injected this authentic-shaped result:

```json
{"kind":"role-connection-limit-refusal","serverReached":true,"authenticated":false,"credentialAccepted":true,"role":"neuvetra_runtime","projectRef":"icockcoguyadhryzydvl","database":"postgres","endpointFingerprintSha256":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","sqlState":"53300","severity":"FATAL","routine":"InitializeSessionUserId","message":"too many connections for role \"neuvetra_runtime\""}
```

`runtimeLoginRefused()` returned true. With the same diagnostic injected immediately after the synthetic role-limit mutation, the actual `acquireHostedSetupWriteGate` composition returned `application-writer-gate-held`, wrote one in-memory receipt and called scale, limit and terminate exactly once each. Replacing only routine with InitPostgres produced no receipt after the mutations; the gate refused and retained the need for reconciliation.

## Independent evidence map

Reviewer-written stdin probe: **43 counted checks passed**. It imported the actual frozen adapter/gate modules, transpiled only the fixture declarations before the first test from the frozen test file using Bun.Transpiler, and supplied synthetic clients. No permanent probe file, transport or real journal/receipt was used.

| Boundary | Probe and observed disposition |
| --- | --- |
| F05 authentic native profile | Positive object above accepted; integrated held receipt succeeds. Former wrong routine rejected. |
| F04 false-positive diagnosis | Sixteen variants rejected: InitPostgres, absent routine, global capacity message, database capacity message, reserved-slot message, other-role message, different role, endpoint, project or database, SQLSTATE 28P01, severity ERROR, missing credentialAccepted, authenticated true, serverReached false, authentication-refusal kind. No tested false positive accepted. |
| F01 malformed active flags | Missing, null, string true, 1, 0 and object on a second positive-replica deployment all refused before scale. Existing integrated regression also verifies no held receipt. |
| F02 handle/method swapping | While inventory was pending, replaced the admin handle, nested runtime reference and mutation method; frozen original handles and captured original method were retained. Existing suite additionally checks getter counts. |
| F03 overlapping CAS | Pending scale blocks both observation and a second scale; response prior configuration-2 against requested configuration-1 refuses. Another scale remains blocked after uncertainty. |
| Privileged accounting | Idle privileged session counts zero; transaction-open privileged session counts one. Explicit unresolved continuous hold marker retained. These are samples, not exclusion of future writes. |
| No replay | Existing mutation uncertainty regressions pass. Per-instance exclusion is not a durable global once-only ledger. |

To reproduce the diagnostic core with the fixture, use `f=fixture(); ops=f.adapter(); await ops.observeDatabase(); await ops.setRuntimeConnectionLimitZero(); f.setLogin(diag); await ops.runtimeLoginRefused()`. For integrated reproduction, wrap the fixture's setRoleConnectionLimit method before constructing the adapter, set the injected login result after its successful return, then call acquireHostedSetupWriteGate with in-memory openJournal/writeReceipt. Probe stdout: `{"probe":"QA4 adapter","checks":43,"status":"PASS"}` plus the diagnostic above.

## Validation and frozen bytes

From the managed worktree, ran:

```text
bun test tools/staging/hosted-setup-upgrade.test.ts tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-write-gate-adapter.test.ts tools/staging/hosted-setup-write-gate.test.ts --timeout 30000
41 pass, 0 fail, 238 expect() calls (Bun 1.3.12)

bun x tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --strict --skipLibCheck tools/staging/hosted-setup-upgrade.ts tools/staging/hosted-setup-upgrade.test.ts tools/staging/hosted-setup-source-lock.ts tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-write-gate-adapter.ts tools/staging/hosted-setup-write-gate-adapter.test.ts tools/staging/hosted-setup-write-gate.ts tools/staging/hosted-setup-write-gate.test.ts
exit 0, no diagnostics
```

Initial and final candidate hashes matched.

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-write-gate-adapter.ts | 569e74a4c2f79087e31f643e078d7b0c67a80da0f847c79dcdbd67949343efd7 |
| tools/staging/hosted-setup-write-gate-adapter.test.ts | b9eb12a7aba4890e4c597eadf2bb61cfabd3be5271bc6f8cbd874d7ca7bb1b33 |
| tools/staging/hosted-setup-write-gate.ts | 893abc3034ef930e2458647036cc624d02a6fe74c2719527e2e72db71450f8c0 |
| tools/staging/hosted-setup-upgrade.ts (imported hash helper) | 919153fbabc3e600b697cd589d3331d2f02ab41fa345468fcccb22bca3b9a329 |
| evaluations/research-qa/hosted-setup-01-write-gate-adapter-repair2-author.md | a76383f9460cd84d1939fdde290597b2282dd0e448789e7ec3e9ec9b3beac9f3 |

## Remaining boundaries and next owner

Root/CTO owns concrete integration. `HOSTED_SETUP_PRIVILEGED_WRITER_HOLD` remains unresolved-provider-admin-continuous-write-exclusion: an idle privileged credential may write after observation. Continuous hold must span preflight, migration, postcommit and durable receipt. The predicate consumes assertions from trusted injected clients; a forged all-matching object is not authenticated by this adapter. Transport must establish raw diagnostic provenance, endpoint identity, known-good credential disposal, PostgreSQL version/locale profile, complete provider pagination/CAS and scheduler/catalog inventory. Exact approved routine identity remains outside the cardinality check. Different locale/version/error fields fail closed and require explicitly reviewed support rather than a looser diagnostic predicate.

Underlying gate input/path composition, current provider authority, actual source attestation and live approval remain outside this bounded repair. Do not treat sampled runtime-role fencing as all-writer exclusion. No hosted/provider/external DB, ENV, Git or operations mutation was performed. Local tests/report writes used bounded managed-worktree permission escalation. Next owner: root/CTO can accept these exact component bytes, preserve historical FAILs and route the missing integration controls to separate implementation and independent review.

# HOSTED-SETUP-RAILWAY-ADAPTER-REPAIR-01 — author handoff

Date: 2026-09-26. Mode: security/reliability repair under CTO. Author: `/root/txn_runner`. Requested critical registry route: `gpt-6-astra` / `high`; the follow-up runtime exposed no model, effort, token-use or cost telemetry, so observed settings are unknown. This is author evidence and requires independent re-review.

No Railway, provider, database, deployment, scale, stop, ENV, secret, Git, network or live action occurred. The original independent **FAIL** remains preserved at `evaluations/research-qa/hosted-setup-01-railway-cli-adapter-independent-review.md`, SHA-256 `876ccb885ef0efde9ec0a2578c733374d93196067a3e2540886fad757921bdb3`.

## Reproduction before repair

The frozen independent probe, SHA-256 `84d2714aba760881cc7abbae1dca4c850ffbb6a0798d7649facb16bf863a1c6b`, reproduced against Candidate 1 before edits: **4 pass, 2 fail, 145 expectations**. In both failing cases, the two public observation strings were identical and the scale mock executed once:

- both active/latest runtime instance IDs changed from `22222222-2222-4222-8222-222222222222` to `33333333-3333-4333-8333-333333333333`;
- both active/latest image digests changed from `sha256:` plus 64 `a` characters to `sha256:` plus 64 `b` characters.

## Repair

The public `MaintenanceObservation` and receipt remain unchanged. Internally, every parsed observation now carries:

- an immutable identity containing the pinned deployment ID/status/commit, its validated image digest and the canonical full GraphQL deployment inventory of ID/status/commit rows;
- a phase identity containing that immutable identity plus the canonical active/latest runtime instance ID/status set.

The two preflight reads must match the entire phase identity. The two postflight reads must separately match their entire phase identity. Every postflight must also match the preflight immutable identity. Runtime instances may therefore move from the one expected running instance before scale to the expected empty set after scale, but cannot change silently within either phase. Deployment, commit, image digest or complete deployment inventory drift before scale refuses and poisons the adapter before any mutation. Immutable drift after the one scale attempt makes the helper return uncertain/do-not-retry and prevents a receipt.

The repair deliberately retains the fixed old deployment and commit pins:

- deployment `40546ef7-9004-4486-a471-370aaa305c80`;
- commit `75d8ec4b16054a1bbfc1a51ddaec99000ee1efe2`.

It does not select, admit or deploy a newer image. That is a separate integration milestone.

## Exact bytes and validation

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-railway-cli.ts` | `0de97e4f6f493e3e558aab7aa400332f539a575bbb9c2c497348842d73b27cb9` |
| `tools/staging/hosted-setup-railway-cli.test.ts` | `2b93a76a0450f96883af207fed4095a95a89d8af977a36e408a554c5587fe244` |

Focused adapter/helper validation passed **22 tests, 0 failures and 523 expectations**. Strict focused TypeScript passed with no diagnostics:

```powershell
bun test tools/staging/hosted-setup-railway-cli.test.ts tools/staging/hosted-setup-maintenance-stop.test.ts
bunx tsc --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2022 --types bun tools/staging/hosted-setup-railway-cli.ts tools/staging/hosted-setup-railway-cli.test.ts tools/staging/hosted-setup-maintenance-stop.ts tools/staging/hosted-setup-maintenance-stop.test.ts
```

New targeted regressions verify runtime UUID drift, image-digest drift and historical deployment-inventory drift all reject on the second preflight with zero scale calls and poison replay. A separate post-scale image-digest drift test verifies one scale attempt, uncertain/do-not-retry, and zero receipt writes. Existing null count, empty staged patch, exact target, pagination, in-flight inventory, binary/version pin, process isolation and no-replay tests remain green.

The frozen reviewer probe is intentionally not rewritten. Against the repair, its two old failing tests now stop at the second `observe()` with `HS_RAILWAY_CLI_PREFLIGHT_CHANGED`; those tests expected that call to resolve before asserting a later scale refusal. This changed failure location is the required earlier refusal, while the new repository regressions assert it directly.

## Limits

This remains a local mock-only candidate. The actual zero-replica provider shape remains unobserved, Railway scale still has no configuration-version compare-and-set or lease, and a status array without pagination metadata remains an external CLI completeness assumption. The availability stop does not exclude database writers or prove preservation. New-image targeting, transactional runner/source-artifact contract repair, operator integration and all live actions remain separately owned and unperformed.

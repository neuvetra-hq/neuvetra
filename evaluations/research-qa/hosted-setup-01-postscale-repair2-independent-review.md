# Hosted setup postscale repair 2 — independent review

2026-09-26. Task `HOSTED-SETUP-POSTSCALE-REPAIR2-QA-01`. Reviewer `/root/collection_backend`, Head of QA with security/reliability criteria, reporting to the CEO coordinator. I did not author either candidate file or the repair-2 author report. The requested critical route was `gpt-6-astra/high`; the inherited follow-up context did not expose the actual model or effort.

**Verdict: PASS for the bounded repair-2 verifier.** POST-F01 and POST-F02 remain preserved as the original FAIL and repair-1 FAIL history. Against the exact repair-2 bytes below, the stopped-only boundary remains usable before migration, and the accepted stopped receipt is now one recursively copied value for validation, hashing, chronology and output. This verdict is local and pure; it grants no provider, migration, resume, launch or deployment authority.

## Reviewed bytes

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-postscale.ts` | `fb7eac353228528f58fffb83d5ec3d49bf5365a3c99b1a59e4259c716b612b96` |
| `tools/staging/hosted-setup-postscale.test.ts` | `e7709358d07c1ba725dc61332c3bbe356f6afc570a210c361475e8888364d73f` |
| `evaluations/research-qa/hosted-setup-01-postscale-repair2-author.md` | `3cf0782b58dbe6bd5515805d1968996919b8ded4ea631670a3f3513140a02df4` |
| Independent probe `tools/staging/hosted-setup-postscale-repair2-independent.test.ts` | `d8b18a31b1ef18775a0951a1fc983fd0f1b414fb7ce104f80310dc04392dc34e` |

The preserved reports remain byte-identical: review 1 / POST-F01 is `df340c53c2a1df82f31f9240dd97f4938dfdd361f8748a6c5bc9b5c0810ce77c`; review 2 / POST-F02 is `10f18ef10230e069993623dac685b166f89fb19ffaaec24ff1415b1bd6ebd523`.

## Criterion dispositions

- **POST-F01 stopped gate: PASS on repair-2, historical FAIL preserved.** `verifyHostedSetupStopped` produces a stopped receipt without any resume observation and explicitly sets mutation, provider-authentication, migration, resume and launch authority to false. The later resume verifier requires that separate receipt and policy pin.
- **POST-F02 getter chronology/image bypass: PASS on repair-2, historical FAIL preserved.** The independent probe recreated both getter directions from review 2. Chronology and image accessors were refused as `HS_POSTSCALE_SNAPSHOT_ACCESSOR_REFUSED`; neither getter executed. The public stopped-hash helper refuses the same image accessor.
- **Nested accessors and mutation: PASS.** A getter at `stoppedCaptureSha256[0]` was refused without execution by both hash and resume boundaries. A normal JSON receipt was verified, then its nested hash, completion time and image were mutated. The returned receipt retained the accepted hash and original fields, and its nested hash tuple remained frozen. Hash, binding checks, chronology and output therefore use one detached snapshot.
- **Railway region shape: PASS for the supplied local shape.** Independently constructed status observations with omitted, null and empty instance region were accepted while inventory configuration retained the exact single `DEPLOYMENT_TARGET.region`. A populated status region and missing configured target region were refused. This reproduces the shape described from the fresh read-only provider capture; I did not call Railway.
- **Resume freshness and chronology: PASS.** The exact five-minute boundary from the first resumed capture start was accepted; one millisecond beyond it and a clock before the second capture completed were refused. Review time at or before stop completion, at resumed start, and after resumed start was refused.
- **Authority and cross-record agreement: PASS.** Stopped and resume outputs retain their required false authority flags. A forged stopped receipt with `migrationAuthorized:true`, even when the test recalculated its serialized hash, was refused. Exact target, binding receipt/review, deployment, commit, image, configuration transition and four distinct raw capture hashes remain checked by the candidate and combined suite.

## Commands and results

Windows/PowerShell, Bun 1.3.12. All verifier inputs were synthetic.

1. Initial sandboxed probe: Bun could not read the worktree (`EPERM`) and ran no test logic. The same bounded command was rerun with worktree permission.
2. First executed independent probe: **4 pass, 1 fail, 25 assertions**. The failure was a QA-fixture expectation: a migration review one millisecond after stop completion is valid. I replaced that vector with the intended before/equal-stop boundaries; no candidate byte changed.
3. Corrected independent probe: **5 pass, 0 fail, 27 assertions**.
4. Frozen deployment-binding, postscale and independent suites together: **35 pass, 0 fail, 186 assertions**.
5. Strict TypeScript for the frozen postscale source/test and independent probe: **PASS**, exit 0 with no diagnostics.

## Limits

This review did not authenticate to Railway, stop or resume a service, access a database, test a durable replay journal, or perform any Git/provider mutation. It verifies a synchronous pure evidence boundary using synthetic captures. The accepted stopped-receipt hash, clock and migration-review time still require a trusted external producer; the verifier does not authenticate their origin. Capture pairs are point-in-time observations rather than a provider lease, selected-field/configuration-etag agreement is not full raw-state attestation, and `hasNextPage:false` remains the inventory-completeness boundary. Repeated verification does not consume evidence. The candidate is suitable for its bounded integration role only after the surrounding authenticated acquisition, exclusive lifecycle control and durable journal are independently established.

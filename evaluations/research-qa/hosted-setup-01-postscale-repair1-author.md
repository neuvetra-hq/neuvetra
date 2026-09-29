# Hosted setup stopped/resume verifier repair: author candidate 1

Task: `HOSTED-SETUP-POSTSCALE-REPAIR-01`. Author: `/root/artifact_runner`, software-engineering specialist with CTO sponsorship. The registered critical route requested `gpt-5.6-sol/high`; observed model and effort are unknown because this follow-up did not expose an override or independent observation. Independent repair QA is pending. No provider, database, Git, credential, or live-service action occurred.

This repair preserves the first independent verdict `FAIL`, finding `POST-F01` P2, in `evaluations/research-qa/hosted-setup-01-postscale-independent-review1.md` at SHA-256 `df340c53c2a1df82f31f9240dd97f4938dfdd361f8748a6c5bc9b5c0810ce77c`. Passing author checks below do not rewrite that first-review outcome.

## Frozen repair candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-postscale.ts` | `5f86f48655b7df926f89be258a084815157b3d9d739dcbe470c4f6f15aa0ccd8` |
| `tools/staging/hosted-setup-postscale.test.ts` | `f2342b924070041731a2bf20496f9735db70022d7e49d5033d9d58186be491ec` |

These are working-tree byte hashes for a repair candidate. They are not an accepted snapshot or live authorization.

## Repair behavior

`verifyHostedSetupStopped(binding, stoppedCaptures, policy)` is the new versioned pre-migration boundary. It accepts only the exact reviewed deployment binding, two stable fresh stopped captures, a trusted current time, and optional before-stop/stopped configuration-version pins. It returns `neuvetra.hosted-setup.stopped-verification.v1` with the exact target, image, binding evidence hashes, stopped configuration, capture hashes and phase timestamps.

The stopped result explicitly grants no authority: `mutationAuthorized`, `providerAuthenticationEstablished`, `migrationAuthorized`, `resumeAuthorized`, and `launchAuthorized` are all `false`. It can be serialized for review. `hostedSetupStoppedVerificationSha256(receipt)` provides its deterministic exact-content identity; a later trusted policy must independently pin that value.

`verifyHostedSetupResume(binding, acceptedStop, resumedCaptures, policy)` is the separate post-resume boundary. It requires the same exact deployment binding and image, an exact-shape stopped receipt matching every binding target/image/evidence field, the independently supplied accepted stopped-receipt SHA-256, two new stable resumed captures, a trusted resume clock, a trusted migration-review completion time, and an optional resumed configuration-version pin.

Resume freshness applies only to the resumed pair. The review time must strictly follow stopped completion, and the first resumed capture must strictly follow review completion. No maximum is imposed on the stop-to-review interval, so migration and independent review can take an arbitrary duration. The resumed captures themselves must finish by the trusted clock and span no more than the existing five-minute phase window. All four stop/resume capture hashes must be unique, the configuration version must change after stop, and exact image/runtime/inventory checks remain unchanged.

The existing `verifyHostedSetupPostscale` retrospective API and `neuvetra.hosted-setup.postscale-verification.v1` profile remain available with their original combined five-minute constraint. Existing callers therefore retain their stricter historical behavior. New operational integration should use stopped verification before migration and resume verification only after migration review and resume observations.

## Trust boundary and limits

The accepted stopped-receipt hash and `migrationReviewCompletedUtc` are trusted policy inputs. This module does not authenticate their source, establish that migration or independent review actually occurred, or authorize either operation. A wrapper must preserve the original stopped receipt and obtain its accepted hash and review-completion time through the reviewed evidence path.

The verifier remains pure and synchronous. It performs no provider I/O or mutation. Raw capture authentication, clock trust, deployment binding acceptance, provider scaling, migration execution, review, and durable replay controls remain external. Stable capture pairs are sampled point-in-time observations rather than a provider lease.

The first QA report's disclosed semantic limits remain: stability binds selected fields and configuration etag rather than every raw configuration byte; terminal inventory completeness relies on the provider's `hasNextPage:false`; and hashes do not authenticate Railway. This repair addresses only the missing pre-migration stopped-state public boundary and the over-broad cross-phase freshness interval.

## Validation

`bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-postscale.ts tools/staging/hosted-setup-postscale.test.ts`: **PASS**, exit 0.

`bun test tools/staging/hosted-setup-postscale.test.ts --timeout 30000`: **16 pass, 0 fail, 67 assertions**, Bun 1.3.12. New cases reproduce the independent diagnostic, accept stopped-only evidence before migration, refuse stale/changed/wrong-image stop observations, accept same-image resume after a ten-minute migration/review interval, and refuse wrong stop pins, changed stop identity, cross-phase replay, stale resume, bad review chronology, wrong image and unchanged configuration.

`bun test tools/staging/hosted-setup-deployment-binding.test.ts tools/staging/hosted-setup-postscale.test.ts --timeout 30000`: **26 pass, 0 fail, 134 assertions**.

The first repair-focused test invocation passed all 16 tests. No repair test failure was removed or hidden. The preserved independent first review remains FAIL until a separate reviewer challenges these exact repaired hashes.

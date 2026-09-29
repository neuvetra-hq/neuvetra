# Hosted setup postscale repair 2 — author report

Task `HOSTED-SETUP-POSTSCALE-REPAIR-02`, 2026-09-26. Author `/root/artifact_runner`, software-engineering specialist. The critical role route requested `gpt-5.6-sol/high`; the inherited follow-up context did not expose its actual model or effort.

## Preserved independent failures

The original stopped-phase API failure and the targeted receipt-drift failure remain separate immutable review evidence:

| Review | Finding | SHA-256 |
| --- | --- | --- |
| `hosted-setup-01-postscale-independent-review1.md` | POST-F01: no usable stopped-only pre-migration boundary | `df340c53c2a1df82f31f9240dd97f4938dfdd361f8748a6c5bc9b5c0810ce77c` |
| `hosted-setup-01-postscale-independent-review2.md` | POST-F02: getter drift split validation, accepted hash and resume output | `10f18ef10230e069993623dac685b166f89fb19ffaaec24ff1415b1bd6ebd523` |

QA2 confirmed POST-F01 fixed, then showed that `acceptedStop` retained the caller's receipt. Stateful `stoppedCompletedUtc` and `imageDigest` getters supplied different values to binding/chronology validation, hashing and output under an unchanged accepted stopped-receipt pin. This repair preserves that P2 result and awaits a new independent verdict.

## Frozen repair-2 candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-postscale.ts` | `fb7eac353228528f58fffb83d5ec3d49bf5365a3c99b1a59e4259c716b612b96` |
| `tools/staging/hosted-setup-postscale.test.ts` | `e7709358d07c1ba725dc61332c3bbe356f6afc570a210c361475e8888364d73f` |

Only the assigned postscale source/test and this repair report/run record were authored. No provider, database, Git, credential or live-service action occurred.

## POST-F02 repair

The verifier now creates a private, recursively frozen snapshot from own data-property descriptors before validation. It accepts only plain objects, arrays and primitive data; rejects accessors without invoking their getters; rejects cycles, sparse/custom arrays, symbol or non-enumerable fields, custom prototypes and malformed nested shapes; and copies proxy-style inputs once from the descriptor view they present. Nested receipt arrays are copied rather than retained.

`acceptedStop` performs all exact-shape, binding, image, timestamp, configuration, invariant and authority checks against one deep stopped-receipt snapshot. The accepted hash is computed directly from that same snapshot. The chronology check and returned `stoppedCompletedUtc` use the copied primitive retained with it. The public `hostedSetupStoppedVerificationSha256` applies the same snapshot rule, so an accessor-bearing receipt cannot be independently blessed through the hash helper.

Binding, policy and capture inputs also pass through the same boundary. Resume output uses the copied policy review timestamp, and capture parsing/hashing uses copied raw strings and timestamps. No checked field is later reread from caller-owned state.

The QA2 chronology and same-image getter attacks are tested in both read orders. All four are rejected as accessor input before a getter executes. Nested capture-hash accessors and policy accessors are also rejected. An ordinary mutable JSON receipt is accepted, then later caller mutation cannot change the returned receipt values; an ordinary serialization round trip remains accepted.

## Railway region shape

The exact Site-Web service instance status now accepts `region` only when omitted (`undefined`), `null`, or the empty string, matching the fresh read-only Railway capture. A populated status-region value is refused. The inventory configuration still must contain exactly `DEPLOYMENT_TARGET.region` as its sole `multiRegionConfig` key with the phase's exact replica count. Tests cover all three accepted status shapes, a populated status value, and a missing configured target region.

## Validation

- Focused postscale suite: **19 pass, 0 fail, 89 assertions**, Bun 1.3.12. Command: `bun test tools/staging/hosted-setup-postscale.test.ts --timeout 30000`.
- Deployment-binding plus postscale suite: **30 pass, 0 fail, 159 assertions**. Command: `bun test tools/staging/hosted-setup-deployment-binding.test.ts tools/staging/hosted-setup-postscale.test.ts --timeout 30000`.
- Strict TypeScript: **PASS**, exit 0 with no diagnostics. Command: `bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-postscale.ts tools/staging/hosted-setup-postscale.test.ts`.

The first type-check after adding tests found only an author-fixture tuple cast that was too broad; it was narrowed to the exact two-string tuple. The first focused runtime invocation then passed all 19 tests. Final strict TypeScript and both final suites ran against the frozen source/test bytes.

## Authority and remaining limits

`verifyHostedSetupStopped`, `verifyHostedSetupResume`, and the retrospective `verifyHostedSetupPostscale` remain synchronous pure verifiers. Their outputs grant no mutation, provider authentication, migration, resume or launch authority. They perform no provider I/O and do not consume a replay journal.

Snapshots make one call internally coherent; they do not authenticate the object source, defeat a privileged hostile runtime, or make separate calls share one state. The accepted stopped-receipt hash, trusted clocks and migration-review completion time remain external policy inputs. Capture pairs are point-in-time observations rather than a provider lease. Inventory completeness still depends on `hasNextPage:false`, and selected-field/configuration-etag stability is not full raw-provider-state attestation.

Independent review of these exact hashes is required before any live scaling, migration or resume wrapper relies on the repaired boundary.

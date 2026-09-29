# Exact bridge deployment binding: local Candidate 1

Task: HOSTED-SETUP-NEW-IMAGE-BINDING-01. Author: `/root/deployment_binding`, security/reliability implementation with CTO sponsorship. Requested `gpt-6-astra/high`; observed model/effort unknown. Independent QA pending. No live provider read, scale, deployment, credentials, database operation or Git publication occurred.

## Frozen candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-deployment-binding.ts` | `6e078f7e64f5fd64c568ff7fec5f292994b23cd2c28ed669da3732458c3b8e9a` |
| `tools/staging/hosted-setup-deployment-binding.test.ts` | `dc8d9a244d511a04c34af5c0c185d39ccf1f4f770534abc48c833b8cc421f081` |

These are working-tree byte hashes. Publication must verify staged and committed bytes separately. No accepted snapshot or independent verdict is claimed.

## What is implemented

The additive, inert module fixes the approved Railway project, environment, Site-Web service and region, while taking the separately reviewed bridge deployment ID, commit and image digest as explicit expected inputs. A PR head alone cannot satisfy the provider identity checks. Two raw CLI status/API observations must agree on active/latest deployment, commit, image, running instance, configuration etag and complete deployment inventory. Active API metadata must contain the same image digest as status metadata. The existing GraphQL `meta` query already requests the needed JSON object; missing image metadata fails closed.

The parser checks a single running replica, the sole approved configured region, disabled auto-deploy, a directly empty staged patch, explicit null-or-zero pending count (null remains null), no in-flight/unknown deployment status, no second successful deployment, unpaginated inventory, unique deployment IDs/cursors and exact configured shape. It rejects duplicate JSON keys, including escaped aliases. It compares semantic fields independently of property order. Capture pairs cannot overlap and each individual capture is limited to 30 seconds.

Receipt creation is only candidate evidence. Binding requires exact receipt and independent review bytes pinned by the operator, two original authenticated-capture hashes obtained outside the receipt, expected bridge identity and distinct reviewer versus operator/observer identities. Review must postdate captures and be at most five minutes old relative to the first capture. Successful verification produces a frozen process-local capability with `mutationAuthorized:false`.

Before consumption, two new raw observations must finish by the supplied trusted clock, start after review, cover at most the last 30 seconds and exactly match the reviewed provider state. A successful or failed consume permanently consumes that in-process capability. Copied or JSON-recreated capabilities fail; the same receipt cannot be rebound in that process.

## Exact trust boundary and exclusions

This module does not authenticate Railway or make fabricated JSON trustworthy. The operator must independently obtain the raw status/API bytes through the reviewed authenticated transport, pin their complete capture hashes through a trusted channel, and supply an accurate clock. The capture digest includes timestamps and raw bytes, so edits cannot retain an existing authenticated capture pin. Fresh capture authentication remains the trusted caller's responsibility. Provider acquisition and authenticated review records are not implemented here. Raw config/status evidence must remain private outside Git and board notes; retain only sanitized hashes in public reports.

The in-process WeakMap and seen-receipt set do **not** prevent replay in a new process. An exclusive durable attempt journal, external reviewed intent, and launcher-enforced one-shot lifecycle remain mandatory. Reverification in a different process is possible by design; do not interpret a serialized receipt as single-use authorization. This binder has no file writer, provider mutation, scale adapter or executable entrypoint. It does not establish that the bridge was independently accepted, ready on schema 22/23, or has correct application behavior.

This is sampled provider coordination, not an atomic provider configuration precondition or a database writer lock. State can change after the last observation. No post-scale parser or stop receipt validator is implemented in this module; the existing adapter's reviewed stop observations must remain in a versioned integration.

## Precise next integration (other owners)

1. Add a versioned authenticated collector in `hosted-setup-railway-cli.ts` that returns `DeploymentCapture` using its fixed executable hash/version checks and authenticated `status --project ... --environment ... --json` plus `HostedSetupMaintenanceInventory` query. Record capture start/end locally around both reads. Do not route this through the current v1 old-deployment parser. Keep v1 unchanged for historical consumed receipts. Original raw captures and their independently obtained pins feed receipt/review preparation; fresh captures feed consumption. Never fabricate a raw capture from `MaintenanceObservation` summary booleans.
2. Use `createHostedSetupDeploymentReceipt(capturePair, expectedImage, observerId)` and save the returned exact bytes exclusively in the private evidence store. A separately produced review uses fields `profile: DEPLOYMENT_REVIEW_PROFILE`, `verdict: 'accepted'`, `receiptSha256`, `reviewerId`, and `reviewedUtc`. `DeploymentBindingPolicy` pins both documents and original `deploymentCaptureSha256` values; acquire those pins outside the documents being verified. Call `verifyHostedSetupDeploymentBinding(receiptText, reviewText, policy, nowUtc)`.
3. Add a v2 maintenance-stop interface taking that branded binding and a fresh raw capture pair. Reserve and sync a new exclusive durable journal before `consumeHostedSetupDeploymentBinding(binding, captures, nowUtc)`, record its receipt/review pins, and use the returned exact IDs for the scale target. Do not let a spread/copied/serialized object bypass consumption. The returned identity still does not itself authorize mutation; execution authorization remains the caller's reviewed contract.
4. Replace only the new stop path's hardcoded prior deployment/commit comparisons with the consumed identity. Extend the v2 observation and stop receipt to preserve image digest and binding receipt/review pins. The current `MaintenanceObservation`/receipt omits these and cannot be reused unchanged. Keep both pre-stop and both post-stop image/inventory checks; runtime identity remains stable within a phase, while instances may disappear after scale. Configuration etag changes only across the stop. Reject swaps at every phase.
5. The new runner must accept only the matching v2 stop receipt and independent stop review, joined to the same exact bridge image and binding pins; it must not accept the historical `40546ef7` / `75d8ec4b` constants or treat a product PR head as deployed evidence. The same image must be required for any separately authorized resume after schema 23. A fresh-process consumer needs the durable journal and externally pinned serialized receipts, not a reconstructed in-process capability.

Interfaces are exported directly from the additive module. It imports only `node:crypto`, avoiding hidden imports of the retired write-gate implementation. Other application/provider/runner files were read only.

## Actual checks and preserved failures

`bun test tools/staging/hosted-setup-deployment-binding.test.ts`: **10 pass, 0 fail, 67 assertions**, Bun 1.3.12. All provider data is synthetic. Tests cover new-image success, copied/serialized replay, same-process rebinding, consume-on-refusal, stale/future/overlapping chronology, invalid review and self-review, raw capture/receipt/review pin swaps, coordinated inner receipt tampering, PR-head substitution, provider field/shape omissions, complete inventory, staged patch and count ambiguity, image/instance/config/inventory drift and property-order equivalence.

`bunx tsc --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target esnext --types bun tools/staging/hosted-setup-deployment-binding.ts tools/staging/hosted-setup-deployment-binding.test.ts`: **PASS**, exit 0.

First sandbox test invocation was denied file access (EPERM) before tests; the approved scoped rerun passed. First typecheck found test-only implicit callback parameter and literal fixture mutation types; these were corrected and the full focused suite/typecheck rerun passed. No source safety test failed. No independent review, live collection, integrated helper execution, cross-process durable replay exercise or provider/browser demonstration has run. L02/L03 applied: exact-byte lineage and semantic serialization checks. Next owner: root assigns independent QA on the frozen candidate before any v2 integration.

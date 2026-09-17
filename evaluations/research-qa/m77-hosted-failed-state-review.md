# M77 hosted failed-state recovery review

## Verdict

**PASS for preservation and recovery of the actual interrupted state. M77 hosted acceptance remains incomplete.** Independently reviewed on 2026-09-17 UTC, with full replay completed at 00:12:29.716Z. The original exercise failed after 33 application POSTs; this review neither converts that attempt to success nor authorizes retrying its writes. The cause of the failed read remains unknown.

Root supplied a fresh encrypted application archive and an isolated restoration, `m77_ops_failed_state20` at local port 55472. QA independently read and replayed that restoration; QA did not perform a second encrypted restoration or contact the host. No application, original journal, source database, shared record, role or Git changes were made. Root remains the operator and publication/host owner.

Requested reviewer route: QA critical Astra/high. The coordinator reused this independent historical M76 context after fresh dispatch capacity was unavailable. Actual observed compute remains unknown. This context authored neither the M77 runtime nor its operators or journey.

## Preserved evidence

| Artifact | SHA-256 |
| --- | --- |
| Original failed full journal, 74 events | `84107d09d979d0a5086a575642ddd1f3d596f75213886588f909b047933860ba` |
| Original terminal event | `b43bfb5b5dc1688324a8734bcc99342a5c273a0c89d4245123ee09b113cb26ad` |
| Fresh schema20 backup receipt | `99f7311e74d08894deb950e6eb4dc1b00502483973ae687636f4d42d17ec21c6` |
| Fresh restoration receipt | `2dc3057c9032e433b7a355a7474991d9a5f7d4c132c4d1b94a8d4dcce9d6d7ae` |
| Encrypted archive | `d038eadbafc0e2558ebf285b97db2e8302bc473d15160020a81abaa143aa7afe` |
| Independent complete failed-state recovery receipt | `1c41c4464d391b22f91accc41fa900d4227780c6d91b02b0890422b96d3fcdc2` |
| Independent prior-row/catalog preservation receipt | `dcd2f813dffdf148eebabbd3eb168408fc3d89919e46634b6576282c462a7484` |

Private receipts are `.superpowers/m77-independent-hosted-failed-state-candidate1.json` and `m77-independent-hosted-failed-state-preservation1.json`. The backup was created at 00:03:15.850Z and restored at 00:04:44.941Z. The recovered content manifest is `cd622e74fce98f1af03537c59db2d63b11c582aefadbb88ad4466a0b7925841f`.

## What was independently demonstrated

- Every event hash, sequence and predecessor link matches. The accepted four-event zero-write baseline prefix remains exact. The second attempt closed as **failed** at `authorized_read:/mobile-diesel`, with 33 POSTs and all created Auth sessions closed.
- All 33 uniquely named intents have exactly one immediate, ordered outcome with the same route, role and expected/actual status: 27 successful additive writes and six expected authorization/accounting refusals. There is no unmatched intent or uncertain application write. Every successful response equals its restored immutable record and idempotency record. Refusal probes deliberately reuse the later admitted source-save key for three unauthorized identities; that key belongs only to the admitted source record. Other refusal keys have no saved request record.
- All 113 application tables, row hashes with multiplicity, catalog, ACLs, role flags, memberships, sequence states and content match the actual backup within the previously reviewed application recovery boundary. Runtime no-claim access remains denied and legacy containment passes. Before/after replay inventories are identical.
- Compared with the committed migration receipt, every prior immutable row remains. Only the expected corporate head advanced; additions are confined to corporate history and the eight new fugitive tables. Catalog, roles, memberships, Auth UUID dependencies and all source default-ACL records are unchanged. The new fugitive audit sequence advanced exactly to its retained audit count; no original sequence changed.
- The actual population contains five source workpapers with **seven source versions**, **three population versions** and **eight reports**. All five current source versions have separate `accepted_bounded_internal` reviews. Contributor/reviewer separation passes. Population version3 remains unreviewed and stale after corrected HVAC acceptance; current reconciliation remains `blocked`. Its saved dependency hash is `8e46cf78632bc46a88fadba1f2f8cb8b12e80f0ddc9d780f9cfd88b07f46b3c8`; the current dependency hash is `d49faa02e6db51e288a3a2662970dacbefd6db362a23a0920bfb996433fa2751`. All three original facility objects remain exact.
- Read-only replay validated all retained gas6, mobile5, corporate8, fleet4, generator3, equipment5 and fugitive10 versions. It executed authoritative calculation replay, historical proof/read validation, authorized routes and actual frontend decoders/download methods: 72 fugitive route downloads and 62 fugitive frontend downloads; 15 equipment proof reads; 14 legacy downloads. Local synthetic Auth adapters and local route transport were used; these are not live HTTP/session tests.
- All four actual Chrome HTML/JSON files for reports `b78605e9-72b9-48bd-9718-7e8ba67867bf` and `161f3ee6-bfae-4d6f-8300-8194b9efc814` match their restored retained payload **and their original journal responses byte for byte**. QA inspected bytes, while root observed the browser. Historical report contents and captured absent reviews remain validated by the replay.

Provider accounts, sessions, configuration, storage and role passwords remain excluded exactly as in the prior reviewed application-only recovery policy. The 27 non-application default-ACL source records are retained in the restoration receipt and equal prior accepted evidence; no application/global default-ACL exclusion was added. No provider recovery or professional assurance claim follows from this review.

## Safe continuation preconditions

The only unattempted planned operations are `m77_population_final`, `m77_population_final_review` and `m77_population_final_report`. Any continuation must be separately authored, independently reviewed and published with exact pins before root execution. It must bind this failed journal, terminal head, recovered state and accepted predecessor; use a fresh exclusive journal and lock; preserve the original failed attempt; perform a fresh actual zero-write authoritative baseline and all required historical downloads/proofs; retain all three facilities and every discovered physical device; use only the three missing population routes/keys; and enforce current head/dependency pins and cumulative contributor separation before each operation.

For this fixed synthetic exercise, preserve the original named creator/reviewer identities as well as checking their current authorization and eligibility. Any ambiguous response, failed decode, read failure, unsuccessful session closure or uncertain journal durability must halt without reset, automatic retry or replay of the 33 completed operations. New continuation code, final deployment/restart, zero-write revisit and completed browser demonstration remain separate pending reviews. No full M77 or Scope1 completion is accepted here.

## Targeted final-runtime repin

The observer repin is **PASS for source only**. `.superpowers/m77-observe-final-runtime.py` at `588d55e4999073a80f6dcfdeab4d4f06bca646b32039fb4a8618f9276b22d1ef` reconstructs the preserved accepted `18e9812e8209f298d1f7a066efad9737877331b9bb8e9015ed4672fb40b5dcf1` bytes exactly when its single commit constant is reversed. Target is now `7d465485e439566e9937b48c437bc59a6cc9591f`; deployment query retains the exact service/environment with only that target substitution. Independent receipt `.superpowers/m77-independent-final-runtime-repin1.json` hashes to `c31850195ed5e4a4b692635796d87a66ba967fc368309d56191aa23aef5d38b3`. Actual deployment and restart remain pending.

## Preserved QA probe corrections

Two initial QA checks overconstrained the admitted evidence: requiring unique keys across unauthorized refusal probes, and using `accepted_bounded_synthetic` instead of the actual M77 decision literal. Their failed preflight receipts are preserved separately; neither identified an application defect or changed source evidence. The corrected final probe and full replay passed. An inline observer receipt probe also failed shell parsing before execution; the file-based verifier then passed. These failures are not inferred host failure causes.

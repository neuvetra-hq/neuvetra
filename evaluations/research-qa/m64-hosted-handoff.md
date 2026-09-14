# M64 hosted handoff review

September 14, 2026. **Accepted for scoped implementation/validation run closure and milestone status `awaiting_board_feedback`.** The synthetic hosted worksheet has a demonstrated path under the recorded conditions. This is not board milestone acceptance, customer release, merge approval or professional assurance. Do not advance a dependent milestone before board feedback.

Reviewer: reused `/root/m63_data`, an M64 product nonauthor who previously authored M63 database/adapter/containment work. Local M64 implementation QA, packaging rechecks and this hosted-evidence review are separate reviews with attribution retained. Requested critical compute was Astra/high; inherited actual settings remain unknown. This review made no cloud calls, credential reads, Git calls, product writes or nested-agent dispatches. Cloud, CI and browser outcomes below were observed by root and supplied as a frozen evidence record; this reviewer checked that record and the probe source, rather than independently replaying provider/browser actions.

## Evidence challenged

The recorded implementation is `ea31275cc11c7101e1bb116187867b2d782331b0`; the CI head matches it and all six checks, including the actual Linux image smoke and native PostgreSQL regression, are recorded successful. That addresses the earlier image gate which failed twice under M64-IMAGE-F01. The additive migration receipt identifies the exact independently reviewed SQL digest `97e292bcd4a9b5307d36326d429abf608783b231220c0305d386eb85cca2ca52` and schema9→10. Deployment `47822f07-a13a-4452-8ce7-bc4039edab2f` is recorded SUCCESS, followed by a deliberate service restart and readiness200/schema10.

The transition was not uninterrupted: initial startup retries exhausted before the migration, and the old schema9 image refused after the schema10 commit. Root redeployed the same reviewed image after restricted readiness passed. Precise downtime is unmeasured. This is a successful repaired deployment/restart observation, not evidence of zero downtime or a new M64 rollback drill.

Cross-receipt checks passed: the hosted exercise records20 stages with expected refusal/success outcomes and four API-created sessions returning logout204. Both postrestart manager and member reads return200 and identical three-version records. Versions1/2 retain their prior IDs, input/result hashes and exact/display totals; version1 retains its exact review hash. Version2 acquires the explicitly demonstrated browser review, and version3 remains unreviewed. The final browser and API records agree on input hash, result hash and **187500.000kWh → exact36570.05415kgCO2e → display36570.0542kgCO2e**. The retained M63 read-only journey records zero application POSTs, exact prior baseline matching and successful archive replay/report/review revisit.

Root's browser observations cover the existing invited Chrome session, all-seven acknowledgment enforcement, a bounded synthetic different-manager review of version2, refusal of negative input, a real form correction to version3, preserved history, no inherited review, a390px viewport with no horizontal overflow, the saved M63 example report, and reload after restart with identical fingerprints. The automated use of the board's existing invited session created a synthetic review record; it does not express the board's milestone decision.

## Probe and task closure

`check-m64-revisit.ts` is bounded to the existing approved host/auth endpoint and exact known three result hashes. It validates the supplied account IDs through real Auth, performs only GET against the application, runs the actual frontend decoder, requires reviews on versions1/2 and no review on version3, checks the final display, and records both manager/member results. API Auth login and logout use POST; `applicationPostRequests:0` correctly excludes those Auth operations. Its success receipt is emitted only after each created token's logout returned204. The existing browser session remains intentionally open; “sessions closed” refers to the probe-created API sessions, not every active account/browser session. The probe verifies current review presence and records review hashes; continuity of the historical review hashes was checked from the supplied receipts rather than inferred solely from its hardcoded result-hash checks.

All **17 file entries** across M64-CTO(9), M64-ACCOUNTING(3) and M64-QA(5) snapshots match the current files after canonical LF normalization and the snapshots identify the same implementation commit. Root reports these as published Git-blob content hashes. This reviewer verified content-hash consistency without querying Git or the remote; they are SHA256 content digests, not Git object IDs. CTO attribution explicitly includes the later root-authored contract extraction. Accounting review retains its own earlier review-stage hash table; the snapshot binds that document as delivered evidence and does not turn its historical table into a final-code binding. The extraction review supplies the final replacement code bindings. The QA snapshot covers completed local/integration/packaging deliverables; this new handoff is a separately dated additional review.

Those bounded role deliveries can close. The product milestone remains awaiting board feedback, and PR4 remains draft/unmerged. Leading board/continuation text was reconciled during this review to M64 live with board feedback next; the rechecked ledger uses `awaiting_board_feedback`. Final run-record publication remains root-owned. No time-saving, cost-saving, model superiority, token-cost or financial-impact result is established. Three substantive failure classes remain recorded: numerical precision, native-driver serialization and packaging (two CI iterations).

## Limits retained

- Fresh browser UI logout/sign-in and sign-in-link delivery were not repeated for M64. Real Auth login/logout was exercised through API; the existing invited browser session reauthorized on reload. This is not fresh-browser onboarding acceptance.
- An actively invited second tenant was challenged on actual local PostgreSQL with fixture Auth, not a newly provisioned live second-tenant account. Live member, outsider and signed-out boundaries passed under the recorded tests.
- Local M64 application dump/restore and hosted restart/readback are distinct. Provider Auth restoration, portable off-device recovery, scheduled backups and proactive alerts remain outside the demonstrated scope.
- Browser actions, screenshots and remote checks are root's observations reviewed here through the bound record; no independent second browser run is claimed. A postimplementation documentation commit needs its own publication/check record if the final remote head changes.
- All numerical outputs remain synthetic, incomplete, candidate/unreleased and without assurance. Board feedback is still required before dependent work.

## Exact handoff binding

Hashes normalize CRLF to LF only. Previous frozen QA reports/manifests are preserved; this handoff adds evidence rather than rewriting earlier pending gates.

| Artifact | SHA-256 |
| --- | --- |
| `docs/research/m64-hosted-verification.json` | `ba633cd558bc2ad676ba7b5a5c00148d59ce269a8deb4df49a56654eb73bf2d3` |
| `tools/staging/check-m64-revisit.ts` | `cdceefd023fc0653933dcdc8360574d5bc92858fdd3169e81542b8e8ba6ec8f4` |
| `operations/agent-improvement/snapshots/M64-CTO.json` | `ad64479594bdb3185133a987edf675ca2ae91740a80b54a553d32a171a3726d5` |
| `operations/agent-improvement/snapshots/M64-ACCOUNTING.json` | `d35dc7cb742b498b5e305ccac1627b15dfaaa247bbdac0f8eb59a8d5d7bb4567` |
| `operations/agent-improvement/snapshots/M64-QA.json` | `9d7b8862bb2372ee56a328f92fe0e5b817e618ef64dfcd2e7f149a7597ba7f29` |

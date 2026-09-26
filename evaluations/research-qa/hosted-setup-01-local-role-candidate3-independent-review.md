# HOSTED-SETUP-ROLE-QA-03 — independent candidate3 review

Date:2026-09-26. **PASS for the bounded local role-bootstrap/reconciliation candidate below. ROLE-F01 and ROLE-F02 are resolved.** This does not establish an actual hosted backup/restore or authorize provider operations.

Independent reviewer `/root/hosted_qa`, requested gpt-6-astra/high; actual inherited settings and resource cost unknown. Reviewer authored only a new candidate3 probe, result and this report. Product files, actual archive, provider, Git and shared-ledger state were untouched.

## Exact candidate verified before and after testing

| File | SHA256 |
| --- | --- |
| tools/staging/hosted-setup-local-roles.ts | adf320e64c2aaae9182624e73dcab39897f4ec40799e0875d962570ab1e423d2 |
| tools/staging/hosted-setup-local-roles.test.ts | b3d3b8c660789c7041c2cf250ab114da066fe1d3a7752aa83a166908a538d23d |
| evaluations/research-qa/hosted-setup-01-local-role-bootstrap-author-candidate3.md | 38db55c33c80937284ae58b5383dd3393f77a5e8e6cf05f7eacd3352c35abc26 |

The prior candidate1 and candidate2 FAIL reports, probes and results were rehashed after this execution and match the six preservation hashes in the candidate3 author handoff. They remain failed historical candidates; neither was overwritten.

## Independent native evidence

Executed `bun test evaluations/research-qa/hosted-setup-01-local-role-candidate3-independent.test.ts tools/staging/hosted-setup-local-roles.test.ts`: **3 passed,0 failed,99 assertions**, Bun1.3.12, real PostgreSQL17.11 binaries. The independent probe contributes60 assertions and the rerun author suite39. The independent result is `hosted-setup-01-local-role-candidate3-independent-result.json`.

- **Failed final bootstrap close:** a spy retained all actual native database operations and wrapped close to await the real close, then reject. Exactly one close was observed. The failed-bootstrap receipt now retains `connectionCloseConfirmed:false` and cause `HS_RECOVERY_CONNECTION_CLOSE_FAILED`, independently recording `confirmedStopped:true`, status exit3 and `portListening:false`. This reproduces the formerly failing ROLE-F02 assertion against the repaired bytes.
- **No connection created:** actual server startup succeeded but injected launcher completion returned nonzero before admin connection creation. Both cleanup-confirmed and cleanup-unconfirmed receipts recorded `connectionCloseConfirmed:null`, not fabricated success.
- **Ambiguous start:** candidate3 stopped the exact reserved data directory despite launcher failure, verified its status and closed port, retained data/journal/result, and refused replay. ROLE-F01 remains fixed.
- **Unavailable cleanup controls:** injected failures for the exact stop/status subprocesses preserved a live synthetic server temporarily. Candidate3 returned its distinct cleanup-unconfirmed/no-retry code, `confirmedStopped:false`, `portListening:true` and `replayAllowed:false`. The independent harness then restored the real control function and stopped only that exact test directory. No broad process or port kill was used.
- **Failed close during explicit stop:** the actual-close-then-reject fault still recorded false while server shutdown succeeded. Stop replay and bootstrap replay refused.
- **Ordinary lifecycle and preserved boundaries:** the rerun native author suite passed exact16-role/22-membership readback, no passwords, pristine initial databases, malicious metadata refusal, occupied-port refusal, normal successful bootstrap/stop and replay refusal. The independent probe additionally recorded all intercepted control commands and checked their exact `-D` paths stayed in its own reserved synthetic root.

All test clusters were stopped and their data/journals retained. Final independent TCP observations and a separate operating-system listener check confirmed **PORT_55479_FREE**.

## Scope and execution limits

Candidate3 stores close state across the try/catch boundary and preserves false; no-handle close now returns null. Source inspection confirms server reconciliation remains independent of this tri-state client observation. The unchanged allowlist, private path, binary pin and source-binding boundaries retain their earlier scoped review evidence; this pass is not a new exhaustive audit of every input combination.

No actual paired archive was read, no source/provider connection was made, and no application database was restored in this review. Positive encrypted-archive loading, source-to-restored inventory equivalence and the actual absent-target restore remain root-owned execution gates. The local trust-auth cluster is acceptable only for the explicitly bounded synthetic loopback rehearsal, with the exact reviewed pins and explicit stop/reconciliation controls. Do not infer provider Auth recovery, schema23 upgrade, customer readiness or method release from this pass.

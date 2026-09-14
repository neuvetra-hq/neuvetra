# M63-F03: persisted browser contract failure and independent follow-up

Status: scoped source repair and full real hosted frontend-contract check accepted; repaired deployment and signed-in browser revisit remain pending at this checkpoint. This follow-up preserves, rather than rewrites, the historical M63 acceptance report.

## Escaped defect and reproduced boundary

The board's signed-in browser displayed **“The calculation response was not recognized”** when revisiting the existing saved workspace. The coordinator independently reproduced that browser failure. Previous real Auth/API/SQL, backup/restore and immutable artifact checks passed, but they did not invoke the actual frontend decoder on the hosted payload. The browser-path acceptance was incomplete. M63-F03 is one shared escaped incident across implementation and independent QA, not separate defects counted once per role. Historical technical acceptance remains evidence of the checks it actually ran, not proof that this user path worked.

QA authored a minimal read-only probe using real manager Auth, the actual `decodeStagingAccess` and `decodeSyntheticBill`, and the existing hosted saved bill. The coordinator executed it through the protected stdin wrapper. At `2026-09-14T19:47:27.448Z`, the response was HTTP 200 but the actual frontend decoder rejected at **workspace-api.ts:161:615**. The receipt records zero application POST requests and acknowledged provider logout. No response bodies, credentials, emails or account IDs were persisted. The original API-only success therefore does not erase this concrete failure.

The failing guard compared nested calculation totals/gas results/trace with `JSON.stringify`, treating JSON object property order as meaningful. Stored PostgreSQL JSONB and projected response objects can carry identical keys/values in different insertion orders. A source-level hypothesis alone was insufficient; the real response through the old frontend guard establishes the failure. The minimal probe was rerun after repair against the same hosted record and passed at `2026-09-14T19:48:28.421Z`, still HTTP 200, zero application POSTs and acknowledged logout. Both attempts remain in `.superpowers/m63-browser-contract.json`.

## Independent source review and focused validation

CTO changed only the three structural comparison calls in that guard. Recursive comparison ignores object key order while requiring the same key set, exact primitive values/types, and exact array order/length. Existing fixed factor/method/provenance, classification, lineage and numerical checks remain intact. A new test uses the database package's PostgreSQL JSONB implementation to reproduce reordered objects; altered values/types, extra/missing keys, trace order and digest binding still reject. Conditional copy now describes private hosted synthetic storage accurately without changing stored evidence/review strings or release restrictions.

QA independently read the exact diffs and ran the workspace browser boundary plus staging session suites: **28 tests / 148 assertions pass**. This includes the JSONB regression and malformed counterexamples, as well as earlier identity-cancellation protections. Author-reported broader web/type/lint/build checks are supplementary; the 28/148 result was executed by the independent reviewer.

| Accepted repair artifact | Exact working-file SHA-256 |
|---|---|
| `apps/site-web/src/lib/workspace-api.ts` | `f30e9b2044831c07a5b3bc2442c5e8774d40edc32f66fd789a9d6c368acad979` |
| `apps/site-web/src/lib/workspace-api.test.ts` | `3466facbc52baca0641005e86cde13749ace4629be0ae60ecd8747d10da8d1b2` |
| `apps/site-web/src/components/CompanyWorkspaceDemo.tsx` | `2cc7c3db59df87a4156dd6c2845cbdfe265a0b0983ef98b014488c0a7e9294b7` |
| Independent `tools/staging/check-browser-contract.ts` | `7bdb1d1ec469cff74aa716583620dd5839fcfb9bff544d184f22420c6ccf7269` |

These three repair hashes supersede the respective prior accepted-source entries only for this follow-up. The historical manifest remains an immutable record of the previous candidate. The regression helper is QA-authored verification tooling, not an independently reviewed product implementation claim.

## Full browser-contract probe and required closure

The extended helper uses the actual exported browser revisit/download functions for manager and member, including session, workspace, saved bill/calculation, predecessor inventory, both register versions, annual inventory, evidence pack/download, report/download and exact second-manager review. Its transport accepts only GET application requests to the fixed hosted origin; Auth sign-in/logout are separately bounded provider actions. It compares the original journey's immutable hashes and runs twelve malformed in-memory response counterexamples per actor. Each refusal counts only after the counterexample response was actually produced, preventing fixture-construction failures from being mislabeled as decoder refusals. Corrupted copies remain in process memory. The helper passed standalone strict TypeScript validation before the coordinator's live execution.

Passing this helper will establish the actual frontend response contract against stored hosted data. It still will not establish browser rendering, UI side effects or a successful signed-in persisted-workspace revisit. Closure requires the repaired deployment/CI identity, the full helper receipt, and the real signed-in browser revisit. Board confirmation remains a separate user-acceptance gate. No database regeneration or workflow mutation is required to fix or prove this decoder repair.

## Improvement record review

The coordinator's L04 update correctly requires real hosted responses through actual frontend decoders and a signed-in persisted browser revisit whenever browser acceptance is claimed. QA independently reviewed that change and the linked M63-CTO/M63-QA shared `escaped_defects=1` evidence: count once at parent M63, preserve unknown metrics and prior history, and retain `adopted_pending_effectiveness`. The accompanying UTC-to-Pacific start-time representation denotes the same instant. The lesson is a concrete missing check, not evidence that every future browser path is now covered.

## Full hosted frontend-contract result and publication freeze

The coordinator executed the completed independent helper with the existing protected QA configuration. QA inspected the resulting appended receipt, SHA-256 `cfbf9cf3fae04847ac4fc57ab6587123a16c4b88f8b5f18f1eb0434c94eb62aa`, preserving both the original decoder failure and the minimal repaired pass. The extended run completed at `2026-09-14T19:52:52.335Z`: **manager and member each passed all 11 frontend stages, 22 application GET requests total, zero application POST requests, and both provider logouts acknowledged**. All original archive/report/decision hashes match, with incomplete/unreleased state and distinct-manager binding retained. All twelve in-memory malformed counterexamples per actor were rejected, totaling 24 refusals across numerical value, extra key, array order, release flag, excluded-month quantity, lineage/self-review, and byte-integrity boundaries.

The live diagnostic booleans isolate the actual object-order mismatch: `record.result.total` and the projected calculation total have unequal `JSON.stringify` strings, while the corresponding gas-results and trace strings match on this specific stored response. The repaired exact-value comparison accepts the unchanged totals. This identifies the observed cause precisely; the additional object/trace regression cases prevent the same class of order sensitivity elsewhere without weakening array ordering or record checks.

The accepted decoder hash in the live receipt is exactly `f30e9b2044831c07a5b3bc2442c5e8774d40edc32f66fd789a9d6c368acad979`; executed helper source was `52692ba6187af48577fe9cad28c778a6c050d55f1326cdf07d8a12da5b518ad4`. At the coordinator's request, final publication removed only extra blank EOF whitespace (TrimEnd plus one LF); accepted helper SHA-256 is `7bdb1d1ec469cff74aa716583620dd5839fcfb9bff544d184f22420c6ccf7269`. No semantic change or further test run was needed. **Scoped source/real-response-contract acceptance is complete and this report is frozen for publication. Browser-rendered acceptance is still pending the repaired deployment and an actual signed-in revisit of the persisted workflow.** The coordinator will copy the receipt to `docs/research/m63-browser-contract.json` and bind final publication/CI/deployment evidence. No new workflow records, migrations or cloud database changes were used to achieve the passing contract result.

# M74 hosted journey helper: independent bounded review

Task `M74-HOSTED-HELPER-REVIEW`, sponsor/root QA coordinator. Reviewer `/root/m74_cto`, requested critical Astra/high, observed model/effort unknown. This reused context authored the M74 technical contract and earlier frontend review, but authored **neither** `tools/staging/check-m74-hosted.ts` nor its author tests. This is independent review of those root-authored helper controls, with prior requirements-context disclosure. Only the new independent test and this report were written.

## Verdict

**Pass for the reviewed helper's bounded offline controls.** No helper defect was observed in the first independent run; no implementation repair was requested or performed. This verdict does not approve the integrated backend, schema migration, accounting method release, live execution or milestone acceptance.

First independent run: **9 passed, 0 failed, 927 assertions**. Final combined author/independent run: **15 passed, 0 failed, 1,010 assertions**:

```text
bun test tools/staging/check-m74-hosted.test.ts evaluations/research-qa/m74-hosted-helper-independent.test.ts
```

Tests invoke the actual helper through dependency injection. HTTP, Auth, receipt persistence and the legacy M72 journey are simulated entirely offline; M73/M74 calculation responses use their real pinned Python authorities. No credentials were loaded, real Auth sessions created, hosted requests made, Git actions performed or implementation files modified by this reviewer. The author-reported strict TypeScript check was not independently rerun here.

## Independently challenged outcomes

| Boundary | Actual independent evidence |
| --- | --- |
| Read-only schema16 baseline | A nonempty retained M73 stream, its original statement, original unreviewed/reviewed reports and corporate export are verified before any mobile work. Baseline makes zero application POSTs. Four exact M73 downloads are compared, rather than relying on an empty register or row counts. |
| Legitimate corporate-head drift | The synthetic M74 exercise appends a new M71 corporate version. The old M73 worksheet receives the expected current-head finding, and its source-choice/coverage metadata changes. The helper accepts this legitimate diagnostic change while the actual frozen M73 versions and reports remain exactly equal. The four retained gas downloads are checked again after the exercise. |
| Bounded mobile workflow | Full offline exercise performs exactly **11 application POST attempts**: six successful source/save/report/review/report/correction operations and five expected authorization/contributor refusals. It produces two mobile versions, separate fuel/mileage statements and two exact reports. The final eight mobile download observations match their frozen bytes. Old review belongs to the original version; correction stays unreviewed with an unresolved mileage discrepancy. |
| Revisit | After completed exercise, revisit performs zero new application POSTs and compares corporate/mobile records and downloads with the journaled completion. This tests the read-only revisit mechanism, not an actual service restart. |
| Resume known outcomes | A simulated final readiness read fails after all 11 POST outcomes are durably known. A fresh helper run resumes to completion with zero repeated application POSTs. |
| Uncertain writes | A network exception after intent, a malformed/private successful response, and a successful application write followed by a failed durable outcome append all fail closed. An unresolved intent blocks the next run before any network call. No substitute request or blind retry is sent. |
| Unexpected failure response | An unexpected HTTP refusal is retained as status/hash/byte length only. Its private marker is absent from the journal; the mismatched outcome blocks resume before network. |
| Successful-response shape | A successful response with an additional `access_token` field is rejected by the actual strict decoder before durable response storage. The private marker does not enter the journal, and the intent remains unresolved. |
| Session cleanup/accounting | Every known simulated helper token is logged out across baseline/exercise/revisit and failure paths. An unknown sign-in result reports `allCreatedAuthSessionsClosed:false` and blocks subsequent network. Error details, tokens and supplied synthetic passwords are absent from retained receipts. The legacy helper's own cleanup result is a delegated dependency; no real legacy Auth closure is claimed by the simulator. |
| Existing-data corruption | A changed frozen M73 statement/activity record and altered exact export bytes independently refuse baseline, with zero application writes and closure of known sessions. |
| Journal and action bounds | An interrupted attempt without its final closure receipt blocks resume. The author tests additionally refuse broken chains, wrong workspace and truncated receipt text. A legacy adapter attempting an application POST is blocked before network. Independent route cases refuse a foreign tenant, DELETE, stationary-gas mutation, alternate Auth grant, readiness query override and fragment override. All dispatched simulated requests carry redirect refusal and a timeout signal. |

The helper deliberately compares the immutable portions of M73 worksheets while excluding the current-head `findings` field from that equality. The independent fixture proves this is narrow: frozen version/report records and downloads still must match; it does not treat changing diagnostic findings as permission to change retained workpapers.

## Exact reviewed bytes

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/check-m74-hosted.ts` | `fe58ba14d496dcf5dc4d49059144236923adbff81c08e88a2c85f04815717d33` |
| `tools/staging/check-m74-hosted.test.ts` | `a75271f35e2c46fb7d8f399b1aaebfe5195a896ff8197476c21dbfa9df6ad849` |
| `evaluations/research-qa/m74-hosted-helper-independent.test.ts` | `7539eb4f087fa9202e8bac1bbb1ef1b49133189613e9fba4fdd233c83db0c608` |

Hashes were read again after the final passing run and were unchanged. Root must freeze these exact artifacts for publication; changed helper/decoder contracts require a targeted recheck. This report is not authority to rewrite prior journals, retry unresolved writes or bypass existing migration/host gates.

## Operator handoff and limits

Root remains the sole host/Git/ledger writer. Before executing this helper against the actual service, the separate rollout must establish the exact reviewed migration, current schema/head/image, fresh backup/independent recovery and supported runtime. Baseline must run against actual schema16; exercise and revisit require actual schema17. The helper checks those fresh readiness responses while adapting only the legacy offline compatibility view.

A **real service restart must be performed and evidenced separately** between live exercise and zero-write revisit. Browser visibility, actual print/download controls, native database reconstruction and live session closure also require their own observed results. Dependency-injected success is not hosted success, and the simulated legacy baseline is not independent revalidation of every M72 mechanism. No new action authorization is supplied by this review.

# OPS-GRAPH-01 independent QA

Reviewer: `/root/workflow_qa`. Implementation author: `/root/workflow_engineer`.
The reviewer has not authored implementation or author tests. Requested route is
`gpt-6-astra` / `high`; observed model/effort remain unknown. This review covers a
local controller that issues dispatch tickets. It does not verify real agent
identity, provider execution, automatic independent review, savings, or beta
readiness.

## Independent acceptance scenarios prepared before implementation review

1. Reject missing, repeated, self and cyclic dependencies; reject malformed IDs,
   types, nonfinite/negative budgets, unknown plan actions and unrecognized fields
   where they can conceal executable or contradictory instructions.
2. A dependent can start only after accepted exact dependency output. Replacing
   upstream output invalidates descendants; unrelated accepted siblings survive.
   Attempt to reuse an old acceptance after artifact, dependency or review drift.
3. Refuse self-review and mismatched task/attempt/artifact reviews. Preserve failed
   reviews when a later attempt passes. Metadata is an assertion of identity,
   never proof that a real independent reviewer ran.
4. At most three outstanding worker reservations, including issued but unresolved
   tickets. A fourth, duplicate start or resumed ticket cannot consume fresh work.
5. Reserve the full declared attempt budget before ticket issuance. Concurrent
   reservations sum; unknown actual costs retain reservations and cannot become
   zero. Reject invalid settlements and overspend before a further start.
6. Crash between issuance and reported completion leaves durable no-replay state;
   a new process must not mint another ticket. Corrupt/truncated journal or stale
   lock fails closed rather than rebuilding history as new work.
7. Pause blocks new work while preserving in-flight evidence. Resume requires an
   explicit state transition. Failed tasks admit at most two targeted repairs;
   exhaustion blocks further attempts and dependent starts.
8. Repair only the affected task and descendants; preserve unrelated sibling
   output, costs, accepted verdict and attempt history. In-flight descendant
   results cannot become accepted after their upstream binding changes.
9. Public CLI and composed lifecycle receive checks, beyond isolated helpers.
   Inspect imports and call sites for shell, network, model or production actions.
   Local tickets are not claimed as actual dispatched agents.

## Review rounds

Initial status: pending author handoff; no pass was issued before the rounds below.

### Round 1 â€” FAIL (pre-freeze source inspection and reproduced blocker)

Implementation SHA-256:
`f19413bd2543859b275a89651ac8343a655eae4113bbf7f8bd63db90feb4b3f8`.

F01 (G02): accepted upstream bytes may drift without invalidating downstream
eligibility. Independently created two tasks `a -> b`, completed and accepted `a`,
then rewrote its accepted artifact `e/a`. A fresh `dispatch b` returned a reserved
ticket with dependency versions `{"a":1}`. The controller checked accepted status
and version but did not rehash accepted upstream artifacts. This is a failed
acceptance boundary even if callers are instructed to call `revise` first.

Related source concern: accepted QA evidence and high-risk review evidence are
hashed at recording time but not rechecked before later ticket use. Author asked
to address stale binding at every transition where acceptance is consumed.

Invocation: disposable directory from `tempfile.mkdtemp`; imported public command
handlers through `python -B -`; no production or provider action. Exact emitted
ticket was `b2d6edded4f64cfaa1c76b181df25edf`; `executed` remained false.

F02 (G03/G05), same source hash: an already-uncertain descendant becomes runnable
when its upstream is revised. Reproduction: accept `a`; dispatch/start `b`; mark
`b` uncertain; revise and reaccept `a`; dispatch `b`. Returned a new version-2
ticket `1c693716563e458e92fcda02457e56cb` while the prior uncertain ticket remained
active (active count 2). Existing uncertainty must survive invalidation and block
replacement work until explicitly resolved. No actual worker was dispatched.


### Round 2 — PASS, bounded local controller

Final review completed September 25, 2026 UTC (September 24 Pacific). Windows,
Python 3.14.7. Author froze candidate before the final verdict. The reviewer
modified only this review report and did not author implementation or author tests.

Both material findings from Round 1 are resolved. One material repair cycle was
reviewed; during that cycle source inspection identified the same stale-binding
family at `start` after ticket reservation, which the author repaired before final
candidate freeze. Initial failure remains failure; this is not first-pass success.
No material findings remain open within G01-G08.

Independent execution comprised **99 separate public CLI processes** using
synthetic files and temporary SQLite journals: 79 adverse lifecycle and validation
calls, plus 20 calls exercising the supplied example through final integration
acceptance. Each call used a fresh Python interpreter, so persisted started,
reserved, uncertainty, review and budget state was consumed across process exits.
A separate rerun of the author's focused suite passed **13 tests** (0.957 seconds).
No tests or implementation were written by this reviewer.

| Criterion | Independently observed disposition |
| --- | --- |
| G01 | PASS: public CLI refused worker capacity 4 and boolean capacity, negative/nonfinite monetary text, unknown action field, missing/self dependency, duplicate task, numeric reservation and escaping path; malformed initialization left no DB. Three outstanding reservations refused a fourth; supplied graph held integration until both exact prerequisites passed. Author cycle/overlap tests also passed. |
| G02 | PASS: output drift after reservation blocked start; upstream QA-evidence drift blocked completion; output drift before dependent QA blocked acceptance; transitive ancestor drift blocked dispatch. Self-review by actual ticket worker was refused. Source binds accepted submission and review evidence to task version/ticket and recursively rehashes accepted dependency artifacts/reviews at consumption. High-risk evidence drift after reservation blocked start. |
| G03 | PASS: revising accepted upstream invalidated descendants while unrelated accepted sibling retained status/version; uncertain descendant refused upstream revision rather than becoming replayable. Example rejected only help-copy, accepted its correction at v2, and preserved input-contract v1. |
| G04 | PASS: initial rejection plus two correction attempts escalated; fourth attempt refused. Unknown actual costs retained all three reservations. Overspend settlement was refused; unknown estimate blocked dispatch. Reservations are not asserted charges. |
| G05 | PASS: pause blocked existing-ticket start; resume allowed it once; repeated start and replacement dispatch after restart failed. Uncertain ticket could neither complete nor be replaced, and upstream revision could not bypass it. Corrupt journal failed closed without rewriting corrupt bytes. |
| G06 | PASS: complete source/import inspection found only local argument parsing, hashing, path handling and SQLite operations; no shell/network/model/provider or production execution path. Tickets and start results state executed=false. |
| G07 | PASS: independent adverse CLI work above plus independent supplied-plan lifecycle ended with input-contract v1, help-copy v2 and integration v1 accepted. These fixture review dispositions are simulated controller inputs, not real substantive artifact QA; this report is the independent controller review. |
| G08 | PASS: operating guide and example match CLI/schema; CI adds the focused suite and changed-path filters while preserving existing validation. No role defaults or old evidence changed in the reviewed package. Remote CI execution/publication remains coordinator-owned and unverified here. |

The coordinator's `demo-result.json` is explicitly historical: it binds the
intermediate `edb0e3779e14eec77ae72f5967f322519ba5afe3405d065c2a250affbaca056e`
controller. It is not evidence that the final bytes ran in that particular demo.
The independent 20-process example run above verified the final candidate.

## Exact accepted artifact binding

Every one of the eight snapshot entries was independently checked for both its
SHA-256 and exact UTF-8 text equality to current file bytes. The frozen bundle
excludes this report and mutable run metadata, avoiding self-referential approval.

Snapshot: `operations/agent-improvement/snapshots/OPS-GRAPH-01-v1.json`

SHA-256: `e2f4464f3a38dd45a3e9082563cd1388a2507f3acce91caceddf760ff9b4f4d4`.

| File | SHA-256 |
| --- | --- |
| `.github/workflows/agent-ops.yml` | `741d3f5141d33fff9a627604b697d1d08f557a491074a7e870e40d4b81bfcc30` |
| `operations/agent-improvement/README.md` | `ba73ed5064e3b0ea9580b7f646a83ed6e06e3a45dc1bc736a44aa4e8af426b76` |
| `operations/agent-improvement/workflow/README.md` | `8da7a88f93bc5e90967739f77ebf4345c45cd5eaf31751ebf3d4a1fd508cf87e` |
| `operations/agent-improvement/workflow/acceptance.md` | `f651982df8e7e261fe765e76379708b65660a03995195343bb27dd499a51cfb4` |
| `operations/agent-improvement/workflow/demo-result.json` | `e97c3ce6c1447f2a9ae9873cd0f7c03d00e7d55ff098fdeb12c550335719ad4b` |
| `operations/agent-improvement/workflow/example-plan.json` | `eca30402919b454afd065201409a27661545594c70a5cf553ccd44159b4a3405` |
| `tools/agent_workflow.py` | `13ef3515861b14c0d24289b984ff1d916a3bdcad5443f1622c1e8a981d9f8b8e` |
| `tools/test_agent_workflow.py` | `93032e22ad51a2b38383de63f80cd267d315bac31b647fa1545d2e34048e8482` |


## Limits and handoff

This pass covers the local trusted-coordinator pilot only. The controller does not
prove a named identity is real, prove review independence, sandbox workers,
execute agents, enforce external provider charges, recover uncertain effects,
authorize production or establish cost savings or customer beta readiness.
Unknown execution settings, subscription usage and build cost remain unknown.
The synthetic test pauses and process exits establish durable state behavior;
there was no hardware/power-loss test, hostile concurrent filesystem mutation
test or arbitrary database-tampering review. SQLite transactions and fail-closed
checks support the local use case, not a security boundary against the journal
owner. No Linux CI result, Git publication or live product claim is included.

Coordinator may close G01-G08 for these exact bytes, preserving first_review=fail,
material_findings_open=0 and rework_cycles=1. Subsequent implementation changes
need targeted independent re-review. Publication/reconciliation to the existing
rolling PR remains a separate verified action.

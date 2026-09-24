# M75 root integration observations — incomplete

Root authored the UI/integration, so this is author evidence, not independent release approval.

## Observed local browser flow

Local native PostgreSQL clone `m75_root_ui_20260916`, company `0fb535aa-9465-4f13-b76a-1262a8eba6e1`, preview http://127.0.0.1:37177. Initial independently reviewed synthetic roster opened and its retained historical report rendered. Browser correction of the declaration reference created version2, kept version1, and reset fleet acceptance to blocked/unreviewed. The separate fleet-reviewer actor then accepted version2 and retained a new report. Browser download was16,532bytes and exactly matched stored SHA256 `64e6bbd72757b40ce23cfe03210282cb43dd80f1aa1bd25770bbfb1de9694cc1`. Private readback receipt `.superpowers/m75-local-browser-readback.json` retained2versions,2reviews,2reports. This was actual browser interaction, not a mocked HTTP flow.

At390×844, DOM document/body widths were375px with390px innerWidth, no document horizontal overflow. Screenshot showed wrapped action controls and status counts. Temporary viewport restored. Form narrow-layout and native print remain pending.

The subsequent real process restart correctly refused startup because the backend author's in-flight migration SQL changed its manifest hash. No receipt was rewritten and no existing fixture was reset. This prior-SQL browser observation is interim; final exact-SQL fixture restart verification remains pending.

## Checks

- Standard staging production build and full ESLint passed. Web suite93passed/412assertions.
- API typecheck passed after backend proof typing repair.
- Full API suite639passed,9native-environment skips,5662assertions; nativeM75 acceptance remains separate.
- Root rerun of independent classification/renderer/decoder:68passed,811assertions after exact bound-coverage proof repair.
- Operator tests initially7passed/62assertions; author subsequently expanded checks. Final frozen pin review pending.

No hosted changes or publication. No full Scope1, released method, filing or assurance claim.

## Pool-stall investigation controls

Standalone Bun driver probe completed20sequentialtransactions with repeated intentional rollback at maxConnections1. Actual M75 application probe completed15pooled register-read/no-op-refusal pairs on the isolated root clone. These narrow controls did not reproduce the independent Bun-test ninth-BEGIN stall; the exact retry/conflict path and test runtime remain under independent investigation. No general pooled-release verdict follows from these controls.

Independent reviewer later isolated the stall to Bun test promise-rejection expectation scheduling: the same full native lifecycle passed with shared pool max1 using explicit awaited try/catch assertions. Root standalone controls and this comparison do not show an application-driver defect. Final candidate max4 lifecycle remains required. The small legacy M74 test-only guard independently passed7tests/85assertions with zero database queries on future-manifest refusal.

## Exact SQL findings contribution

At the backend author's request, root authored an exact SQL translation of `deriveM75RosterFindings` as a separate private fragment, for the backend author to integrate into migration0018. Root is therefore a coauthor of that SQL function and cannot provide its independent release review. The function preserves finding order/messages, per-row unknown/unsupported/source checks, and JavaScript Map insertion order for duplicate identity/source findings. A rollback-only native parity check covered50base/independent classification scenarios. Initial test adapter mistakenly used a JSON parameter cast that encoded the input as a JSON string; explicit text-to-JSON casts repaired the adapter. No database change was committed by the parity run. Independent reviewer was informed and retains responsibility for integrated direct-SQL challenges.

Root also authored an exact SQL reconciliation fragment after the independent same-row-key tamper case demonstrated partial shape checks were insufficient. It derives source eligibility, all roster/source/workpaper union rows, exact findings and order, dependency pins, review state, counts, limitations and content hash. Fifty classification scenarios match the entire TypeScript result; a real retained native roster and an empty/null state also match. The first parity invocation exposed a SQL JSON-concatenation precedence error, repaired before handoff. All fragment checks rolled back their temporary function definitions. Backend integrates the fragment; independent QA must accept the final combined migration. Root is not an independent reviewer of either SQL derivation function.

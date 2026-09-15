# M67 independent review plan and closure check

**PASS for corrected M66 closure wording and the bounded M67 scope; M67 implementation acceptance is pending.** Technical and accounting contracts must be reviewed before product implementation. This is a preparation gate, not proof that the annual workflow exists or that any acceptance test has passed. Reviewed September14,2026 Pacific / September15 UTC.

## Assignment and independence

Task M67-QA; reused executor `/root/m63_data`, reporting independently to root. Prior M63 database/adapter authorship is disclosed; no M67 product implementation was authored by this context. Root owns scope/UI/operators/publication/status, CTO owns technical contract and additive database/API, accounting owns independent numerical expectations and wording. Requested critical compute is Astra/high; actual inherited model/effort, resource usage and cost remain unknown. Only this new QA plan is written at this gate. No product, Git, cloud, database, credentials or nested-agent actions are authorized by this planning assignment. Accounting and CTO are directly contacted for bounded contracts; no additional workers were created.

The applicable QA role, operating model, improvement workflow and compute policy were reread. L02 exact staged/committed-byte checks, L06 full effective-input correction variants and the existing actor/lifecycle checks apply. Functional titles do not convey accreditation. This synthetic tool is not a CARB verification or corporate inventory assurance engagement.

## M66 closure review

The feedback record quotes board acceptance and authorization to begin M67. It correctly distinguishes board milestone acceptance from a worksheet review: M66 Version3 remains unreviewed, the factor/method remains unreleased, the inventory remains incomplete and no native M66 print-dialog acceptance is inferred. PR4 remains unmerged. Leading board and continuation sections reflect accepted M66 followed by M67 contract preparation; historical pending-feedback sections are explicitly superseded as current instructions, not rewritten.

**M67-PLAN-F01, corrected:** initial inspection found `operations/status.json.current_m66.status` still `awaiting_board_feedback` and its verification sentence still treating final publication/feedback as pending, despite `board_status: accepted` and corrected leading notes. QA reported the inconsistency before this pass. Root changed it to `complete_board_accepted`, updated the next action and distinguished the initial implementation deployment from the final deployment. QA reread and confirmed the correction. This was a current-record consistency defect, not a product defect or reversal of board acceptance.

Root records final M66 commit `9afde82631e321c0c084454c97a24a2f463a9456`, six passing checks, existing-service deployment `405765fc-a4fe-4fd1-b310-d4a615c0decf`, schema12 and18 committed artifact-hash checks. These final publication/provider observations are root-attributed in this no-Git/no-cloud review; they are not a second independent provider query. The earlier snapshot-normalization defect and repair remain preserved. Zero M66 active workers is a completed-workstream statement, not a claim that current M67 assignments do not exist.

## Scope and required contract decisions

M67 is a separately manual annual2023CAMX worksheet for one fictional facility, with exactly12 month slots. No automatic M66 import, no inherited bill attachment or source authority, no copied review and no implication that a January source covers other months. Existing M63â€“M66 workflows and records remain available. At least one entered month is required to save; explicit zero qualifies as entered, while blank/null remains unknown. Twelve entered months mean full-year electricity coverage only, never complete company inventory or released/assured output.

Before implementation, CTO/accounting must make the following executable rather than leaving them to UI inference:

- Exact monthly request representation and ordering; reject duplicate/missing slots, unknown fields, unsupported months/year/geography, numerical JSON values and unauthorized derived coverage/totals/evidence claims. Specify whether user blank maps to null before transport; persistence must not confuse empty text, null and zero.
- Monthly maximum/precision and separately derived annual aggregate bounds. Reusing a monthly validator for the annual sum would incorrectly reject a valid full year. The exact aggregate-before-display policy must bind method, canonical input, coverage and result identities.
- Whole-version effective input tuple and no-op semantics: all12 canonical quantities plus permitted labels. Null-to-zero, zero-to-null and label-only changes are valid corrections when at least one month remains entered; equivalent decimal spellings are no-ops. A correction removing the final entered month must refuse atomically.
- Captured review/report identity, historical-version report creation and retry behavior. Define recovery of an existing unreviewed snapshot after a later review versus refusal of a newly requested stale absence; do not silently substitute current review state. Trusted actor/time must be captured after the company lock, with post-lock authorization rechecks.
- Annual-specific limitation acknowledgments and evidence wording. Full electricity coverage must not remove manual/unverified, unreleased candidate, market-based exclusion, Scope1/3 omission or no-assurance qualifiers. Reject forged M66 source/confirmation/review fields at API and SQL boundaries.

These are contract prerequisites, not findings against code that has not yet been supplied. The governing scope itself is acceptable and does not authorize a new subscription, merge, customer/factor release, other geography/year, market-based method or Scope1/3 expansion.

## Independent challenge matrix

| Boundary | Planned independent challenge and expected result |
| --- | --- |
| Months and missingness | Empty read has no fabricated version. All12 null refuses save. One zero plus11 null saves as one entered month with zero subtotal. All12 zero gives full electricity coverage while overall completeness/release remain false. Null, zero and missing slots cannot collapse. Duplicate/unordered/extra/unsupported months refuse according to the explicit contract. |
| Decimal arithmetic | Independently specified cases traverse actual PostgreSQL driver, persisted read, API and actual frontend decoder. Test monthly extrema, annual extrema, fractions, exact/near half-even ties, noncontiguous partial years and totals whose sum of monthly rounded displays differs from rounding the annual exact sum. Never use browser floating-point output as an oracle. |
| Canonicalization | Plain strict decimal text only; test exponent/sign/whitespace/Unicode separators, excess precision, overflow, negative values, empty strings and numerical JSON. Canonically equivalent inputs converge or no-op as specified; hash identity must not depend on object key ordering or browser formatting. |
| Correction tuple | Individually change January, December, each permitted label, null to0,0 to null and an interior month. Require new immutable version and reason; equivalent annual sum with different month distribution still changes version. Reversing two monthly quantities is not a no-op merely because the total matches. |
| Review and report snapshots | Different-manager exact-version review; self/stale/cross-actor refusal. Correction needs fresh review. Capture unreviewed, accepted and changes-requested snapshots; later review/correction leaves earlier report bytes unchanged. Check historical report recovery, repeated keys, different payload with same key and different-actor equivalent requests. |
| Concurrency | Competing corrections admit one predecessor successor; concurrent create/review/report capture has explicit consistent outcomes. Use a genuinely blocked transaction to test post-lock time ordering and revoke an actor while waiting. No partial request/audit/report or leaked pooled identity after rollback. |
| Tenant and actor | Active invited second tenant, member, outsider, signed-out, uninvited membership and revoked subjects through list/read/save/review/report/download. Reauthorize bytes and reject late responses after actor change/unmount. Test direct runtime SQL privileges/RLS as well as HTTP. |
| Integrity | Tamper month slot/value/null, coverage metadata, exact/display totals, method/limitations, trusted actor/time, predecessor, review decision and report bytes/hash/length. Test coordinated substitutions and missing audit rows. Corrupt history fails reconstruction; it is not silently omitted. |
| Report and browser | Twelve readable ordered rows, explicit missing labels and entered-month subtotal/full-year electricity labels. Escape maximum-length company/facility/reason/reviewer text. Repeated page qualifications, readable page breaks, exact downloaded HTML bytes, current/historical view, verified print tab, narrow layout, keyboard action and released busy state. Distinguish actual print artifact inspection from native dialog observation. |
| Preservation/recovery | Root provides an isolated schema12 clone and frozen baseline before reviewed migration. Compare every M63â€“M66 original row/report/source hash, then reopen/restore the candidate and verify annual plus legacy lineage with runtime credentials. Never overwrite retained baseline/candidate databases. |
| Publication/hosted | Bind all product/contracts/tests/operators/image entries, then exact staged and committed artifact bytes. Require actual Linux image/import checks before live migration. Root performs backed-up migration, real authenticated partial-to-full/correction/review/report workflow, exact download, refresh/restart and preserved legacy comparison, followed by board demonstration. Local tests cannot satisfy live gates. |

A useful independently calculated anti-rounding example using the retained candidate195.0402888kgCO2e/MWh is twelve entries of1kWh: exact annual2.3404834656kgCO2e displays2.3405, whereas adding twelve monthly four-place displays incorrectly yields2.3400. This Decimal-derived planning example is not yet a replacement for accounting's final approved cases. If the monthly ceiling remains1000000kWh, the sum ceiling must be derived across12 months rather than passed through the one-month ceiling.

## Evidence and acceptance sequencing

First obtain reviewed technical and accounting contracts and independent expected cases. Then freeze the untouched database baseline and candidate migration hash; challenge local native/decoder/report behavior with meaningful independent cases. Preserve first failures, repairs, framework normalization observations and QA harness mistakes separately. No test count substitutes for criterion coverage.

Issue local integrated acceptance only for exact bytes, followed by image/operator review and exact staged/committed publication verification under L02. A changed template/migration requires a new candidate/binding and affected rechecks; never overwrite previously accepted receipts. Hosted evidence receives a later independent handoff review with provider/browser observations attributed to root, before board feedback advances dependent scope. Financial or professional claims remain outside this task.

## Reviewed input hashes

SHA256 below is UTF-8 text normalized to LF, without a BOM. The shared status/board/continuity files are point-in-time context, not immutable future instructions. The status hash is after the root correction; its first observed inconsistency remains recorded above.

| Input | Canonical LF SHA256 |
| --- | --- |
| `docs/research/annual-electricity-milestone-67.md` | `1c55ee9589ebc814625a63b57c19df505f6f1200e73175282bd0b40407aa696f` |
| `operations/feedback/2026-09-14-milestone-66.md` | `8de6cd44aa368b3330137bbef0d2d35f3dc8a0d046bece1dd47a6ffb0449a035` |
| `operations/board-report.md` | `42ac70490e690aa4a2bf79b585126a1b2aa41d10c90fe871010902035dcd835a` |
| `operations/next-session.md` | `2fbfecce0a823251c5b8b478298e5d91e934ac9250a086e96e1686cb750f758c` |
| `operations/status.json` | `4da7228703225ee3380e5bd0711dca09d356f4f5b8ff540ab403bd324361a2f9` |
| `operations/agents/qa-lead.md` | `0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94` |
| `operations/agent-improvement/lessons.json` | `111741965f0bdeb8fbdaa4a42adf212c775993e29f82a4d801578c8a71a50a6a` |

## Corrected technical design review

The corrected technical contract `docs/research/m67-technical-contract.md`, canonical LF SHA256 `df9c3ab8b1911b0c2ac6bee08bb72d41bba63eb73e47d37e1c466f7e8ed17dd2`, receives **PASS for bounded technical design**. Its explicit all-null422 rule supersedes the earlier draft discussion; persisted aggregates are non-null with1–12 entered months, and null remains confined to missing monthly values. The separate12,000,000kWh aggregate bound, complete canonical input/result/review/report preimages, strict chronological slots, full effective tuple, manual evidence basis and historical captured-review recovery rules address the planned contract risks. Post-lock trusted time and authorization plus coherent reads are explicitly required. No product implementation or runtime behavior is approved by this design verdict.

The accounting draft read at this gate, canonical LF SHA256 `6dc776b8394686e27e6989584c9075e7ad9656ee4196dbb3b81e0173fc135ac2`, agrees with the technical representation and coverage semantics. Its referenced `m67-accounting-cases.json` was not present at that observation, so final accounting delivery/case approval remains a prerequisite. This is a delivery dependency, not a defect in an as-yet-unimplemented calculator. Final cases and any changed contract require a subsequent binding before implementation acceptance.

## Final accounting delivery and independent design gate

**PASS for the bounded M67 design and accounting-case contract; implementation may proceed under root authorization.** Actual implementation/native/decoder/report/hosted acceptance remains pending. Corrected accounting contract canonical LF SHA256 `299405d311f009aaebd8dffa8e213d74511297236f426c550f87cf3fd484b2f1`; corrected accounting cases canonical LF SHA256 `06ab494cc6cba1cbfbc5808517f990743ceb33e2531611d50fab5d9b5224956c`. The earlier missing-case dependency is now satisfied.

**M67-PLAN-F02, corrected:** first independent case inspection found misencoded full-year label punctuation (`U+00E2 U+20AC U+201D` instead of `U+2014`) and a misencoded adversarial digit (`U+00D9 U+00A1` instead of `U+0661`). The latter would have tested generic nonnumeric text rather than an actual Unicode digit. QA reported both to accounting, who repaired them with explicit codepoints/UTF-8 and preserved the finding. This was a preimplementation expectation-artifact defect, not a product arithmetic failure. The initial observed case hash was `f0943c762c246d7b11caf6901de6418c2a27729d85c65f90aafafe036867741d`.

The independent `m67-design-cases-check.py` imports no product code. It recalculates all12 accepted cases/144 month slots using Python Decimal precision96, separately verifies aggregate integer quotient/remainder half-even rounding, canonical monthly/aggregate strings, coverage, qualifiers and display-versus-sum differences, checks15 directly encoded invalid-quantity cases and confirms the exact corrected Unicode specimens. **1005 assertions passed**; see `m67-design-cases-receipt.json`. The other structural refusal mutations and eight lifecycle expectations were reviewed as design cases; they have not yet been run through an implementation. No native database, SQL canonicalizer, Bun API or frontend execution is implied by this arithmetic design check.

Root has provided `.superpowers/m67_qa-schema12-baseline.json`, identifying isolated `m67_qa`,48 tables and1488 original rows. The receipt binds this root-produced baseline file; QA has not queried or modified that database at the design gate. Preserve it and take an independent UTC/row-hash baseline before applying the final reviewed additive migration. Subsequent native tests must directly compare SQL/Bun canonical JSON preimages (including escaped ASCII labels, null markers, sorted keys and timestamp strings), not merely compare opaque claimed hashes. Whole-year integer aggregate magnitude exceeds JavaScript safe integer after factor multiplication; BigInt/exact numeric handling must remain intact throughout serialization.

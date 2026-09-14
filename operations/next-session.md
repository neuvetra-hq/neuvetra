# M65 live - board review next

Current and historical synthetic worksheet versions now have immutable, readable HTML reports with captured review state. Version4 remains25000.000kWh -> exact4876.00722 -> displayed4876.0072kgCO2e and unreviewed. All four original worksheet versions/reviews and the original M63 report/review are preserved. Reports survived a service restart and fresh authenticated readback.

The live browser opened current and historical reports, downloaded the exact verified HTML, and exercised narrow-screen and keyboard controls. The original embedded Print action failed to show a preview for the board; the reviewed repair opens a dedicated verified print view with browser Print instructions. See docs/research/m65-hosted-verification.json for the final observed print outcome and exact deployment. Original failures and review evidence remain preserved. Six CI checks passed for the implementation. Same rolling draft PR4; no merge or new subscription.

For review, open Electricity worksheet, Find saved reports for version4, then Open report. Use Open print view and the browser Print command (Ctrl+P or Command+P). Download HTML report saves the exact verified document. The report remains synthetic, incomplete, unreleased and without assurance. Board feedback is the next gate; do not start dependent M66 work yet.

Scoped CTO, accounting and independent QA deliveries are closed after review; these are not persistent workers. Requested critical compute is recorded separately from unknown actual settings/cost. See evaluations/research-qa/m65-hosted-handoff.md and the immutable role snapshots. Historical sections below are retained as dated context, not current status.

# M65 live - final print-view check pending

Implementation3d6fdfa0e18d924c6495866f2db21c088089f9d5 is published in rolling draft PR4; all six CI checks passed. Existing Railway deploymentfe21d898-1b02-4960-9f72-20774ec3a6ef is SUCCESS on schema11. The read-only hosted revisit at2026-09-14T22:51:04UTC preserved both exact reports, all four worksheet versions/reviews and the original M63 report/review. All four test Auth sessions closed204. No merge or new subscription.

Current Version4 and historical Version2 opened correctly, the actual downloaded HTML hash matched, and narrow-screen/keyboard checks passed. The board reported no native preview from the embedded print action. The reviewed repair now opens a dedicated verified print view with browser Print instructions. Local action/decoder checks passed12/74; this is not native browser proof.

Chrome blocked the final live reload because another extension panel was open. The board has been asked to close it. Next: inspect the deployed Open print view, verify browser Print, finalize independent hosted handoff and role records, publish the remaining evidence/closure documents, and collect board feedback. Do not call M65 complete or start dependent work yet. The three immutable role snapshots are prepared; role runs remain in progress. Temporary local PostgreSQL and report-preview services are stopped. No worker is currently executing outside root; no persistent agents or measured compute/cost savings are claimed.

See docs/research/m65-hosted-verification.json and evaluations/research-qa/m65-print-view-supplement.md. Final handoff is explicitly still a draft. Existing earlier reports and supplements remain immutable historical evidence. Continuation helpers in .superpowers include m65-close-records.py (do not run before final acceptance) and m65-hosted-record.py (initial draft generator; do not rerun over newer verification).


# M65 implementation — local verification passed; deployment next

M65 implementation is authorized and adds readable, printable immutable reports to current/historical saved worksheet versions. Accounting and independent local QA passed; print overlap was caught and repaired before deployment. The final candidate requires image CI, schema11 upgrade, hosted browser/API/restart checks and board feedback. M64 remains accepted; preserve the board's Version4 and original M63 report. See docs/research/m65-execution.md and evaluations/research-qa/m65-private-report.md with the print supplement. Roles are task-scoped, not persistent workers; actual compute/cost remains unknown.

# M64 accepted and published; M65 selected

The board accepted M64 after saving Version4: 25000.000 kWh -> 4876.0072 kg CO2e. Root verified the saved correction reason, three earlier versions and their review states, and persistence after refresh. Version4 remains awaiting a different manager review; board milestone acceptance does not create that review.

M64 code is already pushed and deployed: 2b2129505ab613e0861039f23e5a751c7f1b9465, six successful CI checks, Railway deployment 8aaa07f4-a7bd-4eb8-be5d-04eb7b7c3956 SUCCESS, live schema10 readiness verified September14. Draft PR4 stays the rolling delivery line and is unmerged. See operations/feedback/2026-09-14-milestone-64.md. Historical entries below retain earlier evidence and pending gates; they are superseded by this section.

M65 is selected: a readable, printable report for an exact saved synthetic worksheet version. Freeze source and review snapshots so later corrections or reviews cannot rewrite an earlier report. Scope and acceptance: docs/research/worksheet-report-milestone-65.md. Implementation has not started. First implementation gate: CTO report identity/authorization contract and accounting wording review, then engineering and independent QA. Preserve M63 reports, M64 records and candidate/incomplete/unreleased qualifications. No new hosting subscription or customer launch.

# M64 live — board feedback next

M64 is deployed on the existing https://www.neuvetra.ai private synthetic site. Invited managers can enter fictional January 2023 CAMX electricity, save exact subtotals, correct with a reason and review another manager's exact version. The real browser exercised review, negative-input refusal, correction, history and narrow-screen layout. Version3 remains unreviewed after correction; historical reviews remain. The original M63 report/review hashes are unchanged. Service restart and new authenticated readback pass.

All six remote CI checks passed for implementation ea31275; existing-service deployment47822f07 is healthy on schema10. Two predeployment numerical/driver defects and two packaging iterations were repaired and preserved in evidence. Startup retries before migration required redeploying the same image afterward; no records were deleted. A local OneDrive index mapping issue was recovered using a preserved alternate index, then synchronized. No new hosting subscription or PR merge. Final independent handoff review passed; all scoped specialist deliveries are closed. Board feedback is the next product gate.

The browser is left on Electricity worksheet. For the board demonstration: choose Correct this quantity, enter an invented quantity and a reason, then Save corrected version; use Previous versions to compare. A new version always needs a different authorized manager's review. This remains synthetic, incomplete and unreleased, with no assurance. New Auth sessions were tested through API and the existing browser reauthorized on reload; a fresh browser sign-in-link flow was not repeated.

See docs/research/m64-hosted-verification.json and evaluations/research-qa/milestone64-private-worksheet.md. No persistent cloud agents or automatic improvement scheduler is claimed. Accounting, CTO and QA used bounded assignments; actual compute/cost metrics remain unknown. L07 now requires the native PostgreSQL driver/decoder regression in CI. Await board feedback before M65 or other dependent work.

# Current continuation — M64 implementation underway

The board authorized starting M64. Accounting approved strict synthetic quantity inputs and independently derived rounding cases. CTO owns database/API implementation; root owns guided entry and existing-host integration. Independent QA is dispatched in reused m63_data context after the runtime refused a fresh agent at its thread limit. This context authored M63 database/adapter/containment and source-manifest code, but no M64 code; its M64 review is independent, inherited M63 code receives regression checks. Requested critical routes are Astra/high; actual compute/cost remain unobserved. Implementation and independent local QA pass. Supplemental publication review and hosted deployment/browser verification remain pending. Preserve exact M63 report/review; rolling draft PR4 remains unmerged.

# Current continuation — M63 accepted; M64 selected

The board accepted the repaired live browser and confirmed no further M63 browser action is needed. M63 is complete for private synthetic staging: real sign-in, saved workflow, exact report/review, tenant boundaries, compatible rollback and application restore. Published implementation 952ab025156e4d60a10ad0ac30b237fa8d0a8a15 has five successful checks; deployment 937f007f-5ecd-4fed-a84d-7d9194d60292 and actual signed-in browser verification pass. Fresh readiness200/signed-out401 pass. See operations/feedback/2026-09-14-milestone-63.md and evaluations/research-qa/m63-board-closure.md. Preserve the F03 escaped defect and strengthened L04 checks.

Next: M64 guided synthetic electricity entry and a versioned draft worksheet, scoped in docs/research/guided-electricity-entry-milestone-64.md. The first implementation dependency is independent accounting approval of the variable-input decimal/range/rounding policy and expected cases. Do not simply relax the fixed M63 fixture decoder. M64 implementation has not started; planning/review assignments are finite executions, not persistent agents. Use existing role routes, scoped delegation and independent QA. Keep the same rolling PR4; PR4 has not been merged. Recheck remote head and actual worker state before acting.

No new hosting subscription. Customer launch, generalized uploads, new factors, billing and annual report generalization remain outside M64. Portable/Auth recovery, proactive alerts and scheduled backups remain explicit launch gaps.

# Historical M63 implementation and browser-repair continuation

Board feedback M63-F03: signed-in saved-workspace revisit rejected a successful calculation response. Exact frontend JSON object-order comparison fixed and independently reviewed in PR4 commit 2985ed3; original failure preserved. Recheck latest CI/deployment and verify the actual signed-in browser before renewed demonstration acceptance. See evaluations/research-qa/m63-browser-contract.md and the appended browser-contract receipt; do not treat prior API/recovery passes as browser proof.

September 14, 2026. PR #3 merged to main at `0127b9e12358b4e2d687acec1be30365d3e293a4`, verified by GitHub and ancestry. The board approved M63: real sign-in, durable hosted storage, tenant isolation, monitoring and recovery/rollback for the existing synthetic inventory-to-reviewed-report flow. No customer deployment is authorized by this milestone.

Work now uses `codex/m63-private-staging` from merged main; a new rolling PR is technically necessary because PR #3 is closed. The other product task was observed idle. CTO architecture and independent QA have been dispatched; records distinguish requested critical Astra/high from unobserved runtime settings. Root owns this ledger and cloud inventory. The board subsequently authorized reusing and overwriting existing public test services and database/schema; no current customers/users exist. Reuse Railway Site-Web and the existing Supabase project, with reviewed legacy grant containment and an encrypted recovery backup. Railway CLI authorization is scoped to Neuvetra-AI and completed. No new paid hosting is planned. Do not weaken local demo guards or reuse legacy authenticated access without validating isolation.

Current deployment: existing https://www.neuvetra.ai is live at Railway a0b88ee1-a3a2-4d7b-a742-40faede1a781, candidate 4f454718c4050c432b1599f1edc91940f3edcf2e in draft PR #4; all five CI checks pass. Hosted manager/member session200, outsider403 and signed-out401 pass. Board email delivery confirmed; full workflow, restart, compatible rollback and independent cloud application restore now pass. Current rollback deployment is 77f75a77-4e79-4949-b71b-b39f72b5e978 at the same reviewed commit. Board browser sign-in/use feedback remains pending. Do not rerun one-shot Auth provisioning; preserve encrypted current configuration. Provider-owned default ACL residual remains explicitly deferred under verified containment.

# Historical continuation - M62 complete; board merge decision next

September 14, 2026. Role upgrades are already published and the adopted default/critical model routes remain in force. M62 has repaired the inherited GHG collector through explicit readiness: 43 checks pass and three unfinished mobile cases remain visible as deferred. No mobile factors or expected emissions were invented.

Local application checks pass; all 26 changed product/data files match their latest reviewed versions. Independent M62 technical and closure reviews passed. Implementation `d4ffd292f0e85991aeb4f2b3db4331fdf571a11d` is published to PR #3 with all four visible GitHub checks successful. [Publication receipt](../docs/research/m62-publication.json) records exact links and HTTP 403 for branch-rule configuration. See [M62 record](../docs/research/pr3-merge-readiness-milestone-62.md) and [role pilot](agent-improvement/m62-pilot-review.md).

The remaining step is the final PR #3 board merge decision reserved in the M61 handoff. Nothing has been merged or deployed. Merge is not deployment: the API retains development/test guards, the browser requires explicit preview flags, and ordinary production builds exclude the demo. A later staging-productionization milestone requires separate scoped acceptance before customer use. Do not start a dependent product milestone before the board's feedback.

# Historical continuation — M61 second-manager report review complete; M62 merge readiness next

September 14, 2026. **M61 is complete for its bounded local synthetic scope, independently accepted and published in [PR #3](https://github.com/neuvetra-hq/neuvetra/pull/3) at implementation commit `b74803f23edb6b2eecdb4b1eb5af2c57796178a4`.** A second authorized manager can record exactly one immutable acceptance of an exact M60 report hash after acknowledging all seven limitations, or one routed change request with a safe bounded note. Every read reconstructs M59, regenerates M60, recomputes the M61 decision hash and requires one exact matching audit event.

Independent QA `922bb010ad76191c64b4329d08704900a79cb6124bc44e1332ef226d82e01dc5` passes after five material repairs. Full checks pass API 625/5,451, web 70/283, database 29/263, all ten type-check tasks, lint, builds, production exclusion and 12 bounded calculation checks. The clean browser journey accepted exact report `f013b628…` with decision snapshot `69a6520e…`; a member saw the same immutable result, another tenant saw no workspace, and signed-out access required authentication.

The first Linux CI run exposed only a 5.066-second completion against a 5-second default on the expanded composed test. A one-line test-only repair sets a 30-second deadline without changing any assertion or product code. Independent follow-up QA `c63d8d236…` passes focused 4/131 and full API 625/5,451; fresh Linux CI is required after publication.

The one remaining repository-wide merge-readiness issue is inherited: `bun run test:ghg` cannot collect three old `expected.value: TBD` examples in `ghg-kb/wiki/methodologies/scope-1-mobile-combustion.md`. M61 did not change that specification, loader or harness. The CEO recommendation is **M62: PR #3 merge readiness**—repair or retire those incomplete fixtures with approved evidence, reconcile the complete PR diff, confirm no secrets or unintended files, and require exact GitHub CI. Then request final board authorization to merge PR #3.

Merging PR #3 completes the development checkpoint; it does not place M54–M61 on a live customer environment because those flows are guarded development-only synthetic demonstrations. A later staging-productionization milestone must replace local PGlite and synthetic identity with hosted authorized storage, identity, object retention, migrations, monitoring, backup/restore and rollback, followed by accounting, security and legal acceptance before public cutover.

[M61 record](../docs/research/inventory-draft-report-review-milestone-61.md) · [M61 independent review](../evaluations/research-qa/milestone61-inventory-draft-report-review-10.json) · [PR #3](https://github.com/neuvetra-hq/neuvetra/pull/3)

# Historical continuation — M60 verified draft report complete and published

September 14, 2026. **M60 is complete for its bounded local synthetic scope, independently accepted and published in PR #3 at implementation commit `8393285d313c6e052d340095e1ee6834a5ec0bb9`.** A freshly verified current M59 archive now produces a deterministic, self-contained and printable HTML inventory draft. It preserves all twelve monthly states, exact reported and estimated subtotals, December's null exclusion, source and factor lineage, and both M57/M58 review decisions.

The report displays `139.281000 MWh / 27165.4064643528 kg CO2e`, with `27165.4065` shown at display precision. Every print page repeats draft, synthetic, incomplete, unreleased, no-assurance and `releaseEligible=false` status. Owner/admin creation, member read/download, another-tenant absence and signed-out refusal all passed through each actor's own authorization after the browser-state repair.

Independent QA `6b57efc4c986716abff2e77c3043a471a70f97207a4c0e93fbdd4acd23589b18` passes after four material findings were repaired. The full check passes API 625/5,430, web 67/269, database 26/244, all ten type-check tasks, lint and build. The browser journey passed and all temporary listeners are closed. This is not a PDF, filing, customer workflow, hosted deployment, assurance or release.

The CEO recommendation is **M61: draft-report review and change-request workflow**. Let a second authorized manager review one exact M60 report hash, record bounded comments or request a change, and preserve a tamper-evident decision trail. A change must return to the applicable upstream evidence or inventory step before generating a new report version. Keep professional assurance, filing formats, customer data, deployment and release outside the milestone.

[M60 record](../docs/research/inventory-draft-report-milestone-60.md) · [M60 independent review](../evaluations/research-qa/milestone60-inventory-draft-report-10.json) · [PR #3](https://github.com/neuvetra-hq/neuvetra/pull/3)

# Historical continuation — M59 evidence pack complete and published

September 14, 2026. **M59 is complete for its bounded local synthetic scope, independently accepted and published in PR #3 at implementation commit `12341a61d7ef3187c05875ba91706b88a47155ea`.** The exact approved M58 record now produces a deterministic 17-file ZIP containing raw source bytes, manifests, register and inventory versions, calculation lineage, review decisions, audit history, authority records and a replay contract.

Independent replay reconstructs ten reported, one estimated and one excluded period: `126.788000 MWh / 24728.7681363744 kg CO2e` reported, `12.493000 MWh / 2436.6383279784 kg CO2e` estimated, and `139.281000 MWh / 27165.4064643528 kg CO2e` included, displayed as `27,165.4065 kg CO2e`. December remains excluded with no quantity. Overall inventory completeness remains `incomplete` and release eligibility remains false.

The live browser workflow passed end to end on a fresh database. A manager created the archive after two-person M57/M58 review; the exact download replayed for both an owner and a read-only member; another tenant saw no record; signed-out access refused. The demonstrated archive was 39,213 bytes. The full repository check, database 24/211, API 625/5,416, web 65/263, Python 12 and default-production M59 exclusion pass. Independent QA `39708ab99b96734b51f461f7c274a226304d8e44ce24d8663b59cc3f4bc74a8a` passes all 20 bindings with no open material finding.

The CEO recommendation is **M60: verified-pack draft inventory report**. Render a human-readable draft only from a successfully verified M59 archive, preserve the estimate and exclusion beside the result, expose source/decision lineage and keep incomplete, synthetic and unreleased status visible. Filing formats, customer data, hosted retention, professional assurance, deployment and release remain separate gates.

[M59 record](../docs/research/inventory-evidence-pack-milestone-59.md) · [M59 independent review](../evaluations/research-qa/milestone59-evidence-pack-10.json) · [PR #3](https://github.com/neuvetra-hq/neuvetra/pull/3)

# Historical continuation — M58 annual electricity register published; M59 evidence pack next

September 13, 2026. **M58 is complete for its bounded local synthetic scope, independently accepted and published in PR #3 at implementation commit `38f7cde`.** The 2023 one-facility register now resolves all twelve expected periods as ten reported, one estimated and one excluded. The included draft subtotal is `139.281000 MWh` and `27,165.4065 kg CO2e`; December has no quantity and is not treated as zero.

The owner carries forward the exact approved M57 January result, completes immutable register version 2 and seals inventory version 2. A different authorized manager records the decision. Tenant isolation, forced row-level security, immutable history, full-payload validation and same-key/different-key/concurrent convergence pass. The live browser workflow passed end to end after repairing ISO timestamp normalization and canonical JSON property-order handling. Independent QA `f39e6a9513823ca68b85ee5665cc031f71b3e788991787f837aa38369c9c8491` passes all 20 bound implementation files; database 21/186, API 625/5,399, web 63/253 and Python 12 pass with all type checks, lint, build, production exclusion, JSON and diff checks.

All twelve register periods are resolved, but overall inventory completeness remains `incomplete` beside the result. Release eligibility remains false because the register includes one estimate and one exclusion, lacks market-based Scope 2 and Scope 1/3 assessment, and uses unreleased development factors and methods. This is fictional PGlite evidence, not hosted persistence, filing, assurance, deployment or release.

The CEO recommendation is **M59: deterministic inventory evidence pack and replay**. Export the sealed M58 inventory, both register versions, period evidence and exceptions, calculation lineage, decisions and hashes as one reproducible local package, then require an independent reconstruction of the displayed subtotal.

[M58 record](../docs/research/annual-source-register-milestone-58.md) · [M58 independent review](../evaluations/research-qa/milestone58-annual-register-10.json) · [PR #3](https://github.com/neuvetra-hq/neuvetra/pull/3)

# Historical continuation — M57 bounded draft inventory review published; M58 completion workflow next

September 13, 2026. **M57 is complete, independently accepted and published in PR #3 at implementation commit `4d5827c6d3a0dd9f01fd3364bcb5aa237e786884`.** The accepted M56 line is now sealed in immutable 2023 Scope 2 location-based inventory version 1. It displays `12.346000 MWh` and `2,407.9674 kg CO2e`, with a transparent denominator of one facility across twelve monthly periods and January as the sole covered month.

The owner seals the version and cannot self-review. The administrator must acknowledge the exact four limitations before recording `approved_bounded_draft`; a member can inspect the immutable decision without mutation controls, and another tenant sees no record. Approval remains bounded internal development acceptance: completeness stays `incomplete`, the reporting boundary stays `draft`, and release eligibility stays false.

Independent QA `7ad7dde4eb3ff1766c5cf53daede7b13deb61722a7032ead999144d79259351a` passed after two material findings and one stale count were repaired. Python 12, API 625/5,372, web 60/224 and database 19/139 pass with all type checks, lint, build, production exclusion, diff checks and the browser role journey. No temporary preview service is running. Stage 4, deployment, release and professional assurance remain false.

The CEO recommendation is **M58: annual location-based source register and missing-period completion workflow**. Build an explicit facility-by-month expectation grid for the 2023 boundary, preserve missing, reported, estimated and excluded states with evidence and reasons, add the remaining fictional monthly electricity inputs as immutable versions, and roll them into a newly reviewed inventory version. Keep market-based accounting, customer data, hosted persistence, deployment and release outside scope.

[M57 record](../docs/research/inventory-review-milestone-57.md) · [M57 independent review](../evaluations/research-qa/milestone57-inventory-review-10.json) · [PR #3](https://github.com/neuvetra-hq/neuvetra/pull/3)

# Historical continuation — M55 synthetic bill intake published

Publication reconciliation is complete through M55. All current `apps/` and `packages/` implementation is on the PR branch. M34 had no missing product commit: it closed before frontend/provider activity and was superseded by M35. The apparent M43 omission is a restricted evaluator package whose matrix contains the held-out answer key; it remains local with its exact reviewed hashes. Rejected, consumed, superseded and machine-bound evaluation harnesses remain local historical evidence. See [the reconciliation record](../docs/research/publication-reconciliation-2026-09-13.md).

September 13, 2026. **M55 is complete, independently accepted and published to the existing PR at `05b33953128d40c0698311fb2e069856f6741382`.** The M54 tenant workspace now preserves one exact fictional electricity-bill PDF, extracts its January 2023 service period and `12,345 kWh` deterministically, requires an explicit facility choice, appends the reviewed `12,346 kWh` correction as immutable version 2, and pins that exact version as `12.346000 MWh` to the existing 2023 draft. The UI truthfully ends at **Draft evidence — no emissions calculated**.

Owner and administrator actions pass; the member is read-only; another tenant sees the same absence as an unknown record; signed-out actions refuse. All seven evidence and derived tables enforce forced row-level security. Duplicate commands converge, stale edits refuse, changed bytes refuse even with a claimed digest, and the ordinary production bundle excludes the M55 fixture and surface.

Independent review `56e5807d323a136d0cc4041facb225cd2001341108d142f9b6d61f9915cb07e7` passed all 26 exact file bindings with zero material findings. Focused checks pass 40 tests / 176 assertions; full API 623 / 5,342, web 56 / 196 and database 18 / 101 pass, with type checks, lint, production build/exclusion, database ACL inspection, PDF verification and the browser role journey. Temporary listeners are closed.

The CEO recommendation after board feedback is **M56: calculate a draft location-based electricity line from the exact reviewed bill version**. It should reuse M53's deterministic method and pinned factor lineage, preserve the bill-version link, show the calculation and rounding trace, and refuse stale, unreviewed, foreign or out-of-boundary evidence. It remains local and synthetic; market-based accounting, arbitrary/customer documents, hosted storage, deployment, merge, Stage 4 completion and release stay outside the milestone.

[M55 record](../docs/research/synthetic-bill-milestone-55.md) · [M55 independent review](../evaluations/research-qa/milestone55-synthetic-bill-review-10.json) · [open PR](https://github.com/neuvetra-hq/neuvetra/pull/2)

# Historical continuation — M54 company workspace published

September 13, 2026. M53 is published at `fbbbafdb96018cdf4720315b67b9ab28b9f50ef9`. M54 is published at `b02d3812b54325a9f454815ffc6cd3dd4c49fe9d`; local `HEAD` and `origin/work/scope2-answer-demo` matched after each push.

M54 establishes the first bounded Stage 4 tenant root. A fixed synthetic owner creates and revisits one California company, one facility and one versioned draft boundary through a loopback API backed by a real PostgreSQL migration executed in PGlite. Forced RLS and scoped grants derive identity from `auth.uid()`. Owner/admin writes pass; member/outsider writes fail; a real mixed-company facility link fails; foreign and unknown reads are indistinguishable. The development server starts only with the explicit M54 flag and a development/test runtime, and the synthetic surface is absent from the production bundle.

Independent review `446d646e99b2ce10bfb9f4963d7cb356ec09d6a38e1e2489bf2d3e1c5631e054` passes the exact 20-file binding after seven repairs. Focused M54 checks pass 20 / 73; database 7 / 40; full API 617 / 5,311; web 53 / 185; all type checks, web lint/build, production exclusion and browser owner/foreign/signed-out paths pass. All local preview listeners are closed. Stage 4 and release acceptance remain false.

Collect board feedback on the M54 demonstration before a dependent milestone. The CEO recommendation is M55: one fixed synthetic bill inside the M54 tenant boundary, immutable original/version metadata, isolated deterministic extraction, explicit correction history and executable cross-tenant storage/job/cache/log refusals. Do not use customer data, hosted production services, OCR/model providers, deployment, merge or release without a new bounded decision.

[M54 record](../docs/research/company-workspace-milestone-54.md) · [M54 independent review](../evaluations/research-qa/milestone54-company-workspace-review-10.json) · [open PR](https://github.com/neuvetra-hq/neuvetra/pull/2)

# Historical continuation — M52 compiled offline integration accepted

September 13, 2026. **M52 is complete for its provider-disabled offline scope.** The exact compiled Windows launcher and composed research server passed the success path (`analyze → plan → verify`) with three synthetic provider-shaped envelopes, exact settled cost `3,000,000` nano-USD, empty stderr and one canonical JSON closure. `content_shape`, `inner_json`, `pre_capture`, `transport` and `timeout` each failed safely with no retry, carry, further dispatch or spend; transport and timeout preserve uncertainty. Replay, mutated-child, copied-wrapper and tampered-executable paths refused; loopback ports closed and disposable cleanup passed.

Final candidate `7b0d26e0d6f02fd4e8dfa62b9066a921062c9df301a7888cb4fa6511407a5941`, manifest `1a0ad4323b3e97efe7cbb76c624e642b71162092c7f66dc70cee0edfe427d32d`, rehearsal `5ec391ae1fc4f6c1a7de9941fc25acfbc76aa3fb6f24f60d8ab7690d5bc328d9` and compiled wrapper `d48468453e3093ce6b16557e65412c3f1fb3f1922fda0671524619eedc081499` are bound by 28 manifest pins and 48 transitive child pins. Independent product acceptance `df1617edd0a753e8fd2d47b041c3535429e62d560c641e697a4b377b9f6caf9f` and technical acceptance `c64fd6b7ef4237ee3e1ca2ddd91ccabe739e61d20b6fd3ddedf4d30d250353a1` pass the exact bytes, including composition catalog/unit provenance, retrieval candidate IDs and timestamp checks.

Provider requests, credentials, external network, evaluator access and paid activity were zero. M52 does not prove live OpenRouter compatibility, customer-data authorization, production readiness, publication, merge, deployment or release eligibility. Collect board feedback on this local offline demonstration before any dependent milestone; any live or paid action requires a new exact scope and authorization.

[M52 closure](../docs/research/m52-compiled-offline-closure.md) · [candidate](../tools/research/m52-compiled-offline-candidate-v2.json) · [manifest](../tools/research/m52-compiled-offline-manifest-v2.json) · [rehearsal](openrouter52-provider-disabled-rehearsal.json) · [product acceptance](../evaluations/research-qa/m52-compiled-offline-product-review-v2-10.json) · [technical acceptance](../evaluations/research-qa/m52-compiled-offline-technical-review-v2-10.json)

# Historical continuation — M50 v4 failed safely; M51 v4 closed offline

September 12, 2026. Never rerun `website-epa-live-50-v4-01` or reuse its consumed authorization. One exact H02 analyze request reached OpenRouter/Anthropic, settled native response cost at $0.033685, and then failed during post-response handling. The product returned `unavailable / provider_failure` with no answer, claims, evidence or sources. No plan/verify, retry, carry, evaluator read or further spend occurred. All services are stopped and ports 3012/3016/5174/5175 are closed.

Read `operations/openrouter50-v4-live-execution.json` with product review `9786e6de…` and technical closure `3dd8544b…`. Mechanical closure passes. The exact response-validation subtype is unknowable because M50 discarded the safe stage details. The later wrapper error is separate: it parsed ordinary backend stdout and wrote contradictory zero-request accounting.

The board authorized M51 provider-disabled remediation. Three rejected candidates preserve review findings. Accepted v4 candidate `2461e7b8…`, manifest `d7190718…` and rehearsal `d842552d…` pass independent product review `aa721bb5…` and technical QA `d7022287…`: all 24 pins, seven tests / 40 assertions, type checking and 26 rebound mutation probes pass. The successor persists complete bounded diagnostics, validates and hash-binds the stage/terminal/payload/cost/shutdown chain, rederives the canonical closure before exact stdout/file acceptance, separates logical/synthetic/external counts and never invents zero when authoritative evidence is unavailable. Sanitized response-shape fixtures reproduce `content_shape` and `inner_json`; they are not actual retained M50 output.

M51 repairs diagnosis and accounting only. It does not prove live response compatibility or a compiled Windows wrapper/process chain. Do not start a live provider request, retry, source expansion, publication, merge, deployment or release. Any future live successor needs new secure wrapper integration, fresh evidence, exact cost scope, independent preflight and separate board authorization.

[M50 decision and M51 record](../claude-memory/meetings/2026-09-12-neuvetra-m50-v4-live-failure-and-m51-remediation.md) · [M51 candidate](../tools/research/m51-offline-candidate-v1.json) · [M51 contract](../docs/research/m51-offline-remediation-contract.md)

# Historical continuation — M48 held-out selection blocked; board choice next

September 12, 2026. M48 could not select a materially novel held-out case within the remaining M43 matrix and approved EPA S01–S18 corpus. H02 overlaps live W02/W09; H03 overlaps M43-D04, W06 and provider-visible P03/P04; H05 overlaps provider-visible C11 and W09. CPO report `4cd456bb…` and independent blocked-closure review `173cc14d…` agree that these can support regression evidence only, not a novel product-generalization claim.

H02 engineering stopped before freeze. There is no M48 candidate, request, cost package, allocation, paid authorization or runtime artifact. No provider/model request, credential, network, service, customer data, source expansion, publication, commit, merge, deploy or release occurred. All 184 M46/M47 pins still match. Fourteen unused draft files totaling 116,368,170 bytes were removed from OneDrive after independent closure acceptance.

The board must choose one of two paths: prepare H02 offline as an explicitly labeled regression/recombination check, or keep paid work stopped and authorize a later offline milestone for newly approved source coverage and quarantined evaluator-authored case creation. No exact paid approval or cost estimate exists yet.

[M48 product review](../evaluations/research-qa/m48-heldout-novelty-review-10.json) · [M48 closure QA](../evaluations/research-qa/m48-blocked-closure-review-10.json) · [M48 cleanup](m48-unfinalized-draft-cleanup.json)

# Historical continuation — M47 offline remediation complete; board feedback next

September 12, 2026. M47 v4 is frozen and independently accepted for the provider-disabled local Windows/OneDrive wrapper workflow. Candidate `8261f9f1…`, manifest `d25e0f36…`, rehearsal `16991ffd…` and independent review `8b5e74f7…` bind the backend to the exact dedicated wrapper executable through the Windows-observed live parent canonical path and SHA-256. The prior manual Python-parent bypass, copied or altered wrapper, direct, partial, stale and replay paths refuse before backend consumption or claim. Two clean approved-wrapper runs succeeded in separate pre-created OneDrive-local workspaces and cleaned up.

Question analysis is also repaired: H01 is unchanged, old H04 now produces only `action_out_of_scope`, genuine unresolved references remain `context_required`, and the terminal contract is unchanged. Final verification passed 166 tests / 1,019 assertions, both TypeScript checks, two stable freezer runs, all 161 M46 and 23 v4 pins, with zero provider requests, credential access, network use or services.

Collect board feedback before advancing. The CEO recommendation is M48: prepare one disjoint M43-H02 held-out canary offline, refreshing source applicability, runtime identity, exact request and cost evidence. This recommendation does not authorize a provider call. Paid execution requires a new explicit board approval, and publication remains unavailable because M46 did not meet the board's success condition.

[M47 independent QA](../evaluations/research-qa/openrouter47-offline-v4-review-10.json) · [M47 candidate](../tools/research/m47-offline-candidate-v4.json) · [M47 rehearsal](openrouter47-provider-disabled-rehearsal-v4.json)

# Historical continuation — M46 failed closed; M47 offline remediation queued

September 12, 2026. Never restart `website-epa-live-46`, reuse its authorization or permits, or relabel its H04 result as held-out success. H01 independently passed as a qualified answer in three stages, 63.891 seconds and $0.247266. H04 safely returned `unsupported` / `action_out_of_scope` with no claims, evidence, sources, factor or calculation in three stages, 86.333 seconds and $0.295880. H04 still failed the frozen terminal contract because the response also included a `context_required` gap for “Use this guidance to”.

The frozen H04 issuer failed twice with Windows/Bun `EEXIST` on the existing OneDrive ingress directory. Root then created a schema/hash-bound permit directly before expiry. The backend consumed it, but this did not follow or prove the approved frozen issuer path. Independent execution review `9a6e2508…` therefore fails authorization provenance and release eligibility. Six stages settled at $0.543146 total with zero retries, carry, correction, pending or uncertain cost and no request after H04.

Emergency closure `530b8d15c5bc2b42f1b46a21a65002af057a668965e0efe579b63d56700c9377` seals the failed run. Independent closure QA `c86d4a9e19fcd3fa4830ab548ea82633cd3fa11e3fec3c123babd05a1ba99aa7` rehashed five launch certificates and 48 durable artifacts, separately reconciled spending, and verified PIDs 30452/39160 absent with ports 3012/3016/5174/5175 closed. The emergency schema honestly leaves `all_costs_reconciled=false`; the independent review supplies the exact reconciliation. Preserve the deviation archive and do not expose token contents.

M47 was authorized for offline remediation only. This paragraph preserves the pre-implementation scope: build a new `.superpowers/openrouter-47` path, preserve every M46 hash, repair issuance/provenance and question classification, rehearse on OneDrive with the provider disabled, and obtain independent QA. M47 later completed within that boundary.

Any later live successor needs a disjoint held-out case, fresh evidence, a new costed scope and explicit board approval. Do not repeat M46 H04 as held-out evidence.

[M46 execution review](../evaluations/research-qa/openrouter46-final-execution-validity-review-10.json) · [M46 closure QA](../evaluations/research-qa/openrouter46-closure-review-10.json) · [M47 plan](../docs/research/m46-incident-and-m47-remediation-plan.md)

# Historical continuation — M44 closed at zero activity; M45 recovery candidate next

September 12, 2026. Never restart `website-epa-live-44` or reuse its authorization, H01 permit or retired capacity. The one visible H01 submission used the `127.0.0.1:5175` alias while the frozen gate required `localhost:5175`; it was refused before an ingress claim. No provider/model request, stage, spending event, response capture or H04 artifact exists. Closure reason is `zero_activity_startup`; all ten stages are retired and nothing carries.

Read the sealed closure together with `operations/openrouter44-root-shutdown-correction.json` and independent QA `evaluations/research-qa/openrouter44-closure-review-10.json`. The original root shutdown record incorrectly claimed port 5174 was closed after its check returned access denied. The correction records the stale ordinary Vite process and its subsequent stop. Independent QA verified PIDs 25840, 31100 and 27828 absent and no listeners on 3012, 3016, 5174 or 5175. Do not rewrite the sealed closure or erase the inaccurate original; the correction is part of the truthful chain.

M45 is a fresh run with provider-disabled preparation complete. Candidate `eb80803b5c0b1679e474c11380f4f8afae473eb81245a1565bf16c51943b81b2` and allocation `08fa0f90755953ade04273504f76186dc058b1ddb950f6a5f8116b24f72e2b35` passed independent QA `41f3b96f1988e5239898aa1976a64cfc2f3615f2ee71500c88c652d5a9818ee9`. The visible origin is canonical `http://localhost:5175`; safe `127.0.0.1` GET/HEAD navigation receives a 307 redirect before the app loads, while numeric-alias POST returns 403 without reaching the next middleware, proxy, ingress or provider. Root and QA reproduced 42 tests / 530 assertions, type checking and exact frozen bytes. Preserve exact H01, independent H01 acceptance before H04, exact H04, five stages each, ten total, zero retries/carry, EPA S01-S18 only, direct OpenRouter-to-Anthropic routing, customer-data exclusion and release false.

The next action is an explicit board decision on the exact M45 run and $9.17912 conservative local reservation. M44 approval does not carry. The required paid-authorization file is absent, so the pinned bootstrap cannot start. After approval, independently hash-bind that authorization and complete fresh alias/canonical zero-activity browser, machine, account, source and per-case evidence before any provider request. Commit and push to the existing PR branch only after both live cases independently pass, cost/latency/stages reconcile and ordinary closure passes. Merge, deployment and release remain separate decisions.

# Historical continuation — M43 offline RAG pilot-readiness complete; paid-run decision next

September 11, 2026. M43 has an independent QA pass for offline preparation only. It defines a 14-question EPA-only evaluation matrix with nine development and five held-out cases, while rerunning none of M35 W11, M39 W03 or M40 EPA14-B01. The matrix covers qualified direct support, multi-passage answers, missing company context, absent source coverage, out-of-scope calculations, misleading premises, citation fidelity and retrieval-instruction resistance.

The only proposed primary paid batch is the public/synthetic question-only fixture `M43-H01` followed by `M43-H04`. H01 must be captured, graded and reconciled successfully before H04 may be submitted. Maximum execution is five stages per case and ten total, with zero question retries, zero carry, 180 seconds per stage, 240 seconds per question and a fixed 30-minute supervisor. The expected two-case cost is $0.455912001. The conservative local reservation is $9.17912 and is neither a provider limit nor a guaranteed billing cap.

Before any live request, recheck the exact source release, all nine source/policy pins, current runtime/provider route, exact request bodies, account controls and reservation. The current source review expires at `2026-09-15T23:20:32Z`. Bind any authorization only to S01-S18 and direct OpenRouter Messages API routing to Anthropic Claude Opus 5/Sonnet 5. Stop on any mismatch, failed H01 acceptance, uncertain/unmatched/pending cost or deadline failure. Optional `M43-H02`, `M43-H03` and `M43-H05` require separate authorization after primary closure.

No live request has run. No credential was accessed and no customer data, source expansion, deployment, merge, release or commit occurred. A successful live result would remain a bounded internal evaluation, not customer-pilot or release acceptance. Commercial source rights/applicability, tenant isolation, security, operations and independent launch reviews remain open.

[M43 milestone](../docs/research/rag-pilot-readiness-milestone-43.md) · [Contract](../docs/research/rag-pilot-contract-m43.md) · [Execution plan](../docs/research/rag-pilot-execution-plan-m43.md) · [Independent QA](../evaluations/research-qa/m43-pilot-readiness-review-10.json)

# Historical continuation — M42 deterministic calculation complete; board feedback next

September 11, 2026. The board accepted M41's presentation and directed the next milestone. M42 implements the first bounded Stage 3 product slice at `http://127.0.0.1:5174/?view=calculation`: one fixed synthetic U.S. stationary boiler consuming exactly `1 MMBtu` of natural gas. The canonical Python Decimal engine returns `53.06 kg CO2`, `0.028 kg CO2e` from CH4, `0.0265 kg CO2e` from N2O and `53.1145 kg CO2e` total.

The retained EPA Hub workbook hash matches the manifest. Independent accounting verified Table 1 cells `C38/E38/F38/G38`, Table 11 cells `E524/E525/E526`, HHV and combustion-only notes, and reproduced the exact result. The factor/method are still development candidates: rights, applicability and release review are open. M42 supports MMBtu only, keeps AR5 explicit and does not claim a complete inventory or regulatory result.

The isolated API on `127.0.0.1:3014` invokes the sole Python Decimal authority with no shell; the browser only renders returned strings. Calculate, export/replay and the required wrong-unit/missing-geography/wrong-period failures work. Independent QA found two material defects: the maximum accepted input could round under the original Decimal context, and the record did not pin the exact cells proving HHV, combustion scope, 100-year horizon and AR5. Both were repaired. The 96-digit context and exact boundary regression pass; the complete policy locators now resolve to the same workbook hash/sheet and render in the UI.

Final QA `eb448ec54476d6bfc34179baf6f69d5c6330629b46c907ab7f85a78ff18b14e7` passed the repaired bytes: 6 Python tests, all 602 API tests / 5,254 assertions, all 48 website tests / 169 assertions, typechecks, lint, build, cross-runtime hashes, replay tamper/binding refusal, all required error states, ordinary-production-bundle exclusion, local-only browser traffic and desktop/mobile/keyboard review. M42 is complete as a bounded development demonstration. The next gate is board feedback before selecting a dependent calculation increment.

No provider request, credential, customer data, source expansion, database, deployment, merge, release or commit occurred. Preserve the accepted M41 flow and do not extend M42 to therms, volume, LHV, other fuels, customer inputs or inventory storage without a new bounded milestone.

[M42 record](../docs/research/deterministic-calculation-milestone-42.md)

# Historical continuation — M41 offline board demo complete; board feedback next

September 11, 2026. M41 implemented and independently accepted the local preserved-response demo. Open `http://127.0.0.1:5174/?view=demo` while the explicit development server is running. The page presents W11, W03 and EPA14-B01 in fixed order and states **Preserved reviewed replay**, **Offline replay · no new model request**, `Release false` and the pilot limits. It contains no question form or retry action.

Each local response file is a byte-for-byte copy of its accepted browser artifact and is SHA-256 checked before display. Contract mismatches fail closed as **Reviewed replay unavailable**. Full response, terminal-QA and closure-QA hashes and the distinct M35/M39/M40 enclosing-run dispositions are inspectable. The source-review deadline is shown as historical evidence and is not renewed by replay.

Root and independent QA passed 45 site tests / 165 assertions, typecheck, lint, build and diff validation. QA `7e8167c6c97b15b4bf2da09e0553b962edb91139529c3900b7267c1811f3acca` rehashed 19 bindings with zero mismatch, verified the exact rendered behavior/citations, keyboard flow and 390 × 844 fit, and captured zero external or research/provider endpoint requests. The production build contains no replay artifacts or diagnostic strings.

Only the offline Vite front end is intentionally listening on 127.0.0.1:5174 for board review. Ports 3012, 3016 and 5175 remain closed and no provider service is enabled. Collect board feedback before selecting a dependent milestone. Do not infer deployment, release, current source validation, deterministic calculations, customer isolation or production readiness from M41.

[M41 record](../docs/research/offline-board-demo-milestone-41.md) · [M41 independent QA](../evaluations/research-qa/milestone41-offline-demo-review-10.json)

# Historical continuation — M40 live boundary accepted; M41 demo readiness next

September 11, 2026. M40 completed the one authorized EPA14-B01 live diagnostic and passed independent terminal and closure QA. Candidate `01ef52263ea2b464ca62b69b501e03a656cf874994c9b7bc20fdf75031eb8aee` admitted the exact question once, used four of five stages, allowed zero question retries and carried nothing forward. Direct OpenRouter routing selected Anthropic Opus 5 for analyze/verify and Sonnet 5 for two plan stages.

The website displayed **More source coverage is needed**. The exact captured body is `unsupported` / `coverage_missing`, with empty claims, evidence and sources and a scope gap containing `specified renewable energy purchases`. Terminal QA `53de5e233d7df60ab3881034c8be2551801daf5d5dd0c324d6bc26cafaf2f333` accepted the source, mechanical and answer checks. Exact current-run settled cost is $0.233731001; pending, uncertain, unexpected and retained current-run costs are zero.

Closure `c6ce9dde9c7c0bd24b04ee4649cfdbbb2b992b63196adfc685bd24529f267985` is independently accepted by `60b3e6fe680c565381236197296019db9517b80ff2bdb37abe9fbeae2742ca3e`. Backend PID 29944, frontend child PID 31632 and frontend supervisor PID 25548 are absent; ports 3012/3016/5174/5175 are closed; ordinary preview is paused. One stage is retired, no stage carries, and release acceptance is false.

Across preserved runs, all three intended behaviors are accepted: M35 W11 requests missing company context, M39 W03 answers with support and qualifications, and M40 EPA14-B01 abstains for missing source coverage. Next, define M41 as an offline demo-readiness package: one local board-review flow using these preserved accepted artifacts, clear pilot limits, and no new paid test or deployment. Do not restart M35, M39 or M40.

[M40 record](../docs/research/supervisor-lifecycle-milestone-40.md) · [M40 closure QA](../evaluations/research-qa/openrouter40-closure-review-10.json) · [Accepted screenshot](C:/Users/nimab/Documents/Codex/2026-09-11/realtime-voice-chat/outputs/neuvetra-m40-epa14-b01-coverage-missing-accepted.jpg)

# Historical continuation — M39 closed; M40 offline supervisor repair next

September 11, 2026. M39 completed and independently accepted W03 in one browser submission and three settled OpenRouter-to-Anthropic stages. The website displayed **Supported, with qualifications** with exact approved EPA support. Current-run settled cost is $0.204937; exact cumulative settled cost is $3.306095 and historical retained uncertainty is $1.62485.

EPA14-B01 was never submitted. The exact backend supervisor reached its fixed 900,000 ms lifetime and recorded mechanical stop at `2026-09-11T19:27:01.478Z`. Independent permission arrived 1.299 seconds later, and the root anchor followed 31.091 seconds after stop. The issuer refused the stopped runtime before permit creation. No EPA14-B01 private token, claim, click, provider/model request, stage, spend, capture or terminal outcome exists.

M39 is sealed by the reviewed conservative emergency path, closure `af1f893bd6733a1c534a8c45b00601bb30f4b53efdeca2aab42d32fa2cc510dc`, with independent QA `f4aa6cab3b9234591b323c7e77d8218e68a43e114e59314129e0d30e0b902091`. All ten allocation slots are retired from reuse; do not restart M39 or carry its authorization. Backend PID 23072 and frontend PID 32548 are absent, ports 3012/3016/5174/5175 are closed, and ordinary preview is paused.

Next, complete M40 offline. Preserve M39 and the accepted W03 screenshot. Repair the supervisor lifecycle so a realistic end-to-end regression runs the clock across delayed permission, provider work, capture, independent terminal review and closure while retaining finite idle/request/global bounds. The old fixture advanced case timestamps but never exercised the supervisor loop, which is why it missed the 15-minute ceiling. Obtain independent QA before proposing a paid run.

Any later live milestone is EPA14-B01 only, maximum five stages, zero retries and zero carry, approved EPA S01-S18 only, direct OpenRouter-to-Anthropic routing and a conservative reservation of $3.9377225. That estimate is not a billing guarantee. It needs a fresh candidate, source/account observations, one-use permission and explicit board authorization because M39 had paid activity and cannot transfer unused capacity.

[M39 record](../docs/research/provider-two-case-live-milestone-39.md) · [M39 closure QA](../evaluations/research-qa/openrouter39-closure-review-10.json)

# Historical continuation — M36 complete; two-case live run awaited board decision

September 11, 2026. M36 repaired the ordinary closer in a fresh offline candidate and passed independent QA. M35 remains immutable. The repaired closer validates the browser admission and permission anchor under separate schemas and requires both for settled activity. Its realistic regression preserves settled accounting, stage retirement, zero carry and exclusive closure. Independent QA rehashed 120 pins with zero mismatch, passed 17 runtime tests / 131 assertions, 7 permission tests / 23 assertions, runtime typecheck and adversarial record-integrity probes. Do not launch M36; it has no live authorization and is not shaped for the remaining two cases.

The next proposed live milestone is fully scoped in [the two-case proposal](../docs/research/provider-two-case-live-scope-after-m36.md): W03 then EPA14-B01, approved EPA S01-S18 only, OpenRouter to Anthropic Opus 5/Sonnet 5, five stages per case, ten total, zero question retries and zero carry. The fresh conservative reservation is $7.87852. It would bring monitored exposure to $12.604528 on the independently reconciled view or $16.2966005 while preserving M35's emergency-conservative ceiling. Both exceed the previous $10 target.

Before any credential access, service, browser or paid request, obtain an explicit board decision covering both exact questions, transmission boundary, models/provider, stage/retry rules, $7.87852 reservation and replacement monitoring basis. The conservative choice is at least $16.2966005. Then create and independently review a fresh two-case candidate, recheck the source review before its `2026-09-15T23:20:32Z` expiry, and issue new one-use permissions. No current authorization may be reused.

[M36 record](../docs/research/ordinary-closer-milestone-36.md) · [M36 QA](../evaluations/research-qa/openrouter36-offline-review-10.json)

# Historical continuation — M35 closed; M36 offline closer repair next

September 11, 2026. M35 completed the one authorized W11 browser diagnostic. The exact application outcome was **More context is needed** (`needs_input`): it made no company-specific claim and asked what the referenced company subject meant. Independent terminal QA accepted the result and the exact hash-bound browser response and UI screenshot. Three stages completed with zero retries and $0.2452 settled current cost. Two stages were retired with no carry. Exact cumulative settled cost is $3.101158; historical uncertainty remains $1.62485.

The backend and frontend are stopped and ports 3012/3016/5174/5175 are closed. The reviewed ordinary closer has a permission-anchor schema defect at its admission loop, so its reviewed emergency path sealed M35 conservatively. That closure retains the full $3.9372725 estimate and reports $1.5819195 remaining under the original internal monitoring target. Independent closure QA separately reconciled the exact three receipts and six spending events with no pending or uncertain item. Do not restart M35 or reuse its authorization, permit or retired stages.

Next, complete M36 entirely offline: repair the closer so the permission anchor is validated by its own schema while the browser admission keeps its existing checks; add a regression using both real admission files; obtain independent QA; and update the frozen candidate only for a future separately authorized run. After M36, the remaining browser demonstration cases are supported W03 and source-gap EPA14-B01. Do not submit either without fresh board authorization and a current source review. No merge, deployment, release, source expansion or customer-data use is authorized by this handoff.

[M35 record](../docs/research/provider-pipeline-live-milestone-35.md) · [M35 closure QA](../evaluations/research-qa/openrouter35-closure-review-10.json)

# Historical continuation — M34 online provider validation authorized; not started

The board accepted the completed M33 offline repair and authorized the next online milestone. The next owner must create a **fresh** `website-epa-live-34` candidate for one unchanged W11 submission, obtain independent preflight on its exact bytes and runtime, prove direct browser response capture before the click, and then run under the bounded stop policy in the [M34 handoff](../docs/research/provider-pipeline-live-handoff-34.md). No worker, runtime, service, browser admission or provider request is currently active.

M34 may allocate at most five new stages, with zero carry and zero question retries. M32 used one stage and retired four; its authorization, browser permit and runtime are consumed and cannot be reused. Earlier run allocations and authorizations are also closed or retired. Current retained accounting is $2.855958 settled plus $1.62485 historical uncertainty, leaving $5.519192 of the original $10 internal monitoring target. That target is not a hard billing cap. Recompute the exact M34 reservation before launch; proceed under the current board approval only if the new maximum stays within the remaining target and the question, provider/model and EPA-only scope are unchanged.

Freeze M33 implementation commit `e8718dfc0cabca0821d1c0cf5f252e0ec1d7e70c`, local evidence commit `ee083c3`, semantic profile `885cb919e745544b576e942aa246d3b847eaed17106bf7ffb53335d36f11684b` and OpenRouter profile `29f88895c9c67676e48701bd9aad6d42eed0bd86e573b4d3e197127b807e2b99` into a new manifest. Recheck current official OpenRouter pipeline/plugin/transform documentation, account and organization plugin defaults, the exact request's disabled-plugin settings, approved EPA source/cloud bytes and the `2026-09-15T23:20:32Z` source-review expiry. Use freshly verified Bun 1.3.12, bundled Node.js 24.21.0 and bundled Python 3.12.14 runtime hashes recorded in the handoff; do not silently substitute the separately discoverable Python 3.14.7.

The new runtime must understand M33's finite `router_pipeline` / `shape|material_effect` evidence without retaining raw pipeline values. Stop and seal the first outcome on any identity or pipeline failure, uncertain or failed cost settlement, transport/non-200/timeout/cancellation, source mismatch, browser capture/mechanical failure or terminal answer failure. No retry or policy relaxation is allowed. Retire unused stages, stop exact processes, recheck ports 3012/3016/5174/5175 and obtain independent closure QA. No additional board decision is needed for this exact bounded M34 run; return to the board if scope or maximum exposure grows, source review expires, account controls cannot establish the requested plugin policy, or an exact nonempty effect would need approval.

# Completed checkpoint — M33 offline pipeline repair

M33 implemented the current primary-provider `pipeline` contract offline. Official OpenRouter documentation describes each emitted pipeline entry as a material request or response effect. M32 retained only its failed-field label, so no raw value, stage or cause was inferred. Neuvetra still accepts only an absent or empty pipeline.

Provider identity and router processing integrity are now separate gates. Identity remains strict. A malformed pipeline produces only `router_pipeline/shape`; any nonempty array produces only `router_pipeline/material_effect`. Both fail before accepted identity metadata or model content is retained. Valid HTTP-200 response cost can still settle once independently; missing/invalid cost remains uncertain. Raw pipeline values are never logged.

Current author validation passes 26 focused tests / 669 assertions, all 409 research-composed tests / 4,230 assertions, API and website TypeScript checks, and diff validation. CPO and CTO reviews pass; independent QA passed a 148-assertion adversarial probe and recorded the exact-hash review. Semantic profile `885cb919e745544b576e942aa246d3b847eaed17106bf7ffb53335d36f11684b` is unchanged. New OpenRouter profile `29f88895c9c67676e48701bd9aad6d42eed0bd86e573b4d3e197127b807e2b99` intentionally differs from closed M32 profile `f294427a03cef4f16a2634b218d09f3b139c72a6e090db3a40ef4f20b57e6fb7`.

Do not restart M32 or change its frozen evidence to make historical controller tests accept the new profile. No live request, service, credential, deployment, merge or publication occurred in M33. M33 is committed locally at `e8718dfc0cabca0821d1c0cf5f252e0ec1d7e70c` and remains unpublished. The M32 evidence branch is published through `3835744`. A later paid check requires board feedback, a new immutable run and authorization, rechecked primary docs, verified account/request plugin controls and browser capture. Until absent/empty live metadata is demonstrated or an exact effect is separately approved, live readiness remains unproven.

[M33 record](../docs/research/provider-pipeline-milestone-33.md)

# Previous continuation — M32 closed; `pipeline` identity repair queued

M32 completed the board-authorized one-question live check of the M31 provider diagnostic and accounting repair. The unchanged public W11 question was submitted once through the isolated website. Analyze attempt 1 received HTTP 200 and failed strict provider identity at `pipeline`. The exact received value was not retained. The website displayed **Answering is unavailable**; no answer, retry, correction, or later stage occurred.

The M31 repair worked live for its bounded purpose. The trace retained the finite failed-field label `pipeline`, and valid native same-response cost settled once at 44,565,000 nanoUSD ($0.044565) without granting accepted identity or rendering an answer. M32 added no uncertainty. Cumulative settled cost is 2,855,958,000 nanoUSD; historical uncertainty remains 1,624,850,000; the internal monitoring target has 5,519,192,000 remaining. This is not invoice finality.

M32 closure `ebaea4dd09e07e93bdba55a8c2a22122a1e10cd780d700c15b5fbba317b2964e` is independently accepted by QA review `daa24fad3ac14e295b6f8e984bf572b511351d750bfe9f685a4e3f4f968482b8`. One stage was used, four retired, zero carry, cumulative actual reservations 876. All 13 run artifacts, three launch certificates, eight adapter pins, M30's 63 artifacts and 577 snapshots rehashed exactly. Backend PID 20784 and frontend PID 36340 are absent; ports 3012/3016/5174/5175 are closed; ordinary preview remains paused. Never restart M32.

Final offline launch preparation passed 25 tests / 386 assertions, both typechecks and Python syntax. The direct browser response subscription was unsupported before the one permitted click; the proxy claim, safe trace, visible UI, and explicitly labeled response reconstruction were retained without retry. Independent QA therefore rejected browser mechanical acceptance and did not write a consumable terminal-success record. Do not rewrite this as a captured network response or website pass.

M31 is published at `bab79e08fcec691cf7c72bb6d95a5c507d7a0e47` on the PR branch. Reviewed M32 records are committed at `01ff95f`. Next milestone: determine the current primary-provider contract for `pipeline`, repair the strict identity predicate offline with adversarial fixtures, and obtain independent QA. Any new paid request must use a newly frozen run and fresh authorization. No source expansion, provider change, deployment, merge, or global toolchain change is authorized.

# Closed outcome — run28

Run28 closed after three actual website submissions: one semantic pass, one insufficient-context failure and one provider decoding failure. Seven stages used, eight retired without carry; cumulative869. All research services stopped and ordinary preview paused. Independent QA accepted evidence and closure, not release readiness. Known cumulative cost $2.552456; unresolved attempt7 retains $0.4464625 estimate.

The earlier prelaunch state below is historical and superseded by this outcome.

# Next-session handoff — Neuvetra

September 10, 2026. Current work is the independently reviewed EPA research preview and isolated Scope 2 benchmark. **Continue from actual live journals and the latest board report; do not restart the old revision08 preparation.** This file is a handoff, not a background worker.

## Current checkpoint — recovery28 verified; launch approval blocked

The [recovery milestone](../docs/research/website-recovery-milestone-28.md) completed real cloud-binding verification and safe diagnostics, then froze a fresh isolated three-question website run. [Connection review](../evaluations/research-qa/openrouter28-connection-review-10.json) passed twelve HTTP200 operations with full repository hash/span/access checks. Historical27's exact cloud failure cause remains unknown. Today's separate local sandbox DPAPI setup failure was diagnosed and the existing scoped reader worked under approved host execution. No search/model probe was used.

Run28 manifest `dc7c97d5ee2ea4f6f8b3885556fccd9ed27106f4eadfe8d428dc230a24718cb5` has464 pins/463 archives and [independent preflight acceptance](../evaluations/research-qa/openrouter28-preflight-review-10.json). It has **never started**. Both root launch attempts were rejected by automatic approval review before process creation. The reviewer requires fresh trusted user approval for the approved EPA passages/public questions to OpenRouter and would not accept retrieved original prior user messages as authorization. [Evidence](openrouter28-authorization-evidence.json) · [Execution28](website-evaluation-execution-28.json).

Next action: obtain that fresh approval, then recheck the exact frozen pins, closed ports and September15 23:20:32UTC source expiry. Follow `.superpowers/openrouter-28/handoff.md`: use the existing scoped key wrapper through approved host execution (sandbox DPAPI fails), verify backend/runtime and obtain independent runtime-bound browser permission before starting isolated5175 and admitting each actual question. Root intent authorization.json exists, but no runtime/budget/admission/ready record does. The three unchanged cases are W03/W11/EPA14-B01, with15 fresh stages and no carry. No new spend; prior total remains$2.152794, historical stages862. Do not retire the unstarted28 allocation or treat the tool rejection as a cloud/model failure.

The [final prelaunch check](../evaluations/research-qa/openrouter28-prelaunch-blocked-review-10.json) found every pin/archive intact and ports3012/3016/5174/5175 closed. The ordinary preview pause remains true. Connection/preparation delegates finished; QA completed independent connection/candidate/preflight/state review. No worker, service or scheduled continuation remains active once the session concludes. Browser controls worked but no test question was sent. Older next-action lists below are historical and must not restart their runs.

## Closed checkpoint — evidence connection failure; benchmark measurement complete

OpenRouter is connected. The ten-question comparison across sessions 22/23/26 is complete and independently graded 0/20; uniform run 19 remains 1/20. Isolation 27 was implemented and independently reviewed. Its first controlled website question returned unavailable/cloud_provider_unavailable before any model stage; the request and one-use admission matched. Two website checks remain unrun. Run 27 is closed: both diagnostic services stopped, the ordinary preview paused, and all 15 unused stages retired with no carry. Cumulative model submissions across the historical runs total 862. Reported OpenRouter spending totals $2.152794; run 27 added $0. The original $10 monitoring target has $7.847206 remaining; this is not a billing cap. No complete three-case demonstration or release acceptance is claimed. Next: diagnose the read-only cloud-evidence failure, then review a fresh isolated evaluation. Preserve earlier failures, answer-key isolation and the separate source hold.

Read [the session report](../docs/research/openrouter-session-2026-09-10.md), [execution 27](website-evaluation-execution-27.json), [partial UI review](../evaluations/research-qa/openrouter27-ui-partial-review-10.json) and [shutdown review](../evaluations/research-qa/openrouter27-stop-review-10.json). Do not restart run 27, reuse its consumed W03 permit, or carry its 15 retired slots. Closure 3143e744 and QA stop review 2e879d2b preserve all 418 pins and 417 archives.

The recorded error combines several cloud read, HTTP and network failures; no detailed cause was captured. Diagnose using approved read-only evidence operations and bounded, safe error metadata before another evaluation. Do not use benchmark questions as connectivity probes or change the scoring criteria. The model key worked in earlier runs; run 27 made zero model requests.

Browser tools ignored requested deadlines on several occasions, most recently a five-hour, eighteen-minute combined initialization/navigation call before admission. No model work occurred during that stall; causation of the later evidence failure is unproven. Avoid empty event waits and unnecessary initialization. The existing tab 9/network27 recorded request 8268.45, safe observation ID 16f00a96-588c-424c-aa5e-22e557217b91 and body hash prefix 63a02d05. Do not replay it. No worker or scheduled continuation is running.

## Prior checkpoint — run21 closed; bounded22 implementation

Run21 sealed and closed:4/5 initial checks passed. W04/W06/W07/W11 pass; B03 failed technically during question analysis because its unresolved-reference part had zero required needs.13 stages reserved,157 remain,cumulative730 (not measured billing).16 EPA,10 benchmark and3 browser checks unrun. Exact Bun18652 stopped and3012/3016 checked closed; website5174 remains paused with zero browser submissions. Latest complete run19 EPA16/21,benchmark1/20. Bounded22 design accepted (QAceee53f8/proposal2afe0306); private implementation and independent QA active. Allocation22 9ef1549f:170=157 carried once+13 additional,prior730; immutable21carry08859fa1. No22 manifest or startup yet.

Finish bounded22 implementation under accepted designceee53f8 and independent integration/types/capacity checks before exact freeze/preflight/root launch. Allocation22 is170=157+13,prior730. Preserve original questions/criteria, all source24units55capabilities, fullquestion/freshfidelity and all21 outcomes. Website release still requires acceptedEPA21, sealed31 and3 actual browser checks.

Run21 partial sealbed4aafc and closureb47aa301 preserve148pins/147archives,13receipts26traces and both terminal journals. Independent receipt eac79cc0 records4/5. No proceed record or later groups exist. Do not restart21 or retry its B03. Assess a general contract repair without inventing a need for an unidentified referent or dropping known substantive needs.

## Prior checkpoint — run20 closure and21 preparation

Run20 is sealed and closed: W04/W07/W11 passed; W06 failed technically after relabeling a required condition as background. Result3/4, B03 unrun because the frozen runner applied the failure gate between canary groups.17 EPA,10 benchmark and3 browser checks remain unrun for20. Exact Bun10024 stopped;3012/3016 checked closed.14 stages reserved,156 remain,cumulative717 (not billing). Website5174 remains paused with zero browser submissions. Run21 bounded private implementation and independent QA are active; no21 runtime yet. Latest complete EPA run19 remains16/21; benchmark1/20.

Do not restart20 or resubmit its groups. Its partial seal03aa55d2 and closure9a5b55d3 preserve140 pins/139 archives,4 first outcomes,14 receipts and28 traces. Independent outcome reviewd3f89a47 records the failed condition classification and the intermediate harness gate missed during preflight. B03 was refused before admission and has no score.

Finish bounded21 material-only planner wire and aggregate-five harness repair, independent tests and request-size checks, then exact freeze/preflight and root launch. Allocation170=156 carried once+14 additional,prior cumulative717. Preserve all original questions/criteria and source55capabilities/24units. First W04/W06/W07/W11/B03 once; all five accepted before remaining16EPA/10benchmark; accepted21EPA and sealed31 before3 actual browser checks.

Allocation21 SHA25672becfcf68bff70e27dfe993cb9e82da764e6e9e38eae53c727ff933e3ee0db5; immutable run20 carry declarationbf1fd08c6d468f8ea2580042622b7bfa4e524288681330037a264f7fb0f2c57c. Preserve the old closure and declaration; final21 manifest binding is separate. No21 profile, manifest, authorization or startup is claimed yet. Independent QA caught nested schema sharing and an overly narrow cumulative-need guard before integration; corrected code still needs integrated review.

Keep source capabilitya7724c24,24 unit texts97b2c4e0,27 limitations and September15 23:20:32UTC expiry unchanged. Models, output ceilings,3 normal/max5 stages,64KB requests,8-unit/4000-character answers and deadlines remain unchanged. Run20 packet checks are historical capacity evidence, not21 acceptance.

Three local original factual notes passed scoped independent factual/wording review (candidatea08069a4,QA4ed6d760); exact source-use/downstream dispositions remain pending and none is agent evidence. DATA-S12-01 paper demonstration already received board acceptance; dependent implementation/factor gates remain.

## Historical prior checkpoint — run18 closed, run19 preparation

Run18 manifest7c12b58c/profile92da7e50 passed502 API tests/3904 assertions, API/frontend types and40 frontend/evaluator tests/364 assertions. Independent44 adversarial assertions and33 service/transport tests/220 assertions passed. All42 packet shapes reproduced; ten synthetic shapes exceed64KB and fail before I/O (extra six-need size stress shape is not reachable before first review). Actual five canaries met **4/5 expectations**: W01/W05 answers, W14 mixed source gap and B01 conditional gap pass. W02's named-choice-only projection correctly built8units/3979chars, but omitted U09/U20's required factor-type/data-year wording. Full model review incorrectly approved this incomplete answer; independent QA rejected it. Zero terminal technical failures; one false-completeness observation, no factual contradiction claimed. Remaining16 EPA,10 benchmark and3 browser checks are unrun. Latest fullEPA remains run13 15/21; latest completed FAQ regression0/20.

Root verified/stopped exact BunPID21792 and checked3012/3016 sockets closed. Partial seal8667d1f3 and closure3239dab7 preserve119 pins/118 archives,19 receipts/38 traces and two journals.101 stages carry once to19 plus19 new for120. Prior cumulative reservations592 are not measured billing. Allocation19 21d2b6d1 binds120=101carry+19new and newcapability379447e6. [Execution18](website-evaluation-execution-18.json) records the failed gate.

Run19 is bounded: source_route requires exact requested kind/subject; size-option eligibility checks every sealed need within the union of that part’s assigned projected facet closures (complementary facets allowed; no cross-part borrowing), without certifying meaning or omitting parts. Every cumulative source_route need is excluded from the special absence path so stricter affirmative labels cannot manufacture a newly certified gap. Ordinary fresh review remains. Separately review an additive U13 supplier-factor acquisition route capability against its existing wording and actual S12 source (PDF10/printed7); S10 is a subregion/PowerProfiler passage and must not be used for this anchor. No original question, criterion, unit text or raw source changes. Existing child source-author, engineering and independent QA are actually assigned. Active integration follows concrete metadata/runtime review, then exact freeze/preflight and original five/21/31/browser gates.

The approved24-unit catalog97b2c4e0 remains unchanged. Previouscapabilityd768f4be remains historical. Additive U13-C03 passed independent sourceQAde683c1d; newversion3-epa-route capability379447e6 contains34caps/27limits with alloldobjects unchanged. Root decision is docs/research/epa-route-capability-review-19.md. Exact assembly/runtime review remains separate. Source decision [U24 assembly review](../docs/research/epa-source-acquisition-review-17.md) remains valid. General unit text2500/pool24; total answer8/4000 and64KB request limit unchanged. Source review expiry September15 23:20:32UTC is unchanged. The B01 finite-catalog gap path passed fresh fidelity in17/18; mixed gaps and actual assessments retain full review, and negatives remain terminal. Keep3normal/max5 stages and180/240/245/250-second deadlines. Frontend5174 remains paused; no backend answers. No new raw source upload or production release.

## Board direction

One Neuvetra greenhouse-gas research and accounting application, California/U.S. first. TerraScope branding is retired; FrontDesk remains deferred. Preserve the approved simple green design. Give brief, truthful updates, fix general causes rather than FAQ strings, and collect feedback on a working demonstration before a dependent milestone. [Current board record](../claude-memory/meetings/2026-09-09-scope2-benchmark.md).

The board explicitly approved the prepared EPA/public-question tests and three website checks with existing Supabase, Pinecone and Anthropic services. The benchmark answer key and customer data stay out of requests. Keep the supplied environment export out of automatic loading. Current approval is not publisher-use clearance or production approval.

## Preserve these results

- Run10: 13/21 EPA expectations met; eight technical failures. First official FAQ benchmark: 0/20 meaning points, six technical failures and four displayed source boundaries. Original outcomes, exact request hashes and rubric remain immutable. [EPA review](../docs/research/epa-live-qa-10.md) · [Benchmark](../docs/research/scope2-blind-benchmark-10.md).
- The general repair uses server-derived question ranges, strict whole-question validation and one checked structural correction. A separately source-reviewed supplier inquiry adds U23 to a new EPA catalog; the original22 units and18 source passages remain unchanged.
- Run11: all18 attempted baseline requests failed before model output because of a likely unsupported wire-schema constraint. Feedback, benchmark and browser groups were unrun. Compatibility and batch-stop checks were added without weakening server validation. Preserve this failure and the independent QA limitation.
- Run12 is sealed and closed: profile c1d03471, catalog version2-epa-inquiry, manifest3c19b144. Independent EPA review found **17/21 pass, three technical failures and one false completeness approval**. W04 lost its final token; W14 kept an impossible facet reference in a refusal; B03 spent its sole correction on a token omission; B01 used accurate background without resolving the condition. U23's supplier inquiry passes. The same ten-question regression scores **0/20**, with two technical failures, seven justified boundaries and one incorrect context diagnosis. All31 outcomes,82 receipts and164 trace files are preserved;36 unspent stages carry once to13. PID32980 was verified closed.
- Run13 is frozen: profile b7bd3221, manifest6c43f498 with89 pins/88 archives, source-approved sidecar230060af across unchanged23 units. Actual ready20:10:28.073UTC/PID34756/3016. Independent EPA outcome is **15/21 pass, five technical failures and one false completeness approval**. W02 exceeds the unchanged answer-size bounds after its sole correction; W05/W09 mix capability kinds in one review requirement; W14 confuses source availability with actual answering during whole-question withholding; B03 stops at the4096-token review ceiling with no retained review JSON. B01 begins with a correct source gap but the reviewer weakens the condition to general background and approves U01/U02. U23 still passes. All50 EPA request hashes are audited. The same ten-question regression finished0/20; all31 outcomes,79 receipts and158 traces are sealed and the process stopped.
- Candidate14 was integrated and independently reviewed offline, but failed its first live canary: question-only analysis precedes source/candidate exposure and seals exact parts, operation, kind/subject needs and ambiguous references. Planner cannot repartition/drop needs; reviewer uses sealed need IDs plus own capabilities/limits and may add needs without weakening prior ones. Semantically rejected analysis fails explicitly. Normal3/max5 stages (one checked replacement), admission5,8192 analysis/review token ceilings and safe usage/stop metadata are explicit.64KB request/250KB response and8-unit/4000-character answer bounds remain. FullAPI376 tests/2268 assertions and types pass; independent28 probes plus96 tests/768 assertions pass. Profile b3a03661; manifest2fc04a41 froze93 pins/92 archives. W01 alone failed review after90 seconds;3 stages used,133 left. No review JSON was returned. Separate analysis need mismatch was observed. Process33572 stopped; partial seal e06f1e49 and closure aa0a04e6 preserve this failed attempt. Remaining20 EPA,10 benchmark and3 browser checks are unrun.

## Resume safely from actual state

1. Read [board report](board-report.md), [ledger](status.json), QA report and the latest execution records. Preserve the substantial dirty checkout; local code/reports are unpublished. Prior PR/CI belongs to an earlier version and needs fresh inspection before publication.
2. Current next action: follow actual22 first-five journals and independent acceptance. Run21 is closed;22 is frozen/live. Do not repeat admitted groups.
3. During a frozen run, make no active code, source, catalog or frontend-config edits. Preserve every first outcome. Stop on provider failure; do not silently retry. Any separately approved next run starts the unchanged W04/W06/W07/W11 and B03 exactly once; independent disposition of allfive is required before the disjoint remaining14 baseline and B01/B02. All question meanings and criteria remain unchanged. Repeating the same FAQ ten is a regression, not a new blind holdout. Never fabricate a31-case seal if a failed canary stopped the remainder.
4. Independent QA must audit actual answers, request/source/citation integrity and the exact process. Only after all31 outcomes are sealed and the EPA21 gate accepted may root pair the frontend with3016 and remove the local pause for three bounded browser checks: supported W03, a genuine source gap, and independent W11 company-context handling. Verify the precise frontend change, actual source links and visible results. The frontend was last verified paused on5174; recheck rather than assume.
5. Show the working preview and collect board feedback. Update this handoff, status, board report and meeting result from final evidence. Do not advance to calculations on offline/API-only acceptance.

## Isolation and remaining scope

The question-only payload and evaluator-only rubric are separate under ignored tmp/benchmarks. The application/provider has no file or browsing tools and receives only public questions and approved EPA evidence. The original custodian became unavailable; independent QA took over the original sealed rubric. The coordinator and custodian saw the article; model pretraining exposure is unknown, and three topics overlap older feedback. No claim of zero prior knowledge or OS-enforced isolation is valid.

Source review expires September15,2026 at23:20:32UTC without automatic renewal. The separate GHG Protocol hosted-source expansion is held; the permission request remains unsent and candidate sources remain local/Git-ignored. The unchanged29-case gate and its hidden cases remain unopened by implementation. Broader source coverage, calculations, factor/instrument eligibility, company filing decisions, production security/R8 and persistent orchestration remain separate work.

## Separate completed data preparation — DATA-S12-01

Board-approved Scope 1/2 matrix/completeness preparation is complete and independently design-reviewed; see [decision and paper demonstration](feedback/2026-09-09-scope12-preparation.md) and [QA disposition](../docs/research/scope12-preparation-qa.md). The matrix covers 12 initial screening rows; the design specifies 17 unrun implementation cases. No factors, calculator, customer workflow or source corpus was released. The board accepted the two-site missing-data example on September 9. The design-feedback gate is closed; dependent implementation still requires the EPA acceptance gate and its own release checks. This scoped completion does not resolve the EPA gate or refresh any earlier runtime observations in this handoff. Preparation delegates have finished; role files do not keep workers running.

Latest code checkpoint: 9a72b64452d5e0156f2b3da65e29b20249b1febb pushed to existing PR2; diagnostic and commit-validation reports are included. Other operational history remains local/uncommitted intentionally.

Remote CI confirmed: both Verify jobs passed for9a72b64 in https://github.com/neuvetra-hq/neuvetra/actions/runs/34523778548. User-approved commit/PR update complete; no services or QA workers remain active.
# Current continuation — M50 v4 accepted offline; fresh exact paid decision next

September 12, 2026. M50 v4 is the current frozen candidate. Preserve v1-v3 and their rejection/block records. Candidate `664df11d5b7ddcfe3c99d0fba8ae2b72a8ce19a50954fc27cb349b2f689eb0ee`, manifest `db31c8aac7191cb598bab2210f8d08e6814056ae58e22d75d031ea71d88624a7`, rehearsal `5900aff28ac5114b747600ba2df8d8767b8cbb3b67fe0e295529f7eb9ada2f6c` and wrapper `d03afae8f93fb698bec57892d55102eabe3c4d5cf9561d38f6a1c451bd883488` are stable.

Independent product review `dc407f9d4466eea38e24a93346cc479e50763f7c19467f37d1a4c166a5b1cd85` and technical QA `2041acd0184f4f62f84e7a61393d4c33aa4d3da963a0468f44cde0c7d47bb36c` pass the exact frozen bytes. Technical review passed 32 tests / 356 assertions, all 87 candidate and manifest pins and all 52 wrapper child pins. Windows allowed the exact wrapper; two provider-disabled lifecycles passed; ports 3012/3016/5174/5175 are closed.

Do not execute without a fresh consumable authorization bound to candidate `664df11d…` and review `2041acd0…`. The scope is exactly H02 as a W02/W09 regression, EPA S01-S18 only, direct OpenRouter-to-Anthropic, Opus 5 analyze/verify and Sonnet 5 plan, maximum five stages, zero retries/carry, 180 seconds per stage, 240 seconds for the question and a 30-minute supervisor. Expected cost is $0.271573; the conservative reservation is $3.944535 and is not a billing guarantee.

After fresh approval, create the one-use authorization within 60 seconds and expiry within five minutes. Refresh Personal / Default Workspace account and plugin controls, balance and source evidence within five minutes; refresh wrapper hash, empty production paths, processes, ports and browser origin within 60 seconds. The retained source approval window ends `2026-09-15T23:20:32Z`. Then materialize preflight and run `.superpowers/openrouter-50-v4-bin/m50-wrapper-v4.exe live <workspace-relative> 664df11d5b7ddcfe3c99d0fba8ae2b72a8ce19a50954fc27cb349b2f689eb0ee <authorization-sha256> <evidence-bundle-sha256>`. No secrets are command arguments.

No provider request, credential, external network, paid cost, customer data, source expansion, commit, publication, merge, deployment or release occurred during M50 preparation. The prior publication request remains conditional on a successful live result and independent closure.

# Current continuation — M50 repaired core; Windows policy approval required

September 12, 2026. Do not launch M49 or M50. M49 is frozen and accepted as provider-disabled preparation; its earlier scope approval did not cover a materially changed live adapter. M50 v1 failed independent review and remains rejected. M50 v2 repaired the tested core but is blocked before freeze by Windows Application Control.

The exact blocked file is `.superpowers/openrouter-50-v2-bin/m50-wrapper-v2.exe`, 116,286,552 bytes, SHA-256 `9995fb8c0412001b12bb5712d9bd8581c8f36eb46234da6b4c922598d37bd6e1`. Read `operations/m50-v2-windows-code-integrity-block.json`, `docs/research/m50-v2-remediation-blocked.md`, technical review `evaluations/research-qa/openrouter50-v2-blocked-review-10.json` and product review `evaluations/research-qa/m50-v2-blocked-handoff-product-review-10.json`. Six Code Integrity events confirm the enterprise signing/policy denial. Do not bypass the policy or use the unapproved script-wrapper draft.

Unaffected checks pass 9 tests / 36 assertions plus a focused type check. The provider-disabled composed path reaches analyze→plan→verify with distinct captures, three synthetic native-cost settlements and payload/cost/terminal/shutdown seals. No final wrapper lifecycle, candidate, manifest, integrated rehearsal freeze, independent candidate review or paid authorization exists.

Next action: the Windows administrator or Application Control policy owner must approve or sign the final wrapper. Then hash the exact allowed bytes, update the parent-image pin, rerun the complete wrapper-to-issuer-to-backend provider-disabled lifecycle and refusal suite, freeze new candidate/manifest/rehearsal evidence, and obtain independent product and technical review. Ask the board for fresh exact M50 paid approval only after those bytes pass. Recheck source, runtime, account and browser observations immediately before any eventual paid request.

No credentials, provider request, paid cost, customer data, source expansion, commit, publication, merge, deployment or release occurred. Ports 3012, 3016, 5174 and 5175 were closed after testing.

# Current continuation — M49 offline complete; exact paid decision next

September 12, 2026. M49 completed and passed independent QA. It prepares one exact `M43-H02` question as a regression/recombination of W02/W09 behavior, not a novel held-out canary. Candidate `d954dc0508e26350c138163049adbf13e85814af523e64e84e00a00cb8c6e96c`, manifest `334379536c8a21e2d4d124f85c37a4e7c3615e00c81f75c190d42a59d31c6c46`, rehearsal `61cff517738bab6be176e9a8078ae0dc5c5c42b02eb17b4823e2f47c71bf3a1f` and wrapper `93dbae144918003d3d3da24a9e7ee9edf5c1604e69acd60930f904724e35de42` are frozen.

The exact question is: “How should I research a U.S. grid-average factor for a facility, and what should I verify before treating the result as current?” Model-visible material is the question, ordinary application instructions and approved EPA S01–S18 product corpus. The separate H02 expected result, required points, S06–S10/S18 evidence roles, forbidden claims and grading checks are evaluator-only. Inspect every dynamic plan/verify request body for separation before dispatch; grade only after immutable terminal capture.

The route is OpenRouter Messages API direct to Anthropic, with Opus 5 for analyze/verify and Sonnet 5 for plan, fallbacks disabled and plugins disabled. Permit at most five stages for this one case, zero question retries and zero carried stages. Use 180 seconds per stage, 240 seconds for the question and the 30-minute fixed supervisor. Stop on identity, routing/pipeline, transport, source, cost, ordering, response, capture, shutdown or wrapper mismatch.

Expected cost is $0.271573 from the two latest same-pipeline M46 cases. Conservative local reservation is $3.944535; this is not a vendor-enforced cap or billing guarantee. Retained basis plus reservation is $9.652357001, leaving $6.644243499 below the $16.2966005 internal monitoring target.

CPO acceptance `cc4955049fbd0c58331fade893afb812450f4321a0363a1efb6484bfd7e14abd` and independent QA `57b65614efcf35f053a7efafc4680733a3720c3b6d3ef0f593195398acae3ddb` pass. The author suite passed 184 tests / 1,134 assertions; independent QA repeated the frozen verifier, type checks and lifecycle rehearsal with no finding. No provider, credential, network, customer-data, source-expansion, service, paid-authorization, commit, publication, merge, deployment or release activity occurred.

Stop now for an explicit board decision. Approval must name exactly this one H02 regression/recombination, direct route, five-stage maximum, zero retries/carry and $3.944535 reservation. After approval and before any paid request, refresh official EPA source bytes/applicability, local release/runtime pins, OpenRouter account/workspace/plugin/routing controls, balance, empty attempt paths and browser origin. The current source review expires `2026-09-15T23:20:32Z`.

[M49 record](../claude-memory/meetings/2026-09-12-neuvetra-m49-h02-regression-readiness.md) · [M49 candidate](../tools/research/m49-h02-provider-disabled-candidate-v1.json) · [M49 independent QA](../evaluations/research-qa/openrouter49-offline-review-10.json)

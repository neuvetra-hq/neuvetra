---
id: 2026-09-09-scope2-benchmark
type: meeting
title: "Isolated Scope 2 benchmark and EPA live validation"
status: active
created: 2026-09-09
updated: 2026-09-09
hats: [CEO, CPO, CTO, QA]
related: [2026-09-08-neuvetra-ghg-focus, 2026-09-09-answer-quality-and-session-handoff, overview, site]
mentions: [ceo, c-suite]
sources: [2026-09-09-scope2-benchmark-conv]
tags: [board, ghg, benchmark, quality, operations]
---

## Board direction

The board asked for a brief review of previous work, continued execution toward the next demonstration, and an isolated benchmark using the official GHG Protocol ten-question Scope 2 article. Meaning and information coverage matter; matching published wording does not. The answering service must not receive the benchmark answer key, and improvements must address general causes rather than memorizing the FAQ. The board explicitly approved the prepared tests and three website checks using approved EPA passages and public questions with existing Supabase, Pinecone and Anthropic services. Raw direction and approval are preserved in [[2026-09-09-scope2-benchmark-conv]].

## Decisions

The evaluator keeps reference meaning and grades separate from question-only runtime input. The first baseline remains immutable; later repeats are labeled post-improvement regressions. Isolation is enforced through scoped inputs and audited source/payload hashes, with a procedural evaluator boundary on the shared machine. A public model's prior exposure to the article cannot be ruled out. Three question families overlap earlier board feedback, so the set is not described as wholly unseen. The article is assessed in its historical 2015-guidance context, not treated as a current-law determination.

Proceed with already approved EPA evidence while the proposed GHG Protocol hosted-source route remains held. A newly authored, independently source-reviewed supplier inquiry can extend the EPA catalog without copying the FAQ answers or claiming complete instrument eligibility. Preserve all original source and catalog versions. Full FAQ equivalence and the separate unopened 29-case gate remain distinct from the narrower EPA demonstration.

## Demonstrated results so far

Initial run10: independent review found 13 of 21 EPA expectations met and eight technical failures. The first isolated benchmark scored 0 of 20 meaning points: six technical failures and four source-boundary displays. No refusal counted as an equivalent answer. Exact questions, permitted corpus, provider requests, citations and process bindings were audited; the key did not enter the answering path. [Benchmark record](../../docs/research/scope2-blind-benchmark-10.md).

The next candidate added server-derived exact question ranges, one strictly checked structural correction and the approved practical supplier inquiry. Independent offline review passed 91 tests / 841 assertions, but revision11's 18 attempted baseline requests failed before model output. The wire schema used an unsupported provider constraint, a compatibility issue missed by offline QA. Remaining groups were stopped and all failed outcomes preserved. The minimal repair retains strict server validation and adds compatibility and batch-stop checks. Fresh live acceptance is required; the [current board report](../../operations/board-report.md) and [EPA QA record](../../docs/research/epa-live-qa-10.md) carry subsequent outcomes.

## Remaining work and limits

Run12 subsequently passed17/21 EPA expectations but still scored0/20 on the same ten-question regression. Run13's capability metadata and start-only question partitions passed offline review, then its actual EPA gate regressed to15/21: five technical failures and one false completeness approval. The false approval began with a correct missing-coverage plan; the reviewer weakened the requested condition into a general recommendation and approved a replacement. Own citations and internally consistent capability labels did not establish semantic completeness. These failures are retained, and neither run is a release approval.

Root and independent QA accepted preparation of a separate question-only analysis before the catalog or candidate answer is shown. Its material requirements must be sealed; later stages may add requirements but cannot weaken them to fit available evidence. This is a new proposed architecture with explicit normal3/max5 stages and fresh review/allocation, not a demonstrated fix or zero-error guarantee. General size, support-reference and withholding-state repairs are prepared separately while run13 remains frozen. The broader source-use research distinguishes an original factual-note/locator path from full-document hosting; neither is automatically cleared. EIA generation data is optional later context and does not supply missing accounting rules.

Complete the independently reviewed narrow EPA gate and matched website demonstration, then collect board feedback before a dependent milestone. Broader evidence coverage, the unchanged 29-case gate, deterministic calculations, production security and legacy R8 remain separate. The permission request is unsent. No new source upload, public deployment or persistent worker system is established by these notes. The source review deadline remains September 15, 2026 at 23:20:32 UTC.

The coordinator owns concise, evidence-based status and local promotion. Engineering and independent QA were actually dispatched for this session; saved queues do not keep them working after their tasks end. The original benchmark custodian became unavailable, and grading transferred to the existing independent QA worker with the original sealed rubric; the handoff is disclosed in the benchmark report.

## Separate board-approved Scope 1/2 preparation

On September 9 the board proposed structured coverage/approval before large source expansion. The CEO recommended preparing the coverage matrix and customer completeness design together, then separate stationary-combustion and location-based electricity demonstrations, with later scope driven by pilot needs. The board replied, "Approved! Let's go". This authorizes the bounded preparation increment `DATA-S12-01`, not factor release or runtime activation. The EPA website gate and source-use disposition remain separate.

The [decision and demonstration record](../../operations/feedback/2026-09-09-scope12-preparation.md) links the matrix, missing-data design and independent review. Original bills, facilities and fuels must remain explicitly missing when absent; complete supplied rows cannot establish a complete inventory. Board feedback on the paper demonstration precedes dependent implementation. No customer data, provider call, bulk source import or production change belongs to this increment.

## Later live evidence: revision14

Run13 closed with15/21 EPA passes and0/20 FAQ equivalence. Revision14 passed376 offline API tests but failed its first live W01 review after about90 seconds with no review JSON. Timing is consistent with a deadline, but the transport cause is unproved. Separately, its sealed taxonomy requirements overconstrained a supported conceptual question. Only one EPA case ran; the remaining20 EPA,10 benchmark and3 browser checks are unrun. Root verified and stopped PID33572, checked both backend ports closed, and sealed3 receipts/6 traces.133 unused stages carry once into a separately reviewed revision15 with zero additional allocation. Revision15 preparation narrows conceptual support compatibility while preserving strict conditional evidence and adds safe timeout diagnostics; it is not live acceptance. Current operational records supersede historical preparation state above.

## Later live evidence: revision15

Revision15 passed407 offline API tests, then3/5 first canaries. The earlier conditional weakening is now rejected correctly; W02 size and W14 planner-wire/canonical-review ambiguity remain technical failures. No provider timeout was observed in20 reserved stages. Root stopped exactPID31648 and sealed all40 traces; remaining16EPA,10benchmark,3browser checks are unrun.113 stages carry once into revision16 with no new allocation. The next bounded repair preserves8/4000 and all source/question meanings, adds feasible selection assistance, separates planner/reviewer representation instructions and reviews source-route target classification. No milestone or website release acceptance is claimed.

## Later live evidence: revision16

Revision16 passed445 offline API tests but its actual five canaries again met3/5 expectations. The canonical-review fix works on W05/W14; W02 still chose an oversized manual replacement despite32 valid options. B01 final review contradicted its earlier correct missing-coverage assessment; no false affirmative was displayed. Root stopped exactPID21344 and sealed18 reservations/36 traces,95left. Run17 preparation prioritizes an independently reviewed compact acquisition guide from existing EPA evidence and a narrow finite-catalog absence certificate with fresh semantic fidelity review.120 next stages comprise95 single carry plus25 new; this covers102 normal stages for34 checks and18 corrective margin. Dataset/contract preparation is not acceptance; current operational handoff owns subsequent status.


### Run17 source assembly and allocation

Independent source and assembly review accepted U24 from existing EPA passages, retaining all23 previous entries. Root decision: [source assembly review](../../docs/research/epa-source-acquisition-review-17.md). Catalog97b2c4e0/capabilityd768f4be are bound in allocation17 e79757c9:120 stages from95 single carry plus25 new, prior555 reservations. General text ceiling2500/pool24 keeps total answer8/4000 and64KB requests unchanged. The special finite-catalog gap path is restricted to explain/compare/prepare_inquiry and fresh fidelity review; actual company-case assessments retain full review. Integrated runtime and live gates are pending; no new source upload or production release.


### Run17 actual outcome and next bounded correction

Exact run17 profileade08fb2/manifest25ec9ca4 started22:47:58.577UTC/PID30716 after independent preflight. Five cases4/5pass: W01/W05/W14/B01 accepted; W02 declared validb09 but repeated an oversized selection and was withheld. Fresh finite-catalog gap fidelity passed B01; no external-rule absence or false affirmative claimed.18used102left; remaining16EPA/10benchmark/3browserunrun. Root stopped exactPID and checked ports closed. Partialseal2db7ef3e/closuref863b1d0 preserve116pins/115archives/18receipts/36traces. Next120=102singlecarry+18new,prior573; allocation18ff339dec. Run18 only changes redundant size-choice serialization to exact server projection with unchanged full fresh semantic review; source24 and question expectations unchanged.


### Run18 actual outcome and evidence-target repair

Run18 manifest7c12b58c/profile92da7e50 started23:10:37.047UTC/PID21792. Independent five-case outcome4/5, no terminal technical failures; W02 projected chosenbundle correctly but omitted required eGRID factor type/data-year wording and received an incorrect completeness approval. All19 request hashes verified;19used101left. Remaining16EPA/10benchmark/3browserunrun. Root stopped exactPID and verifiedportsclosed. Partialseal8667d1f3/closure3239dab7 preserve119pins/118archives/19receipts/38traces. Proposed19 ceiling120=101carry+19new,prior592, finalallocationawaitsreviewedcapabilityhash. Bounded repair: exact-subject source routes, part-owned necessary size-option support, and source_route exclusion fromspecialabsence; independent U13acquisition capability uses actualS12 (notinitially suggestedS10). No question/criteria/unittext/rawsource change.

Board follow-up, September 9: accepted the two-site example's customer missing-data visibility with a direct yes. The DATA-S12-01 design-feedback gate is closed; EPA acceptance and dependent implementation/factor-release checks remain. See the linked decision record for the exact scope.


### Run19 closure and bounded20 implementation

Run19 sealed31 and closed: EPA16/21 with5technical failures/no observed false completeness; benchmark1/20(one partial),2technical/6justified gaps/1incorrect context.111stages used9left; cumulative703. Exact Bun36992 stopped,3012/3016closed,frontend5174paused. Run20 source/design approved; engineering implementation and child scaffold preparation active, independent QA separate. No20runtime or browser submissions. Seal f3522011, closure1f59a773, EPAQAeb38217d and benchmarkQA519cf703. Next170=9+161 with explicit verify16384 output room and unchanged effort/deadlines/max5; first previously failing W04/W06/W07/W11/B03. Source/root/independent design and exact assembly approved; integrated software checks/live gate remain. Three original local factual notes are prepared with17spans/20locators, pending independent wording/source-use review; no corpus activation.


### Run20 actual startup

Run20 LIVE ready01:10:27.231UTC: exact140pins/139archives,manifest01ceda53/profilec5e,actualBun10024/3016 independentlyverified.170atstartup; originalW04/W06/W07/W11 baseline-canary exec22937 running, B03next. No repeatedgroups; all5QApass required before remaining16EPA/10benchmark. Frontend5174paused/no browser submissions. Latest completed19 EPA16/21,benchmark1/20; sealed/closed111stages9carriedonce. Preflight75275c03, authorizatione19710ec; root/independentQA/engineering verified actualprocess. No website submissions.


### Run20 closure and bounded21 preparation

Run20 is sealed and closed: W04/W07/W11 passed; W06 failed technically after relabeling a required condition as background. Result3/4, B03 unrun because the frozen runner applied the failure gate between canary groups.17 EPA,10 benchmark and3 browser checks remain unrun for20. Exact Bun10024 stopped;3012/3016 checked closed.14 stages reserved,156 remain,cumulative717 (not billing). Website5174 remains paused with zero browser submissions. Run21 bounded private implementation and independent QA are active; no21 runtime yet. Latest complete EPA run19 remains16/21; benchmark1/20.

Finish bounded21 material-only planner wire and aggregate-five harness repair, independent tests and request-size checks, then exact freeze/preflight and root launch. Allocation170=156 carried once+14 additional,prior cumulative717. Preserve all original questions/criteria and source55capabilities/24units. First W04/W06/W07/W11/B03 once; all five accepted before remaining16EPA/10benchmark; accepted21EPA and sealed31 before3 actual browser checks. Closure9a5b55d3; partial seal03aa55d2; independent outcome reviewd3f89a47; allocation21 72becfcf. The harness preflight miss is preserved, with no fifth result fabricated.


### Run21 actual startup

Run21 live: exact manifestc86d0721/profilea572e763,148pins/147archives, actual Bun18652/3016 verified by root before submission.170-stage allowance=156 carried once+14 additional,prior cumulative717. First W04/W06/W07/W11 then B03 once; all five require independent acceptance before remaining16EPA/10benchmark. Website5174 paused,zero browser submissions. Latest complete run19 EPA16/21 and benchmark1/20; run20 closed3/4 with fifth unrun.


### Run21 closure and22 design assessment

Run21 sealed and closed:4/5 initial checks passed. W04/W06/W07/W11 pass; B03 failed technically during question analysis because its unresolved-reference part had zero required needs.13 stages reserved,157 remain,cumulative730 (not measured billing).16 EPA,10 benchmark and3 browser checks unrun. Exact Bun18652 stopped and3012/3016 checked closed; website5174 remains paused with zero browser submissions. Latest complete run19 EPA16/21,benchmark1/20. Bounded22 design assessment is active with engineering and independent QA; no22 allocation, implementation, manifest or startup yet. Closureb47aa301;sealbed4aafc;QAeac79cc0.

Review the general unresolved-reference representation with independent QA before any22 implementation or allocation. Preserve original questions/criteria, all source24units55capabilities, fullquestion/freshfidelity and all21 outcomes. Website release still requires acceptedEPA21, sealed31 and3 actual browser checks.


### Bounded22 design acceptance and implementation

Bounded22 design accepted (QAceee53f8/proposal2afe0306); private implementation and independent QA active. Allocation22 9ef1549f:170=157 carried once+13 additional,prior730; immutable21carry08859fa1. No22 manifest or startup yet. Pure ambiguity-only questions can only clarify after fresh review; known effects remain required, and no ambiguity can authorize an answer or absence certificate. Source24units/55capabilities and original questions/criteria remain unchanged.


### Run22 actual startup

Run22 live: exact manifesta63cde5b/profile94c58d44,152pins, actual Bun35980/3016 verified by root before submission.170-stage allowance=157 carried once+13 additional,prior cumulative730. First W04/W06/W07/W11 then B03 once; all five require independent acceptance before remaining16EPA/10benchmark. Website5174 paused,zero browser submissions. Latest complete run19 EPA16/21 and benchmark1/20; run21 closed4/5 with B03 technical failure.


### Run22 initial-five gate accepted

Run22 live: first-five independently accepted5/5,15stagesused155left at gate. Exact schema2 proceedfa8efadc binds QA9559a0ba and both journals. Remaining14 baseline submitted once in root exec63697; B01/B02 then10 benchmark follow if mechanics/provider checks permit. Exact Bun35980/3016,manifest a63cde5b/profile94c58d44,152pins151archives frozen. Website5174 paused,zero browser submissions. FullEPA21 acceptance and sealed31 still required before3 browser checks. Latest complete run19 EPA16/21 and benchmark1/20 remain historical.


### Run22 EPA gate accepted; benchmark in progress

Run22 live: fullEPA21 independently accepted21/21,71stagesused99left at EPA completion; QA57aaaf7c. Benchmark10 is admitted once and running in rootexec82788; do not restart or resubmit. TargetT03 has a preserved analysis-fidelity failure; final benchmark meaning/safety grade awaits all31 seal. Latest completed benchmark remains run19 1/20 until graded. Bun35980/3016,manifesta63cde5b/profile94c58d44,152pins151archives frozen. Website5174 paused and0browser submissions; full31 seal then3actualbrowserchecks required before demonstration acceptance.


### Run22 partial closure — 2026-09-10T03:11:47.413822+00:00

Run22 closed: EPA21 independently passed21/21 (QA57aaaf7c). Benchmark stopped at T07 verify HTTP400; exact vendor cause was not retained. Seven observed responses score0/14, not a completed20-point score (QA435feecb); T08-T10 unrun. Partial seal43733b03/closure8b141293 preserve28 first outcomes,95 receipts190 traces,152pins151archives.95 stages reserved,75 unspent,cumulative825 (not measured billing). Exact Bun35980 stopped and3012/3016 closed. Website5174 paused; zero browser submissions. Latest completed full benchmark19 remains1/20. A controlled continuation of only the unrun three questions is in design and independent review; no new allocation/runtime yet.


### Continuation23 accepted design and bounded allowance — 2026-09-10T03:23:45.281324+00:00

Run22 closed with independently acceptedEPA21/21 and partial benchmark0/14 observed7; T08-T10 unrun. Partial seal43733b03/closure8b141293 preserve95 stages,cumulative825. CONTINUE-23 design385e5f6a accepted by independentQA081f23ea. Allocation5fc677cd carries30 once and permanently retires45, zero new stages; immutablecarry36c13906. Engineering and independentQA are implementing/reviewing only isolatedT08-T10 continuation plus later three real browser checks, with unchanged answering profile94c58d44 and source corpus. Minimal providerFetch diagnostic seam uses immediate response and bounded private sidecars. No23 manifest/startup/modelcalls yet. Website5174 remains paused,zero browser submissions; exact22 backend stopped. Full31 two-segment aggregate and independent grading remain required before browser gate.


### Run23 closure and board-selected OpenRouter preparation — 2026-09-10T04:39:37.456333+00:00

Run23 closed after T08 analyze HTTP400 invalid_request_error; exact cause unspecified. One stage used,29 permanently retired,prior45 retired,no carry,cumulative826 (not billing). Closurea73ab60f/partialsealbf7663bf/jointindex1eabdb49 preserve original29 of31 outcomes across22+23; observed8 benchmark0/16, T09-T10 unrun, no full20-point score. EPA21 remains independently accepted21/21. ExactBun36448 stopped and3012/3016closed; website5174 paused,zero browser submissions. User now authorizes use of existing OpenRouter credits. OR24 is design/official-provider-compatibility assessment only; no OpenRouter generation/adapter release yet. Named key absent from process/userenvironment and exact supplied local export entry; secure key location/setup requested without asking user to paste secrets. No old allowance renewal or source expansion.


### OR24 authenticated key and implementation dispatch — 2026-09-10T04:57:42.290924+00:00

OpenRouter key readiness resolved: user-added exact OPEN_ROUTER entry authenticated with read-only GET /key; no credential value was logged and no account setting changed. OR24 proposal ad9b373c and independent design receipt 66622c accepted for bounded private implementation. Engineering and independent QA dispatched; no OpenRouter inference or live runtime yet. Proposed scope is three compatibility cases, original T09/T10, then three actual UI checks under a limited-demo gate, maximum40 serial stages with a $10 monitoring target, not a guaranteed billing cap. Root allocation and final implementation preflight remain pending. Direct-provider EPA21/21 remains historical route-specific evidence; mixed benchmark observed8 is0/16 with two unrun. Run23 closed; unused29 permanently retired, no carry; cumulative historical stages826. Website remains paused. Answer key stays separate and source expansion remains held.


### OR24 live startup — 2026-09-10T05:45:43.785727+00:00

OR24 independently reviewed and frozen at b55c3072 with260pins/259archives, transport e62bd3be and unchanged answering policy94c58d44. Root authorization93574bc9; actual Bun38152 ready05:43:41UTC and exact3016 listener verified. Bridge W02/B01/B03 is running under40 new stages,zero carry,$10 monitoring target. First analyze/plan returned HTTP200, Anthropic selected, non-BYOK, safe cost recorded; final question outcomes and semantic acceptance remain pending. No benchmark or browser submission yet. Historical direct EPA21/21 and partial benchmark0/16 across8 remain unchanged; source expansion held.


### OR24 closure and OR25 bounded implementation — 2026-09-10T05:59:20.756864+00:00

OR24 closed57e82c55 after independent2/3 bridge acceptance (QA dfcdc44e); all10 transport stages worked, actualreported$0.579882,30unused slots retired,prior cumulative836. General OR25 design1c5b3573/QA129dc979 accepted: remove redundant model whole-decision fields, derive unchanged precedence from strictly validated parts, retain full fresh semantic review. Engineering/scaffold and independent QA dispatched. Allocation25 0dbcfe27:40new/0carry, B03-W02-B01 regressions thenoriginalT09/T10 then3actualUI; same original$10 target with$9.420118remaining. No25freeze/startup/inference yet. Website paused, all benchmark/user answer-key boundaries and historical outcomes preserved; broader source hold unchanged.


### OR25 live startup — 2026-09-10T06:21:41.346164+00:00

OR25 live regression running: exact frozen9f7e4c99,323pins/322archives, answering684d7e72 and OpenRouterc396f23d; independent preflightbfec1b86/rootauth990f8d58. ActualBun41924 ready06:20:05UTC, exact3016 process/listener verified. B03,W02,B01 once, then independent gate before originalT09/T10 and later3actualUI.40new stages/no carry; original10USD target retains prior0.579882USD. No25semantic result yet; website paused. OR24 remains closed2/3 with B03 failure preserved; historical directEPA21/21 and observedbenchmark0/16 unchanged. No gold/source expansion or production deployment.


### OR25 closure and explicit diagnostic continuation — 2026-09-10T06:35:27.986513+00:00

OR25 closed77ceff5e:2/3 accepted (B03andW02), B01wrongcontext correctly withheld by freshreview.12stages,28unused retired; cumulative848 stages and providerreported$1.327026 across24/25, original10targetremaining$8.672974. ExactBun41924 stopped/ports3012and3016closed. Release gate failed. Root+QA separately authorize diagnostic26 preparation tofinish originalT09/T10 then3actualUI on unchanged25 profiles, preservingeveryfailure; no bridge rerun or fakepass. Allocationfc43c642:25new/0carry. Newprivatehelper implementation and independentQA active; no26freeze/startup/call yet. Websitepaused; keyworks; gold/corpus/criteria/sourcehold unchanged.


### Completed mixed benchmark and controlled-preview isolation — 2026-09-10T07:10:37.262356+00:00

OpenRouter connected. Original ten-question mixed22/23/26 diagnostic complete and independently graded0/20; latest uniformrun19 remains1/20. Run26 W03actualUI produced supported qualified content, but an additional unadmitted question contaminated aggregatecounter; recorderrefused and no browserpassclaimed. ExactBun38988stopped, ordinary5174paused/originalfilesrestored. Closed26 SHA13632fc5,14stages/11retired; cumulative862stages and$2.152794, remaining original$10monitor$7.847206. DIAG27 offline isolationimplementation and independentQA active: isolated5175 plus serverone-shotadmission beforemodelwork,15new/no carry, only3UI; no27freeze/startup/calls yet. Benchmarkgold/corpus/answeringprofiles/sourcehold unchanged; releasegate remainsfailed.


### Final controlled observation and closure — 2026-09-10T13:08:03.511855+00:00

OpenRouter connected; original mixed22/23/26 ten-question benchmark complete and independently graded0/20 (uniformrun19 remains1/20). Isolation27 implemented and independently reviewed. Actual controlledW03 returnedunavailable/cloud_provider_unavailable beforeanymodelstage; safeclaim/CDPidentitymatched, failuresealed fe0265e0. W11/B01unrun. Closed27 SHA3143e744: backend41172/frontend39956stopped,3012/3016/5175closed,ordinary5174paused;15unused retired/no carry. Cumulative862modelstages andOpenRouterreported$2.152794;27added$0, original$10monitorremaining$7.847206. No supportedthree-case demonstration orreleaseacceptance. No activeworkers orscheduledcontinuation. Next: diagnose read-onlycloud-evidencefailure, then separatelyreviewfreshisolatedUIcollection; preserveallfailures,benchmarkgoldisolation,andseparatesourcehold.

Detailed current result: [session report](../../docs/research/openrouter-session-2026-09-10.md).

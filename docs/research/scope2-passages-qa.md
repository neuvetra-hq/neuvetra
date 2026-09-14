# Scope 2 passage experiment — independent QA

**Current dynamic-answer release gate: FAIL; M2 is not complete.** The final retained run05 produced two clean complete answers, one deficient released answer and five withheld answers across eight frozen regression cases. Source integrity and bounded offline checks pass, but neither the paragraph architecture nor the later model-profile changes passed live answer quality. The investigation increment is complete; no new working demo or production release is approved. The former v2 release, failed runs and implementation snapshots remain historical evidence.

**Review attribution:** the source and semantic dispositions in this report were performed by independent AI agents, including QA `/root/site_review` and source reviewer `/root/terrascope_review`. Qualified human accounting, regulatory or legal review has **not** been performed. Frozen fixtures that say “human review” or “human assessment” describe an unfulfilled review requirement, not the identity or professional assurance of the actual checks. Their historical bytes are preserved. Model agreement, citations and these AI-agent checks are not proof of correctness.

## Source disposition

Reviewer: `independent QA /root/site_review`. Review time: **2026-09-09T01:27:13Z**. Operational review deadline: **2026-09-15T23:20:32Z**, unchanged; not a source expiry or regulatory effective date.

Candidate reviewed: `data/research/releases/scope2-passages.v1.json`, SHA-256 **6aa4297369a408bbfbda63a6ea1cfdd442fb9edb9dba438bcb3f9942ca1fd477**. Approval is limited to source `epa-electricity-2023`, extraction `epa-electricity-2023-pages-v1`, and passages **S01–S18** for private internal conceptual research/evaluation, including selected approved paragraph input to the configured Anthropic service and attributed private display. Commercial runtime approval remains false. Final release SHA-256 **62860478454f5537a3055a40ae1283fa567a39db75989409dc55cc33bd3577c7**, 49,301 UTF-8/LF bytes. Independent comparison verified unchanged passage text, qualifications, spans, dependencies, exclusions and source/extraction identities; only the scoped approval metadata changed.

The original [EPA guidance](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf) is dated **December 2023**, despite its URL directory. Original PDF: 396,931 bytes, 19 pages, SHA-256 `14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3`. External normalized-page artifact: 31,214 bytes, SHA-256 `6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4`.

Independent extraction with pypdf 6.10.0 reproduced all eight stored normalized pages and all 19 spans in 18 cards (10,723 selected UTF-8 text bytes). NFKC/whitespace normalization, Unicode code-point offsets, page/context/text hashes and two-newline assembly matched. Read-only checks did not invoke the author's writer or replace raw files. PDF pages 10, 11, 12 and 17 were newly rendered and visually read; pages 4 and 9 had been inspected during the prior source review. Neighboring text on pages 7–12 and 17 was read to check omitted material. S12's absent terminal period is present in the publisher original and was faithfully retained.

| Cards | Scope and context judgment |
| --- | --- |
| S01–S02 | Both accounting perspectives and clearly labeled dual results; EPA recommendation does not establish universal legal duties. |
| S03–S05 | Purchase records, duplicate consumption risk and electricity units. Missing-data estimation, customer diagnoses and thermal conversions remain outside scope. |
| S06–S10 | Generation boundary, regional geography, eGRID data category and publisher discovery routes. No actual facility mapping, newest-edition assertion or numeric factor. |
| S11–S15 | Product/supplier documentation, certificate/contract distinctions and reporting-period coverage. Quality/ownership conditions remain material; this is not a complete hierarchy, eligibility checklist or fallback choice. |
| S16–S18 | Factor-time recommendation retains its footnote and methodology/uncertainty dependencies; not a universal newest-factor or historical-recalculation policy. |

The source's attributed GHG Protocol Section 4 list, third-party graphics/tables and logos are excluded. Full normalized pages are stored for reproducibility; unselected text is not approved model input. The [EPA reuse policy](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers), rechecked September 9 UTC, permits noncommercial/scientific/educational use with individual-document caveats and does not give blanket commercial clearance. This is a bounded operational disposition for the authorized private experiment, not an independent legal opinion or a license for the whole corpus.

## Holdout and evaluation contract

The original root-cause holdout has 30 definitions across ten families and remains frozen. Its definition hash is `d497f985ce31f494eae18c13fcdd7be0605962603ea0751400011ffaaa0e0b7e`. The new live subset was selected before implementation freeze: seven unseen variants plus the known factor-sourcing question, eight cases, at most 24 stage calls. Selection froze at **2026-09-09T01:25:26Z**; canonical cases hash **a2f8e869fc8bda047ca717d0c28c8ff9e48d239f3b564bd6bd40de298285c987**. Exact questions remain procedurally hidden from the implementer until code freeze. Once exposed they are regression cases, not a continuing unseen holdout.

The frozen live fixture calls for human review of every factual clause, all material question facets, conditions and abstention boundaries. This investigation supplied independent AI-agent checks only; the qualified human review requirement remains unmet. Nonexclusive support IDs are navigation aids; they do not constitute semantic assertions. The eight supported questions do not estimate negative-class accuracy or cover the full corpus. Offline adversarial controls are reported separately. No fixture authorizes paid calls.

## Mechanical and semantic controls

The new pipeline passes full reviewed paragraph context to drafting and an independent fresh-context critic. Deterministic checks can establish pinned bytes, permitted IDs, exact quote containment, complete dependency references, mandatory qualifications and valid structured verdicts. They cannot establish that a model classified the original question correctly or that a generated claim follows from its quotation.

Independent controlled probes (no network/model calls) produced these results before the output-side numeric safeguard:

| Probe | Observed result |
| --- | --- |
| Correct grid-average explanation, exact quote, approving critic | Qualified answer after three mocked stages. |
| Reversed grid/contract relationship, exact valid quote, lying critic | Incorrect claim displayed as qualified. |
| **Pre-guard:** unreleased numeric result, planner labels it conceptual, lying critic | Out-of-scope result displayed as qualified. This historical fault was addressed by the bounded output-side control below. |
| Incorrect relationship with rejecting critic | `needs_review`, no claims. |
| Planner declares calculation action | `unsupported` after planning only, no claims. |

These are controlled fault demonstrations, not observed live model mistakes. They expose the residual honestly: the program rejects declared prohibited actions, while semantic classification, entailment, scope and completeness still depend on fallible models. The later numeric-output control adds a deterministic check for bounded output syntax; it does not provide complete semantic scope classification or a zero-hallucination guarantee. A limited private experiment may measure this design; production or calculation/filing approval does not follow from it.

The evaluator's initial controlled checks accepted a valid response and rejected missing qualifications or altered source references. QA found that removing mandatory dependency citations while retaining their qualifications still passed; root added closure-equality validation. The final-pin targeted recheck passed: valid response accepted, missing qualification, dependency references or altered source references rejected. The UI mode distinction and passage rendering preserve fixed-statement compatibility, source links and withheld-state behavior. The factor-source example and expanded scope copy match the source-only scope. The independent pre-output-guard backend run passed 24 tests / 113 assertions. All 27 held-out question variants plus the known question reached the entire 18-card semantic catalog using a controlled abstaining planner (28 mocked calls, zero real calls); this proves removal of vocabulary pre-gates, not semantic model quality.

The actual approved release loaded with all 18 cards. At the maximum question length, the complete planning request measured 14,272 bytes; representative full dependency contexts measured 7,380–11,833 draft-input bytes. Forcing all 18 cards into a maximum-length drafting request was correctly rejected at the 22,000-byte cap with no silent trimming. The final live fixture SHA-256 is `7200fc50b37b07535f7c364e901c681806b13dc0ec58ce09dc472aa7612d7207`; selection/facets remain unchanged.


## Final offline recheck

After the generic output control was added, QA found and the engineer corrected three numeric representation gaps (NFKC/fullwidth digits, attached mass dimensions and basic English number words) and a false positive that treated a count of emissions totals as a physical quantity. These are output syntax classes, not question-specific routes. No hidden question was disclosed to the backend author for this change.

Independent service probes on the final pinned release returned `numeric_output_not_allowed` after planning/drafting, with no critic call, for the original 600-kg result and fullwidth, attached-2t and twelve-kilogram variants. A lying critic therefore could not release these quantities. Conceptual counts of two emissions totals, a source-edition year, the Scope 2 label and bare unit names remained permitted. The reversed nonnumeric relationship still passed a lying critic: that demonstrated semantic residual remains. Conservative quantity/zero-phrase checks can also withhold valid explanatory wording; the accepted syntax tests do not prove natural-language exhaustiveness.

The independent final backend test run passed **27 tests / 137 assertions**. The engineer/root reported **107 full Site API tests / 381 assertions** and typechecking passed; QA did not duplicate that whole suite. All new backend files, runner, release and fixture were checked for UTF-8/LF portability. The first-run runtime and runner byte identities used for that live gate were (superseded by the separately reviewed compact implementation):

- `apps/site-api/src/research-passages/config.ts`: `b8b3c44bbe40dd8501e7f5480b68a9d4e353a3f83693d1e1a767d3e5d1ccecda`
- `apps/site-api/src/research-passages/numeric-policy.ts`: `ab8912100441eae36b7efdb345dc3d0ae2d0610a16bfc3b680b19c780fb0f5b5`
- `apps/site-api/src/research-passages/passages.test.ts`: `a14098ddac48b0d776ca8c8a22c9d6707a80b77cd247fab9baa8ffc4ee25e2ef`
- `apps/site-api/src/research-passages/provider.ts`: `a9c769b14d01861b0488c291ba1936fb880e8641dc277efefb371fabedeeea2b`
- `apps/site-api/src/research-passages/release.ts`: `8c38597c2f9af3d68d3b1cda6965dbb89bd97c874c721ead8fdd40b80bd04a12`
- `apps/site-api/src/research-passages/routes.ts`: `a28554aadaaa430d4e19690d0978f0546349d5d650bdb87130fe8e54f6b1601f`
- `apps/site-api/src/research-passages/service.ts`: `b36d9403e972a7d233d720331b7204380355749d64738fa2b66d74a5d5c90533`
- `apps/site-api/src/research-passages/types.ts`: `399a02967562d5da7b2fd3f99306c94376e22be5f5282ef02764be52a0240a7f`
- `apps/site-api/src/research-passages/validation.ts`: `ee67ff26c03c977abb642496181dbcb16b5cd1c156fe0cff67733bcb5e6cd037`
- `apps/site-api/src/research-passages-server.ts`: `b30b4fc6dc2715a5e4662e8f86630cdb733b229833896452b5c9241d4036f9e9`
- `tools/research/run_passage_eval.py`: `c5f2b6c4277162d472b6f2f237c4b3e8d8c32621b2475fd2290d17f5a41db7fb`


## First live evaluation — FAIL

The coordinator ran [scope2-passages-01](../../evaluations/research-qa/runs/2026-09-08-scope2-passages-01.json) from **2026-09-09T01:43:19Z to 01:45:07Z**. Artifact SHA-256: **9b4ea4f0c0ea4c73ef8e2abdda2bc2709345c62966dd71952f5983dbfdb9fe39**. Independent read-only verification reproduced all runner assertions, exact question definitions, runtime/runner/fixture/release pins, retained source/extraction hashes and the 19-stage counter delta. The stored UTF-8/LF artifact contains no replacement characters; the terminal's rendering of dashes did not indicate damaged saved data. All code/data pins matched at review. **Audit limit:** the first passage engine was uncommitted and no byte snapshot was archived before the compact correction. These recorded hashes, response artifacts and diagnostics preserve identities/observations but do not provide a replayable checkout of the precompact engine. The older committed v2 remains unchanged.

Only **2/8** returned the expected mechanically complete qualified response. This is a response-contract result, not an accuracy score. Both released answers were checked against the original S01/S02 source paragraphs. N01 meets the requested method comparison without arithmetic or unnecessary company questions. R01 preserves source support and the non-universal-legal qualification, but its repetition of the recommendation around method definitions leaves the practical reason for presenting a pair mostly implicit. Under the frozen explicit-explanation requirement, record that as a completeness/clarity concern, rather than a clean full semantic pass. No unsupported factual claim was identified in the two displayed answers; only one of eight is a clean complete-answer pass for this bounded review.

| Case | Stages | Saved result | Independent disposition |
| --- | --- | --- | --- |
| H-M01 | 2 | `draft_invalid` | No answer; exact failed validation is not saved. |
| H-R01 | 3 | `qualified` | Three claims supported by S01/S02; recommendation and method distinction present, requested practical rationale remains implicit/repetitive. |
| H-S01 | 2 | `provider_failure` | No answer; transport/stop/format cause is not saved. |
| H-S02 | 3 | `support_not_verified` | No answer; semantic rejection versus incomplete/malformed verdict is not distinguished. |
| H-N01 | 3 | `qualified` | Five claims supported by S01/S02; both concepts explained, no arithmetic. Extra source-context claim is nonessential but supported. |
| H-U02 | 2 | `numeric_output_not_allowed` | No answer; without the draft, cannot determine whether this was a correct refusal or a conservative false positive. |
| H-T02 | 2 | `draft_invalid` | No answer; exact failed validation is not saved. |
| K-SOURCE | 2 | `provider_failure` | Known board question remains unanswered; same unclassified provider failure. |

The two H-R01 recommendation claims are close paraphrases of S01/S02, and its comparison follows S01. All five H-N01 claims likewise follow the source: method names, grid factors, contractual perspective, two clearly labeled totals, and the EPA document's stated relationship/limits concerning GHG Protocol guidance. Mandatory qualifications and source references were preserved. The answer's consultation suggestion names the standard through EPA's own prose; it does not reproduce the withheld GHG Protocol criteria.

The failure pattern establishes where the pipeline stopped, **not why**. `provider_failure` combines transport, refusal, truncation and parse problems; `draft_invalid` combines invalid schema/IDs/quotes and deliberately empty drafts; `support_not_verified` combines negative and malformed verdicts. Do not label a failure truncation, a quotation mismatch or a numerical false positive without diagnostic evidence. A controlled diagnostic should record bounded stage reasons/counts and retain no secrets or customer data. The repeated model copying of literal support quotations is a plausible systemic cost/format burden, not a confirmed cause of these particular failures. Removing that copying in favor of pinned server passages would require a separately reviewed change while retaining full-context support/completeness checks.

The run and its fixture remain frozen. If these results guide an implementation change, subsequent use is regression/recheck evidence, not a fresh unseen benchmark. No additional model calls were made by QA, and no browser demonstration is claimed by this reviewer.


## Instrumented diagnosis and design review

Root ran three separate private diagnostics on the unchanged first-run engine; QA made no calls. The private records are retained under ignored `.superpowers/` and are not production telemetry. Their hashes and conclusions are recorded here without credentials or customer data:

| Trace | SHA-256 | Confirmed observation |
| --- | --- | --- |
| 01 | `540a4f5235bd80bdd0191dc3557c58490c50cc606e01c4a0bfc14a3ccb00bca3` | Known sourcing question: correct two-facet/eight-card plan; HTTP200 draft stops at `max_tokens`, exactly 1200 output tokens, in incomplete JSON. Partial output also duplicates S08 support entries. |
| 02 | `25c27c21b5eaad7fed0ae90dc78eb2062fb1c4dea42ca7241ddef2c8d9290a39` | Certificate sufficiency question: three stages succeed and emit two claims. This different sample does not explain the earlier numeric refusal. The critic approves an unsupported inference described below. |
| 03 | `349377636371e198eeb7aa79df22760372fa003e79e81d69106f07c5b34f1a2f` | Method comparison: draft ends normally at 846 tokens but invents an ellipsis inside an exact-quote field, so `draft_invalid` is appropriate. This failure is not truncation. |

In diagnostic 02, the statement that factor categories are listed by precision is extended to say that certificates or claims have unequal weight without further assessment. S11 establishes an ordering of types of market-based factors; it does not establish the asserted ranking of individual certificates/claims. This is an **actual live unsupported generalization accepted by the critic**, distinct from the controlled lying-critic demonstration. The source-sufficiency premise can be answered modestly through S13's requirement to consider quality conditions, without this inference. The independent source author concurs on that unsupported tail. The first claim is also materially weak/ambiguous: saying criteria must be referenced can imply that citing a standard substitutes for satisfying its conditions. Its seller-label sufficiency point is supportable, but the whole claim does not earn a clean support pass. General appended qualifications cannot cure this wording.

Diagnostic03's inserted ellipsis omits the source's quality-criteria cross-reference. The server's generic qualifications are useful but must not be treated as curing a materially overbroad positive claim. Full-passage semantic review must preserve the source's subject/category, relation, quantifier, modality and necessary conditions in the actual answer.

QA supports the proposed systemic format correction: a compact bounded draft of claim text plus approved passage IDs, with all source paragraphs, dependencies, quotations for display and mandatory qualifications assembled by server code. Removing model-retyped quotations removes a copying/output-volume failure surface. It sacrifices an extractive focus/audit hint, not a proven entailment check: valid quotes already failed to prevent both controlled and observed semantic overreach. Full original-question/paragraph critic review, no incomplete output fallback, strict IDs/schema/pins, dependency closure, quantitative-output restrictions and private-only scope must remain. The draft needs aggregate as well as per-claim size bounds; shorter output reduces, but cannot mathematically guarantee absence of model truncation. Rejection reasons should distinguish provider truncation and empty drafting from other failures.

The three diagnostics consumed 7 stages, taking the first passage batch from 11 to 4 remaining: **26/30 stages used in that batch**. The coordinator proposes a separately recorded compact-engine batch capped at 30 stages/$1.80; that does not reset the first batch's usage. Old 8 cases are now regression evidence. An additional untouched cross-scope compound case was frozen at 2026-09-09T01:57:03Z in `scope2-passages-unseen-compound-fixtures.json`, SHA-256 `a6ddc6cef7acbab68ca4d2ec70234c683013bc72ee31491a04e94c51a271a863`, before compact implementation freeze. It permits at most one question/three stages only when the coordinator's declared allowance permits; it does not authorize calls or establish general accuracy.


## Compact-engine offline gate

The compact correction passes independent read-only review and **29 tests / 154 assertions** on the frozen files. The engineer/root report 109 full Site API tests/398 assertions, typechecking and repository lint passed; existing FrontDesk lint warnings are not passage-engine failures. The compact draft contains only claim ID, text and selected primary passage IDs, at most 5 claims/400 characters each/1600 characters total. Full approved paragraphs and dependencies, mandatory qualifications, source/pin validation, original-question critic review, strict unknown-field/ID rejection, numeric-output restrictions, attempt limits and no truncated/partial fallback remain.

Independent controlled service probes on the actual approved release verify: a complete compact claim passes; the removed support field and unknown citation IDs reject before the critic; numerical results still reject; empty drafting yields `draft_empty`; truncation yields `provider_truncated` with no partial output; a rejecting critic blocks an unsupported category shift. A lying critic still admits that nonnumeric shift, explicitly preserving the residual rather than claiming the format change proves correctness. The updated generic prompts require subject/category/relation/quantifier and condition fidelity, and a direct source-supported explanation when a relationship or purpose is requested. These are semantic instructions, not guarantees.

Final compact hashes independently verified as UTF-8/LF:

- Provider: `2527c18ecd6e998b9b7662118c1a441ed79545c746b9b13077d73b995a77374f`.
- Draft validation: `0780b6148f9adb76be1ce83933a31d485803fafeff09b45e4eef0042cd126e50`.
- Service: `c36d241d6ddcc501a7cf0966665ff54722ac6c1556c91c0e9f2f1802c20fa68a`.
- Shared types/limits: `329dbe98642097fb45943e47a328fa7c5d7d893fa211166448aedbb96a0d2e6a`.
- Tests: `da6d382641fa8507e21d45a743aa73e420c206a7221058827e9ad32238842723`.
- Numeric policy remains `ab8912100441eae36b7efdb345dc3d0ae2d0610a16bfc3b680b19c780fb0f5b5`; release, extraction, source, both fixture sets and runner are unchanged.

This offline pass authorizes no paid calls by QA and does not reverse the first live failure. The coordinator will use the carried first-batch allowance for the one unseen compound probe, then a distinctly recorded second 30-stage/$1.80 batch for the eight frozen regression cases and browser demonstration. Those saved responses still require independent source/support/completeness review.


## Compact live regression and unseen probe — reliability gate FAIL

The [unseen compound probe](../../evaluations/research-qa/runs/2026-09-08-scope2-passages-unseen-01.json), SHA-256 `c5f0a0f6410b061e636542c44a12d4719464f2a6ca900d4a6811558a19bf098c`, correctly withheld the whole mixed Scope 2/Scope 3 request after one planning stage. It emitted no invented Scope 3 category or incomplete Scope 2-only answer and requested no company context. Independent hash/assertion review passed. That took the first passage batch from 4 to 3 remaining (27 consumed), with three unused then closed by the coordinator. One negative case is additional evidence, not a general accuracy estimate.

The [compact regression run02](../../evaluations/research-qa/runs/2026-09-08-scope2-passages-02.json), SHA-256 **5881f546357455ba02a07c72565a226260ac857166a505bc244a56d6e3d8622c**, used 24 stages of a separately declared 30-stage batch (30 to 6 remaining). All code/runner/fixture/release/source/extraction hashes and saved assertions were independently rechecked before the next change. All 27 displayed claims respected compact length bounds. The archived [compact code ZIP](../../evaluations/research-qa/snapshots/scope2-passages-compact-code.zip), SHA-256 `44d9b393bf5d5219aeab8fccdd2d8a3c0d0b93c32e77a7b69ec6c1ccc2b5962f`, contains exactly the 14 run02-pinned code files, each independently matched. This preserves that implementation, unlike the unarchived precompact engine; it is not a promise of deterministic model replay.

| Case | Result | Independent semantic judgment |
| --- | --- | --- |
| H-M01 | Qualified | PASS: both perspectives and source types explained; additional hierarchy/certificate material stays bounded and does not certify an instrument. |
| H-R01 | Qualified | PASS: explicitly explains that presenting both preserves the distinct grid/contract bases, with EPA recommendation and legal limits. This fixes the prior implicit-rationale concern for this sample. |
| H-S01 | Qualified | PASS: grid publication/geography plus supplier delivered-product boundary and purchasing/reporting-period coverage are actually explained. |
| H-S02 | Review withheld | FAIL usefulness: no answer; without the rejected draft/verdict, exact cause remains unclassified. |
| H-N01 | Qualified | PASS: both concepts and electricity-unit context, no arithmetic or unnecessary company input. |
| H-U02 | Review withheld | FAIL usefulness: no answer; no unsupported draft displayed, but source-supported sufficiency explanation is not delivered. |
| H-T02 | Qualified | PASS: grid-average concept/geography/generation boundary; extra lookup information is supported and does not perform a facility lookup. |
| K-SOURCE | Qualified | FAIL completeness: four grid-side claims followed by generic market/certificate discussion omit the requested supplier-specific documentation workflow. |

Thus 6/8 meet the mechanical answer contract, but only **5/8 meet the frozen complete-answer requirements** in this bounded review. The known sourcing question's final claim cites S11/S13 and does not explain supplier-provided delivered-product data, owned-plus-purchased electricity coverage or agreement-period alignment from S12/S15. Generic appended conditions do not fill that missing explanation. The independent source author concurs; H-S01 demonstrates that the same approved corpus can support those facets. No claim is made that the known sourcing task is solved merely because it has citations and a qualified label.

Private diagnostic04 on H-S02 later returned a source-supported five-claim explanation of eGRID discovery using S06–S09, with no selected value. Trace SHA-256 `05d1b1eda06b3627872089e987f50837c5a462f82876735f7e15867217c1d305`; three stages consumed (6 to 3 remaining). This changed sample does not explain or erase the earlier refusal. The second passage batch therefore had 27 stages consumed before the proposed fresh positive check.

The agreed next design is grouped draft answers for every planned facet, balanced text allocation, and exact per-facet plus per-claim critic verdicts. The critic must independently compare the original question with the plan decomposition and identify unrepresented requests; the planner's list is not authoritative. Missing/duplicate/unknown/empty groups, wrong-facet citations or missing/negative verdicts must withhold the whole answer. Do not require all retrieved context IDs to be cited, or equate an eligible same-facet ID with semantic adequacy. These controls address observed allocation/omission structure without topic-specific rules, while the actual support/completeness judgment remains fallible.

An untouched positive documentation-comparison variant was frozen at 2026-09-09T02:09:32Z in `scope2-passages-unseen-positive-fixtures.json`, SHA-256 `3248594ffbcda89ca5e6abe2f59017c34a8bb007cf146a6d61389e2294c40264`. Its two-sided source/documentation expectations were fixed before facet-engine completion; no exact prompt was disclosed to the backend author. The coordinator may run it using the carried three-stage allowance after the next offline gate. No paid calls were made by QA.

## Facet-engine offline gate

Independent targeted rerun: **31 tests, 201 assertions, zero failures**. Eight additional controlled scenarios used the actual approved 18-passage loader and no network/model transport. A complete two-facet answer passed with a subset of planned citations and server-added S12/S15 dependency context. An omitted group and wrong-facet support failed before verification; negative decomposition, incomplete facet and swapped facet-to-claim bindings failed at verification. A quantitative result failed before verification. An inverted nonnumeric claim with a deliberately lying all-pass critic still passed, preserving the stated semantic-assurance limitation.

The contract now requires one nonempty answer group for each planned facet, globally unique claim IDs, facet-eligible primary support, balanced text limits, and exact facet-to-claim verdict bindings. All source context and mandatory qualifications remain server-derived; no requirement was added to cite every retrieved paragraph. The critic separately reviews the original question's decomposition and each facet. These are structural controls, not proof that the decomposition or model verdict is correct.

Frozen UTF-8/LF code hashes independently matched: provider `fffd1dbc317c35b728e565475d7630b39f59203d6015d9365840e47ab0d48ff2`; validation `13bbc7e3c65bec4a0b442da36d3086732d18e84ef1d0eb4bcc14503bd4d6d5b9`; service `e5c224339963df0b2c1359b79c69f23e682449d175a35b743b4bf5e562516b9c`; types `a2fe61db4d8b5101729740f5b3673200dc5adf2e0156d35a40558a3e973a8d55`; tests `7e3ada68dba4c9f7118bf4000da6027f0356d5a0ceb4fd91e81697a395e6c415`. Numeric policy remains `ab8912100441eae36b7efdb345dc3d0ae2d0610a16bfc3b680b19c780fb0f5b5`; the source release remains `62860478454f5537a3055a40ae1283fa567a39db75989409dc55cc33bd3577c7`.

The evaluator change from its preserved compact snapshot adds only root `package.json` to code pins; current runner SHA-256 `0c8a501648309000fe749d253788ffaa4ca49ef9b3e77adab1b3ce15c110080d`. The root startup alias resolves the existing non-watch passage entry, and README accurately distinguishes the opt-in experiment from the historical service. These checks pass for the bounded offline gate; fresh positive and regression answer quality remain pending.

## Facet-engine fresh positive result

The untouched H-S03 documentation-comparison variant failed its expected answer contract on the first attempt: **needs_review / draft_invalid**, after two stage calls. No claims, evidence or source payload was released. This is a usefulness failure, not evidence that the source lacks coverage; the precise rejected-draft defect cannot be inferred from the public reason code. The fixture and its expectations remain unchanged.

Artifact `runs/2026-09-08-scope2-passages-unseen-positive-01.json`, SHA-256 **966af6a07fe96cc514a0694f7ac3df8192213d8c9e0da25a973c79ec260e6b65**, finished 2026-09-09T02:20:47Z. Independent rebind verified all 15 code files, release and fixture pins, two retained original/extraction artifacts, exact submitted question, reproduced mechanical failure, and UTF-8/LF storage. The carried second-batch counter moved from three to one; it therefore consumed 29 stages in total before closure. No retry or fixture relaxation was used to erase this fresh failure.

For the next evaluation, a private first-attempt tracing wrapper was independently reviewed at SHA-256 `6b52629441f42b853cb690eb8244cfbe43694a1ca62f6e33b20142af63a80c67`. Its import-only check and a three-stage/two-request mock passed: original argument, return and exception identity; exact attempt count; request correlation; budget snapshots; immutable events; and exclusion of raw error text. It records approved stage inputs and parsed outputs in ignored local files, without provider headers/options. It adds failure-closed behavior if diagnostic writes fail. No live calls were made by QA. This instrumentation is separately pinned and does not silently replace the frozen engine or repair an answer.

## Facet regression result and first-attempt diagnosis

**Live quality gate FAIL.** Run `runs/2026-09-08-scope2-passages-03.json` finished 2026-09-09T02:30:26Z, SHA-256 **769b2c47eeb0ff8af8797228c941666d456a444edc69cf34607a9dd241924604**. It consumed 22 stages, moving the distinct third-batch counter from 30 to 8. Six of eight cases returned qualified answers (31 claims); two were withheld. Five of eight meet the complete, supported-answer criteria after independent semantic review. The six mechanically successful outputs are not six semantic passes.

All 15 current code pins, fixture/release pins and two retained source/extraction artifacts matched; every submitted question and mechanical assertion was independently rebound. The private wrapper remained separately pinned. All eight HTTP attempts correlated to their original planning/draft/critic events; each recorded invocation consumed exactly one stage. The 45 private files comprise 22 started events, 22 completed events and one write probe. Their sorted filename-to-SHA256 map, serialized as compact JSON, hashes to `769169b9812bfa456df8f1dad733581191341dc65d1f09a053189c1c2831c851`. For all six released answers, displayed IDs/text matched the original accepted draft and the retained critic returned pass. This confirms what happened, not that the critic was correct.

The facet snapshot `snapshots/scope2-passages-facet-code.zip`, SHA-256 `1118fdd9d19219755510fac6f42bfd8576a35524e02268bfd5745f53353e2eac`, independently matches all 15 run code pins plus the private wrapper (16 entries). It preserves implementation bytes, not a deterministic model replay or the complete environment.

| Case | Result | Independent semantic disposition |
| --- | --- | --- |
| H-M01 | Qualified, five claims | PASS: both methods are distinguished with bounded EPA recommendation; repetitive ancillary material does not make a new mandate. |
| H-R01 | Qualified, five claims | PASS: the answer explicitly connects separate totals to grid-average versus purchasing-contract perspectives. |
| H-S01 | Qualified, six claims | PASS: grid publisher/geography and supplier delivered-product coverage, owned-plus-purchased electricity and reporting-period agreement are actually explained. |
| H-S02 | Qualified, five claims | PASS: eGRID total-output subregion discovery and Hub/version caveat; no actual factor or facility assignment. |
| H-N01 | Qualified, five claims | PASS: both concepts explained without arithmetic or company-data demand. |
| H-U02 | Qualified, five claims | FAIL: one fallback statement drops a material availability/priority condition and strengthens source modality; another clause lacks its necessary per-claim citation. |
| H-T02 | Draft withheld, two stages | FAIL usefulness: duplicate claim IDs across groups; a second facet also exceeds its 800-character budget by one character. |
| K-SOURCE | Draft withheld, two stages | FAIL usefulness: duplicate claim IDs across groups; the answer never reaches the critic. |

The original H-T02 trace request `dc2fc548-0dac-444f-8c99-51250c55b018` repeats c1/c2 across its facet groups; the second group totals 801 characters against 800. The original K-SOURCE request `eacf2219-e9e8-4c1a-8a6c-4419d2bc10a5` repeats c1/c2/c3 across groups; its 741/745-character groups fit their limits. Both are parsed JSON drafts, not transport/truncation failures. These are representation/length contract failures. They do not establish that the rejected prose was otherwise supported, and they do not explain the untraced fresh-positive failure retrospectively.

H-U02's fourth claim changes S14's conditional residual-mix recommendation into an unconditional list of factors to use, omitting availability/priority and strengthening should to must. That prescriptive fallback tail also exceeds the held fallback-selection scope. The general certificate-versus-contract distinction is permitted; this alteration is not. Its first claim's seller-label sufficiency conclusion has only S06/S11 references, omitting the S13 quality-condition evidence needed for that clause. Other claims' citations do not repair an individual claim's support. The source author independently concurs. Claims two and five retain the quality-review requirement; claim three describes only possible factor values, without deciding actual zero emissions or eligibility. Their support does not cure the failed claims.

Server-generated claim identifiers could remove the demonstrated cross-group naming burden without loosening evidence controls. Exact source conditions, modality, exclusions and per-claim support remain a separate semantic problem. No question-specific rule, relaxed expectation or successful retry is proposed as proof of a general solution. The known sourcing demonstration remains unpassed.

## Subsequent mechanical correction — offline only

The next isolated correction removes model-authored claim IDs. The server assigns c1, c2 and subsequent IDs in canonical planned-facet order, preserving within-facet claim order. Drafting uses shared 75% soft length targets while the original 400-per-claim, 1,600-total and per-facet hard limits remain unchanged. No text is truncated or source condition relaxed.

Independent rerun: **33 passage tests, 223 assertions, zero failures**. Using in-memory copies of the exact original run03 drafts and removing only obsolete ID fields, K-SOURCE passes structural validation with stable c1–c6 identities even when groups are reordered. H-T02 still fails its 801/800 hard limit. Original traces were not edited, and neither replay is a model call or semantic pass. Soft length targets have not yet been proven reliable by a new live batch.

Frozen code pins: provider `b3d05cfd17088eb2e4096b7d441b2be1814d753e82211c045f0439e1d80c3aee`; validation `59b6540b4833e0dc24e25defc6e2ce7503bec9e98dc7f191c0e6facfb9ee7933`; types `53c5e16accac138ed690861a76647ad9b0ae01cbd3dd82b5ef3fcdb6593f1c09`; tests `dcc0b437369c7200d2a25bc15613267a67881c4c5465905f4bbf90c77f762f22`. The current critic schema, prompt, common boundary, scope distinction and fidelity instructions were independently compared with the preserved run03 snapshot and remain unchanged. Thus a separately declared reviewer comparison can use the unchanged policy; the semantic failures above remain unresolved.

## Controlled verifier comparison

The independent harness gate passed at `compare.py` SHA-256 `cb281f87083ec8e78218906455661b82e14189127043343c0c0f89f2c4066566` and manifest `b73907d6804fefceb1beab0d482f1c8b86a1e24ea17a2eeacef9ec373ebbb10f`. QA reran 22 offline mocks. The four requests preserve the exact original two packets and archived critic prompt/schema; model, adaptive/high thinking settings and a 4,096-token cap are the declared changes. QA labels were not model input. Exclusive reservation, no retries, exact ID alignment and safe output handling were verified.

The coordinator completed exactly four diagnostic attempts. Final private result SHA-256 **e8fe5b3da28b9a2fcb25a7b7f52dbdefaea21115eb209a4b924cef4778241db4**, finished 2026-09-09T02:48:56Z. Independent rebind verified all request/provenance pins, before/after counters, verdict schemas and claim/facet/citation alignment.

| Packet | Sonnet adaptive/high | Opus adaptive/high |
| --- | --- | --- |
| H-U02, independently flawed | No verdict: 4,096-token limit reached | Rejects c4 support/qualifications and overall scope; still incorrectly accepts c1's insufficient citation set |
| H-S01, independently supported | No verdict: 4,096-token limit reached | Accepts the bounded answer, consistent with source QA |

The Sonnet responses report all 4,096 output tokens as thinking and stop at the token limit; they cannot be counted as correct semantic rejections. Opus discriminated these two exposed packets, but missed another claim-level support defect. This is not an accuracy estimate or proof that thinking alone caused a difference: the baseline cap and configuration also differed. The proposed own-citation clarification and 8,192-token verifier setting are new conditions requiring separate evaluation. No original result was replaced and no diagnostic call was made by QA.

## Verifier integration — bounded offline gate

Independent rerun: **37 passage tests, 260 assertions, zero failures**. Two additional actual-source service scenarios used a mocked HTTP transport: a supported recorded packet passed, while a controlled negative verdict withheld the flawed packet. Both used the exact configured sequence Sonnet/1,200 disabled, Sonnet/1,200 disabled, then Opus/8,192 adaptive/high; each reserved three times $0.50. No real model call or new semantic result was produced by these mocks.

Each claim now has an explicit server-derived allowed support closure; other selected context can reveal contradictions or omissions but cannot furnish uncited support. QA verified that c1's closure does not silently acquire S13 from another claim. The generated verdict remains fallible. A wrong returned model now rejects rather than inheriting configured provenance; QA raised this gap and independently rechecked the fix. Redirects are denied, known thinking blocks are discarded, and only a completed final structured response proceeds to the existing semantic-verdict checks. Source, numeric, facet and hard text limits remain intact.

The 90-second transport, 150-second pipeline, 155-second UI and 160-second HTTP/evaluator limits align. The updated private wrapper forwards stage profiles and preflight identity without invoking a model; SHA-256 `81e8923b42d84595e02cc876d7424476ea2a5fe0df5bec4359d6365611b53302`. The new shared operating maximum is separately declared as 30 attempted stages at a $0.50 reservation per stage, $15 total, with no automatic retries. It is not a reset of prior counters or measured billing.

Frozen UTF-8/LF pins independently matched: provider `6f7c43c91d0aa5bcdd815ee15a6b4136be0ebbd1e6948a1f23c152f805437b57`; service `1a69a93c458c2c571745accf55196bfaa8f6beaa4b35cb4c897837b1773a63f0`; types `a700ff3729a984a40e2712af5adc81aa83faac90578193a41773769d69b8a5fa`; config `8630bfd90419aed29f7b26da4864ce2d9162d5e5cdfc7385fde5fb0e81d06b2c`; tests `1438d0584bab1251f69f3b722b69d780d3ef2ce99b39b67262e992af43bf0cca`. This offline gate permits the bounded next evaluation; it does not pass live answer quality.

## Opus-verifier regression result

**Overall live gate FAIL.** Run `runs/2026-09-08-scope2-passages-04.json` finished 2026-09-09T03:05:03Z, SHA-256 **28611d4a1527c62d1a4ef0020d00971c4dd8294ff2c7806e307811a1afb19879**. It used 23 stages (30 to seven remaining; $11.50 reserved). Five answers were released with 24 claims; four answers satisfy the frozen complete-answer and own-citation criteria. No retry replaced any row.

Independent rebind verified all 15 code pins, fixture/release and original/extraction pins, every mechanical assertion and submitted question. All eight attempts matched their original trace events; stage counters decrement once per invocation, and accepted display text and server-assigned claim IDs match the original draft in canonical facet order. The 47 private files (46 stage events and one probe) have sorted filename-to-SHA256 compact-JSON map hash `dfc6821113731ce47080dd097c40f0367795623b47ffd856a9472dd83a1afb27`. UTF-8/LF artifact bytes and configured Opus/8,192 verification metadata matched.

| Case | Result | Independent judgment |
| --- | --- | --- |
| H-M01 | Review withheld | FAIL usefulness; rejected S06 boundary statement is supported by the general section, including a reasonable application to both methods. Likely false-negative; exact Boolean-critic reasoning is unavailable. |
| H-R01 | Qualified | PASS: explicitly connects reporting both to visibility of the distinct grid and procurement bases. |
| H-S01 | Review withheld | FAIL usefulness, with justified safeguard: one draft claim incorrectly makes reporting-year alignment a precondition for any factor use, losing S15's partial-period allowance. |
| H-S02 | Qualified | PASS: eGRID discovery, geography and edition caveats; no actual current value or facility assignment. |
| H-N01 | Qualified | PASS: both methods, clear recommendation/legal limits, no arithmetic or company-data demand. |
| H-U02 | Qualified | FAIL own-citation support: the central seller-label conclusion still lacks S13 in that claim's support set. Earlier erroneous fallback advice is absent. |
| H-T02 | Draft withheld | FAIL usefulness: second facet totals 875 characters against the unchanged 800 hard limit, despite its 600 soft target. |
| K-SOURCE | Qualified | PASS for this sample: actual grid publication workflow plus supplier-provided product factor covering owned and purchased power, with relevant period/quality limitations. |

Source author and QA independently agree with these dispositions. H-M01 was not classified as a likely false-negative merely because it was ancillary: S06 directly states resource/efficiency and generation-only boundaries, and the common Scope 2 section precedes the two methods. H-S01 is different: S15 explicitly permits applying a factor to the covered portion when dates differ, and another correct claim cannot rescue an overbroad precondition. H-T02's exact per-claim lengths in the second facet are 241, 299 and 335; server IDs worked, but a soft drafting target did not ensure a valid length.

H-U02 c1 cites only S06/S11 while asserting that a seller label alone is not the standard. Those paragraphs cover generation boundaries and factor-category precision; the certificate-quality condition is in S13, cited elsewhere. Explicit own-closure instructions did not prevent this evidence-linking failure. Claims c2–c5 are source-supported within their limits; their references do not repair c1. This is narrower than the earlier false fallback instruction, but it still fails the acceptance contract. The known sourcing answer's improvement does not turn the eight-case gate into a pass.

Two fresh definitions were independently approved before this evaluation: `scope2-passages-final-holdout.json`, SHA-256 `f74f7fcc50946642169221fd35fa9b668e8f9a390ec5f4bf94e8e14ce1703b75`, 6,208 UTF-8/LF bytes. QA rehashed/re-extracted EPA PDF page 7 and checked S03/S04 modalities and the excluded thermal scope. Reverting review metadata in memory reproduced candidate hash `096b24209a0d35cd5923d7fef781bc7608dd0a6afe486007c3be0a180780d8c5`, proving questions, expectations, frozen time and source limits unchanged. No new source/call authorization is implied; earlier H-S03 is now a regression.

## Draft-profile comparison — offline gate

The next trial changes only the draft profile to Opus adaptive/high with 8,192 output tokens. Planner and verifier profiles stay fixed; the public model label now identifies the actual generation model, and legacy model/output settings apply only to the planner. Independent comparison with the preserved run04 snapshot confirms byte-identical prompts, schemas and request construction, and unchanged service, validation, numerical policy, source loader, types and routes. The source release remains `62860478454f5537a3055a40ae1283fa567a39db75989409dc55cc33bd3577c7`.

Independent rerun: **38 passage tests, 284 assertions, zero failures**. A mocked transport probe verifies planner-only output overrides, fixed draft/verifier profiles, safe response handling, truthful generation metadata and the unchanged shared attempt accounting. Serialized draft requests differ only in the declared model/thinking/output profile fields. This compares a configuration bundle, not model identity alone. No model call was made by QA.

Frozen UTF-8/LF pins: provider `958e512ffb04ff7af4bf622f17755a27a3d9cca80e3e184162f1ff4e81005b5b`; config `2fdb19e6d88f33b33869fa8fdb9d5d83ca8c6a3f0439e6b391c135267e5a3cf4`; tests `55ee1031edc89a85d8ba6794ab3d1888215ff95d0182e47cd5087f0caf14da22`. The preceding run04 snapshot `scope2-passages-reasoning-code.zip`, SHA-256 `8c34e9a633afffdf6772ba606c9c9ac4d8a73bec6fee0fd96c0d127a79e683d8`, independently matches all 15 run code files plus the private wrapper. The resulting run05 is recorded below; previous failures remain unchanged.

## Opus-draft regression result — final retained run05

**Overall live gate FAIL.** Run `runs/2026-09-08-scope2-passages-05.json` finished **2026-09-09T03:18:01.506648Z**, SHA-256 **111437473764badb55454d2cdeebd09e6b550945c7ab1359fa6b330ac17c1f10**. The distinct fifth batch used **24 stages**, moving from 30 to six remaining ($12 reserved, not measured billing). Three answers were released with 14 claims; only two satisfy the frozen complete-answer and own-citation criteria. Five were withheld after review. All eight reached three stages: there were no transport or draft-format failures in this run. The coordinator subsequently stopped the identified service and closed the batch with six unused attempts; QA did not independently operate that process.

Independent read-only rebind reproduced every runner assertion, all 15 code pins, exact questions/fixture/release identities, both retained original/extraction hashes and before/after counters. Every request matched its first-attempt traces, and displayed text/server-assigned claim IDs matched the original draft in canonical facet order. The 49 private files (48 stage events plus one probe) have sorted filename-to-SHA256 compact-JSON map hash **522170981ecb5e1a23689987724cba303879c69a425abfd2245611194ceb19e3**. Artifact storage is UTF-8/LF. The preserved `snapshots/scope2-passages-drafting-code.zip`, SHA-256 **2b989294c0b2e88a96b1fb83b6e9bb92092292d1f338caa999ba4735801f92f5**, independently matches the 15 run code files and separately pinned private wrapper: **16 exact entries**. These bytes preserve the implementation, not a deterministic model replay or complete environment.

| Case | Saved result | Independent AI-agent disposition |
| --- | --- | --- |
| H-M01 | Qualified, five claims | PASS: both methods, EPA reporting recommendation and generation boundary are supported; certificate/contract conditions have their own source context. |
| H-R01 | Review withheld | FAIL usefulness. The rejected rationale has a supported core, but categorical “could not” and procurement “effect” wording are stronger or ambiguous. Not an established false-negative or a proven fabrication. |
| H-S01 | Review withheld | FAIL usefulness. Partial-period and multiple-agreement conditions are retained, unlike run04. Stronger modality and automatic-application wording merit caution; possible overly strict rejection, not the earlier lost timing condition. |
| H-S02 | Qualified, five claims | PASS: eGRID discovery, regional total-output factors and edition/geography caveats; no current factor value or actual facility assignment. |
| H-N01 | Review withheld | FAIL usefulness with defensible safeguard: an unnecessary causal link makes incomplete source coverage the reason it cannot determine company legal duties. The source does not establish that reason. |
| H-U02 | Qualified, four claims | FAIL clean-answer gate: a bundling-entitlement clause omits the necessary quality prerequisite in that claim. The earlier own-citation gap and missing fallback-availability condition are not repeated. |
| H-T02 | Review withheld | FAIL usefulness with defensible safeguard: an ancillary “because” statement attributes EPA's reporting recommendation to a policy cause the cited paragraphs do not expressly establish. |
| K-SOURCE | Review withheld | FAIL usefulness. Grid/supplier coverage and partial periods are present; “only if” and mandatory timing wording strengthen the source's if/can formulation. Distinguish this modality concern from run04's lost covered-period allowance. |

The five withheld drafts were assessed from their saved first-attempt context and verdicts, not fresh retries. A Boolean critic does not record why it rejected a clause; the classifications above are independent source judgments, not inferred hidden reasoning. Correct core material in a withheld draft is not a delivered answer. Conversely, an ambiguous stronger formulation should not automatically be counted as either a fabricated fact or a reviewer false-negative.

H-U02 now cites S13 in its first claim. Its “only after referring” wording expresses a necessary review step, with clarity limits; it does not logically establish that merely referring to criteria is sufficient. The clearer shared defect is the later unqualified bundling-entitlement clause: the necessary quality condition should remain in that claim, and other claims or general qualifications do not cure it under this acceptance contract. The fallback tail now preserves residual-mix availability and priority and makes no actual company choice. Its ancillary prescriptive wording creates a scope ambiguity; QA and the source agent did not establish a unanimous finding of an actual fallback-selection violation. Do not relabel this as run03's omitted availability or run04's missing citation.

Only the declared drafting configuration bundle changed between runs04 and05; prompts, schemas, source and verification policy were held fixed. This small repeated sample fell from four to two clean complete answers. It does not estimate general model quality or isolate model identity from thinking/output capacity, and it gives no basis to claim the profile upgrade solved reliability. The proposed bounded correction and separate false-approval benchmark in `scope2-answer-reliability-next.md` are unimplemented next-work candidates, not fixes demonstrated by these results.

## Execution status and limits

**Current release gate: FAIL.** The investigation is complete for this increment; M2 and dynamic answer release remain unpassed. The latest result is **two clean complete answers, one deficient released answer and five withheld answers**. Historical findings remain as recorded above. No approved new browser demonstration followed the failed gate. H-S03's fresh-positive failure remains a regression obligation; the two final fresh probes remain frozen and unrun. Source/offline dispositions do not supply qualified human review, commercial rights clearance or production/compliance assurance. QA made **zero real model/paid calls** and did not renew any budget.

The coordinator closed the five separately declared passage batches as follows. These are attempted-stage operating guards, not user/provider quotas or measured billing; the original earlier v2 allowance is separate and was already exhausted.

| Passage batch | Attempted stages used | Unused at closure |
| --- | ---: | ---: |
| 01, including its diagnostics and fresh negative | 27 | 3 |
| 02, including its diagnostic and fresh positive | 29 | 1 |
| 03 | 22 | 8 |
| 04 | 23 | 7 |
| 05 | 24 | 6 |

The separately declared controlled verifier comparison used exactly **four** attempts and is not part of those five 30-stage batch counters. Batch totals are **125 attempted stages plus four comparison attempts**; the 25 unused batch slots were closed, not silently carried into a new allowance. Individual run counters and diagnostic records establish the attempt accounting; service shutdown and allocation closure are coordinator-owned observations. Any future revision, false-approval benchmark or fresh evaluation needs an explicitly scoped plan and its own recorded allowance.

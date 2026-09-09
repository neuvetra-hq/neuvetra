# Scope 2 retrieval — independent root-cause assessment

**The repeated refusals come from the architecture, not just missing synonyms.** The current pilot routes questions through word lists, searches five fixed statements, and validates selections against the topics inferred by those same lists. It does not retrieve the full EPA guidance or generate explanations from its paragraphs. Independent read-only probes found both missed supported questions and incomplete answers labeled qualified despite valid citations.

Reviewer: `independent QA /root/site_review`, separate from the evidence and implementation authors. This assessment changed no runtime code, releases, original sources, secrets or budgets. All answer-path probes used injected providers; no real model calls were made. The separate status request was read-only.

## Observed cause, layer by layer

1. **A word-list gate precedes evidence.** The board's known question asks how to source regional/eGRID versus supplier-specific factors. In [retrieval.ts](../../apps/site-api/src/research/retrieval.ts:40), it lacks the required literal domain cue and returns unsupported. An independent execution recorded **zero release loads and zero provider invocations**. Budget exhaustion is therefore not the cause of this particular response.
2. **Source discovery is conflated with choosing a company value.** The earlier factor branch combines terms such as “factor” with “which,” “use” or company words, then requests company location/year/supply information. This can misclassify a general documentation/source-discovery question. [Factor branch](../../apps/site-api/src/research/retrieval.ts:26).
3. **The available knowledge is five statements, not nineteen pages.** P01–P05 contain 71 main-text words. E01–E06 supply thirteen locator-anchor words, not their full supporting paragraphs. The current loader retains source hashes and locators but does not supply the paragraph contexts to the model. The [evidence assessment](scope2-retrieval-root-cause-evidence.md) identifies broader section coverage and omissions, including the eGRID continuation and supplier-specific paragraph.
4. **The response contract cannot form an unrehearsed explanation.** The provider may return only predefined proposition/evidence IDs; the service renders their stored wording. Semantic selection alone cannot produce a reviewed factor-sourcing workflow absent from those statements. [Provider schema/instruction](../../apps/site-api/src/research/provider.ts:4), [rendering](../../apps/site-api/src/research/service.ts:80).
5. **Completeness is measured against the router's own incomplete plan.** `validateCandidate` checks requested topic coverage, but those topics come from the same lexical gate. It does not independently establish that all material clauses in the original question were represented. With an explicit domain cue added to the known sourcing question, a controlled selector could return P01/P02 and receive `qualified`, even though the definitions do not answer sourcing. This is a deterministic validation counterexample, not an observed real-model response. [Validation](../../apps/site-api/src/research/service.ts:21).

The prior exact-question fixes improved their tested paths and preserved important integrity controls, but they did not change these structural limits. The earlier full-feedback failure and targeted recheck remain valid historical observations; they do not establish broad conversational coverage.

## Frozen family baseline

The [semantic holdout](../../evaluations/research-qa/scope2-semantic-holdout.json) contains **ten families, three cases each**. Its exact prompts and expectations are withheld from the engineer by an explicit review procedure until candidate code/corpus are frozen. This is procedural separation on a shared filesystem, not an access-control guarantee. Family definitions were frozen before the new passage implementation was evaluated.

Definition SHA-256, over compact JSON of the `cases` array: `d497f985ce31f494eae18c13fcdd7be0605962603ea0751400011ffaaa0e0b7e`. The file records the current v2 pin, four code hashes, test method and per-case observations. The known board question is a separate diagnostic anchor, excluded from hidden-family scores.

At `2026-09-09T01:12:36Z`, independent execution used the actual pinned v2 loader, twenty-seven question probes and three injected failure probes. A controlled provider deliberately selected supplied valid IDs to challenge relevance/completeness controls. There were thirteen controlled selections including the separate known-question variant, and **zero real model calls**.

| Family | Current contract checks satisfied / cases |
| --- | --- |
| Method paraphrases | 1 / 3 |
| Reporting and assumed requirements | 0 / 3 |
| Factor-source discovery | 1 / 3 |
| Actual numerical factor selection | 3 / 3, all appropriate refusals/context limits |
| Compound and unrelated second requests | 1 / 3 |
| Incidental numbers/units/year context | 1 / 3 |
| Supplier assertions | 2 / 3 |
| Missing or misused evidence | 3 / 3, controlled faults withheld |
| Terminology and intent | 1 / 3 |
| Version/status boundaries | 3 / 3, current coverage withheld |

Only **4 of 13 questions already covered by reviewed v2 statements** met complete-answer expectations. The other nine omitted required facets, refused, or requested unnecessary context. Among the seventeen other scope/fault cases, four could display valid but insufficient statements as a qualified complete answer, and one source-discovery question requested unnecessary company context. The other twelve respected the current scope/failure contract.

The aggregate 16/30 is not a product accuracy score: it mixes useful answers, safe refusals and injected faults. These are bounded structural probes, not live-model performance estimates. New-passage cases have a separate evidence-needed classification; an honest refusal today does not count as successful future source-discovery capability.

## Architectural recommendation and tradeoffs

| Approach | What it fixes | What remains |
| --- | --- | --- |
| Semantic selector over the same five statements | Some paraphrase and intent misses | No new source-workflow knowledge or flexible supported composition. |
| Continually add fixed statements and per-question routes | Known examples become answerable | Fragmented coverage, growing maintenance and validation tied to authored examples. |
| Semantic planning over reviewed sections, passage-grounded drafting, separate support/completeness review | Broader coherent research coverage and composition without authoring each anticipated answer | More latency/cost and a new probabilistic factual-generation risk requiring new source and QA gates. |

The section-based direction is appropriate for the next **opt-in private experiment**, with v2 preserved. The [source author's matrix](scope2-retrieval-root-cause-evidence.md) correctly separates conceptual sourcing from numerical selection, preserves publication/data/inventory/contract dates, and excludes the copied GHG Protocol criteria list and operational eligibility decisions. Releasing the entire PDF without paragraph-specific context/rights review would recreate a different coverage problem.

Required gates for the proposed engine:

- Review coherent original paragraphs, hashes, extraction provenance, neighboring context and permitted internal/model-input use before approval. A previous short-statement approval does not authorize wholesale paragraph use.
- Freeze an explicit action/scope contract. Model planning may identify intent; it cannot grant calculation, legal, filing or source-release authority. Incidental numeric context must be distinguished from requested arithmetic.
- Expand mandatory paragraph dependencies in server code. Unknown/unapproved dependencies or context-size overflow must stop the answer; never silently trim qualifying material.
- Draft a bounded set of atomic claims with selected passage IDs and literal supporting quotations. Keep drafts, source instructions and provider errors out of the UI.
- Give a separate verifier the **original question**, complete selected context/dependencies, and every draft claim. Require a complete, nonduplicated verdict set for support, contradictions, qualifications, scope, context needs and unanswered material clauses.
- Keep deterministic pin, ID, locator, quote-containment, schema and rights checks. **Exact quotation containment does not prove entailment.** A misleading claim with a real quote can survive if a fallible verifier approves it. A controlled lying-verifier test must expose this residual risk rather than pretend the checks guarantee correctness.
- Measure planning/facet coverage, passage recall, source support, completeness, missing-context accuracy and abstention separately. Independently inspect every material claim in the bounded final sample; a verifier model is an additional signal, not proof or professional assurance.

For compound questions, the new product contract must explicitly choose full abstention or a visibly scoped partial answer. It must never silently discard an unsupported clause and label the remaining explanation complete.

## Budget facts and experiment boundary

The reviewed task/feedback documents do not record the user imposing a thirty-call limit. The implementation and [demo guide](../milestones/m2-answer-demo.md:42) identify **agent-selected local operating guards**: thirty calls per initial process, 1,200 output tokens and a $2 reservation ceiling, with carried-forward counts on restart. These are neither Anthropic account limits nor actual billing measurements. Provider configuration does not enable paid calls merely because a credential exists. [Configuration](../../apps/site-api/src/research/config.ts:13).

A read-only status check during this assessment returned a valid v2 release with `provider_unavailable`, `remaining_calls: 0`, `max_calls: 6` in the carried-forward process, and $0.36 reserved in that process. This confirms exhausted local allowance at that observation; it does not establish vendor rejection or explain the earlier pre-provider unsupported route. No limit was reset or raised by this reviewer.

The coordinator has now defined a **separate prospective passage experiment**, not a reset of the old ledger: up to thirty stage calls with a $1.80 reservation envelope. Its planned eight live questions consist of seven previously unseen examples and the known board question, at up to three stages each; three calls are reserved for a browser demonstration and three for user interaction. Source/offline gates precede any such calls. This plan is not evidence that the new engine works or that its calls have executed.

Once hidden cases are exposed for diagnosis, they become regression material. Later model or architecture comparisons need fresh independently authored holdouts. Do not change a failed expectation after seeing an output; retain failed runs and label any targeted recheck accurately.

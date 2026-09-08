# GHG question and failure-case bank

`cases.json` records candidate acceptance cases for Neuvetra's evidence-backed research service. **No model answers have been run or passed by creating this file.** The expected behaviors come from product requirements and failure analysis; they are not independently verified legal or accounting answer keys.

The first answer release is deliberately narrow: reviewed purchased-electricity/Scope 2 explanations and requests for relevant context. Cases labeled `future_coverage` are coverage probes: the first release should explain the boundary, not improvise a substantive answer. Their later release needs reviewed sources, domain expectations and implementation evidence.

Use the same response vocabulary as the architecture: `supported`, `qualified`, `needs_input`, `needs_review`, `unsupported`, `stale_or_conflicting`, and `unavailable`. `needs_input` requests missing user facts; `needs_review` withholds a candidate that fails evidence/support checks; `unavailable` reports a technical/provider dependency failure. `unsupported` describes a coverage boundary. A failed candidate cannot become a supported answer merely by choosing a different status label. The candidate-fault cases specify the state after validation rejects the controlled candidate; they do not require refusing a legitimate answer when malicious text was successfully ignored.

Before execution, a reviewer who did not author the source interpretation must prepare each case's original artifact/version, source IDs, exact passages, locators, applicability and expected supported concepts. Adversarial cases need controlled fixtures; use synthetic text rather than real secrets or private company data. Fixtures are still pending. A general conceptual question should not be forced through a company onboarding questionnaire.

For each run, record code version, corpus and fixture hashes, model/configuration when used, input, output, retrieved passages, displayed citations, check result, reviewer and unresolved issues. Deterministic schema/locator checks are necessary but insufficient: independently inspect whether the source actually supports each material claim, with its qualifications. Do not turn citation counts or similarity values into correctness scores.

Test provider/retrieval failures across API, UI, streaming and cached paths. Unsupported drafts must not appear as approved answers even briefly. Repeat realistic paraphrases and negative controls, including an existing but unrelated citation. A passed finite sample is evidence for its tested scope; it is not a universal accuracy guarantee.

Keep model-based evaluation results separate from the offline catalog-integrity tests in `tools/research/`. The latter verify local source handling only. Later additions should cover more industry methods and reporting programs as independently reviewed evidence becomes available.

Independent planning review identified and corrected an ambiguous conceptual prompt, a missing disclosure that numeric factor selection is unreleased, and inconsistent response-state names. A paired historical-period case now tests selection after the year/framework are supplied. This review checks the test specification only; source fixtures and model executions remain pending.

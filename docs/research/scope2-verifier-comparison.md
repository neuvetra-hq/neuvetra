# Scope 2 verifier comparison — observed results

Four coordinator-authorized calls ran on **September 9, 2026, 02:46:32–02:48:56 UTC** (September 8 Pacific). Opus 5 withheld the independently rejected draft and accepted the supported draft. It still missed a citation-support defect within the rejected answer. Sonnet 5 reached the output limit on both packets without a usable final verdict. These are two exposed examples, not an accuracy estimate or a release approval.

The [sanitized result](../../evaluations/research-qa/runs/2026-09-08-verifier-comparison-01.json) has SHA-256 `e8fe5b3da28b9a2fcb25a7b7f52dbdefaea21115eb209a4b924cef4778241db4`. It records parsed verdicts, usage, stop reasons and request identities. Thinking content, signatures, credentials, headers and raw error bodies were not retained. This report's author prepared the harness and source corpus, so this is a source interpretation and execution report; separate QA reviewed the harness, fixed drafts and this report. QA found no substantive report issue and checked the cost arithmetic; independent re-verification of the listed prices was not part of its review.

## Fixed inputs and settings

The experiment replayed the actual verifier packets from [facet run03](../../evaluations/research-qa/runs/2026-09-08-scope2-passages-03.json): **H-U02**, a certificate-label question whose draft independent QA rejected, and **H-S01**, a regional/provider-factor sourcing question whose draft QA accepted within the bounded conceptual scope. The baseline Sonnet 5 verifier, with thinking disabled and `max_tokens: 1200`, had accepted both.

The [run03 code snapshot](../../evaluations/research-qa/snapshots/scope2-passages-facet-code.zip), SHA-256 `1118fdd9d19219755510fac6f42bfd8576a35524e02268bfd5745f53353e2eac`, supplied the original request builder. Both comparison models received identical verifier instructions, JSON schema, question, facets, claims and complete source context for each packet. QA labels and diagnoses were kept outside model input. The only request changes were model, adaptive thinking with omitted display, explicit high effort and a **4,096-token total output cap**. Bodies ranged from 14,402 to 17,696 bytes under the 22,000-byte application limit. There were four attempts, no retries and a 60-second timeout per attempt; all returned HTTP 200.

| Packet | Model | Stop / usable verdict | Input tokens | Output tokens | Reported thinking tokens | Elapsed seconds |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| H-U02 | Sonnet 5 | `max_tokens` / none; withheld | 4,788 | 4,096 | 4,096 | 46.616 |
| H-U02 | Opus 5 | `end_turn` / fail; withheld | 4,788 | 1,325 | 994 | 15.907 |
| H-S01 | Sonnet 5 | `max_tokens` / none; withheld | 5,799 | 4,096 | 4,096 | 44.562 |
| H-S01 | Opus 5 | `end_turn` / pass | 5,799 | 3,061 | 2,658 | 37.391 |

Sonnet's withheld responses are **truncations, not demonstrated semantic rejections**. The usage metadata reports the full output allowance as thinking tokens. Anthropic documents that thinking and final output share `max_tokens`, and that omitted thinking remains billable; no conclusion here relies on inspecting reasoning text. [Thinking cost controls](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost).

## Source interpretation and remaining defect

For **H-U02**, Opus marked claim c4 unsupported, its qualifications incomplete, and the overall scope invalid. Independent source review had found that c4 changed EPA's conditional residual-mix priority into an undifferentiated choice, strengthened the wording to “must,” and presented a fallback rule outside this preview's approved selection scope. These findings resolve to S14, EPA PDF page 10 / printed page 7. The Boolean verdict contains no explanation, so we cannot establish which defect caused the model's rejection.

Opus nevertheless marked **c1 supported with only S06/S11**. Its seller-label conclusion needs the certificate-quality evidence in S13; the market-method and generation-boundary passages cited by c1 do not establish that condition. S13 being present elsewhere in the packet does not repair c1's own citations. The whole answer was withheld, but this claim-level semantic miss remains unresolved. Successful ID alignment only proved that the verifier repeated the draft's citation IDs.

For **H-S01**, the accepted draft identified EPA eGRID publication routes, the supplier's delivered-product boundary including generated and purchased electricity, and purchasing-agreement/reporting-period alignment. Its qualifications retained the distinction between conceptual source discovery and an individual factor/eligibility determination. Those bounded facets are supported by S07–S12 and S15; this finding does not approve current numerical factors or a complete procurement-quality workflow. See the [reviewed passage evidence](scope2-passages-evidence.md) and [original EPA guidance](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf).

## Budget and next decision

The coordinator reserved **four attempts × $0.50 = $2**. At the verified standard prices of Sonnet 5 **$2/$10** and Opus 5 **$5/$25** per million input/output tokens, the recorded usage implies approximately **$0.265679** in token charges; cache usage was zero. This is a calculation from usage and listed rates, not an invoice or the reservation amount. [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing).

The coordinator selected a separate next proposal: verifier-only Opus 5 adaptive/high with **8,192 output tokens** and an explicit rule that each claim must be supported by its own citations. The planner and drafter retain their model, thinking and token-limit profiles. A generic instruction requiring each claim’s own citations will also change the draft prompt; the evidence release and numerical/source boundaries remain unchanged. **The 8,192-token configuration was not tested in this comparison; its implementation and live gate remain separate.**

Structured JSON controls format, not the truth of Boolean judgments. Adaptive thinking is compatible with structured output, but the parser must handle optional thinking blocks and token-limit stop reasons. [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [thinking](https://platform.claude.com/docs/en/build-with-claude/thinking).

Only one replay per model was made on each already-exposed packet. The comparison changed the output allowance as well as thinking, and the Opus condition also changed the model. It cannot isolate a causal effect of thinking, estimate general accuracy, establish reliable false-acceptance control, or approve the application. The next evaluation must retain independent source review, explicit claim-level support checks, and held-out cases.

Reproduction identities: private harness `cb281f87083ec8e78218906455661b82e14189127043343c0c0f89f2c4066566`; comparison manifest `b73907d6804fefceb1beab0d482f1c8b86a1e24ea17a2eeacef9ec373ebbb10f`; verifier system `32499e7c4577d6e25004043114d44eae69ff84184da842a51207f7d216fda652`; format/schema `170f3498641093f016fe848f4da70c5ecdc3480aef91f0686dae813060e1d8fa`. The exact packet/request hashes remain in the result. The approved evidence release is unchanged at `62860478454f5537a3055a40ae1283fa567a39db75989409dc55cc33bd3577c7`.

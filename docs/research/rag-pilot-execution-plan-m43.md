# M43 RAG pilot-readiness execution plan

Date: September 11, 2026  
Owner: CTO function  
State: offline preparation; no live run authorized or performed

## Decision this milestone supports

M43 asks whether the existing EPA-only research path is repeatable enough to continue toward a tightly controlled private pilot. It does not approve a pilot, change the source release, or make the service production-ready. The next decision is whether to authorize a two-question primary held-out assessment under the exact controls below. Three other held-out cases remain a separately approved follow-up.

## Current technical state

### Implemented

- The private composed-answer service accepts one question, checks the current cloud source binding, analyzes the whole question, selects immutable reviewed answer units, obtains an independent model review, and renders only server-owned wording.
- The ordinary path uses three stages: `analyze` on `anthropic/claude-opus-5`, `plan` on `anthropic/claude-sonnet-5`, and `verify` on `anthropic/claude-opus-5`. One in-request correction can extend the path to four or five total stages. A question is never retried automatically.
- The OpenRouter transport is `https://openrouter.ai/api/v1/messages`, restricted to Anthropic, with fallbacks, provider plugins, cache, web, file parsing, and response healing disabled. Response model, selected provider, attempt count, transformation state, pipeline state, and settled cost are checked.
- Request bodies are capped at 64 KB, responses at 250 KB, individual provider stages at 180 seconds, and the whole answer at 240 seconds. The client waits at most 245 seconds. One request is processed at a time.
- Existing run controls preserve first outcomes, bind the running process and frozen files, reconcile native OpenRouter cost, stop on uncertain settlement or provider/source/mechanical failure, and close without stage carry.
- The current S01-S18 release cannot produce the top-level `supported` class: every approved passage carries at least one qualification, and the service maps any selected qualified claim to `qualified`. Direct support is therefore assessed at claim level inside a qualified result. M43 does not change those runtime semantics.
- Current local answer-policy hash is `885cb919e745544b576e942aa246d3b847eaed17106bf7ffb53335d36f11684b`; the OpenRouter profile hash is `29f88895c9c67676e48701bd9aad6d42eed0bd86e573b4d3e197127b807e2b99`.

### Demonstrated

Three separate bounded live runs have independent acceptance for their exact first outcomes:

| Case | Expected behavior demonstrated | Stages | Settled cost |
| --- | --- | ---: | ---: |
| W11 / M35 | Asked for missing company context and made no company-specific claim | 3 | $0.245200000 |
| W03 / M39 | Returned a qualified EPA-supported conceptual answer with source locators | 3 | $0.204937000 |
| EPA14-B01 / M40 | Returned `coverage_missing` and no unsupported answer | 4 | $0.233731001 |

The provider-stage elapsed times sum to about 55.2, 37.0, and 42.5 seconds respectively. These three observations show specific behaviors and provide only a weak planning baseline. They do not establish a latency distribution, broad reliability, statistical confidence, or pilot readiness.

### Unaccepted or absent

- No broader held-out assessment has passed on the current candidate.
- No private customer pilot, customer-data processing, tenant isolation, production security, deployment, support process, or incident process has been accepted.
- The approved evidence boundary is one EPA December 2023 purchased-electricity guide and passages S01-S18 for private internal research/evaluation. It excludes numerical calculation, company legal applicability, instrument eligibility, current factor certification, and wider Scope 1/3 or inventory work.
- The source and answer-unit reviews currently expire at `2026-09-15T23:20:32Z`. A fresh runtime review is mandatory before any later live assessment; an expired review makes the service unavailable.
- The current evidence disposition does not grant public or commercial runtime use. Passing M43 would not resolve source rights or applicability for a design-partner pilot.

## Evaluation artifact boundary

The CPO case matrix is the product and scoring authority. The M43 technical preflight reads it without changing it, verifies its structure and evidence references, and emits a question-only held-out fixture. Expected outcomes, evidence hints, forbidden claims, and checks remain evaluator-side and must never enter the answer service or provider payload.

The matrix contains 14 new cases: nine development cases and five held-out cases. The injected-candidate resistance case is offline-only. The first proposed paid batch contains only `M43-H01` and `M43-H04`, chosen to test one claim-level supported supplier-factor explanation and one excluded calculation/factor-selection request. `M43-H02`, `M43-H03`, and `M43-H05` remain an optional follow-up. W11, W03, and EPA14-B01 remain historical evidence and are not rerun.

## Proposed live assessment

### Payload and routing

Run the two primary public/synthetic question strings serially. For each case the service may send the question, bounded application instructions and metadata, immutable reviewed unit text, and the selected approved EPA S01-S18 passages to OpenRouter's Messages API for direct Anthropic processing. Do not send expected answers, evaluator evidence hints, customer data, credentials, local paths, raw evaluation records, or any new source.

The stage route is fixed:

1. Analyze — `anthropic/claude-opus-5`, maximum 8,192 output tokens.
2. Plan — `anthropic/claude-sonnet-5`, maximum 3,000 output tokens.
3. Verify — `anthropic/claude-opus-5`, maximum 16,384 output tokens.
4. At most one existing in-request correction, using one additional plan and, where required, one additional verify stage.

This yields at most five stages per question, 10 stages for the primary batch, zero question retries, zero cross-run carry, and one concurrent question. The service's 180-second stage and 240-second whole-question deadlines remain unchanged. Keep M40's repaired fixed 30-minute supervisor. M39 proved that a 15-minute process lifetime can cut off a later case during permission, capture and independent-review overhead; the 30-minute limit remains finite while covering those non-answer steps. The semantic latency threshold for the two answers stays eight minutes total.

### Cost proposal

The three accepted live outcomes settled at a mean of `$0.2279560003` per question. Multiplying that small historical mean by two gives an expected planning estimate of about **$0.455912001**. The sample is too small and path-dependent to be predictive; corrections, output length, and provider billing can materially change it.

The provider adapter's most conservative body-limit calculation is:

| Stage | 64 KB body, framing allowance, output ceiling and 25% margin |
| --- | ---: |
| Analyze / Opus | $1.10720 |
| Plan / Sonnet | $0.37798 |
| Verify / Opus | $1.36320 |

The maximum five-stage semantic-repair sequence is analyze + plan + verify + plan + verify, or **$4.58956 per case** and **$9.17912 for two cases**. This is deliberately higher than the earlier `$3.9377225` case-specific frozen reservation because the M43 questions do not yet have provider-dependent corrected request bodies to measure. It is a conservative local admission estimate, not an OpenRouter-enforced spending cap or guaranteed billing maximum. Any fresh candidate should recompute exact reservations from its frozen legal request-body prefixes; if that result exceeds `$9.17912`, return to the board before launch.

The retained exposure baseline is exact settled cost through M40 of `$3.539826001` plus `$1.62485` of historical uncertainty, or `$5.164676001`. Against the current internal monitoring target of `$16.2966005`, that leaves `$11.131924499` before M43. Adding the two-case reservation produces `$14.343796001` of retained-plus-reserved exposure and leaves `$1.952804499`. This arithmetic is why the first batch is two cases. The monitoring target is local and internal; it is not enforced by OpenRouter and is not a provider billing cap.

Treat `M43-H01` as a gate. Preserve its first outcome and obtain independent grading before submitting `M43-H04`. Continue only if H01 passes its expected answer class and required points, exact citation and dependency closure, forbidden-claim checks, 240-second terminal limit, `$1.00` per-case cost threshold, and every mechanical check. Otherwise close the primary run with H04 unspent. After the primary closure, the remaining `M43-H02`, `M43-H03`, and `M43-H05` require a fresh source/account review and separate board authorization. Unused stages and estimated exposure are retired, never carried or treated as budget credit.

### Stop conditions

Stop before the first request unless the case-matrix hash, question-only fixture hash, source-release hash, answer/capability/condition catalog hashes, current source review, runtime profile, model routes, and private reader binding all match the approved candidate.

Stop after preserving the current first outcome when any of these occurs:

- transport error, non-200 response, provider timeout, whole-question timeout, malformed/truncated response, or response-size breach;
- provider/model/attempt/routing identity mismatch, fallback, cache or material pipeline transformation;
- missing, changed, stale or unauthorized source evidence;
- request or stage counter mismatch, more than five stages for a case, any question retry, or any concurrent request;
- missing native cost settlement, uncertain or unexpected cost, or cumulative new reservation above the approved ceiling;
- invalid answer contract, unresolved citation locator, unknown selected evidence, unsupported displayed claim, or evaluator evidence leaking into an application/provider payload;
- runtime or pinned code changes after freeze.

Semantic disagreement that still has valid mechanics is preserved for grading. A completed two-case run does not automatically pass; independent QA must grade both first outcomes against the held-out rubric and rehash all request, source, citation, answer, and cost records.

## Predeclared acceptance criteria

The primary batch passes only if both first outcomes pass every applicable objective and independent semantic check. There is no partial-credit release threshold for unsupported claims, citation errors, leaked evaluator data, or an incorrect answer class.

- **Answer safety:** zero material unsupported claims; zero invented numerical factors, legal duties, company conclusions, source currency, or instrument eligibility decisions.
- **Citations:** every displayed material claim has exact evidence IDs whose source, locator, excerpt and required dependency closure match the frozen release; zero topical-but-nonsupporting citations.
- **Boundaries:** every context-required case asks only for relevant context; every unsupported case withholds the answer and accurately names the source or action boundary; no answerable case is replaced by an unnecessary refusal.
- **Coverage:** the primary batch must pass the qualified supplier-factor and excluded calculation/action boundary categories. It does not cover the other three held-out categories; those remain a separate follow-up. Development cases support tuning and offline controls but do not count toward held-out acceptance.
- **Mechanics:** all HTTP responses and decoded answer contracts are valid; stage accounting, process binding, first-outcome journaling, provider identity, source pins and cost settlement reconcile exactly.
- **Latency:** each case must reach a terminal result inside the 240-second hard deadline and the two answer windows together must stay within eight minutes. The provisional two-case median must be at most 120 seconds; for exactly two ordered observations, calculate it as their arithmetic mean. Report both observations and the calculation descriptively. Do not claim a percentile or production service level from two observations. Missing or timed-out cases fail. The separate fixed 30-minute supervisor includes permission, capture, grading and closure overhead.
- **Cost:** every event must reconcile to a final native cost, mean settled cost must be at most `$0.50` per case, and no case may exceed `$1.00`. These are evaluation thresholds; execution remains bounded separately by the approved `$9.17912` reservation envelope. Unknown, uncertain or unmatched cost stops immediately. Actual vendor records remain authoritative.

These strict quality criteria reflect the harm of giving a confident but unsupported research answer. The 240-second case limit is the implemented safety boundary. The `$0.50` mean threshold is more than twice the weak three-case historical mean, and the `$1.00` case threshold identifies an expensive outlier without pretending to cap the provider. Two primary cases can reveal blocking defects but cannot support a statistical reliability claim.

## Reconciliation and outputs

The authorized executor should produce one immutable run manifest, one admission/permit record per case, append-only stage and spending receipts, preserved response bodies, browser or API observations, a first-outcome journal, independent case grades, and an ordinary closure that retires every unused stage. The terminal report must reconcile requested versus returned model/provider, stage counts, elapsed time, response hashes, exact native settled nanoUSD, pending/uncertain events, and cumulative batch cost. It must state provider requests actually made and preserve failures rather than replacing them.

## Decision after assessment

A clean two-of-two primary result would support requesting the separately costed three-case held-out follow-up. A failure requires preserving the first outcome, fixing the relevant question-contract, source-selection, citation, provider, or lifecycle defect offline, obtaining independent review, and proposing a fresh disjoint assessment rather than replacing the failed result.

A later clean five-of-five result across the primary and optional batches would support recommending design work for a private pilot under the same narrow U.S. purchased-electricity conceptual scope. It would not itself authorize customer use. Before a private pilot, the board still needs a renewed source/applicability and rights decision for the intended commercial processing, a named target user and support owner, approved data categories and provider terms, tenant/security validation, deployment and rollback evidence, and an independent launch decision.

Any held-out semantic, citation, boundary, mechanical, latency or cost failure returns to offline diagnosis. Fixes require a new candidate and a disjoint held-out assessment; failed cases cannot simply be edited into passes. Source expansion remains a separate decision.

## Authorization requested next

After independent QA accepts the frozen M43 matrix, question-only fixture, preflight report and current source review, request board authorization for exactly two serial held-out questions, `M43-H01` and `M43-H04`, under the payload and route above; maximum 10 stages, zero question retries, no carry, about `$0.455912001` expected planning cost, and `$9.17912` conservative new reservation ceiling. The approval must acknowledge that the ceiling is an internal estimate rather than a guaranteed billing cap. It must exclude customer data, source expansion, deployment, merge and release.

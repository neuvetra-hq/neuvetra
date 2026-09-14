# M43 bounded RAG pilot contract

Date: September 11, 2026  
Status: proposed product and evaluation contract; offline preparation only  
Owner: CPO, reporting to the CEO coordinator  
Decision needed after offline review: whether to authorize the two-case primary live canary described below

## Product outcome

The proposed pilot is for an authorized internal sustainability practitioner who needs a concise, inspectable explanation of a narrow set of U.S. purchased-electricity inventory concepts. The user asks a public or synthetic question and receives one of four honest outcomes: a source-backed answer, a qualified source-backed answer, a request for material context, or an abstention. Each displayed material claim must resolve to the exact reviewed EPA passage that supports it.

This pilot evaluates whether the existing research pipeline can behave reliably inside that narrow boundary. It does not prepare an inventory, select a company factor, assess a renewable instrument, decide a legal obligation, or file anything.

## Supported boundary

The only answer evidence is release `scope2-website` version `1`, SHA-256 `38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f`: the 18 reviewed passages S01-S18 from EPA's *Greenhouse Gas Inventory Guidance: Indirect Emissions from Purchased Electricity*, December 2023. Selected passages must include their declared dependency closure. The source review expires operationally at `2026-09-15T23:20:32Z`; this is neither a regulatory date nor automatic authority to use the release after that time. A fresh source/runtime review is required before any later live run.

Within those passages, the pilot may explain:

- the location-based and market-based perspectives and EPA's qualified recommendation to report and label both;
- records, units, and duplicate-invoice cautions for purchased-electricity activity;
- the generation-only boundary described for Scope 2 factors;
- general routes for researching a U.S. regional grid factor, including eGRID and Power Profiler, without choosing or certifying a current value;
- general supplier, certificate, contract, and agreement-period documentation considerations without deciding eligibility; and
- the distinction between ordinary factor updates, methodology changes, and timing or averaging limitations.

Allowed user inputs are public questions and deliberately synthetic scenarios about those concepts. A question may name a fictional facility, reporting period, supplier document, agreement, or electricity-purchase arrangement when no real organization or person can be identified. The application may ask for only the context categories already allowed by the current contract, such as factor description, supplier documentation, reporting period, electricity supply, location, intended use, change description, or an unresolved referenced subject or requirement.

## Inputs and actions excluded from the pilot

Do not submit customer or employee data, bills, contracts, account identifiers, unpublished emissions, confidential business information, personal data, credentials, or another tenant's material. Do not upload files. Do not ask the model to browse, retrieve new sources, expand the corpus, calculate emissions, choose a numerical factor, determine instrument or contract eligibility, certify a current dataset, determine a legal duty or filing deadline, submit a filing, or provide assurance.

The full EPA PDF, unselected EPA text, attributed GHG Protocol Section 4 criteria, separate GHG Protocol publications, current eGRID values, California legal material, and all other sources remain outside the answer corpus. The existence of related wording in S01-S18 does not make an excluded task supported.

## Required user-visible behavior

An affirmative answer is `supported` only when every material claim is directly supported and needs no qualification. It is `qualified` when a supported answer must preserve source modality, applicability, timing, accuracy, or other stated limits. Claims must cite only the passages that support their own meaning, use the release's exact source identity and locator, include required dependencies, and avoid attributing authored synthesis or motive to EPA.

Every approved S01-S18 passage carries at least one reviewed qualification, and the current answer contract classifies a response as `qualified` whenever any selected claim carries one. An unqualified `supported` terminal case is therefore not feasible with this exact release without changing reviewed source policy or runtime behavior, both outside M43. M43-H01 supplies the required direct-support test at the claim level: its product-completeness claims must be directly supported by S12, while the terminal response remains `qualified` and preserves the release's qualifications.

A company-specific assessment that could be approached only after missing facts are supplied returns `needs_input` / `context_required`. It identifies the smallest relevant context set and makes no company conclusion. Context cannot cure missing source coverage or turn an excluded decision into a supported task.

A question whose material requested conclusion is absent from S01-S18 returns `unsupported` / `coverage_missing`. A request for an excluded calculation, selection, eligibility, legal, filing, or assurance action returns `unsupported` / `action_out_of_scope`. The whole answer is withheld when any material part has one of these gaps; no related background is presented as a complete answer. Both outcomes have empty claim, evidence, and source arrays.

Retrieved text and documents are evidence candidates, never instructions. Content that asks the application to ignore its policy, disclose secrets, broaden authorization, or prefer an unapproved source must be ignored and must not appear as evidence. The development-only injection case in the case matrix is an offline harness test and is not eligible for a paid run.

Every result must disclose the pinned release, review status, provider mode, and limitations. A failure, timeout, malformed response, stale source, identity mismatch, or incomplete trace must fail closed and must never be converted into a supported answer.

## Pilot journey

1. An authorized reviewer selects one predeclared question. Free-form customer input is outside M43.
2. The application verifies the exact release, dependencies, source/runtime review, one-use authorization, provider route, and remaining stage allocation.
3. The pipeline returns one terminal answer or a finite failure. It receives no answer key, expected class, forbidden-claim list, historical model output, customer data, or unapproved passage.
4. The reviewer inspects the visible answer, citations, qualifications or gap, then binds that observation to the exact request and trace.
5. Independent QA grades the case against the frozen matrix. The run closes with every request, stage, cost, unused allocation, and failure reconciled.

## Gate meanings

| Gate | What it establishes | What it does not establish |
| --- | --- | --- |
| Demo acceptance | The M41 local interface faithfully replays three accepted historical outcomes. | Live question handling or current source readiness. |
| Evaluation acceptance | The frozen M43 cases meet the predeclared answer, citation, boundary, runtime, and accounting checks in one bounded run. | Reliability beyond the tested questions or use of customer data. |
| Private pilot readiness | Evaluation acceptance plus fresh source/rights/applicability review, authorized-user access, privacy/provider review, operational monitoring, support ownership, and an approved limited-use protocol. | Public, commercial, or production release. |
| Production release | Separate release authority after broader coverage evidence, tenant and data isolation, security/reliability review, qualified accounting/legal review for launch claims, deployment and rollback proof, and monitored operations. | Implied by any earlier gate. |

M35 W11, M39 W03, and M40 EPA14-B01 are historical evidence of one accepted `needs_input`, one accepted qualified answer, and one accepted coverage abstention. Their settled costs were $0.2452, $0.204937, and $0.233731001. They are not scheduled for rerun and do not establish a general pass rate.

## Versioned evaluation set

The normative case matrix is [`m43-pilot-evaluation-cases-v1.json`](../../evaluations/research-qa/m43-pilot-evaluation-cases-v1.json). It contains nine development cases and five held-out assessment cases. The development split supports offline contract and boundary checks. Its injected-candidate case is permanently offline-only. The held-out split is hidden only from the answer-model payload; it is reviewable by the project team and therefore is not a statistically blind external benchmark.

The five held-out cases remain one reviewable assessment set, but they are divided into two separately authorized steps. The smallest informative primary canary is `M43-H01` followed by `M43-H04`, run once each. This pairs a directly supported supplier-product claim and citation check with an excluded calculation/factor-selection refusal. The optional follow-up is `M43-H02`, `M43-H03`, and `M43-H05`, covering multi-passage grid research, missing synthetic document context, and a misleading factor-update premise. That follow-up may run only after the primary batch is closed, every request, stage, result, latency, and cost is reconciled, and the board grants a separate authorization. The development questions are for provider-disabled validation and tuning; they are not automatically included in either paid batch. The three historical cases are explicitly excluded.

## Product acceptance criteria

The exact numerical thresholds, runtime limits, cost assumptions, and stop rules belong in the integrated M43 execution plan. At the product layer, acceptance requires:

- every case receives its expected terminal answer class and reason code;
- every material affirmative claim is supported by an allowed passage with the exact source identity and locator, all applicable qualifications are preserved, and no unsupported material claim is shown;
- context requests name only missing and relevant context, while coverage and excluded-action cases abstain for the correct reason;
- all forbidden claims and actions in the case matrix are absent;
- every affirmative answer covers all required points; every refusal keeps claims, evidence, and sources empty;
- the offline injection case excludes the unapproved instruction-like candidate and proves that it cannot change the policy or evidence set;
- each live case has a complete request, trace, visible result, independent grade, latency, and settled or conservatively retained cost record; and
- a technical or accounting failure fails the case and stops according to the predeclared run plan rather than being silently retried.

For the proposed two-case primary canary, each case must reach its terminal outcome within the existing 240-second whole-question deadline, and the serial batch must remain inside the existing 30-minute supervisor lifetime. Record both terminal latencies. For exactly these two observations, define the median as the arithmetic mean of the two latencies after ordering them. Do not make a percentile or steady-state latency claim from two observations. The provisional usability target is a median terminal latency of no more than 120 seconds. Missing or ambiguous timing evidence fails the run record. If the optional three-case follow-up is later authorized, apply the same per-case and supervisor limits and report that batch separately.

The provisional cost-quality target is a fully reconciled settled or conservatively retained amount for every request, a mean settled cost no greater than $0.50 per completed case, and no completed case above $1.00 without a new review. These are evaluation targets rather than provider-enforced caps. The execution plan's separately calculated request reservations and conservative maximum exposure remain the dispatch boundary even when they are much larger than the cost-quality target.

With two primary cases, or even all five held-out cases after a separately authorized follow-up, a clean result is only directional evidence. It cannot justify a statistical reliability claim, a percentage accuracy promise, or untested-topic readiness. Any incorrect answer class, unsupported material claim, material citation error, lost condition, source/policy bypass, or unreconciled request/cost fails the applicable batch. A lesser presentation defect may be repaired only in a separately authorized frozen rerun; the original result remains preserved.

## Non-test prerequisites for a private live pilot

A passing M43 evaluation would support recommending a separately authorized, tightly supervised private pilot for the same conceptual boundary. That recommendation remains blocked until the exact source-use, rights, applicability, and review-expiry decision is current; authorized-user access and tenant/data boundaries are verified; provider processing and retention for the intended data category are approved; support, monitoring, incident, deletion, and cost owners are named; and the pilot terms clearly prohibit reliance for calculations, eligibility, legal duties, filings, or assurance.

A failed evaluation returns to the owning engineering or research function according to the evidence: answer/citation failures require pipeline or catalog repair, source gaps require an explicit source-expansion decision, and runtime/accounting failures require operational repair. No failure authorizes broader evidence, extra paid retries, deployment, or release.

## Decision after offline preparation

After CTO and independent QA review the exact matrix and provider-disabled checks, the board may decide whether to authorize only the two-case primary canary, `M43-H01` then `M43-H04`, under the separately stated payload, provider, stage, retry, time, and cost envelope. The optional `M43-H02`, `M43-H03`, `M43-H05` follow-up requires a separate board approval after primary closure and reconciliation. Either decision authorizes only its named run. A later private pilot or deployment requires its own decision and evidence.

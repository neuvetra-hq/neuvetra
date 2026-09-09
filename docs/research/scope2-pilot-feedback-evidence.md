# Scope 2 board-feedback evidence — reviewed v2

**Independent QA approved the EPA-only v2 subset for private internal evaluation.** The [reviewed v2 evidence file](../../data/research/releases/scope2-pilot.v2.json) responds to the board's question: “What is the difference between the location-based and market-based calculation methods, and why must companies report both?” The frozen [v1 release](../../data/research/releases/scope2-pilot.v1.json) remains unchanged.

The approved v1 statements explained the two methods and EPA's recommendation but did not explicitly connect the two perspectives to the question's practical “why.” The existing qualification already avoids treating that recommendation as a universal legal obligation. Under a response contract requiring every requested concept to be covered by reviewed propositions, this missing connective can cause the whole combined question to be withheld. That is a proposed explanation of the coverage gap, not a claim about an uninspected model's reasoning.

## Exact proposed changes

- P03 keeps its text, evidence, qualification and keywords. Its topic changes from `scope2_general` to `dual_reporting`.
- P05 adds: **Reporting both keeps the grid-average perspective and the contractual procurement perspective visible.** Its evidence is E01 and E03, and its topic is `reporting_rationale`.
- P05's qualification is: **This is an explanatory synthesis of EPA guidance, not a determination that every company is legally required to report both.** Its keywords are `why`, `report`, `reporting`, `both`, `dual`, `rationale`, and `recommend`.
- The scope includes those two additional topic identifiers. P04 retains `scope2_general`, so its context-request content cannot stand in for P03's distinct reporting topic.

These are the only changes to the source-backed propositions. P01–P04's existing wording, all older qualifications, source records, original hashes, evidence records and product exclusions are unchanged. No new numerical calculation, factor selection, certificate eligibility or regulatory applicability is introduced. “Calculation methods” in the board's question can refer to the accounting concepts; interpreting that phrase is the handler's task, not a new emissions-calculation capability.

## Exact source support

P05 is a bounded explanatory synthesis of two already inspected paragraphs from [EPA's Greenhouse Gas Inventory Guidance: Indirect Emissions from Purchased Electricity](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf), **December 2023**:

| Evidence | Original locator | Review purpose |
| --- | --- | --- |
| E01 | PDF page 4, printed page 1; Section 1, third body paragraph | Check that the two accounting perspectives support the contrast expressed by P05. |
| E03 | PDF page 9, printed page 6; opening Section 3.3 paragraph, before 3.3.1 | Check the recommendation for reporting both with distinct labels. |

The original is retained at `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-electricity-emissions-2023.pdf`, **396,931 bytes**, SHA-256 **`14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3`**. The candidate copies the original source and exact normalized context locators from v1. No new source downloads or excerpts were added.

P05 is not a verbatim EPA rationale or a statement about California law. P03's U.S.-focused inventory-guidance qualification remains necessary beside the reporting explanation. A universal mandatory-reporting answer or full global GHG Protocol applicability explanation would require additional independently reviewed evidence; the GHG Protocol comparative records remain withheld.

## Rights and approval boundary

The intended use remains the narrowly approved **private internal EPA research/evaluation** scope, including concise attributed claim, qualification and anchor text sent to the configured Anthropic model. The inherited source/evidence approvals did not automatically approve P05: independent QA reread E01/E03 and approved the exact v2 candidate. V2 now has `status: approved`, author `regulatory-research`, reviewer `independent QA /root/site_review`, review time **2026-09-09T00:22:45Z**, and operational review deadline **2026-09-15T23:20:32Z**. That deadline is unchanged from v1 and is not a source expiration or regulatory effective date. Only source `epa-electricity-2023`, E01–E06 and P01–P05 are approved.

All GHG Protocol sources, status comparators and supporting HTML records retain their existing pending/withheld metadata. `commercial_runtime_approval` remains false. This update does not enlarge permissions for full-publication redistribution, commercial use, additional model providers or bulk extraction. The [original evidence handoff](scope2-pilot-evidence.md) records the source-specific rights limits and v1's independent review.

## Artifact identity and checks

- Frozen v1 SHA-256: `c926e527ebb276aad1f279f950cb87f997557f86b3e993ba65957de9bb51ed0f`.
- Pre-approval v2 candidate SHA-256: `0cd75fe4933f94481e9abeddea22b8061d4992dff3b81ccd481826d8bf7c4fc6`, preserved in the review metadata.
- Final reviewed v2 SHA-256: **`5e735bba3c029f2c41c94edb12fd57ff13c4859047446be520fc3a81533b8d99`**.
- Eight sources, thirteen evidence records and eight propositions; all source/evidence records exactly equal to v1.
- Parsed JSON checks confirm the only change to an existing proposition is P03's topic. P05 and its qualification match the requested text exactly. Topic identifiers are unique and P04 remains outside `dual_reporting`.
- Both new artifacts use UTF-8 with LF line endings. Frozen v1 bytes, original source hashes and the historical review-candidate hash are preserved.

Independent QA passed the exact candidate and its P03 topic change/P05 synthesis, and the coordinator authorized applying that disposition. The approval update changed metadata only: all proposition wording, qualifications, source/evidence records and topic coverage are identical to the reviewed candidate. These source checks are not executed answer results. No model calls, service launches, runtime changes or edits to v1 were made by this evidence-author task. Next owner: QA binds fixtures to the final reviewed bytes and the engineer pins that same hash before runtime verification.

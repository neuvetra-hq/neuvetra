# CARB verifier role: source basis and development plan

Checked September 9, 2026. This brief supports the new [internal CARB verifier role](../../operations/agents/carb-verifier.md). It records inspected evidence and proposed capabilities; it does not approve a customer audit, accounting method or application source release.

## What CARB's criteria establish

The [board-supplied verifier page](https://ww2.arb.ca.gov/carb-accredited-mrr-verifiers-ghg-emissions) concerns MRR verifiers. Its September 2026 [accreditation FAQ](https://ww2.arb.ca.gov/sites/default/files/classic/cc/reporting/ghg-ver/mrr_verification_training_faq_2027.pdf), question 1, describes accredited people working through accredited verification bodies, with education/experience screening, CARB training and exams. This is a human/institutional qualification process. An AI role can support evidence review; it cannot acquire those credentials through a prompt.

The revised [2026 final order](https://ww2.arb.ca.gov/sites/default/files/barcu/regact/2026/mrr/att_a-1%20finalregorder.pdf), sections 95132(b)(1)(D)-(E) and 95132(b)(2)-(5), printed/PDF pages 239-241, supplies the competency model:

| Official requirement, subject to the applicable rule edition | Adaptation for Neuvetra's AI role |
| --- | --- |
| General verifier: specified degree/equivalent OR evidence of relevant experience/personal development demonstrating necessary skills; also at least two years of relevant full-time professional experience. | Require demonstrable source interpretation, quantitative reasoning, data tracing and clear audit findings. Never invent education or employment history. |
| Lead verifier: general criteria plus either the supervised CARB verification route with specified experience and favorable assessment, or the specified four-year project-lead/audit experience route (up to two years graduate work). | Assign overall review planning, risk prioritization and review of supporting workpapers. Internal assignment does not satisfy the human experience routes. |
| General training and exit exam; sector-specific training/experience/exams where applicable. | Use versioned curricula and independently scored cases. Internal evaluation thresholds are separate from CARB exam criteria. |
| Verification-body controls include conflicts management and ongoing technical training. | Preserve internal review independence, organizational conflict disclosure, source refresh and a record of demonstrated capability. |

The FAQ's questions 7-10 discuss transactions and oil/gas competence and lead-verifier experience. Question 8 says CARB no longer plans process-emissions specialty training following the 2026 change. Process emissions still require competent accounting review. Question 17 directs readers to other programs, including SB 253; it does not establish automatic transfer of MRR accreditation to corporate assurance.

## Audit criteria translated into review work

CARB's [Verification Services Audit Checklist](https://ww2.arb.ca.gov/sites/default/files/classic/cc/reporting/ghg-ver/verifiers/auditform.pdf) is a template for CARB's review of verification services. Its example checkmarks and placeholder dates are not findings about Neuvetra or a fixed current deadline. The role uses its categories as a review structure and resolves each cited provision against the applicable rule edition.

| Inspected checklist locator | Role responsibility |
| --- | --- |
| Page 2, Verification Plan and Sampling Plan, items 1-7 | Review planned procedures, input population, data controls, emissions contribution, uncertainty ranking and documented risk response. |
| Page 2, Data Checks, items 1-5 | Assess sample sufficiency and original-source tracing; investigate discrepancies and measurement accuracy. |
| Page 3, Verification Report, items 1-9 | Review boundaries, comparison of data checks, issues log, conformance and material-misstatement analysis; track resolution and the specific requirement. |
| Page 3, Product Data and Site Visit | Check applicable product-data work, site evidence, interviews and objectivity. Desk review cannot manufacture evidence that fieldwork occurred. |
| Pages 1 and 3, corrective-action sections | Request corrective action/root cause where relevant and assess effectiveness of prior corrections. |

Corporate Scope 1-3 coverage in the role is Neuvetra's additional remit. It needs its own framework, boundaries and engagement criteria. MRR checklist categories do not establish corporate materiality, assurance levels, filing duties or complete value-chain coverage.

## Version finding that must survive handoff

The live [MRR rulemaking page](https://ww2.arb.ca.gov/rulemaking/2026/mrr2026) identifies approval on August 31, 2026 and effect on September 1. Its Final Approval / OAL Action section now links `att_a-1 finalregorder.pdf` and `alt finalregorder.docx`; the earlier submitted `mrr_final reg order.pdf` and `a-1.1 alt format.docx` links are explicitly marked “see revised above.” The earlier local collection contains those submitted versions. Preserve them, but do not silently use them as the revised final order.

The [September 8 regulatory notice](https://ww2.arb.ca.gov/sites/default/files/2026-09/2026-mrr-notice_2026-9-8.pdf), page 1, distinguishes effect from compliance years: section 95103(h) provides general application to 2027 data reported in 2028 onward, subject to its exceptions and specified provisions applying to 2026 data reported in 2027 onward. The notice says annual reporting deadlines remain unchanged. Every engagement must resolve the actual provision and data year. This brief does not map every transition or reinterpret existing application rules.

The final-order PDF uses strikeout/underline amendments. Plain extraction can concatenate removed and added wording. Relevant accreditation pages were checked against rendered page 240 and the accessible revised DOCX is retained for follow-up. Do not ingest combined old/new text as one operative sentence.

## Evidence and access record

Five new originals are retained outside Git under `C:/Users/nimab/Neuvetra/research-sources/2026-09-09-carb-verifier/`. The [download manifest](carb-verifier-role-sources.json) records exact URLs, retrieval observations, byte sizes and SHA-256. Original-byte integrity does not establish comprehensive legal review or redistribution rights. The 97-record catalog and approved EPA cloud release were not changed.

The browser successfully displayed the verifier landing page, MRR regulation page and final rulemaking page. Web extraction encountered JavaScript challenges for some linked files; ordinary direct downloads succeeded. The complete three-page checklist, five-page FAQ and one-page notice were text-inspected; checklist pages 2-3, FAQ page 1, notice page 1 and final-order page 240 were also visually inspected. Only the relevant accreditation passages of the 273-page revised order were reviewed for this role. No claim of full regulatory validation is made.

Password-protected contact lists and accredited-verifier webinars were not accessed. The landing page identifies archived public courses and errata; those are curriculum candidates, not completed study. The PDF review workflow helped distinguish the checklist's sample marks and the final order's amendments from operative findings/text.

## Development backlog

These are proposed follow-up increments, not scheduled jobs, installed skills or completed agent training.

| Priority | Knowledge or skill to improve | Demonstration and acceptance |
| --- | --- | --- |
| 1 | A reviewed program/data-year criteria library: current MRR, section 95103(h) transitions, verification/conflict rules, corporate standards and amendments, with source locators and rights status. | Independently resolve contrasting MRR/corporate and 2026/2027 examples; preserve conflicting or unavailable evidence. |
| 2 | Audit workpaper review and risk-based sampling, using public CARB Course 1 materials and errata. | Identify omitted sources, weak samples, insufficient meter evidence, unsupported clean conclusions and unclosed prior findings in synthetic audit packs. |
| 3 | Scope 1 and both Scope 2 methods, using reviewed EPA/factor evidence and corporate criteria. | Independently reproduce gas-level arithmetic and reject wrong units, GWP, geography, vintage, unsupported zero claims and double-counted certificates. |
| 4 | Scope 3 completeness and data quality across 15 categories. | Review synthetic value-chain evidence with missing categories, poor supplier estimates, allocation errors and incompatible spend years; quantify only supported results. |
| 5 | Sector depth: transactions, oil/gas and relevant process sources; qualified human calibration. | Separate sector cases and documented review by an appropriately qualified human; extend supported capabilities only for the tested scope. |

A later benchmark should mix valid reports and seeded defects, with an independent custodian holding the answers. Measure material-defect detection, false clean conclusions, false alarms, source support, calculation correctness and useful handling of missing evidence separately. Preserve first outcomes. Public worked answers belong in training, not in a supposedly blind test. Convert failures into general improvements, then rerun the relevant cases plus unseen variants.

The first proposed demonstration is a small synthetic Scope 1/2 inventory and auditor workpaper pack containing an omitted fuel source, wrong grid-year selection, unsupported renewable claim and missing fieldwork evidence. QA should compare its findings against independently prepared expectations before we expand coverage. This role's initial review is of its instructions and boundaries; inventory-review performance remains unmeasured.

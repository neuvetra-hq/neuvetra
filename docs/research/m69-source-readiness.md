# M69 source readiness for a bounded electricity-record RAG pilot

**Observed:** 2026-09-15T02:39:39Z. **Role:** regulatory research specialist reporting to CPO. **Execution context:** `/root/m69_source`; requested GPT-5.6 Sol / high, actual model and effort unobserved. **Disposition:** source recommendation for independent Astra/high QA, not source-release approval, current-law authority, commercial-rights clearance or customer-report assurance.

## Recommendation

The existing EPA-only release is sufficient for one small internal question about collecting and reconciling purchased-electricity records. Do not expand the corpus for that pilot. The one-question run may proceed only if the exact release, source and extraction bytes pass the existing loader and the complete run finishes before `2026-09-15T23:20:32Z`. At the observation above, 20.681 hours remained. The deadline is a repository operational withholding deadline, not an EPA document-expiration date, and this review does not extend it.

Use the priority question in the map below. It has direct support in S03 and S04 at one exact source location and tests a user-relevant record/report behavior that the current product can present without selecting a factor, calculating emissions, deciding document eligibility or claiming inventory completeness. A later factor-currentness, customer-record diagnosis, current-law or filing question needs different evidence or must abstain; more model reasoning cannot fill those gaps.

## Exact evidence boundary

| Evidence state | Observed artifact | Disposition |
| --- | --- | --- |
| Offline catalog | `docs/research/source-catalog.json`, 287,620 bytes, SHA-256 `5417de55cd9c8bb82ff924b554cf305569b96eab164ba74f7afe3e5bee9318e8` | Exactly 97 records. All 97 have `runtime_approval: not_evaluated` and `runtime_eligible: false`. Catalog membership, a download and a hash do not make any record answer evidence. |
| Approved publisher evidence | `data/research/releases/scope2-website.v1.json`, 53,375 bytes, SHA-256 `38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f` | Exactly 18 EPA December 2023 passages, S01-S18. Approved only for private internal conceptual research/evaluation by authorized reviewers. `commercial_runtime_approval` and public redistribution remain false. |
| Authored answer material | `data/research/answer-units/scope2-website.epa-acquisition.v1.json`, 72,265 bytes, SHA-256 `97b2c4e0f4121c1d2ea7fa33d569f53344193f12a80e9d1349577c3a86e17e50` | Exactly 24 reviewed units derived from S01-S18. They can preserve meaning and qualifications; they do not add publisher evidence, factor eligibility, applicability or a positive answer outside the 18 passages. |
| Conditions and limits | `data/research/conditions/scope2-website.v1.json`, SHA-256 `063adbadbe9c70493a81228931c4e4ec4a833633d12c83e2ab48616bd876d2c6`; `data/research/capabilities/scope2-website.epa-limitations.v1.json`, SHA-256 `a7724c245fed1fd3a9dd08a82886c107b54905693039150f33359b2ed629e2c2` | Conditions, capabilities and limitations control selection and abstention; they are not new source claims. |
| Board handoff's 30-passage expansion candidate | Coordinator supplement: original-checkout ignored `data/research/releases/scope2-website.v2.candidate.json`, SHA-256 `980b252aa189aa4df4a2e7a279841d72852f5742c8b5e1ca23a36468c3af7661`, exactly 30 passages, status candidate. | No approved passage/source/extraction IDs; independent source QA and GHGP rights disposition pending. Excluded from M69. These 30 passages are not a subset count of the 97 source records. |

The separate committed `data/research/releases/scope2-passages.v1.json` is 49,301 bytes with SHA-256 `62860478454f5537a3055a40ae1283fa567a39db75989409dc55cc33bd3577c7`. Prior QA found its normalized 18-passage array equivalent to the website release, but it is a different full artifact. The composed runtime hard-codes source release SHA-256 `38f91c...`, and the 24-unit catalog binds that same value. Substituting `scope2-passages.v1.json` therefore fails the composed identity contract even though its passage content is equivalent.

### Local immutable loader binding

The source loader can validate the complete local lineage without making a cloud-corpus claim:

- Release path: `C:/Users/nimab/.codex/worktrees/7b4b/Neuvetra/data/research/releases/scope2-website.v1.json`; SHA-256 `38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f`.
- Allowed source root: `C:/Users/nimab/Neuvetra/research-sources`.
- Retained original: `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-electricity-emissions-2023.pdf`; 396,931 bytes; SHA-256 `14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3`.
- Retained normalized extraction: `C:/Users/nimab/Neuvetra/research-sources/2026-09-08-scope2-pilot/epa-electricity-2023-normalized-pages-v1.json`; 31,214 bytes; SHA-256 `6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4`.

All four local artifacts existed and rehashed to those values during this review. This establishes local byte integrity only. It does not establish that the private cloud copy is current, that a provider can answer correctly or that the retained PDF still matches the origin byte for byte.

## Freshness and rights recheck

The live [EPA Scope 1 and Scope 2 Inventory Guidance page](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance) was inspected on 2026-09-15 UTC. It identifies the purchased-electricity document as a 387.63 KB, December 2023 PDF, links the same canonical EPA URL recorded in the release and reports that the page was last updated on 2026-04-02. The [direct EPA PDF](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf) resolved as a 19-page document whose cover identifies December 2023. The web inspection did not expose origin bytes for a fresh hash comparison, so the local retained SHA-256 must not be described as freshly matched to EPA.

EPA's [copyright-status disclaimer](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers), reported updated 2025-12-22, says EPA-site documents may be freely distributed and used for noncommercial scientific and educational purposes, while commercial use may be protected and individual documents can carry different conditions. It also warns that permission is required for copyrighted items not produced by EPA. No more specific permissive commercial notice was found on the source page or inspected PDF. That supports retaining the existing internal-review disposition; it does not clear public or commercial reuse, full-document model processing, customer display or redistribution.

EPA's current publication page continuing to link the same edition is a useful freshness observation, not a new release approval. The operational deadline still controls. A run that cannot finish before it, or any later run, must fail closed until an independent review renews the exact purpose, rights, publisher edition, origin relationship and all downstream processing terms.

## Small question and locator map

The exact terminal label remains a product/evaluator contract. Because each selected passage has a qualification, affirmative answers should be `qualified`; unsupported conclusions should contain no claims, evidence or sources.

| Priority | Frozen candidate question | Expected behavior | Approved support and exact locator | Required material points and limits |
| --- | --- | --- | --- | --- |
| **P1 — recommended one-question live internal canary** | **For a yearly purchased-electricity report, what source records should we collect for electricity entering a facility, and what should we check if both a commodity supplier and the local utility invoice the same consumption?** | `qualified`; likely U04 + U05 | S03 and S04, both **PDF page 7 / printed page 4** | State that activity data are purchased electricity during the reporting year; utility bills or other purchase records can provide it; facility-entry information is preferred to potentially incomplete internal submetering; where supplier and delivery invoices cover the same consumption, EPA recommends the local utility's metered consumption and excluding the supplier duplicate. Do not assess actual records, estimate missing consumption or claim the report/inventory is complete. |
| P2 — offline record-format variation | What electricity quantity units should our report preserve from utility bills or other purchase records? | `qualified`; U06 | S05, **PDF page 8 / printed page 5** | kWh and MWh are common electricity activity units. No conversion, calculation, steam/heat/cooling method or unit correctness finding for an actual record. |
| P3 — offline factor-provenance variation | What dates and publication routes should a reviewer record before treating a U.S. grid factor as current for a purchased-electricity report? | `qualified`; U10 + U17 + U20 + U21 | S09, **PDF page 9 / printed page 6**; S16, **PDF page 12 / printed page 9**; S18, **PDF page 17 / printed page 14** | Distinguish publisher edition, factor data period, calculation date and inventory period; note EPA's eGRID/Factors Hub routes and possible update lag; preserve timing/averaging limitations. Do not state a current edition or value, select a factor, quantify uncertainty or make a universal reporting rule. |
| P4 — offline boundary check | Our worksheet has all twelve electricity months. Does that prove our company GHG inventory is complete and satisfies California reporting law? | `unsupported / coverage_missing`; empty claims/evidence/sources | None in S01-S18 for this requested conclusion | Full electricity coverage is not whole-inventory completeness. The approved corpus contains no California current-law/applicability authority. Related background must not be shown as a complete answer. |
| P5 — offline action check | Use our bill and ZIP code to choose the current eGRID factor and calculate the report's emissions. | `unsupported / action_out_of_scope`; empty claims/evidence/sources | None for the requested selection/calculation | S03 and S10 contain general record/lookup routes, but the requested customer-record diagnosis, facility lookup, numerical factor selection and calculation are expressly excluded. Context cannot cure the missing authority/action boundary. |

P1 is preferable to a broad factor question because it has short, direct, same-page evidence and reflects the current worksheet/report journey. It is still a recombination/regression inside the known S01-S18 semantic space, not evidence of novel generalization. Preserve the exact question and evaluator expectations outside the model-visible payload if used as a canary.

## What M43-M52 establish

| Milestones | Source-relevant conclusion |
| --- | --- |
| M43 | Independent offline readiness passed for the EPA-only S01-S18 boundary. It did not authorize a live run, private customer pilot, source expansion or release. |
| M44-M45 | M44 made zero provider requests because the browser origin failed closed. M45 repaired that origin path offline. Neither event identifies a source-content gap. |
| M46-M47 | M46 H01 gave the expected supplier-product explanation from S12 with dependencies S11/S15. H04 withheld a district-steam factor/calculation but failed the frozen reason-code contract, and permit provenance also failed. M47 repaired classification/launch controls offline. These were semantic/runtime/provenance defects, not evidence that extra sources were required. |
| M48-M49 | M48 found no remaining M43 case materially novel inside the approved semantic space; H02 was a W02/W09 recombination. M49 correctly labeled and prepared it as a regression. This cautions against calling any new same-corpus wording a novel held-out test. |
| M50 | One authorized H02 analyze request settled at `$0.033685` and failed closed after provider output validation. The adapter discarded the finite diagnostic subtype, and wrapper bookkeeping contradicted the real one-request record. No result supports a source expansion. |
| M51-M52 | Provider-disabled repairs preserved diagnostic/closure evidence, then exercised the compiled launcher and actual composed service through a successful three-stage synthetic path plus bounded failures. They establish offline integration behavior only, not live compatibility or answer quality. |

The evidence therefore supports testing one narrow record/report answer against the actual composed service. It does not support describing the test as novel held-out coverage, using a broad cloud catalog, or expanding sources in response to old runtime failures.

## Demonstrated gaps and next source decisions

No new source is needed to answer P1-P3 within their limits. Real source work becomes necessary only when the product outcome requires one of these unsupported conclusions:

1. **Current numerical eGRID factor and facility assignment:** approve the exact current EPA data release, technical guide/revisions, geography mapping, data year, rights and deterministic factor path. The 97-record catalog does not do this.
2. **Customer bill or report diagnosis:** define authorized customer-data handling and evidence provenance; the EPA passages can describe record categories but cannot authenticate or reconcile a customer's documents.
3. **Instrument, contract or supplier-factor eligibility:** approve the missing quality criteria and applicable hierarchy/fallback evidence. S11-S15 deliberately withhold those determinations.
4. **Whole-inventory or filing completeness:** approve program-specific primary law/guidance for the entity, jurisdiction and reporting/data year. This EPA conceptual guidance is not current-law authority for California or U.S. customer reports.
5. **Commercial/public RAG use:** obtain a documented rights basis or rights-holder permission for the precise copying, embedding, model processing, retention, excerpt display and distribution. The present internal approval is insufficient.

For any proposed expansion, first freeze the business question and expected user outcome, then identify only the passages needed to answer it. Record canonical URLs, versions/dates, exact locators, source and extraction hashes, dependencies, qualifications, exclusions, rights for the actual provider/display path and an independent source review. Do not promote all 97 catalog records or the unapproved 30-passage candidate to runtime as a shortcut. The candidate and M43's cited `docs/research/website-source-use-review-07.md` rights HOLD are retained only in the original checkout; see the coordinator supplement below. They are not silently copied into the active corpus.

## Limits

This review used live official EPA pages plus repository evidence. It did not download new source bytes, change a release, inspect secrets, call a model/provider, run the proposed canary, access customer data, approve a paid action or authorize deployment/publication. It supplies no legal or accounting opinion. CPO owns the user outcome; independent Astra/high QA must challenge the exact proposed run and any later release decision.

## Coordinator source-location supplement

The initial source specialist searched the committed worktree and did not locate the 30-passage candidate. The coordinator subsequently inspected the original checkout, where the ignored candidate exists at C:/Users/nimab/OneDrive/Documents/ChatGPT/Neuvetra/data/research/releases/scope2-website.v2.candidate.json. Its review has no reviewer or reviewed_at, no approved passage/source/extraction IDs, and status pending_independent_source_qa_and_rights. EPA retains its earlier private scope; GHGP Scope 2 2015 is hold_pending_permission_or_qualified_rights_disposition. The original-checkout docs/research/website-source-use-review-07.md records the September9 independent rights HOLD. This is retained historical evidence, not a new rights determination. The candidate remains excluded. It is a 30-passage proposed expansion, not a subset count of the 97 source records. No candidate bytes were copied or activated. Independent final review must include this supplement.

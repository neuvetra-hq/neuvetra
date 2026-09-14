# Website source condition inventory

The [reviewed condition catalog](../../data/research/conditions/scope2-website.v1.json) records 36 source conditions, boundaries and modality requirements across all 18 approved EPA passages. It is a separate review-policy artifact; the source release and its passage text, dependencies, rights scope and expiry remain unchanged. This inventory is intended to make the reviewer explicitly assess relevant conditions instead of relying on it to recall them from context.

Author: regulatory researcher `/root/terrascope_review`, reporting to the coordinator as CPO/CTO. Author checks: September 9, 2026, approximately 08:14 UTC. **Status: independently approved for the existing private website source-review policy scope.** Independent AI QA `/root/site_review` approved exact catalog bytes `063adbadbe9c70493a81228931c4e4ec4a833633d12c83e2ab48616bd876d2c6` at **2026-09-09T08:17:15Z** after reviewing all 18 paragraphs and 36 unique conditions/quotes, including the corrected S13-C03 trigger. This is not qualified human, commercial or public approval. The author did not approve its own catalog, change the runtime, read held-out probes before authoring/freeze or make model/cloud calls for this task. The field `reviewed_passage_ids` records complete inventory coverage; independent approval is bound separately to these exact bytes.

| Artifact | SHA-256 |
| --- | --- |
| Independently reviewed catalog, 22,371 UTF-8/LF bytes | `063adbadbe9c70493a81228931c4e4ec4a833633d12c83e2ab48616bd876d2c6` |
| Unchanged approved website source release | `38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f` |
| Original EPA December 2023 PDF | `14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3` |
| Retained normalized-page extraction | `6c0dd2224703fa7bd48f6a18a666d3a29212d2435f6348382cef76950ffb36a4` |

The primary document is [EPA's purchased electricity inventory guidance](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf), December 2023. Exact source identity, locators, extraction contract, current publisher checks and private hosted-processing disposition are in the [source release brief](website-source-release.md) and [approved release](../../data/research/releases/scope2-website.v1.json). This task reread all 18 immutable paragraphs and their context/dependencies; it adds no new current-law or current-factor assertion.

## Coverage and interpretation

`source_quote` is an exact contiguous substring of the named passage, preserving normalized punctuation and whitespace. Its locator is the corresponding immutable passage locator and span record. `applicability` is an authored explanation of when that quoted condition matters and what meaning must be retained. It is not an EPA quotation, an additional legal duty or a substitute for the full paragraph and its dependencies.

The inventory covers conditional prerequisites, accounting/input boundaries, recommendation strength and qualified descriptions. These are different kinds of limits; listing them together does not turn every descriptive sentence into an eligibility rule. The table records the intended kind and complete passage review coverage.

| Passage / PDF page | Conditions | Kind and material meaning |
| --- | --- | --- |
| S01 / 4 | C01-C03 | Incomplete guidance coverage; `should` dual reporting; different accounting bases. No inferred universal legal duty or attributed policy motive. |
| S02 / 9 | C01 | Both methods and clearly labeled results, retaining recommendation modality. |
| S03 / 7 | C01-C02 | Reporting-year purchased amount, usable purchase records, preference for facility-entry data and possible sub-meter incompleteness. |
| S04 / 7 | C01 | Same-electricity commodity/delivery invoice scenario, local-meter recommendation and avoiding duplicate consumption. |
| S05 / 8 | C01 | Common electricity units, without an exclusive-unit requirement or conversion rule. No separate claim-eligibility prerequisite is stated here. |
| S06 / 8 | C01 | Generation-only factor boundary and `should not include` losses/upstream emissions. |
| S07 / 9 | C01 | Grid-delivered electricity premise, facility geography and recommended regional/subnational averages. |
| S08 / 9 | C01-C02 | Recommended U.S. total-output subregion factor category; qualified descriptions of subregion geography and resource mix. |
| S09 / 9 | C01 | Possible lag between eGRID and Hub publication; a dated paragraph cannot verify a live version. |
| S10 / 10 | C01 | Optional Power Profiler route and its zip-code/utility inputs. No separate claim-eligibility prerequisite or completed lookup is established. |
| S11 / 10 | C01-C02 | Contractual/specific-source basis and ordering of factor types; not recognition of a supplier label or ranking of individual claims. |
| S12 / 10 | C01-C02 | Supplier may provide product information; usable factor must include all delivered own-generated and purchased electricity. |
| S13 / 10 | C01-C03 | Certificate carries a factor; quality review must establish claimability; source/resource-specific and qualified factor descriptions. |
| S14 / 10 | C01-C05 | No-certificate premise, applicable quality review, conveyance by issued certificates, conditional bundled claim and loss of claim after sale. |
| S15 / 11 | C01-C03 | Reporting/agreement alignment, covered-portion limits and possible multiple agreements or gaps. |
| S16 / 12 | C01-C03 | Generation period and ordinary updates; newest-at-calculation recommendation including the footnote; limited non-methodology recalculation exception. |
| S17 / 12 | C01 | Methodology changes and prior-year adjustment consistent with the organization's base-year policy. |
| S18 / 17 | C01-C03 | Imperfect grid averages, possible additional year-mismatch uncertainty and possible stale eGRID data. |

All 18 passages were inspected, including S05 and S10, which have descriptive modality/input limits but no separate claim-eligibility prerequisite. The inventory does not manufacture an eligibility condition for those passages. Row IDs are globally stable `Sxx-Cnn` identifiers, not question identifiers. Overlapping quotes are intentional where one paragraph establishes distinct limits; for example, S16 separately records factor-timing advice and the limited reason prior years need not be adjusted.

S13/S14 require particular care. The source says to refer to quality criteria **to ensure claimability**, rather than treating possession, a contract or bundling as sufficient. An assertion of permission to claim a factor must retain that material prerequisite in the relevant claim. A detached warning, another claim or the mere presence of the full condition in retrieved context cannot repair an unconditional entitlement. The inventory does not enumerate or certify the complete Section 4 criteria; those copied GHG Protocol criteria remain outside approved AI evidence. Dependency closure continues to supply the reviewed context.

Independent QA identified that a broad S13-C03 trigger could unnecessarily require quantitative examples when an answer only discusses what a certificate represents. The revised applicability separates the specific-source basis from conditional resource/value descriptions: the typical/may and non-zero qualifications apply only if the candidate makes those assertions. It never requires adding numerical examples or waives the numerical-output boundary. The source quote and all other catalog rows remain unchanged.

The S14 fallback sentence remains quoted faithfully because it is part of the source condition. Its inventory entry does not authorize company-specific fallback selection. Likewise, numerical descriptions within S13 remain source evidence, not permission to output numerical factors. Existing numerical, legal, individual-eligibility and current-version exclusions continue to apply independently.

## Validation and release boundary

Author checks verified the pinned source release, strict top-level/row fields, all 18 reviewed IDs, unique condition IDs, nonempty applicability and exact contiguous quote membership for all 36 rows. UTF-8/LF bytes and the original/extraction hashes were checked. No source/extraction/release content was changed. Independent QA challenged the applicability interpretations and material coverage, confirmed the corrected S13-C03 condition, and bound its disposition to the unchanged final catalog bytes above. Runtime integration and live answer-quality results remain separate gates.

The strict catalog intentionally carries no mutable approval, author or expiry fields. The coordinator's reviewed byte pin and the independent QA record provide that provenance. The existing source review deadline remains **2026-09-15T23:20:32Z**; this is an operational review deadline, not a regulatory date or an extension granted by this catalog. The inventory has no validity beyond its pinned source's approved scope and deadline.

The proposed reviewer contract must explicitly assess applicability and preservation for the relevant condition rows using each claim's own cited passages and dependency closure. Quotation membership and complete row coverage can be checked mechanically; whether a condition applies and whether the answer preserves it remain semantic judgments. This catalog cannot guarantee correct answers or eliminate false acceptance. Omitted-condition failures remain meaningful even when the answer quotes another part of a supported paragraph correctly.

# M79 primary-rights candidate1 — independent regulatory/CPO review

Date observed: **2026-09-22**. Task `M79-RIGHTS-INDEPENDENT-REVIEW-01`; reviewer `/root/m79_rights_review`; regulatory-research role reporting to CPO for independent review. Requested route `gpt-5.6-sol/high`; observed model and effort are unavailable. Role prompt SHA-256 `b8302825b83953d49d2783538b424498348aa20f322b1c2c1c0b5e011145a7f2`. The reviewer did not author the rights candidate, accepted source inventory, retained originals or calculation methods.

## Verdict

**Fail candidate1 for acceptance; preserve it unchanged and prepare candidate2.** The candidate correctly accounts for seven originals, separates all three intended-use classes, retains the exact source notices, and keeps rights approval, production release and Scope 1 completion false. Two material evidence defects remain:

1. it presents a superseded 2014 Copyright Office Compendium as current official guidance; and
2. several use-state labels and reasons blur Neuvetra's conservative release hold with a source-specific legal prohibition or a requirement to obtain a copyright license, especially for individual numbers, facts and independently expressed methods.

No publisher contact, permission request, legal determination, source/corpus release, production approval or product/runtime change was made. This review is evidence QA and product-gate advice, not legal advice or professional approval.

## Exact reviewed version and passing checks

- Candidate JSON SHA-256 `c240ac44007d7e15dfde9753e4850184d06ecb9f24ea0f1bf59f362d91d162d6` and Markdown SHA-256 `accf29230a60d8d71147bf68777752b5039a8b39d9142f03bb298b15e36c0215` match both the live files and the embedded texts in author snapshot SHA-256 `0e985ae418cadb22cb5b9d2149bbae2046cfe843b2e37f2178f22911f2361314`.
- The JSON contains exactly seven unique artifact IDs. Every artifact has distinct `numericalCalculationAndDerivedValues`, `excerptOrReportRedistribution`, and `hostedFulltextCorpusOrRag` entries with an owner action. All candidate verdict flags for rights approval, production release and Scope 1 completion remain false.
- All seven retained originals were independently rehashed. Their byte lengths and SHA-256 values match the accepted inventory: EPA Hub XLSX `43afb91d…a668a7`, EPA Hub PDF `5d07c678…caf924`, stationary guidance `9e9899f7…9c124`, mobile guidance `f80e3400…804402`, fugitive guidance `fb3dd5c9…8d88`, GHG amendment `2bc8b42d…a3a7f`, and Corporate Standard `cfcda4dd…c0fe3c`.
- A read-only search of every textual OOXML package entry found no explicit rights notice in the retained EPA workbook. Full text and metadata inspection found no explicit copyright/license notice in the five retained EPA Hub PDF pages or in all 19/16/20 pages of the stationary/mobile/fugitive guidance PDFs. Absence of a notice supplies neither permission nor a restriction.
- The current official EPA Hub page states that the Hub was designed for organizational GHG reporting and links the 2025 XLSX/PDF. The three official guidance URLs open as 19/16/20-page December 2023 documents. The mobile document's exact retained title and PDF metadata use singular **“Direct Emissions from Mobile Combustion Source”**; the candidate JSON preserves that exact source fact.
- The retained February 2013 amendment, physical PDF page 9, states exactly: `Copyright © World Resources Institute and World Business Council for Sustainable Development, March 2013` and `Creative Commons Attribution-NonCommercial-NoDerivative Works 3.0 License`, with the BY-NC-ND 3.0 URL.
- The retained Corporate Standard, physical PDF page 114 / printed page 112, encourages use by corporations and organizations, assigns responsibility for reports based fully or partly on the Protocol to their producers, and prints the March 2004 WRI/WBCSD copyright notice. It states no reproduction license.

## Material findings and required corrections

### F01 — superseded Compendium cannot support the current-evidence claim

The candidate's `E04_copyright_office_numbers` and Markdown primary-evidence table cite the December 22, 2014 Compendium (`compendium-12-22-14.pdf`, §707.1, PDF pp. 385–386). The Copyright Office's current Compendium page says the **January 28, 2021** update is its governing administrative manual and identifies older editions as archived. The substantive rule remains supported, but by the current source: 2021 Compendium, Chapter 700, §707.1, PDF pp. 8–9. It says individual numbers and values expressed in individual numbers are not copyrightable; it separately explains that creative selection/coordination/arrangement may support a compilation and that the derivation process or expertise is not expressed in a number alone.

Required candidate2 correction:

- replace the 2014 title, URL and page locator in JSON and Markdown with the official 2021 Compendium landing page plus `https://www.copyright.gov/comp3/chap700/ch700-literary-works.pdf`, §707.1, PDF pp. 8–9;
- cite the current text for both halves of the distinction: individual numbers/facts/processes versus copyrightable expression or sufficiently creative compilation arrangement; and
- do not describe the archived 2014 edition as current official evidence.

### F02 — distinguish an internal release hold from a legal prohibition or licensing requirement

The candidate repeatedly uses states such as `unresolved_commercial_use_blocked`, `blocked_noncommercial_license_and_terms_require_resolution`, `blocked_terms_conflict_requires_permission_or_qualified_counsel`, and `blocked_by_current_terms_no_fulltext_permission`. Its Markdown similarly says no source-specific commercial license was found and that commercial use is prohibited. Although the introduction calls `BLOCK` a fail-closed product state, the source-specific state names and reasons can still be read as conclusions that commercial use of a number, fact or method requires permission.

That conclusion is not established by the inspected evidence:

- Current Copyright Office guidance states that an individual number does not reveal copyrightable expression and that facts, procedures, processes and methods are outside copyright protection. Compilation expression can be protected, but that does not make each independently used value protected.
- The EPA disclaimer page calls itself a catalogue that does **not necessarily apply to a particular work** unless EPA explicitly incorporates it by direct reference or hyperlink. No incorporation or source-specific rights term was found in the exact retained EPA files or the Hub publication page. Its statement that commercial use “may” be protected is contextual caution, not proof that any of these five sources or their individual values are protected or require a license.
- Section 105 excludes a qualifying U.S.-government work from domestic copyright. The statutory notes define the employee/official-duty boundary and deliberately avoid an unqualified contractor/grantee exclusion. The retained files do not establish complete authorship provenance, so source classification remains unresolved; government hosting proves neither public-domain status nor private copyright.
- BY-NC-ND 3.0 restricts exercise of the licensed reproduction/distribution rights for a commercial purpose. Its deed says the license need not be followed for public-domain elements or uses allowed by an exception, and its legal code preserves uses free from copyright. The license therefore supports a restriction on commercial exercise of licensed rights in the copyrightable amendment as a work; it does not prove that an individual GWP value, fact or independently expressed process requires a copyright license.

Required candidate2 correction:

- use a state such as `neuvetra_release_hold_pending_source_specific_rights_decision` for every unresolved product decision; record separately whether the source contains an express term, whether that term applies to the exact intended act, and whether legal effect remains unresolved;
- for EPA numerical use, say that no source-specific restriction or permission was established, that individual facts/numbers may be used without exercising compilation/expression rights, and that **Neuvetra** still withholds release pending provenance, exact-copying and non-copyright issues. Do not make absence of a license the reason a number is held;
- for EPA excerpts and corpus use, retain the internal block because the planned copying/extraction has not been scoped or approved, while stating that the generic disclaimer is context only and does not establish source-specific protection;
- for the amendment, state that the exact BY-NC-ND 3.0 notice governs licensed use of the copyrightable work. Keep commercial reproduction/distribution unapproved, but preserve the license's public-domain/exception boundary and leave the precise fact/process boundary to qualified review; and
- for the Corporate Standard, retain the exact purpose/copyright facts, but separate reports based on independently implemented principles from copying text, tables, figures or branding.

### F03 — current website terms are evidence, but their historical-publication applicability is unresolved

The February 2023 GHG Protocol Terms of Use say they govern access to and use of the Websites and online Services, including content offered through those Services. They prohibit scraping/extraction and public/commercial reproduction, archiving and distribution of Services or GHG Protocol Content, subject to stated exceptions. The candidate's shared E05 entry acknowledges that whether those terms govern a historical download or noncopyrightable element is a qualified question. The artifact-specific state labels then overstate that unresolved evidence as `blocked_by_current_terms` or say current terms prohibit the exact historical source use.

Required candidate2 correction:

- keep the 2023 terms as current web-access/service evidence and retain the permission route;
- label their application to the retained 2004/2013 PDF bytes, pre-existing license, individual facts and independently implemented principles as unresolved rather than as an established source-specific legal prohibition; and
- base the amendment's definite license observation on its printed BY-NC-ND 3.0 notice, while treating the Corporate Standard's printed copyright/purpose language and current web terms as distinct evidence layers.

## Authoritative evidence reopened

- EPA Disclaimers, opening applicability paragraph and `Copyright Status`, observed 2026-09-22; page last updated 2026-09-21: https://www.epa.gov/web-policies-and-procedures/epa-disclaimers
- EPA GHG Emission Factors Hub, purpose paragraph and 2025 download row; page last updated 2026-01-12: https://www.epa.gov/climateleadership/ghg-emission-factors-hub
- 17 U.S.C. §105(a) and House Report notes on official-duty employee works and contractor/grantee works: https://www.govinfo.gov/content/pkg/USCODE-2024-title17/pdf/USCODE-2024-title17-chap1-sec105.pdf
- Current Copyright Office Compendium status and citation: https://www.copyright.gov/comp3/ ; 2021 Chapter 700 §707.1: https://www.copyright.gov/comp3/chap700/ch700-literary-works.pdf
- GHG Protocol Terms of Use, §§1, 3 and 4: https://ghgprotocol.org/terms-use ; permission route: https://ghgprotocol.org/contact-us
- CC BY-NC-ND 3.0 deed and legal code, including public-domain/exception boundary and §§2–4: https://creativecommons.org/licenses/by-nc-nd/3.0/ and https://creativecommons.org/licenses/by-nc-nd/3.0/legalcode
- Current official amendment and Corporate Standard PDFs/pages: https://ghgprotocol.org/sites/default/files/2022-12/Required%20gases%20and%20GWP%20values_0.pdf , https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf , and https://ghgprotocol.org/corporate-standard

The browser could inspect the current PDF text and page counts but did not produce current remote-byte hashes; the XLSX endpoint was linked by the current Hub page but its binary content type was not inspectable through the browser tool. The retained local originals were fully rehashed. Candidate2 must continue to distinguish retained-byte identity from a fresh remote-byte identity claim.

## Re-review gate

Preserve author candidate1 snapshot `0e985ae418cadb22cb5b9d2149bbae2046cfe843b2e37f2178f22911f2361314`. The author should produce a new candidate2 JSON, Markdown and immutable snapshot implementing F01–F03. Targeted independent re-review should verify the current 2021 citation, read every use-state/reason/required-decision tuple, and confirm that each `BLOCK` is explicitly Neuvetra's release policy unless a quoted source-specific term supports a narrower legal restriction. Root remains the sole admission owner.

## Candidate2 targeted re-review — preserved second fail

Targeted re-review date: **2026-09-22**. Candidate2 JSON SHA-256 `60f5030f545d0199f36cc75e61a1e53504a4c3a5e6c803d9db91a1d77a182041`, Markdown SHA-256 `5bfff53a39cf2840834d390d2bbc3de3654726f0253e024de263a03980415f00`, and author snapshot SHA-256 `b25086ff944a95c3a45dffbd5d16da3a1b257051135ede7ac7d230415bece91a` match exact live and embedded bytes. The author run records rework cycle 1, preserves the candidate1 failure, binds candidate2 as its only current artifact, keeps three findings open pending this review, and retains observed compute as unknown.

**Fail candidate2 for one narrow evidence-locator defect; F01–F03 are substantively repaired.** Preserve candidate2 and create candidate3 rather than overwriting either author snapshot.

### Repaired findings

- **F01 passes.** Candidate2 replaces the archived 2014 source with the Copyright Office's current Compendium landing page and the January 28, 2021 Chapter 700, §§707–707.1, PDF pp. 7–9. The official landing page still identifies the 2021 update as the governing administrative manual. Section 707.1 still distinguishes individual numbers from sufficiently creative compilation selection, coordination or arrangement.
- **F02 passes.** All 21 intended-use entries now use `neuvetra_release_hold_pending_source_specific_rights_decision`. Every artifact separately records an express-source-term observation, applicability, unresolved legal effect and Neuvetra product policy. EPA numerical rows do not infer a licensing requirement for individual facts or numbers; excerpt/corpus rows do not infer source-specific protection from the generic disclaimer. The verdict expressly keeps source-specific legal prohibition and a licensing requirement for individual facts/numbers/independently expressed methods false.
- **F03 passes.** Candidate2 treats the February 2023 GHG terms as current web-access/services evidence and leaves their application to retained 2004/2013 PDF bytes, the amendment's printed license, individual facts/numbers and independently implemented principles unresolved. It bases the amendment-specific observation on its printed BY-NC-ND 3.0 notice and keeps Corporate Standard purpose/copyright evidence separate.
- The seven retained hashes, exact source notices and no-notice observations did not change. Candidate2 still has seven unique artifacts, 21 use entries, all three release-use verdicts false, rights approval false, production release false and Scope 1 completion false. No source, method, corpus or product release is implied.

### F04 — CC carveout claim lacks its exact recorded locator

Candidate2 correctly states that BY-NC-ND 3.0 preserves public-domain elements and uses allowed by exceptions or limitations. Independent reopening confirms the source support: the deed places that qualification under **Notices**, and the legal code states it in **§2, Fair Dealing Rights**. Candidate2's machine-readable `E07_cc_by_nc_nd_3.locators` instead lists only:

- `Deed: You are free to Share`;
- `Deed: NonCommercial`;
- `Deed: NoDerivatives`; and
- `Legal Code sections 3-4`.

Those locators support the license grant/restrictions but not the material carveout used to avoid a blanket licensing claim. The URLs are authoritative and the proposition is accurate, but the regulatory-research gate requires the supporting section locator for each material conclusion.

Required candidate3 correction:

1. add `Deed: Notices` and `Legal Code section 2, Fair Dealing Rights` to `E07_cc_by_nc_nd_3.locators` in the JSON;
2. mirror those exact locators in the Markdown evidence row or adjacent source note; and
3. preserve all candidate2 substance, all product-release holds, first-fail history and the distinction between licensed rights in the copyrightable work and public-domain/exception uses.

No unaffected EPA, §105, GHG terms, source-notice, artifact-matrix or release-gate research needs repetition. Targeted candidate3 re-review need only verify the two new locators, exact frozen hashes and unchanged F01–F03 repairs. Root remains the sole admission owner.

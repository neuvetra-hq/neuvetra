# GHG Protocol publication refresh — September 8, 2026

**The ten GHG Protocol documents in today's 47-file research bundle still match the current publication links and editions checked.** The inherited November 2025 repository has gaps, but its age does not make every document obsolete. This refresh added **28 previously missing artifacts: 16 PDFs and 12 official-page snapshots**. Some are older supporting documents; others record developments after the legacy checkout. None is approved for the application corpus.

Checked September 8, 2026; final collection timestamp **21:53:07 UTC**. Scope: GHG Protocol corporate inventories, Scope 2, Scope 3, amendments, supporting guidance and relevant standards-development/land-sector transitions. This is a publication and version review, not a complete technical review of every accounting provision.

## Baseline and evidence

The comparison used the 1,220-entry [legacy inventory](legacy-source-inventory.csv), the inherited `rag-pipeline` checkout dated November 4, 2025, and the **47 files downloaded earlier today** in [downloaded-sources.json](downloaded-sources.json), [calculation-extra-downloads.json](calculation-extra-downloads.json) and [california-downloads.json](california-downloads.json). Their earlier independent integrity review is [source-integrity-check.md](source-integrity-check.md).

The [refresh manifest](ghg-protocol-refresh-downloads.json) records exact canonical/final URLs, retrieval times, versions, publication classifications, local paths, byte sizes and SHA-256 hashes. Its `sources` array contains only the 28 new artifacts; `checks` records the ten existing-file comparisons. All entries retain `rights_review: pending` and `runtime_approval: not_approved`. A `legal_status` value describes publication status; it does not assert legal adoption.

All 28 new files exist, have unique hashes, match their recorded sizes/hashes and pass the applicable PDF or HTML checks. Total: **13,198,093 bytes and 679 PDF pages**. There are **zero failed or partial download entries** and **zero exact hash matches** against the legacy inventory. This does not prove their information was absent from every parsed or differently formatted legacy document. All are GHG Protocol publications or official page snapshots; one page is hosted by its linked technical-assistance service on Zendesk.

For the existing ten files, this refresh checked the current publication-page link and edition plus the already-downloaded file's local hash. It **did not fetch another copy to compare current origin bytes**. The earlier bundle's Corporate Standard and August 2024 GWP PDF are byte-identical to legacy originals; that is evidence of continuity, not a reason to discard them.

## Current published standards and guidance

| Document family | Current publication found | Comparison with today's bundle |
| --- | --- | --- |
| Corporate Standard | Revised Edition, 2004; February 2013 required-gases/GWP amendment | Both already present; current links/editions and local hashes match. [Publication page](https://ghgprotocol.org/corporate-standard). |
| Scope 2 | Scope 2 Guidance, 2015; correction sheet listed December 2022 | Both already present and unchanged by this check. [Publication page](https://ghgprotocol.org/scope-2-guidance). |
| Scope 3 | Corporate Value Chain Standard, 2011 | Standard already present; missing May 2013 correction sheet and June 2022 detailed FAQ added. [Publication page](https://ghgprotocol.org/corporate-value-chain-scope-3-standard). |
| Scope 3 calculations | Technical Guidance, version 1.0, 2013 | Already present; current link/edition matches. [Publication page](https://ghgprotocol.org/scope-3-calculation-guidance-2). |
| GWP reference | GHG Protocol summary, version 2.0, August 7, 2024 | Already present. The technical-assistance page was updated March 20, 2026, but still links the August 2024 PDF; webpage update time is not the factor-document version. [Official reference page](https://ghgptechassistance.zendesk.com/hc/en-us/articles/47400887336724-Global-Warming-Potential-Values). |
| Land Sector and Removals | Standard version 1.1, June 30, 2026; Guidance version 1.0, June 2026; v1.0-to-v1.1 change summary | All three already present. Standard takes effect January 1, 2027. [Standard](https://ghgprotocol.org/land-sector-and-removals-standard), [Guidance](https://ghgprotocol.org/land-sector-and-removals-guidance). |

No published final replacement for the Corporate, Scope 2 or Scope 3 standards was established in the checked official publication/process pages. GHG Protocol's current process page says the existing standards and guidance remain in effect until it communicates otherwise. Draft material must not silently replace them. [Update process](https://ghgprotocol.org/ghg-protocol-corporate-suite-standards-and-guidance-update-process).

The GWP summary does not itself resolve which assessment report or time horizon a particular U.S./California reporting program requires. Preserve the program, reporting year, gas, GWP basis and units when selecting factors. Likewise, Scope 2 inventory accounting and consequential electricity impacts answer different questions. The broader calculation limitations remain in [calculation-sources.md](calculation-sources.md).

## Changes and discrepancies that matter

**The development timetable changed on July 29, 2026.** The consolidated Standard Development Plan is **SDP version 2.0**, describing a future **Corporate Standard version 3.0**. It supersedes four December 2024 development plans and brings Corporate, Scope 2, Scope 3 and Actions and Market Instruments work into a harmonized GHG Protocol/ISO process. Its provisional milestones are an integrated public consultation in **Q2 2027** and final publication in **Q4 2028**. These are development targets, not an effective date or a new standard already in force. Earlier separate-track dates should not be presented as the current plan. [July announcement](https://ghgprotocol.org/blog/ghg-protocol-announces-key-standard-development-updates), [SDP v2.0, especially pages 1 and 14](https://ghgprotocol.org/sites/default/files/2026-07/Consolidated-StandardDevelopmentPlan%28SDP%29-2026.07.29.pdf).

**Official pages disagree about one consultation date.** The feedback-opportunities page still says AMI's formal public consultation is planned for Q3 2027; the dated July 29 FAQ and consolidated plan describe Q2 2027 for the integrated consultation. Use the newer dated plan as the planning baseline while retaining the discrepancy, rather than turning either estimate into a guaranteed deadline. [Feedback opportunities](https://ghgprotocol.org/feedback-opportunities), [July FAQ](https://ghgprotocol.org/blog/ghg-protocol-announces-key-standard-development-updates-faq-resource).

**Scope 2 consultation feedback has a newer correction.** The governance repository links **August 25, 2026, version 1.1**, while the July announcement/FAQ still link the July 29 version 1.0. The new 128-page report includes a corrections log on pages 127–128 covering tables, figures and respondent counts. Both versions were preserved and explicitly related in the manifest. Version 1.1 supersedes v1.0 as the full feedback summary; neither establishes new accounting requirements. [Governance repository](https://ghgprotocol.org/standards-development-and-governance-repository), [corrected feedback v1.1](https://ghgprotocol.org/sites/default/files/2026-08/S2-PublicConsultationSummaryofFeedback-2026.08.25.pdf).

**Several gaps predate the legacy checkout.** The Scope 3 correction sheet changes the Company C/D emissions example in Table 5.6 and removes an inappropriate use of “materiality” in the threshold discussion. It explains that electronic and printed versions differ. Corrections therefore need their own citations and edition associations; do not assume every inherited extraction incorporates them. [Scope 3 corrections](https://ghgprotocol.org/sites/default/files/2022-12/List%20of%20Corrections%20for%20Scope%203%20Standard.pdf).

The Corporate publication page lists March 2004 beside two appendices, but the PDFs identify **Base Year Adjustments as January 2005** and **Leased Assets as version 1.0, June 2006**. The manifest uses the document's own version/date and records the page discrepancy. URL upload directories and webpage display dates must not override inspected document metadata. [Base-year appendix](https://ghgprotocol.org/sites/default/files/2022-12/Base%20Year%20Adjustments.pdf), [leased-assets appendix](https://ghgprotocol.org/sites/default/files/2022-12/Categorizing%20GHG%20Emissions%20from%20Leased%20Assets.pdf).

## Drafts, feedback and land-sector transition

| Publication or process | Status on September 8, 2026 | Treatment in an answer |
| --- | --- | --- |
| October 2025 Scope 2 and consequential-electricity consultations | Consultation closed January 31, 2026; feedback subsequently published | Label hourly matching, deliverability and other proposed revisions as proposals. Preserve the distinction between an inventory and consequential/avoided-emissions analysis. [Scope 2 proposal](https://ghgprotocol.org/sites/default/files/2025-10/GHG-Protocol-Scope2-Public-Consultation.pdf), [consequential proposal](https://ghgprotocol.org/sites/default/files/2025-10/GHG-Protocol-Consequential-Electricity-Sector-Emissions-Impacts-Public-Consultation.pdf). |
| Corporate Phase 1 progress, December 2025 | Working development material | Do not treat boundary/recalculation discussions or its earlier schedule as a published replacement. [Progress document](https://ghgprotocol.org/sites/default/files/2025-12/CS-Phase1-ProgressUpdate.pdf). |
| Scope 3 Phase 1 progress, March 31, 2026 | Explicit draft progress update, subject to change | Proposed category or coverage-threshold changes do not replace current Scope 3 requirements. [Progress document](https://ghgprotocol.org/sites/default/files/2026-03/S3-Phase1ProgressUpdate-20260331.pdf). |
| AMI White Paper, version 3, March 2026 | RFI ran March 31–May 31, 2026 and is closed; not a draft standard containing requirements | Do not use its proposed statements as current permission to net credits against scope inventories. No separate final AMI feedback report was identified in the checked pages. [White paper/RFI](https://ghgprotocol.org/sites/default/files/2026-03/AMI-Phase1-WhitePaper-RFI.pdf). |
| Land Sector and Removals | Published 2026 standard/guidance, standard effective January 1, 2027 | Check activity, sector and inventory-period applicability. These publications do not establish complete forest-carbon accounting coverage. [Standard page](https://ghgprotocol.org/land-sector-and-removals-standard). |
| Forest-carbon accounting RFI, June 2026 | Open; responses due February 1, 2027 | Evidence of an unfinished standards-development area, not a final forest-accounting method. [RFI, page 6](https://ghgprotocol.org/sites/default/files/2026-06/Forest-Carbon-Accounting-Request-for-Information.pdf). |
| Corporate TWG meeting 8, August 4, 2026 | Published working-group minutes | Supporting evidence of ongoing development; meeting material does not supersede a standard. [Minutes](https://ghgprotocol.org/sites/default/files/2026-08/CS-Meeting8-Minutes-20260804.pdf). |

## Exact new files

All raw artifacts are under `C:/Users/nimab/Neuvetra/research-sources/2026-09-08-refresh/ghg-protocol/`. Exact URLs, sizes and hashes are in the [manifest](ghg-protocol-refresh-downloads.json); files were written without overwriting the earlier bundle or legacy repository.

| PDF filename | Edition/status identifier |
| --- | --- |
| `ghgp-scope3-corrections.pdf` | Corrections listed May 2013 |
| `ghgp-scope3-detailed-faq.pdf` | June 2022 |
| `ghgp-base-year-adjustments.pdf` | January 2005 |
| `ghgp-leased-assets.pdf` | v1.0, June 2006 |
| `ghgp-corporate-phase1-progress.pdf` | December 2025 development material |
| `ghgp-consolidated-development-plan.pdf` | SDP v2.0, July 29, 2026 |
| `ghgp-scope2-consultation.pdf` | October 2025 proposal |
| `ghgp-consequential-electricity-consultation.pdf` | October 2025 proposal |
| `ghgp-scope2-feedback.pdf` | v1.0, July 29, 2026; superseded feedback |
| `ghgp-scope2-feedback-20260825.pdf` | v1.1, August 25, 2026; corrected feedback |
| `ghgp-scope2-feedback-executive-summary.pdf` | July 29, 2026 executive summary |
| `ghgp-consequential-electricity-feedback.pdf` | July 29, 2026 feedback |
| `ghgp-scope3-phase1-progress.pdf` | March 31, 2026 development material |
| `ghgp-ami-phase1-white-paper.pdf` | v3, March 2026 RFI |
| `ghgp-forest-carbon-rfi.pdf` | June 2026 RFI |
| `ghgp-corporate-twg-20260804.pdf` | Meeting 8, August 4, 2026 |

The twelve HTML snapshots are `ghgp-corporate-current-page.html`, `ghgp-scope2-current-page.html`, `ghgp-scope3-current-page.html`, `ghgp-scope3-calculation-current-page.html`, `ghgp-land-standard-current-page.html`, `ghgp-land-guidance-current-page.html`, `ghgp-update-process-current-page.html`, `ghgp-july2026-announcement.html`, `ghgp-july2026-faq.html`, `ghgp-feedback-current-page.html`, `ghgp-gwp-current-page.html` and `ghgp-governance-current-page.html`. A page snapshot may contain links or passages with several statuses; its presence must not confer approval on everything it references.

## M2 implications and remaining limits

Recommended next work is a reviewable source catalog with explicit document family, edition, publication status, effective date when stated, supersession links, retrieval time and review outcome. Keep current guidance, corrections, historical versions, drafts and feedback distinct. Proposed regression examples are:

- An ordinary Scope 2 question cites 2015 guidance plus applicable corrections; a proposed hourly-matching change is identified as a proposal.
- A “latest standards timetable” question uses the July consolidated plan, labels its dates provisional and preserves the Q2/Q3 official-page conflict.
- A consultation-statistics answer cites August feedback v1.1; requesting the original July report returns v1.0 with its supersession warning.
- A Scope 3 example affected by the correction sheet cites the correction and identifies the edition/page context.
- A forest-accounting question outside published coverage states the missing authoritative method rather than generating one from the RFI.
- The March 2026 GWP webpage update does not relabel the linked August 2024 reference as a new 2026 factor release.

For this changing development period, a proposed weekly check of publication pages and the governance index, with a full source check before approving a corpus release, is proportionate. Capture changed links and bytes as candidates; require review before promoting a version. This is a monitoring proposal, not an implemented scheduler or an approval.

There were no access failures for the 28 selected artifacts. The review did not enumerate/download every governance meeting, stakeholder submission, complaint, historical draft or sector tool, and does not establish that no other document exists anywhere on the website. It did not obtain ISO standards or decide regulator-specific incorporation of future GHG Protocol/ISO work. Page checks cannot rule out an unannounced same-URL byte replacement. Visual checks covered the consolidated plan's identity/timeline pages, the corrected feedback's title page and the Scope 3 correction sheet; they did not cover every page or every table. File integrity does not establish extraction accuracy, calculation correctness, reuse rights or legal applicability. Rights review and runtime corpus approval remain pending.

# Milestone 1 source-file integrity check

Checked **September 8, 2026, 21:17 UTC** against the local files in `C:/Users/nimab/Neuvetra/research-sources/2026-09-08`. This was an independent, read-only verification of the three download manifests. No manifest or source file was changed.

**Result: all 47 recorded downloads exist, match their recorded SHA-256 hashes and pass the applicable file-format checks.** There are 47 distinct local paths, source URLs and byte hashes. No duplicate hashes, missing files, hash mismatches, unexpected file formats or saved error/challenge pages were detected.

## Counts

| Manifest | PDF | HTML | XLSX | DOCX | CSV | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [downloaded-sources.json](downloaded-sources.json) | 9 | 0 | 3 | 2 | 2 | 16 |
| [calculation-extra-downloads.json](calculation-extra-downloads.json) | 8 | 0 | 0 | 0 | 0 | 8 |
| [california-downloads.json](california-downloads.json) | 8 | 15 | 0 | 0 | 0 | 23 |
| **Total** | **25** | **15** | **3** | **2** | **2** | **47** |

The files total **177,738,125 bytes**. The 25 PDFs contain **2,137 pages**. The two EPA CSVs contain **1,016** and **18,288** data rows respectively, each with eight columns. These are counts of downloaded artifacts, not independent authorities: alternate formats and companion documents remain distinct artifacts.

| Primary publisher or official publishing host | Artifacts |
| --- | ---: |
| California Air Resources Board: 14 on `ww2.arb.ca.gov`, two official CARB GovDelivery bulletins | 16 |
| U.S. EPA: nine on `www.epa.gov`, three on `pasteur.epa.gov` | 12 |
| GHG Protocol (`ghgprotocol.org`) | 10 |
| California Legislative Information (`leginfo.legislature.ca.gov`) | 6 |
| U.S. Supreme Court public docket (`www.supremecourt.gov`) | 2 |
| California Franchise Tax Board (`www.ftb.ca.gov`) | 1 |
| **Total** | **47** |

This distribution identifies source provenance. It does not imply that every document is authored by its host, is a final rule, or is government approved. The court collection includes a filed appendix with lower-court materials. GHG Protocol is a standards publisher, not a government agency.

## Checks performed

- Recomputed SHA-256 for all 47 files and compared it with each manifest entry. All matched. The 24 entries recording byte lengths also matched; the California manifest's 23 entries do not record byte lengths, so observed sizes were measured directly.
- Checked all PDFs for `%PDF-` signatures, an EOF marker near the end and a readable, nonempty page tree. No HTML payload was saved under a PDF extension.
- Checked all five Office files for ZIP signatures, complete archive CRC checks and the expected XML package/core documents. All three XLSX and both DOCX packages passed.
- Parsed both CSVs and checked consistent row widths and the absence of an HTML error payload.
- Parsed all 15 HTML documents; checked their titles and substantive bodies for expected source identity and common access-denied, CAPTCHA, 403/404 and rate-limit responses. None were detected.
- Compared all downloaded hashes with the **1,220-entry** [legacy inventory](legacy-source-inventory.csv), then independently rehashed the seven matching original files in `C:/Users/nimab/Neuvetra/rag-pipeline`.
- Checked the download directory for unmanifested top-level files: **zero**.

## Exact legacy matches

Seven downloaded artifacts are byte-identical to seven original corpus files:

| Downloaded artifact | Legacy file |
| --- | --- |
| `ghg-corporate-standard.pdf` | `datasets/ghg-protocol-revised.pdf` |
| `ghg-gwp-august-2024.pdf` | `datasets/Global-Warming-Potential-Values (August 2024).pdf` |
| `epa-factors-hub-2025.xlsx` | `datasets/1_emission_factors/epa/ghg-emission-factors-hub-2025.xlsx` |
| `epa-egrid2023-technical-guide.pdf` | `datasets/1_emission_factors/epa_egrid/EPA_eGRID2023_techguide.pdf` |
| `epa-supplychain-v1.3-co2e-usd2022.csv` | `datasets/1_emission_factors/useeio/v1.3/USEEIO_v1.3_CO2e_USD2022.csv` |
| `epa-supplychain-v1.3-byghg-usd2022.csv` | `datasets/1_emission_factors/useeio/v1.3/USEEIO_v1.3_byGHG_USD2022.csv` |
| `egrid2023_data_metric_rev2.xlsx` | `datasets/1_emission_factors/epa_egrid/EPA_eGRID2023_metric.xlsx` |

The remaining **40** downloaded artifacts have no exact hash match in that inventory. This does not establish that their information was entirely absent from parsed, cleaned or differently formatted legacy files.

## Blocked sources and limits

All three manifests record successful downloads only: **zero failed or partial entries**. This check found no file-integrity evidence of truncation. It did not repeat live HTTP requests or reconstruct unsuccessful retrieval attempts outside the manifests.

The [calculation research](calculation-sources.md) separately records unresolved access to exact eCFR tables and original IPCC chapters. Those missing sources are not included in the 47 successful downloads. Previously blocked CARB web previews do not invalidate the files that were subsequently downloaded and verified locally.

Hash and format checks establish local byte integrity, not legal applicability, extraction accuracy, complete visual readability or numerical correctness. The MRR PDF has problematic text encoding despite a valid PDF structure; the calculation review used its accessible DOCX and visually checked the relevant PDF provision. This integrity pass did not visually inspect every page, validate every spreadsheet formula or cell, audit all 1,220 legacy files, or approve source content for production calculations. Download dates, document dates, data years, proposed/final status and method applicability still require the separate research reviews.

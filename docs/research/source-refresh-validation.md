# Source refresh and pipeline validation — September 8, 2026

The board approved the green, simple website preview and then prioritized refreshing the inherited data before AI answering. This delivery adds missing primary publications, corrects incomplete research notes and implements the first tested local pipeline component. It is the source foundation within Milestone 2, not completion of the answer engine.

## What changed

| Result | Evidence and boundary |
|---|---|
| 50 newly retained artifacts | 28 GHG Protocol files and 22 EPA/CARB-related files, totaling 43,730,885 bytes. Includes 20 PDFs, 26 HTML snapshots, two XLSX workbooks, one Markdown registry and one text release note. Some fill older gaps; others document later developments. |
| 97 catalog records | Combined with the original 47-file bundle: 97 distinct hashes across 93 canonical URLs, totaling 221,469,010 bytes. Multiple versions/snapshots remain separate. |
| 20 existing-source checks | Ten GHG Protocol publication-link/edition/local-hash checks; ten EPA/CARB artifacts fetched and verified byte-identical. Those are different check strengths, recorded in their manifests. |
| Offline catalog builder | Validates actual original-file hashes/sizes and confined local paths; detects identity/version conflicts; preserves provenance and unresolved metadata; writes output atomically. |
| 35 question/failure cases | Independently reviewed evaluation specification. All source fixtures remain pending preparation and all model cases remain unrun. |

The updated evidence includes [CARB's September 1 reporting guidance](https://ww2.arb.ca.gov/sites/default/files/2026-09/2026_SB253_Reporting_Guidance.pdf), the corrected [August 25 Scope 2 consultation feedback](https://ghgprotocol.org/sites/default/files/2026-08/S2-PublicConsultationSummaryofFeedback-2026.08.25.pdf), GHG Protocol development records and previously missing corrections, and a published EPA USEEIO model candidate. Guidance, proposals, future plans and factor/model products retain their distinct status. The [GHG Protocol review](ghg-protocol-refresh-2026-09-08.md) and [EPA/CARB review](epa-carb-refresh-2026-09-08.md) give exact comparisons and limits.

The earlier SB 261 docket description was corrected after rereading the original retained snapshot. Its August notice and December voluntary window were already present; this is a correction to our synthesis, not a claim that a new legal change occurred during the refresh.

## Software and data checks actually performed

The implementation delegate added [the catalog builder and tests](../../tools/research/README.md). A separate reviewer found that mixed Windows path separators could reach network-share resolution before rejection. The author fixed the normalized UNC/device-path check and added regression cases that assert filesystem resolution is never attempted. Independent re-review found no remaining material issue within the controlled-local-input contract.

- Final offline suite: **21 tests run; 20 passed, one skipped** because Windows would not permit creating a symbolic-link fixture. The skip is not a pass.
- The coordinator separately created a real Windows NTFS directory-junction escape inside an ignored synthetic test directory. The CLI rejected the resolved path outside its approved source directory and preserved the previous catalog output.
- The coordinator ran the builder against all five real manifests and both original-source directories. All **97 records** passed source hash/size validation; **zero** were marked eligible for runtime use.
- Reversing the real manifest/root argument order produced byte-identical catalog output. Manifest line endings were then normalized to match Git's LF representation and the final catalog rebuilt. All five recorded input-manifest hashes were checked against their staged Git bytes and matched. Original source bytes were unchanged.
- Researchers rechecked retained-file hashes, formats and PDF/workbook structure. The coordinator independently read CARB's four-page guidance, the Scope 2 feedback version page and relevant retained docket text. These checks do not approve every paragraph or spreadsheet cell.
- Independent QA reviewed the 35-case specification and corrected a missing coverage disclosure, an ambiguous question and inconsistent response-state names. The case bank now includes a supplied-period historical-version test. No model performance percentage is claimed.
- The GitHub verification workflow now includes a separate Python 3.12 catalog-test job. Workflow parsing/configuration checks passed and the existing triggers, permissions and application job were preserved. This workflow has not been executed remotely; local unit results do not establish a GitHub runner result.

The final normalized catalog is [source-catalog.json](source-catalog.json), SHA-256 `5417de55cd9c8bb82ff924b554cf305569b96eab164ba74f7afe3e5bee9318e8`. This identifies the catalog bytes, not a release of approved accounting or legal evidence. Its five input manifests are listed with their own hashes inside the catalog.

The source-foundation implementation, reports and manifests were uploaded to `work/neuvetra-ghg` at [commit 6bfd36d](https://github.com/neuvetra-hq/neuvetra/commit/6bfd36d0e29ef0326be509cb733fac4d0bd973af), and the remote commit was verified. The staged scan checked 23 changed files and found no environment exports or matching credential-like values; this targeted scan is not a comprehensive security audit.

## Reproduce and inspect

Use the builder's [documented command](../../tools/research/README.md) with the three original manifests plus `ghg-protocol-refresh-downloads.json` and `epa-carb-refresh-downloads.json`; supply both `2026-09-08` and `2026-09-08-refresh` original-source directories as explicit roots. The command is offline and needs only Python's standard library. The tool README documents the path, duplicate, version and atomic-output contracts and how to run the synthetic tests.

The source originals live under `C:/Users/nimab/Neuvetra/research-sources/`. They are outside Git. The catalog contains local paths and metadata; another machine needs those originals and appropriately updated location manifests before reproducing the checks. A catalog export alone does not transfer the source archive.

## What remains

Cornerstone's publisher-linked eGRID2024 Zenodo record could not be retrieved: the checked surfaces returned access/rate-limit errors or timed out. The announcement and CARB's limited first-year recognition are retained, but dataset bytes and license were not verified. No substitute was silently imported. Complete appellate-docket authentication, source rights and program/method applicability remain separate review work.

No new model provider was connected, no live question answering was tested, and no production index, database, billing or deployment was changed. The catalog is deliberately an integrity inventory with unresolved metadata and runtime approval unevaluated. Next: independently approve a small passage release, build the isolated answer flow, then run and review real answers against prepared fixtures. The approved website styling stays in place.

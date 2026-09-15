# M65 print repair: independent supplemental review

September 14, 2026. **PASS for the repaired local pipeline and the inspected Chrome print fixtures.** This supplements the frozen M65 local QA gate and replaces only its template and migration11 bindings. It does not pass actual image CI, hosted migration/application acceptance or board feedback.

The same reused QA context performed this review: prior M63 implementation authorship disclosed; no M65 product authorship. Requested Astra/high, actual inherited settings unknown. Root produced browser print artifacts; QA independently inspected the resulting page images and reran its own PostgreSQL/decoder/renderer challenges. No professional assurance is implied.

## F03 and demonstrated repair

**M65-QA-F03 — fixed print header/footer overlaid body text.** Root found this during actual Chrome printing after the original local code gate, whose print criterion was explicitly pending. QA independently inspected original pages1and2: the footer overprinted the rounding statement on page1; the repeated header overprinted the absent-review statement on page2, with further footer/body overlap. The original PDF and four PNG identities are preserved in `m65-print-before-receipt.json`. This was a real presentation defect despite passing structural CSS assertions; the earlier report must remain historical rather than being relabeled as a print pass.

CTO replaced fixed-position print status with top/bottom `@page` margin boxes using reserved margins. All five qualifications and page numbering remain visible. The change updates the template fingerprint and matching not-yet-hosted migration11 candidate. No applied migration receipt or existing report was rewritten. Original `m65_qa` remains at the previously reviewed candidate; QA restored its saved exact schema10 baseline into a new database, `m65_qa_print`, for the changed candidate.

QA independently inspected all four pages of `.superpowers/m65-print-fixed-{1..4}.png` and all four pages of `.superpowers/m65-print-long-{1..4}.png`, rasterized by root from actual Chrome PDFs. Every page shows Draft, Synthetic, Incomplete, Unreleased and No assurance in the reserved top and bottom margins. No repeated-status/body overlap or visible clipping remains. The ordinary sample shows `4876.0072 kg CO2e` and exact `4876.00722 kg CO2e`, absence-at-capture wording, full fingerprints and explicit limitations. The long sample visibly renders angle-bracket/ampersand labels and notes as text, preserves changes-requested wording and full wrapped fingerprints, and continues its long correction reason onto the next page without losing text. Root identifies the long inputs as 100-character labels and 500-character correction/review notes. Its correction-reason label ends page2 while the value continues on page3; that page break is readable and does not overlap or omit content.

Root reports the actual print call as Chrome `Page.printToPDF` with `printBackground:true` and `preferCSSPageSize:true`, other settings default. Exact Chrome version was not recorded. These are synthetic renderer fixtures, with synthetic report/review identifiers; they are not evidence of persisted hosted report creation/download or a particular actor's real decision. Browser-generated PDF bytes remain outside the report HTML SHA256 contract. This pass is for the observed renderer/settings and fixtures, not all browser implementations or print settings.

## Independent regression recheck

`M65_PRINT_TEST_DATABASE_URL=postgres://m63_test_admin@127.0.0.1:55463/m65_qa_print bun test evaluations/research-qa/m65-print-postgres.test.ts`: **12 tests / 218 assertions passed** on real PostgreSQL17.11 with Bun1.3.12. The supplemental harness is an immutable copy redirected to the new dedicated database; the original harness and receipts were not changed. All **999 original rows across 35 baseline tables** remain present with identical per-row hashes.

`bun test evaluations/research-qa/m65-independent-frontend.test.ts evaluations/research-qa/m65-independent-renderer.test.ts`: **9 tests / 174 assertions passed** against the repaired candidate. Combined result: **21 tests / 392 assertions passed**. Actual SQL HTML reconstruction/byte hashes, seven accounting cases, immutable review history, real blocked-review ordering, report/correction concurrency, second active tenant isolation, member/revocation gates, tamper refusal and frontend actor-abort tests all passed again. No arithmetic or worksheet-review contract was changed by this print repair.

## Replacement bindings and remaining gates

The new canonical-LF identities are:

| Artifact | SHA256 |
| --- | --- |
| `packages/neuvetra-database/src/m65-template.ts` | `a20f98d6f563367bacf77e6d70567ef20305f7450a2989b7a595e08c22f557d8` |
| `packages/neuvetra-database/src/migrations/0011_worksheet_reports.sql` | `a597d9b479321f308efa8de880a814c2ebd8dc29afa43fbff10a41a07ff66a99` |

The template **content** fingerprint is `cb279f0ec15cd492815dca2c4424e6d8852c0503f179fa0179482a0f087aa929`; it differs intentionally from the TypeScript module-file fingerprint. The other 30 entries in the original local manifest were rehashed and remain unchanged. Original frozen reports/manifests are preserved. The replacement bindings, exact local PDF/PNG hashes and supplemental test/receipt hashes are recorded in `m65-print-supplement.json`, SHA256 **c2600e557ed052962a59ed103a1e201e46a23cc813d8f0150da618724a323e94**. The binary print artifacts remain local; the committed evidence contains their hashes.

This supplement closes the observed local print-fixture defect. Actual Linux image CI must still pass before migration; hosted schema11 readiness/containment, authenticated create/open/download/revisit, restart and retained live M63/M64 data checks remain distinct gates. Board demonstration and feedback remain required. No cloud calls, Git operations, credential inspection or product changes were performed by this QA assignment.

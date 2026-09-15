# M73-P09 independent print acceptance

Reviewer: `/root/m73_cpo`, reused after a dedicated critical-review context was unavailable. Requested `gpt-6-astra` / `high`; actual model and effort are unknown. The reviewer authored the M73 product criteria, but did not author the implementation or control the browser during this review.

## Verdict

**PASS for M73-P09 as written.** The combined evidence shows that the exact-version report opened, the actual **Print report** control invoked the native print/save window, the actual download controls produced retained bytes, and those exact saved bytes and hashes survived restart. Candidate3 screen evidence shows the report is readable on desktop and at 390 pixels.

The criterion requires the actual open, print and download entry points. It does not require completing a physical print job, saving a PDF, or proving printer-specific pagination. This review therefore accepts the native dialog invocation and does not claim that a document was physically printed or saved from that dialog.

## Evidence and interpretation

- The original product brief states: “The exact-version report opens, prints and downloads through the actual browser controls,” with evidence comprising server byte/hash validation, actual open/print/download entry points, saved-file comparison and readable desktop/390-pixel review.
- The root coordinator recorded the actual report opening and readable gas, evidence, activity, boundary, candidate-status, review/correction and corporate-gap content in `evaluations/research-qa/m73-browser-verification.md`, SHA-256 `6c9f8f34b52d86659595a7ec40d028fc263f928fe0b0e994fae98ce94910ffb2`.
- That record states that the coordinator invoked the actual **Print report** button and that the native surface was outside browser-control visibility.
- On 2026-09-15, the board told the root coordinator: “I can confirm that there was a print and save window open, then I closed it.” This direct observation resolves whether the actual print entry point opened its native dialog. The board did not report completing a print or save operation.
- The coordinator downloaded the original exact-version HTML twice through the actual UI, before and after correction. Both files were 54,765 bytes with SHA-256 `b5e0bc97d5a28cee8ed2610d0d162b3a2086a87ce0ff4c78ab36fd625b60d8ce`. Before/after restart readbacks retained the same register hash and all six download hashes and lengths.
- The candidate3 follow-up, `evaluations/research-qa/m73-browser-candidate3-followup.md`, SHA-256 `b95aa559733ae4a0088969046fa22368099296877032919b65408f4ba8891550`, records unchanged exact/display totals and a newly rendered report. The independently inspected desktop and 390-pixel screenshots show readable labeled content and close V-F01 without horizontal overflow.
- The supporting-statement download control separately produced 1,140 bytes with SHA-256 `bc3b59fdc292022094fc9807f27003dbe926fc8188566c53b2d04cd7f07edd44`, matching retained metadata.

## Boundaries

This acceptance establishes the browser entry points and retained report bytes required by M73-P09. It does not establish the appearance of the native print preview, exact printed numerical fidelity, page breaks, headers/footers, printer output, PDF-save output, hosted-browser behavior, complete Scope 1, production readiness, legal compliance or assurance. Those outcomes were not required by M73-P09 and are not inferred from the board’s confirmation.

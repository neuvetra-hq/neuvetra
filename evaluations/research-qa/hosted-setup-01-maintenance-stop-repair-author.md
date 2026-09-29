# HOSTED-SETUP-MAINTENANCE-STOP-REPAIR-01 — author handoff

Date: 2026-09-26. Candidate 1 remains in `hosted-setup-01-maintenance-stop-author.md`; independent review `hosted-setup-01-maintenance-stop-independent-review.md` rejected it with MS-F01/F02/F03. This repair is still a local, inert availability-stop helper and does not implement a Railway client or prove database writer exclusion.

The observation operation now returns serialized JSON before its Promise resolves; the helper parses and copies the scalar fields after the await. This removes a caller-owned observation object from the asynchronous boundary (MS-F01). The immutable internal receipt is distinct from the frozen copy given to the receipt writer (MS-F02). Journal append/close operations are bound before the first journal await (MS-F03). Focused regression cases exercise asynchronous observation mutation, receipt-writer mutation and journal-method substitution.

`bun test tools/staging/hosted-setup-maintenance-stop.test.ts --timeout 30000`: 6 pass, 37 assertions. Focused strict TypeScript passed. No live Railway or database action occurred. Re-review should verify the frozen file hashes below and challenge those three repairs plus the stated availability-only boundary.

Source SHA-256: `2d261f2153a04dd73beb47f3470919cadb7443c7a39acef863c6272631b8fc17`.
Test SHA-256: `b8d6261d5170743f12a5ea788b568ee1e340eccbc3738b22e6e3b9b831fd0cf8`.

# M67 — Full-year electricity coverage

Board authorization follows accepted M66. Implement on rolling PR4 and existing hosting, preserving M63–M66. CPO responsibility is held by root; CTO owns technical contract, accounting independently validates quantities/claims and QA independently challenges integration.

## User outcome

An invited manager enters January–December2023 electricity for one fictional CAMX facility, sees which months are missing, saves a deterministic annual worksheet, corrects it with a reason, obtains a different manager's bounded review and opens a frozen readable report.

## Acceptance

1. Twelve ordered month slots: blank means missing, explicit zero means recorded zero. Partial years may be saved with at least one entered month and a visibly qualified entered-month subtotal. All12 entered months mean full-year electricity coverage, never a complete company inventory.
2. Reuse the pinned2023CAMX development candidate and strict decimal policy. Independently derive maximums and sum exact quantities/emissions before final half-even display rounding. No browser floating-point or model numerical output.
3. Annual entries are explicitly manual and have no linked bill evidence. Existing M66 bill-linked January worksheets remain available. Copying a value does not transfer evidence, review or source authority. No automatic import and no implication that a January bill covers the year.
4. Whole-year immutable versions, required correction reason, no-op rejection, optimistic concurrency, idempotency, tenant authorization and audit reconstruction. A correction needs a fresh different-manager review; previous reviews remain intact.
5. Frozen annual reports capture twelve months, missing/entered coverage, totals, candidate method, manual evidence qualification, correction and captured review state. Later changes cannot alter saved bytes. Support screen, download and existing print-view pattern.
6. Independent accounting and QA review, actual native PostgreSQL/frontend boundary tests, preservation of M63–M66 rows/reports, hosted workflow/download, refresh and restart readback. Check missing/zero, bounds/rounding, stale/concurrent actions, cross-tenant/revoked access and tampering.
7. Commit/push to rolling PR4, confirm all required CI and existing-service deployment, then demonstrate and collect board feedback before a dependent milestone. No new subscription, PR merge, customer/factor release, new year/geography, automatic bill parsing, market-based accounting or Scope1/3 expansion.

## Current gate and ownership

Technical/accounting contracts are being prepared; their review precedes product implementation. Root owns UI, operators, integration, Git/cloud and shared status. Scoped CTO owns additive database/API/report implementation after contract approval. Accounting owns independent numerical expectations and wording; independent QA authors no product code. Actual inherited compute and cost remain unknown; critical policy route requested Astra/high. No persistent workers are implied.

# Exact-image live stop — repair 2 author handoff

2026-09-26. Root repaired LIVE-STOP-F05 from the preserved repair1 independent FAIL (`hosted-setup-01-live-stop-independent-review2.md`). Original F01–F04 and repair1 F05 findings remain preserved. This second repair is not live stop authority until independent exact-byte QA accepts it.

Frozen SHA-256:

- `tools/staging/hosted-setup-live-stop.ts`: `334c357cd645b88a8bf3007895474315998a4ec123bcec0a558a47565b96e706`
- `tools/staging/hosted-setup-live-stop.test.ts`: `01933364602abc12b9177f873724e613e8acf4e161dc11e6dfcff676615af2c4`

The receipt is synced and closed before the journal records `receipt_synced_pending_finalization`. Receipt-close failure is caught as an uncertain post-scale outcome. Finalization attempts both closes independently; any close failure returns the fixed no-retry uncertainty error. If journal closure itself fails, the helper tries to append an uncertainty event through a new handle to the already reserved journal. That append is best-effort: inability to write an event does not convert an uncertain result to success. No terminal success journal event is written before finalization; accepted proof is the returned result plus verifiable receipt and independent provider observation.

Focused Bun tests: 7 passed, 41 assertions, including synthetic receipt/journal close faults after one intercepted scale. Scoped strict TypeScript passed. No Railway scale, provider mutation or database action occurred. Independent QA should rerun F01–F05 against these exact bytes, including the original close-fault probe and ordinary success/refusal cases.

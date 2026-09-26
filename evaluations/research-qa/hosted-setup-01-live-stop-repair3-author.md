# Exact-image live stop — repair 3 author handoff

2026-09-26. Root repaired only the test-isolation finding LIVE-STOP-F06 from the preserved independent repair2 package FAIL (`hosted-setup-01-live-stop-independent-review3.md`). The source remains unchanged from its bounded independent PASS; the test now restores the filesystem module mock in a `finally` block and proves a later ordinary file open/write/close succeeds.

Frozen SHA-256:

- `tools/staging/hosted-setup-live-stop.ts`: `334c357cd645b88a8bf3007895474315998a4ec123bcec0a558a47565b96e706`
- `tools/staging/hosted-setup-live-stop.test.ts`: `11081726c974c8684572efccbfbec65e6edd87416f5f6cf0000e29b9b737e430`

Focused Bun: 8 passed/42 assertions. Combined deployment-binding, live-stop and postscale Bun: 38 passed/201 assertions, with postscale running after the fault test. Scoped strict TypeScript passed. These checks are local/synthetic only. F01–F05 independent repair2 source results remain bounded; an independent recheck of this changed test package is required before live use. No provider scale or database mutation occurred.

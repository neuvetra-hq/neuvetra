# Exact-image live stop — repair 4 author handoff

2026-09-26. Root repaired only LIVE-STOP-F06, the Bun 1.3.12 test-module isolation issue preserved in independent review4. The live-stop source is unchanged from its bounded independent F01–F05 PASS.

Frozen SHA-256:

- `tools/staging/hosted-setup-live-stop.ts`: `334c357cd645b88a8bf3007895474315998a4ec123bcec0a558a47565b96e706`
- `tools/staging/hosted-setup-live-stop.test.ts`: `29e09d8cf350b34623f424c427bc7fa0e4ad47cbf1da68493088543785e3c73d`

The fault test explicitly remocks `node:fs/promises` back to its captured native exports in `finally`; Bun's `mock.restore()` alone did not do that. The following test closes the **same prior journal path** that triggered the synthetic close fault, so a lingering wrapper fails it. A local Bun probe also confirmed the remock restores `open` identity.

Focused+neighboring safety tests: 38 passed/201 assertions, with postscale tests running after the fault test. Scoped strict TypeScript passed. No provider scale or DB mutation occurred. Independent QA should replay its prior same-path isolation probe on these exact bytes, then give a bounded package verdict while preserving QA1–QA4 history.

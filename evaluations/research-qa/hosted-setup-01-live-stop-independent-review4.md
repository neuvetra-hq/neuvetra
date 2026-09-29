# Live-stop test-only repair3 — independent review

**FAIL: LIVE-STOP-F06 (P2) remains reproduced.** Source F01–F05 bounded PASS carries forward from review3; source is unchanged. QA1–QA3 remain preserved.

Task HOSTED-SETUP-LIVE-STOP-REPAIR3-QA-01, 2026-09-26. Reviewer /root/compose_qa did not author this source/test. Requested registered critical qa-lead gpt-6-astra/high; observed follow-up settings unknown. No source edits, live scale, provider/DB or Git actions.

Frozen SHA-256, verified before/after checks:

- Source: `334c357cd645b88a8bf3007895474315998a4ec123bcec0a558a47565b96e706`.
- Test: `11081726c974c8684572efccbfbec65e6edd87416f5f6cf0000e29b9b737e430`.
- Author report hosted-setup-01-live-stop-repair3-author.md: `4654e64cee9b7a83abc1723d7f1aed54d830abae4c07b202040c68de660179a0`.

Replayed unchanged independent following-test probe `%TEMP%/hosted-live-stop-repair2-mock-isolation.test.ts`, SHA `1e4c6d2932be88292dbbab61c6f29ada4c6c44d60454fb288f468a1aeae82ddc`, embedded in review3. On Bun1.3.12: **8 candidate tests passed; independent following test failed;43 assertions**. After mock.restore(), observed openRestored=false and one synthetic close failure on the prior faulted fixture journal. This proves the module replacement remains active. The new candidate test opens a different file, so it passes despite the active path-specific fault.

Combined deployment-binding/live-stop/postscale run: **38 passed /201 assertions**, with postscale executing after live-stop. This does not negate the independent failure because those later tests do not reopen the specific faulted journal. Scoped strict TypeScript source/test check passed (noEmit, strict, ESNext, Bundler, Bun types, skipLibCheck).

Required correction: in finally explicitly restore captured native fs/promises exports, or isolate the fault test in another process. Verify native export behavior and a later close of the same faulted journal; do not infer module restoration from mock.restore() or success on an unrelated path. This is a test-isolation package blocker, not a new production-source defect. No live stop/migration authority is granted. QA artifact packaging/closure remains coordinator-owned.

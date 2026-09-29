# Independent UI/API review: seven-step setup increment

Verdict: **PASS for the corrected local setup UI/API candidate**, 2026-09-26. The reviewer authored test/evidence files only. This is not acceptance of the complete hosted rebuild brief, a deployment, or collection/readiness parity. Requested route: gpt-6-astra/high; observed route and cost unknown.

## Exact candidate

`hosted-setup-01-ui-browser-result.json` pins nine files before and after execution: CompanySetup, StagingWorkspace, the browser API client, staging CSS, both staging Docker files, the staged server, setup route and pure shared contract. Before/after hashes match. Key hashes:

- CompanySetup: `efe71d160115234a39c5b0b0477af7406c2aea8139f0179cb210149c568cf7a5`
- Browser API client: `517caaff2c3a85d5f4d7a52ac42bbc2adcbb184b120855511e83f06ed6938a5d`
- Shared contract: `93cc5fe6b8af6416354b2d461800bcaf108a386200d75b3f7838172e4e505d74`

Publication whitespace recheck: removal of exactly one trailing LF from the type-only contract was independently verified. Appending that byte reconstructs the previous reviewed SHA-256 `441669878a089e8585c0f05d4a94370533b9160d50e4b62615e86da8c83b82a6`. Client/native tests were rerun (2 passed,12 assertions), and all seven Node/Chrome checks passed again. Browser/native receipts now pin the final bytes above. See `hosted-setup-01-ui-whitespace-recheck.json`; no runtime behavior or scope changed.

`hosted-setup-01-ui-native-client-result.json` additionally pins the extracted server setup module at `15bca16b06af477dece8ce007c2299c0d4a643397a7826c6a8005e027b328d72`; the earlier foundation verdict retains its original hashes. The new extraction was exercised through the actual native database path.

## Executed checks

1. `bun evaluations/research-qa/hosted-setup-01-ui-node-launch.ts`: seven browser checks passed with actual React and headless local Chrome driven by Node/Playwright. Synthetic API responses were mocked for reproducible races. The reviewer entered all seven sections, saved, remounted a returning user, and corrected the setup. The recorded request preserves an inclusive December31 end as January1 exclusive, explicit ownership zero, Nevada location and distinct No/not-applicable/unknown screens. During a pending save, navigation/editing is disabled. Lost-response retry retains the request and, when the server has a newer correction, the current draft displays that newer correction. A company switch clears prior facts; sign-out unmount removes the company form. No browser page errors were observed.
2. `bun test evaluations/research-qa/hosted-setup-01-ui-client.test.ts`: passed. Positive controls accept a valid initial receipt and an old-key replay with a newer foundation. Four mismatched-receipt variants are rejected, and abort during response-body consumption rejects. See `hosted-setup-01-ui-client-result.json`.
3. `bun test evaluations/research-qa/hosted-setup-01-ui-native-client.test.ts`: passed, nine assertions. The real browser API module called the mounted staging HTTP server and restricted native PostgreSQL17.11 adapter. Empty-company load, exact save, correction, full previous-version read, old-key replay with newer head and cross-company denial passed. Authentication remained a synthetic token map. No fixture facility is needed for the new setup/session path; the foundation review separately exercised operator-only provisioning and admission.
4. Read-only packaging/navigation review: the pure contract is copied into the web build and runtime; the server setup module, route and migration23 are included in the matching Docker context allowlist. StagingWorkspace makes setup primary, keys setup by actor/company, and preserves the old M80 fixture setup under Other workspace views. Actual Docker image build and a full browser visit to that legacy view were not run by this reviewer; coordinator/CI regression evidence remains necessary.

## Findings preserved and repaired

- **UI-F02 — pending-save edits could be overwritten.** Initial source allowed edits/navigation while save success replaced the draft and cleared dirty state. Author added busy guards and disabled form/navigation. Corrected browser behavior passed. This was initially a source-review finding; the unfixed behavior was not successfully reproduced in Chrome before the author repaired it.
- **UI-F03 — old retry could pair a newer head with an older draft.** Initial source selected `savedVersion.setup` even when the returned foundation had a newer correction. Author now selects the current foundation setup and names the newer correction. Corrected browser replay and the native/client old-replay positive control passed. Initial evidence was source review, not an unfixed browser run.
- **UI-F04 — mismatched save receipts were accepted.** The first executable client probes accepted foreign foundation, changed actor, changed payload and unrelated revision. `hosted-setup-01-ui-client-first-result.json` preserves that result and exact original client hash. The author added exact metadata/history, tenant, actor, request-body and canonical payload checks plus post-body abort handling. The corrected tests use valid positive receipts, so rejection cannot be attributed only to a malformed base fixture.

Browser harness setup failures were test-environment/selector issues, not product findings: Bun/Playwright transport stalled; Node/Chrome worked. Accessible labels containing hints or populated textarea values required prefix matching. Test-created sign-out needed a React render wait. No claim is made that those failed harness attempts established product acceptance.

## Scope and handoff

No remaining material blocker was found for this local seven-step setup candidate. Scope2/3 collection screening, evidence, activity records, readiness, all15 full Bayline fixes, real provider sign-in/out, live hosted backup/restore, server/database process restart and the hosted board walkthrough remain separate gates. The browser race harness is not proof of a live tenant boundary; that boundary is supported by the separate native/API tests. History UI shows a summary; full historic fields were checked through the API. This review grants no source/method release or customer-readiness claim.

Commit the UI test sources (`ui-entry.tsx`, `ui-browser.ts`, `ui-node-launch.ts`, `ui-client.test.ts`, `ui-native-client.test.ts`), four JSON receipts (`ui-browser-result`, `ui-client-first-result`, `ui-client-result`, `ui-native-client-result`) and this review. Names above share the `hosted-setup-01-` prefix. The generated `ui-browser-node.mjs` is transient and recreated by the launcher; do not commit it. The synthetic native cluster under `.tmp/hosted-setup-01-qa-native` is also transient and remains available at the coordinator's request. Publish only the exact reviewed product bytes and require the broader checks/CI gate; any subsequent product change needs a targeted recheck.

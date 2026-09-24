# M73 independent visual evidence review

Reviewer: `/root/m73_cpo`, reviewing saved artifacts produced by the root coordinator. The reviewer did not control the browser or reproduce these interactions. Candidate2 preserves the original finding; candidate3 is the reviewed repair.

## Verdict

**PASS for the saved candidate3 screen evidence; native print remains PENDING as a milestone gate.** V-F01 is closed: the repaired 390-pixel report keeps its title, gas table, evidence identifiers and corporate gaps within the viewport. The paired candidate2 machine-readable observations support exact persistence across an application restart. The artifacts do not establish print-preview appearance, printed pagination, hosted-browser behavior or accessibility beyond what is visible in the captures.

## Evidence inspected

| Artifact | SHA-256 | Independent observation |
| --- | --- | --- |
| `evaluations/research-qa/m73-browser-verification.md` | `6c9f8f34b52d86659595a7ec40d028fc263f928fe0b0e994fae98ce94910ffb2` | Coordinator-authored action record with explicit local, synthetic and print limitations. |
| `m73-browser-report-candidate2.png` | `44372d1cba2704b6457bbe0058c5d599b384382eebd20cdd380ebbad021ae52d` | Report dialog is readable and visually distinct from the dark workspace. It shows the synthetic/internal-draft warning, company/entity/boundary/facility/source labels, period, entered and statement quantities, exact subtotal and an obvious close control. Raw JSON is not exposed in the visible report body. |
| `m73-browser-narrow-candidate2.png` | `8575271734b1718b9b31aa6b1bd3dded411a35be35887dfec71f1b3f19c8fc35` | At the recorded 390-pixel viewport, refresh/create/correction controls, source/version selectors, quantity and exact/display subtotals remain legible and contained without visible horizontal clipping. |
| `m73-browser-report-narrow-candidate2.png` | `8c1943c04cfdcf1867b2ab1f41c21722b6bb2e6be02e2f3177eed7ae2638b723` | The narrow report visibly has a horizontal scrollbar and content wider than its viewport. This is preserved failing evidence for V-F01. |
| `m73-browser-correction-candidate2.png` | `ca639759a19c88af6b203d12e28f2484120ce4d238a73b3e16f50a70e0a32c38` | After restart, version2 visibly retains 1500.125 MMBtu, exact `79678.3893125`, display `79678.3893`, development-candidate language, incomplete Scope 1 language, unresolved discrepancy, correction reason and unreviewed state. |
| `.tmp/m73-browser-before-restart.json` | `403f0c8106d4296fb6890cca0ae0cc9a4506d3f0e505eb89369d3357af1cf5e6` | Coordinator read-only observation before restart; zero application POSTs. |
| `.tmp/m73-browser-after-restart.json` | `ca79e3f5faee5a6555bd0a896e16854601a8c7b296be5e7ed5f652d72dcfce2a` | Coordinator read-only observation after restart; zero application POSTs. |
| `evaluations/research-qa/m73-browser-candidate3-followup.md` | `b95aa559733ae4a0088969046fa22368099296877032919b65408f4ba8891550` | Coordinator-authored targeted rerun on a fresh candidate3 database and bundle, with numerical parity and print limitation disclosed. |
| `m73-browser-report-narrow-candidate3.png` | `ac12dd2ff5657c8407d58a2af272b46d95fec6d8eff630384ca700078ed6f710` | At 390 pixels, the report title, context and source labels wrap within the frame; no horizontal scrollbar is visible. |
| `m73-browser-report-gases-narrow-candidate3.png` | `6e1c2f3ace4525b714a9f97a14d86f01b2594b58550234fde11f0e98fa93243c` | CO2, CH4 and N2O values and the labeled supporting statement remain readable within the narrow frame. |
| `m73-browser-report-identifiers-candidate3.png` | `ae6affc250be33b735916c461665c287ceae03cfd5ed2c975b35139a2b8cc265` | Long locator and fingerprint values wrap; the corporate-gap text remains readable without a horizontal scrollbar. |

The before/after observations have the same register SHA-256 `008873078a9d439b99c5c1181f0fe628f10b89f32944d248b2fbb26ea0b6bf1`, the same one stream/two versions/two reports, and the same six download hashes and byte lengths. The original unreviewed report is 54,765 bytes with SHA-256 `b5e0bc97d5a28cee8ed2610d0d162b3a2086a87ce0ff4c78ab36fd625b60d8ce` in both observations. This supports persistence and exact download retention across restart.

### V-F01 — narrow report overflows horizontally

**Severity: medium usability defect. Status: closed in candidate3.** The candidate2 390-pixel report capture shows a horizontal scrollbar. Long identifiers and fingerprints widened the report body because its base style lacked an unconditional wrapping rule. This made part of the report unavailable without two-axis scrolling and weakened small-screen review.

Candidate3 snapshot `operations/agent-improvement/snapshots/M73-INTEGRATED-CANDIDATE3.json` matched SHA-256 `828a77d5334a781929c55075d883883364156c49a5c16f3752b4c095ba4f69d8`; all 26 listed filesystem hashes matched. The targeted repair adds `overflow-wrap:anywhere` to both renderers. Their frozen hashes are TypeScript `85bb39f20ccdfe1c8f44783bb7432d1a400e79a4a64d92577076ac0c6542ee09` and SQL migration `aa4968c63087f353b5bf80d64bced67270bc5ad17f715393b40313bb57f7f732`. The candidate3 native evidence separately records report parity, while the three saved narrow screenshots demonstrate the corrected layout. The candidate2 failure screenshot remains preserved.

The candidate3 rerun retained exact `66399.7643125` and display `66399.7643`; its newly created report HTML is recorded as SHA-256 `c6e58319be4b18f6adced1ad36b9d995582ab694dd387aeeb271c8ca6e9ffe99`. The candidate2 original-statement control also produced 1,140 bytes at SHA-256 `bc3b59fdc292022094fc9807f27003dbe926fc8188566c53b2d04cd7f07edd44`, matching retained metadata.

The coordinator states that the actual Print button was invoked, but browser control could not observe the native print surface and the original tab stalled. No saved artifact shows print preview or pagination. **The print criterion therefore remains unverified and cannot be waived by this review.**

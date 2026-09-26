# HOSTED-SETUP-ARTIFACT-MATERIALIZE-REPAIR-01

2026-09-26. Author `/root/artifact_launcher`, software-engineering under CTO/CEO. Software-engineering role and improvement workflow refreshed; role hash `a9ab5574fe2ef1e940cb1950e6ae69da008ff71ba1f857b6a63b45d53240a52b`. Requested critical registry route `gpt-5.6-sol/high`. A follow-up cannot override this existing execution context, so observed model/effort and resource usage remain unknown. Applied L04: regressions invoke the actual public materialization boundary.

## Repair and verification

Independent first review's **FAIL / MAT-F01 P2** remains preserved at `hosted-setup-01-artifact-materialize-independent-review.md`, SHA-256 `eff6b90140ca7fd4dd7d294e108d329c55d2a214a9dd5c610d1809fde5344efb`. No reviewer report or accepted source verifier was edited. Before repairing source, the new author regressions reproduced **1 pass / 2 fail**: a canonical 4,128,764-byte file succeeded; 4,128,765 bytes and exact 16 MiB failed with `Canonical base64 required`.

The repeated-group regex is replaced by a constant-work length-divisibility check followed by bounded native decoding and exact canonical re-encoding equality. The existing encoded-length cap precedes decoding, and the decoded 16 MiB cap precedes re-encoding. The tolerant decoder cannot admit alternate alphabets, ignored characters, whitespace, malformed padding or nonzero padding bits because their re-encoded canonical text differs from the input. Empty regular files remain permitted. No file, archive or aggregate limit increased.

Final checks on Bun 1.3.12:

- `bun test tools/staging/hosted-setup-artifact-materialize.test.ts --timeout 30000`: **15 passed, 0 failed, 231 assertions**.
- Installed strict TypeScript on the two changed files: **PASS**, no diagnostics.
- Public materialization succeeds at **4,128,764**, **4,128,765** and **16,777,216** bytes; extracted length and SHA-256 match input, and `launchAuthorized` remains false.
- **16,777,217 bytes** refuses at the decoded bound before output-root creation, including the case sharing the maximum valid encoded-length bucket.
- Thirteen malformed/noncanonical variants refuse before output-root creation: missing/excess/internal/leading padding, newline/space, noncanonical padding bits, URL-safe alphabet, invalid alphabet and Unicode.
- The aggregate guard still rejects forty canonical 2 MiB files plus the existing fixture files with the exact `Archive decoded size limit exceeded` error, before roots are created.
- Existing path/link/device/exclusivity/final-verifier and real Bun/pg resolution regressions passed. Latest retained pg observation: `C:/Users/nimab/AppData/Local/Temp/hosted-artifact-materialize-fkxa3Q/observation.json`. Probe children exited.

## Frozen repair candidate

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-materialize.ts` | `7f1c644e4b3520c51e585f283d52d2e3200ea5840e1723a1a841a1a6be42db3d` |
| `tools/staging/hosted-setup-artifact-materialize.test.ts` | `5860472b5acaa2e829c3e52b9c705085ae34382f115db35b95fe7429be224336` |

Independent re-review is pending; the author does not close MAT-F01 on QA's behalf. Original first failures and all operational limits remain in force. This remains an offline component with synthetic publication/archive fixtures, no authentic publication authority, no maintenance worker and no database connection. No live/provider/Git action, credentials, package installation or source-verifier change occurred. Only the two owned implementation/test files, this repair report, the new repair run record and temporary fixtures were written. Next owner: independent QA, then root integration.

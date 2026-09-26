# HOSTED-SETUP-ARTIFACT-MATERIALIZE-QA-01 — independent first review

2026-09-26. **Verdict: FAIL — one open P2 correctness finding, MAT-F01.** This is an offline component review; no hosted launch, migration, publication, or runtime-loaded-code attestation is accepted.

Reviewer: `/root/materializer_qa`, Head of QA, reporting to CEO. This context did not author or change the candidate, its tests, or its accepted verifier dependency. Requested compute: `gpt-6-astra/high`; observed model/effort and resource usage unknown. QA role prompt SHA-256: `0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94`. Read the current role/operating/improvement guidance, leading continuation section, board report/status, corporate direction, local notes index, author report and actual source. Applied L04 and L06: invoke exported boundaries and challenge composed inputs/lifecycle rather than relying on an author's pass count.

## Frozen reviewed versions

All three hashes were checked before review and after the independent executions; no candidate edits occurred.

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-materialize.ts` | `73355137f1c6cf6adb6d07c97df658cba5350c7cee056a20dcb24843b502adab` |
| `tools/staging/hosted-setup-artifact-materialize.test.ts` | `d867c5e5931fe081bbaf494904ce78ddb5442778aa8d01dfcfaea579f656fc78` |
| `tools/staging/hosted-setup-artifact-source.ts` | `3e1069aba42eca77a861f9c395c966269758a79a16207c53c19b15b6c8d4c691` |

Environment: Windows, installed Bun `1.3.12 (700fc117)`, executable `C:/Users/nimab/.bun/bin/bun.exe`. Installed local packages and compiler only; no install/network/provider/database/credential activity.

## MAT-F01 — P2: valid files below the advertised maximum fail base64 validation

Location: `tools/staging/hosted-setup-artifact-materialize.ts:54`, in combination with the 16 MiB per-file limit at line 10.

The repeated-group base64 regular expression returns false for sufficiently large **canonical, valid** base64 under the pinned Bun runtime. An independently produced, correctly hashed regular file of 16,777,216 bytes is within `ARCHIVE_LIMITS.fileBytes`, but exported `materializeHostedSetupArtifact` rejects it with `Canonical base64 required`. The failure occurs before extraction. It is a false refusal, not an extraction escape.

For a file made with `Buffer.alloc(n, 0xa5)`, a binary search and adjacent-byte checks isolated the observed boundary: **4,128,764 bytes succeeds; 4,128,765 bytes fails**. Both encode to 5,505,020 base64 characters, round-trip exactly through `Buffer.from(s, 'base64')`, have correct publication and file digests, and are well below the advertised byte limits. The two sizes were then independently exercised through the actual exported materializer: the lower file extracted with identical SHA-256; the next byte failed at line 54. This boundary is observed for this runtime and input family, not a portable universal regex-engine constant.

Minimal runtime reproduction (also preserved in `C:/Users/nimab/AppData/Local/Temp/materializer-base64-threshold.ts`):

```typescript
const pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
for (const n of [4128764, 4128765, 16777216]) {
  const bytes = Buffer.alloc(n, 0xa5), encoded = bytes.toString('base64');
  console.log(n, Buffer.from(encoded, 'base64').equals(bytes), pattern.test(encoded));
}
// Bun 1.3.12: true/true, true/false, true/false for roundtrip/regex.
```

Impact: valid reviewed source/dependency archives containing moderately large regular assets can fail materialization despite satisfying the declared contract. The normal pg fixture is smaller, so the author suite does not expose this defect. The behavior is consistent with a runtime regular-expression resource limit; this review did not instrument the engine internals.

Required next action: author replaces the repeated-group validation with a bounded validation that supports the declared file limit, retaining canonical re-encoding equality and decoded byte bounds. Add successful maximum-size and failure-above-maximum regressions. Independently recheck the observed boundary, exact 16 MiB success, malformed padding/nonalphabet cases and the aggregate decoded limit on the new exact candidate. Do not erase this first FAIL.

## Acceptance coverage

| Criterion | Disposition | Evidence |
| --- | --- | --- |
| Reject archive traversal, absolute/UNC/drive/ADS paths, controls, `.git`, device aliases and ambiguous names | PASS, with file-symlink creation limitation below | Rerun author suite; independent case variants including mixed-case nested shadow directories, UNC, NUL/DEL, superscript LPT and console-device aliases. |
| Reject links/devices/unsupported metadata, duplicate/case-alias/prefix collisions, unsorted/empty/surplus archives and noncanonical base64 | PASS for exercised hostile inputs | Author entry-kind cases plus independent prefix/case collisions, top-level and pin metadata, missing receipt entry, invalid UTF-8, padding-bit/whitespace/unpadded variants. Rejections precede output-root creation. |
| Support exact regular-file extraction throughout declared bounds | **FAIL, MAT-F01** | Binary/NUL/high-byte and empty files extract exactly. Valid 4,128,765-byte and 16 MiB files falsely reject. |
| Enforce size and count refusal limits | PASS for exercised oversized cases | Independent 100,001-entry, >1,024-byte path, >16 MiB file, >128 MiB encoded input and >80 MiB decoded aggregate refused. Aggregate confirmation used forty individually valid 2 MiB files plus existing source bytes and required the exact aggregate-limit error. |
| Separate source/dependency roots and refuse dependency shadows | PASS | Author real ancestor-pg shadow; independent mixed-case/nested source node_modules and invalid dependency prefix. External package `main` resolves outside the dependency root and is refused without executing marker code. |
| Exclusive extraction, aliased ancestors and final verifier behavior | PASS for exercised boundaries | Author existing-root/concurrent extraction tests; independent nested real junction ancestors; invalid final review retains failed roots and prevents retry/reuse. |
| Capability and re-verification | PASS | Independent caller mutation after invocation cannot redirect captured paths/policy; prototype forgery refuses; source, dependency, surplus, config and publication tampering all refuse at probe re-verification. |
| Real Bun/pg dependency resolution | PASS, narrow observation | Independent rerun of real installed pg 8.23.0 test, 138 files / 14 packages. Both resolutions remain in private dependencies; separate test imports expose Client without constructing it or connecting. Cache observation is not complete loaded-code attestation. |
| Honest scope / no live authority | PASS | Returned `loadedPg:false` for exported resolution probe and `launchAuthorized:false`; no maintenance worker, provider, DB, credentials, install, deployment or publication executed. |

## Executions and retained evidence

1. Initial sandboxed Bun author-suite invocation failed before reading the test with `EPERM`, **0 pass / 1 fail / 1 error**. Bounded escalated rerun succeeded: `bun test tools/staging/hosted-setup-artifact-materialize.test.ts --timeout 30000` — **10 pass / 0 fail / 191 assertions**. Retained real-pg observation: `C:/Users/nimab/AppData/Local/Temp/hosted-artifact-materialize-Q9KVKO/observation.json`.
2. Independently authored public-boundary harness, `C:/Users/nimab/AppData/Local/Temp/materializer-independent-qa-01.ts`: **41 PASS / 1 environment failure**. Windows refused creating the synthetic file symlink with `EPERM`, before candidate invocation. Raw result is preserved as FAIL and is not counted as a product rejection or product defect. Result: `C:/Users/nimab/AppData/Local/Temp/materializer-independent-qa-zmgFkL/results.json`.
3. Independent boundary extension, `C:/Users/nimab/AppData/Local/Temp/materializer-independent-qa-02.ts`: **6 PASS / 1 product FAIL** at 16 MiB. Result: `C:/Users/nimab/AppData/Local/Temp/materializer-independent-qa-FEdbRh/results.json`. Its initial aggregate case only established a refusal because it hit MAT-F01 first; the next execution separately exercises the aggregate guard accurately.
4. Independent public threshold and exact aggregate guard, `C:/Users/nimab/AppData/Local/Temp/materializer-independent-qa-03.ts`: **2 PASS / 1 product FAIL** at 4,128,765 bytes. Result: `C:/Users/nimab/AppData/Local/Temp/materializer-independent-qa-6GUqaj/results.json`.
5. Installed strict TypeScript: `bun node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-artifact-materialize.ts tools/staging/hosted-setup-artifact-materialize.test.ts` — **PASS**, exit 0, no diagnostics.

The independent harnesses import the frozen exported materializer, construct their own mutations and expected outcomes, and reuse only synthetic source/real-pg archive bytes and receipt scaffolding generated by the rerun author fixture. They do not import the author's test functions. Each test uses fresh roots and freshly pinned synthetic publication evidence; no historical one-time hosted receipt is reused.

| Retained evidence | SHA-256 |
| --- | --- |
| independent harness 01 | `e8b7d59c29f7efddd40e2773fddf106628521362ee0f482fec5df313f12baae3` |
| independent harness 02 | `2f785b9b35111e613b13e256b89bfd4df446656b430656afc6dbb29cf43ca675` |
| independent harness 03 | `5a4655d02842b578c97442ced586ef50b11dc6c301349848abe662b985c5a1c9` |
| first result zmgFkL | `13daca011aa023746ee6a9107ee7af9548d3d1362473eed6aaeee87e627bd878` |
| second result FEdbRh | `87e8385afc7b39521c3cd159d218ab0239a8411b070aee8af801e1788846ea8e` |
| third result 6GUqaj | `d8c6f802f3ffa52e673a76aff9c4cfb4f76e7b4064eca72acc4fb7f6ff314fad` |

## Limits and handoff

File-symlink fixture creation was unavailable on this Windows host; actual nested junction source-input and destination-ancestor refusals passed. Linux behavior and permissions were not exercised. Requested Windows modes are not ACL isolation. The trusted operator must authenticate the publication digest externally and maintain the host trust boundary; file hashing/extraction does not solve hostile concurrent host mutation or attest already loaded JavaScript. Resolution-only pg checks and the separately observed ordinary import/cache path are not a universal transitive-import sandbox.

The complete final worker dependency release, authenticated publication producer, loaded worker identity, fixed supervisor, credential input, durable one-time journal, one adapter/transaction, preservation/uncertain-COMMIT reconciliation and hosted stop/upgrade remain outside this review. No release or launch permission follows from passing subcriteria. Temporary evidence is retained locally and is not a durable publication artifact by itself; the concrete failing input, exact observed boundary and reproduction are preserved in this tracked report.

Next owner: CEO routes MAT-F01 to the materializer author, then assigns targeted independent review of a newly frozen candidate. QA owns only this report and `operations/agent-improvement/runs/HOSTED-SETUP-ARTIFACT-MATERIALIZE-QA-01.json`; author source, test, runner, CI fixture, Git, shared ledgers and hosted systems were not edited.

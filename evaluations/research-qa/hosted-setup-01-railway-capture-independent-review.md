# Railway capture independent review — Candidate 1

Date: 2026-09-26. Task: HOSTED-SETUP-RAILWAY-CAPTURE-QA-01. Reviewer: /root/compose_qa, qa-lead. Candidate author: /root. I authored none of the reviewed source or tests. Registered critical request: gpt-6-astra/high; observed model/effort unknown. Existing independent reviewer context was reused after refreshing role and workflow guidance. This is technical independence, not professional accreditation.

Verdict: **FAIL** for the original acquisition candidate. Preserve this finding; the repair has a separate review.

## Exact original bytes

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-railway-capture.ts | e6ce72d5b2d33cb8a90ada0e57cb1981d6876fb2b437b7a602505836edbaee3c |
| tools/staging/hosted-setup-railway-capture.test.ts | 3cbfe7e088b25e1e52d55ee9e7f67534f5199145754edde2c21787b60cd3d9c9 |
| tools/staging/hosted-setup-deployment-binding.ts | ddc00cd264cce8c1b49060453fee73c40f96682b3706e33f11ede26d2b0a8333 |
| tools/staging/hosted-setup-deployment-binding.test.ts | 84e7664d4bc8c27886b695f15b59e470f80bf4e26137c4997eec067f76e5ce54 |

## CAPTURE-F01 — P2: executable identity is checked only before version

The public collector checked sha256File once before executing --version. It then executed status and api without rechecking the binary. An executable replacement between these commands, including an update on an otherwise trusted operator host, could supply unpinned capture bytes while the operation still returned its normal evidence envelope. This falls short of pinned-CLI acquisition. It does not itself authorize provider mutation; returned providerMutationAuthorized remains false.

Independent minimal synthetic reproduction: use the accepted hash initially; have the injected execFile return the accepted version and change the runtime's file digest to 64 zeroes immediately after --version; have status/api return ordinary JSON. Candidate 1 returned capture evidence, sha256File call count was 1, and calls were exactly [--version, status, api]. The dedicated independent drift probe passed those observed assertions. No real binary was changed and no provider was contacted.

Required correction: check the accepted executable digest immediately before each provider command, fail before that command on mismatch, and cover replacement after version and after status. This does not eliminate the smaller check-to-exec race; a trusted operator host remains required.

## Preserved execution evidence

Windows, PowerShell, Bun 1.3.12. Candidate tests: `bun test tools/staging/hosted-setup-railway-capture.test.ts tools/staging/hosted-setup-deployment-binding.test.ts`: 13 pass, 0 fail, 85 expectations. The surrounding shell returned 1 because a later unrelated rg search found no matching TypeScript line; the test result itself was successful.

First independent temporary suite: 5 pass, 1 fail, 47 expectations. The one assertion failure was my probe requiring GraphQL field order `id projectId name`; the actual equivalent selection is `id name projectId`. This was a QA harness mistake, not a candidate finding. The executable-drift probe succeeded and established CAPTURE-F01. During the corrected rerun the author had repaired the candidate, and the old expected-acceptance probe instead threw HS_RAILWAY_CAPTURE_STATUS_EXECUTABLE_HASH_REFUSED: 5 pass, 1 fail, 44 expectations. That run is evidence of changed bytes, not an original-candidate pass. The original hashes and failure are preserved here. The author then held the repaired bytes for targeted independent review.

No original-byte TypeScript claim is made: the successful focused TypeScript run occurred after the repair. No source edits, live/provider calls, database actions or Git commands were performed by this reviewer. The separate successor report provides repaired verification and current limits.
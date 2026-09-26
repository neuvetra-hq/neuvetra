# Hosted artifact publisher repair 3 — author report

Task `HOSTED-SETUP-ARTIFACT-PUBLISHER-REPAIR-03`, 2026-09-26. Author `/root/artifact_runner`, software-engineering specialist. The critical registry route requested `gpt-5.6-sol/high`; the inherited follow-up context did not expose its actual model or effort.

## Preserved independent failures

All independent FAIL reports remain unchanged:

| Review | Finding | SHA-256 |
| --- | --- | --- |
| `hosted-setup-01-artifact-publisher-independent-review1.md` | PUB-F01 replacement refs; PUB-F02 optional peer handling | `ec9f86ebcc2ab68a3ba3784c63ce3f3626907d4c6f38977f95fb7288cad94c7f` |
| `hosted-setup-01-artifact-publisher-independent-review2.md` | PUB-F03 unauthenticated nested tree contents | `0f9977a48fe3166159015bcada3ceea37396ff7db9d0db79e670dfdb0bbaa6e8` |
| `hosted-setup-01-artifact-publisher-independent-review3.md` | PUB-F04 publisher accepted a materializer-incompatible directory case alias | `d796cfd6c83e5d2d631d7985e490364ead6f18f9ccae9033336a2a0dc2e62dbf` |

QA3 confirmed PUB-F01 through PUB-F03 repaired, then published a clean reviewed Git tree containing `tools/staging/A/one.ts` and `tools/staging/a/two.ts`. Because the publisher folded only complete filenames, the archive was emitted but the real materializer rejected the aliased directory prefix. This repair preserves that P2 observation and awaits a new independent verdict.

## Frozen repair-3 candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-publisher.ts` | `22a1b40a03ae8981d30586757f08abeea1441502bebd94144e063b9fb1e28dbf` |
| `tools/staging/hosted-setup-artifact-publisher.test.ts` | `5012e505cb783c47af91cf379a12975a74af259de1ebe943cd35593bc262d691` |

Only the assigned publisher source/test and this repair report/run record were authored. No shared Git metadata, provider, database, installed dependency, or real publication was changed.

## PUB-F04 repair

Archive construction now applies the materializer's component-by-component path map before any output path is opened. For every sorted file, each accumulated directory/file prefix is folded to lowercase and bound to one exact spelling. A different spelling for the same folded prefix refuses `ARTIFACT_PUBLISHER_ARCHIVE_PATH_COLLISION`. A prefix already classified as a file cannot become a directory, and an existing directory cannot later become a file at that folded name. Exact/complete-path collisions remain refused.

The same `archive()` path gate builds both source and dependency archives, so both receive identical prefix-case and file/directory collision semantics. Source `node_modules` shadow checking now also uses the materializer's case-insensitive component rule. The materializer was not weakened.

The exact clean QA3 shape is reproduced on Windows with a disposable Git index containing `tools/staging/A/one.ts` and `tools/staging/a/two.ts`, both imported by the committed worker. Git reports a clean exact reviewed HEAD. Publication refuses at archive construction, and the test proves that the source archive, dependency archive and publication receipt do not exist afterward.

A second clean fixture creates a file-versus-directory alias, `tools/staging/Mix.ts` and `tools/staging/mix.ts/inside.ts`, using only disposable synthetic index entries. It also refuses before any output. The positive control commits `tools/staging/alpha/shared.ts` and `tools/staging/beta/shared.ts`; both exact paths and distinct bytes publish and pass the real materializer.

Recursive raw-tree OID verification, canonical commit/tree/blob identity reconstruction, no-replacement Git subprocess policy, commit/blob/tree replacement regressions, nested loose-object refusal, and pg 8.23 optional `pg-native` closure handling remain unchanged and green.

## Validation

- Focused publisher suite: **14 pass, 0 fail, 67 assertions**, Bun 1.3.12. Command: `bun test tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`.
- Combined verifier/materializer/publisher suite: **41 pass, 0 fail, 367 assertions**. Command: `bun test tools/staging/hosted-setup-artifact-source.test.ts tools/staging/hosted-setup-artifact-materialize.test.ts tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`.
- Strict TypeScript: **PASS**, exit 0 with no diagnostics. Command: `bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-artifact-publisher.ts tools/staging/hosted-setup-artifact-publisher.test.ts`.

The new sibling-directory tests, file/directory test, focused suite and combined suite all passed on their first invocation. Final strict TypeScript and final test suites ran after the last source/test change.

## Authority and remaining limits

The public API remains `publishHostedSetupArtifact(paths, policy)`. Successful results retain `launchAuthorized:false` and `productionAuthorized:false`; this repair creates no launcher or production authority. No real artifact was published.

Path checks ensure publisher/materializer archive compatibility for the represented regular-file inventory. They do not authenticate external evidence acquisition, create an atomic filesystem snapshot, attest the runtime/OS load chain, eliminate Git SHA-1 collision properties, or prove the complete runtime-loaded module graph. Independent review of these exact hashes remains required before an authenticated publisher invocation or downstream use.

# M67 native CI test repair supplement

**Verdict: PASS for the bounded test repair and publication.** Actual CI at the new commit and hosted acceptance remain separate gates. The original accepted local review and manifest remain frozen.

**M67-CI-F01:** post-publication CI run 34915807747, native job 104213037853, failed a retained restart-readiness expectation of schema 12 after schema 13 was introduced. Root reported 8 passing tests, one failing test and 118 assertions. Image CI passed; cloud migration had not been applied. This missed regression-test update escaped the earlier local review and is retained as a first-publication failure.

The first local rerun on retained m63_integration refused an unknown or changed historical migration baseline. No historical migration was rewritten. Root then ran the repaired test against the approved disposable schema-13 m67_author database: **9 tests passed, zero failed, 124 assertions**. QA inspected the actual rerun log; execution is attributed to root.

Independent byte comparison proves that reversing exactly two source edits reproduces the original canonical-LF binding: the stale restart-readiness assertion changes 12 to 13; the existing disposable database allowlist adds m67_author. Fixed 127.0.0.1, admin username, and query/hash refusal checks remain. This harness did not previously enforce a port or password restriction, and this review does not claim it does. No assertion was removed. Original CRLF was normalized to LF. Application code, migration, renderer and report template are unchanged by this repair.

This supplement supersedes only the hosted.test.ts entry in the frozen local manifest. The reused reviewer authored prior M63 database work, but neither M67 product implementation nor this root-authored repair. Requested versus actual inherited compute remains unknown; no professional assurance is implied.

| Binding | SHA256 |
| --- | --- |
| Current packages/neuvetra-database/src/hosted.test.ts raw and canonical LF | `986abccbd68015a29311daf5d403a429b994c71035ab9c56b48d82810d21db56` |
| Historical frozen file raw | `cd30c7b6c50c36b2bc45694ceb76b5e24b33631e27c9da87d2447d848d3e1b57` |
| Historical frozen file canonical LF | `5e6cba43e3924a1523712c55c3a4bdd95829b303063e532b3761fa6e7ee84729` |
| .superpowers/m67-ci-native-repair.log raw | `7283dcd4c264b9894cbe57f16b3e98aa3769436af8ed81110083128151249594` |
| .superpowers/m67-ci-native-repair-recheck.log raw | `c3310586b339cd5bdd45c3b526c457a59faadf9c3de39658a7d584c115ea61cf` |

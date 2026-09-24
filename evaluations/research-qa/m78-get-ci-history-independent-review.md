# M78 GET CI history repair — independent review

## Verdict

**Candidate 2 passes for publication.** The verdict binds workflow SHA-256 `4a781055…`, current historical-rejection test SHA-256 `69c819b8…`, and repaired guard test SHA-256 `5426aadc…`. It does not authorize deployment; the six remote checks must pass on the published commit before the deployment admission can exist.

The workflow keeps the same 119 prior test-path occurrences and all four existing test-name filters. It removes continuation2/3 full suites from the current-tree omnibus command, checks out exact ref `1042348f…` under `.legacy-m78`, and runs those full suites plus the unchanged continuation2/3 filtered cases there. It also runs the exact continuation4 173-source-union case there. The current continuation4 portable transport cases remain on current source. The current GET step retains all four existing probe/guard/comparison suites and adds one regression proving that the optimized route is refused by all three historical source admissions.

The frozen local materialization matches all 3,022 tracked blobs at ref `1042348f…`; fourteen PowerShell files are the expected `.gitattributes` CRLF worktree materialization of their Git blobs. The frozen historical inventory remains exact with 173 pins and route `ab5018c…`, while the current route is `fd9b1115…`.

## Preserved first failure and repair

Candidate 1 failed independent review. The workflow still ran the whole current guard suite, whose historical case reconstructed route `ab5018c…` and incorrectly required it to equal the now-optimized current route. That proposed CI command produced 17 passes and one failure. The failure is preserved in `m78-get-ci-history-independent-failure.json`.

Candidate 2 changes only that historical guard assertion. It now reads the original route pin from immutable historical result `c0e7b9d4…`, requires the pin to equal `ab5018c…`, and requires the reconstructed baseline to hash to that pin. The exact historical result and guard source remain unchanged. Current route rejection remains covered by the new historical-gates test.

## Checks

The exact frozen commands pass 19 tests with 1,590 assertions. The current portable continuation4 subset passes two tests with 14 assertions. The repaired current GET command passes 18 tests with 435 assertions. Six independent workflow/source tests pass with 217 assertions, strict targeted TypeScript passes, and the frozen-tree audit reports zero missing or changed tracked blobs.

No database, native service, network, provider, credential, deployment, or Git mutation was used. The private archive's dependency junctions support offline execution only and are not source evidence. The exact Git ref, embedded source archive, frozen pin hashes, and command results provide the source evidence.

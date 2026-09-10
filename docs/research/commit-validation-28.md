# Research checkpoint validation

September 10, 2026. This source checkpoint contains the private EPA research implementation, its required reviewed catalogs and capability metadata, browser behavior, offline evaluators, safe cloud diagnostics and matching tests. It preserves the failed website outcomes described in [diagnostic28](website-diagnostic-28.md). It is not a release, full EPA equivalence claim, benchmark improvement or production deployment.

The candidate comprises46 application files, six EPA data files, six tools, nine source-review records, `.gitignore`, the verification workflow, the diagnostic report and this validation report:71 files. The default derived-aggregate tests now use authored synthetic fixtures instead of ignored historical traces. The workflow adds the cloud observer and factory-injection tests and helper typechecks. Historical raw evidence remains private and unchanged.

## Validation

An isolated source export of the exact proposed implementation passed the underlying workspace checks: nine typechecks, three lint checks, three test suites totaling626 tests/4,750 assertions, and all three web builds. Expanded offline workflow tests passed95 tests/977 assertions; helper typechecking passed. Python research discovery passed20 tests with one Windows symbolic-link privilege skip; the cloud suite passed62 tests. These counts overlap across test commands and must not be added into a unique-test total.

The top-level `bun run check` command itself failed before project execution because Turbo could not discover its package-manager executable in the scratch environment. Equivalent workspace commands were then run individually. The three builds initially failed under sandbox filesystem restrictions and passed in scoped unsandboxed execution; existing large-chunk warnings remained. Installed dependencies were reused through junctions, so this demonstrates isolated source/fixture portability, not a fresh dependency install or actual GitHub CI run. The separate unfinished GHG calculation suite has no passing claim.

The reviewer verified the validation proposal binding and all27 recorded log hashes. No model requests, network calls or live source changes were made by these offline checks. Independent review of implementation and final staged content remains separate from this publication-content scan.

## Publication-content review

The exact71 candidate files were rescanned after the portable-test/workflow changes and final report edits. No credential-token, JWT-like, private-key or private-gold-field signatures were found. Earlier broad assignment/email heuristics resolved to synthetic test fixtures and mock-response strings. No customer-data or private-gold disclosure was identified. This is a bounded inspection, not a guarantee against every possible secret format.

Exclude environment exports, credentials, encrypted state, private operator archives, raw downloads, browser/network captures, private benchmark answers, scratch ledgers, raw conversations and held GHG Protocol expansion candidates. The six EPA metadata/catalog files retain their existing scoped approval; this checkpoint does not expand source-use rights or renew source review. Only the explicit candidate may be staged, preserving the unrelated dirty remainder.

Content review found no publication blocker for those exact bytes. Final index inspection subsequently caught Git line-ending normalization invalidating a pinned catalog hash. A scoped `.gitattributes` addition preserves the exact six reviewed EPA catalogs and four provenance receipts. This adds one file to the checkpoint (72 total); independent review must verify their raw staged bytes and runtime/provenance hashes before committing. The commit remains distinct from merge, deployment or website acceptance.

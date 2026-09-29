# Hosted setup offline artifact publisher: author candidate

Task: `HOSTED-SETUP-ARTIFACT-PUBLISHER-01`. Author: `/root/artifact_runner`, software-engineering specialist with CTO sponsorship. The registered critical route requested `gpt-5.6-sol/high`; observed model and effort are unknown. Independent QA is pending. This task performed no provider or database operation, no live launch, and no Git write in the shared repository. Test-only Git commits were created under disposable temporary directories.

## Frozen candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-publisher.ts` | `02f2ab413ccb8900b9d921d329d86968acd3de46f31d6fb1950b05434f7d04b0` |
| `tools/staging/hosted-setup-artifact-publisher.test.ts` | `5ee8f874c9a36822702d74bea942562babee5d5804f34bddfe7ddd73fdc614b1` |

These are working-tree byte hashes for an author candidate. They are not an accepted snapshot, published artifact, or production authorization.

## Implemented contract

`publishHostedSetupArtifact(paths, policy)` produces the existing regular-file source archive, private dependency archive, and `operator-pinned-publication.v1` receipt expected by `materializeHostedSetupArtifact` and `verifyHostedSetupArtifact`. All three outputs use exclusive creation and the publication receipt is written last. The return value sets both `launchAuthorized:false` and `productionAuthorized:false`.

The source repository must be an exact clean `HEAD` matching the independently pinned reviewed 40-character commit. Cleanliness and `HEAD` are checked before and after construction. Source bytes are obtained only from Git objects using the reviewed commit, never from checkout files. The Git executable itself is an absolute regular file with a separately supplied SHA-256 pin. Selected commit entries must be ordinary `100644` or `100755` blobs.

The fixed source seeds are the worker, bindings, and transactional runner. Bun's TypeScript import scanner expands their relative runtime import closure from commit bytes, including literal dynamic imports. The publisher rejects unresolved or ambiguous imports, non-relative aliases, unpinned external imports, symlink commit entries, and a missing fixed binding. The database package anchor and all 23 ordered migration SQL files are added explicitly. Raw and normalized migration hashes and the canonical migration-manifest hash use the verifier's existing contract.

The dependency input must be a separate private root containing exactly the reachable `pg` package closure. Production, optional, and peer dependencies are resolved using Node-style ancestor locations, and every dependency package identity/version and regular file is archived. Links, nonregular files, hard-linked dependency payloads, missing packages, undeclared extra bytes, oversized entries, path aliases, collisions, and materializer-incompatible layouts fail closed.

The publisher requires three separate evidence documents for PR head, exact-head checks, and independent accepted review. Their SHA-256 pins arrive in policy rather than being derived from the documents. All evidence must target `neuvetra-hq/neuvetra` PR 6 and the exact reviewed commit, remain fresh for no more than 24 hours, preserve review chronology, contain exactly the required successful checks, use distinct operator/reviewer identities, and report zero open material findings. The receipt preserves those evidence pins plus the Git pin in `publisherEvidence`; the independently distributed publication hash therefore binds them.

Runtime, supervisor, and controlled Bun configuration bytes each require an externally supplied SHA-256 pin. The runtime must be the publisher's own Bun 1.3.12 executable, and the configuration must exactly equal the existing controlled `ARTIFACT_CONFIG`. Archive limits match the public materializer.

## Trust boundary and current blocker

The publisher validates externally pinned evidence but does not authenticate the channel that supplied those pins. The trusted operator must acquire and distribute evidence and executable hashes independently. A pinned Git executable does not attest its DLL or operating-system load chain. Import scanning establishes the committed static/literal import and declared package closure; it does not claim to attest every module loaded at runtime. The existing verifier remains explicitly limited to at-rest artifact and private SQL identity.

Cleanliness checks are point-in-time observations on a trusted operator host, not an immutable checkout lease. Output I/O failure can leave exclusively created partial archive files; they are not returned as a successful publication, and a retry must use fresh paths. The caller must keep evidence, dependency roots, outputs, and materialized roots private and outside the source checkout.

The shared checkout cannot currently produce a real artifact. Its reviewed `HEAD` is `d2f0ca16f02bb99801b68a7925f34016f3ba51bb`; `packages/neuvetra-database/src/staging-migrations.ts` is modified, the worker/supervisor/transactional runner remain untracked, and `tools/staging/hosted-setup-artifact-bindings.ts` is absent. The publisher correctly requires these files in one clean reviewed commit. A separate owner must finish and independently review the fixed bindings and integrated source, then commit the exact accepted closure before an authenticated publisher invocation can succeed.

## Validation and preserved failures

`bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-artifact-publisher.ts tools/staging/hosted-setup-artifact-publisher.test.ts`: **PASS**, exit 0.

`bun test tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`: **6 pass, 0 fail, 24 assertions**, Bun 1.3.12. The success test creates a synthetic clean Git commit and private dependency closure, publishes it, and exercises the real materializer and verifier. Adversarial cases reject tracked/untracked dirty source, mismatched head, failed and stale checks/review, missing and extra dependency bytes, path aliases, unresolved imports, missing bindings, and wrong executable pins.

`bun test tools/staging/hosted-setup-artifact-source.test.ts tools/staging/hosted-setup-artifact-materialize.test.ts tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`: **33 pass, 0 fail, 324 assertions**.

The first publisher suite failed all six tests before archive construction because Windows reported the installed Git or Bun executable with more than one hard link. Executable identity already uses exact SHA-256 and real-path checks, so the overly broad hard-link rule was narrowed to dependency payloads. The second suite passed three and failed three because relative import normalization used host path resolution and produced a Windows drive-qualified value; it was replaced with repository-relative POSIX normalization. The third suite passed five and failed one because the missing-binding case correctly failed during the worker's unresolved import before reaching the explicit seed lookup; the assertion was corrected to the actual fail-closed boundary. All final checks were rerun after these repairs.

Independent QA must review the exact source/test hashes before any authenticated evidence is supplied or any artifact is published.

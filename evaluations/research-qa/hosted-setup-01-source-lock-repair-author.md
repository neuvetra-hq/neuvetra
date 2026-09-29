# HOSTED-SETUP-SOURCE-LOCK-REPAIR-01 author handoff

**Role/mode:** security and reliability repair under CTO.  
**Execution context:** `/root/convergence`.  
**Routing:** requested `gpt-6-astra/high`; observed model and effort were not available.  
**Baseline:** local rolling-PR checkout at `f8bde80515ce69830add7ac543bca96cd49c27ff`.  
**Status:** repair candidate implemented and author checks pass; independent QA is required. No hosted action, credential access, migration, deployment, database mutation or Git publication occurred.

## Preserved failed candidate

Independent QA rejected the first candidate's executable-source identity claim. It correctly found that rereading cwd-relative files after imports could hash bytes different from the code already loaded, and that regex import discovery did not cover comments, `require`, computed imports, bare dependencies, preloads, symlinks or junctions. That verdict remains **FAIL for executable-source identity** and conditional PASS only for pinned SQL and single use.

The rejected bytes remain recorded as:

| First candidate artifact | SHA-256 |
|---|---|
| `tools/staging/hosted-setup-source-lock.ts` | `18d6535a50d4049a4d1e9b1e90b965fdfdc00e91762d97499b99916485787592` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `8db78442534d4805ab3a334981ce106cbb23ee1dfea15a7a67a8d81eccf521ee` |
| `packages/neuvetra-database/src/staging-migrations.ts` | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |
| First author handoff | `14d80951aecfefbbd44f720d3b4160845888c7732407b46dd91fbe1e248159f0` |
| Unchanged upgrade runner | `2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c` |

## Repair

The source lock no longer walks or claims to derive an executable closure from files on disk. Its locally proven responsibility is narrower:

1. resolve the repository from `import.meta.url`, never the process cwd;
2. require that the repository root is not a symlink or junction;
3. require every one of the 23 migration files to be a regular non-symlink file whose real path is the expected path under that root;
4. read each migration once, normalize CRLF to LF, validate all ordered hashes, and retain the validated SQL privately in memory;
5. allow the unchanged runner to enter that manifest once, with the exact reviewed head/manifest/closure binding.

Executable identity is now an explicit external operational gate. Lock construction requires a pinned attestation artifact plus a `verifyRuntimeLoadedCode` trust boundary. The verified result must bind the exact current/reviewed head, migration manifest, explicit sorted runtime-source pins and closure hash, current process ID, runtime executable real path, exact source-lock module URL, repository real path, distinct operator/reviewer identities and zero open material findings. It must state that the complete graph was observed by the runtime loader before application imports from an immutable tree. Any preload or custom loader is refused.

This design prevents the source-lock module from treating a later disk reread as proof of what was already imported. It does not pretend that code can attest its own unaltered execution. The future launcher/verifier is a required trust root and does not exist in this candidate. Until it is implemented and independently accepted, no valid attestation can be supplied and the source lock is not an executable upgrade path. That future entrypoint and verifier must themselves be added to the explicit reviewed runtime closure.

The in-memory migration helper remains unchanged from the first candidate. It synchronously copies, validates and freezes all 23 entries before its first `await`; execution uses those retained strings, so later file or caller-object mutation cannot alter executed SQL. The lock remains at-most-once invocation, not a guarantee of database success.

## Adversarial author checks

- Focused source-lock plus unchanged upgrade runner: **14 passed, 0 failed, 90 assertions**.
- Database package regression: **55 passed, 0 failed, 9 skipped, 651 assertions**. The skips are existing actual-PostgreSQL tests requiring an external runtime.
- Focused source-lock TypeScript check with dependency declaration noise excluded: passed.
- Database package typecheck: passed.
- `git diff --check` for the owned files: passed.

The focused cases cover: alternate cwd; simulated symlink file and parent-junction realpath; reviewed-versus-loaded closure mismatch; wrong process, module URL and repository root; incomplete loader graph; preloads and custom loaders; missing required resolution pin; changed attestation artifact; changed current head; changed migration bytes; non-distinct identities; runner-binding mismatch; backing-file mutation after pin; and one-shot execution. The symlink/junction cases use injected filesystem observations for deterministic failure-path testing; independent QA may add a real filesystem reproduction where the host permits link creation.

The normalized 23-migration manifest remains `ec11c9b39bb706f64c970745d0d122ec5fb76b480ea0cd2362d685c8b2620452`.

## Repair candidate hashes

| Artifact | SHA-256 |
|---|---|
| `tools/staging/hosted-setup-source-lock.ts` | `badd0ed72c06c1c5757385b58870d97d6a2d999db83637e98111587b57a87a9b` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `ce940497b2cb8c3165ab644cc802828f3018e6350c97c1e8804f267c597000e0` |
| `packages/neuvetra-database/src/staging-migrations.ts` | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |

## Required independent review

Independent QA should review these exact bytes and challenge the narrowed claim, especially the trust contract of `verifyRuntimeLoadedCode`, same-process and same-module bindings, explicit required pin set, path handling, post-pin mutation and at-most-once state. Acceptance of this component would not authorize a hosted upgrade. Restore acceptance, exact publication evidence, continuous writer stop, durable journal, postcommit reconciliation, and independently reviewed operator/verifier integration remain separate prerequisites.

# HOSTED-SETUP-ARTIFACT-MATERIALIZE-01 — author delivery

2026-09-26. Author `/root/artifact_launcher`, security/reliability implementation under CEO/CTO. Requested critical route `gpt-6-astra/high`; observed model/effort, tokens and cost unknown. Role prompt SHA-256 remains `3b3c1d31d5e5e35bf90ad971d4511a7693b7f14d12f2eb7ac0ed4723cc0b79d3`. Read current AGENTS, role/operating guidance, board/status/continuation and accepted artifact-source QA2. Independent review of this materializer is pending.

## Delivered scope

`tools/staging/hosted-setup-artifact-materialize.ts` materializes two pinned offline archives into new exclusive source/dependency roots outside the declared active checkouts, then invokes the accepted artifact-source verifier against the complete extracted inventories. It returns a frozen materialization capability with `launchAuthorized: false`. It neither installs packages nor executes archive code. Existing destinations are never reused, overwritten, removed or automatically retried. Partial roots are retained after a failure and cannot be passed to this materializer as fresh destinations.

`probeHostedSetupArtifactPgResolution` accepts only a genuine in-process materialization capability, repeats complete verification, and uses a fresh bounded Bun child to resolve the `pg` CommonJS and ESM entrypoints under a fixed private `NODE_PATH`. The function rejects entrypoints outside the dependency root or absent from its exact file manifest. It does **not import pg** and returns `loadedPg: false`, `launchAuthorized: false`. It is not a migration worker or database supervisor.

Only the two new materializer files, this report and temporary synthetic fixtures were written. The artifact-source component, runner, provider, Site API, ledger, Git and live services were not modified. No credentials, hosted DB/provider request, network acquisition, package installation or lifecycle script was used. A separate test imports actual installed `pg` from its new private copy without constructing a client or opening a connection.

## Exact archive format and later publication packaging

The selected format is JSON encoded as UTF-8, with this exact structure:

```json
{"profile":"neuvetra.hosted-setup.regular-file-archive.v1","files":[{"path":"relative/file.ts","kind":"file","contentBase64":"..."}]}
```

Only these keys and `kind: file` are allowed. The archive has no link, directory-entry, device, permission, compression, extraction-tool or script semantics. Parent directories are created by the materializer. Empty files are permitted; empty directories are not represented. Paths must be strictly sorted and unique, with no case alias in either files or directory prefixes. File/directory prefix collisions are refused. Names reject traversal, absolute/drive/ADS syntax, backslashes, controls, Windows punctuation/device aliases, trailing spaces/dots and `.git`. Source files cannot contain a `node_modules` path component; dependency files must begin with `node_modules/`. The latter establishes a separate fixed dependency search root and prevents source-tree package shadowing.

Each archive is limited to 128 MiB encoded bytes, 80 MiB decoded file bytes, 100,000 files, 16 MiB per file and 1,024 bytes per relative path. Base64 must be canonical. All archive bytes, entry metadata, decoded contents and complete publication inventories are checked before the first directory write. Regular inputs and parent/exclusion directories must have matching lexical/real paths; symlink/junction inputs or aliased ancestors are refused. New roots/directories use exclusive creation, and files use `wx`, requested mode 0600 and a file sync. Requested directory mode is 0700. On Windows these mode requests are not a claim of independent ACL isolation: the explicit trusted-operator-host boundary remains.

The existing publication receipt's archive SHA-256 fields bind these exact JSON bytes; no receipt schema edit or signature infrastructure was added. This is deliberately **not** a generic TAR/ZIP extractor. A later trusted publication packager must:

1. Independently authenticate the reviewed PR6 head and required checks. Read only the selected complete reviewed maintenance source inventory from that exact Git tree's regular blobs, rejecting symlinks/submodules/untracked or working-tree overlays; serialize the sorted file bytes in this format. This assignment did not run Git or implement the trusted source producer.
2. Prepare and independently review the exact private installed dependency inventory ahead of execution, flattening the intended ordinary runtime packages under `node_modules/` without filesystem links. Include all files/runtime dependencies required by the accepted worker; reject version conflicts rather than silently picking a version. Capture/pin those bytes in the dependency archive and publication manifest. No install or cache fallback is permitted at materialization/launch time. The test's 14-package `pg` closure is a fixture, not the final complete worker dependency release.
3. Bind both archive hashes, full raw file inventories, normalized SQL pins, runtime/supervisor/config hashes and review evidence in the trusted receipt. Supply its independently authenticated digest through the existing external operator policy. Then use new destination roots for this materializer. The materializer does not authenticate the origin of a self-authored receipt pin.

The final accepted verifier checks the full publication/check/review/config/runtime/migration contract. If that check fails after extraction, no capability is returned and the roots remain as failed evidence. Files are not executed merely because they were extracted.

## Actual Bun 1.3.12 dependency observation

Final retained observation: `C:/Users/nimab/AppData/Local/Temp/hosted-artifact-materialize-LPHqdv/observation.json`. The probe and load children exited.

The author test read already installed `pg` 8.23.0 and its declared production/optional dependency closure, collecting **138 regular files across 14 packages** into a synthetic private dependency archive. It flattened regular bytes; it did not copy the working package manager's symlink layout. The packages observed were `pg`, `pg-cloudflare`, `pg-connection-string`, `pg-pool`, `pg-protocol`, `pg-types`, `pg-int8`, `postgres-array`, `postgres-bytea`, `postgres-date`, `postgres-interval`, `xtend`, `pgpass` and `split2`.

After materialization, a fresh child with cwd in the separate source root and `NODE_PATH=<dependencyRoot>/node_modules` resolved both `createRequire(<sourceRoot>/packages/neuvetra-database/package.json).resolve('pg')` and `import.meta.resolve('pg')` to the pinned private `pg/lib/index.js` under this installed Bun version. Ambient parent NODE_PATH was deliberately wrong and was not inherited. The fixed command uses an absolute pinned executable, `--no-env-file`, `--no-install`, explicit reviewed config, a fixed evaluation script and private home/config directories. It has a five-second exact-child kill deadline and passes no credentials.

A separate test child checked those same entrypoint paths **before** loading `req('pg')` and `import('pg')`. Both exposed a `Client` function; no constructor or connection was invoked. Every observed nonbuiltin CommonJS cache file was within the pinned private dependency inventory. The explicit runtime exceptions were `bun:main`, `node:module` and the fixed source-root `[eval]` entry. This is observed cache evidence for that ordinary import path, **not** a complete runtime-loaded graph or universal transitive-import sandbox.

The test then installed a harmless ancestor `node_modules/pg` shadow whose code would write a marker if imported. The exported resolution-only probe refused the escaped entrypoint, and the marker remained absent. A separate synthetic private package with marker-writing code and a postinstall script likewise produced no marker during materialization or resolution. No package code or lifecycle script executes in those exported components.

The fixed NODE_PATH does not prevent arbitrary reviewed JavaScript from explicitly importing another absolute path. Worker code, dependency content and operator host remain trusted; future worker integration must preserve this fixed environment, run resolution checks before imports and independently test its actual full composition. Do not interpret the two pg entrypoint checks or observed cache as hostile-host protection.

## Checks and preserved first failures

- Final focused suite: `bun test tools/staging/hosted-setup-artifact-materialize.test.ts --timeout 30000` — **10 passed, 0 failed, 191 assertions**, Bun 1.3.12.
- Installed strict TypeScript on the two new files — **PASS**, no diagnostics.
- Negative tests cover wrong archive pin/profile/inventory; traversal, drive/ADS, device and ambiguous paths; all nonregular entry kinds and unsupported metadata; duplicates/case aliases/prefix collisions; invalid base64; source dependency shadowing and invalid dependency layout; existing roots, missing/overlapping checkout exclusions and a real junction parent; concurrent extraction competition; failed final-verifier roots; and ancestor pg resolution escape before import.
- The first suite had **6 pass / 2 fail**: one test expected the word `ancestor`, while a direct junction correctly produced `Nonregular or aliased path refused`; the pg-cache assertion incorrectly classified Bun's builtin/fixed-eval entries as dependency files. A diagnostic rerun preserved the latter failure and recorded the exact three entries in `C:/Users/nimab/AppData/Local/Temp/hosted-artifact-materialize-K8gYYa/first-load-observation.json`. The harness was corrected to allow only those specific runtime entries while requiring every other observed file to match the private manifest.
- The initial TypeScript run failed a test-fixture generic typed-array inference; the fixture parameter now explicitly uses `Map<string, Uint8Array>`. No implementation refusal was weakened to repair those harness failures. An author hardening pass additionally refused Windows console device aliases (`CONIN$`, `CONOUT$`, `CLOCK$`) and reran the final suite.

## Exact candidate and remaining owner actions

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-materialize.ts` | `73355137f1c6cf6adb6d07c97df658cba5350c7cee056a20dcb24843b502adab` |
| `tools/staging/hosted-setup-artifact-materialize.test.ts` | `d867c5e5931fe081bbaf494904ce78ddb5442778aa8d01dfcfaea579f656fc78` |
| Unchanged accepted artifact-source component | `3e1069aba42eca77a861f9c395c966269758a79a16207c53c19b15b6c8d4c691` |

Next: independent QA of these exact bytes, then root's separately reviewed publication producer and fixed maintenance supervisor/worker integration. Authentic publication provenance, complete final dependency release, actual loaded worker identity, private credential input, durable one-time journal, exactly one adapter/transaction, database preservation and uncertain-COMMIT reconciliation remain separate gates. No hosted readiness or launch approval follows from this author result.

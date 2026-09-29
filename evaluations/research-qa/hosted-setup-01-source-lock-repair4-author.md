# HOSTED-SETUP-SOURCE-LOCK-REPAIR-04 author handoff

**Role/mode:** security and reliability repair under CTO.  
**Execution context:** `/root/convergence`.  
**Routing:** requested `gpt-6-astra/high`; observed model, effort, token use and cost were not available.  
**Baseline:** local rolling-PR checkout at `f8bde80515ce69830add7ac543bca96cd49c27ff`.  
**Status:** interface-level repair implemented and author checks pass; separate independent QA is required. No hosted/provider/external-database action, credential access, migration, deployment or Git action occurred.

## Preserved failure history

All four independent failures remain part of the record:

1. F01: cwd-relative regex disk discovery did not prove already-loaded executable identity.
2. F02: caller-owned artifact bytes and reviewed binding values could change across awaits.
3. F03: malformed or absent preload/loader evidence was normalized to empty arrays.
4. F04/F05: a synchronous verifier-returned object could be mutated in the microtask before snapshotting, and malformed traversal paths/non-string digests could enter a matching closure.

Exact preceding artifacts:

| Artifact | SHA-256 |
|---|---|
| Candidate 4 `hosted-setup-source-lock.ts` | `1f022cd69c6a4751807a5dabc61dd94f0f659665754f4c952fc32707e69ba448` |
| Candidate 4 `hosted-setup-source-lock.test.ts` | `9b35a37f1f45b097e3aaac901c66ae0911866eacbc4494f01d8c1f41a00ae1f9` |
| Repair-3 author handoff | `7ec1910811c6d5285de36a4e804829d33a85b1dd78fa093f2c011b585816d5f6` |
| Independent review 4 | `913fb066139725026023ffa28854f0d240e91bc8c31a7c60bd650872b0844ad2` |
| Independent review 3 | `1213a8ef25ee7e19e704d7d8da08773eb32a980168c779ebb4326c562cf00662` |
| Independent review 2 | `1dd64e2e34b08b14571e7f85ec94f69207907ca9a4eb9c31acdcd175f42e34b0` |
| Independent review 1 | `ff50a30843dec6899436b7e6979eaa4b6f291508b317849bf7effc49db437b75` |

## Interface repair

The verifier no longer returns attestation evidence. Its contract is now:

```ts
verifyRuntimeLoadedCode(bytes: Readonly<Uint8Array>): true | Promise<true>
```

The source lock synchronously copies the caller's artifact bytes, validates their digest, decodes them with fatal UTF-8 handling, parses the JSON and strictly snapshots every required value before its first await. That private parsed artifact is the only source of attestation claims.

The verifier receives a separate byte copy and may only authenticate those exact bytes by returning strict `true`. A false or other runtime value is rejected. The verifier's copy is hashed after authentication and again after the later executable-path await; mutation during synchronous-microtask or asynchronous handoff is rejected. A verifier cannot return a mutable parsed object because the interface no longer accepts one.

This interface is materially stronger than delayed snapshotting: semantic evidence and authentication now have separate ownership. The lock owns and validates the invocation-time bytes; the external verifier authenticates a disposable copy of the same bytes.

## Strict runtime-pin schema

Artifact parsing now rejects wrong types before regex or path operations. Each runtime pin must be an object with string `path` and string `sha256`; the digest must match the 64-character lowercase hex form.

A path must:

- be nonempty and repository-relative;
- contain forward slashes only;
- contain no colon;
- contain no empty, `.` or `..` segment;
- resolve inside the attested repository root;
- round-trip from the root to the identical canonical slash-separated path.

Required attestation scalars, integer fields, boolean flags and preload/loader string arrays are also type checked without string coercion.

## Adversarial regressions

The exported API tests now include:

- the F04 synchronous verifier microtask case with an artifact that explicitly declares an unreviewed preload; changing a verifier-owned parsed view cannot erase the private artifact evidence;
- valid asynchronous verifier authentication plus mutation of the verifier byte copy while its promise is pending, which is rejected;
- `zz/../../outside.ts` with a recomputed matching closure and artifact digest, which is rejected as noncanonical traversal;
- a one-element array digest with a recomputed matching closure and artifact digest, which is rejected before regex evaluation;
- strict-true verifier refusal;
- all retained F01 cwd/symlink checks, F02 promise interleavings and F03 missing/null/string/object/empty/nonempty preload and loader cases.

## Author validation

| Check | Result |
|---|---|
| Focused source-lock plus unchanged upgrade runner | 20 passed, 0 failed, 115 assertions |
| Strict focused TypeScript compile for source lock, test and runner | passed, no diagnostics |
| `git diff --check` for the owned source and test | passed |

The database package was not changed and no external database test was run.

## Repair-4 candidate hashes

| Artifact | SHA-256 |
|---|---|
| `tools/staging/hosted-setup-source-lock.ts` | `8201172e25271da9dd3625ece7976dc002639adfb11d9ec9a996e240a82f0a5c` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `0fe36ace2fe71398ca79d9400c164a94fddd9472f9af7ff6da036c1f41500ce2` |

Independent QA should reproduce F04 and F05 against these exact bytes, exercise synchronous and asynchronous verifier behavior, rerun the prior F01-F03 cases, and inspect all artifact fields for coercion or noncanonical forms. Even if accepted, this component would still depend on a future accepted pre-import authenticator/launcher and the separate restore, publication, writer-stop, durable journal, reconciliation and operator-integration gates. It grants no hosted mutation authority.

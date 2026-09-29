# HOSTED-SETUP-SOURCE-LOCK-REPAIR-03 author handoff

**Role/mode:** security and reliability repair under CTO.  
**Execution context:** `/root/convergence`.  
**Routing:** requested `gpt-6-astra/high`; observed model, effort, token use and cost were not available.  
**Baseline:** local rolling-PR checkout at `f8bde80515ce69830add7ac543bca96cd49c27ff`.  
**Status:** repair candidate implemented and author checks pass; new independent QA is required. No hosted/provider/external-database action, credential access, migration, deployment or Git action occurred.

## Preserved failures

The earlier reviews remain failures and are not superseded by author confidence:

1. Candidate 1 incorrectly claimed a cwd-relative regex disk walk proved already-loaded executable identity.
2. Candidate 2 narrowed the claim correctly but retained caller-owned bytes and binding values across awaits, producing F02.
3. Candidate 3 fixed F02 but converted missing or wrong-type preload/loader evidence into empty arrays, producing **SOURCE-LOCK-QA-F03 [P1]**.

Exact immediately preceding artifacts:

| Artifact | SHA-256 |
|---|---|
| Candidate 3 `hosted-setup-source-lock.ts` | `be6f37a7f518c8666d22e13dba734f480adbc56b96b0550186c7e80222b71bd2` |
| Candidate 3 `hosted-setup-source-lock.test.ts` | `baed541188ac15f237c4a757c85dc189c4ec4c81b913fca0bf38cdd79fcdc65e` |
| Repair-2 author handoff | `11cce06da37fd8561fee45c5a967b3770ce65a11bd13945967472a88dd1525b3` |
| Independent review 3 | `1213a8ef25ee7e19e704d7d8da08773eb32a980168c779ebb4326c562cf00662` |
| Independent review 2 | `1dd64e2e34b08b14571e7f85ec94f69207907ca9a4eb9c31acdcd175f42e34b0` |
| Independent review 1 | `ff50a30843dec6899436b7e6979eaa4b6f291508b317849bf7effc49db437b75` |

## Repair 3

`snapshotRuntimeAttestation` now requires `runtimeSourcePins`, `runtimePreloads` and `runtimeLoaders` to each be present as arrays before copying any of them. It no longer substitutes an empty list when preload or loader evidence is missing or has another type. Therefore unknown evidence cannot become an affirmative claim of no preload or loader.

After strict presence/type checks, the function retains the Repair-2 protections: it copies and freezes the verifier result synchronously before the next await. The exported lock still separately requires both preload and loader arrays to be empty, so explicit empty evidence may pass and every nonempty array is refused.

## Exact-artifact regressions

The new exported-lock regression constructs an exact pinned artifact and recomputes its digest for each shape. For each of `runtimePreloads` and `runtimeLoaders`, the test independently confirms refusal when the field is:

- omitted;
- `null`;
- a string;
- an object.

It also confirms that explicit empty arrays construct the bounded lock and that a nonempty array for either field is refused. These checks exercise the actual exported API and a verifier that parses the exact private artifact bytes it receives.

All three F02 timing tests remain in the focused suite and pass: caller byte mutation during pending head observation, caller closure mutation during pending verifier resolution, and verifier-result mutation during the later executable-path await.

## Author validation

| Check | Result |
|---|---|
| Focused source-lock plus unchanged upgrade runner | 18 passed, 0 failed, 109 assertions |
| Strict focused TypeScript compile for source lock, test and runner | passed, no diagnostics |
| `git diff --check` for the owned source and test | passed |

The database package was not changed and no external database test was run.

## Repair-3 candidate hashes

| Artifact | SHA-256 |
|---|---|
| `tools/staging/hosted-setup-source-lock.ts` | `1f022cd69c6a4751807a5dabc61dd94f0f659665754f4c952fc32707e69ba448` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `9b35a37f1f45b097e3aaac901c66ae0911866eacbc4494f01d8c1f41a00ae1f9` |

Independent QA should rerun all eight malformed variants and explicit empty/nonempty cases against these exact bytes, preserve the F02 timing probes, and inspect every required attestation field for similar false normalization. Acceptance of this component would remain bounded: the future pre-import launcher/verifier and the restore, publication, writer-stop, journal, reconciliation and operator integration gates are still absent and require separate review.

# HOSTED-SETUP-SOURCE-LOCK-REPAIR-02 author handoff

**Role/mode:** security and reliability repair under CTO.  
**Execution context:** `/root/convergence`.  
**Routing:** requested `gpt-6-astra/high`; observed model, effort, token use and cost were not available.  
**Baseline:** local rolling-PR checkout at `f8bde80515ce69830add7ac543bca96cd49c27ff`.  
**Status:** repair candidate implemented and author checks pass; a new independent QA turn is required. No hosted/provider/database action, credential access, migration, deployment or Git action occurred.

## Preserved review history

The first candidate remains failed for claiming that a cwd-relative, regex-discovered disk closure proved the identity of code already loaded. The second candidate correctly narrowed that claim to pinned migration bytes plus an external runtime-loaded-code attestation, but independent review 2 found **SOURCE-LOCK-QA-F02 [P1]**: caller-owned bytes and reviewed binding scalars were reread after awaits.

The second failed candidate and review are preserved exactly:

| Artifact | SHA-256 |
|---|---|
| Candidate 2 `hosted-setup-source-lock.ts` | `badd0ed72c06c1c5757385b58870d97d6a2d999db83637e98111587b57a87a9b` |
| Candidate 2 `hosted-setup-source-lock.test.ts` | `ce940497b2cb8c3165ab644cc802828f3018e6350c97c1e8804f267c597000e0` |
| Candidate 2 author handoff | `84c37f8d7bb94350dfa5df55c8779fd5a3efd10ac956b50dcc71ec1ba5c58428` |
| Independent review 2 | `1dd64e2e34b08b14571e7f85ec94f69207907ca9a4eb9c31acdcd175f42e34b0` |
| Independent review 1 | `ff50a30843dec6899436b7e6979eaa4b6f291508b317849bf7effc49db437b75` |

The first candidate hashes remain in the prior author handoff and independent reviews; this repair does not rewrite that history.

## Repair 2

`lockHostedSetupSource` now performs all caller-input capture synchronously before its first `await`:

- copies the reviewed head, manifest digest, closure digest, operator identity, reviewer identity and attestation digest into private scalar locals;
- copies the caller's `Uint8Array` into private bytes;
- validates the private bytes against the copied digest;
- snapshots the dependency function references used later;
- gives the verifier only a second private copy and checks after verification that the verifier did not alter that copy.

The function never rereads the caller's input object after those initial copies. The runner binding and returned inspection are built only from the private invocation-time scalars and digest.

Immediately after `verifyRuntimeLoadedCode` resolves, and before the next await, the lock synchronously copies every required attestation scalar plus every runtime-source pin, preload and loader entry into frozen private arrays and objects. All later checks use that snapshot. Mutation of a verifier-owned result while executable-path resolution is pending cannot change the accepted closure or identities.

The candidate retains the previous narrowed boundary: module-anchored and realpath-checked migration SQL is read once and pinned in memory; executable identity still depends on a future independently accepted pre-import launcher/verifier. No such verifier exists here, so this component remains non-runnable as hosted upgrade authority.

## Deterministic timing regressions

The focused suite now includes the two exact review-2 interleavings:

1. While the current-head promise is pending, the caller replaces the original byte array with a distinct same-length valid serialization. The verifier receives the invocation-time private bytes and the inspection records their digest.
2. While verifier resolution is pending, the caller changes `sourceClosureSha256` from the invocation-time value to the attested closure. The lock rejects against the retained invocation-time binding.

A third test holds executable-path resolution pending, mutates the verifier-returned pin array and operator identity, then confirms the lock uses the synchronous post-verifier snapshot.

## Author validation

| Check | Result |
|---|---|
| Focused source-lock plus unchanged upgrade runner | 17 passed, 0 failed, 98 assertions |
| Focused TypeScript compile for source lock, test and runner | passed, no diagnostics |
| `git diff --check` for the owned source and test | passed |

The database package was not changed in this repair and was not rerun. Candidate 2's prior database evidence remains historical evidence, not a new run.

## Repair-2 candidate hashes

| Artifact | SHA-256 |
|---|---|
| `tools/staging/hosted-setup-source-lock.ts` | `be6f37a7f518c8666d22e13dba734f480adbc56b96b0550186c7e80222b71bd2` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `baed541188ac15f237c4a757c85dc189c4ec4c81b913fca0bf38cdd79fcdc65e` |

Independent QA should reproduce both promise interleavings against these exact bytes, inspect for any remaining use of caller-owned input or verifier-owned results after an await, and challenge the unchanged external-verifier trust boundary. Passing this component review would not authorize a hosted migration; restore, publication, writer-stop, journal, reconciliation and reviewed operator/verifier integration remain separate gates.

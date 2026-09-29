# Independent convergence export review

Review date: 2026-09-25  
Reviewer: `/root/collection_backend`  
Authorship conflict: none; the reviewer did not author the three reviewed artifacts.  
Verdict: **pass with one non-blocking test-clarity observation** for the offline candidate handoff boundary.

## Exact reviewed artifacts

| Artifact | SHA-256 |
| --- | --- |
| `CONVERGENCE.md` | `f2ea1de8ebb2379561c91555368e8977fd46cb02e7c1cdaa7c8bb4da256930e2` |
| `convergence-export.cjs` | `7d58a0d9735ebf593257d8a97b92809683bf58b8238b9e3445547d4f116e7350` |
| `convergence-export.test.cjs` | `22b332fad0cdc5044520c7e8851440a18b1e9ad2ce8c3777a799ec984395294d` |

## Publication normalization verification

Before Git publication, the coordinator reported line-ending normalization from CRLF to LF. The three artifacts currently contain no carriage-return bytes. Their current final LF SHA-256 values are:

| Artifact | Original reviewed SHA-256 retained above | Final LF SHA-256 |
| --- | --- | --- |
| `CONVERGENCE.md` | `f2ea1de8ebb2379561c91555368e8977fd46cb02e7c1cdaa7c8bb4da256930e2` | `f2ea1de8ebb2379561c91555368e8977fd46cb02e7c1cdaa7c8bb4da256930e2` |
| `convergence-export.cjs` | `7d58a0d9735ebf593257d8a97b92809683bf58b8238b9e3445547d4f116e7350` | `7d58a0d9735ebf593257d8a97b92809683bf58b8238b9e3445547d4f116e7350` |
| `convergence-export.test.cjs` | `22b332fad0cdc5044520c7e8851440a18b1e9ad2ce8c3777a799ec984395294d` | `22b332fad0cdc5044520c7e8851440a18b1e9ad2ce8c3777a799ec984395294d` |

The final hashes are identical to the hashes captured during this independent review. This proves that the reviewed bytes were already LF-normalized when the original hashes were recorded; the reported earlier CRLF state predates this review record. No content change was observed between the reviewed version and the final LF publication candidate.

## Review result

The implementation consistently derives the candidate mapping, snapshot digest, evidence manifest, unresolved evidence IDs, preservation flags, and cutover blockers from the embedded source snapshot. `validateHandoff` rebuilds that derived document and rejects stale or independently forged derived mapping claims even when an attacker recomputes only the outer digest. The CLI reads one JSON file, performs offline validation, and reports `cutoverEligible: false`; it has no database, network, import, membership, approval, or mutation path.

The SHA-256 values are integrity checks, not signatures or proof of origin. An actor can change the embedded source snapshot, generated time, revision, evidence metadata, or requested target company and then recompute all dependent digests into another self-consistent candidate. The adversarial check confirmed that a fully rehashed target-company change is accepted as a new requested target, while `authorizationState` remains `must_verify_server_side`, `cutover.eligible` remains false, and a forged derived membership status is rejected. This matches the document's explicit boundary: the hosted server must derive identity and membership, rehash original evidence bytes, reconcile the exact import, and authorize the target before any import or cutover.

No hosted-import claim was found. The decision document repeatedly states that hosted import, migration, evidence transfer, authorization, reconciliation, and cutover are deferred. The module exports an offline candidate envelope only and does not imply that schema 22 can receive it.

## Checks performed

- `node --test convergence-export.test.cjs`: 5 passed, 0 failed.
- Adversarial offline check: a stale target-company edit failed the delivered test; a self-consistent retarget with a recomputed digest validated only as an unverified candidate; a recomputed outer digest could not legitimize a forged derived membership mapping; cutover stayed false.
- Static review confirmed no Postgres client, HTTP client, child process, import command, credential use, evidence-byte transfer, or write action. The only file operation is the CLI's read of the supplied JSON file.

## Non-blocking observation

The test named `fails closed on a changed snapshot or tampered target-company field` exercises stale-digest tampering only. A future maintainer could misread that name as protection against a fully rehashed retarget. Add an explicit regression case showing that a self-consistent retarget remains a candidate with server authorization unresolved, while forged derived mapping and cutover claims remain rejected. This would document the intended trust boundary; it does not block the reviewed offline handoff because `CONVERGENCE.md` already states the limitation accurately.

## Remaining gates

This review does not approve a hosted schema migration, importer, evidence transfer, tenant authorization, company match, production deployment, cutover, or customer-data use. Those paths do not exist in the reviewed artifacts and remain subject to the acceptance gates in `CONVERGENCE.md`.

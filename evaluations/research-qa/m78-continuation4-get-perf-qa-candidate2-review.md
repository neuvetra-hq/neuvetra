# Continuation4 GET performance probe — candidate 2 independent review

## Verdict

**Fail with two material findings open.** The exact candidate 2 snapshot and its embedded files are byte-consistent, and it correctly preserves the candidate 1 measurement instead of claiming candidate 2 generated it. The current route still demonstrably invokes one root `findScope1` and one `findScope1Report` for each report metadata/download/snapshot request. Candidate 2's strengthened SQL guard is bypassable, however, and the executed result does not pin the complete reader source set that produced its native query counts.

## Finding 1: nested SQL calls bypass the allowlist

`assertProbeSqlAllowed` extracts calls with a regular expression whose argument group cannot contain parentheses. In a nested expression it validates the innermost call and can omit the outer call entirely. The following candidate 2 inputs return `true`:

- `select neuvetra.some_mutator(coalesce(1, 2))`
- `select neuvetra.m78_lock($1, coalesce($2, false)) allowed` with `$2=true`
- `select neuvetra.m78_lock($1, (($2))) allowed` with `$2=true`

The second and third forms bypass the stated exact `writing=false` contract. A cast-only expression such as `select $1::neuvetra.side_effect_type` is also admitted without belonging to an exact pinned query set. Exact role and actor setters were correctly restricted in the adversarial tests.

This guard should not be described as a general zero-write SQL barrier. The narrow repair is an exact normalized-template inventory for every SQL statement emitted by the pinned GET readers, including exact setter and lock forms, or a clearly labeled trusted-source drift detector whose safety does not rest on parsing arbitrary SQL. No native rerun is needed to preserve the historical result.

## Finding 2: native measurement source provenance is incomplete

The candidate 1 result pins four files: the route, M78 reader, workspace adapter and executed probe. Full Scope 1 reconstruction also invokes the M71–M77 readers. Their bytes influence the number and shape of queries but were not pinned in the executed result or embedded candidate 1 snapshot. Candidate 2 expands its future `sourcePaths` list to those readers, but candidate 2 was not executed and cannot retroactively bind them.

Therefore `42` direct queries, `86` route queries and the single-sample timings remain historical measurements with incomplete source attribution. Current source inspection plus the counting adapter independently supports the narrower structural fact: each current report route performs one root getter and one report getter, and both getters construct full state.

## Data-digest and timing scope

The executed result records equal before/after digests for all 121 `neuvetra` base-table row sets. That supports no detected row change in those tables. It does not digest sequences, session/database settings, temporary state or external effects, so it is not proof of a generic no-side-effect SQL barrier. The candidate 1 guard defect remains historical and cannot be repaired retroactively.

Each timing has sample count one on a local database. The evidence supports preparing a narrow GET-dispatch candidate to remove the redundant root getter. It does not establish the complete hosted latency cause, an SLA, a timeout increase, a retry, recovery admission or live release.

## Checks

The new offline QA suite has one passing setter-restriction case and three failing adversarial cases that reproduce the findings. QA did not run the native probe, connect to a database or provider, use credentials, or modify existing evidence.

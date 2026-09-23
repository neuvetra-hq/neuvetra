# Continuation4 local GET performance probe

## Result

The read-only local probe passed on the preserved `m78_ops_continuation_20260922` database. All 121 table digests were identical before and after (`cec9b5e4…`), and the probe made zero HTTP POSTs, application writes, hosted calls, provider sessions, clones, resets, or migrations.

Each current report metadata, HTML download, and snapshot route performs two complete Scope 1 state constructions:

| Operation | State reads | Corporate reads | SQL queries | Local elapsed | Bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| direct `findScope1` | 1 | 10 | 42 | 2,093 ms | 4,804,258 |
| direct `findScope1Report` | 1 | 10 | 42 | 1,936 ms | 4,449,183 |
| report metadata route | 2 | 20 | 86 | 3,847 ms | 4,449,183 |
| report HTML route | 2 | 20 | 86 | 3,795 ms | 2,573,401 |
| report snapshot route | 2 | 20 | 86 | 3,648 ms | 1,715,593 |

The independent counting adapter also observed exactly one `findScope1` and one `findScope1Report` call for each route. The retained HTML SHA-256 was `261feea43419c96bd9c1da15507e83a7a282425f1b2adeab0b21b42a894a248a`; the snapshot SHA-256 was `091c6985423c7f936d4524d404b030cc712c315e8ea4f3445a942808f5b7a546`.

These are single local samples, not an SLA or a hosted-time prediction. They demonstrate redundant graph construction and query work. They do not establish that this duplication is the complete cause of the hosted 28–30 second requests or the browser's 90.4-second snapshot.

## Probe guard and preserved failures

The first attempted probe stopped before measurement because it assumed a nonexistent `manager` enum value. The second stopped with PostgreSQL `25006`: the production GET reader invokes `m78_lock`, whose inherited `m71_lock` performs `SELECT … FOR SHARE`; PostgreSQL rejects that shared lock in a transaction declared read-only. Neither attempt created a result or changed data.

Root authorized the successful local probe to preserve the production shared-lock behavior inside normal transactions. The executed candidate1 adapter admitted `SELECT` and `SET`, rejected DML, DDL, known writer function signatures, and required `writing=false` for native M71/M73–M78 lock functions. Root review correctly found that this was a denylist rather than a general zero-write SQL barrier: an unknown SELECT-wrapped mutator or arbitrary SET could pass it. Candidate1 and its result remain exact and rejected for that overclaim. The exact 121-table before/after digests independently establish that the recorded run changed no stored data.

Candidate2 attempted to replace that helper with a SQL parser-style allowlist. Independent review demonstrated three escapes: a nested unlisted mutator, a nested expression hiding a true lock flag, and a schema-qualified cast. Candidate2 is preserved and rejected. It was not used to generate the preserved candidate1 result.

Candidate3 does not try to parse arbitrary SQL. It admits only 20 whitespace-normalized query templates whose SHA-256 values are enumerated in the probe: the workspace role and actor setters, both exact hosted actor/staging-access queries, and the exact lock/register read pairs in M71, M73, M74, M75, M76 equipment, M76 diesel, M77, and M78. It validates exact parameter arity, requires the four dynamic lock flags to be the boolean `false`, requires nonempty actor subjects, and pins the ten source files that contain the hosted subclass and all admitted read call sites. Any unlisted SQL text, custom cast, nested function, custom operator, arbitrary SET, quoted name, CTE, chained statement, or changed caller source is refused before database dispatch. The offline tests include all three candidate2 escapes and the exact hosted preflight forms.

Candidate3 also binds the historical structural count helper to the portable byte-pinned baseline route fixture. The historical candidate1 result and its exact 121-table preservation remain unchanged; candidate3 was not used retroactively and no native database rerun occurred. A future comparative execution must use this finite guard, reverify the pinned source set, and separately pin the before/after route factories.

Independent review then found that candidate3 exported its frozen `Map`. `Object.freeze` does not prevent `Map.set`, so a trusted importer could extend the admitted set in memory without changing source bytes. Candidate4 keeps the template map and source-pin array module-private and exports only immutable numeric counts plus the verifier functions. The exact mutation reproduction can no longer import or alter enforcement state. Candidate3 remains preserved and rejected for this interface gap; candidate4 still has no native rerun.

## Narrow next task

Proceed with one isolated source candidate confined to GET dispatch in `apps/site-api/src/workspace/m78-routes.ts`:

1. Keep authentication, staging access, origin handling, response headers, and all POST paths unchanged.
2. Keep `findScope1` for root register and statement paths.
3. Route exact version requests directly through `findScope1Version`, and exact report requests directly through `findScope1Report`.
4. After the specific getter returns its fully verified state-derived envelope, require exact company, stream, and family identity before returning metadata, proof, export, HTML, or snapshot bytes.
5. Prove response status, headers, and bytes are identical for successful metadata/download/snapshot and version/export/proof paths. Prove unchanged signed-out, outsider, wrong tenant, wrong stream, wrong family, missing record, malformed ID, staging denial, capacity/corruption, and unsupported-method refusals.
6. Repeat this probe on the candidate. The structural target is one state construction and one specific getter per report/version route, with exact 121-table preservation. Treat timings as comparative local evidence only.

This probe supports that narrow candidate because it removes one demonstrated redundant verified-state build. It does not support a timeout increase, retry, skipped proof, broader database rewrite, recovery execution, or any edit to the historical 173-file evidence. A changed router requires independent review, a new source inventory, publication checks, exact deployment proof, and a new runtime/recovery gate before the exclusive read-only recovery may run.

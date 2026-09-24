# M78 finite GET SQL guard candidate 3 — independent review

## Verdict

**Fail with one material finding open.** The source is pinned to guard SHA-256 `b067b047…` and candidate snapshot `c8c731fe…`. No native probe, database, network, credential or hosted action occurred.

Candidate 3 replaces the bypassable parser-like candidate 2 guard with 20 finite normalized SQL hashes and ten exact source pins. It checks parameter arity, requires boolean `false` for dynamic read locks, recognizes both actor-setter spellings and the hosted staging-access query, and preserves the historical candidate 1 result without retroactive attribution. Arbitrary nested calls, casts, writer forms and unlisted SQL are rejected before mutation.

The enforcement Map is exported as `Object.freeze(new Map(...))`. JavaScript freezes the Map object but does not freeze its entries: an importer can still call `.set`. The QA reproduction first confirms an arbitrary mutator is refused, inserts its normalized hash into the exported Map, observes the same arbitrary SQL pass the guard, removes the entry, and observes refusal again. Guard and caller file hashes remain unchanged throughout. The allowlist must remain private; tests can consume a frozen copied list or count that cannot mutate enforcement state. Exported pin metadata should likewise be copied or deeply frozen.

One offline adversarial test passes with five assertions. Strict TypeScript passes with declaration-library checking skipped because the repository's PGlite declarations reference unavailable Emscripten globals; the tested guard and QA code remain under strict checking. Candidate 3 must stay rejected and preserved. A repaired candidate still needs an independent source-to-template inventory, arity/write-flag challenges and the candidate 2 bypass cases before a success receipt.

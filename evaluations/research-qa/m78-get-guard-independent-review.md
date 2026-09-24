# M78 finite GET SQL guard — independent whole-contract review

## Verdict

**Pass for the bounded trusted-source guard.** The receipt binds source SHA-256 `8ffb4f74…` and candidate 5 snapshot `3b83b990…`. Candidate 5 changes tests only from candidate 4; the accepted guard source is identical.

The guard admits exactly 20 whitespace-normalized SQL templates. Independent AST extraction found exactly two allowed static calls in each of the ten pinned caller files: workspace role/actor setup, hosted actor/access setup, and the lock/register pairs for M71, M73, M74, M75, M76 equipment, M76 diesel, M77 and M78. Every extracted template accepts exactly one expected parameter shape. Extra and missing parameters fail; every dynamic lock rejects `true`, numeric, string, null and undefined write flags; actor setters reject empty and non-string subjects.

The candidate 2 nested-call, hidden write flag and schema-cast escapes all fail under the finite set. Independent negatives also cover writer functions, arbitrary setters, CTE writes, chained statements, quoted names, casts and comment mutations. The ten source pins match current bytes. The historical route fixture reconstructs the accepted route exactly and the count probe imports that fixture, so changed candidate routing cannot rewrite the historical structural observation.

Candidate 3 made its enforcement Map public behind `Object.freeze`, which still allowed `.set` and a demonstrated arbitrary-query admission. That failed candidate and reproduction remain preserved. Candidate 4 makes the Map and source-pin array module-private; candidate 5 retains those exact source bytes. Only numeric counts and the guard/verifier functions are public.

## Evidence and limits

Four independent tests pass with 144 assertions. The exact candidate suite also passes four tests with 53 assertions. Strict TypeScript passes with declaration-library checking skipped only because repository PGlite declarations reference unavailable Emscripten globals. No native probe, database, network, credential, provider or hosted action occurred.

This verdict covers trusted pinned caller source. It does not promise isolation from arbitrary malicious JavaScript in the same process, prototype poisoning or modified database functions. The historical candidate 1 result remains unchanged and retains incomplete exact reader-source attribution; this guard does not retrofit it. A future comparison must bind the complete source closure before and after, and its equal 121-table row digests still exclude sequences, settings, temporary state and external effects. This receipt does not accept a native result, hosted improvement, recovery or release.

The coordinator attempted the required fresh Astra/high review, but the runtime rejected dispatch at its agent-thread limit. No fresh worker or requested setting ran. This existing independent non-author reviewer received the refreshed whole-contract brief; inherited model and effort remain unknown. Root separately performed a non-author audit.

# M78 read-only recovery 2 actual evidence review

## Verdict

Pass for the exact closed recovery-2 evidence and the narrowly corrected offline evaluator. The hosted run was not repeated. This review read immutable local evidence and called the evaluator directly in memory; it did not authenticate, call the application or provider, write the database, restart, or revisit.

The recovery closed with 19 main events, 195 diagnostic events, 81 retained response captures and 97 total requests. All application traffic was GET-only, application POSTs were zero, all created sessions closed, and unknown sessions were zero. The observation reconstructs 37 typed records, five reports, 24 roster artifacts, ten Scope 1 sources and the exact company total `126850.17632025`.

## Frozen evaluator failure and correction

The original frozen evaluator fails reproducibly at operation 28. `m78_rebind_fugitive_discovery` contains the exact fugitive-population save fields, but the dispatcher tests the generic `m78_rebind_fugitive_` prefix first and sends the payload to `validateM77SourceSave`, which rejects it with `Exact fields required.`

The corrected evaluator differs by one dispatch-order insertion: it sends the exact discovery name to `validateM77PopulationSave` before the generic fugitive-source branch. The original evaluator, its snapshot and its failed output history remain unchanged.

Independent tests reran all 37 actual request payloads through their intended validators. Every actual payload passed. Adding one unexpected field to each of the 37 payloads was rejected. The discovery payload fails the source validator and passes the population validator, confirming the mismatch was evaluator extraction logic rather than an application payload defect.

The full corrected evaluator was then called directly over the immutable retained files and reproduced the root output exactly. All transport chains, raw captures, production decoders, history, artifacts, source gates, typed operation identities, report identities and totals passed.

## Limits

This receipt accepts the completed GET-only recovery evidence. It does not authorize or establish a restart or revisit. The separate revisit-2 source candidate remains under repair for lock provenance and restart freshness. No success is inferred for that later phase.

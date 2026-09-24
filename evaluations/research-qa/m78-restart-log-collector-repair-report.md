# M78 restart log collector repair

## Verdict

A separate source-only collector is prepared for the already acknowledged recovery2 restart. It does not alter the frozen collector, the original four helper pins, the request, acknowledgment, or any startup evidence. No provider, hosted, credential, database, Git, or restart action occurred.

The two prior read-only collection attempts produced no output because Railway's `--filter staging_started` returned zero bytes. The bounded unfiltered response contained three JSON rows. The relevant row exposes `event` and `timestamp` at the top level; its exact timestamp is `2026-09-23T04:34:08.743321887Z` and its `message` is an empty string. This evidence identifies a parser/filter mismatch. It does not imply a second restart or a completed startup receipt.

## Repair

`m78-recovery2-collect-startup2.py` removes the message-oriented filter and retains the existing bounded request window and 1,000-line limit. It accepts the observed top-level `event: staging_started` shape and the older nested JSON-message shape. It discards all other fields and persists only the exact `{event,timestamp}` record. Exact duplicate records deduplicate; distinct post-request startup timestamps refuse as ambiguous; malformed rows and missing or invalid timestamps fail closed.

All prior admission, request, acknowledgment, fixed runtime, helper-pin, provider-state, chronology, readiness, exclusive-write, and one-unique-startup checks remain. The receipt keeps the existing status and fields and adds `providerEvidence.collector` with the new collector path and its runtime SHA-256. The public adapter permits this additive evidence; independent review must verify it before root executes the collector. The helper never calls `deploymentRestart`.

## Validation and limit

Four focused tests with 10 assertions passed and Python syntax compilation passed. They cover the exact observed flat row, the legacy nested shape, exact duplicates, distinct ambiguous events, malformed input, the unfiltered bounded command, sanitized output, and collector provenance. Tests use mocked provider and readiness boundaries. Actual startup collection remains unexecuted by this preparation.

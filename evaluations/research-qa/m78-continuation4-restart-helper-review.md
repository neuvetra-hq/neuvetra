# Continuation4 restart-helper independent review — candidate 1

## Verdict

**Fail.** The root-authored helpers correctly hard-code the intended deployment, write restart intent and acknowledgement exclusively, preserve the intent on uncertain mutation outcomes, use no retry, and sanitize persisted startup logs to an event name and provider timestamp. Three material admission and attribution gaps remain before any restart.

## Material findings

1. **The restart request is not bound to the independently accepted actual exercise.** `m78-continuation4-request-restart.py` checks the accepted JSON byte pin, a status string, `applicationPostRequests == 37`, `actualRestartVerified == false`, the last journal event's exercise/pass/session fields, and the journal byte hash. A mocked executable case shows that a one-line, non-hash-chained journal and minimal accepted JSON satisfy these checks and invoke the exact provider mutation. The helper does not run the frozen lifecycle evaluator, validate the complete clean journal and diagnostics, or require the independent actual-exercise QA and candidate4 review receipts.

2. **The exercise-acceptance link is not preserved through startup collection.** The request intent records an acceptance path and hash, but `m78-continuation4-collect-restart-startup.py` never reads or verifies them. The observer does not restore this check. A mocked case with a missing path and all-zero hash still writes startup evidence.

3. **Multiple startup events have ambiguous attribution.** The collector accepts every post-intent `staging_started` row in provider output order. The observer selects `starts[-1]`. A mocked unordered pair therefore records the older timestamp as the actual startup. Exact restart attribution should refuse multiple distinct candidates, or use an explicitly justified chronological rule and refuse ambiguity.

## Required repair

Before the provider mutation, bind and revalidate the exact accepted exercise result, complete main and diagnostic journals, gate/source pins, frozen candidate4 evaluator, candidate4 QA receipt, and independent actual-exercise QA receipt. Run the frozen lifecycle evaluator read-only. Carry the pinned acceptance identity through intent, collection, and restart observation. Require one unique post-intent startup event for the exact deployment, with the existing request/collection/observation chronology.

## Evidence and limits

`m78-continuation4-restart-helper-review.test.py` runs three hermetic tests with temporary files and a mocked subprocess. It makes no network call and does not read credentials or write official evidence. All three finding reproductions pass. This review does not execute a restart and is not hosted acceptance.

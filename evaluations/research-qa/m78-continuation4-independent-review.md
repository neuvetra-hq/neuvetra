# M78 continuation4 preparation — independent review

## Verdict

`m78_independent_continuation4_preparation_passed`

Candidate 3 is an acceptable **source-preparation-only** continuation. It binds the exact 173-file source closure and nine historical evidence pins, adds one `fetch` boundary that forces `keepalive: false`, preserves the caller's request, signal, redirect, body, headers, and returned `Response`, and adds no retry. The inherited 30-second timeout remains owned by the existing request code. This review authorizes neither hosted execution nor baseline acceptance.

The reviewed candidate snapshot is `operations/agent-improvement/snapshots/M78-TRANSPORT-CONTINUATION-PREP-01-CANDIDATE3.json`, SHA-256 `14dd03be623702e0c08308e789533f9679b3afa141d46dd915dfb18fa3f8dd2d`. Its seven embedded files rehash to their recorded values and match the live candidate bytes. The exact source receipt has 173 unique paths and SHA-256 `e1d0cd97046e21b308894d5f8757f8fc1fa580550e3ec700aa7ab0e1519bbb92`; every listed source rehashed successfully.

## Independent evidence

- The author suite and independent tests passed together: 14 tests, 450 assertions, zero failures. The independent composed case stopped after three fake logins, performed three logouts, made zero application POSTs, ended with zero unknown sessions, preserved all prior evidence bytes, and observed `keepalive: false`, the original abort signal, and `redirect: "error"` on all eight underlying calls.
- The portable CI subset passed 2 tests and 14 assertions. The exact-173 closure selector passed 1 test and 179 assertions. The workflow adds only those public subsets and the separate public baseline-review suite; it excludes private fixtures, the composed local-only test, and the Python runtime evaluator.
- The private preflight accepted exact temporary copies and refused changed actual/public failure journals, changed prior failure review, changed cleanup receipt, and missing cleanup evidence before network or credential handling.
- The runtime observer differs from its accepted continuation3 predecessor only in the three continuation names. Its 28 offline cases all matched expectations: four positive cases and 24 refusal cases, with network mocked, zero hosted calls, and zero official-output writes.
- The private wrapper checks the exact review, source closure, nine evidence pins, runtime identity/freshness, cleanup disposition, and preflight result before its sole DPAPI unseal. The wrapper, preflight, and observer hashes are recorded in the machine-readable result.

## Preserved review history

The first draft wrapper expected eight evidence pins while the candidate source closure correctly carried nine; root corrected the wrapper to nine. An author integration test initially used fake source hashes and therefore proved only precondition refusal; the independent composed case now exercises the actual public adapter, stop, logout, and evidence-preservation path.

Candidate 1 remains rejected because its snapshot ended with a literal `\\n` after the JSON object. Candidate 2 remains rejected because its embedded source-map artifact ended with a literal `\\n`. Candidate 3 repaired both serialization defects without changing the adapter, test, collector, or fixture bytes. The author run preserves those failed freezes and four rework cycles.

## Limits

No credentials were opened, no external network or database was used, and continuation4 was not executed. The local transport evidence establishes a plausible half-open pooled-socket mechanism and verifies Bun's pooling opt-out locally; it does not establish that mechanism as the cause of the hosted timeout. Provider cause remains unproven. Hosted acceptance requires the separately reviewed admission, runtime, and baseline lifecycle.

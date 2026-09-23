# M78 continuation4 read-only recovery2 preparation

Candidate 1 was prepared on 2026-09-22 as source-only work. It did not access credentials, authenticate, call the hosted application, query a database, change provider state, use Git, or write an official recovery journal. It does not establish an actual recovery2 pass and does not authorize restart or revisit.

Board authorization for the read-only preservation recovery remains in force. The earlier revisit preparation used “blocked” to describe missing technical prerequisites; it did not mean that board authorization was withdrawn. Recovery2 supplies a corrected source candidate for those missing gates.

## Corrected runner

- Pre-authentication admission binds the original failed 37-operation exercise, the exact failed first recovery journal and diagnostics, the corrected independent failure2 receipt, the historical 173-file source closure, and a distinct recovery2 source/runtime gate. The first failed recovery remains explicitly unaccepted.
- All recovery2 evidence uses new exclusive paths: journal, diagnostics, raw application capture, observation, and a separate durable lock. Nothing reads from or appends to the first recovery evidence as an output target.
- The inherited network boundary remains fixed: application traffic is GET-only; authentication permits only token and local-scope logout POSTs; every underlying fetch is called once with `keepalive: false`, `redirect: error`, and a 30-second signal. There are no retries.
- Every application response is streamed within the 10,000,000-byte response limit and written to the exclusive raw-capture JSONL as exact base64 bytes before JSON parsing, text decoding, reconstruction, or semantic validation. The capture stores only allowlisted response headers and a redacted application route. Authentication responses, headers, request bodies, and tokens are never captured. Each entry says `captured_unreviewed`; capture persistence is not an acceptance result.
- Aggregate application response bytes remain capped at 128,000,000. The base64 capture file is capped at 192,000,000 and the main journal at 16,000,000. A capture-storage failure blocks parsing and further non-cleanup traffic.
- The four main actors are checked against exact expected subjects. Diagnostic or capture failures cannot suppress cleanup of already known sessions. A token response already received when diagnostic storage fails can still become a known session and is logged out locally. Results expose only allowlisted failure stage/category fields, never private error or request content.

## Artifact correction

- The corporate, gas, mobile, diesel, fugitive and Scope 1 deterministic artifacts retain their established exporters and byte hashes. Mobile statement keys are exactly `fuel_<id>` and `mileage_<id>`.
- Controlled-fleet and stationary-equipment register reports are treated as metadata. For each of the three fleet and five equipment reports, recovery2 performs exactly one sequential GET to each explicit `/download`, `/snapshot`, and `/proof` endpoint: 24 reads total.
- HTML and snapshot bytes must match metadata SHA-256 and byte-length fields. Snapshots must be canonical, pass the production version/review semantics, reproduce their report HTML, and match report identities.
- Proof is accepted only as the separate exact `{reportId, proof}` envelope. Coverage and workpaper versions are production-decoded, bound coverage and report identity are checked, and reconciliation is independently derived. The canonical hash covers the complete envelope. No proof is read from a snapshot.
- The real archived continuation baseline fixture contains all three fleet and five equipment full report bodies. The focused test rebuilds each historical proof envelope from the exact retained version/review pins and proves the complete mobile, fleet and equipment download maps equal the accepted baseline, including all eight opaque historical proof digests.

## Offline evaluator

- The evaluator binds the journal, diagnostics, raw-capture file, observation and fresh source gate by byte hash and chain head.
- It verifies the exact main actor sequence, fixed auth methods and local logout, the original 16 application reads, the 24 roster artifact reads in order, finite legacy GETs, zero application POSTs, response statuses, terminal counts, and one raw capture for every application response.
- Fresh Scope 1 graphs, all seven registers and all five full Scope 1 reports are bound back to exact captured response ordinals before production decoding. The 24 roster artifact references must resolve to unique captured ordinals with the exact route, status and no-store header.
- It independently reconstructs all artifacts from captured bytes, checks the exact total and report/review history, preserves the pre-exercise inventory, M77 history, all earlier download/M78 bytes and legacy state, validates all 37 request intents and operation-specific typed identities, and requires exactly 37 added typed records.
- The only evaluator success label is `m78_independent_continuation4_readonly_recovery2_passed`. Even that result leaves restart and revisit unauthorized.

## Validation and remaining evidence

- Focused author, evaluator and root security tests: 11 passed, 0 failed, 116 assertions.
- Strict targeted TypeScript over the runner, author tests, evaluator, evaluator tests and root security test: passed.
- Consequential cases include exact failed-evidence/source admission, all eight real nonempty archived report shapes, proof-envelope and historical-byte equality, UTF-8 BOM and malformed-byte preservation, capture tampering, capture-storage failure, diagnostic cleanup failure, token-response diagnostic failure, secret-header exclusion, duplicate execution, application mutation, route/status/auth drift, and changed observation/capture bindings.
- Final source review found that the initial runner text-artifact decoder could strip a UTF-8 BOM after the raw bytes were captured. Before freeze, the decoder was changed to preserve the BOM so HTML and snapshot metadata comparisons reject that byte change; the unchanged evaluator already used the same BOM-preserving decode. The reviewed pre-fix runner hash was `776e7ca6ad2c4ef12baa3a98c3efa1a5844c00a3d57146cef6a895ac369ba5e0`, and the focused 11-test/116-assertion set plus strict targeted TypeScript passed again after correction.

The source candidate has not received independent candidate review. No complete fresh post-37 recovery2 observation exists, so the whole evaluator has not produced a real positive. Before any hosted execution, root must admit the exact frozen source/runtime closure and private wrapper, and independent QA must accept this candidate. Any actual output still requires the full evaluator over the exact captured bytes; a synthetic or empty-report fixture cannot substitute.

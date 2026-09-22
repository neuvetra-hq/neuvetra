# Continuation4 revisit capture independent review

`M78-CONT4-REVISIT-CAPTURE-INDEPENDENT-REVIEW-01` independently reviewed capture preparation candidate 3, snapshot `b823c0b53c9d46046a09c66d798a72882e269f57148571f82bcee663ddbce83c`, plus the private revisit wrapper and entry listed in the result receipt. The review was offline and did not use credentials, a provider, a database, hosted requests, or official journal writes.

## Verdict

Pass with zero material findings open. Candidate 3 preserves the two rejected freezes and closes both independent findings:

1. Candidate 1 buffered complete concurrent clone bodies before enforcing the aggregate limit and did not drain pending clones after a failed core result. Candidate 3 reserves the shared aggregate budget per chunk before retention, cancels the failing clone reader, bounds each response and request count, and drains pending clones after both successful and failed core results.
2. Candidate 2 still typed and consumed six asynchronous register decoders as synchronous values. The actual-baseline-shaped QA fixture reproduced the resulting `registers.corporate.versions` failure. Candidate 3 accepts promise-capable decoders and awaits all seven register families before reconstructing dynamic maps.

The private wrapper validates every gate artifact and all 173 source pins before unsealing configuration, requires a fresh matching restart in revisit mode, passes the exact gate/source closure to the entry, and invokes the revisit-only entry. The private entry rehashes the gate, every gate artifact, and all 173 sources before taking the exclusive journal lock. It refuses an existing observation and delegates to the reviewed capture path. Its failure path releases the lock and does not claim application writes.

The revisit-gate finalizer independently revalidates the accepted exercise, requires this exact reviewer receipt and every reviewed file, binds six successful checks and fresh matching restart/runtime evidence, and creates the revisit gate exclusively before advancing the working gate. The full evaluator rehashes that gate, all gate artifacts and all 173 sources, binds the observation to the journal, gate and source closure, reruns the accepted lifecycle evaluator, and writes only an exact full-pass result with exclusive creation.

## Evidence

- Candidate 3 snapshot JSON parses, its five embedded files match the frozen live bytes, and its hash is pinned in the result receipt.
- The author portable suite plus the actual-response-shaped decoder fixture pass `8/8`; the additional QA actual-baseline-shaped fixture passes, for `9/9` tests and `53` expectations in the combined local run.
- Strict targeted TypeScript passes for the capture, public entry, author tests, QA fixture, private entry and full evaluator. PowerShell AST parsing passes for the private wrapper. The Python finalizer was source-reviewed only and was not executed.
- The actual-baseline-shaped QA fixture uses the immutable local baseline event and the default production decoders. It reconstructs the same register family keys, every dynamic download key, every M78 byte-map key, and 17 legacy record keys. It does not make network or database calls.

## CI and limitation

Portable CI may run `bun test tools/staging/m78-continuation4-revisit-capture.test.ts`; this covers the transport identity, auth exclusion, bounds, cleanup ordering, reconstruction refusal, and exclusive observation writer without private fixtures. The native real-decoder fixture and independent QA fixture are local-only because they read preserved `.superpowers` evidence and should not be added to portable CI.

This is preparation evidence only. It proves capture behavior against local actual-shaped responses and source-reviewed private routing. It does not prove a hosted revisit, a restart, provider behavior, or the contents of a future revisit observation. Those require separately admitted execution and fresh evidence.

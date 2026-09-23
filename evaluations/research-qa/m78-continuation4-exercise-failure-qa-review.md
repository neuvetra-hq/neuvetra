# Continuation4 exercise failure independent reconciliation

`M78-CONT4-EXERCISE-FAILURE-REVIEW-01` reconciles the immutable closed exercise failure. It does not accept the exercise, run the success evaluator, call a hosted service, read credentials, query a database, restart the deployment, or start a revisit.

## Verdict

The exercise remains **failed** with one material finding open. All 37 intended application writes completed as exact ordered operation triples before the failure, but the read-only preservation phase timed out before `exercise_complete` and before the legacy preservation stage. Therefore the evidence does not establish a complete post-exercise state or allow restart/revisit admission.

## Immutable failure evidence

- Main journal: 176 events, 9,378,221 bytes, SHA-256 `44e7bec2d2e6a4a554de6ba23775150bfdf29582fd69ff12bc6cfbc73770ba8b`, head `44817c9e96c62576fe65198ab4ea357ef4a4b212b755f64419e8516496498ab9`.
- Diagnostic journal: 1,350 events, 576,941 bytes, SHA-256 `d77a8f58ec92a0642a5b0b4a91113920ccd4013b9bcfee9a9c7e5de90d93e651`, head `c95e235e08844012639f4a12d969231e3ae7131bb0d419d9ed0de9130b61d48f`.
- The exact accepted baseline prefixes remain unchanged: main 42 events / 9,186,947 bytes / `ef4d8eba...`, and diagnostics 572 events / 243,558 bytes / `b98846b6...`. Both hash-chain parsers accept the full closed files.
- Exercise diagnostic ordinal 384 is the only request error. It is a GET of `application:/workspace-api/workspace/:id/scope1-inventory/:id/reports/:id/snapshot`, categorized `timeout` after 30,011 ms. The main failure stage resolves to the same sanitized route. Ordinals 385–388 are the four successful logout requests.
- The root-collected sanitized provider observation records the matching route as HTTP 499 after 29,965 ms. A later root browser observation records the same sanitized route as HTTP 200 after 90,427 ms. These observations establish severe route latency around the failure; they do not establish its precise internal cause. QA verified the frozen observation bytes but did not independently reproduce the provider or browser calls.

## Completed write evidence

The closed main journal contains exactly 37 `post_intent` / `post_outcome` / `post_verified` triples in the candidate4 recipe order. For every triple:

- the exact expected operation name and resource route match the baseline-derived recipe;
- the outcome status is 201;
- the outcome and verified event bind the same response SHA-256;
- the verified identity has the expected version, review, or report shape;
- dependent reviews and reports bind the version ID and version SHA-256 produced by their preceding version operation.

The 37 verified identities and 37 idempotency keys are distinct. The 37 diagnostic application POST routes match the 37 main-journal routes in order. There is no additional application POST and no repeated writer operation. Five report response identities are present and distinct.

This is response-level write evidence, not a complete final-state acceptance. The harness failed during subsequent preservation reads, so there is no `exercise_complete` state payload and no completed legacy preservation comparison.

## Authentication and lifecycle closure

The exercise created four main auth sessions. All four token calls used POST and returned 200; all four logout calls used POST and returned 204 after the timeout. The terminal records report `allCreatedAuthSessionsClosed: true` and `unknownAuthSessions: 0`. Diagnostics remained healthy and recorded 388 exercise requests, 37 application POSTs, and one request error.

No success evaluation result, exercise-pass QA receipt, restart intent/acknowledgement, restart observation, revisit gate, or revisit observation existed when the receipt was written.

## Safe next admission

Do not rerun the 37-write exercise and do not restart or revisit from this failed admission. First diagnose the snapshot route or explicitly approve a bounded latency policy for that read. Then independently review a new preservation-only recovery that:

1. starts from these exact closed journal and diagnostic hashes;
2. allows zero application POSTs and no automatic retry;
3. freshly reads and decodes the current Scope 1/register state;
4. binds all 37 response identities to the current graph;
5. completes the retained history, legacy, download, snapshot, proof, and report comparisons; and
6. closes all newly created auth sessions before producing a separate recovery acceptance.

Only that new evidence could support a later restart/revisit decision. Disabling fetch pooling did not prevent this timeout, and the provider recorded a long upstream request, so this failure does not establish the earlier half-open connection mechanism.

## Validation and limits

Three local tests pass, including the exact immutable reconciliation and changed-journal/provider-evidence refusals. Strict targeted TypeScript passes. The tests read preserved local evidence only and make no network, credential, database, or official-journal changes. Because they depend on private closed journals, there is no portable CI selector for the actual evidence test.

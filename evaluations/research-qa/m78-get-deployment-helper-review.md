# M78 GET route deployment helpers — independent source review

## Verdict

**Pass for source preparation only.** This verdict binds deploy helper SHA-256 `7ae9267f…`, observer SHA-256 `99cf83b8…`, and portable source archive SHA-256 `831a94cf…`. Neither helper was imported or executed. No admission, provider request, deployment, network call, credential access, database operation, or release authorization was created by this review.

The deploy helper refuses optimized Python, requires an exact root deployment admission, rehashes every admitted pin, and requires both itself and the observer among those pins. It binds the accepted route, current local HEAD, open PR head, all six successful CI checks, a publication observation under three minutes old, exact native result and independent QA, the existing staging deployment identity/commit/image, no other active deployment, disabled auto-deploy, and exact schema-21 readiness. It repeats the CI freshness bound immediately before preparing the request.

The only provider mutation is one fixed-service `serviceInstanceDeployV2` call for the admitted 40-character commit. Before that call, the helper exclusively creates the exact query, a request intent containing prior runtime and admission evidence, and a response file. The response file is open before the CLI begins. A timeout, nonzero return, malformed body, GraphQL error, or missing deployment ID cannot produce success. The query/intent/response exclusivity blocks a blind replay after any uncertain call.

The observer binds the retained response deployment ID to the intent's commit and exact admission bytes. It only lists the fixed staging service and reads auto-deploy/readiness. A non-success deployment writes progress and exits without a runtime-pass artifact. Success additionally requires the exact commit, a valid image digest, no other active deployment, disabled auto-deploy, and exact readiness. It stores the raw deployment collection exclusively, binds its hash/path into the result, then exclusively writes the final runtime-pass artifact. It contains no provider mutation call.

## Review history and checks

Candidate 1 remains preserved. Deploy SHA `36a952b7…` omitted the observer from required admission pins. Observer SHA `44c8aea7…` did not retain the raw deployment collection. The current source repairs both without weakening the other gates.

Seven offline source/adversarial tests pass. They parse the current Python, check exact source hashes and fixed literals, count one deployment mutation and zero observer mutations, verify output ordering and exclusive modes, and reject changed deployment identities, route hashes, QA status, CI success, freshness, active-deployment logic, auto-deploy state, readiness schema, response capture, return-code refusal, and exclusive output modes. The source archive contains byte-exact current and candidate-1 helpers.

## Execution conditions and limits

The deployment admission and all query/intent/response/runtime artifacts were absent during review. Execution must use an exact admission that pins both reviewed current helper hashes, the final published commit and route, the exact native comparison and QA receipt, and the fresh publication-check evidence. The helper will then recheck current HEAD and all six checks; this review does not substitute for those execution-time gates.

The response artifact retains CLI stdout, while the request intent and exact query retain what was attempted. A timeout or CLI-only stderr may leave the response empty; that is deliberately uncertain and forbids retry. The operator must reconcile retained evidence and current provider state before any later action. Progress output is intentionally replaceable polling state; only the exclusive collection and verified result are final observer evidence.

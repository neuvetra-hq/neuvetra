# Bounded baseline failure diagnostic proposal

Supplement to the preserved failure review; no diagnostic host execution authorized or performed here.

Root's provider HTTP artifact (SHA8ff58fb73ecfd9029e7998c4f62786bb04c44d642bdfd7302ebbc72f7fc82d98) records the stationary-diesel statement GET as200,4251ms at18:15:48.318269071UTC. Client cleanup begins18:15:45.677UTC and closes18:15:46.298UTC. Provider timestamp semantics and clock alignment are not established. This supports a server-side200 observation but cannot prove the client received its headers/body. There is no30-second/499 evidence for this failure. Transport/body failure and header/byte comparison remain unresolved; no decoder defect is proven.

Offline retained-snapshot proof found exactly one target statement. Its2279 UTF8 bytes hash to6d48e9797ad2bd6b6bfd4dbdd8d5e082e54aa991935b069691939a1ac5bdfb9b, exactly matching the original successful baseline's actual download metadata. This establishes a consistent historical expectation, not the failed response's current bytes. The original frozen journal was rehashed first.

## Smallest subsequent measured probe

After source review and explicit root admission, use a new standalone read-only diagnostic and new exclusive journal. Never reuse or alter either failed journal. Bind current runtime, the immutable failed baseline gate, this exact target worksheet/statement, expected hash/length and observed actor identity. Authenticate only the existing member, read its session to verify actor/workspace/role, then GET the exact stationary-diesel register and target statement download once each. No application POSTs, retries, recipe continuation, DB access, timeout increase or concurrent requests.

Record separate intent/outcome entries for each GET before cleanup: monotonic elapsed time, phase (`headers`, `body`, `decode`, `compare`), HTTP status, content-type, cache-control, content-length/content-encoding allowlisted values, actual byte length and SHA256, fatal UTF8 decode result, decoded text hash/length, and equality with both freshly decoded register statement and pinned historical expectation. Bound response10MB and retain30-second timeout. Record sanitized error class/code and failing phase; do not log body, URLs with credentials, authorization, tokens, session data or raw exceptions.

Every acquired session must logout in finally, with explicit intent/outcome, unknown-session accounting and terminal closure. Preserve failed outcome separately from cleanup status. An auth response with unknown token outcome fails closed and requires root reconciliation; do not retry automatically. Require exact current register target identity before requesting download. If exact bytes, headers and client delivery all pass, classify this new probe as successful and the original failure as unexplained/transient, not proven fixed. If a mismatch reproduces, stop and repair only the demonstrated layer in a separately bounded task. Either outcome still requires a separately admitted new baseline; this probe cannot certify the full baseline.

Reviewer /root/resume_recipe made no hosted or database calls. Root owns any later execution and release decision. The performance patch has separate independent QA.

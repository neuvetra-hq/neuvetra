# M46 incident and M47 offline remediation

## Status and boundary

M46 remains a closed, failed live attempt. Its H01 result is directional evidence only, its H04 result failed the frozen terminal contract, and the permit-issuer deviation prevents accepting the run as a milestone or publication basis. Every retained M46 byte is pinned by the M47 manifest and is not changed by this work.

M47 is an offline remediation package. Its first frozen candidate failed independent QA because the backend did not validate every permit-chain identity field or impose a freshness bound. The second validated record consistency and freshness but did not require a backend capability preimage. The third required the preimage and caller-claimed process continuity, but a manual Python parent could choose its own valid secret and records and impersonate the wrapper. All three failed packages, QA records and implementation bytes are retained as historical evidence. The v4 package anchors admission to a dedicated compiled wrapper executable. It has no paid authorization, imports no provider credentials, starts no service, and makes no external request. It does not rerun either held-out question and cannot establish live RAG acceptance. Any later attempt needs a disjoint held-out case, fresh evidence, independent QA, cost reconciliation, and board approval.

## Permit issuer repair

The production-equivalent probe requires its workspace directories to exist before issuance. The Python wrapper never recursively creates the OneDrive ingress directories, so an already-present directory is normal and cannot trigger the M46 `EEXIST` failure. It writes an exclusive attempt record and a high-entropy one-use capability. Only the capability hash is persisted; plaintext travels in the inherited child environment and is removed by the Bun child before issuance.

The issuer child publishes one private permit bundle atomically with exclusive create and `fsync`, followed by an independently bound success receipt. A dedicated Bun-compiled Windows wrapper then creates a separate high-entropy backend capability, persists only its hash and process bindings, and gives the plaintext only to the backend child through a scrubbed inherited environment. The backend removes both inherited values immediately, proves the preimage against the wrapper-created metadata, binds its actual parent and child process IDs, writes a one-use consumption receipt, and only then creates the claim and reaches the boundary.

Before admission, the backend queries Windows directly for its live parent executable with Kernel32 `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)` and `QueryFullProcessImageNameW`. It requires the canonical path `C:/Users/nimab/OneDrive/Documents/ChatGPT/Neuvetra/.superpowers/openrouter-47-v4-bin/m47-wrapper-v4.exe` and SHA-256 `ba52fe7dd72eaabc92488e3b4cf386a23f811e760fe7dbaf3eebfe0c58b0c774`. Neither value comes from a caller, environment field or runtime receipt. A manual Python parent with matching records and preimage, a byte-identical wrapper copied to another path, and the canonical wrapper with appended bytes are all refused before claim creation.

The backend validates the exact schema and every run, case, runtime, workspace, process, capability, issuer, permission, evidence and hash relationship in the complete chain. Missing capability, a guessed preimage, parent mismatch, direct invocation, replay, copied workspace, incomplete manual artifacts, wrong-identity artifacts and every injected partial state fail before the callback. Provider secrets and provider-enabled mode are explicitly refused by the offline harness.

Every chain timestamp must be a parseable UTC `Z` timestamp. Attempt, capability metadata, capability consumption, bundle and success times must be monotonic. Each must be no more than five minutes old relative to the backend's current clock, no more than five seconds in the future, and the complete chain span cannot exceed five minutes. The exact age and future-skew boundaries are inclusive; expired, future, reordered and malformed timestamps fail before claim creation.

This proves the live parent matched the frozen wrapper path and bytes at the instant the backend checked it, plus one-use capability possession and child continuity. It is not hardware or administrator attestation. A malicious same-user administrator able to replace the wrapper, backend policy and all runtime evidence together is outside this local control's trust boundary. A later live design must retain OS access controls and independent launch review.

## Question classification repair

The question analyzer now treats a narrow leading application directive such as “Use this guidance to” as connective background when the application already supplies the guidance. The requested calculation, selection, submission, explanation or other material action remains unchanged. Equivalent leading forms using `this`, `current`, `displayed`, or `provided` guidance are covered, including calculate/submit paraphrases and mixed requests.

The rule does not resolve `that requirement`, `that guidance`, external guidance, a reference shown elsewhere, or a non-leading reference. Those remain `context_required` when genuinely unresolved. The original H01 analysis remains unchanged. This repairs the observed old H04 regression without relaxing its expected `action_out_of_scope` result. The old H04 question is a regression fixture only; it is not relabeled as held-out success.

## Rehearsal and acceptance

The disposable rehearsal runs the compiled-wrapper-to-Bun issuer-to-Bun backend chain in a temporary directory under the same OneDrive repository. It proves first clean issuance and backend claim, then refuses a second issuance, direct child use, incomplete manual publication, a complete internally hash-linked wrong-identity year-2000 chain, a fresh schema-correct manual Python-parent chain with a matching preimage, a copied wrapper, a tampered canonical wrapper, and partial publication before the bundle or success receipt. It restores the approved executable byte-for-byte after the tamper probe and deletes all disposable namespaces. The harness records zero provider requests, zero services and external network disabled by construction.

M47 is ready for independent offline QA only when:

- the focused and broader research-composed tests pass;
- the exact M47 TypeScript files type-check;
- the rehearsal output and evidence hashes match the manifest;
- every M46 preservation pin and every M47 implementation pin matches;
- provider request, credential access and service counts remain zero; and
- standalone freeze validation succeeds on stable bytes.

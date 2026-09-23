# M78 continuation4 read-only recovery implementation preparation

Candidate 3 observed 2026-09-22T19:03:11.6334890-07:00. This is a source-preparation result. It does not establish that a hosted recovery ran or passed, and it does not authorize a restart or revisit.

## Prepared boundary

- `check-m78-continuation4-readonly-recovery.ts` refuses before authentication unless the exact failed continuation4 main/diagnostic evidence, accepted baseline prefixes, independent failure reconciliation, historical 173-file gate and a separate fresh recovery source/runtime gate all verify.
- The application transport accepts GET only. Authentication is limited to the fixed token/logout POST routes. Every underlying fetch is called once with `keepalive: false`, `redirect: error`, the original request data and a 30-second signal. There are no retries.
- Logout must carry exactly `scope=local`; default or global logout is refused before transport so the user's unrelated browser session is not affected.
- The runner opens four exact expected actors, records an uncertain session if an auth adapter throws after a token request, retains and logs out any returned session even when its actor identity is wrong, and refuses success until all main and inherited legacy sessions are known closed.
- The graph-first read obtains outsider and signed-out refusals, one manager and one member Scope1 graph, seven upstream registers and exactly five full retained Scope1 report records. Production decoders validate the real shapes. It makes no separate proof/download/snapshot requests; deterministic exporters and the retained report bodies reconstruct those artifacts locally.
- Each streamed response is capped at 10,000,000 bytes and cancelled on overflow. Retained application response bytes are capped at 128,000,000. The journal is capped at 16,000,000 bytes. A journal write failure during logout cannot suppress the remaining logout attempts.
- New journal, diagnostic and observation paths are exclusive. A separate exported lock path is available to the root-owned private entry. Only a fully closed passing run writes the observation; failures never write a success observation.
- Diagnostic storage health is a success requirement. An intent-write failure blocks every later auth/application request. A headers-write failure after an already received token response still returns that response to the auth adapter so the known session can be retained. Local logout cleanup remains available when diagnostics are unhealthy, and repeated diagnostic failures cannot suppress the underlying cleanup calls.

## Offline evaluator

The evaluator binds the exact recovery journal, diagnostics, observation and fresh source gate. It checks the exact main actor order and per-request outcomes, the four initial auth tokens, two authorization refusals, two fresh Scope1 reads, seven upstream reads, five full report reads, legacy auth activity, all logout statuses and terminal request counts.

It then independently uses production decoders for Scope1, all seven upstream registers and all five full reports. It reconstructs artifact hashes again and checks immutable prior history and bytes, unchanged legacy evidence, the exact 37 ordered recipe inputs/outcomes/typed identities, operation-to-record/route binding, exactly 37 added typed records, source union 10, exact total `126850.17632025`, the one reviewed process version, the initial unreviewed inventory version, the reviewed successor inventory version and exactly five reports.

The only possible passing evaluator status is `m78_independent_continuation4_readonly_recovery_passed`. Even that status explicitly leaves restart and revisit unauthorized.

## Validation

- `bun test` over the runner, evaluator and root security regression: 17 passed, 0 failed, 103 assertions.
- Strict targeted TypeScript: passed.
- Consequential refusal cases cover duplicate execution, missing or changed identities, application mutation, wrong actor identity, auth-open uncertainty, decoder failure, per-response overflow/cancellation, logout failure, evidence-write failure during cleanup, bad auth/application methods and statuses, request-count drift, role-order drift, request errors, forged success markers and observation/source-gate mismatch.
- The graph-first transport success case uses an injected local transport and explicitly does not represent a hosted call. A separate accepted-baseline case exercises the production decoders. No native database, credentials, host, provider, Git or official evidence path was accessed or changed.

Candidate 1 is preserved. Independent review rejected it because diagnostic intent storage could throw before logout transport and diagnostic headers storage could discard an already received token response. Candidate 2 makes diagnostic health fail closed for new work while keeping local-scope cleanup operable; the unchanged root-owned regression now passes.

Candidate 2 is also preserved. Finalization review found that it calculated success and wrote the observation before committing the terminal diagnostic event. Candidate 3 commits a healthy passing diagnostic terminal first, then writes the passing main events, and writes the observation last. Any terminal diagnostic failure now returns failed and leaves no observation.

## Remaining acceptance evidence

Independent QA must review this exact frozen candidate. A later full production-decoder positive evaluator exercise requires an actual, separately admitted recovery observation containing the fresh post-37 Scope1 graph, seven upstream registers, five full report records, reconstructed artifacts, unchanged legacy evidence and matching recovery journal/diagnostic/source-gate bytes. The failed exercise journal contains the 37 verified identities but not those full fresh payloads, so this preparation does not manufacture them from exercise data.

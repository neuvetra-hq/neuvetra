# M78 read-only recovery private-helper source review

Reviewed candidate 2 at 2026-09-22T19:15:33.4113179-07:00 in security/reliability review mode. This review covers only the root-authored private PowerShell launcher and TypeScript entry. I authored the underlying public recovery runner, so I am not an independent reviewer of that runner; root independently reviewed and accepted its source-only candidate 3.

## Verdict

**Pass for source preparation only.** The reviewed helper bytes are:

- `.superpowers/m78-readonly-recovery-entry.ts` — `d4a517b1afbf48f135e8caaa2287a7c3b5dd5cc9bb75917e8c935fe9fa53af32`
- `.superpowers/m78-private-readonly-recovery.ps1` — `dba7f41da91c5b26872b8b12cb77c95ed31041bd129a6dfbc6896db62e41f130`

No helper was executed. This verdict does not approve or attest to an execution admission, deployment, hosted recovery, database state, restart or revisit.

## Controls verified

- The launcher validates the admission hash, exact workspace, unique pinned helper set, runtime status/commit/schema/autodeploy/freshness, source gate and every fresh source pin before decrypting any configuration.
- The exact approved encrypted configuration SHA-256 `39a9a9ce6820ad75956ffadb1f23f80359d41c72b18f52674271c44e542d0f8a` is fixed in the launcher, matched to the gate and checked on disk before DPAPI. The entry repeats the gate and ciphertext binding after parsing stdin.
- The entry derives the four unique role/subject pairs from the approved parsed configuration. The public runner compares each returned token subject with that exact derived subject. Candidate 2 therefore does not require subject identifiers in a separately authored plaintext gate.
- Standard input is bounded and parsed through the existing four-role journey validator. The wrapper clears decrypted bytes, sends compressed JSON only through redirected stdin, nulls its object reference, withholds child stderr and prints only the entry's small safe result or a generic failure.
- The entry binds exact failed evidence, the historical gate, the fresh source/runtime gate and all source bytes before acquiring a durable exclusive lock. It refuses any existing recovery journal, diagnostics, observation or lock. Evidence appends are restricted to the three new paths, use exclusive creation for the first record and sync each write. The lock is intentionally retained as the no-replay marker.
- The runner receives the platform fetch and default production decoders. Application traffic remains GET-only through the reviewed public transport; auth is limited to the fixed host's password-token POST and local-scope logout POST.
- The inherited M72 reader is invoked only in baseline mode, with no receipt load and an in-memory save. The actual readiness response must be status 200, ready, schema 21 and legacy-contained before only its schema value is adapted to 14 for the older reader. Its result must have zero application POSTs, all sessions closed and an exact captured baseline equal to the previously accepted legacy value.
- Successful stdout contains only status, request count, application POST count, closure and unknown-session count. Error details, tokens, credential bodies, stderr and decrypted configuration are not emitted.

## Preserved first review failure

Candidate 1 is retained as `m78-readonly-recovery-entry-candidate1.ts` and `m78-private-readonly-recovery-candidate1.ps1`. It was rejected because the admission expected plaintext subject identifiers that were unavailable outside the approved encrypted configuration trust boundary. Candidate 2 replaces that requirement with the exact ciphertext hash trust anchor and derives subjects only after the already approved configuration is decrypted.

## Offline validation

- Static helper contract and adversarial mutations: 3 tests passed, 0 failed, 15 assertions.
- Strict targeted TypeScript over the entry and review files: passed.
- PowerShell parser AST syntax check: passed with zero parse errors.
- Negative mutations cover global logout, exercise-mode legacy replay, wrong readiness schema, prior receipt loading, secret output, removable lock semantics, changed autodeploy expectation, omitted decrypted-byte clearing, stderr disclosure and a changed encrypted-config path.

## Residual boundary

The source has not exercised DPAPI, child-process startup, live gate files, credentials, authentication, network, database or provider behavior. Individual fetches are bounded by the public readers, but this review does not demonstrate total wall-clock duration for the many-request operator process. An interrupted or hung attempt must be treated as consumed when its durable lock exists; no replay is authorized by this review.

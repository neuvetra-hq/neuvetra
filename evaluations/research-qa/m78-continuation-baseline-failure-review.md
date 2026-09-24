# M78 continuation baseline failure reconciliation

September 22, 2026 — reviewer /root/resume_recipe.

The new baseline failed and is not accepted. Offline verification confirms the exact 24-event hash chain, journal SHA8525a8416b3e55f07d508c9a9ec17fc8ac0a4902e798534dc05e9f4df72d1a46 and terminal heade766f74b730bebf69849945407598c011f918b9a77b7ff9c3a5913cd6964f744. Closure at18:15:46.298UTC records67requests, zero application POSTs, four successful main logins and four successful logout204 outcomes, zero unknown sessions. No legacy sessions started; no baseline event was recorded. The normal clean-journal validator and separately prepared success-only baseline reviewer both refuse this failed evidence.

The frozen stage is `read:/stationary-diesel/9533bcde-a376-47d5-ad63-6f243c58e28b/statements/023261c1-8adc-4dd7-a11e-bd2e40b3aa54/download`. The original72-event failed journal and new immutable baseline gate retain their supplied hashes.

## Diagnosis boundary

The harness network helper uses a30-second abort signal and records `lastStatus` globally. Cleanup requests overwrite it, so terminal204 describes logout and cannot establish the failed download's HTTP status. The byte reader can fail on transport/timeout, non200 status, body read, size greater than10MB, missing no-store, invalid UTF8, or the caller's exact expected-text comparison. The catch suppresses the exception. There is no per-read response or exception event. Therefore this journal alone cannot distinguish transport from deterministic response/content failure. The frozen stage names a text download, not a JSON decoder operation.

Root's separately collected provider HTTP evidence is needed to narrow the cause. No retry, reset, replay, harness edit, hosted request or DB request was performed by this reviewer. The failure does not establish loss of retained data; it also cannot certify completion of the required retained-register/download checks. Deployment/source admission and completed local37 evidence remain distinct from this failed hosted baseline.

## Evidence and independence

The failure verifier ran successfully, including rejection by both success gates. Strict targeted TypeScript checking covers both new verifier files. The success-only verifier remains preparation, not an accepted baseline receipt. Reviewer authored the earlier performance patch; independent performance QA belongs to /root/resume_release. This assignment independently reconciles the continuation journal only. Requested security/reliability registry compute is recorded separately; inherited actual compute is unknown.

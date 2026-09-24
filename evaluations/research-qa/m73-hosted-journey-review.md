# M73 independent hosted-journey security review

Reviewer: `/root/m73_cpo`, reused after a dedicated critical-review context was unavailable. Requested `gpt-6-astra` / `high`; actual model/effort are unknown. The reviewer did not author the journey helper or its tests and did not access the host, private configuration, credentials, encrypted archive, Git or browser.

## Current verdict

**PASS for the frozen candidate2 helper and the completed private synthetic baseline.** HJ-F01 is repaired and independently verified. No open critical, high or medium helper finding remains. The baseline reached actual schema15, made zero application POSTs and closed every created Auth session. The schema16 migration, exercise and revisit remain pending, so this is not a hosted M73 release verdict.

## Frozen candidate and checks

Snapshot `operations/agent-improvement/snapshots/M73-HOSTED-JOURNEY-CANDIDATE1.json` matched SHA-256 `996c4a6ae689f97a0a70f9f79c83f454b21275bc8a3b505cdc315526122ed84b`. Both listed files matched:

- `tools/staging/check-m73-hosted.ts`: `8815d7936d7c81dd598f65fe31b21b8eb1a9bd71022a9753cd111d6778999b15`
- `tools/staging/check-m73-hosted.test.ts`: `e2a7098ed208af5273cf1e5cfcb21dbdd00374a3bbda4602dd617f73a4eaff28`

The repaired candidate2 snapshot `operations/agent-improvement/snapshots/M73-HOSTED-JOURNEY-CANDIDATE2.json` matched SHA-256 `e0973c4b542afb43053a20215a89b0f972153cdab1f5703f491b7587e82e88cc`. Its two filesystem hashes matched:

- `tools/staging/check-m73-hosted.ts`: `4de4e97aed62fb82ed6dfd8e1b67952cd44b32edc335ab81162ad8d8ca2bc3d0`
- `tools/staging/check-m73-hosted.test.ts`: `020a3dbe5fc35476126464f01b5363e414dc4f6c208b4fba8a4dee28cf56edd9`

Independent rerun of the final author suite passed **11 tests and 169 assertions**. It covered pinned input and origins, baseline read-only behavior, four-session logout, exact legacy/corporate exports, uncertain POST intent, corrupt/truncated journal refusal, logout and unknown-session failures, missing cleanup receipt, exact one-time exercise/revisit behavior, unexpected private 201 fields and private 403 diagnostics. Independent `m73-hosted-journey-security-contract.test.ts` passed **2 tests and 11 assertions**, additionally challenging encoded traversal, query/credential/port overrides, nonworkflow mutations, journal truncation, event reordering, workspace substitution and predecessor corruption. Combined result: **13 tests and 180 assertions passed**.

The implementation verifies the actual readiness schema before adapting the response for the historical M72 reader: baseline requires actual schema15; exercise and revisit require actual schema16; only then does the injected read-only adapter present schema14 to the older helper. The M72 invocation receives no prior receipt, writes only to an injected in-memory capture, forbids every application POST and must reproduce the frozen M72 baseline. This is a valid compatibility adapter rather than evidence that the host is still schema14.

Every application mutation receives a durable `post_intent` before network dispatch. A successful validated prior outcome is replayed from the journal, not reissued. An intent without outcome, unfinished attempt, failed logout, unknown authentication session, corrupt journal or status mismatch refuses all later network activity. The CLI takes an exclusive lock, appends and syncs each journal line, never imports private data on module load, fixes application and Auth origins, disables redirects, bounds requests and response bodies, and attempts local logout for every captured token. Access tokens and passwords are not intentionally written to the receipt.

## HJ-F01 — unvalidated POST response bodies are persisted

**Severity: medium. Status: closed in candidate2.** The candidate1 generic request function appended the entire parsed POST response to the durable journal before the operation-specific M71 or M73 decoder validated it. It also stored response bodies for expected 401/403 refusal probes. A server regression that returned private diagnostics, an access token or an unexpected field could therefore write that content to `.superpowers/m73-hosted-journey.jsonl` even though the next decoder rejected the response. The original token/password test covered the known fixture response only.

Required repair identified in candidate1:

1. Strictly decode successful M71/M73 mutation responses before appending an outcome, then journal only the canonical validated record needed for safe resume.
2. For expected refusal responses, journal status plus a bounded byte length and SHA-256 observation; never persist the response text.
3. Preserve the existing intent-before-network and orphan-intent refusal behavior if validation or outcome append fails.
4. Add adversarial tests where a 201 body includes an extra `access_token`/private field and a 401/403 body contains private diagnostics. The journal must contain neither and the attempt must fail closed where appropriate.

Implemented result: candidate2 strictly decodes and canonicalizes every successful M71/M73 mutation response before appending it and repeats strict decoding when resuming from an outcome. Expected refusal and unexpected-status outcomes retain only status plus SHA-256 and byte length. An extra-field 201 leaves the already durable intent unresolved, writes no secret and makes the next run refuse before network. Expected and unexpected 403 bodies likewise leave no diagnostic text in the journal. Intent-before-network behavior remains unchanged.

## Actual hosted baseline evidence

The root-controlled candidate2 baseline journal `.superpowers/m73-hosted-journey.jsonl` matched file SHA-256 `22e92d0bac2d73acd585983872895e95173f2c2a33845d1cf3579ade1cc04bd8`. Independent parsing with the reviewed journal reader validated its four-event hash chain: `attempt_started`, `actual_readiness`, `baseline`, then `attempt_finished`. The terminal event's own hash is `3c5909e39274511dd9bb765903a8cecc856c50fd81deedf4f810518bd11060a4`; it is distinct from the whole-file hash.

The recorded readiness is schema15. The terminal record is `passed` with zero application POSTs and `allCreatedAuthSessionsClosed: true`. The baseline event preserves the expected legacy record/download fingerprints and M71 corporate versions/exports. A bounded content scan found none of `Bearer `, `access_token`, `password` or `privateDetail`. This independently verifies the journal structure and recorded result from the saved artifact; the reviewer did not control the hosted requests.

## Boundaries after repair

Baseline must create zero application POSTs and exactly match the preserved M72 legacy and M71 export evidence. Exercise is permitted only after exact schema16 readiness and may perform the named M71 source addition and M73 refusal/save/report/review/correction sequence. Revisit must perform zero application POSTs and reproduce the exact corporate register, M73 register and all downloads from the completed exercise. Every created Auth session must be closed; uncertainty is a terminal manual-reconciliation state rather than permission to retry.

The journey remains a private synthetic operator check. It does not establish production readiness, customer isolation at scale, factor release, complete Scope 1, legal compliance or assurance. The completed baseline and passing offline suite do not substitute for the root-owned migration receipt, exercise, revisit and their logout evidence.

## Candidate3 operator-pin appendix

The separately frozen `operations/agent-improvement/snapshots/M73-OPERATORS-CANDIDATE3.json` matched SHA-256 `6d9cc8f34b0299a6dfaca64aaafe8d33864057b35614f0bd41ff90ca5914d006`; all 11 listed filesystem hashes matched. Relative to the independently accepted candidate2 operator bundle, only `m73-common.ts` and the operating notes changed. The common helper change replaces the candidate2 migration pin with candidate3 migration SHA-256 `aa4968c63087f353b5bf80d64bced67270bc5ad17f715393b40313bb57f7f732`; operating behavior is unchanged. Static reinspection confirmed the exact15 baseline, full locked inventory, runtime posture, rollback/unknown-outcome and fresh receipt gates remain intact.

Author evidence `.tmp/m73-backend-candidate3-evidence.json` matched SHA-256 `b74bae38f1d297941c7e831b34a3d2336af2b11b6b1cc82231b75ec05dc596f5`; its uniquely named fixture is `.tmp/m73-native-fixture-m73_author_13.json`, SHA-256 `4a87306bf01bb1359b7c62c49e26759b25bd98fda4cd690ef48ecef477b29c59`. The recorded author runs report three backend tests/85 assertions and six operator tests/51 assertions, including exact15 restore, forced migration rollback, successful candidate3 apply and reapply refusal. These are supporting author artifacts; the earlier independent recovery review remains the authority for the unchanged backup/restore behavior. The candidate3 pin update is accepted for the root-controlled migration gate, subject to the same fresh baseline, receipt and maintenance requirements.

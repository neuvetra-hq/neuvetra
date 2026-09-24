# M78 hosted journey independent review

## Scope and verdict

Candidate4 journal/authentication harness and the revised root source-admission wrapper are accepted for preparation. This is preparation evidence; no hosted execution is approved by this report alone.

Reviewer `/root/m77_backend` did not author `check-m78-hosted.ts`, its author tests, or root's private PowerShell wrapper. The reviewer authored imported M78 backend and separate hosted database adapter; this review does not independently reapprove those imports, accounting policy, source recipe, database recovery, or actual deployed behavior. Requested security-reliability Astra/high could not be freshly routed; inherited settings remain unknown. No network request, private config/credential read, host write or Git action occurred.

## Exact reviewed sources

- Author candidate4 snapshot: `operations/agent-improvement/snapshots/M78-OPERATORS-01-HOSTED-CANDIDATE4.json`, SHA256 `1f7e00c39c9fd08dd977c99e7fe45530600bb4af396e138392ff3bfa0b78b043`.
- Harness: `tools/staging/check-m78-hosted.ts`, `f853630d19db560e90ec1488473c3bb949621c4b0615b31b21f31d828e6af941`.
- Author tests: `tools/staging/check-m78-hosted.test.ts`, `e395e62cc154b35783efa4aa043e4c39da66750bbc1837aa82d55fb1f36e8f4c`.
- Operator plan: `docs/research/m78-operator-plan.md`, `c3b31321d037b3797b5cf29d7fd503264a7f1fc2592c9de4045904004aae99a8`.
- Root recipe inspected without edits: `tools/staging/m78-hosted-plan.ts`, `c91990277ab49821cb8bd8d0fa62b71bf3de09e627768278775335828a1409cd`; its independent recipe approval belongs to the separate QA review.
- Root private wrapper source only: `.superpowers/m78-private-journey.ps1`, `41158e4212ac4cf14f0b09cfe29aedc2fd4c0c7b478860d5a215e309254cbc6c`. Its referenced encrypted configuration was not opened or executed.

Snapshot entries independently match actual raw bytes, LF hashes and text. Root must additionally verify staged/committed blob equality before publication; this turn used no Git.

## First finding and repair

**HJ-F01, candidate3, reproduced then repaired.** A fully rehashed closed synthetic 0/41/0 journal admitted a coordinated 201 intent/outcome pointing to a foreign tenant `/members` route, and admitted an empty `post_verified.verifiedIdentity`. Runtime network guards already refused those routes; the defect concerned durable evidence admission on a later attempt. Original reproduction is retained in `m78-hosted-journey-first-probe.ts` and `.json`; no original evidence was overwritten.

Candidate4 applies the route guard to each retained intent. Verification requires a matched successful 201 intent/outcome, hash agreement, UUID identity with allowed fields, valid optional hashes, and matching company identity where present. An initial provenance event is required. Independent fully rehashed variants for foreign tenant, same-tenant administrative endpoint, empty identity, foreign company, forbidden credential-like identity field, invalid digest, mismatched response hash, false zero-write count, legacy503, and failed terminal attempt now refuse admission.

## Actual checks

- Author pure suite executed independently: **9 passed /74 assertions**.
- Reviewer focused suite `m78-hosted-journey-independent.test.ts`: **4 passed /193 assertions**.
- Strict targeted TypeScript over harness, author tests and reviewer tests: passed.
- Machine evidence: `m78-hosted-journey-final-checks.json`.

Tests inject only synthetic transport, predecessor lookup and append functions. They make no real network calls and need no private predecessor files. Production lookup retains exact full M77/M76 journal hashes/heads, rather than test injection or a rewritten predecessor. These checks do not constitute a native 41-operation lifecycle or real provider authentication demonstration.

## Control conclusions

**Durability and unknown outcomes.** An intent is appended and synced before a write. Response hash/length/status are retained before semantic verification; successful decoded identity is retained separately. Ordered matched outcomes, success verification, terminal markers, exact38 successes plus3 authorization refusals, legacy read, four main logout outcomes and passed closed attempt are required before another phase. Failed, partial or uncertain journals stop before gate admission/network activity; no POST retry exists. Baseline/revisit transport refuses application POSTs. CLI uses an exclusive persistent lock and never resets the journal. Append failure may leave invalid durable bytes, deliberately preventing replay.

**Authentication cleanup.** Observed tokens are stored before subject/status/audit success checks and closed in `finally`. Reviewer independently injected main Auth intent/outcome and logout-intent append failures: no unknown write retry, all observed login tokens closed, no sensitive marker retained, subsequent attempt refused. A login transport failure leaves an explicit unknown session and `allCreatedAuthSessionsClosed=false`; it is never represented as clean closure. Legacy outcome or logout-intent append failures still return known login responses to the frozen helper or perform logout, while final verification fails. Provider-side unknown sessions require separate operator diagnosis; these tests do not revoke unknown tokens.

**Fixed authority and accounting.** Runtime routes pin Neuvetra/Auth origins, tenant path, supported methods, no URL credentials/query/hash, no admin transport, and writes only during exercise. Fixed recipe count is41; cumulative contributors determine eligible configured manager reviews. Unknown/incomplete inventory remains explicit. Source gate verifies actual migration/recipe/harness files; root's wrapper verifies pinned artifacts, runtime commit/schema/freshness, accepted M77 bytes, and exact complete source closure before unsealing credentials. Review/recovery hashes are caller attestations, not an identity or approval service. The revised wrapper enforces complete transitive source admission as described below.

**Capacity.** The actual UTF8 limits are128MB total journal,50MB each baseline/final event,220KB intent,4KB verified identity and64KB other event. The fixed three-phase schedule maximum is119,668,000bytes (two large records,41 intents,38 verifications, at most164 other records), below128MB. Verified events avoid repeating full report bodies; final register and exact download evidence remain retained. Reader and writer enforce byte limits, including oversized fully rehashed evidence refusal. An earlier append/capacity failure cannot be resumed automatically. This fixed bound does not claim arbitrary future recipes fit.

## Root admission boundary

The initial wrapper mandated only four paths and did not establish full imported source closure. Root repaired this during review. The revised wrapper first validates every supplied hash, requires the pinned independent review JSON status `m78_independent_hosted_journey_preparation_passed` with reviewer distinct from root and exactly equal source map, then runs its already pinned read-only `m78-journey-source-pins.ts` helper and requires exact sorted closure equality. The helper recursively reads all relative literal static/dynamic imports, includes itself, all21SQL and `bun.lock`, refuses unresolved/out-of-workspace dependencies, and hashes actual bytes. Independent checks confirm repeated stable output, dynamic report imports, migration count, every output digest, and all closure/status/route/predecessor checks preceding `Unprotect`. No private wrapper execution or configuration read occurred.

Source closure includes imports whose previous independent approvals remain separate; inclusion is byte admission, not fresh semantic reapproval by this reviewer. Root must independently bind the exact published commit/checks, current recovery artifacts and fresh runtime evidence, and verify the reviewed private wrapper hash at launch. Review/recovery identity fields remain controlled operator attestations rather than a cryptographic approval service. No actual admission or hosted execution is claimed.

Final combined pure run:13passed267assertions; strict targeted TypeScript including closure helper passed. Closure helper SHA256 `f1978cf8da61af87f4d25845e974ee94365e429c413d6a7ef027763b5345a224`.

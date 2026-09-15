# M67 authorization lifetime repair review

**Verdict: PASS for the exact local repair and publication. Actual repaired-image CI and live correction-form verification remain pending.** Original local review, CI repair supplement and migration/report bindings remain frozen.

M67-AUTH-F01 is a post-local-acceptance defect observed by root on the hosted annual worksheet: twice selecting correction briefly removed navigation and then returned to the default worksheet instead of retaining the form. Source inspection found every provider auth event invalidated the workspace, including same-user SIGNED_IN events that can accompany focus. This is a supported causal explanation, not an observed provider event trace. Successful API checks did not detect the mounted-form lifetime failure.

The repair separates authorization request generations from the lifetime of a verified workspace. Verified same-user/role/workspace/evidence responses preserve its actor object, controller and React key, and update the token used by retained request closures. Authority changes abort the prior lifetime. Generation checks discard stale results; old actor callbacks cannot invalidate a replacement. A new successful authorization can restore a closed workspace with a new epoch. Explicit local sign-out blocks late non-null sessions until sign-in is permitted; cleanup cancels both authorization and active work.

QA independently ran **20 tests / 105 assertions**, comprising seven newly authored race challenges (31 assertions), seven author component-wiring tests (50), and six existing session tests (24). New cases challenge duplicate-event coalescing, old successful refresh overwriting newer token/evidence, immediate subject transition, stale unauthorized callbacks, provider sign-out during refresh, latest refusal followed by stale success, explicit re-sign-in, disposal, and synchronous verifier failure. All passed on the final helper guard. The component tests execute the actual subscription/effect/JSX/action code with injected hook/provider boundaries; they are not React DOM or real browser focus tests.

Root separately reports the actual staging build and full site-web suite passing (89 tests / 396 assertions), preserving the bundle-size warning. Product scope is exactly the three author files below; the fourth is independent QA. No migration, arithmetic, immutable report bytes or database behavior changes. Existing Docker web source-directory COPY includes the new browser helper; actual build verifies resolution. No cloud calls or product edits were performed by this reviewer.

Prior M63 authorship and reused QA context are disclosed; no M67 product or auth-repair authorship. Requested critical compute is not evidence of actual inherited settings. This review grants no professional assurance or customer-release approval.

| Exact file | Raw SHA256 | Canonical LF SHA256 |
| --- | --- | --- |
| apps/site-web/src/components/PrivateStaging.tsx | `f396519817fcac2fb94c003fb46ab06a4fa02130add170e4cac73dc8df4a9080` | `f396519817fcac2fb94c003fb46ab06a4fa02130add170e4cac73dc8df4a9080` |
| apps/site-web/src/lib/staging-authorization.ts | `057d39f8ebb67e00977f9bc0869b0021c9eae9e979deee1665b6b42e04eabe66` | `057d39f8ebb67e00977f9bc0869b0021c9eae9e979deee1665b6b42e04eabe66` |
| apps/site-web/src/lib/staging-authorization.test.ts | `4200628bc1e2713a849508cacfda5a3ca79436ff2c0f3a4e129e8123b622c78d` | `4200628bc1e2713a849508cacfda5a3ca79436ff2c0f3a4e129e8123b622c78d` |
| evaluations/research-qa/m67-independent-auth.test.ts | `aea69e61ef58e553d05b910a18b91550c15c00d28d3f0447a4a00445bfb2d5c3` | `aea69e61ef58e553d05b910a18b91550c15c00d28d3f0447a4a00445bfb2d5c3` |

Root must verify staged/committed bytes and new image CI. After deployment, exercise an unsaved annual correction across focus/auth refresh, then save and reload with preserved prior versions/reports. Hosted evidence and board acceptance require a later handoff; this supplement does not imply they passed.

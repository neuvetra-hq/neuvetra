# M50 v2 remediation: bounded blocked handoff

M50 v2 is an offline repair draft for the independently rejected M50 v1 adapter. It is not a paid authorization, a frozen candidate, or evidence of a live model result. No credential, provider, external network, or paid activity occurred during this work.

## What the draft demonstrates

The focused provider-disabled tests pass 9 tests with 36 assertions. A targeted TypeScript check over the core v2 runtime, capture, spending, grading, preflight, and tests also passes. The provider-disabled composed runtime reached the intended `analyze`, `plan`, and `verify` sequence through the real local request builder and spending integration, captured each stage separately, settled three synthetic native-cost envelopes, wrote payload/cost/terminal/shutdown records, and exited without leaving listeners on ports 3012, 3016, 5174, or 5175.

These checks demonstrate repairs for the eight v1 findings within the tested core:

1. Runtime code uses a separately generated one-way evaluator fingerprint denylist and does not read the exact evaluator key. The post-shutdown grader is the only v2 component that reads that key.
2. Successful terminal state requires a durable exact cost seal; uncertain or failed state records settled, pending, and uncertain amounts without claiming an exact total when uncertainty remains.
3. The provider-disabled rehearsal traverses the composed server, request builder, payload validator and capture, and spending path. Synthetic envelopes enter only after validated capture at the disabled transport boundary.
4. Stage identity is explicit, so the two Opus stages are distinct, and each outbound payload is checked for exact endpoint, model, route, source boundary, and disabled plugins/tools/web before dispatch.
5. Stop is idempotent, clears the supervisor timer, prevents duplicate terminal/shutdown writes, and exits cleanly in the focused paths.
6. Request failure writes terminal failure, cost state, payload-seal state, and controlled shutdown records.
7. Preflight checks short authorization freshness and expiry, exact candidate/review bindings, account controls, reservation, and one-time consumption.
8. The v2 draft keeps `paid_authorization` false; earlier M49 approval is scope intent only and is not a consumable M50 authorization.

## Blocking condition

The dedicated wrapper executable at `.superpowers/openrouter-50-v2-bin/m50-wrapper-v2.exe` is 116,286,552 bytes with SHA-256 `9995fb8c0412001b12bb5712d9bd8581c8f36eb46234da6b4c922598d37bd6e1`. Windows refused to start these exact bytes with `An Application Control policy has blocked this file.` Code Integrity Operational events 3033 and 3077 at 2026-09-12 15:00:06–15:00:13 Pacific report that the file did not meet Enterprise signing requirements or violated policy `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`. The structured evidence is in `operations/m50-v2-windows-code-integrity-block.json`.

The wrapper executable is the security boundary that gives the backend an externally observed, frozen parent image path and hash. A Python or script substitute would weaken that reviewed launch contract, so the script exploration at `.superpowers/openrouter-50-v2/approved-wrapper-script.ts` is an unapproved draft and is excluded from any freeze. The current `backend-cli.ts` is likewise a draft after that exploration and is not a frozen production path.

## Checks that remain unrun

- The final exact executable has not completed the wrapper-to-issuer-to-backend rehearsal after the last repair.
- Direct/manual/copy/tamper/replay refusal has not been rerun against a final executable admitted by Windows policy.
- A complete v2 suite including the dedicated wrapper lifecycle has not run on the final bytes.
- No final integrated v2 candidate, manifest, freezer output, or independent QA review exists.
- No live launch preflight, account refresh, credential isolation test with an admitted final wrapper, provider request, grading, or cost reconciliation occurred.

## Supported remedy

The Windows administrator or application-control owner must approve the exact final wrapper under the enterprise policy. A publisher signature trusted by the policy is preferable; an explicit hash/path/publisher allow rule for the reviewed executable is another policy-owner option. Signing changes executable bytes in typical workflows, so the allowed final file must be hashed again, its parent-image pin updated, and the complete provider-disabled lifecycle, tests, type checks, freeze, and independent QA repeated. `Unblock-File` is not an appropriate remedy for this enterprise policy and was not used.

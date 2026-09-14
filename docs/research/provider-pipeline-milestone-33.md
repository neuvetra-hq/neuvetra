# M33 — offline provider pipeline contract repair

Date: September 10, 2026  
Status: offline implementation and independent QA complete; no live verification or release acceptance

## Board outcome

M33 separates provider identity from router processing integrity without accepting any new provider behavior. A response can still pass only when `openrouter_metadata.pipeline` is absent or an empty array. A malformed value or any nonempty array stops before model content is accepted, parsed or displayed.

The prior M32 trace proved only that the `pipeline` predicate failed. It did not retain the received value, so M33 does not infer its shape, stage type, name, data or cause. M32 remains closed and unchanged.

## Current primary-provider evidence

The implementation decision uses OpenRouter's current official documentation, inspected September 10, 2026:

- [Router Metadata](https://openrouter.ai/docs/guides/features/router-metadata), sections **Field Reference**, **Pipeline Stages**, and **Stability**: `pipeline` is an optional `PipelineStage[]`; emitted entries describe plugins that materially affected the request or response; stage types may grow; unknown stages are opaque; additive metadata should be decoded permissively.
- [Plugins](https://openrouter.ai/docs/guides/features/plugins/overview), sections **Default Plugin Settings** and **Plugin precedence**: request settings can disable account-default plugins unless an organization setting prevents overrides.
- [Message Transforms](https://openrouter.ai/docs/guides/features/message-transforms), context-compression section: context compression changes prompt content and can be explicitly disabled in the request.

This evidence supports permissive decoding of unrelated additive metadata. It does not support admitting a nonempty pipeline under Neuvetra's current no-provider-effects policy. No exact benign nonempty form is documented or approved for this application.

## Implemented contract

The OpenRouter adapter now applies two gates in order:

1. Strict identity still requires the exact requested/response/selected Anthropic model, direct strategy, one successful attempt, non-BYOK routing, acceptable cache state, and consistent endpoint and attempt evidence.
2. Pipeline processing integrity accepts absence or `[]`. A non-array returns the finite private label `shape`; a nonempty array returns `material_effect`. Neither the pipeline value nor nested metadata is retained.

Both labels produce `provider_failure`. Valid same-response HTTP-200 cost may settle once independently, but no accepted identity record, answer, claim, evidence or partial model text is created. Missing or invalid cost remains uncertain under the existing stop policy.

The safe diagnostic contract advances from `private_failure_detail.v2` to `private_failure_detail.v3`. The semantic answering policy remains `885cb919e745544b576e942aa246d3b847eaed17106bf7ffb53335d36f11684b`. The OpenRouter profile changes from M32's `f294427a03cef4f16a2634b218d09f3b139c72a6e090db3a40ef4f20b57e6fb7` to `29f88895c9c67676e48701bd9aad6d42eed0bd86e573b4d3e197127b807e2b99`, so M32 cannot be reused.

## Offline verification

Author verification currently passes:

- 26 focused OpenRouter/provider-diagnostic tests, 669 assertions.
- 409 research-composed tests, 4,230 assertions.
- `site-api` TypeScript typecheck.
- Diff whitespace validation.

Fixtures cover pipeline absence and empty arrays for analyze, plan and verify; malformed scalar/object values; documented compression, guardrail, web/file plugin, server-tool and response-healing families; unknown future stages; malformed and oversized arrays; earlier identity conflicts; valid and missing cost; safe diagnostics; and no accepted identity or raw marker leakage.

Independent QA passed an additional 148-assertion injected-response probe, rechecked the exact implementation and test hashes, reran the focused and complete composed suites, and confirmed that no network, provider, credential, browser, service or paid action occurred. The review is recorded in [`openrouter33-offline-review-10.json`](../../evaluations/research-qa/openrouter33-offline-review-10.json).

## Remaining gate

This milestone can establish only that the documented contract is implemented and tested offline. It cannot establish the M32 value or cause, that account/request settings will yield an absent or empty pipeline, successful live provider verification, answer quality, browser acceptance, invoice finality or release readiness.

A later paid check requires separate board feedback and authorization, a newly frozen run and profile, rechecked primary documentation, verified request/account plugin controls, bounded stage/cost/no-retry rules, working mechanical capture, and independent preflight. If the provider returns a nonempty pipeline again, Neuvetra will still fail closed with `router_pipeline/material_effect` unless a future reviewed product policy explicitly approves an exact effect.

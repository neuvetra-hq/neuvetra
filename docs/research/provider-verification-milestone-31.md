# Provider verification milestone 31

Date: September 10, 2026

M31 is a bounded offline repair following M30. It does not change the frozen M30 result, retry its failed request, start a service, call a model, ingest evidence, deploy, merge or authorize a new live run.

## Observed cause and remaining uncertainty

M30 retained HTTP status 200 and the safe terminal classification `decoding/router_identity` for verification attempt 6. The implementation validated the complete OpenRouter identity before extracting native response cost. When identity validation rejected the response, the trace could name only the broad identity branch and the cost path retained the reservation estimate as uncertain.

The exact failed identity field in M30 remains unknowable because the raw response, generation identifier and field-level result were not retained. M31 does not rewrite M30's $1.1783875 attempt estimate or any historical accounting.

## Repair

The strict identity predicates are unchanged. The validator now returns the first failed field from a finite allowlist, such as response model, requested model, provider, route strategy, attempt, BYOK, endpoint selection, cache status or transformations. Failed stage events retain only that label. They do not retain the received value, body, headers, provider error text, stack or credentials.

Cost and identity evidence are now separate. A finite native `usage.cost` on an exact HTTP-200, non-error OpenRouter response can settle the monitoring ledger for that request even when identity or answer validation rejects the output. That cost record does not create accepted Anthropic identity metadata, permit rendering or make transport integrity pass. Error envelopes, HTTP201/202, missing/null/string/negative/nonfinite/oversized costs, malformed bodies and settlement failures remain uncertain. No new metadata lookup or retry was added to a failed identity path.

This is an explicit internal monitoring trust policy. OpenRouter's official usage-accounting documentation defines response `usage.cost` as the total amount charged to the account, and its router-metadata documentation describes response metadata as useful for cost attribution and routing audits. The application still treats its monitoring ledger as conservative operational evidence rather than invoice finality.

## Offline demonstration

The focused provider, diagnostics, timeout and demand-selection suite passed 72 tests and 887 assertions. The site API TypeScript check passed. Synthetic cases prove deterministic field labels, strict rejection, no diagnostic value leakage, exact HTTP-200 cost gating, at-most-one settlement, uncertainty on invalid cost and unchanged failure classification. No provider request, credential access or service startup occurred.

The full monorepo wrapper could not start because Turbo did not locate its package-manager binary in the supervised environment. This is an environment discovery limitation; M31 did not change global tooling or pursue a workaround. The scoped suite and API type check are the validation evidence for this milestone.

Official evidence: [OpenRouter usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting) · [OpenRouter router metadata](https://openrouter.ai/docs/guides/features/router-metadata)

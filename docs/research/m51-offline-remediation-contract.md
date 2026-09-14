# M51 provider-disabled response and closure remediation

## Outcome

M51 repairs the two defects demonstrated by the M50 v4 live failure without changing any M50 file or making another provider request. The new adapter persists the finite, allowlisted failure phase and detail already produced by the application provider. It then creates one canonical backend closure from the sealed terminal, payload, cost and shutdown records. The wrapper accepts only the exact newline-terminated bytes that match that closure file.

The provider-disabled rehearsal runs two sanitized response shapes through the production composed-provider decoder. One contains an empty content array and closes as `decoding / content_shape`; the other contains a final text block that is not JSON and closes as `decoding / inner_json`. Each makes one in-process synthetic dispatch, settles 33,685,000 nano-USD from the synthetic native-cost field, retains terminal failure, and prevents any further dispatch or spend. The payload now mirrors the observed M50 post-response semantics: `completed_stages:["analyze"]` with null `failed_stage` and `failed_attempt`; the canonical closure resolves the single independently persisted safe failed-stage event instead of depending on those nullable payload fields. Across both cases there were zero external provider transports, global fetch fallbacks, services, network listeners, credential reads, evaluator reads or paid actions.

The wrapper result path no longer treats ordinary process output as accounting evidence. It requires whole-byte parity between stdout and the exclusive canonical closure file, then recomputes that closure from the sealed terminal, payload, cost, shutdown and hash-bound safe failed-stage record. Prefix text, suffix text, duplicate records, jointly changed closure/output bytes, changed fields and missing closure are rejected. Provider transport, synthetic response and logical dispatch counts remain separate. A validated closure carrying one transport call propagates one; an unavailable, unbound or wrong-kind shutdown record yields `null`, never an invented zero. This full-chain validation repairs the first M51 candidate's independent-review finding that a merely present shutdown file could look authoritative.

The failed-stage record now has exact key, enum and finite-number validation. Its attempt must match its filename, and its stage must reconcile to either the payload's explicit failure fields or the completed-stage sequence when those fields are null. Its SHA-256 is bound into the terminal before the terminal is bound into shutdown. This repairs the second candidate's independent-review finding that a safe-looking but contradictory stage record could be accepted.

For this bounded post-response M51 failure, all core diagnostic fields are mandatory and mutually consistent: analyze attempt 1, failed, `provider_failure`, HTTP 200, `end_turn`, finite token/elapsed values, decoding, `content_shape` or `inner_json`, and no abort. Terminal reason and error code must agree. This repairs the third candidate's finding that a rebound record could omit the diagnosis or substitute a timeout story beside a post-response terminal.

## What the evidence establishes

M50 primary evidence establishes one provider HTTP-200 response, one exact native settlement of $0.033685, and an application failure during post-response analyze handling. The M50 adapter discarded the application provider's safe failure fields, so the exact rejection subtype cannot be reconstructed. The M51 fixtures reproduce two finite response-contract failure classes; they are explicitly sanitized examples and are not retained provider output. They do not prove which subtype occurred in M50.

M50 also establishes a separate deterministic wrapper defect: the live backend did not emit a completion JSON record, while the wrapper parsed the last stdout line and later wrote a generic zero-request failure. M51 repairs that contract offline by deriving closure and accounting only from validated sealed runtime files.

## Validation

- Seven focused tests pass with 40 assertions.
- Focused TypeScript checking passes for all M51 sources and tests.
- Provider-disabled rehearsal closes both synthetic cases and deletes its disposable workspaces.
- Static checks confirm the successor has no server/socket import, credential-environment access or dependency on an M50 live launcher.
- M50 v4 code, execution evidence, authorization and settled cost remain unchanged.

## Remaining gate

M51 requires independent product and technical review before it can be called complete. This provider-disabled milestone does not validate a compiled Windows wrapper or future live process chain. Any live regression would require a new candidate, current evidence, an independently reviewed secure wrapper integration, a new exact cost scope and separate board authorization. No live rerun, publication, merge, deployment or release is authorized here.

[M50 live execution record](../../operations/openrouter50-v4-live-execution.json) · [M50 product review](../../evaluations/research-qa/m50-h02-live-v4-product-outcome-10.json) · [M50 technical closure](../../evaluations/research-qa/openrouter50-v4-live-execution-review-10.json) · [M51 rehearsal](../../operations/openrouter51-provider-disabled-rehearsal.json)

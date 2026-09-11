# Neuvetra board update

September 10, 2026. M33 completed the authorized offline repair of the provider `pipeline` contract. Current official OpenRouter documentation identifies pipeline entries as material request/response effects, not provider identity. Because M32 retained no raw pipeline value, the implementation does not guess or allow a nonempty form.

The adapter now validates provider identity first and processing integrity second. An absent or empty pipeline can pass. Malformed metadata returns the private label `shape`; any nonempty pipeline returns `material_effect` and still fails before content is accepted or displayed. Raw pipeline data is never retained. Exact model, provider, direct-route, attempt, BYOK, cache, endpoint and cost controls remain in force.

Author checks pass 26 focused tests / 669 assertions, all 409 research-composed tests / 4,230 assertions, both API and website TypeScript checks, and diff validation. CPO and CTO reviews pass. Independent QA passed a separate 148-assertion adversarial probe and recorded the final exact-hash review. The semantic answer profile is unchanged; the OpenRouter profile changed, so M32 stays closed and cannot be replayed.

No service, credential, provider request, paid call, source change, deployment, merge or publication occurred in M33. The reviewed M33 change is committed locally at `e8718df`; it has not been pushed. Offline contract fidelity is demonstrated; live compatibility and release acceptance are not. A later paid test requires a fresh frozen run, explicit authorization and evidence that request/account plugin controls produce an absent or empty pipeline. A nonempty pipeline will continue to fail closed.

## Previous closed live result

M32 is closed after the authorized one-question live verification of the M31 provider repair. The W11 website question was submitted once. The first analysis request received HTTP 200, failed strict provider identity on the exact field `pipeline`, and stopped the run. No answer was released and no retry occurred.

The repair worked as intended under live conditions: it retained the bounded failed-field label and independently settled valid same-response cost evidence at $0.044565 without treating identity or the answer as accepted. One stage was used, four were retired, and zero capacity carries forward. Cumulative actual reservations are 876.

Current internal accounting is $2.855958 settled plus $1.62485 retained historical uncertainty, leaving $5.519192 of the original $10 monitoring target. This is operational evidence, not invoice finality. M32 added no uncertainty.

Independent QA passed the final offline launch stack at 25 tests and 386 assertions. It accepted the live diagnostic and accounting evidence but rejected provider-verification success and browser mechanical acceptance. The browser API could not directly retain the response body; the proxy claim, safe trace, visible terminal UI, and an explicitly labeled reconstruction were preserved without repeating the question.

The exact backend and frontend processes are stopped, ports 3012, 3016, 5174, and 5175 are closed, and the ordinary preview remains paused. M32 cannot be restarted. M31 is published on the current PR branch at `bab79e0`; the reviewed M32 records and evidence record are published on that branch through `3835744`. No deployment, merge, provider change, source expansion, or global toolchain change occurred.

The offline `pipeline` contract repair is now implemented in M33. Any later paid rerun requires a fresh frozen run and authorization.

[M33 record](../docs/research/provider-pipeline-milestone-33.md) · [M32 record](../docs/research/provider-verification-live-milestone-32.md) · [M31 record](../docs/research/provider-verification-milestone-31.md) · [Task ledger](status.json) · [PR #2](https://github.com/neuvetra-hq/neuvetra/pull/2)

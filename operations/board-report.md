# Neuvetra board update

September 10, 2026. M32 is closed after the authorized one-question live verification of the M31 provider repair. The W11 website question was submitted once. The first analysis request received HTTP 200, failed strict provider identity on the exact field `pipeline`, and stopped the run. No answer was released and no retry occurred.

The repair worked as intended under live conditions: it retained the bounded failed-field label and independently settled valid same-response cost evidence at $0.044565 without treating identity or the answer as accepted. One stage was used, four were retired, and zero capacity carries forward. Cumulative actual reservations are 876.

Current internal accounting is $2.855958 settled plus $1.62485 retained historical uncertainty, leaving $5.519192 of the original $10 monitoring target. This is operational evidence, not invoice finality. M32 added no uncertainty.

Independent QA passed the final offline launch stack at 25 tests and 386 assertions. It accepted the live diagnostic and accounting evidence but rejected provider-verification success and browser mechanical acceptance. The browser API could not directly retain the response body; the proxy claim, safe trace, visible terminal UI, and an explicitly labeled reconstruction were preserved without repeating the question.

The exact backend and frontend processes are stopped, ports 3012, 3016, 5174, and 5175 are closed, and the ordinary preview remains paused. M32 cannot be restarted. M31 is published on the current PR branch at `bab79e0`; the reviewed M32 records are committed at `01ff95f`. No deployment, merge, provider change, source expansion, or global toolchain change occurred.

The next proposed milestone is an offline `pipeline` identity-contract repair grounded in current primary provider documentation and adversarial synthetic tests. Any later paid rerun requires a fresh frozen run and authorization.

[M32 record](../docs/research/provider-verification-live-milestone-32.md) · [M31 record](../docs/research/provider-verification-milestone-31.md) · [Task ledger](status.json) · [PR #2](https://github.com/neuvetra-hq/neuvetra/pull/2)

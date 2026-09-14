# Provider verification live milestone 32

Date: September 10, 2026

M32 was the board-authorized, one-question live verification of the M31 provider diagnostic and cost-accounting repair. It used the existing approved EPA corpus and OpenRouter-to-Anthropic policy. It did not add a source, change provider, deploy, merge, or retry a question.

## Result

The frozen W11 question was submitted once through the isolated local website:

> Our two electricity totals changed in opposite directions. What caused that in our company?

The first `analyze` request received HTTP 200 and stopped during strict provider-identity decoding. The repaired diagnostic identified the first rejected field as `pipeline`. The received field value was not retained, so this evidence names the failed predicate without exposing provider response data or guessing why it failed.

The same response contained valid native OpenRouter cost evidence. The M31 repair settled that request once at 44,565,000 nanoUSD ($0.044565) while keeping provider identity rejected and releasing no answer. The website displayed **Answering is unavailable**. No retry or later model stage occurred.

This demonstrates that the M31 repair works live for its two intended outcomes: a bounded field-level identity label survives failure, and valid cost evidence settles independently without granting accepted identity or answer status. It does not demonstrate successful provider verification, a correct W11 answer, website acceptance, or release readiness.

## Controls and review

Before launch, independent QA verified 96 candidate pins, eight runtime adapter pins, nine host pins, twelve bootstrap and executable pins, the immutable user authorization, and the five-stage ceiling. The final offline suite passed 25 tests with 386 assertions, both TypeScript checks, and Python syntax validation.

The live gate allowed one W11 click, five maximum stages, zero carry, zero question retries, and only the existing in-request correction. The run stopped on the first identity failure. One stage was used, four were retired, and cumulative actual reservations reached 876.

The direct browser response capture was not completed. The browser automation API rejected an unsupported response-event subscription before the permitted click; the click was then made once without retry. The proxy claim, safe provider trace, settled spending journal, visible terminal UI text, and an in-memory screenshot hash were retained. A reconstructed response body was explicitly labeled as reconstructed. Independent QA therefore rejected mechanical browser acceptance and did not write a consumable terminal-success certificate.

## Accounting and shutdown

- Current run settled: 44,565,000 nanoUSD ($0.044565)
- Cumulative settled: 2,855,958,000 nanoUSD ($2.855958)
- Historical uncertainty retained: 1,624,850,000 nanoUSD ($1.62485)
- Remaining internal monitoring target: 5,519,192,000 nanoUSD ($5.519192)

These are internal monitoring records, not an invoice guarantee. M32 added no new uncertainty. The backend and frontend stopped, ports 3012, 3016, 5174, and 5175 were verified closed, the ordinary preview remains paused, and the run is permanently closed with no carry or restart.

Closure SHA-256: `ebaea4dd09e07e93bdba55a8c2a22122a1e10cd780d700c15b5fbba317b2964e`. Independent closure review SHA-256: `daa24fad3ac14e295b6f8e984bf572b511351d750bfe9f685a4e3f4f968482b8`. QA rehashed all 13 run artifacts, three launch certificates, eight runtime adapter files, and the preserved M30 evidence.

## Decision

M32 closes as **diagnostic success, live provider-verification failure, and browser mechanical failure**. The next bounded milestone should resolve the `pipeline` identity predicate against current primary provider documentation and a source-blind synthetic contract before any further paid run. The closed M32 request must not be replayed.

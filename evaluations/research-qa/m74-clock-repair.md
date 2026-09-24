# M74 clock repair evidence

Date: 2026-09-15

## Diagnosis

The retained Scope 2 answer-unit and capability records expire at exactly
`2026-09-15T23:20:32Z`. CI reached the six affected historical-flow tests at
`2026-09-15T23:22:21Z`. The tests inject `2026-09-12T12:00:00Z` into the answer
service, but the closed fidelity-packet validator also checks certificate expiry
against the process clock. Once the retained release expired, the two clocks no
longer described the same historical evaluation instant and the validator
correctly refused the packet before provider invocation.

The failure reproduced in each target file independently. It was not caused by
module ordering or the M74 application changes.

## Repair boundary

Only the two historical test harnesses align Bun's process clock with their
existing injected service clock. Each test resets the process clock afterward,
following the established `catalog-absence.test.ts` `setSystemTime` and
`afterEach` pattern. Comments state that the historical fixture is not approval
of the currently expired release.

Production code, catalogs, release dates, source review records, hashes, provider
profiles and production clock defaults are unchanged.

An explicit default-clock boundary test uses the real provider implementation
with an offline transport observer:

- One millisecond before expiry, execution may reach provider reservation and
  the offline transport.
- At exact expiry, the service returns `unit_catalog_stale` before provider
  reservation or transport.
- One millisecond after expiry, the service returns `unit_catalog_stale` before
  provider reservation or transport.

The retained production corpus remains expired and requires separate qualified
re-review before use.

## Validation

- Targeted files: 25 passed, 0 failed, 538 assertions.
- Full site API suite: 639 passed, 8 environment-dependent skips, 0 failed,
  5,662 assertions across 55 files.
- Site API TypeScript check passed.

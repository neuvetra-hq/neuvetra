# M60 — verified-pack inventory draft report

Date: 2026-09-14

## Demonstrated outcome

M60 turns the exact current M59 evidence pack into a deterministic, self-contained, printable HTML inventory draft. The server independently verifies the stored archive, manifest, lineage root, current reconstructed archive, inventory identity, and exact arithmetic before it creates any report record.

The fixed synthetic report shows all 12 periods, including each reported period's source name, SHA-256 and locator, November's reason, estimate formula and basis months, and December's null-quantity exclusion reason and evidence. It reports 139.281000 MWh and 27165.4064643528 kg CO2e (27165.4065 displayed), with reported and estimated subtotals preserved exactly. The report also carries the exact method, factor, factor value/source hash and GWP identifiers, plus the complete M57 and M58 decision records.

## Integrity and access boundary

- The immutable report record binds the inventory snapshot, evidence-pack ID, archive SHA-256, manifest SHA-256, lineage-root SHA-256, exact HTML bytes, byte length, and report SHA-256.
- SQL recalculates the report-byte hash when writing. Every stored read freshly reassembles and verifies the current M59 archive, regenerates the deterministic report, and requires exact byte and metadata equality. Coordinated alteration of stored bytes, hash and length therefore still fails closed.
- Owner or admin can create. A read-only member can read and download. Cross-tenant reads return no record; signed-out reads require authentication.
- The browser clears annual, pack, replay and report state before every workspace reload or actor change. It then reloads the current report through the newly selected actor's authorized endpoint, so owner metadata cannot remain visible to an outsider or substitute for a member-authorized read.
- Malformed requests are rejected, stale or changed bindings conflict, and stored corruption fails closed.
- Browser download checks both the response hash header and a locally calculated SHA-256 over the downloaded bytes.

## Product boundary

The report visibly remains a synthetic, incomplete, unreleased bounded draft with no assurance or filing claim. Fixed print-only headers and footers repeat `DRAFT`, `SYNTHETIC`, `INCOMPLETE`, `UNRELEASED / NOT ELIGIBLE`, `NO ASSURANCE`, and `releaseEligible=false` on every printed page using reserved page margins. The bounded internal decisions are expressly identified as neither assurance nor verification, certification, or filing approval. It covers location-based Scope 2 electricity only. Market-based Scope 2, Scope 1, and Scope 3 are outside this milestone, and the development factor and method remain unreleased.

The API and UI require every M54–M60 development flag and a development or test runtime. The ordinary production build excludes the workspace demonstration.

## Acceptance and publication

Implementation commit `8393285d313c6e052d340095e1ee6834a5ec0bb9` passed the complete repository check: all ten type-check tasks, API 625 tests / 5,430 assertions, web 67 / 269, database 26 / 244, lint with zero errors, and the production build. The focused M60 suite passed 5 tests / 39 assertions, the composed API suite passed 4 / 110, the security suite passed 9 / 138, and the final browser boundary suite passed 18 / 98. The default-production bundle contains no M60 surface.

The clean browser demonstration created the M54–M60 chain, downloaded and locally rehashed the exact report as an owner, reloaded and downloaded it through a member's own authorization, and refused both another tenant and a signed-out actor after clearing prior state. The demonstrated report was 7,997 bytes with SHA-256 `1ce88cc2770c848cae9d729ee74199bba1fc0251eaed6dabd6a75a09527c7582`. All temporary listeners were then closed.

Independent QA found and caused repair of four material issues: semantic stored-report tampering, missing report lineage, print-page status repetition, and stale actor-bound browser state. Final review `6b57efc4c986716abff2e77c3043a471a70f97207a4c0e93fbdd4acd23589b18` passes the exact accepted tree with no open material finding.

M60 is published to [PR #3](https://github.com/neuvetra-hq/neuvetra/pull/3). It is not merged, deployed, released, assured or eligible for filing.

# M59 — deterministic inventory evidence pack and replay

Date: September 14, 2026

## Outcome

M59 turns the exact approved M58 annual electricity inventory into one deterministic, local ZIP evidence pack. The archive preserves the original synthetic bill, both annual-register versions, calculation and inventory records, both review decisions, ordered audit history, calculation authorities, exception reasons and a replay contract. A verifier reconstructs the annual result from the archive instead of trusting the displayed subtotal.

The pack has exactly 17 ordered, uncompressed entries. For a fixed set of inputs, the ZIP headers, timestamps, paths and bytes are stable. The manifest binds every entry by path, byte length and SHA-256; it also records the inventory lineage root and exact archive profile. The parser refuses extra, missing, reordered, renamed, recompressed, corrupt or changed entries.

Independent replay reconstructs:

- Reported: `126.788000 MWh` and `24,728.7681363744 kg CO2e`.
- Estimated: `12.493000 MWh` and `2,436.6383279784 kg CO2e`.
- Included: `139.281000 MWh` and `27,165.4064643528 kg CO2e`, displayed as `27,165.4065 kg CO2e`.
- Counts: ten reported, one estimated, one excluded and zero missing periods.

December remains excluded with no quantity and is not counted as zero. The adjacent inventory status remains **incomplete**, and release eligibility remains false.

## Controls demonstrated

Only an authorized manager can create the pack, and only after the exact M58 inventory has an approved bounded annual decision. Repeated creation converges on the same stored record. The archive and its audit record are tenant-bound and immutable under forced row-level security. Direct authenticated inserts, updates and deletes are denied.

An authorized member can inspect, download and replay the exact archive without receiving mutation rights. An outsider receives the same absence response as an unknown record, while a signed-out request is refused. Upload replay is bounded to the exact ZIP format and size, parses the submitted bytes independently, verifies the stored archive and manifest, rebuilds the archive from current sealed database evidence, and requires all three views to match.

The browser shows the exact archive, manifest and lineage hashes, all reported/estimated/included subtotals and the 17-file count. It keeps the remaining limitations beside the result: synthetic evidence, unreleased development factor and method, no assurance, and no market-based Scope 2, Scope 1 or Scope 3 coverage.

## Verification

The full repository check passes: all type checks, lint, tests and builds. The database suite passes 24 tests / 211 assertions, the API suite 625 / 5,416 and the browser suite 65 / 263; the three pinned calculation modules pass 12 Python tests. Focused browser/API tests cover exact response decoding, role boundaries, stored-row corruption, same-length download tampering, ZIP headers, CRCs, paths, order and production exclusion. A default production build contains no M59 profile, replay-result or exact-total marker.

The live local browser journey passed from a fresh fictional workspace through M55 bill review, M56 calculation, independent M57 review, M58 annual completion and independent review, M59 creation, exact download and replay. The demonstrated archive contained 17 files and 39,213 bytes. Owner and read-only-member replay both reconstructed the exact subtotal; outsider and signed-out access refused.

Independent QA `39708ab99b96734b51f461f7c274a226304d8e44ce24d8663b59cc3f4bc74a8a` is recorded in [milestone59-evidence-pack-10.json](../../evaluations/research-qa/milestone59-evidence-pack-10.json). All 20 bound files pass with no open material finding. The implementation is published at `12341a61d7ef3187c05875ba91706b88a47155ea`.

## Limits

M59 uses fictional local data and PGlite. It does not establish hosted PostgreSQL or Supabase behavior, customer-data authorization, production authentication, long-term archive retention, digital signatures, external timestamping, malware scanning, filing readiness, professional assurance, deployment or release. Integrity replay proves that the bounded archive is internally reproducible; it does not prove the authenticity of real-world evidence.

## CEO recommendation

M60 should render a human-readable draft inventory report directly from a verified M59 pack. The report should preserve the exact reported, estimated and excluded distinctions, show source and decision lineage, state incomplete and unreleased status on every result page, and refuse to render from an unverified or changed pack. It should remain a local synthetic draft; filing formats, customer data, hosted retention, assurance, deployment and release require separate gates.

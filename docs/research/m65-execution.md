# M65 execution â€” exact saved worksheet reports

Board authorized implementation after accepting M64. M65 adds immutable, authenticated, readable/printable HTML report snapshots for current and historical M64 versions. No method/factor/coverage expansion, customer data or new hosting subscription. Same rolling draft PR4; no merge authorized.

Backend: CTO context /root/m64_cto. Frontend/operators/publication/browser: root. Accounting: /root/m64_accounting. Independent M65 QA: reused /root/m63_data, which previously authored M63 infrastructure but no M65 product code. These are finite scoped assignments. Requested critical compute Astra/high; inherited actual model/effort and cost unknown.

## Evidence and first findings

- Accounting approved wording and seven independent numerical cases; final initial renderer review passed21 direct cases,14 persisted reports and7 unchanged old report bytes. Actual print was a separate gate.
- Independent local QA passed21 tests392 assertions, including actual PostgreSQL and frontend decoder; all999 original rows preserved. Initial report and32-artifact manifest are frozen historical evidence.
- M65-QA-F01: fingerprint placeholders containing digits were not substituted. Repaired matching/guard expressions; values now resolve and hostile labels remain escaped.
- M65-QA-F02: queued worksheet reviews used transaction-start timestamps that could precede an already-created report. Additive migration11 replaces only new review/audit capture timing with one post-lock timestamp; original migration10 and existing rows remain unchanged. Actual queued-review tests pass.
- M65-PRINT-F03: root inspected four actual Chrome print pages and found repeated fixed-position status notices overlapping content. This failed print gate is retained; template repair and supplemental verification are required before deployment acceptance.
- The first read-only hosted preservation probe used the wrong legacy review hash field. Corrected helper; no product mutation occurred. Four Auth sessions closed204 in both attempts; the earlier helper wrongly conflated assertion failure with logout failure. Original attempt retained.

## Preservation and upgrade boundary

Read-only hosted baseline preserved all four worksheet versions, board-created Version4 quantity25000.000/result4876.0072, original M63 report SHA4d208e345e939a8e024839713b7aac61504c7bae77b630ceddace39e1a124014 and review SHA38d027250a66451001de3c80ce7c707143f44b7d1d62a3a77179af1b734447ca. Snapshot .superpowers/m65-hosted-baseline.json contains synthetic records only.

Fresh encrypted application-only backup September14 21:58:43UTC:355788bytes SHAaa4c91094052cec9d9bd07ae38e4977307d7e885fb0f1a354192d60529d8dc7b. DPAPI current Windows identity; decryption/hash verified. Provider Auth and off-device recovery are excluded. Do not claim a cloud restoration from that check.

Upgrade requires exact schema10 prefix and final reviewed migration11 hash, verified TLS and existing-project containment. Reserve an exclusive receipt before mutation. Existing schema10 image is not a compatible rollback after11; use reviewed schema11-compatible image or controlled restoration. Expected staging transition can include brief unavailability; no zero-downtime claim. Apply only after accepted source/image checks and availability of the matching candidate.

Hosted verification, actual final print inspection, publication checks and board feedback are pending at this execution checkpoint. Frozen planning and QA records remain historical; subsequent evidence belongs in supplements.

## Repaired print checkpoint

The final template uses page-margin boxes. Root and independent QA inspected four actual Chrome PDF pages for the board-quantity fixture and root inspected four long-label/reason/review-note pages: no overlap or clipping, escaped content, correct totals and repeated qualifications. Native recheck on a new restored schema10 clone passed12/218, frontend/renderer9/174, all999 original rows preserved. New migration candidate a597d9b479321f308efa8de880a814c2ebd8dc29afa43fbff10a41a07ff66a99; template content cb279f0ec15cd492815dca2c4424e6d8852c0503f179fa0179482a0f087aa929. Original failed-print and pre-repair local evidence remain unchanged. These print fixtures use synthetic report identities, not persisted hosted report IDs. Final web typecheck, lint and staging build pass. Browser-produced PDF inspection used offline Poppler after a browser data-URL navigation was blocked; no browser policy bypass or alternate navigation was used.

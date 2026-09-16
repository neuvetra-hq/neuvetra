# M75 implementation addendum: independently verifiable report history

The frozen planning candidate remains historical. This implementation detail strengthens the agreed evidence checks without expanding the supported customer, vehicle or accounting method.

The current register carries the exact current corporate version and current vehicle-workpaper versions used to derive its reconciliation. It also carries the roster-bound corporate version, which may be older. The client verifies the existing corporate and vehicle version contracts, recomputes roster-local findings and statement bytes against the exact bound corporate ID/hash, and recomputes the current reconciliation. Matching self-contained hashes alone is insufficient.

Historical reports expose a company-authorized `GET /workspace/:companyId/controlled-fleet/:rosterId/reports/:reportId/proof` response. It reconstructs the corporate/workpaper versions and review decisions captured by that exact report, plus the exact roster-bound corporate version. A review that was absent in the original snapshot stays absent. The client verifies this proof before presenting or downloading the report HTML or snapshot. Missing, mismatched or unverifiable proof fails closed. This covers both a forged positive status and removed unsupported-vehicle findings from an otherwise stale/blocked report.

The proof uses existing retained records. It does not change old reports, add an accounting calculation or claim independent external assurance. The API still enforces company authorization on every read. Independent test evidence and final exact implementation pins remain required before acceptance.

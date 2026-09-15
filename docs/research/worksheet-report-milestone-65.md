# M65 — Readable report for a saved synthetic worksheet

Status: selected scope; implementation not started. Product owner: root acting as CPO. Technical sequencing: CTO. Independent acceptance: QA with accounting review of report claims.

## User outcome

An invited tester opens a readable report for an exact saved M64 electricity worksheet version, prints it through the browser, and revisits that same version after later corrections. The report carries the quantity, deterministic subtotal, provenance and review state together, completing the entry-to-readable-output path for this narrow synthetic worksheet.

## Boundary

One fictional facility, January2023, CAMX, existing pinned candidate factor and exact M64 calculation only. This is a worksheet report, not a complete annual inventory, filing, assurance statement or released accounting method. No new months, factors, tenants, billing, customer uploads or report aggregation. Preserve the original M63 report and every existing M64 version/review, including board-created version4. Reuse current hosting and rolling PR4.

## Acceptance criteria

1. From current and historical saved versions, open a report explicitly bound to company, worksheet version, input/result fingerprints and the exact verified server calculation. Render numbers from verified deterministic records; never recalculate through a model or browser floating point.
2. Show fictional labels, month, geography, operational-control/location-based boundary, kWh/MWh, exact and displayed kgCO2e, factor/method provenance, correction reason and explicit missing coverage. Synthetic, incomplete, unreleased and no-assurance status remains visible in screen and print.
3. Store an immutable report snapshot bound to the explicit source version, review snapshot (including no review), template version and content hash. Unreviewed versions may produce clearly unreviewed draft reports. Later review or correction creates a new report snapshot when requested; earlier report bytes and their review state remain unchanged. Resolve identity, idempotency and concurrent review/correction/report creation before implementation. Do not claim an archive or professional sealing.
4. A different manager's review remains bound to the saved worksheet version. Display whose decision applies and what was reviewed; do not claim a worksheet review is independent approval of newly generated report presentation.
5. Server authorization covers every report/read/print-data route. Members may read authorized records; signed-out, uninvited and other-tenant actors cannot retrieve them. Reject tampered report content, IDs/hashes and stale bindings; test active foreign-tenant report retrieval and concurrent creation. Use actual PostgreSQL through the frontend contract for changed paths.
6. Screen and browser print are readable, with no clipped values/fingerprints or missing limitations; responsive and keyboard paths work. No server PDF pipeline unless technically justified and separately reviewed within this scope.
7. Independent QA verifies Version4 25000.000kWh -> exact4876.00722 -> display4876.0072kgCO2e, another historical value, zero, review-state changes and post-correction history. Preserve M63 hashes. Perform an actual hosted browser demonstration and revisit after refresh.
8. Publish reviewed implementation to the same PR, pass relevant CI and hosting checks, then collect board feedback before dependent work. Planning acceptance alone does not close M65.

## Sequencing

CTO defines report identity/projection and authorization contract; accounting challenges labels, review claims and exact result presentation. Engineering then implements the bounded report and print path. Independent QA challenges the integrated result before hosted demonstration. Existing compute defaults and critical escalation apply; reused contexts retain unknown observed settings. No persistent worker or scheduled improvement system is implied.

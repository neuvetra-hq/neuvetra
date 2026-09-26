# Calculation-readiness stage

Open `/readiness.html` from the collection page. The page evaluates saved data, not unsaved browser edits. Select a subtype in collection to see its candidate approach; prepare method-specific detail, correct records using the activity links, refresh, and save a readiness review. The review can be reopened or downloaded as JSON. It is not an emissions report.

## Implemented contract

- Server evaluates quantity, original units, reporting dates and interval gaps, possible overlapping/duplicate entries, quality/estimation notes, references, location assignments, screening and method-specific details. Explicit zero stays distinct from missing. Date coverage alone does not prove all sources are included. A reference or uploaded file does not establish evidence sufficiency.
- Catalog has 54 explicit subtype/category mappings: 35 Scope 1, four Scope 2 and 15 Scope 3. Candidate approaches and unsupported dispositions are explained in READINESS-DOMAIN.md. Source guidance is research evidence, not released calculation authority.
- All calculation permission remains false. No factor values, conversions, numerical emissions, production approvals or assurance opinions are manufactured. Free-text method detail is preparation for review, not semantic validation.
- Snapshot lineage contains exact inputs, saved revision, result, original catalog/registry text and engine files with hashes. SQLite schema 2 adds immutable readiness_snapshot; workspace/evidence data are preserved. The server recomputes the result, rejects extra client verdict fields and stale revisions, and checks revision again inside the write transaction. Identical revision/artifact sets return the existing snapshot.
- History is read-only. Current input edits create a different revision; historical context and details come from the archived input. User accounts and tenant authorization remain absent in this loopback-only local app.

## Verification

Run previous collection tests plus `node --test readiness-core.test.cjs`, `node qa-readiness.cjs` and `python -B qa-readiness.py`. Node must be on the server PATH; missing runtime or invalid registry yields an unavailable assessment, never a passing result. Python remains standard-library only. See readiness-review.md for independent findings and limits.

## Production release not yet accepted

The requested production outcome still requires authenticated and authorized company access, validated production migration/backup/restore and operational controls, approved source use, released method/factor applicability for the selected reporting period, and appropriate qualified accounting/release review. A passing local test suite cannot satisfy these dependencies. Do not expose this local server publicly or use it as a hosted tenant API.

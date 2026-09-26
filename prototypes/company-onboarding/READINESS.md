# Calculation-readiness stage

Open `/readiness.html` from the collection page. The page evaluates saved data, not unsaved browser edits. Select a subtype in collection to see its catalog candidate approach; add structured customer facts, correct records using the activity links, refresh, and save a readiness review. The review can be reopened or downloaded as JSON. It is not an emissions report or a reviewer approval.

## Implemented contract

- Server evaluates quantity, original units, reporting dates and interval gaps, exact duplicate signatures, overlapping periods, quality/estimation notes, references, location assignments, screening and structured customer facts. Nonidentical overlapping periods are flagged for review because distinct fuels or sources can legitimately cover the same year; exact duplicates and gaps remain blocking. Explicit zero stays distinct from missing. Date coverage alone does not prove all sources are included. A reference or uploaded file does not establish evidence sufficiency.
- Catalog has 54 explicit subtype/category mappings: 35 Scope 1, four Scope 2 and 15 Scope 3. Candidate approaches and unsupported dispositions are explained in READINESS-DOMAIN.md. Source guidance is research evidence, not released calculation authority.
- All calculation permission remains false. No factor values, conversions, numerical emissions, production approvals or assurance opinions are manufactured. Customer-editable readiness fields contain structured activity facts only. These include mixed-fuel profiles tied to fuel-specific record labels, validated vehicle model-year lists/ranges, energy supplier and meter identifiers, and refrigerant/gas equipment charge quantity and unit. Explicit unknown model-year or charge states are retained as blocking gaps. Method choice, factor applicability and release remain pending a separate reviewer workflow that this prototype does not implement. Placeholder answers such as `n/a` or `unknown` do not increase factual progress.
- The UI shows five prioritized customer actions grouped by activity, collapses full findings and inventory-wide conditions, and excludes proposed `No` findings from the active activity count. Company-wide Scope 3 categories do not require site allocation; leased-asset and franchise categories retain site coverage by default. Internal revision identifiers stay in snapshots and exports but are not shown in ordinary user prose.
- Snapshot lineage contains exact inputs, saved revision, result, original catalog/registry text and engine files with hashes. SQLite schema 2 adds immutable readiness_snapshot; workspace/evidence data are preserved. The server recomputes the result, rejects extra client verdict fields and stale revisions, and checks revision again inside the write transaction. Identical revision/artifact sets return the existing snapshot.
- History is read-only. Current input edits create a different revision; historical context and details come from the archived input. User accounts and tenant authorization remain absent in this loopback-only local app.

## Verification

Run previous collection tests plus `node --test readiness-core.test.cjs`, `node qa-readiness.cjs` and `python -B qa-readiness.py`. Node must be on the server PATH; missing runtime or invalid registry yields an unavailable assessment, never a passing result. Python remains standard-library only. See readiness-review.md for independent findings and limits.

## Production release not yet accepted

The requested production outcome still requires authenticated and authorized company access, validated production migration/backup/restore and operational controls, approved source use, released method/factor applicability for the selected reporting period, and appropriate qualified accounting/release review. A passing local test suite cannot satisfy these dependencies. Do not expose this local server publicly or use it as a hosted tenant API.

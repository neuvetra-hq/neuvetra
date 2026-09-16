# M75 root operator and local integration review

Status: accepted for the exact local operator/helper files in the attached author manifest, subject to separate fresh hosted backup/recovery, maintenance and execution approval. Root authored application/UI/shared wiring and portions of SQL derivation; **root is not their independent implementation reviewer**. Independent implementation acceptance is in `m75-independent-review.md`. Root authored none of the new CTO operator/helper files and is their separate safety reviewer.

## Operator review

Reviewed the explicit entrypoints and exact pinned schema17/18 receipts; fixed project/connection destination; advisory lock and existing-table locks; baseline row multiplicity/content/catalog/roles comparison before and after; seven empty additive tables and one receipt; and rollback/unknown-commit handling. Application startup cannot invoke migration. The backup binds dump and fingerprints to one exported read-only snapshot. Archive encryption uses DPAPI CurrentUser and exclusive output files. Restore only creates a new specifically named loopback clone; no existing database/global roles are changed. Provider Auth, credentials, sessions and storage are excluded. Forward recovery after18 must use18-compatible code.

The final CTO DPAPI rehearsal actually restored17 and populated18, exercised runtime/frontend downloads and preserved old content. Independent QA separately reconstructed90tables/2,263rows and catalog/ACL definitions. Exact13 file hashes were rechecked by root against `.tmp/m75-ops-1789539665453/author-files.sha256.json`; all match. Source evidence: `m75-operators-author.md`, `m75-independent-recovery18-final.json`. This is a local rehearsal, not a fresh hosted backup or complete provider disaster-recovery claim.

The hosted journey confines destinations and routes, journals write intent before transmission, refuses unresolved outcomes, separates contributing/review accounts, verifies historical proofs and closes created Auth sessions. Baseline/revisit admit zero application POSTs. The final local two-vehicle journey passed7tests/98assertions with22POSTs including denials,4roster versions and3reports. Its identity/legacy transport stubs do not establish live acceptance. Root reran operator/helper/legacy/server suites:27passed/1explicit native opt-in skip/304assertions.

## Final local browser demonstration

CanonicalSQL18 `76c8a17a46d96b40ed98213ceb3cf79caf564c5a639583197bd0adaf1c8a98f3`. Clone `m75_root_ui_final2` used actual local routes/database and fictional actor injection. Root saved a roster reference correction, observed the review reset, switched to a separate eligible reviewer, accepted the bounded reconciliation, retained a report, downloaded HTML/JSON, and inspected the report. The downloaded16,556-byte HTML equals the retained SHA256 `519e04d1e85ea3cd09ee871e1bfa521c2be72436f6b06cb325d40b79dd31d9a0`.

The service was actually stopped and restarted with unchanged finalSQL; readiness passed. Reload preserved both versions/reviews/reports. Historical version1/report reopened with original reference and captured review. Native before/after values are exact in `docs/research/m75-local-browser-verification.json`. Prior initial390px check had no document horizontal overflow; final screenshots showed readable report text with long machine identifiers wrapping. No physical print/PDF/pagination acceptance is claimed. Styling refinement can follow separately without weakening evidence checks.

## Publication boundary

Independent shared-wiring review found two remaining17-count test assertions; root corrected hosted native readiness expected length18 and container manifest count18 plus exact0018 filename. Independent recheck passed in m75-integration-review.md. Production implementation pins did not change. Automatic deployment was explicitly paused on the existing Railway service before publication so schema18 code cannot reach schema17 accidentally. Running service has not been stopped or migrated. Actual remote checks, fresh hosted recovery and final demonstration remain required; M75 is not yet published or complete.

Final readiness additions: actual hosted baseline passed with zero application POSTs and all created Auth sessions closed. Fresh hosted17 encrypted backup/restore and separate review preserved83tables/224rows and replayed all existing reports/calculations. These are preparation gates only. Receipt docs/research/m75-prepublication.json. API typecheck and standard staging build passed; build retains the known large-bundle advisory.

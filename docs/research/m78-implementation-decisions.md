# M78 implementation decisions

September17,2026. Developing implementation; no runtime or release acceptance is implied. The frozen product/technical plans and first-review failures remain preserved.

## Captured proof and cumulative review

Both process discovery and the combined inventory bind exact corporate, source and physical-discovery versions and decisions. Source or roster corrections therefore make a previously accepted process screen stale. The process contributor set includes all upstream preparers; the inventory additionally includes process preparers. A reviewer cannot accept work to which they contributed.

Independent browser mutation tests demonstrated that cached findings and hashes alone did not establish the meaning of a retained process record. Each retained version now carries its original proof. Registers transport the already-loaded original proofs once per version, avoiding one additional server request per historical version. An inventory's embedded process carries its own original proof, whose process field is null to prevent a recursive chain. Process proofs exclude numerical policy; the combined inventory pins the separately reviewed compatibility policy.

Each captured proof also carries complete same-stream predecessor versions, ordered from version1 and with review fields null. The database resolves those records against its authoritative immutable history. Browser decoding checks their hashes, identity links, contributor retention and the enclosing version's exact contributor union. Captured dependency versions and decisions cannot postdate the enclosing version. Requested family, stream and record identities are checked on reads and writes.

The first candidate's 6MB response limit refused the first combined-inventory correction after a process explanation correction. Actual native diagnosis measured a 7,451,720-byte register and exact transaction rollback. Raising the response limit alone allowed the successor and separate review, but the final report then exceeded the original 20MB retained-history limit. Before the successor, the retained UI example already held 3,998,685 bytes of versions/proofs and 12,401,150 bytes of reports.

Root authorized a bounded 10,000,000-byte response limit, matching the strict parser's existing maximum, and a 30,000,000-byte retained-history limit. Individual proofs remain limited to 4,000,000 bytes. The SQL and TypeScript contracts must agree, with a fresh migration/source freeze. This is capacity for the demonstrated synthetic lifecycle, not a claim of unbounded customer history. A future storage-format or pagination change requires a separate design and compatibility review.

A post-write state check remains inside the transaction: capacity failures roll back rather than truncate evidence. Capacity returns a structured 422 response with fixed browser guidance; semantic integrity failures remain unavailable responses. Acceptance requires the actual correction, separate review and retained report, plus valid oversized-history/response refusals, exact rollback and readability of old records. Those new native checks and recovery are pending at this decision.

## Discovery and presentation

Process categories are supplemented by seven explicit gas-group applicability rows. Direct industrial-gas use, electrical equipment and off-site controlled operations cannot be inferred absent from a generic office description. Identified unsupported sources remain retained and block reconciliation. Fictional demonstration evidence is explicitly labeled and does not establish customer applicability.

Known-source subtotals exclude stale, unreviewed, unsupported and conflicted contributions. Missing records do not generate zero-valued source/facility rows. Blend mass remains separate without inferred constituent quantities. Full candidate totals require reconciliation; production methods, customer evidence, applicable requirements and external assurance remain separate gates.

The interface distinguishes editable current discovery from the selected retained read-only matrix. Source choices and results include entity/facility/physical context, including same-named facilities. Reports retain exact historical evidence and review state; later reviews do not rewrite earlier downloads.

## Review arrangement

Root authors the frontend and integration. A separate existing QA executor challenges browser decoding with independently constructed fixtures. The backend author owns only M78 database, route, migration and native-fixture files. A separate security executor authors backup/recovery tooling. Those tooling artifacts require independent review; provisional source review does not substitute for a working demonstration or native authorization/recovery evidence.

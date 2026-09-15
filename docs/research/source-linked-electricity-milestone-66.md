# M66 - Supporting bills linked to worksheet reports

Status: implementation authorized after M65 board acceptance; board clarified this precedes full-year M67. Root acts as product owner. CTO advisory task M66-PLAN-REVIEW completed read-only; independent accounting/security/QA review of the implementation contract remains a gate.

## Outcome

An invited manager uploads a supported fictional electricity bill, consults the retained document, confirms the quantity and page reference, and saves a worksheet/report that identifies that exact source. The demonstration connects source document, manual confirmation, deterministic calculation, review and readable report in one journey.

## Bounded scope

Start with supplied, approved fictional January2023 CAMX PDF fixtures, manual confirmation and the existing calculation policy. Reuse tenant-scoped PostgreSQL retained bytes and existing hosting; no new storage subscription or paid AI extraction. Arbitrary PDFs, automated extraction, additional months/factors, customer use and billing are separate work. Set an explicit file limit below the existing300000-byte request limit, allowing request overhead. Existing fixed M55 intake is not a general upload service.

## Acceptance gates

1. Upload, inspect, confirm quantity/page, save, reopen and download identical supported source bytes. Clearly label manual transcription; attaching a document does not verify its contents.
2. Introduce an additive version contract binding tenant, file identity/hash/length, source locator, confirmation actor/time and quantity. Adding or replacing evidence creates a successor and fresh review even when quantity is unchanged. Use an additive report profile/template; preserve all M63-M65 records and historical report bytes.
3. Enforce manager creation and authorized tenant reads at server/data layers, including preview/download. Reject foreign tenants, revoked sessions, unsupported/oversized files and byte/hash tampering. No public source URLs.
4. Native PostgreSQL tests challenge duplicate retries, stale versions, competing corrections/reviews, evidence-only changes and atomic failure. Retain independently checked decimal/rounding cases.
5. Demonstrate the actual hosted upload-to-report journey, exact exported source bytes, restart persistence and restored source-to-report lineage. Accounting wording, security boundaries and independent QA must pass before publication and board demonstration.

## Sequence and following direction

First settle evidence identity, storage limits and permitted preview/download behavior. Then implement the complete supported journey and independently challenge it. Use the existing rolling PR4; no merge authorization is implied. M67 is not selected: the likely next larger step after this traceability path is broader period/annual electricity coverage, subject to domain review and board feedback.

Roles are bounded assignments. CTO advice came from reused /root/m64_cto; actual inherited model/effort/cost is unknown. No implementation worker, persistent service or measured cost saving is claimed by this plan.

Contract refinement: two approved fictional PDF fixtures, maximum 262144 bytes, page 1 manual confirmation. If entered quantity differs from printed quantity, a separate nonblank quantityDifferenceReason is mandatory. Matching quantities require null. Source replacement requires a successor and fresh review. See m66-accounting-contract.md and the independent acceptance plan.

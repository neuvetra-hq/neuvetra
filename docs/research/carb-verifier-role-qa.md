# Independent review: CARB verifier role

September 9, 2026. Task `OPS-CARB-ROLE-01-QA`. Reviewer: `/root/carb_role_qa`, assigned under Head of QA. Root authored the reviewed role and source brief; this reviewer did not author or change those artifacts.

**PASS for the bounded role-definition and source-basis review.** The minor locator finding was corrected by root and independently rechecked. This is instruction review, not a runtime benchmark, demonstrated inventory-review competence, professional assurance, source-release approval, or accreditation.

## Evidence inspected and checks performed

- Read the operating model, QA/accounting/regulatory role handoffs, new role, complete source brief and manifest, current roadmap, board report and continuation record.
- Independently opened retained CARB PDFs with bundled Python `pypdf`: complete three-page audit checklist, five-page September 2026 FAQ, one-page September 8 notice, and revised final-order pages 239-241 and 244-246. Reviewed existing rendered images of checklist pages 2-3 and order page 240, using the PDF skill to preserve table and amendment context. No new PDF was created or modified.
- All five source files exist; independently recomputed SHA-256 and byte counts match all five manifest entries. All source URLs name `ww2.arb.ca.gov`. All 25 local Markdown link targets in the six reviewed Markdown files resolve; the development-backlog heading also exists.
- Public URLs were not independently fetched again. The manifest and root's retained download/browser evidence establish their recorded retrieval; this review independently verified the retained originals and their content. The DOCX companion was hash-checked only, consistently with its manifest's content-review-pending status.
- The first text extraction failed on Windows console encoding; the UTF-8 rerun succeeded. A first hash-report formatting command had a PowerShell syntax error; the corrected command succeeded. Neither failure changed source files.

## Acceptance disposition

| Criterion | Result and basis |
| --- | --- |
| Faithful CARB qualification and audit criteria | PASS. FAQ questions 1, 7-10 and 15, final-order section 95132, and checklist pages 2-3 support the qualification model, risk/sampling work, traceability, conformance versus material misstatement, fieldwork evidence and corrective actions. Sample checkmarks/deadlines are explicitly treated as template content. |
| MRR versus corporate Scope 1-3 and SB 253 | PASS. Separate review tracks require their own frameworks, applicability, editions and engagement criteria. The role does not transfer MRR coverage, thresholds or accreditation to corporate assurance. Corporate method criteria remain a proposed library requiring their own sources. |
| Independence and official authority | PASS. Organizational conflict analysis is required separately from internal reviewer separation. Final-order section 95133(a)-(b), pages 244-246, expressly covers bodies, related entities, prior inventory/factor work and other services. The role forbids official sign-off/accreditation claims and routes formal assurance to qualified humans. This review did not adjudicate a real provider's conflict status. |
| Evidence, edition and data-year limits | PASS. The role requires source/edition inspection and transition resolution. The September 8 notice supports the distinction between September 1 effect and the general 2027-data application with exceptions. Older slides cannot determine all current engagements. |
| Usable audit workflow and handoffs | PASS. Scope/independence, completeness, audit-plan review, deterministic recomputation, findings and closure have defined outputs and owners. Missing records remain missing; calculations require pinned methods and accounting validation. |
| No false learning/runtime claim | PASS. Capability states require demonstrated evidence; curriculum, benchmark and monitoring are explicitly proposed. A prompt is not accreditation, measured expertise, continuous learning or a running worker. |
| Integrity and local link resolution | PASS. Five of five originals match size/hash; 25 of 25 local document-link targets resolve. Current public URL reachability was not separately rechecked. |

## Adversarial instruction probes

These are reviewer reasoning probes against the written instructions. No model service was run, no audit pack was scored, and these outcomes must not be described as runtime test results.

| Probe | Required handling supported by the role |
| --- | --- |
| Clean audit report with no supporting workpapers | Return insufficient evidence for audit readiness; request sample rationale, source tracing, issues and fieldwork records before accepting the clean conclusion. Workflow 3 and 6; required output. |
| Author asked to independently approve its own inventory | Disclose preparation involvement and route internal review elsewhere. For MRR, assess organizational conflicts separately; changing AI contexts does not cure them. Workflow 1; opening authority boundary. |
| 2018 training slide promoted to the rule for all 2026 data | Resolve applicable operative edition, section 95103(h) and the exact data-year provision; do not adopt the slide as universal criteria. Required context and two-track boundaries. |
| Request to issue an official CARB verification statement | Decline official signing/submission authority and provide only the supported internal disposition for qualified human review. Authority section. |
| Partial Scope 3 spend screen called a complete inventory | Assess all 15 categories and their applicability/minimum boundaries; disclose missing categories and data-quality limits; do not infer completeness or zeros. Workflow 2 and Scope 3 coverage. |

## Findings and limits

No blocking defect was found. Minor locator finding `QA-CARB-01` is closed: the source brief's competency-table lead-in originally cited only section 95132(b)(2)-(5), while its verification-body-controls row is also supported by section 95132(b)(1)(D)-(E), on page 239. Root added those provisions; this reviewer inspected the corrected lead-in and recomputed the brief hash shown below. The supporting text is present in the retained and reviewed order.

The reviewed instructions support cautious audit readiness work. They do not demonstrate the agent is the most knowledgeable GHG expert or is ready to approve a real inventory. Corporate standards, complete MRR transition/verification criteria, calculation performance, audit-pack performance and qualified human calibration remain the explicit development backlog. No cloud calls, credentials, customer data, runtime corpus changes, external messages or production actions were used by this reviewer.

Next owner: root coordinator for the operational record; then QA/accounting/regulatory specialists for the separately proposed synthetic audit demonstration.

## Exact reviewed versions

SHA-256 of the reviewed artifacts:

| Repository path | SHA-256 |
| --- | --- |
| `operations/agents/carb-verifier.md` | `b9d035ab97c8b434c0c9af220d7b05e90a49c959a1245f5efae1023ed3bf0054` |
| `operations/agents/README.md` | `182030a5290a781349de2c41cf8d4e8d776d8025b0c6a58a30f256e3aecc47dd` |
| `operations/agents/qa-lead.md` | `9103d406419bb372cbcb88706fd7166047a215e91bce616d42b009969b40fc19` |
| `operations/agents/accounting-validation.md` | `271b6a6fa3f8c8aae347a0633a0dc369758a4574ee9b6aa3e8ba2b5acf1eef01` |
| `operations/agents/regulatory-research.md` | `03561c14828a742e200f277e4c159b930a10100657f20e6f506c6d52d3ac1fb5` |
| `docs/research/carb-verifier-role-basis.md` | `e2232bbe54c07b6ed43c715cf5b3af12d0cd81c218ada0b8e9db19263e1682ae` |
| `docs/research/carb-verifier-role-sources.json` | `6022709396057f6474421c0a39d6f126ec2e1de35ef8b8e874055ee6bd1c0bd0` |

Verified originals under `C:/Users/nimab/Neuvetra/research-sources/2026-09-09-carb-verifier/`:

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `carb-mrr-2026-final-approved-order.docx` | 530404 | `f4e57876225083d471e091a59fc5d68d7b1119d54c1d4eb8b944dbc96df097e4` |
| `carb-mrr-2026-final-approved-order.pdf` | 1919029 | `9154ed1b45b610665aecfe7c2f7d2da65fe94d28cae897c1426c1b5036a82bb1` |
| `carb-mrr-regulatory-notice-2026-09-08.pdf` | 76504 | `4dd9e7034bf0c036da51c5d627b6a683fdff47400e3b525c0b932e78a93e7e03` |
| `carb-verification-services-audit-checklist.pdf` | 179405 | `3b551db5589c3396ba1e9b553e5e5c1dbe15de75669732a4b997ff9da0ad71e5` |
| `carb-verifier-training-faq-2027.pdf` | 170309 | `a8b5754383e27dfb7e2c5d374c7cc542558cab0f764d0064b24e9f3f9b7323fb` |

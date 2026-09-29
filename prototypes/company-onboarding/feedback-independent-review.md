# Independent collection and readiness review

**Review date:** 2026-09-25  
**Verdict:** PASS for the bounded feedback acceptance criteria at the exact hashes below.  
**Review arrangement:** This reviewer did not author the collection, location, server, or readiness implementation under review. The same reviewer did author the separate convergence handoff artifacts, which are outside this verdict and require another reviewer. Requested routing was `gpt-5.6-sol` at high effort as an explicit assignment exception; observed runtime model and effort are unknown.

This verdict means the local prototype passed the stated synthetic and source-level acceptance checks. It does not mean the prototype has been migrated to the hosted application, connected to customer accounts, approved by a method reviewer, released for calculations, or accepted for customer or assurance use.

## Reviewed version

| File | SHA-256 |
|---|---|
| `plan-core.js` | `4dff95651931624944d2afcc14523a1cc18da29c160e9d0e64abcb16ab0b7421` |
| `plan-ui.js` | `c3bffbfdc724ccf8bca7fbc9d0e3247c07b08c9794db27d6f918f29ad4830d04` |
| `server.py` | `c3cf018b2eee59b5df8659a268adcfecf8efd8373e795ad525da7295e03900c7` |
| `locations.js` | `91a491ed42155702814a813f5108aaf05501a2da0efed996f63d94c26767493e` |
| `bridge.js` | `20caf0f3198985543e0436a00832b1c785c0e336fdf12c2cab8d82d7f9119b1e` |
| `readiness-core.js` | `70cf559921bd31ae859474245f7a9bbf6432d4e46ba350dcf5e55beec2c22cc2` |
| `readiness-ui.js` | `1398f5441421b0276e201373fadf2267e4349b293982392b9fbd1b51a1b0616b` |
| `data/readiness-methods.json` | `36591b40fe53430e85079ab3692a85f97189c111bdb1c2fe2be4dbeba7da793b` |

Runtime used for this review: Node `v24.21.0`, Python `3.14.7`, Windows. No live or hosted database was used, and no service was started on ports 4319 or 4331.

## Acceptance evidence

| Criterion | Adversarial evidence | Result |
|---|---|---|
| 1. Accepted units and aliases | `feedback-qa-core.test.cjs` proves `therms` normalizes to catalog unit `therm`, keeps exact `unitOriginal`, keeps grouped `quantityOriginal`, and checks that the UI only adds a canonical unit when accepted. Coordinator browser evidence separately confirmed the subtype unit dropdown. | PASS |
| 2. Local edits versus upstream invalidation | A completed item survives its first local subtype and company-wide location edits without `needsReview`; changing the upstream source description then sets `needsReview` and returns the item to in-progress. | PASS |
| 3. Fuel overlaps versus duplicates | Two distinct full-period fuel/source records create a nonblocking review finding; replacing the second with an exact duplicate creates a blocking duplicate finding. | PASS |
| 4. Selected or in-flight file cannot be lost | Source checks cover the selected-file and upload-in-flight save/close guards, input disabling, unload protection, and stale detail-response generation guard. Coordinator browser evidence separately confirmed selected-file Save is blocked. | PASS |
| 5. Orphan evidence recovery | Source checks cover the stored-workspace evidence list and removed-link messaging. Coordinator browser evidence separately confirmed close/reopen recovery and relinking. | PASS |
| 6. Comma-formatted quantities | Client and server tests normalize `1,234.50` to `1234.50` while retaining the original string. | PASS |
| 7. Company punctuation | A company ending `Inc.` remains `Inc.` rather than becoming `Inc..`. | PASS |
| 8. One canonical reporting entity | A legacy legal-name assignment is migrated to `Reporting company`; the original legal-name value is retained in `originalEntity`, and the selector contains one canonical parent entry. | PASS |
| 9. Duplicate evidence hash | Two concurrent uploads of identical bytes converge on one evidence row and one quota charge. At full quota, identical bytes reuse that row while new bytes are rejected. | PASS |
| A. Customer facts and method boundary | Only structured factual fields are exposed; method/factor prose is absent, placeholders such as `N/A` do not advance status, `readyForCalculation` remains false, and method-review completion remains zero. | PASS |
| B. Prioritized top five | The action selector returns at most five blocking findings in priority order; rendering groups them by activity, and the complete per-activity findings remain inside collapsed details. | PASS |
| C. Company-wide Scope 3 | A company-wide Scope 3 category is not marked unassigned and gets no false location or multi-site finding. | PASS |
| D. Justified exclusions | Five justified `No` answers produce zero active activities and five separately counted exclusions, with the rationale visible on the excluded item. | PASS |
| E. No visible revision jargon | Visible readiness source contains neither a revision heading nor the former revision-based download name; exported lineage still retains the internal workspace revision. | PASS |

The coordinator also reported a browser pass for a grouped quantity saved as `4210` without self-review, selected-file blocking, orphan recovery, relinking persistence, and the duplicate-upload existing-copy message. Those observations support the verdict but were not independently reproduced by this reviewer; root owns browser verification.

## Executed checks

| Check | Result |
|---|---|
| `node --test plan-core.test.cjs readiness-core.test.cjs feedback-qa-core.test.cjs` | 47/47 passed |
| `python -B -m unittest test_server -v` from the prototype directory | 18/18 passed |
| `node qa-readiness.cjs` | 7/7 passed |
| `python -B qa-readiness.py` | 6/6 passed |
| `python -B -W error::ResourceWarning feedback-qa-server.py` | 3/3 passed with warnings promoted to errors |
| Node syntax checks for `plan-core.js`, `plan-ui.js`, `readiness-core.js`, `readiness-ui.js`, `locations.js`, and `bridge.js` | Passed |

## Preserved first findings

No implementation defect remained after adversarial review. The first runs did expose test-harness defects, retained here so later readers do not mistake intermediate red output for a product failure:

1. The initial JavaScript run was 9/10 because the QA regex omitted one `&` from the implementation's `canonical&&!units.includes(canonical)` expression. The assertion was corrected.
2. The initial backend run had one passing test and two fixture errors: a single synthetic quota filler exceeded the table's 5 MiB per-file constraint, and raw `sqlite3.connect()` transaction contexts were not explicitly closed on Windows. The filler now uses valid per-file chunks and fixtures use `contextlib.closing`.
3. The second JavaScript run was 9/10 because the VM slice omitted the `actionPriority` constant needed by `nextActions`. The slice was expanded to include the dependency.
4. The first broad Python command ran from the repository root and could not resolve the test's sibling `server` import. Re-running from `prototypes/company-onboarding` passed 18/18.

The temporary SQLite warning was initially raised as a possible product resource issue. Inspection and an independent backend reproduction showed that `Store.connect()` closes in its `finally`; the warning came from the QA fixture's raw connection. The product concern was retracted.

## Residual boundaries

The tests are synthetic and local. They do not exercise a hosted account boundary, production migration, real customer evidence, external method approval, accounting/legal judgment, or independent assurance. The method registry remains candidate-only and calculation release remains false, which is the required safe behavior for this milestone. A later hosted cutover must meet the separate convergence contract and its tenant-isolation, preservation, reconciliation, and rollback gates before these local outcomes can be represented as migrated behavior.

## Publication byte and integration verification

This section was appended after the verdict above; it preserves the initial review history and records the final publication-byte check.

The publication preparation normalized changed text files to LF. Three reviewed source hashes changed solely for that reason. Replacing every LF in each current file with CRLF reproduces the exact prior reviewed SHA-256:

| File | Final LF SHA-256 | Reconstructed CRLF SHA-256 | Prior reviewed SHA-256 match |
|---|---|---|---|
| `plan-ui.js` | `c3bffbfdc724ccf8bca7fbc9d0e3247c07b08c9794db27d6f918f29ad4830d04` | `12afbab16309a32587d3c7f4ce4ee6f248e7bc01ad32040ba46ea965daaf3dd6` | Yes |
| `locations.js` | `91a491ed42155702814a813f5108aaf05501a2da0efed996f63d94c26767493e` | `8c2cfe6d2af0699d63a97e78c747cfef963eb834c7376e8c7c82009bf34fa58f` | Yes |
| `bridge.js` | `20caf0f3198985543e0436a00832b1c785c0e336fdf12c2cab8d82d7f9119b1e` | `6f09e48c2f6a86b5134c093b5a5ad267c4991d191046d09de90be8764361dfa5` | Yes |

All other product files in the reviewed-version table retained their prior SHA-256 directly. This establishes byte-for-byte equality of the normalized text, rather than relying only on another test pass.

The publication additions were also reviewed:

| Artifact | SHA-256 | Review result |
|---|---|---|
| `.github/workflows/inventory-plan.yml` | `296fc80e8974e958db2645346cd4d040dbff29248424cb3fcb52c3c9cf4ac289` | Adds convergence, feedback core and feedback server tests to the existing bounded workflow; no existing check is removed. |
| `DATABASE.md` | `ae1981608f899ac2da8412c7287b1c187fe98e59af78e21e620a98ce0648f13d` | Evidence-list, duplicate-reuse and convergence API/design boundaries match the implementation; the prior 14-test result is labeled historical and the current 18-test result is explicit. |
| `feedback-bayline-fixture.py` | `e8b9fbfce3bad2ebeaa0983078f13465ad9a55b645e4f58a38a82f51ff5b3589` | Requires an explicit unprivileged port, refuses the protected preview port, and refuses to seed anything except the exact revision-0 empty workspace. Its compare-and-swap then protects against a concurrent replacement. Port 4331 was an explicitly authorized coordinator-owned isolated demonstration and was not used by this reviewer. |
| `feedback-check-results.json` | `ac3001e537503f342cda03085961690cc084613fd749601de9552d82b273c9d6` | Records all 11 focused workflow commands with exit code zero. The HTTP suite has one documented Windows symlink-privilege skip. |

This reviewer also executed all 11 focused command paths across the review turns; their substantive results agree with the recorded file. The three final commands not already covered in the first verdict were `node check.cjs`, `node qa-core.cjs`, and `python -B qa-http.py`; they passed, with the same single environment-dependent symlink skip in the HTTP suite. No service was started by this reviewer on ports 4319 or 4331.

Coordinator browser evidence remains deliberately separated from this verdict. The coordinator reported the other collection/readiness interactions and a 355-pixel mobile viewport without horizontal overflow. Native download verification timed out and is **not passed**. Browser navigation to the location setup section did not respond to the coordinator's tool clicks, so an end-to-end browser location-edit result is also **not claimed**; the independent VM regression for canonical legacy-entity retention remains the evidence for criterion 8.

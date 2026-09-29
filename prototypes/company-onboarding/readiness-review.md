# Calculation readiness independent QA — READY-QA-01

Reviewed 2026-09-25 in the inventory-plan-delivery managed checkout, base commit `a54d48416d9abdc257f9536c14d50121bfc75222`, with the exact uncommitted candidate file digests below. This is an independent execution context: reviewer authored only `qa-readiness.py`, `qa-readiness.cjs` and this review, not the engine, server, registry or UI. Requested inherited-settings fallback after other override dispatches failed authentication; actual model, effort and resource usage are unobserved.

## Verdict

**PASS for bounded local calculation-preparation checks, persistence and source-level UI integration. Production readiness is NOT accepted.** All calculations remain blocked and no emissions totals are produced. Prepared inputs are not approved methods, factor compatibility, inventory completeness, compliance or assurance. Browser operation and visual behavior are the root author's separately recorded demonstration, not an independently repeated browser test by this reviewer.

## Executed evidence

- Baseline actual-server suite: `python -B -m unittest test_server -v`, 14/14 passed before implementation.
- During integration, independent `python -B qa-readiness.py` accidentally also discovered the imported author harness: 22/22 passed (17 author cases and 5 independent cases). Discovery was then narrowed and a sixth independent test added.
- Final `python -B qa-readiness.py`: 6/6 passed using isolated temporary databases and real subprocess HTTP servers. Tested client result/registry/input forgeries, absent local session, hostile origin, malformed revision, malformed method-detail shapes, preserved safe unknown detail keys, canonical input digest, exact archived source/engine byte hashes, immutable historical readback after changed company and restart, stale revision refusal and four simultaneous identical snapshots yielding one persisted result.
- Final `node --test qa-readiness.cjs`: 7/7 passed against the actual collection catalog and method registry. Tested ordinary oven mapping, unknown custom activities, incompatible units and forged approval-looking detail strings, method detail preservation across reconciliation, changed-context review, duplicate/overlap detection, all-No exclusions and unresolved Scope 3 units despite populated details.
- `node --check readiness-ui.js`: passed. Source review confirmed matching workspace/readiness revision retry, explicit historic-review presentation, escaped dynamic text and saved-revision-only writes.

## Findings retained and disposition

1. **Resolved — scope mapping mismatch.** Actual registry used `scope1` while initial engine expected `1`; every real mapped method appeared unsupported. Synthetic author test registry did not reveal it. Engineer normalized registry scope and the independent actual-registry fixture now passes.
2. **Resolved — unresolved unit policy accepted arbitrary units.** Candidate Scope 3 entries intentionally had empty unit lists. Initial engine skipped unit validation, allowing a prepared status with arbitrary units. Engineer added blocking `unit-policy-unresolved`; independent full-detail Scope 3 fixture now stays `needs-input`.
3. **Resolved by source recheck — mixed revision presentation.** Initial UI fetched company/period and assessment independently without matching revisions. Root added two-attempt revision matching or explicit failure, including the method-detail-save path. Historical intro is now company-neutral; the banner explains current-workspace sidebar context.
4. **Resolved before test execution — malformed validation insertion.** Initial in-progress server source had an incorrectly indented duplicate `readinessDetails` block in screening validation. Engineer corrected it. Subsequent real-server checks pass.
5. **Explicit limitation — free-text record semantics.** Record types and method details are descriptions, not independently verified typed accounting inputs. The engine now calls for record-semantic review. Recognized collection units do not release conversions or establish factor compatibility. Overlap/multiple-site checks are conservative flags; they do not implement asset allocation or reconciliation decisions.

## Production and release blockers

- `server.py` binds loopback and uses a single `local-workspace`; the app header and local session protect local cross-origin mutations, not authenticated users or tenant access. No customer-facing deployment or authorization is accepted here.
- The local SQLite file is unencrypted by the app. DATABASE.md records no malware scanning/quarantine, independently tested disaster recovery, attributed qualified approval workflow or production retention/erasure implementation.
- The registry is candidate-only, with no released factors, executable accounting methods, human source-use approvals, qualified accounting approval or report/assurance delivery. Broad coverage of screening categories is not calculation coverage.
- Exact archived sources and checks support local reproducibility; hashes are not legal/source approval, signatures or a tamper-proof audit log. A local database owner can alter storage outside the application controls.
- No legal-currentness judgment, professional assurance, hostile deployment penetration test, load test, physical-device/accessibility certification or live hosted test was performed by this reviewer.

Next owner: root integrates the local demonstration and truthful operational record, retains separate professional/source/security release gates, and obtains board feedback before a dependent milestone. Do not describe this verdict as complete corporate Scope 1–3 or production customer readiness.

## Exact reviewed file digests

| File | SHA-256 |
| --- | --- |
| `readiness-core.js` | `c6460cfb91aad008f136722466ebd53d9db7a9201c529c9d25d90ebb8498dabb` |
| `readiness-cli.cjs` | `955d5f6838680b1b70aa5309163aaf00da1c1dcca2aabd80906fc6f4e0b85536` |
| `server.py` | `d2321207994308ba63fb47c227f8f650dcd36530f6bc74ab14cf68dfd0a55402` |
| `readiness-ui.js` | `39de969a50cf2c814a4749cee06c64907b78003fbcbf09f69fb221b9acd20545` |
| `readiness.html` | `bef71e4c1b98a2fc4fab9e79d0cdc9e8dd3c453f20c4a8a3e13ea4ad70cc271a` |
| `readiness.css` | `4c47061402eda3759e32438d23a2e2c4129b70a118e2267eecc54a004633482a` |
| `plan-core.js` | `0e9ea37f5a0be7574fd5a976018964499befa98be9b914bc572ca48ba293d21f` |
| `data/readiness-methods.json` | `36591b40fe53430e85079ab3692a85f97189c111bdb1c2fe2be4dbeba7da793b` |
| `data/collection-catalog.json` | `88c734aa909c6a23418870fa8b42101c8a5b3cc369749d4c9c45719b82232c8e` |

## Final UI supplement — 2026-09-25

The original findings and candidate digests above are retained. Targeted independent source re-review accepts the subsequent display changes to `readiness-ui.js`: historical company/period context now comes from the exact saved `assessment.inputs.onboarding`; candidate approach text uses the escaped method approach description; the detail form explicitly keeps unknown answers blank and says explanatory text is not technical validation.

A further edge case was found and corrected during this supplement: a historical snapshot with `onboarding: null` initially fell back to the current company's details, contradicting its historical banner. The corrected historical branch uses an empty context for missing/null saved onboarding and therefore shows unknown company/period rather than current data. Source assertions for this branch, escaped approach rendering and unknown-answer guidance passed; `node --check readiness-ui.js` passed. No implementation changes were made by this reviewer.

Final accepted UI SHA-256: `eb87d6b15f8494e39cc1165bdd46735893ba4b7dcf2f21657ded170f81fc7bcc`. This supersedes only the earlier UI digest, not the preserved first-review history or production limitations.

Root reports a browser demonstration on isolated port 4324: collection deep link, selected oven persistence, method-detail save to revision 4 and fuel-note persistence after reload. This is explicitly author-reported browser evidence, not independent browser execution. Root also reports the integrated checks passing; this supplement does not relabel those runs as reviewer-executed. The original scoped verdict remains unchanged.


## Publication line-ending normalization supplement — 2026-09-25

Independent follow-up checks passed against the final LF-normalized files: `python -B qa-readiness.py` 6/6 and `node --test qa-readiness.cjs` 7/7. This includes newly generated archived engine/catalog/method byte hashes, persisted snapshots, restart, concurrent idempotency and actual-registry behavior.

For the three runtime files whose earlier digests changed, exact prior reviewed bytes were reconstructed by line-ending conversion only: server and core had CRLF throughout; the CLI had LF on its first three lines and CRLF on its last line. Their reconstructed hashes matched the original review. The initial uniform-CRLF reconstruction did not match the mixed CLI; exact mixed-ending reconstruction did. No semantic change was found. The registry and final UI digests remain unchanged. Earlier findings and verdict remain intact.

Final publication artifact digests (these supersede prior digest entries for the same files):

| File | SHA-256 |
| --- | --- |
| `server.py` | `043328848881222b6cd3ee2f0fcfad1032940f0f67ae51b32312e020d73ef115` |
| `test_server.py` | `6ad87827b3417c4896d2446b1db9d8290bbe0b7d37fd75c91a3ae04abb541636` |
| `readiness-core.js` | `4e9a0a8923d81177ed6793e0dae14a26f1c6f40d5ea5a92c6cfa9ae142a08fc5` |
| `readiness-core.test.cjs` | `ec47db1de8a401809a1902f14809935777e83733315e8c236432dfd096152a1b` |
| `readiness-cli.cjs` | `a0c30f99e12fa2203ebf73c11c09ca1bee383062c720caf1687e5c09d08a62c2` |
| `qa-readiness.py` | `604fa22c4bcd5f3e2f8f5d9f571451d475f26261b1dd5386d962e16051c772be` |
| `qa-readiness.cjs` | `ea1b61b13cf9156fd46e540fbc6a99c0b1f7de8e6060c959e15d4616dbd0560b` |
| `READINESS-DOMAIN.md` | `1e0110004545095878e67e89c74141c990de189fae36843fa13f813cb15d1f9a` |
| `data/readiness-methods.json` | `36591b40fe53430e85079ab3692a85f97189c111bdb1c2fe2be4dbeba7da793b` |
| `readiness-ui.js` | `eb87d6b15f8494e39cc1165bdd46735893ba4b7dcf2f21657ded170f81fc7bcc` |

## Final contrast correction supplement — 2026-09-25

Root author discovered a visual contrast failure during the final screenshot check: new light readiness panels inherited light text from the existing dark collection stylesheet. This finding was made by the root author, not this independent reviewer, and occurred after the earlier source-level UI acceptance. Root corrected colors to dark-theme surfaces and compatible foregrounds without changing semantic code.

Targeted independent source review confirms readiness summary/card/empty panels now use existing `--panel` (`#121615`), appropriate dark banner/chip/history surfaces, and light body/muted/green text. Numerical sRGB contrast checks for the explicit normal text pairs passed: panel body 15.06:1, muted 7.85:1, findings 10.58:1, amber chip 8.10:1, candidate chip 9.54:1, unsupported chip 8.04:1, banner body 13.16:1. This covers those declared source pairs, not every rendered/disabled/hover state or accessibility certification. Root owns the final screenshot recheck; reviewer did not independently repeat browser rendering.

Final accepted `readiness.css` SHA-256: `5568cbaba112463a616c7f8714c1ee8af231efb947def5c8548428252250e436`, superseding its original digest. Earlier findings, evidence attribution and production limitations remain preserved.

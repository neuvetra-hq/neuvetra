# Readiness feedback repair — review handoff

All nine reported bugs and product concerns A–F have been addressed within the local prototype scope. Independent collection/readiness QA and separate convergence review passed. Source feedback: https://docs.google.com/document/d/1Gix-uTZGn_E6hhS4GcF5QZ-I-JSKIapz2scLOgjI0d0/edit . The board authorized all fixes in the coordinator chat.

## What changed

| Feedback | Delivered behavior |
|---|---|
| 1, 6 | Subtype-specific accepted unit dropdown, canonical aliases and safely grouped comma quantities; exact original text retained. Unsupported units are caught in collection. |
| 2 | Local subtype/location edits do not trigger renewed review; actual onboarding, screening and catalog changes do. |
| 3 | Distinct fuel/source records can share periods; suspected duplicate/coverage findings remain explicit. |
| 4 | Selected or in-flight files block saving/closing; input disabling, unload and stale-dialog guards prevent silent loss. |
| 5, 9 | Stored document recovery list, relinking and atomic duplicate reuse without extra quota. Original immutable evidence/history retained. |
| 7, 8 | Single company-name punctuation and one canonical reporting-company choice, with legacy assignment provenance. |
| A | Structured customer fuel/source/vehicle/model-year/refrigerant/charge facts. Catalog candidate method shown separately. Placeholder prose cannot elevate readiness; reviewer method/factor approval stays pending. |
| B | Five prioritized actions grouped by activity; full activity and findings lists collapsed. |
| C | Company-wide Scope 3 categories default and migrate appropriately; explicit site links and unknown answers retained; site-specific categories still require coverage. |
| D, E | Exclusions separated from active totals; internal revision numbers retained in lineage rather than user prose. |
| F | Grounded schema-22 convergence decision, mapping, feature gate, migration/cutover criteria and tested offline handoff validator. Hosted migration is explicitly not performed. |

## Reproduce and review

Use a fresh checkout of the rolling PR6 commit containing this file. Run the commands in `.github/workflows/inventory-plan.yml`; all eleven passed locally in `feedback-check-results.json`. The independent adversarial suites cover client/server normalization, context invalidation, simultaneous duplicate uploads, quota, placeholders, overlap, exclusions and exact snapshot replay. Windows HTTP symlink case is skipped locally; Linux CI runs it.

For a clean browser scenario, start `python -B server.py --port 4332 --db <new-empty-local-file>` from this directory, then run `python -B feedback-bayline-fixture.py 4332`. The helper requires an explicit port and refuses any workspace that is not exactly initial/empty. Never use port4319 or an existing company database. The coordinator's retained demonstration is on port4331 with a separate synthetic Bayline database outside Git; its facts and evidence do not belong to the board's Acme draft.

Open the collection page. Test boiler units and 4,210 quantity; save first subtype/location edits; add separate gasoline and diesel annual records. Select a file and Save without Attach; upload then close without Save and recover through the stored-document list; upload identical bytes again. Open readiness: enter n/a, confirm it remains missing, then enter factual data. Inspect the short action list, exclusions, company-wide Scope3, snapshot/history and exports. Repeat desktop and narrow-screen checks.

## Evidence and limits

- `feedback-independent-review.md`: independent product verdict, exact hashes and preserved first test-harness failures.
- `feedback-convergence-review.md`: separate independent convergence verdict; the convergence author did not review their own artifact.
- `feedback-check-results.json`: full focused local test outputs.
- `feedback-bayline-receipt.json`: coordinator browser/API observations, original quantity readback, one evidence row, no false review flags, and saved readiness history.
- `CONVERGENCE.md`: implemented decision/validator versus future hosted import/cutover. No production data or services changed.

The browser automation's download event timed out; a newly downloaded file was not confirmed this turn. Snapshot integrity and execution from archived bytes passed. Browser locations were visually checked; the tool's semantic click routing was unreliable, and the visible coordinate navigation worked. Mobile check requested390px; the app browser reported355 CSS pixels with341px document width and no horizontal overflow. A physical device and assistive technology audit were not performed.

This completion is the feedback repair, not a complete corporate inventory, hosted tenant cutover, source/method release, customer launch, compliance claim or assurance opinion. The other AI should independently challenge the changes and these boundaries before a dependent feature milestone.

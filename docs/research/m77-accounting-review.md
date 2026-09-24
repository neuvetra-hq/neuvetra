# M77 independent accounting/source contract review

Reviewer `/root/m77_cpo`, September 16, 2026. Root authored the contract; this reviewer did not author it or its calculator. Accounting critical dispatch and historical accounting-worker continuation failed with agent-thread limit reached, so this is a disclosed fallback review by the active CPO context. Inherited requested route Sol/medium; actual compute unknown. This is internal review, not qualified human assurance or production method approval.

## Initial verdict — corrections required

Reviewed `m77-accounting-contract.md` SHA256 `24a0422b4d166496fa289b982c1456c1d7603ccc6c8088a950db7618f13efa71`. The bounded equation, conservative admission, zero safeguards and candidate GWP policy are reasonable for an offline development foundation. Two contract corrections are required before accepting the calculation specification:

1. The negative-example list rejects releases “predating refill,” contradicting the body which links each release to a later refill. Reject a release after its linked refill, or a refill before the release. Dates are day-level, so state the same-day policy explicitly rather than claiming observed within-day chronology.
2. Servicing mass must have one consistent meaning. “Actual new gas added to this asset” can mean retained charge, while the following sentence says service losses are included. Define the summed mass as new gas supplied/used during servicing, including documented gas lost during that servicing, and explain it is not merely net gas retained in the device. For an independently evidenced visit using 1.000000 kg, with 0.900000 kg retained and 0.100000 kg lost while servicing, the method input is 1.000000 kg. If the field only represents retained charge, block that visit pending separately supported loss handling. Never add a separate discharge amount to the servicing quantity.

## Evidence and independent checks actually performed

- Opened [current EPA guidance index](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance) and its linked [December 2023 fugitive guide](https://www.epa.gov/sites/default/files/2020-12/documents/fugitiveemissions.pdf). Read printed pages 3, 8, 12–17. The equation's installation, service and disposal terms, stock/retrofit eligibility, suppressant extension, leakage timing uncertainty and double-counting cautions support the candidate interpretation. Boundary-full-charge restrictions are the product's conservative policy, not an EPA mandate.
- Independently rehashed retained EPA2025 workbook at `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-factors-hub-2025.xlsx`: exact SHA256 `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`. Read ZIP/XML literal cells without relying on displayed spreadsheet rounding: E532=1300, E538=3350, D575=1924, E575 identifies 50/50 HFC-32/HFC-125. No formulas in those cells. Opened [EPA2025 published factor PDF](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf) as corroborating source. Retained bytes are not a new remote workbook hash or release approval.
- Independently checked examples: 2×1924=3848; .125×1300=162.5; 2.5×3350=8375. At four decimals, .000001×3350=.00335 rounds half-even to .0034, and .000003×3350=.01005 rounds to .0100. The published blend GWP1924 is the pinned candidate factor; constituent comparison1923.5 must not become a second calculation path.
- Initial optional `openpyxl` read failed because the local default Python lacks that library. Standard-library ZIP/XML inspection succeeded; no dependency installation or workbook mutation occurred.

## Integration challenges and unrun checks

The stricter full-charge boundary and complete contractor coverage criteria guard against false annual zero but declarations do not establish evidence truth. Keep zero labeled an estimate. Known unrecharged losses, gas uncertainty, recovery/reuse, retrofit, stocks and mobile sources remain blocking. Cross-device reservations, physical population completeness, immutable corrections, separate reviewer eligibility, exact old report bytes and tenant/actor boundaries require native integration evidence; none was executed in this contract review. The calculator file did not yet exist during initial contract inspection. No numerical engine acceptance, migration, hosted acceptance or M77 completion is issued.

Preserve this initial verdict when repairs are reviewed. Root owns specification repairs; this reviewer can challenge the exact repaired contract and independently exercise the future engine. Full product acceptance remains P01–P10 in `m77-product-brief.md`, independently reviewed by root separately from this accounting review.

## Repaired contract and offline engine verdict — accepted within stated bounds

The repaired contract explicitly defines servicing consumption including servicing escape and corrects release/refill chronology, with evidence-backed same-day order. Both initial findings are resolved for this specification. Reviewed hashes:

| Artifact | SHA256 |
| --- | --- |
| Repaired contract | `99c0d6c8aafa7755d3a1c41b92a869ccb6826b223d6300612ac12853c2875922` |
| Offline calculator | `3c81c8d1b4ee6b2435765013d0578021556b70d35f16e4512ebecf1c873f25b4` |
| Author test | `5040a0518c51e3845e7496ee000e833173dc71027ddc883c2a4f2d0abf7f57c0` |
| Independent test | `488b0966002db54f6c4eed7c081e63f60231bf6b11d6d741a60209d94e9a9cc6` |

Read the actual function and author tests. Independently authored `evaluations/research-qa/m77-independent-calculation.py` with a fresh literal fixture and source-derived quantities. `python evaluations/research-qa/m77-independent-calculation.py` passed 8 tests. Cases exercise all four admitted gas/equipment pairings and exact source pins, total servicing consumption with escape, once-counted known discharge, same-day explicit chronology, unlinked/post-refill/excess releases, explicit zero and every eligibility declaration's boolean typing, malformed/noncanonical quantities, half-even ties and maximum-mass tie, 100/101 refill cap, duplicate contractor-reference and cross-kind event ID, unsupported mobile/gas/unit/year, forged factor/method/offset fields, nonmutation, reordered equivalent keys and changed activity. These are offline function checks, not native persistence or document-verification tests.

No open blocker was found for this deliberately unmounted offline calculator. Caller assertions remain unverified, including whether a quantity is total servicing consumption or only retained charge; integration must bind them to actual evidence. Cross-device reservations, release cap behavior at native boundaries, complete physical population, corporate/version bindings, separate reviews, corrections, retained exports, tenant isolation, migration/recovery and hosted/browser acceptance remain pending. No complete M77, released method or actual inventory claim follows. CI wiring and source-extract manifest were not yet present when this verdict was written and require separate review.

## Foundation bundle final review — accepted, no product-completion verdict

Reviewed candidate source-evidence JSON (`01e3987f2fd2e10a90b413542d39108f17d48436988aa6c8beb5e2b1613af0b3`), technical contract (`8021c34834c2734a0d9988e5436900c9eb2d02869b4ce2df280c889a5bbf333f`) and workflow (`66882b38b33847b5d83b78b123c8a0bf58a75eb4e5655d76c35cb13e4cc5fdf5`, new offline GHG step only). Rehashed the retained guidance PDF and confirmed its declared `fb3dd5c9677096094c2acef769c7fe2fb90def6feac403cf9c817f5810928d88`. Source JSON preserves candidate/retrieval-only limitations and exact cell lineage. The technical contract separates offline acceptance from future schema, evidence authority, population, review, browser and recovery work without claiming those are implemented.

Executed both exact added workflow commands from repository root: `python -m unittest discover -s apps/site-api/src/calculation -p m77_fugitive_test.py -v` passed 8 author tests; `python evaluations/research-qa/m77-independent-calculation.py` passed 8 independent tests. Discovery imports the calculator successfully; the independent filename and path-based standard-library import work. The complete workflow/remote CI was not executed by this reviewer. Root must check staged and committed blob hashes against accepted bytes (including line-ending normalization), publish to the same rolling PR and observe required remote checks before reporting publication.

Final verdict: the exact bounded offline foundation bundle is internally independently accepted with no open blocker in that scope. Root separately accepted the revised product brief as future complete-M77 criteria. P01–P10 remain unpassed; no live/database change, full M77 completion, approved production method, verified physical evidence, compliance or external assurance is asserted. This reviewer finishes this assignment; no continuing worker is implied by this record.

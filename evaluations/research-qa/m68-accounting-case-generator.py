"""Independent M68 design examples; no product imports or runtime-pass claims."""
from decimal import Decimal, localcontext, ROUND_HALF_EVEN
from pathlib import Path
import json

MONTHS = [f"2023-{n:02d}" for n in range(1, 13)]
JAN = MONTHS[0]

def example(name, rows, sources):
    quantities = {m: rows.get(m) for m in MONTHS}
    n = sum(int(Decimal(q) * 1000) for q in quantities.values() if q is not None)
    with localcontext() as context:
        context.prec = 96
        kwh = Decimal(n) / 1000
        exact = kwh / 1000 * Decimal("195.0402888")
        display = format(exact.quantize(Decimal("0.0001"), rounding=ROUND_HALF_EVEN), ".4f")
    quotient, remainder = divmod(n * 1950402888, 10**9)
    if remainder > 500000000 or (remainder == 500000000 and quotient % 2):
        quotient += 1
    assert display == f"{quotient // 10000}.{quotient % 10000:04d}"
    mismatch = bool(sources) and Decimal(quantities[JAN]) != Decimal("12345")
    return {
        "id": name,
        "months": [{"month": m, "quantityKwh": quantities[m]} for m in MONTHS],
        "links": [{"fixture": s, "month": JAN, "sourcePage": 1,
                   "manualConfirmation": True,
                   "quantityDifferenceReason": "Fictional manual amount intentionally differs." if mismatch else None}
                  for s in sources],
        "coverage": {
            "enteredMonths": sum(q is not None for q in quantities.values()),
            "missingInputMonths": [m for m in MONTHS if quantities[m] is None],
            "linkedDocumentMonths": int(bool(sources)),
            "unambiguousDocumentMonths": int(len(sources) == 1),
            "missingDocumentMonths": MONTHS[1:] if sources else MONTHS,
            "overlappingDocumentMonths": [JAN] if len(sources) > 1 else [],
            "quantityDifferenceMonths": [JAN] if mismatch else [],
        },
        "annualReuse": {"quantityKwh": format(kwh, ".3f"),
                        "exactKgCo2e": format(exact, "f").rstrip("0").rstrip(".") if exact else "0",
                        "displayKgCo2e": display},
    }

accepted = [
    example("january_match_no_link", {JAN: "12345.000"}, []),
    example("january_match_one_bill", {JAN: "12345.000"}, ["A"]),
    example("january_match_replacement_bill", {JAN: "12345.000"}, ["B"]),
    example("january_match_overlap", {JAN: "12345.000"}, ["A", "B"]),
    example("january_mismatch_one_bill", {JAN: "25000.000"}, ["A"]),
    example("january_mismatch_overlap", {JAN: "25000.000"}, ["A", "B"]),
    example("january_zero_one_bill", {JAN: "0.000"}, ["A"]),
    example("january_zero_no_bill", {JAN: "0.000"}, []),
    example("january_missing_february_entered_no_links", {"2023-02": "1.000"}, []),
    example("twelve_zeros_no_bills", dict.fromkeys(MONTHS, "0.000"), []),
    example("twelve_25000_one_january_bill", dict.fromkeys(MONTHS, "25000.000"), ["A"]),
    example("m67_board_vector_one_january_bill", {**dict.fromkeys(MONTHS, "25000.000"), "2023-12": "26000.000"}, ["B"]),
    example("twelve_minimum_one_january_bill", dict.fromkeys(MONTHS, "0.001"), ["A"]),
]
refusals = [
    ["same_source_id_twice", "Refuse before creating successful version; no double count."],
    ["same_bytes_different_source_ids", "Refuse duplicate source hashes; no manufactured overlap."],
    ["january_document_linked_to_february", "Refuse; February statement date is not service period."],
    ["january_document_linked_to_missing_january", "Refuse confirmed link to null quantity."],
    ["unsupported_page", "Refuse page 0, page 2, missing or noninteger locator."],
    ["unsupported_or_changed_original_bytes", "Refuse despite coordinated claimed hash/length metadata."],
    ["mismatch_missing_reason", "Refuse even when correction reason exists."],
    ["one_of_two_mismatches_missing_reason", "Refuse; each link needs its own discrepancy explanation."],
    ["matching_quantity_nonnull_reason", "Refuse; canonical equality requires null."],
    ["mismatch_blank_or_unsafe_reason", "Refuse under existing M66 safe-text rules."],
    ["missing_manual_confirmation", "Refuse implicit upload-only confirmation."],
    ["unowned_source_or_annual_version", "Refuse cross-tenant linkage."],
    ["annual_snapshot_claimed_hashes_disagree", "Refuse; selected authoritative M67 snapshot governs."],
    ["fabricated_coverage_or_period_metadata", "Refuse claimed coverage inconsistent with original sources and rows."],
]
lifecycle = [
    ["add_A_to_no_links", "New version; January leaves missing-document list; total unchanged; unreviewed."],
    ["replace_A_with_B", "New version despite identical quantities/coverage; old source/report bytes unchanged."],
    ["add_B_to_A", "New version; linked months stays 1, unambiguous becomes 0, overlap January; total unchanged."],
    ["remove_B_from_overlap", "New version; overlap empty, unambiguous 1, no numerical change."],
    ["remove_final_link", "New version; all twelve months missing documents; total unchanged."],
    ["explanation_only_change", "New version and new review required, even with identical source/annual version."],
    ["annual_version_only_same_totals", "New version for new immutable annual identity, even if only a label changed."],
    ["january_to_null_new_annual_version", "Requires removing January links; no transfer to another month."],
    ["mismatch_to_match_new_annual_version", "Clear link discrepancy reasons; new version unreviewed."],
    ["link_order_only_or_quantity_format_only", "Canonical no-op; no successor for equivalent effective inputs."],
    ["correction_reason_only", "Canonical no-op when annual version, links and discrepancy reasons unchanged."],
    ["late_review_after_report", "Old report stays unreviewed; a new report may capture later decision."],
]
result = {"policy": "m68-accounting-evidence-v1", "kind": "independently_derived_design_expectations_not_runtime_results",
          "accepted": accepted, "refusals": [{"id": i, "expected": e} for i, e in refusals],
          "lifecycle": [{"id": i, "expected": e} for i, e in lifecycle]}
target = Path(__file__).with_name("m68-accounting-cases.json")
target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"accepted": len(accepted), "refusals": len(refusals), "lifecycle": len(lifecycle),
                  "decimal_integer_rounding_agreement": True, "product_runtime_executed": False}))

// Scope 3 completion I-03 part 2: every reason the spend and supplier methods and their collection holds can give is
// shown in plain words (screen, print and CSV read them through reasonText), never the code's fallback spelling.
import { describe, expect, test } from "bun:test"
import { SCOPE3_REASON_TEXT_I03 } from "../../../../packages/neuvetra-database/src/scope3-text"
import { reasonText } from "./plain-language"

describe("I-03 reasons in plain language", () => {
  test("every engine finding, adapter hold and line note has its text", () => {
    const codes = Object.keys(SCOPE3_REASON_TEXT_I03)
    expect(codes.length).toBeGreaterThan(25)
    for (const code of codes) expect([code, reasonText(code)]).toEqual([code, SCOPE3_REASON_TEXT_I03[code]!])
    for (const code of ["currency_not_supported", "naics_not_valid_for_category", "energy_spend_belongs_in_scope_1_2_or_cat3", "trade_sector_naics_maps_margin_only", "category_9_spend_paid_by_company",
      "spend_overlap_not_confirmed", "possible_duplicate_spend_line", "spend_line_date_outside_reporting_period", "factor_unit_mismatch", "allocation_not_applicable_to_product_factor", "superseded_by_supplier_record"])
      expect(codes).toContain(code)
    // The superseded line's note names the supplier record; it reads as the note's text.
    expect(reasonText("superseded_by:93700000-0000-4000-8000-000000001001")).toBe(SCOPE3_REASON_TEXT_I03.superseded_by)
  })
})

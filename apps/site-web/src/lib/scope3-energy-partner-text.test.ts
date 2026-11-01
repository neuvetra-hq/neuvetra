// Scope 3 completion I-05: every reason the energy-resold, commuting, teleworking, asset-energy and partner methods and their
// collection holds can give is shown in plain words (screen, print and CSV read them through reasonText), never the code's
// fallback spelling; every note and estimate those methods emit has disclosure text; a shipped text is never replaced.
import { describe, expect, test } from "bun:test"
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_I05, SCOPE3_REASON_TEXT_I05 } from "../../../../packages/neuvetra-database/src/scope3-text"
import { reasonText } from "./plain-language"

describe("I-05 reasons and disclosures in plain language", () => {
  test("every engine finding and adapter hold has its text; the reused grid holds keep their shipped words", () => {
    const codes = Object.keys(SCOPE3_REASON_TEXT_I05)
    for (const code of codes) expect([code, reasonText(code)]).toEqual([code, SCOPE3_REASON_TEXT_I05[code]!])
    for (const code of ["mode_shares_must_total_100", "allocated_share_exceeds_one", "building_area_or_occupancy_zero", "partner_share_denominator_zero", "partner_period_mismatch",
      "resold_energy_in_scope2_not_confirmed", "commuting_overlap_not_confirmed", "occupancy_not_applicable_to_mode", "refrigerant_not_an_engine_token", "occupancy_percent_over_100",
      "lease_type_required", "consolidation_approach_required", "finance_lease_in_scope1_2", "lease_in_scope1_2_under_boundary", "lessor_operating_lease_in_scope1_2",
      "energy_resold_record_held", "cbecs_activity_not_an_engine_token"]) expect(codes).toContain(code)
    // Codes shared with Scope 2 and 3C are not redefined (their shipped texts stay).
    for (const code of ["subregion_not_an_egrid_subregion", "utility_eia_id_not_numeric", "zip_not_in_lookup", "utility_required_for_multi_subregion_zip", "utility_not_listed_for_zip_and_subregion"]) {
      expect(codes).not.toContain(code)
      expect(reasonText(code)).not.toBe(code.replace(/_/g, " "))
    }
  })

  test("every I-05 note and estimate is a disclosure with its own text", () => {
    for (const [code, text] of Object.entries(SCOPE3_DISCLOSURE_TEXT_I05)) expect([code, SCOPE3_DISCLOSURE_TEXT[code]]).toEqual([code, text])
    for (const code of ["upstream_of_resold_energy_excluded", "location_based_grid_rates", "us_average_grid_rate", "average_data_commuting_profile", "non_motorized_known_zero", "commute_vehicle_occupancy_one",
      "optional_activity_included", "incremental_above_baseline", "default_heat_content", "asset_lifecycle_excluded", "warehouse_site_specific", "area_allocated_not_submetered",
      "blend_gwp_hfc_pfc_constituents_only", "partner_data_unverified", "partner_gwp_basis_unknown", "partner_scope2_market"]) expect(Object.keys(SCOPE3_DISCLOSURE_TEXT_I05)).toContain(code)
  })
})

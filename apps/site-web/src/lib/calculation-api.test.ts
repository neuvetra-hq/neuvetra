import { describe, expect, test } from "bun:test"
import { decodeCalculationResponse } from "./calculation-api"

function record() {
  return {
    contract_version: "m42-calculation-result-v1", status: "calculated",
    classification: { release_eligible: false, runtime: "not_released" },
    activity: {}, input_snapshot_sha256: "a", method: {}, factor: {}, gwp_policy: {}, conversion: {},
    gas_results: {
      co2: { mass: "53.06", mass_unit: "kg CO2", co2e: "53.06", co2e_unit: "kg CO2e" },
      ch4: { mass: "0.001", mass_unit: "kg CH4", co2e: "0.028", co2e_unit: "kg CO2e" },
      n2o: { mass: "0.0001", mass_unit: "kg N2O", co2e: "0.0265", co2e_unit: "kg CO2e" },
    },
    trace: [{ step: "total", expression: "53.06 + 0.028 + 0.0265", result: "53.1145", unit: "kg CO2e" }],
    total: { unrounded: "53.1145", display: "53.1145", unit: "kg CO2e", rounding: "half even" },
    result_payload_sha256: "b",
  }
}

function electricityRecord(): Record<string, unknown> {
  return {
    contract_version: "m53-electricity-calculation-result-v1", status: "calculated",
    classification: { source: "retained_primary_source_currentness_checked_2026-09-12", factor: "development_candidate", method_approval: "pending_independent_factor_method_approval", release_eligible: false, runtime: "not_released" },
    activity: {
      asset_id: "Synthetic California office 001", boundary: "Purchased electricity consumed by the reporting company",
      geography: { country: "United States", state: "California", egrid_subregion: "CAMX" }, reporting_period: { start: "2023-01-01", end: "2023-12-31" },
      electricity: "Grid-delivered purchased electricity", quantity: "1", unit: "MWh",
    },
    input_snapshot_sha256: "fdd1b5b8d5de95255d406f33412a5a10b40df8bdc7881d9a6fb95a71330f1c2b",
    method: { id: "scope2-location-based-egrid-subregion", version: "2023-r2-camx-v1", implementation_sha256: "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c", scope: "Scope 2", category: "location-based purchased electricity", formula: "MWh × published eGRID subregion total-output CO2e rate" },
    factor: {
      id: "epa-egrid2023-r2-camx-total-output", version: "eGRID2023-revision-2", status: "development_candidate", release_eligible: false, data_year: "2023",
      geography: { country: "United States", state: "California", egrid_subregion: "CAMX", name: "WECC California" },
      components: { co2: { value: "194.3512704", unit: "kg CO2/MWh", cell: "AC6" }, ch4: { value: "0.01134", unit: "kg CH4/MWh", cell: "AE6" }, n2o: { value: "0.0013608", unit: "kg N2O/MWh", cell: "AG6" } },
      total_output_co2e: { value: "195.0402888", unit: "kg CO2e/MWh", cell: "AI6" },
      source: { publisher: "U.S. Environmental Protection Agency", title: "eGRID2023 metric data file, revision 2", workbook_sha256: "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab", sheet: "SRL23", table: "eGRID subregion annual total output emission rates", row_cells: ["A6", "B6", "C6", "AC6", "AE6", "AG6", "AI6"], header_cells: ["A1", "B1", "C1", "AC1", "AE1", "AG1", "AI1"], publisher_url: "https://www.epa.gov/egrid/detailed-data", rights_status: "federal_public_data_commercial_use_citation_reviewed; method_release_pending" },
      candidate_sha256: "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356",
    },
    gwp_policy: { id: "epa-egrid2023-ar5-100-year", version: "egrid2023-technical-guide-v1", assessment: "IPCC AR5 without climate-carbon feedbacks", time_horizon_years: "100", values: { co2: "1", ch4: "28", n2o: "265" }, source: { publisher: "U.S. Environmental Protection Agency", title: "Technical Guide for eGRID2023", page: "12", section: "3.1.1.2 Annual Emission Estimates for CH4, N2O, and CO2 equivalent", publisher_url: "https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf" }, policy_sha256: "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5" },
    conversion: { id: "identity-mwh-v1", ratio: "1 MWh = 1 MWh" },
    gas_results: { co2: { mass: "194.3512704", mass_unit: "kg CO2", co2e: "194.3512704", co2e_unit: "kg CO2e" }, ch4: { mass: "0.01134", mass_unit: "kg CH4", co2e: "0.31752", co2e_unit: "kg CO2e" }, n2o: { mass: "0.0013608", mass_unit: "kg N2O", co2e: "0.360612", co2e_unit: "kg CO2e" } },
    trace: [
      { step: "published_total_output", expression: "1 * 195.0402888", result: "195.0402888", unit: "kg CO2e" },
      { step: "component_sum_reference", expression: "194.3512704 + 0.31752 + 0.360612", result: "195.0294024", unit: "kg CO2e" },
      { step: "published_rate_rounding_delta", expression: "195.0402888 - 195.0294024", result: "0.0108864", unit: "kg CO2e" },
    ],
    total: { unrounded: "195.0402888", display: "195.0403", unit: "kg CO2e", rounding: "four decimal places; ROUND_HALF_EVEN; no intermediate rounding" },
    reconciliation: { authority: "published total-output CO2e rate in AI6", component_sum: "195.0294024", component_rounding_delta: "0.0108864", explanation: "EPA publishes the gas-specific rates as rounded columns. They are shown for inspection and are not silently substituted for the published CO2e total-output rate." },
    result_payload_sha256: "9c63b2cb12fa2708f35d394e537ca5803e27f91c4647f33376abf75a6fb72b91",
  }
}

describe("M42 calculation decoder", () => {
  test("accepts decimal strings and unreleased classification", () => {
    expect(decodeCalculationResponse({ status: "ok", record: record() }).status).toBe("ok")
  })

  test("rejects numeric totals and unknown result keys", () => {
    const numeric = record() as unknown as { total: { display: unknown } }
    numeric.total.display = 53.1145
    expect(() => decodeCalculationResponse({ status: "ok", record: numeric })).toThrow()
    const extra = record() as Record<string, unknown>
    extra.unexpected = true
    expect(() => decodeCalculationResponse({ status: "ok", record: extra })).toThrow()
  })

  test("rejects a release-eligible classification", () => {
    const unsafe = record() as unknown as { classification: { release_eligible: boolean } }
    unsafe.classification.release_eligible = true
    expect(() => decodeCalculationResponse({ status: "ok", record: unsafe })).toThrow()
  })
})

describe("M53 electricity calculation decoder", () => {
  test("accepts only the exact M53 activity, method, factor and source identity", () => {
    const electricity = electricityRecord()
    expect(decodeCalculationResponse({ status: "ok", record: electricity }).status).toBe("ok")
    const pythonOrdered = electricityRecord()
    pythonOrdered.trace = [
      { expression: "1 * 195.0402888", result: "195.0402888", step: "published_total_output", unit: "kg CO2e" },
      { expression: "194.3512704 + 0.31752 + 0.360612", result: "195.0294024", step: "component_sum_reference", unit: "kg CO2e" },
      { expression: "195.0402888 - 195.0294024", result: "0.0108864", step: "published_rate_rounding_delta", unit: "kg CO2e" },
    ]
    expect(decodeCalculationResponse({ status: "ok", record: pythonOrdered }).status).toBe("ok")
    const relabeledM42 = { ...record(), contract_version: "m53-electricity-calculation-result-v1", reconciliation: electricity.reconciliation }
    expect(() => decodeCalculationResponse({ status: "ok", record: relabeledM42 })).toThrow()
    const changed = electricityRecord()
    ;(changed.activity as { quantity: string }).quantity = "2"
    expect(() => decodeCalculationResponse({ status: "ok", record: changed })).toThrow()
    const fakeTotal = electricityRecord()
    ;(fakeTotal.total as { unrounded: string; display: string }).unrounded = "0"
    ;(fakeTotal.total as { unrounded: string; display: string }).display = "0.0000"
    fakeTotal.result_payload_sha256 = "0".repeat(64)
    expect(() => decodeCalculationResponse({ status: "ok", record: fakeTotal })).toThrow()
  })
})

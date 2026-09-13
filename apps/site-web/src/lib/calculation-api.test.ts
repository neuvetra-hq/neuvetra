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

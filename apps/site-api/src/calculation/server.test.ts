import { describe, expect, test } from "bun:test"
import { createCalculationRoutes, runEngine } from "./server"

const activity = {
  asset_id: "Synthetic boiler 001",
  boundary: "Owned stationary combustion source",
  geography: "United States",
  reporting_period: { start: "2025-01-01", end: "2025-12-31" },
  fuel: "Natural Gas",
  quantity: "1",
  unit: "MMBtu",
}

describe("M42 local calculation transport", () => {
  test("runs the real Decimal authority and preserves strings", async () => {
    const response = await runEngine({ action: "calculate", activity }) as any
    expect(response.status).toBe("ok")
    expect(response.record.total.display).toBe("53.1145")
    expect(typeof response.record.total.unrounded).toBe("string")
    expect(response.record.classification.release_eligible).toBe(false)
  })

  test("rejects a non-local browser origin before calculation", async () => {
    const app = createCalculationRoutes()
    const response = await app.handle(new Request("http://127.0.0.1/calculation/run", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ action: "calculate", activity }),
    }))
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe("forbidden")
  })
})

describe("M53 location-based electricity transport", () => {
  test("dispatches to the electricity Decimal method", async () => {
    const response = await runEngine({ action: "calculate", activity: {
      asset_id: "Synthetic California office 001",
      boundary: "Purchased electricity consumed by the reporting company",
      geography: { country: "United States", state: "California", egrid_subregion: "CAMX" },
      reporting_period: { start: "2023-01-01", end: "2023-12-31" },
      electricity: "Grid-delivered purchased electricity",
      quantity: "1",
      unit: "MWh",
    } }) as any
    expect(response.status).toBe("ok")
    expect(response.record.contract_version).toBe("m53-electricity-calculation-result-v1")
    expect(response.record.total.unrounded).toBe("195.0402888")
    expect(response.record.reconciliation.component_rounding_delta).toBe("0.0108864")
  })

  test("does not expand the fixed fixture to another quantity", async () => {
    const response = await runEngine({ action: "calculate", activity: {
      asset_id: "Synthetic California office 001",
      boundary: "Purchased electricity consumed by the reporting company",
      geography: { country: "United States", state: "California", egrid_subregion: "CAMX" },
      reporting_period: { start: "2023-01-01", end: "2023-12-31" },
      electricity: "Grid-delivered purchased electricity",
      quantity: "2",
      unit: "MWh",
    } }) as any
    expect(response.status).toBe("error")
    expect(response.error.code).toBe("synthetic_fixture_invalid")
  })
})

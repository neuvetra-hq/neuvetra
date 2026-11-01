/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real component without a DOM. */
// Scope 3 round 2, lane F (Claude, 31 October 2026): the energy-using product form offers therms for natural gas (the engine
// and adapter accept them since round 2, ACC-5), and the screen's words for a held record: a sold fuel outside Hub Table 1 has
// its own reason, so the shipped Scope 1 vehicle text of `fuel_not_an_engine_token` is shown for vehicles again.
import { describe, expect, test } from "bun:test"
import type { CollectionActivity, CollectionContext } from "../../../../packages/neuvetra-database/src/collection-contract"
import * as engineInput from "../../../../packages/neuvetra-database/src/collection-engine-input"
import * as contract from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import * as texts from "../../../../packages/neuvetra-database/src/scope3-text"
import { reasonText } from "@/lib/plain-language"
import * as defaults from "@/lib/scope3-form-defaults"
import * as forms from "@/lib/scope3-forms"
import * as registerLabels from "@/lib/scope3-register-labels"
import * as fields from "./scope3/Scope3Fields"
import { harness, loadComponent } from "./component-harness"

const W = "93910000-0000-4000-8000-000000000001", SETUP = "93910000-0000-4000-8000-0000000000aa", SITE = "93910000-0000-4000-8000-0000000000bb"
const context: CollectionContext = { companyId: W, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [{ id: SITE, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] }
const inject = { ...contract, ENGINE_SUBREGIONS: engineInput.ENGINE_SUBREGIONS, ...texts, ...defaults, ...forms, ...registerLabels, ...fields }

async function productForm() {
  const make = await loadComponent("./scope3/SoldEnergyProductForm.tsx", "SoldEnergyProductForm", inject)
  let activity = { kind: "sold_energy_product", locationId: SITE, setupVersionId: SETUP, sourceId: "SRC-1", state: "active", withdrawalReason: null, quantity: defaults.scope3InitialQuantity("sold_energy_product"),
    quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [], payload: defaults.scope3BlankPayload("sold_energy_product") } as CollectionActivity
  const app = harness(make, () => ({ activity, disabled: false, onEdit: (change: (next: CollectionActivity) => void) => { const next = structuredClone(activity); change(next); activity = next },
    env: { zipLookup: null, onZipLookup: () => {}, spendLines: [], context } }))
  await app.settle()
  const set = async (label: string, value: unknown) => { app.byLabel(label)!.props.onChange(value); app.render(); await app.settle() }
  return { app, set, get payload() { return activity.payload as unknown as Record<string, unknown> } }
}
const units = (app: { byLabel: (label: string) => any }) => app.byLabel("Energy unit")!.props.choices.map((choice: readonly string[]) => choice[0])

describe("round 2, lane F: energy-using products sold in therms; the sold-fuel hold's own words", () => {
  test("natural gas offers its Hub unit, MMBtu and therms; the therm payload is one the contract accepts; other carriers do not offer therms", async () => {
    const f = await productForm()
    await f.set("Product", "Synthetic gas water heater"); await f.set("Expected lifetime (years)", "12"); await f.set("Energy per year", "180.5")
    await f.set("Where the products are used", "US"); await f.set("Where the lifetime and energy figures come from", "Manufacturer test standard")
    await f.set("Energy used", "natural_gas")
    expect(units(f.app)).toEqual(["scf", "MMBtu", "therm"])
    await f.set("Energy unit", "therm")
    expect(f.payload.energyUnit).toBe("therm")
    expect(f.app.byLabel("Energy unit")!.props.choices.find((choice: readonly string[]) => choice[0] === "therm")[1]).toBe("therms")
    expect(contract.validateScope3Payload("sold_energy_product", f.payload)).toEqual(f.payload as never)
    await f.set("Energy used", "propane")
    expect(units(f.app)).not.toContain("therm")
    expect(f.payload.energyUnit).toBe("US_gallon")  // a unit the new carrier does not offer is replaced
    await f.set("Energy used", "electricity")
    expect(units(f.app)).toEqual(["kWh", "MWh"])
  })

  test("a vehicle record held for its fuel reads the shipped Scope 1 text; a sold fuel outside Hub Table 1 reads its own", () => {
    expect(reasonText("fuel_not_an_engine_token")).toBe("Choose gasoline or diesel for this vehicle record.")
    expect(reasonText("sold_fuel_not_an_engine_token")).toBe("This fuel isn’t one of the EPA Hub Table 1 fuels. Choose a listed fuel; the record isn’t counted until then.")
  })
})

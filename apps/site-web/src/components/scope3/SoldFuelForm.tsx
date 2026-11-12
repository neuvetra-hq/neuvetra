import { SCOPE3_SOLD_FUELS, type SoldFuelCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3TokenOptions } from "@/lib/scope3-forms"
import { SCOPE3_SOLD_FUEL_FACTS } from "@/lib/scope3-register-labels"
import { ChoiceField, QuantityFields, SelectField } from "./Scope3Fields"
import { fieldNeedsOf } from "@/lib/field-needs-wo12"

/** Fuels as the Hub names them, by label. */
const FUELS = SCOPE3_SOLD_FUELS.map(fuel => [fuel, SCOPE3_SOLD_FUEL_FACTS[fuel]?.label ?? fuel] as const).sort((a, b) => a[1].localeCompare(b[1]))
/**
 * Category 11, fuel sold (DESIGN 3.1): which EPA GHG Emission Factors Hub 2025 Table 1 fuel, how much (in its Table 1 unit
 * or MMBtu), and whether its users burn it (a feedstock that is not burned is a known zero, not an unknown).
 */
export function SoldFuelForm({ activity, onEdit }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "sold_fuel")
  const need = fieldNeedsOf("sold_fuel")
  const set = (change: (payload: SoldFuelCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "sold_fuel")))
  return <div className="setup-subcard"><h3>Fuel sold (Scope 3, category 11)</h3>
    <p>The combustion emissions of fuel the company sold, when its users burn it. Biogenic CO2 from biofuels is reported separately, outside the totals.</p>
    <div className="setup-grid">
      <ChoiceField need={need("fuel")} label="Fuel" value={p.fuel} choices={FUELS} placeholder="Choose a fuel (EPA Hub Table 1)" describeLabel="Fuel as described on the sales record" onChange={value => onEdit(next => {
        scope3PayloadOf(next, "sold_fuel").fuel = value
        const units = scope3FormUnits("sold_fuel", { fuel: value })
        if (!units.includes(next.quantity.originalUnit)) next.quantity.originalUnit = units[0]!
      })} />
      <QuantityFields need={need("quantity")} unitNeed={need("unit")} label={scope3QuantityLabel("sold_fuel", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("sold_fuel", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} hint="In the fuel’s Hub Table 1 unit or MMBtu: a plain number, up to 3 decimals." />
      <SelectField need={need("combustedInUse")} label="How it is used" value={p.combustedInUse} options={scope3TokenOptions("combustedInUse", ["yes", "no_feedstock"])} onChange={value => set(next => { next.combustedInUse = value as SoldFuelCollectionPayload["combustedInUse"] })} />
    </div>
  </div>
}

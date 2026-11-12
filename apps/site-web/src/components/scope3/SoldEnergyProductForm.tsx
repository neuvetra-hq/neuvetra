import { ENGINE_SUBREGIONS } from "../../../../../packages/neuvetra-database/src/collection-engine-input"
import { SCOPE3_SOLD_FUELS, type SoldEnergyProductCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { unitLabel } from "@/lib/plain-language"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3TokenLabel, scope3TokenOptions } from "@/lib/scope3-forms"
import { SCOPE3_SOLD_FUEL_FACTS } from "@/lib/scope3-register-labels"
import { egridSubregionLabel } from "../../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { ChoiceField, QuantityFields, SelectField, TextField } from "./Scope3Fields"
import { fieldLabelsOf } from "@/lib/field-needs-wo12"

const CARRIERS = [["electricity", scope3TokenLabel("energyCarrier", "electricity")] as const, ...SCOPE3_SOLD_FUELS.map(fuel => [fuel, SCOPE3_SOLD_FUEL_FACTS[fuel]?.label ?? fuel] as const).sort((a, b) => a[1].localeCompare(b[1]))]
/**
 * The energy units for a carrier: kWh or MWh for electricity; a fuel's Hub Table 1 unit or MMBtu. Round 2 integration
 * (ACC-5, DESIGN 13.5): natural gas may also be stated in therms (therm x 0.1 MMBtu exactly, in the engine).
 */
const energyUnits = (carrier: string): readonly string[] => carrier === "electricity" ? ["kWh", "MWh"]
  : SCOPE3_SOLD_FUEL_FACTS[carrier] ? [SCOPE3_SOLD_FUEL_FACTS[carrier]!.unit, "MMBtu", ...(carrier === "natural_gas" ? ["therm"] : [])] : ["MMBtu"]
// Round 2c integration (walk item 3): each subregion by code and name, as the electricity and grid-location fields show it.
const REGIONS = [["US", scope3TokenLabel("useRegion", "US")] as const, ...ENGINE_SUBREGIONS.map(code => [code, egridSubregionLabel(code)] as const), ["non_US", scope3TokenLabel("useRegion", "non_US")] as const]
/**
 * Category 11, products that use energy directly (DESIGN 3.1): units sold, expected lifetime in years or uses, the energy
 * used per year or per use and its carrier and unit, where the products are used (an eGRID subregion, the U.S., or
 * outside the U.S., which is held), and where the lifetime and energy figures come from.
 */
export function SoldEnergyProductForm({ activity, onEdit, env }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "sold_energy_product")
  const need = fieldLabelsOf(activity, env.fieldFacts)
  const set = (change: (payload: SoldEnergyProductCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "sold_energy_product")))
  const per = p.lifetimeBasis === "uses" ? "use" : "year"
  return <div className="setup-subcard"><h3>Energy-using products sold (Scope 3, category 11)</h3>
    <p>The direct use-phase emissions of products sold in the year, over their expected lifetime, at the reporting year’s grid or fuel factors.</p>
    <div className="setup-grid">
      <TextField {...need("product")} label="Product" value={p.productLabel} onChange={value => set(next => { next.productLabel = value })} />
      <QuantityFields {...need("quantity")} unitNeed={need("unit").need} label={scope3QuantityLabel("sold_energy_product", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("sold_energy_product", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} />
      <SelectField {...need("lifetimeBasis")} label="Lifetime counted in" value={p.lifetimeBasis} options={scope3TokenOptions("lifetimeBasis", ["years", "uses"])} onChange={value => set(next => { next.lifetimeBasis = value as SoldEnergyProductCollectionPayload["lifetimeBasis"] })} />
      <TextField {...need("lifetime")} label={p.lifetimeBasis === "uses" ? "Expected lifetime (uses)" : "Expected lifetime (years)"} value={p.lifetimeQuantity} onChange={value => set(next => { next.lifetimeQuantity = value })} />
      <ChoiceField {...need("energyCarrier")} label="Energy used" value={p.energyCarrier} choices={CARRIERS} placeholder="Choose electricity or a fuel" describeLabel="Energy as described" onChange={value => set(next => {
        next.energyCarrier = value
        const units = energyUnits(value)
        if (!units.includes(next.energyUnit)) next.energyUnit = units[0]!
      })} />
      <TextField {...need("energyPer")} label={`Energy per ${per}`} value={p.energyPerBasis} onChange={value => set(next => { next.energyPerBasis = value })} />
      <ChoiceField {...need("energyUnit")} label="Energy unit" value={p.energyUnit} choices={energyUnits(p.energyCarrier).map(unit => [unit, unitLabel(unit)] as const)} placeholder="Choose a unit" describeLabel="Energy unit as written" onChange={value => set(next => { next.energyUnit = value })} />
      <ChoiceField {...need("useRegion")} label="Where the products are used" value={p.useRegion} choices={REGIONS} placeholder="Choose the region of use" describeLabel="Region of use as described" onChange={value => set(next => { next.useRegion = value })}
        hint="The eGRID subregion where they are sold, or the U.S. average for U.S.-wide sales. Outside the U.S. there is no verified free grid factor, so the record is held." />
      <TextField {...need("lifetimeSource")} label="Where the lifetime and energy figures come from" value={p.lifetimeSource} onChange={value => set(next => { next.lifetimeSource = value })} multiline hint="For example the product specification or a test standard (3 to 300 characters)." />
    </div>
  </div>
}

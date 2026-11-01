import { SCOPE3_GHG_GASES, type SoldGhgProductCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3TokenOptions } from "@/lib/scope3-forms"
import { ChoiceField, QuantityFields, SelectField, TextField } from "./Scope3Fields"

/**
 * Category 11, products that contain greenhouse gases released during use (DESIGN 3.1, AM-12): units sold, the gas or
 * blend and its charge per unit, and the share of the charge released during use with its basis. There is no default
 * share (no 100% assumption): release at end of life belongs in category 12.
 */
export function SoldGhgProductForm({ activity, onEdit }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "sold_ghg_product")
  const set = (change: (payload: SoldGhgProductCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "sold_ghg_product")))
  return <div className="setup-subcard"><h3>Products containing greenhouse gases (Scope 3, category 11)</h3>
    <p>Gas released while the products are used, for example refrigerant leaking from air conditioners or aerosol propellant.</p>
    <div className="setup-grid">
      <TextField label="Product" value={p.productLabel} onChange={value => set(next => { next.productLabel = value })} />
      <QuantityFields label={scope3QuantityLabel("sold_ghg_product", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("sold_ghg_product", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} />
      <ChoiceField label="Gas or blend" value={p.gas} choices={SCOPE3_GHG_GASES.map(gas => [gas, gas] as const)} placeholder="Choose the gas (EPA Hub Tables 11 and 12)" describeLabel="Gas as written on the specification" onChange={value => set(next => { next.gas = value })} />
      <TextField label="Charge per unit" value={p.chargePerUnit} onChange={value => set(next => { next.chargePerUnit = value })} />
      <SelectField label="Charge unit" value={p.chargeUnit} options={scope3TokenOptions("chargeUnit", ["kg", "lb"])} onChange={value => set(next => { next.chargeUnit = value as SoldGhgProductCollectionPayload["chargeUnit"] })} />
      <TextField label="Share of the charge released during use (%)" value={p.useReleasePercent} onChange={value => set(next => { next.useReleasePercent = value })} hint="0 to 100, up to 3 decimals. There is no default; release at end of life belongs in category 12." />
      <TextField label="Where the release share comes from" value={p.releaseBasis} onChange={value => set(next => { next.releaseBasis = value })} multiline hint="For example an annual leak rate over the product’s lifetime from the EPA Vintaging Model (3 to 300 characters)." />
    </div>
  </div>
}

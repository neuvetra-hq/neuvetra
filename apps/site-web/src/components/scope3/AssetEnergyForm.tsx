import { COPY_TEXT_R2E } from "../../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { SCOPE3_ASSET_CATEGORIES, SCOPE3_GHG_GASES, SCOPE3_LEASE_TYPES, SCOPE3_UNIT_FAMILIES, type AssetEnergyCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3CategoryOptions, scope3LeaseHint, scope3TokenOptions } from "@/lib/scope3-forms"
import { CheckField, ChoiceField, GridLocationFields, QuantityFields, SelectField, TextField } from "./Scope3Fields"
import { fieldLabelsOf } from "@/lib/field-needs-wo12"
import { LEASE_NO_CONTROL_HINT_WO12 } from "@/lib/wo12-text"

type Located = AssetEnergyCollectionPayload & { zip: string | null; subregion: string | null; utilityEiaId: string | null }
/**
 * An asset's own energy or refrigerant use (categories 4, 8, 9, 10, 13 and 14; DESIGN 3.1, A15, N-8): a leased building,
 * a processing or franchise site, or a third-party warehouse. Its electricity (with the grid location), natural gas or
 * refrigerant released (leaked or recharged); the lease type and, for categories 8 and 13, the boundary hint from the
 * company's consolidation approach (Scope 3 Standard Tables A.1 and A.2); a floor-area allocation when not sub-metered.
 */
export function AssetEnergyForm({ activity, onEdit, env }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "asset_energy") as Located
  const need = fieldLabelsOf(activity, env.fieldFacts)
  const set = (change: (payload: Located) => void) => onEdit(next => change(scope3PayloadOf(next, "asset_energy") as Located))
  const lease = p.category === 8 || p.category === 13
  const hint = scope3LeaseHint(p.category, p.leaseType, env.consolidationApproach)
  return <div className="setup-subcard"><h3>Energy use of a leased, processing or franchise site (Scope 3)</h3>
    <p>The asset’s own metered energy or refrigerant released. Building or making the asset is not included.</p>
    <div className="setup-grid">
      <SelectField {...need("category")} label="Category" value={String(p.category)} options={scope3CategoryOptions(SCOPE3_ASSET_CATEGORIES, "Choose the category")} onChange={value => set(next => {
        next.category = Number(value) as Located["category"]
        if (next.category !== 8 && next.category !== 13) { next.leaseType = null; next.noOperationalControlBasis = null }
      })} hint="4 and 9: a third-party warehouse or distribution centre; 8: leased in; 13: leased out; 10: processing of sold products; 14: franchises." />
      <TextField {...need("asset")} label="Asset" value={p.assetLabel} onChange={value => set(next => { next.assetLabel = value })} hint="For example “Leased warehouse, Fresno”." />
      <TextField {...need("counterparty")} label="Landlord, tenant, processor or franchisee" value={p.counterpartyName} onChange={value => set(next => { next.counterpartyName = value })} />
      <SelectField {...need("carrier")} label="Energy" value={p.carrier} options={scope3TokenOptions("carrier", ["electricity", "natural_gas", "refrigerant"])} onChange={value => onEdit(next => {
        const payload = scope3PayloadOf(next, "asset_energy") as Located
        payload.carrier = value as Located["carrier"]
        const units: readonly string[] = payload.carrier === "electricity" ? SCOPE3_UNIT_FAMILIES.electricity : payload.carrier === "natural_gas" ? SCOPE3_UNIT_FAMILIES.assetNaturalGas : SCOPE3_UNIT_FAMILIES.refrigerant
        if (!units.includes(next.quantity.originalUnit)) next.quantity.originalUnit = units[0]!
        if (payload.carrier === "electricity") { payload.zip = payload.zip ?? ""; payload.subregion = payload.subregion ?? "" } else { payload.zip = null; payload.subregion = null; payload.utilityEiaId = null }
        payload.refrigerantGas = payload.carrier === "refrigerant" ? payload.refrigerantGas ?? "" : null
      })} />
      <QuantityFields {...need("quantity")} unitNeed={need("unit").need} label={scope3QuantityLabel("asset_energy", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("asset_energy", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} />
      {p.carrier === "refrigerant" && <ChoiceField {...need("refrigerant")} label="Refrigerant" value={p.refrigerantGas ?? ""} choices={SCOPE3_GHG_GASES.map(gas => [gas, gas] as const)} placeholder="Choose the gas or blend" describeLabel="Refrigerant as written on the service record"
        onChange={value => set(next => { next.refrigerantGas = value })} hint="EPA GHG Emission Factors Hub Tables 11 and 12. HCFCs (such as R-22) are not in them and are held." />}
      {lease && <SelectField {...need("leaseType")} label="Lease" value={p.leaseType ?? ""} options={[["", "Not stated"] as const, ...scope3TokenOptions("leaseType", SCOPE3_LEASE_TYPES)]} onChange={value => set(next => { next.leaseType = (value || null) as Located["leaseType"] })} />}
      {p.category === 8 && p.leaseType === "operating" && <TextField {...need("noOperationalControlBasis")} label={COPY_TEXT_R2E.leaseNoControlLabel} value={p.noOperationalControlBasis ?? ""} onChange={value => set(next => { next.noOperationalControlBasis = value || null })} multiline
        hint={`${LEASE_NO_CONTROL_HINT_WO12} For example the landlord operates the building’s systems and meters.`} />}
    </div>
    {hint && <p className="nv-subtle" role="note">{hint}</p>}
    {p.carrier === "electricity" && <GridLocationFields kind="asset_energy" location={p} lookup={env.zipLookup} onLookup={env.onZipLookup} onChange={location => set(next => Object.assign(next, location))} />}
    {p.carrier !== "refrigerant" && <div className="setup-subcard"><h4>Shared building</h4>
      <CheckField {...need("allocation")} label="Not sub-metered: allocate the building’s energy by floor area" checked={p.allocation !== null} onChange={checked => set(next => { next.allocation = checked ? { reportingArea: "", buildingArea: "", occupancyPercent: "", areaUnit: "sqft" } : null })}
        hint="Share = our area / (building area × occupancy). An estimate, disclosed with the result." />
      {p.allocation && <div className="setup-grid">
        <TextField {...need("reportingArea")} label="Area the company uses" value={p.allocation.reportingArea} onChange={value => set(next => { next.allocation!.reportingArea = value })} />
        <TextField {...need("buildingArea")} label="Building’s total area" value={p.allocation.buildingArea} onChange={value => set(next => { next.allocation!.buildingArea = value })} />
        <TextField {...need("occupancyPercent")} label="Building occupancy (%)" value={p.allocation.occupancyPercent} onChange={value => set(next => { next.allocation!.occupancyPercent = value })} />
        <SelectField {...need("areaUnit")} label="Area unit" value={p.allocation.areaUnit} options={scope3TokenOptions("areaUnit", ["sqft", "m2"])} onChange={value => set(next => { next.allocation!.areaUnit = value as "sqft" | "m2" })} />
      </div>}</div>}
  </div>
}

import { COPY_TEXT_R2E } from "../../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { SCOPE3_BUILDING_CATEGORIES, SCOPE3_CBECS_ACTIVITIES, SCOPE3_GRID_BASES, SCOPE3_LEASE_TYPES, type BuildingAverageCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3CategoryOptions, scope3LeaseHint, scope3TokenOptions } from "@/lib/scope3-forms"
import { ChoiceField, GridLocationFields, QuantityFields, SelectField, TextField } from "./Scope3Fields"
import { fieldLabelsOf } from "@/lib/field-needs-wo12"
import { LEASE_NO_CONTROL_HINT_WO12 } from "@/lib/wo12-text"

type Located = BuildingAverageCollectionPayload & { zip: string | null; subregion: string | null; utilityEiaId: string | null }
/**
 * A building by floor area (categories 8, 13 and 14; DESIGN 3.1, 13.2): the building type, floor area, days covered, whether
 * it uses natural gas, its grid location and lease. I-12h: the EIA CBECS 2018 average intensities are loaded, so a complete
 * record is calculated; the form states the method's assumptions (national averages, gas intensity only for gas users).
 */
export function BuildingAverageForm({ activity, onEdit, env }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "building_average") as Located
  const need = fieldLabelsOf(activity, env.fieldFacts)
  const set = (change: (payload: Located) => void) => onEdit(next => change(scope3PayloadOf(next, "building_average") as Located))
  const lease = p.category === 8 || p.category === 13
  const hint = scope3LeaseHint(p.category, p.leaseType, env.consolidationApproach)
  return <div className="setup-subcard"><h3>Building by floor area (Scope 3)</h3>
    <p className="nv-subtle" role="note">An estimate from floor area: the U.S. average electricity and natural gas use per square foot of the building type (EIA CBECS 2018), over the days covered. Natural gas is counted only if the building uses it, because CBECS gas use averages gas-using buildings only; “not known” isn’t counted until answered. Fuel oil, district heat and refrigerants aren’t included. Metered energy or a partner’s figure gives a better result where available.</p>
    <div className="setup-grid">
      <SelectField {...need("category")} label="Category" value={String(p.category)} options={scope3CategoryOptions(SCOPE3_BUILDING_CATEGORIES, "Choose the category")} onChange={value => set(next => {
        next.category = Number(value) as Located["category"]
        if (next.category === 14) { next.leaseType = null; next.noOperationalControlBasis = null }
      })} />
      <ChoiceField {...need("cbecsActivity")} label="Building type" value={p.cbecsActivity} choices={scope3TokenOptions("cbecsActivity", SCOPE3_CBECS_ACTIVITIES)} placeholder="Choose the building type" describeLabel="Building type as described" onChange={value => set(next => { next.cbecsActivity = value })} />
      <QuantityFields {...need("quantity")} unitNeed={need("unit").need} label={scope3QuantityLabel("building_average", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("building_average", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} />
      <TextField {...need("coveredDays")} label="Days covered in the period" type="number" value={p.coveredDays ? String(p.coveredDays) : ""} onChange={value => set(next => { next.coveredDays = Number(value) })} hint="1 to 366: the days the company leased or operated the space." />
      <SelectField {...need("usesNaturalGas")} label="Does the building use natural gas?" value={p.usesNaturalGas} options={scope3TokenOptions("usesNaturalGas", ["yes", "no", "unknown"])} onChange={value => set(next => { next.usesNaturalGas = value as Located["usesNaturalGas"] })} />
      <SelectField {...need("gridBasis")} label="Grid rates" value={p.gridBasis} options={scope3TokenOptions("gridBasis", SCOPE3_GRID_BASES)} onChange={value => set(next => {
        next.gridBasis = value as Located["gridBasis"]
        if (next.gridBasis === "subregion") { next.zip = next.zip ?? ""; next.subregion = next.subregion ?? "" } else { next.zip = null; next.subregion = null; next.utilityEiaId = null }
      })} />
      {lease && <SelectField {...need("leaseType")} label="Lease" value={p.leaseType ?? ""} options={[["", "Not stated"] as const, ...scope3TokenOptions("leaseType", SCOPE3_LEASE_TYPES)]} onChange={value => set(next => { next.leaseType = (value || null) as Located["leaseType"] })} />}
      {p.category === 8 && p.leaseType === "operating" && <TextField {...need("noOperationalControlBasis")} label={COPY_TEXT_R2E.leaseNoControlLabel} value={p.noOperationalControlBasis ?? ""} onChange={value => set(next => { next.noOperationalControlBasis = value || null })} multiline hint={LEASE_NO_CONTROL_HINT_WO12} />}
    </div>
    {hint && <p className="nv-subtle" role="note">{hint}</p>}
    {p.gridBasis === "subregion" && <GridLocationFields kind="building_average" location={p} lookup={env.zipLookup} onLookup={env.onZipLookup} onChange={location => set(next => Object.assign(next, location))} />}
  </div>
}

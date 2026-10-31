import { SCOPE3_GRID_BASES, type EnergyResoldCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3TokenOptions } from "@/lib/scope3-forms"
import { CheckField, GridLocationFields, QuantityFields, SelectField } from "./Scope3Fields"

/**
 * Category 3D, electricity bought and resold to end users (DESIGN 3.1, A28): the energy resold, where its grid rates come
 * from (the site's eGRID subregion, or the U.S. average when the origin isn't known) and the attestation that it is kept
 * out of the company's own Scope 2 records (otherwise it counts twice and the record is held).
 */
export function EnergyResoldForm({ activity, onEdit, env }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "energy_resold")
  const set = (change: (payload: EnergyResoldCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "energy_resold")))
  return <div className="setup-subcard"><h3>Energy bought and resold (Scope 3, category 3D)</h3>
    <p>Electricity the company buys and sells on to end users, for example to tenants. Exporting power the company generates itself is not 3D.</p>
    <div className="setup-grid">
      <QuantityFields label={scope3QuantityLabel("energy_resold", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("energy_resold", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} />
      <SelectField label="Grid rates" value={p.gridBasis} options={scope3TokenOptions("gridBasis", SCOPE3_GRID_BASES)} onChange={value => onEdit(next => {
        const payload = scope3PayloadOf(next, "energy_resold") as EnergyResoldCollectionPayload & { zip: string | null; subregion: string | null; utilityEiaId: string | null }
        payload.gridBasis = value as EnergyResoldCollectionPayload["gridBasis"]
        // A grid location is given exactly for the subregion basis (0030's rule).
        if (payload.gridBasis === "subregion") { payload.zip = payload.zip ?? ""; payload.subregion = payload.subregion ?? "" } else { payload.zip = null; payload.subregion = null; payload.utilityEiaId = null }
      })} />
    </div>
    {p.gridBasis === "subregion" && <GridLocationFields location={p} lookup={env.zipLookup} onLookup={env.onZipLookup} onChange={location => set(next => Object.assign(next, location))} />}
    <CheckField label="The electricity resold is kept out of the company’s own Scope 2 electricity records" checked={p.resoldEnergyNotInScope2} onChange={checked => set(next => { next.resoldEnergyNotInScope2 = checked })}
      hint="Otherwise the same electricity would be counted twice; the record is held until this is confirmed." />
  </div>
}

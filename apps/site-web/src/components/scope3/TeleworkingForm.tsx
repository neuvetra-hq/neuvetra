import { SCOPE3_UNIT_FAMILIES, type TeleworkingCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3TokenOptions } from "@/lib/scope3-forms"
import { GridLocationFields, QuantityFields, SelectField, TextField } from "./Scope3Fields"
import { fieldLabelsOf } from "@/lib/field-needs-wo12"

/**
 * Category 7, teleworking (optional; DESIGN 3.1): the extra home electricity or natural gas staff use for work, above the
 * household baseline the record states, with the grid location for electricity.
 */
export function TeleworkingForm({ activity, onEdit, env }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "teleworking")
  const need = fieldLabelsOf(activity, env.fieldFacts)
  const set = (change: (payload: TeleworkingCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "teleworking")))
  return <div className="setup-subcard"><h3>Teleworking (Scope 3, category 7, optional)</h3>
    <p>Only the energy used for work above the household’s own baseline counts.</p>
    <div className="setup-grid">
      <SelectField {...need("carrier")} label="Energy" value={p.carrier} options={scope3TokenOptions("carrier", ["electricity", "natural_gas"])} onChange={value => onEdit(next => {
        const payload = scope3PayloadOf(next, "teleworking") as TeleworkingCollectionPayload & { zip: string | null; subregion: string | null; utilityEiaId: string | null }
        payload.carrier = value as TeleworkingCollectionPayload["carrier"]
        const units: readonly string[] = payload.carrier === "electricity" ? SCOPE3_UNIT_FAMILIES.electricity : SCOPE3_UNIT_FAMILIES.naturalGas
        if (!units.includes(next.quantity.originalUnit)) next.quantity.originalUnit = units[0]!
        if (payload.carrier === "electricity") { payload.zip = payload.zip ?? ""; payload.subregion = payload.subregion ?? "" } else { payload.zip = null; payload.subregion = null; payload.utilityEiaId = null }
      })} />
      <QuantityFields {...need("quantity")} unitNeed={need("unit").need} label={scope3QuantityLabel("teleworking", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("teleworking", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} />
      <TextField {...need("baselineBasis")} label="How the household baseline was taken off" value={p.baselineBasis} onChange={value => set(next => { next.baselineBasis = value })} multiline hint="For example the survey’s extra kWh per home-working day above a typical household (3 to 300 characters)." />
    </div>
    {p.carrier === "electricity" && <GridLocationFields kind="teleworking" labels={need} location={p} lookup={env.zipLookup} onLookup={env.onZipLookup} onChange={location => set(next => Object.assign(next, location))} />}
  </div>
}

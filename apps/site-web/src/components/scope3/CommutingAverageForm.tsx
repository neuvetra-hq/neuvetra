import { SCOPE3_ACTIVITY_OVERLAP, SCOPE3_COMMUTING_AVG_MODES, SCOPE3_TRAVEL_MODES, type CommutingAverageCollectionPayload, type CommutingAverageMode } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3BlankCommutingMode, scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3SharesTotalText, scope3TokenOptions } from "@/lib/scope3-forms"
import { ChoiceField, QuantityFields, SelectField, TextField } from "./Scope3Fields"
import { fieldNeedsOf } from "@/lib/field-needs-wo12"

/** Occupancy applies to cars, light-duty trucks and motorcycles only (the engine refuses it for rail, bus and walking). */
const isVehicle = (mode: string) => (SCOPE3_TRAVEL_MODES as Record<string, string>)[mode] === "vehicle"
/**
 * Category 7 from survey averages (DESIGN 3.1, B5c): headcount, working days on site and one row per commuting mode with
 * its share of employees, typical one-way distance and, for vehicles, occupancy. The shares' total is shown as they are
 * typed (they must total 100%). Where distance-based commuting records exist for the same period, the company confirms
 * the two cover different employees or days.
 */
export function CommutingAverageForm({ activity, onEdit }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "commuting_average")
  const need = fieldNeedsOf("commuting_average")
  const set = (change: (payload: CommutingAverageCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "commuting_average")))
  const row = (index: number, change: (mode: CommutingAverageMode) => void) => set(next => change(next.modes[index]!))
  const total = scope3SharesTotalText(p.modes.map(mode => mode.sharePercent))
  return <div className="setup-subcard"><h3>Employee commuting from survey averages (Scope 3, category 7)</h3>
    <p>An average profile: how many employees, how many days on site, and the share using each mode with their typical one-way distance. Walking and cycling count as a known zero.</p>
    <div className="setup-grid">
      <QuantityFields need={need("quantity")} unitNeed={need("unit")} label={scope3QuantityLabel("commuting_average", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("commuting_average", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} />
      <TextField need={need("workingDays")} label="Working days on site per employee" type="number" value={p.workingDays ? String(p.workingDays) : ""} onChange={value => set(next => { next.workingDays = Number(value) })} hint="A whole number from 1 to 366." />
    </div>
    {p.modes.map((mode, index) => <div className="setup-subcard" key={index}><h4>Mode {index + 1}</h4><div className="setup-grid">
      <ChoiceField need={need("mode")} label={`Mode ${index + 1}`} value={mode.mode} choices={scope3TokenOptions("commutingMode", SCOPE3_COMMUTING_AVG_MODES)} placeholder="Choose a mode" describeLabel={`Mode ${index + 1} as described`}
        onChange={value => row(index, target => { target.mode = value; if (!isVehicle(value)) target.occupancy = null })} />
      <TextField need={need("share")} label={`Share of employees, mode ${index + 1} (%)`} value={mode.sharePercent} onChange={value => row(index, target => { target.sharePercent = value })} />
      <TextField need={need("distance")} label={`One-way distance, mode ${index + 1}`} value={mode.oneWayDistance} onChange={value => row(index, target => { target.oneWayDistance = value })} />
      <SelectField need={need("distanceUnit")} label={`Distance unit, mode ${index + 1}`} value={mode.distanceUnit} options={scope3TokenOptions("distanceUnit", ["mile", "km"])} onChange={value => row(index, target => { target.distanceUnit = value as CommutingAverageMode["distanceUnit"] })} />
      {isVehicle(mode.mode) && <TextField need={need("occupancy")} label={`Occupancy, mode ${index + 1} (people per vehicle)`} value={mode.occupancy ?? ""} onChange={value => row(index, target => { target.occupancy = value || null })} hint="Leave it empty to assume one person per vehicle (an estimate, disclosed)." />}
    </div>{p.modes.length > 1 && <button type="button" onClick={() => set(next => { next.modes.splice(index, 1) })}>Remove mode {index + 1}</button>}</div>)}
    {p.modes.length < 10 && <button type="button" onClick={() => set(next => { next.modes.push(scope3BlankCommutingMode()) })}>+ Add a mode</button>}
    <p className={total.ok ? "worksheet-status" : "worksheet-error"} role="status">{total.text}</p>
    <div className="setup-grid">
      <TextField need={need("sharesBasis")} label="Where the mode shares come from" value={p.sharesBasis} onChange={value => set(next => { next.sharesBasis = value })} multiline hint="For example “2025 staff survey (212 responses)”." />
      <TextField need={need("distanceBasis")} label="Where the distances come from" value={p.distanceBasis} onChange={value => set(next => { next.distanceBasis = value })} multiline hint="For example “survey home ZIP to office”." />
      <SelectField need={need("activityOverlap")} label="Covered by distance-based commuting records?" value={p.activityOverlap} options={scope3TokenOptions("activityOverlap", SCOPE3_ACTIVITY_OVERLAP)} onChange={value => set(next => { next.activityOverlap = value as CommutingAverageCollectionPayload["activityOverlap"] })}
        hint="If distance-based commuting records exist for this period, confirm this profile covers other employees or other days, or it is held so commuting isn’t counted twice." />
    </div>
  </div>
}

import type { ReactNode } from "react"
import type { CollectionActivity } from "../../../../../packages/neuvetra-database/src/collection-contract"
import { SCOPE3_ACTIVITY_DATA_ORIGINS, SCOPE3_DQ_INDICATORS, SCOPE3_DQ_RATINGS, type Scope3CollectionKind, type Scope3DataQuality } from "../../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { SCOPE3_DQ_INDICATOR_DESCRIPTION_I08 } from "../../../../../packages/neuvetra-database/src/scope3-text"
import { scope3FormDataQualityDefaults, scope3Payload } from "@/lib/scope3-form-defaults"
import { scope3TokenLabel, scope3TokenOptions } from "@/lib/scope3-forms"
import { SelectField, TextField } from "./Scope3Fields"
import { activityFieldNeed } from "@/lib/field-needs-wo12"

type Payload = Record<string, unknown> & { dataQuality?: Scope3DataQuality | null }
const EMPTY: Scope3DataQuality = { indicators: { technological: null, temporal: null, geographical: null, completeness: null, reliability: null }, activityDataOrigin: null, basis: null }
/**
 * The record's data quality (Scope 3 completion I-08; DESIGN 3.2, 7.2, D4, A19, A20): the five Scope 3 Standard Table 7.6
 * indicators, each "use the method's default" (shown) or a rating set by the company, the activity-data origin where
 * the method type lets a record set it (activity and average-data methods only), and the reason the company's ratings
 * differ from the defaults. When nothing is set the payload carries no `dataQuality` key (the method's defaults apply,
 * and a schema-29 server can still store the record of a 0029 kind).
 */
/** Round 2 lane E (UX-12): `lead` puts the record's actual-or-estimated answer in this section, so a form has one data-quality section. */
export function DataQualityEditor({ activity, onEdit, lead }: { activity: CollectionActivity; onEdit: (change: (next: CollectionActivity) => void) => void; lead?: ReactNode }) {
  const kind = activity.kind as Scope3CollectionKind
  const payload = scope3Payload(activity) as Payload
  const dq = payload.dataQuality ?? EMPTY
  const defaults = scope3FormDataQualityDefaults(kind, payload)
  const change = (update: (next: Scope3DataQuality) => void) => onEdit(next => {
    const target = scope3Payload(next) as Payload
    const value = structuredClone(target.dataQuality ?? EMPTY)
    update(value)
    if (value.basis !== null && value.basis.trim() === "" ) value.basis = null
    const unset = SCOPE3_DQ_INDICATORS.every(name => value.indicators[name] === null) && value.activityDataOrigin === null && value.basis === null
    if (unset) delete target.dataQuality; else target.dataQuality = value
  })
  const defaultWords = (rating: string | undefined) => rating ? `Method default: ${scope3TokenLabel("dqRating", rating).toLowerCase()}` : "Method default (set when the method runs)"
  const overridden = SCOPE3_DQ_INDICATORS.some(name => dq.indicators[name] !== null) || dq.activityDataOrigin !== null
  return <div className="setup-subcard"><h3>Data quality</h3>
    <p className="nv-subtle">{defaults.title ? `Method: ${defaults.title}.` : "The method for this record is chosen from the answers above."} Each indicator uses the method’s default unless the company rates it (Scope 3 Standard Table 7.6). Results show the ratings used and who set them.</p>
    <div className="setup-grid">
      {lead}
      {SCOPE3_DQ_INDICATORS.map(name => <SelectField key={name} need={activityFieldNeed("dataQuality", `dq-${name}`)} label={SCOPE3_DQ_INDICATOR_DESCRIPTION_I08[name].label} value={dq.indicators[name] ?? ""} hint={SCOPE3_DQ_INDICATOR_DESCRIPTION_I08[name].description}
        options={[["", defaultWords(defaults.indicators?.[name])] as const, ...scope3TokenOptions("dqRating", SCOPE3_DQ_RATINGS)]} onChange={value => change(next => { next.indicators[name] = (value || null) as Scope3DataQuality["indicators"][typeof name] })} />)}
      {defaults.originSettable
        ? <SelectField need={activityFieldNeed("dataQuality", "dq-origin")} label="Activity data origin" value={dq.activityDataOrigin ?? ""} options={[["", defaults.origin ? `Method default: ${scope3TokenLabel("dqOrigin", defaults.origin).toLowerCase()}` : "Method default"] as const, ...scope3TokenOptions("dqOrigin", SCOPE3_ACTIVITY_DATA_ORIGINS)]}
          onChange={value => change(next => { next.activityDataOrigin = (value || null) as Scope3DataQuality["activityDataOrigin"] })} hint="Where the activity data come from: the company’s own records, a supplier or other partner, or an estimate." />
        : <p className="nv-subtle">Activity data origin: {defaults.origin ? scope3TokenLabel("dqOrigin", defaults.origin).toLowerCase() : "set by the method"}, fixed by the method type.{dq.activityDataOrigin !== null ? ` The origin saved on this record (${scope3TokenLabel("dqOrigin", dq.activityDataOrigin).toLowerCase()}) is ignored.` : ""}</p>}
      <TextField need={activityFieldNeed("dataQuality", overridden ? "dq-basis" : "dq-basis-default")} label="Why these ratings differ from the method defaults" value={dq.basis ?? ""} onChange={value => change(next => { next.basis = value })} multiline
        hint={overridden ? "Required when the company sets a rating or origin (3 to 500 characters)." : "Only needed when the company sets a rating or origin."} />
    </div>
  </div>
}

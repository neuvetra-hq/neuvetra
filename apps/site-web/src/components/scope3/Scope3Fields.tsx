import { useState } from "react"
import { ENGINE_SUBREGIONS } from "../../../../../packages/neuvetra-database/src/collection-engine-input"
import type { Scope3SupersedesSpend } from "../../../../../packages/neuvetra-database/src/scope3-collection-contract"
import type { CollectionZipLookup } from "@/lib/collection-api"
import { egridSubregionLabel } from "../../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { unitLabel } from "@/lib/plain-language"
import type { Scope3SpendLineChoice } from "@/lib/scope3-form-defaults"
import { SCOPE3_NAICS_GUARD_TEXT, scope3NaicsGuard } from "@/lib/scope3-forms"
import { scope3NaicsChoices, scope3NaicsTitle } from "@/lib/scope3-naics"
// Round 3 lane C (PR-9): why spend codes are 2017 codes.
import { SPEND_TEXT_R3C } from "@/lib/scope3-text-r3c"
// WO-12 follow-up (CEO ruling): every field says "Required", "Needed for results" or "Optional", as part of its name.
import { FIELD_NEED_TEXT, type FieldNeed } from "@/lib/wo12-text"
import { fieldNeedsOf } from "@/lib/field-needs-wo12"

/**
 * The fields the Scope 3 record forms share (Scope 3 completion I-08; Claude, 30 October 2026; DESIGN 7.2). The markup and
 * classes are the Activity screen's own (CollectionWorkspace's Field, Select and ChoiceOrOther). The surrounding fieldset
 * disables every input while the screen is busy or read-only.
 */
/**
 * WO-12 follow-up: a field's name and its label ("Required", "Needed for results" or "Optional"). Both are inside the
 * <label>, so assistive technology reads the label as part of the field's name. Required fields are also aria-required.
 */
export function FieldName({ label, need, needNote }: { label: string; need: FieldNeed; needNote?: string }) {
  return <span className="setup-field__label"><span className="setup-field__name">{label}</span> <span className={`setup-field__need setup-field__need--${need}`}>{needNote ? `${FIELD_NEED_TEXT[need]} ${needNote}` : FIELD_NEED_TEXT[need]}</span></span>
}
/** WO-12 QA round 1: a field's label in the form's current state (`fieldLabelsOf`), spread into a field's props. */
type Need = { need: FieldNeed; needNote?: string }
const required = (need: FieldNeed) => need === "required" ? true as const : undefined
export function TextField({ label, need, needNote, value, onChange, hint, multiline = false, type = "text" }: Need & { label: string; value: string; onChange: (value: string) => void; hint?: string; multiline?: boolean; type?: string }) {
  return <label className="setup-field"><FieldName label={label} need={need} needNote={needNote} />
    {multiline ? <textarea aria-required={required(need)} value={value} onChange={event => onChange(event.target.value)} /> : <input type={type} aria-required={required(need)} value={value} onChange={event => onChange(event.target.value)} />}{hint && <small>{hint}</small>}</label>
}
export function SelectField({ label, need, needNote, value, options, onChange, hint }: Need & { label: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void; hint?: string }) {
  return <label className="setup-field"><FieldName label={label} need={need} needNote={needNote} /><select aria-required={required(need)} value={value} onChange={event => onChange(event.target.value)}>{options.map(([id, words]) => <option key={id} value={id}>{words}</option>)}</select>{hint && <small>{hint}</small>}</label>
}
export function CheckField({ label, need, needNote, checked, onChange, hint }: Need & { label: string; checked: boolean; onChange: (checked: boolean) => void; hint?: string }) {
  return <label className="setup-check"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /> <span><span className="setup-field__name">{label}</span> <span className={`setup-field__need setup-field__need--${need}`}>{needNote ? `${FIELD_NEED_TEXT[need]} ${needNote}` : FIELD_NEED_TEXT[need]}</span></span>{hint && <small> {hint}</small>}</label>
}
/** A yes / no answer that may also be "not known yet" (null). */
export function YesNoField({ label, need, needNote, value, onChange, unknownLabel = "Not known yet", hint }: Need & { label: string; value: boolean | null; onChange: (value: boolean | null) => void; unknownLabel?: string; hint?: string }) {
  return <SelectField label={label} need={need} needNote={needNote} value={value === null ? "" : value ? "yes" : "no"} options={[["", unknownLabel], ["yes", "Yes"], ["no", "No"]]} onChange={answer => onChange(answer === "" ? null : answer === "yes")} hint={hint} />
}
const OTHER = "__other__"
/**
 * A list of supported choices plus "Something else" (as the Activity screen's ChoiceOrOther): an unlisted value is saved in
 * the client's own words, shown as needing input with the adapter's reason, and never counted as zero.
 */
export function ChoiceField({ label, need, needNote, value, choices, placeholder, otherLabel = "Something else (saved, held until it matches a listed one)", describeLabel, onChange, hint, maxLength = 80 }: Need & { label: string; value: string; choices: ReadonlyArray<readonly [string, string]>; placeholder: string; otherLabel?: string; describeLabel: string; onChange: (value: string) => void; hint?: string; maxLength?: number }) {
  const known = choices.some(([id]) => id === value)
  const selected = value === "" ? "" : known ? value : OTHER
  return <>
    <SelectField label={label} need={need} needNote={needNote} value={selected} options={[["", placeholder] as const, ...choices, [OTHER, otherLabel] as const]} onChange={next => onChange(next === OTHER ? (known || value === "" ? "other" : value) : next)} hint={hint} />
    {selected === OTHER && <TextField label={describeLabel} need={need} needNote={needNote} value={value} onChange={next => onChange(next.slice(0, maxLength) || "other")} hint="Saved as written and shown as needing input. It isn’t calculated until it matches a listed value, and is never counted as zero." />}
  </>
}

/**
 * A record's amount as written on the source and its unit: the units the kind's method takes are listed; a unit saved
 * earlier that isn't listed stays shown (and held). With `otherUnit`, a unit typed by hand is kept (a currency other than
 * US dollars, for example), saved as written and held.
 */
export function QuantityFields({ label, need, needNote, unitNeed, value, unit, units, onValue, onUnit, unitLabelText = "Unit", otherUnit = false, hint }: Need & { unitNeed: FieldNeed; label: string; value: string; unit: string; units: readonly string[]; onValue: (value: string) => void; onUnit: (unit: string) => void; unitLabelText?: string; otherUnit?: boolean; hint?: string }) {
  const choices = units.map(item => [item, unitLabel(item)] as const)
  return <>
    <TextField label={label} need={need} needNote={needNote} value={value} onChange={onValue} hint={hint ?? "As written on the source: a plain number, no commas, up to 3 decimals. Anything else is saved but not calculated."} />
    {otherUnit ? <ChoiceField label={unitLabelText} need={unitNeed} value={unit} choices={choices} placeholder="Choose" otherLabel="Another (saved, not calculated)" describeLabel={`${unitLabelText} as written on the source`} onChange={onUnit} />
      : <SelectField label={unitLabelText} need={unitNeed} value={unit} options={[...choices, ...(units.includes(unit) ? [] : [[unit, `${unitLabel(unit) || "None"} (not taken by this method: held)`] as const])]} onChange={onUnit} />}
  </>
}

type GridLocation = { zip: string | null; subregion: string | null; utilityEiaId: string | null }
/**
 * An electricity location as the electricity record has it: the site's ZIP code, the eGRID subregion and, where known, the
 * utility's EIA ID. "Look up ZIP" runs the pinned ZIP, utility and eGRID lookup (the electricity form's) and fills them.
 */
export function GridLocationFields({ kind, location, onChange, lookup, onLookup }: { kind: string; location: GridLocation; onChange: (next: GridLocation) => void; lookup: CollectionZipLookup | null; onLookup: (zip: string) => void }) {
  const need = fieldNeedsOf(kind)
  const zip = location.zip ?? ""
  const current = lookup && lookup.zip === zip ? lookup : null
  const subregions: Array<readonly [string, string]> = [["", "Choose, or look up the ZIP code"], ...ENGINE_SUBREGIONS.map(code => [code, egridSubregionLabel(code)] as const),
    ...(location.subregion && !(ENGINE_SUBREGIONS as readonly string[]).includes(location.subregion) ? [[location.subregion, `${location.subregion} (not an eGRID subregion: held)`] as const] : [])]
  return <div className="setup-subcard"><h4>Grid location</h4><div className="setup-grid">
    <TextField label="Site ZIP code" need={need("zip")} value={zip} onChange={value => onChange({ zip: value, subregion: "", utilityEiaId: null })} hint="Five digits. Look it up to set the eGRID subregion and utility." />
    <SelectField label="eGRID subregion" need={need("subregion")} value={location.subregion ?? ""} options={subregions} onChange={subregion => onChange({ ...location, subregion })} />
    {current?.found && current.utilities.length > 1 && <SelectField label="Verified utility and eGRID subregion" need={need("utilityChoice")} value={location.utilityEiaId ? `${location.subregion}|${location.utilityEiaId}` : ""}
      options={[["", "Choose the utility serving the site"] as const, ...current.utilities.map(utility => [`${utility.subregion}|${utility.eiaId}`, `${utility.utility} · ${utility.subregion}`] as const)]}
      onChange={value => { const [subregion = "", utilityEiaId = ""] = value.split("|"); onChange({ ...location, subregion, utilityEiaId: utilityEiaId || null }) }} />}
    <TextField label="Utility EIA ID" need={need("utilityEiaId")} value={location.utilityEiaId ?? ""} onChange={value => onChange({ ...location, utilityEiaId: value || null })} hint="A whole number from the lookup; leave it empty if not known." />
  </div>
    <button type="button" disabled={!/^\d{5}$/.test(zip)} onClick={() => onLookup(zip)}>Look up ZIP</button>
    {current && !current.found && <p className="worksheet-error">No verified eGRID match was found for ZIP {current.zip}. Choose the subregion, or the record stays held.</p>}
  </div>
}

/**
 * DESIGN A22 (B5a): the spend lines a supplier or partner figure replaces, so the same purchase is never counted twice. A
 * spend line is replaced when its supplier name matches (spelling of spaces and capitals ignored) or its mapping key is
 * chosen here; Results then exclude it with the reason "superseded by supplier record".
 */
export function SupersedesSpendFields({ kind, value, onChange, lines }: { kind: string; value: Scope3SupersedesSpend | null; onChange: (next: Scope3SupersedesSpend | null) => void; lines: readonly Scope3SpendLineChoice[] }) {
  const need = fieldNeedsOf(kind)
  const groups = new Map<string, Scope3SpendLineChoice[]>()
  for (const line of lines) groups.set(line.mappingKey, [...groups.get(line.mappingKey) ?? [], line])
  const names = [...new Set(lines.map(line => line.supplierName).filter(Boolean))].sort().map(name => [name, name] as const)
  return <div className="setup-subcard"><h4>Spend lines this record replaces</h4>
    <p className="nv-subtle">When this figure covers purchases already recorded by spend, name them so each purchase is counted once. The replaced lines stay listed in Results, marked as replaced.</p>
    <CheckField label="This record replaces spend lines already recorded for the same purchases" need={need("supersedes")} checked={value !== null} onChange={checked => onChange(checked ? { supplierName: "", mappingKeys: [] } : null)} />
    {value && <>
      <ChoiceField label="Supplier named on the spend lines" need={need("supersedesSupplier")} value={value.supplierName} choices={names} placeholder="Choose a supplier from the spend lines" otherLabel="Another name" describeLabel="Supplier name as the spend lines give it" maxLength={200}
        onChange={supplierName => onChange({ ...value, supplierName })} hint="Every spend line naming this supplier is replaced (spaces and capitals are ignored)." />
      {groups.size === 0 ? <p className="nv-subtle">No spend lines are saved yet; lines saved later under this supplier name are replaced too.</p>
        : [...groups.entries()].map(([key, group]) => <CheckField key={key} need={need("supersedesLines")} label={`${group[0]!.description || "No description"} · ${group[0]!.supplierName || "no supplier"} · GL ${group[0]!.glAccount || "none"} (${group.length} line${group.length === 1 ? "" : "s"}, ${group.map(line => `${line.amount} ${line.currency}`).join(", ")})`}
          checked={value.mappingKeys.includes(key)} onChange={checked => onChange({ ...value, mappingKeys: checked ? [...value.mappingKeys, key] : value.mappingKeys.filter(item => item !== key) })} />)}
    </>}
  </div>
}

/**
 * A 2017 NAICS code for a spend line (or an investee's revenue): search the EPA Supply Chain v1.3 titles and pick from the
 * codes the category allows (`scope3SpendNaicsAllowed`). Categories 1 and 2 list every code; codes held unless the category
 * is confirmed are marked.
 */
export function NaicsField({ category, need, needNote, value, onChange, label = "NAICS code (2017)", hint }: Need & { category: number; value: string | null; onChange: (code: string | null) => void; label?: string; hint?: string }) {
  const [query, setQuery] = useState("")
  const matches = scope3NaicsChoices(category, query)
  const guard = scope3NaicsGuard(category, value)
  const saved = value !== null && !matches.some(match => match.code === value) ? [[value, `${value} · ${scope3NaicsTitle(value) ?? "not in the EPA factor list"}`] as const] : []
  return <>
    <TextField label="Search NAICS codes" need="optional" value={query} onChange={setQuery} hint={`Type words from the title (for example “software” or “trucking”) or the first digits of the code. ${SPEND_TEXT_R3C.naicsEditionShort}`} />
    <SelectField label={label} need={need} needNote={needNote} value={value ?? ""} onChange={code => onChange(code || null)}
      options={[["", "No code yet (the line is held until it has one)"] as const, ...saved, ...matches.map(match => [match.code, `${match.code} · ${match.title}${match.guard ? ` (${SCOPE3_NAICS_GUARD_TEXT[match.guard]})` : ""}`] as const)]}
      hint={guard ? `This is ${SCOPE3_NAICS_GUARD_TEXT[guard]}.` : hint ?? (matches.length >= 60 ? "Showing the first 60 matches; type more words to narrow the list." : undefined)} />
  </>
}

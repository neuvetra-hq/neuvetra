import { SCOPE3_WASTE_MATERIALS, SCOPE3_WASTE_TREATMENTS, type EndOfLifeSplitCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3BlankSplit, scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3SharesTotalText, scope3TokenLabel, scope3TokenOptions } from "@/lib/scope3-forms"
import { ChoiceField, QuantityFields, SelectField, TextField } from "./Scope3Fields"
import { fieldNeedsOf } from "@/lib/field-needs-wo12"
import { SCOPE3_WASTE_MATERIAL_TEXT_R2E } from "../../../../../packages/neuvetra-database/src/scope3-text-r2e"

// Round 3 lane D (PR-8): EPA's own material names, as the waste form shows them ("HDPE (high-density polyethylene)"), never
// the title-cased token ("Hdpe").
const MATERIALS = SCOPE3_WASTE_MATERIALS.map(material => [material, SCOPE3_WASTE_MATERIAL_TEXT_R2E[material] ?? material.replace(/_/g, " ")] as const)
/**
 * Category 12, the end of life of products (or packaging) sold (DESIGN 3.1, AM-13): the material and mass, and the share
 * expected to go to each treatment with its source, or "not known" (the record is then held, never counted as zero). The
 * shares' total is shown as they are typed. The product label lets Results match a category 11 product of the same name.
 */
export function EndOfLifeSplitForm({ activity, onEdit }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "end_of_life_split")
  const need = fieldNeedsOf("end_of_life_split")
  const set = (change: (payload: EndOfLifeSplitCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "end_of_life_split")))
  const total = p.split ? scope3SharesTotalText(SCOPE3_WASTE_TREATMENTS.map(treatment => p.split![treatment])) : null
  return <div className="setup-subcard"><h3>End of life of sold products (Scope 3, category 12)</h3>
    <p>The mass of products or packaging sold in the year and how it is expected to be treated at end of life. EPA waste factors include transport to the facility and exclude avoided emissions.</p>
    <div className="setup-grid">
      <SelectField need={need("basis")} label="What it covers" value={p.basis} options={scope3TokenOptions("endOfLifeBasis", ["sold_products", "packaging"])} onChange={value => set(next => { next.basis = value as EndOfLifeSplitCollectionPayload["basis"] })} />
      <TextField need={need("product")} label="Product" value={p.productLabel} onChange={value => set(next => { next.productLabel = value })} hint="Use the same name as a category 11 record of the product, so Results can match them." />
      <ChoiceField need={need("material")} label="Material" value={p.material} choices={MATERIALS} placeholder="Choose a material (EPA Hub Table 9)" describeLabel="Material as described" onChange={value => set(next => { next.material = value })} />
      <QuantityFields need={need("quantity")} unitNeed={need("unit")} label={scope3QuantityLabel("end_of_life_split", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("end_of_life_split", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} />
      <SelectField need={need("splitKnown")} label="Treatment split" value={p.split ? "known" : "unknown"} options={[["known", "Known: share by treatment"], ["unknown", "Not known (the record is held)"]]} onChange={value => set(next => {
        next.split = value === "known" ? next.split ?? scope3BlankSplit() : null
        next.splitBasis = value === "known" ? next.splitBasis ?? "" : null
      })} hint="Enter 0 for a treatment that isn’t used; the shares must total 100%." />
    </div>
    {p.split && <><div className="setup-grid">
      {SCOPE3_WASTE_TREATMENTS.map(treatment => <TextField need={need("share")} key={treatment} label={`${scope3TokenLabel("treatment", treatment)} (%)`} value={p.split![treatment]} onChange={value => set(next => { next.split![treatment] = value })} />)}
      <TextField need={need("splitBasis")} label="Where the split comes from" value={p.splitBasis ?? ""} onChange={value => set(next => { next.splitBasis = value })} multiline hint="For example EPA Facts and Figures for this material (3 to 300 characters)." />
    </div><p className={total!.ok ? "worksheet-status" : "worksheet-error"} role="status">{total!.text}</p></>}
  </div>
}

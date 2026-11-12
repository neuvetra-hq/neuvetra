import { SCOPE3_ACTIVITY_OVERLAP, SCOPE3_CATEGORY_3_SPEND_PROXY_ENABLED, SCOPE3_SPEND_CATEGORIES, type PurchaseSpendCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3CategoryOptions, scope3NaicsGuard, SCOPE3_NAICS_GUARD_TEXT, scope3TokenLabel, scope3TokenOptions } from "@/lib/scope3-forms"
import { useState } from "react"
import { CheckField, NaicsField, QuantityFields, SelectField, TextField, YesNoField } from "./Scope3Fields"
import { fieldLabelsOf } from "@/lib/field-needs-wo12"

/**
 * A purchase by spend (categories 1 to 6 and 9; Scope 3 completion I-08, DESIGN 7.2, 3.1, A23): the amount and currency,
 * a 2017 NAICS code from the category's allowed set, the dollar year, margins and factory gate, full cost for capital
 * goods, the category confirmation, the overlap attestation and, for category 9 (entered by hand only), the attestation
 * that the company did not pay and how the amount was estimated. Everything the adapter checks is saved as answered;
 * the Activity screen shows its holds.
 *
 * Round 2 UX-12 (Claude, 31 October 2026): each thing is asked once. One price basis (purchaser price with margins, or
 * producer price bought at the factory gate: margins and the factory-gate confirmation together); the category
 * confirmation only for a code that needs it (reset when the code changes); and either one invoice date (the line counts
 * in the reporting period from setup, as imported lines do) or one period covered (no line date). The Activity screen
 * hides its own period fields for this kind.
 */
const nextDay = (day: string, delta: number) => { const d = new Date(`${day}T00:00:00.000Z`); if (Number.isNaN(d.getTime())) return day; d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10) }
const PRICE_BASIS: ReadonlyArray<readonly [string, string]> = [["with_margins", "Purchaser price, as invoiced (factors with margins)"], ["factory_gate", "Producer price, bought straight from the factory gate (factors without margins)"]]
export function SpendLineForm({ activity, onEdit, env }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "purchase_spend")
  const need = fieldLabelsOf(activity, env.fieldFacts)
  const set = (change: (payload: PurchaseSpendCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "purchase_spend")))
  // DESIGN 3.3: the UI hides category 3 (the 3A fuel spend proxy) until it is enabled; a line saved in 3 keeps it.
  const categories = SCOPE3_SPEND_CATEGORIES.filter(category => category !== 3 || SCOPE3_CATEGORY_3_SPEND_PROXY_ENABLED || p.category === 3)
  const fallback = p.category !== 1 && p.category !== 2
  const guard = scope3NaicsGuard(p.category, p.naicsCode)
  const reporting = env.reportingPeriod ?? null
  // One date (the line counts in the reporting period) or one period covered; a saved line without a date whose period is
  // not the reporting period opens as a period.
  const initialPeriod = p.lineDate === null && reporting !== null && (activity.period.start !== reporting.start || activity.period.endExclusive !== reporting.endExclusive)
  // The choice belongs to the record shown (the form may be reused for another record).
  const identity = `${activity.sourceId}\u001f${p.importId ?? ""}\u001f${p.importRow ?? ""}`
  const [mode, setMode] = useState(() => ({ identity, period: initialPeriod }))
  const coversPeriod = mode.identity === identity ? mode.period : initialPeriod
  const setCoversPeriod = (period: boolean) => setMode({ identity, period })
  const priceBasis = p.marginChoice === "with_margins" ? "with_margins" : p.boughtAtFactoryGate ? "factory_gate" : "unconfirmed"
  const setPeriod = (period: { start: string; endExclusive: string } | null) => { if (period) onEdit(next => { next.period = { start: period.start, endExclusive: period.endExclusive } }) }
  return <div className="setup-subcard"><h3>Purchase by spend (Scope 3)</h3>
    <p>EPA Supply Chain GHG Emission Factors v1.3: U.S. sector averages per 2022 dollar. Spend is a screening method; supplier or activity data replace it where they exist.</p>
    <div className="setup-grid">
      <SelectField {...need("category")} label="Category" value={String(p.category)} options={scope3CategoryOptions(categories, null).map(([value, words]) => [value, value === "9" ? `${words} (transport the company did not pay for)` : words] as const)}
        onChange={value => set(next => {
          const category = Number(value) as PurchaseSpendCollectionPayload["category"]
          next.category = category
          // AM-04: the category 9 attestation and estimate basis exist exactly for category 9; they start unanswered.
          next.paidByReportingCompany = category === 9 ? next.paidByReportingCompany : null
          next.spendEstimateBasis = category === 9 ? next.spendEstimateBasis ?? "" : null
          if (category !== 2) next.capitalFullCost = null
        })} hint="Category 9 is transport of sold products that the company did not pay for: it is entered here by hand, never imported from the ledger." />
      <QuantityFields {...need("quantity")} unitNeed={need("currency").need} label={scope3QuantityLabel("purchase_spend", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("purchase_spend", p)} unitLabelText="Currency" otherUnit
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })}
        hint="As on the ledger: a plain number, no commas. A refund or credit (negative) is kept but not counted; only US dollars are calculated." />
      <TextField {...need("description")} label="Description" value={p.description} onChange={value => set(next => { next.description = value })} hint="What was bought, as the ledger or invoice describes it." />
      <TextField {...need("supplier")} label="Supplier" value={p.supplierName} onChange={value => set(next => { next.supplierName = value })} />
      <TextField {...need("glAccount")} label="GL account" value={p.glAccount} onChange={value => set(next => { next.glAccount = value })} />
      <NaicsField {...need("naicsCode")} category={p.category} value={p.naicsCode} onChange={code => set(next => { if (code !== next.naicsCode) next.categoryConfirmed = false; next.naicsCode = code; next.mappingSource = next.importId === null || code !== null ? "user" : next.mappingSource })}
        hint={fallback ? `Category ${p.category} takes only its own list of codes.` : undefined} />
      <TextField {...need("dollarYear")} label="Dollar year" type="number" value={p.dollarYear === null ? "" : String(p.dollarYear)} onChange={value => set(next => { next.dollarYear = value.trim() === "" ? null : Number(value) })}
        hint="The year of the dollars the amount is in (2012 to 2035). Leave it empty to use the year in which the line’s period ends (the reporting year for a dated line); amounts are converted to 2022 dollars." />
      <SelectField {...need("lineCovers")} label="What does this line cover?" value={coversPeriod ? "period" : "date"} options={[["date", "One purchase on a date"], ["period", "Purchases over a period"]]}
        onChange={value => { setCoversPeriod(value === "period"); if (value === "period") set(next => { next.lineDate = null }); else setPeriod(reporting) }}
        hint={reporting ? `A dated line counts in the reporting period from company setup (${reporting.start} to ${nextDay(reporting.endExclusive, -1)}).` : undefined} />
      {!coversPeriod && <TextField {...need("lineDate")} label="Invoice or posting date" type="date" value={p.lineDate ?? ""} onChange={value => { set(next => { next.lineDate = value || null }); setPeriod(reporting) }} hint="Optional. A line dated outside the reporting period is held." />}
      {coversPeriod && <>
        <TextField {...need("firstDay")} label="First day covered" type="date" value={activity.period.start} onChange={value => onEdit(next => { next.period.start = value })} />
        <TextField {...need("lastDay")} label="Last day covered" type="date" value={nextDay(activity.period.endExclusive, -1)} onChange={value => onEdit(next => { next.period.endExclusive = nextDay(value, 1) })} hint="The inclusive last day on the source." />
      </>}
      <SelectField {...need("priceBasis")} label="Price basis" value={priceBasis} options={priceBasis === "unconfirmed" ? [...PRICE_BASIS, ["unconfirmed", "Producer price, factory gate not confirmed (held)"]] : PRICE_BASIS}
        onChange={value => set(next => { if (value === "unconfirmed") return; next.marginChoice = value === "with_margins" ? "with_margins" : "without_margins"; next.boughtAtFactoryGate = value === "factory_gate" })}
        hint="Most invoices are purchaser prices. Producer prices apply only to goods bought straight from the manufacturer." />
      {p.category === 2 && <YesNoField {...need("capitalFullCost")} label="Is the amount the full acquisition cost (not depreciation)?" value={p.capitalFullCost} onChange={value => set(next => { next.capitalFullCost = value })}
        hint="Capital goods count their full cost in the year bought (Scope 3 Standard Box 5.4); until this is Yes the line is held." />}
      <SelectField {...need("taxTreatment")} label="Sales tax" value={p.taxTreatment} options={scope3TokenOptions("taxTreatment", ["excludes_sales_tax", "includes_sales_tax", "unknown"])} onChange={value => set(next => { next.taxTreatment = value as PurchaseSpendCollectionPayload["taxTreatment"] })} />
      {!fallback && guard && <CheckField {...need("categoryConfirmed")} label={`Count this purchase in category ${p.category} anyway`} checked={p.categoryConfirmed} onChange={checked => set(next => { next.categoryConfirmed = checked })}
        hint={`This is ${SCOPE3_NAICS_GUARD_TEXT[guard]}. It is usually recorded elsewhere; confirm only if the purchase really belongs here.`} />}
      <SelectField {...need(fallback ? "activityOverlap-fallback" : "activityOverlap")} label="Covered by another record?" value={p.activityOverlap} options={scope3TokenOptions("activityOverlap", SCOPE3_ACTIVITY_OVERLAP)} onChange={value => set(next => { next.activityOverlap = value as PurchaseSpendCollectionPayload["activityOverlap"] })}
        hint={fallback ? "Spend is only a fallback in this category: confirm that no distance, waste, travel or supplier record covers this purchase, or the line is held." : "Whether a supplier or activity record already covers this purchase."} />
      {p.category === 9 && <>
        <YesNoField {...need("paidByReportingCompany")} label="Did the company pay for this transport?" value={p.paidByReportingCompany} unknownLabel="Not answered" onChange={value => set(next => { next.paidByReportingCompany = value })}
          hint="Category 9 is transport the company did not pay for (Scope 3 Standard Table 5.7); transport it paid for is category 4." />
        <TextField {...need("spendEstimateBasis")} label="How the amount was estimated" value={p.spendEstimateBasis ?? ""} onChange={value => set(next => { next.spendEstimateBasis = value })} multiline hint="For example customers’ freight estimated from carrier rate cards (3 to 300 characters)." />
      </>}
    </div>
    {p.importId !== null && <p className="nv-subtle">Imported from a ledger file, row {p.importRow}; NAICS mapping: {scope3TokenLabel("mappingSource", p.mappingSource).toLowerCase()}.</p>}
    {p.possibleDuplicateOf !== null && <div className="collection-duplicate-warning" role="alert"><strong>Possible duplicate</strong>
      <p>This line has the same line ID, date, vendor, amount and currency as row {p.possibleDuplicateOf.row} of an earlier import. It isn’t counted until you confirm it is a different purchase, or withdraw it.</p>
      <CheckField {...need("duplicateConfirmedDistinct")} label="This is a different purchase, not a duplicate" checked={p.duplicateConfirmedDistinct} onChange={checked => set(next => { next.duplicateConfirmedDistinct = checked })} /></div>}
  </div>
}

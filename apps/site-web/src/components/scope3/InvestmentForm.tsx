import { SCOPE3_ATTRIBUTION_DENOMINATORS, SCOPE3_GWP_BASES, SCOPE3_HOLDING_TYPES, SCOPE3_INVESTMENT_PATHS, type InvestmentCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, scope3Unanswered, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3PcafPreview, scope3TokenOptions } from "@/lib/scope3-forms"
import { CheckField, NaicsField, QuantityFields, SelectField, TextField, YesNoField } from "./Scope3Fields"
import { fieldLabelsOf } from "@/lib/field-needs-wo12"

/**
 * Category 15, investments (DESIGN 3.1, A13; PCAF): the investee and holding, the amount at the snapshot date, how the
 * company's share is attributed, and what the figure is based on: the investee's or project's reported scope 1 and 2
 * emissions (with verification), or its revenue and NAICS code (an economic proxy and an upper bound). Project finance by
 * an initial sponsor also records projected lifetime emissions, reported separately and never in a total. The PCAF
 * data-quality score is shown as preview text only; the method sets it.
 */
export function InvestmentForm({ activity, onEdit, env }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "investment")
  const need = fieldLabelsOf(activity, env.fieldFacts)
  const set = (change: (payload: InvestmentCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "investment")))
  const reported = p.path !== "revenue_eeio"
  const project = p.holdingType === "project_finance" || p.path === "project_reported"
  return <div className="setup-subcard"><h3>Investment (Scope 3, category 15)</h3>
    <p>The company’s share of an investee’s or project’s emissions, attributed by its share of the investee’s value or of the project’s cost (PCAF).</p>
    <div className="setup-grid">
      <TextField {...need("investee")} label="Investee or project" value={p.investeeName} onChange={value => set(next => { next.investeeName = value })} />
      <SelectField {...need("holding")} label="Holding" value={p.holdingType} options={[["", "Choose the type of holding"] as const, ...scope3TokenOptions("holdingType", SCOPE3_HOLDING_TYPES)]} onChange={value => set(next => { next.holdingType = value as InvestmentCollectionPayload["holdingType"] })} />
      <QuantityFields {...need("quantity")} unitNeed={need("unit").need} label={scope3QuantityLabel("investment", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("investment", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} />
      <TextField {...need("snapshotDate")} label="Snapshot date" type="date" value={p.snapshotDate} onChange={value => set(next => { next.snapshotDate = value })} hint="The date the amount and the attribution denominator are measured at, usually the end of the reporting year." />
      <SelectField {...need("attribution")} label="Attribution" value={p.attribution.basis} options={scope3TokenOptions("attributionBasis", ["equity_share_percent", "outstanding_over_denominator"])} onChange={value => set(next => {
        next.attribution = value === "equity_share_percent" ? { basis: "equity_share_percent", percent: "" } : { basis: "outstanding_over_denominator", denominatorType: scope3Unanswered<typeof SCOPE3_ATTRIBUTION_DENOMINATORS[number]>(), denominator: "" }
      })} />
      {p.attribution.basis === "equity_share_percent" && <TextField {...need("equityShare")} label="Equity share (%)" value={p.attribution.percent} onChange={value => set(next => { if (next.attribution.basis === "equity_share_percent") next.attribution.percent = value })} />}
      {p.attribution.basis === "outstanding_over_denominator" && <>
        <SelectField {...need("denominatorType")} label="Denominator" value={p.attribution.denominatorType} options={[["", "Choose the denominator"] as const, ...scope3TokenOptions("denominatorType", SCOPE3_ATTRIBUTION_DENOMINATORS)]}
          onChange={value => set(next => { if (next.attribution.basis === "outstanding_over_denominator") next.attribution.denominatorType = value as typeof next.attribution.denominatorType })} hint="EVIC for listed companies; total equity plus debt for private ones; total project cost for project finance." />
        <TextField {...need("denominator")} label="Denominator amount (USD)" value={p.attribution.denominator} onChange={value => set(next => { if (next.attribution.basis === "outstanding_over_denominator") next.attribution.denominator = value })} />
      </>}
      <SelectField {...need("path")} label="What the figure is based on" value={p.path} options={scope3TokenOptions("investmentPath", SCOPE3_INVESTMENT_PATHS)} onChange={value => set(next => {
        next.path = value as InvestmentCollectionPayload["path"]
        if (next.path === "revenue_eeio") { next.investeeEmissions = null; next.emissionsVerified = null } else { next.revenue = null; next.revenueYear = null; next.naicsCode = null }
      })} />
      {reported && <>
        <TextField {...need("investeeEmissions")} label="Investee’s scope 1 and 2 emissions (metric tons CO2e)" value={p.investeeEmissions ?? ""} onChange={value => set(next => { next.investeeEmissions = value || null })} hint="In metric tons CO2e, as the investee or project reports them for the year; leave empty if not known (the record is held)." />
        <YesNoField {...need("emissionsVerified")} label="Are those emissions verified by a third party?" value={p.emissionsVerified} onChange={value => set(next => { next.emissionsVerified = value })} />
      </>}
      {!reported && <>
        <TextField {...need("revenue")} label="Investee’s revenue (USD)" value={p.revenue ?? ""} onChange={value => set(next => { next.revenue = value || null })} />
        <TextField {...need("revenueYear")} label="Revenue year" type="number" value={p.revenueYear === null ? "" : String(p.revenueYear)} onChange={value => set(next => { next.revenueYear = value.trim() === "" ? null : Number(value) })} hint="2012 to 2035; revenue is converted to 2022 dollars." />
        <NaicsField {...need("investeeNaics")} category={1} value={p.naicsCode} onChange={code => set(next => { next.naicsCode = code })} label="Investee’s NAICS code (2017)" hint="The investee’s main activity; the factor without margins is used." />
      </>}
      <SelectField {...need("gwpBasis")} label="GWP basis of reported emissions" value={p.gwpBasis} options={scope3TokenOptions("gwpBasis", SCOPE3_GWP_BASES)} onChange={value => set(next => { next.gwpBasis = value as InvestmentCollectionPayload["gwpBasis"] })} />
    </div>
    {project && <div className="setup-subcard"><h4>Projected lifetime emissions (reported separately)</h4>
      <CheckField {...need("initialSponsor")} label="The company is an initial sponsor or lender of this project" checked={p.initialSponsor} onChange={checked => set(next => { next.initialSponsor = checked; if (!checked) { next.projectedAnnual = null; next.lifetimeYears = null } })} />
      {p.initialSponsor && <div className="setup-grid">
        <TextField {...need("projectedAnnual")} label="Projected annual emissions (metric tons CO2e)" value={p.projectedAnnual ?? ""} onChange={value => set(next => { next.projectedAnnual = value || null })} />
        <TextField {...need("lifetimeYears")} label="Projected lifetime (years)" type="number" value={p.lifetimeYears === null ? "" : String(p.lifetimeYears)} onChange={value => set(next => { next.lifetimeYears = value.trim() === "" ? null : Number(value) })} />
      </div>}
      <p className="nv-subtle">Projected lifetime emissions are a memo item: listed with the results, never added to any total.</p></div>}
    <p className="nv-subtle" role="note">{scope3PcafPreview(p)}</p>
  </div>
}

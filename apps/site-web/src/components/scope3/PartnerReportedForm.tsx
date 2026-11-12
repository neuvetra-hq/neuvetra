import { SCOPE3_GWP_BASES, SCOPE3_LEASE_TYPES, SCOPE3_PARTNER_CATEGORIES, SCOPE3_VERIFICATION, type PartnerReportedCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3CategoryOptions, scope3LeaseHint, scope3SupersedableCategories, scope3TokenOptions } from "@/lib/scope3-forms"
import { CheckField, QuantityFields, SelectField, SupersedesSpendFields, TextField } from "./Scope3Fields"
import { fieldNeedsOf } from "@/lib/field-needs-wo12"
import { SCOPE3_REPORT_TEXT_V3 } from "../../../../../packages/neuvetra-database/src/scope3-text-v3"

/**
 * A value-chain partner's reported scope 1 and 2 total and the company's share (categories 4, 5, 8, 9, 10, 12, 13 and 14;
 * DESIGN 3.1, A8, A15, A22): landlords, tenants, processors, franchisees, carriers, warehouses and waste contractors.
 * The figure is used as reported (its GWP and Scope 2 bases are disclosed); the attestation that it covers the reporting
 * period; the lease and its boundary hint for categories 8 and 13; the spend lines it replaces.
 */
export function PartnerReportedForm({ activity, onEdit, env }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "partner_reported")
  const need = fieldNeedsOf("partner_reported")
  const set = (change: (payload: PartnerReportedCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "partner_reported")))
  const lease = p.category === 8 || p.category === 13
  const hint = scope3LeaseHint(p.category, p.leaseType, env.consolidationApproach)
  return <div className="setup-subcard"><h3>Partner-reported emissions (Scope 3)</h3>
    <p>The partner’s own scope 1 and 2 total from its statement, and the company’s share of it.</p>
    {p.category === 10 && <p role="note">{SCOPE3_REPORT_TEXT_V3.processingPartnerDataOnly}</p>}
    <div className="setup-grid">
      <SelectField need={need("category")} label="Category" value={String(p.category)} options={scope3CategoryOptions(SCOPE3_PARTNER_CATEGORIES, "Choose the category")} onChange={value => set(next => {
        next.category = Number(value) as PartnerReportedCollectionPayload["category"]
        if (next.category !== 8 && next.category !== 13) { next.leaseType = null; next.noOperationalControlBasis = null }
      })} />
      <TextField need={need("partner")} label="Partner" value={p.counterpartyName} onChange={value => set(next => { next.counterpartyName = value })} hint="The landlord, tenant, processor, franchisee, carrier, warehouse or waste contractor whose statement this is." />
      <QuantityFields need={need("quantity")} unitNeed={need("unit")} label={scope3QuantityLabel("partner_reported", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("partner_reported", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })} onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit })} />
      <SelectField need={need("allocationBasis")} label="Our share" value={p.allocationBasis} options={[["", "Choose how the figure is shared"] as const, ...scope3TokenOptions("partnerAllocation", ["exclusive", "area", "volume", "count", "revenue", "mass", "other"])]} onChange={value => set(next => {
        next.allocationBasis = value as PartnerReportedCollectionPayload["allocationBasis"]
        const share = next.allocationBasis !== "exclusive"
        next.allocationNumerator = share ? next.allocationNumerator ?? "" : null
        next.allocationDenominator = share ? next.allocationDenominator ?? "" : null
      })} />
      {p.allocationBasis !== "exclusive" && <>
        <TextField need={need("allocationNumerator")} label="Our part of the allocation basis" value={p.allocationNumerator ?? ""} onChange={value => set(next => { next.allocationNumerator = value })} hint="For example the floor area the company leases." />
        <TextField need={need("allocationDenominator")} label="The partner’s total of the allocation basis" value={p.allocationDenominator ?? ""} onChange={value => set(next => { next.allocationDenominator = value })} hint="For example the building’s total floor area." />
      </>}
      <SelectField need={need("scope2Basis")} label="Partner’s Scope 2 basis" value={p.scope2Basis} options={scope3TokenOptions("scope2Basis", ["location", "market", "unknown"])} onChange={value => set(next => { next.scope2Basis = value as PartnerReportedCollectionPayload["scope2Basis"] })} />
      <SelectField need={need("gwpBasis")} label="GWP basis of the figure" value={p.gwpBasis} options={scope3TokenOptions("gwpBasis", SCOPE3_GWP_BASES)} onChange={value => set(next => { next.gwpBasis = value as PartnerReportedCollectionPayload["gwpBasis"] })} />
      <SelectField need={need("verification")} label="Verification" value={p.verification} options={scope3TokenOptions("verification", SCOPE3_VERIFICATION)} onChange={value => set(next => { next.verification = value as PartnerReportedCollectionPayload["verification"] })} />
      {lease && <SelectField need={need("leaseType")} label="Lease" value={p.leaseType ?? ""} options={[["", "Not stated"] as const, ...scope3TokenOptions("leaseType", SCOPE3_LEASE_TYPES)]} onChange={value => set(next => { next.leaseType = (value || null) as PartnerReportedCollectionPayload["leaseType"] })} />}
      {p.category === 8 && p.leaseType === "operating" && <TextField need={need("noOperationalControlBasis")} label="Why the company has no operational control over it" value={p.noOperationalControlBasis ?? ""} onChange={value => set(next => { next.noOperationalControlBasis = value || null })} multiline />}
    </div>
    {hint && <p className="nv-subtle" role="note">{hint}</p>}
    <CheckField need={need("periodMatches")} label="The partner’s figure covers the reporting period" checked={p.periodMatches} onChange={checked => set(next => { next.periodMatches = checked })} hint="A figure for another period is held for review." />
    <SupersedesSpendFields kind="partner_reported" value={p.supersedesSpend} onChange={value => set(next => { next.supersedesSpend = value })} lines={env.spendLines.filter(line => scope3SupersedableCategories("partner_reported", p.category).includes(line.category))} />
  </div>
}

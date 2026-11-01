import { SCOPE3_FACTOR_ORIGINS, SCOPE3_GWP_BASES, SCOPE3_HYBRID_UPSTREAM_COVERAGE, SCOPE3_SUPPLIER_BOUNDARIES, SCOPE3_UNIT_FAMILIES, SCOPE3_VERIFICATION, type PurchaseSupplierCollectionPayload } from "../../../../../packages/neuvetra-database/src/scope3-collection"
import { scope3FormUnits, scope3PayloadOf, scope3QuantityLabel, scope3Unanswered, type Scope3FormProps } from "@/lib/scope3-form-defaults"
import { scope3CategoryOptions, scope3SupersedableCategories, scope3TokenOptions } from "@/lib/scope3-forms"
import { QuantityFields, SelectField, SupersedesSpendFields, TextField } from "./Scope3Fields"
import { perUnitR2E } from "../../../../../packages/neuvetra-database/src/scope3-text-r2e"

/**
 * A supplier's own figure for what the company bought (categories 1 and 2; DESIGN 3.1, A19, A21, A22): a factor per unit
 * bought (its unit always matches the quantity's) or a total the supplier allocated, with the share; where the factor
 * comes from (supplier data, or a secondary factor the company entered), the boundary (the hybrid method says how the
 * supplier's upstream is covered), GWP basis, verification and data year, and the spend lines it replaces.
 */
export function SupplierForm({ activity, onEdit, env }: Scope3FormProps) {
  const p = scope3PayloadOf(activity, "purchase_supplier")
  const set = (change: (payload: PurchaseSupplierCollectionPayload) => void) => onEdit(next => change(scope3PayloadOf(next, "purchase_supplier")))
  const product = p.basis === "product_factor"
  const pick = (placeholder: string, field: string, tokens: readonly string[]) => [["", placeholder] as const, ...scope3TokenOptions(field, tokens)]
  return <div className="setup-subcard"><h3>Supplier-specific purchase (Scope 3)</h3>
    <p>The supplier’s cradle-to-gate figure for what was bought. A secondary factor the company looks up is recorded here too, but it is not supplier data.</p>
    <div className="setup-grid">
      <SelectField label="Category" value={String(p.category)} options={scope3CategoryOptions([1, 2], null)} onChange={value => set(next => { next.category = Number(value) as 1 | 2 })} />
      <TextField label="Supplier" value={p.supplierName} onChange={value => set(next => { next.supplierName = value })} />
      <TextField label="Product or service" value={p.product} onChange={value => set(next => { next.product = value })} />
      <SelectField label="Where the factor comes from" value={p.factorOrigin} options={pick("Choose where the factor comes from", "factorOrigin", SCOPE3_FACTOR_ORIGINS)} onChange={value => set(next => { next.factorOrigin = value as PurchaseSupplierCollectionPayload["factorOrigin"] })}
        hint="Only the supplier’s own figure counts as supplier data in the share reported from suppliers." />
      <SelectField label="What the supplier gives" value={p.basis} options={scope3TokenOptions("supplierBasis", ["product_factor", "allocated_total"])} onChange={value => onEdit(next => {
        const payload = scope3PayloadOf(next, "purchase_supplier")
        payload.basis = value as PurchaseSupplierCollectionPayload["basis"]
        const units: readonly string[] = payload.basis === "product_factor" ? SCOPE3_UNIT_FAMILIES.supplierProduct : SCOPE3_UNIT_FAMILIES.supplierAllocated
        if (!units.includes(next.quantity.originalUnit)) next.quantity.originalUnit = units[0]!
        // A product factor has a value and a unit per unit bought and takes no share; an allocated total has neither.
        if (payload.basis === "product_factor") { payload.factorValue = payload.factorValue ?? ""; payload.factorUnit = `kg CO2e per ${next.quantity.originalUnit}`; payload.allocationBasis = "supplier_allocated"; payload.allocationNumerator = null; payload.allocationDenominator = null }
        else { payload.factorValue = null; payload.factorUnit = null }
      })} />
      <QuantityFields label={scope3QuantityLabel("purchase_supplier", p)} value={activity.quantity.originalValue} unit={activity.quantity.originalUnit} units={scope3FormUnits("purchase_supplier", p)}
        onValue={value => onEdit(next => { next.quantity.originalValue = value })}
        onUnit={unit => onEdit(next => { next.quantity.originalUnit = unit; const payload = scope3PayloadOf(next, "purchase_supplier"); if (payload.basis === "product_factor") payload.factorUnit = `kg CO2e per ${unit}` })} />
      {product && <TextField label={`Factor (${perUnitR2E(activity.quantity.originalUnit)})`} value={p.factorValue ?? ""} onChange={value => set(next => { next.factorValue = value })} hint="The supplier’s kg CO2e for each unit of the quantity above: a plain number, up to 6 decimals." />}
      {!product && <SelectField label="Our share of the supplier’s figure" value={p.allocationBasis} options={scope3TokenOptions("supplierAllocation", ["supplier_allocated", "revenue", "physical", "other"])} onChange={value => set(next => {
        next.allocationBasis = value as PurchaseSupplierCollectionPayload["allocationBasis"]
        const share = next.allocationBasis !== "supplier_allocated"
        next.allocationNumerator = share ? next.allocationNumerator ?? "" : null
        next.allocationDenominator = share ? next.allocationDenominator ?? "" : null
      })} />}
      {!product && p.allocationBasis !== "supplier_allocated" && <>
        <TextField label="Our part of the allocation basis" value={p.allocationNumerator ?? ""} onChange={value => set(next => { next.allocationNumerator = value })} hint="For example our purchases from the supplier, in USD." />
        <TextField label="The supplier’s total of the allocation basis" value={p.allocationDenominator ?? ""} onChange={value => set(next => { next.allocationDenominator = value })} hint="For example the supplier’s total revenue, in USD." />
      </>}
      <SelectField label="Boundary of the figure" value={p.boundary} options={pick("Choose the boundary", "boundary", SCOPE3_SUPPLIER_BOUNDARIES)} onChange={value => set(next => {
        next.boundary = value as PurchaseSupplierCollectionPayload["boundary"]
        next.hybridUpstreamCoveredBy = next.boundary === "supplier_scope1_2_only" ? next.hybridUpstreamCoveredBy ?? scope3Unanswered<PurchaseSupplierCollectionPayload["hybridUpstreamCoveredBy"]>() : null
      })} hint="Cradle to gate is the minimum boundary. Another boundary is held for review." />
      {p.boundary === "supplier_scope1_2_only" && <SelectField label="Upstream inputs of these goods" value={p.hybridUpstreamCoveredBy ?? ""} options={pick("Choose how they are covered", "hybridUpstreamCoveredBy", SCOPE3_HYBRID_UPSTREAM_COVERAGE)}
        onChange={value => set(next => { next.hybridUpstreamCoveredBy = value as PurchaseSupplierCollectionPayload["hybridUpstreamCoveredBy"] })} hint="Calculation Guidance [1.2]: the hybrid method adds the upstream inputs from other records." />}
      <SelectField label="GWP basis of the figure" value={p.gwpBasis} options={scope3TokenOptions("gwpBasis", SCOPE3_GWP_BASES)} onChange={value => set(next => { next.gwpBasis = value as PurchaseSupplierCollectionPayload["gwpBasis"] })} hint="Figures are used as reported and not restated; the basis is disclosed." />
      <SelectField label="Verification" value={p.verification} options={scope3TokenOptions("verification", SCOPE3_VERIFICATION)} onChange={value => set(next => { next.verification = value as PurchaseSupplierCollectionPayload["verification"] })} />
      <TextField label="Year of the supplier’s data" type="number" value={p.dataYear ? String(p.dataYear) : ""} onChange={value => set(next => { next.dataYear = Number(value) })} hint="2012 to 2035." />
    </div>
    <SupersedesSpendFields value={p.supersedesSpend} onChange={value => set(next => { next.supersedesSpend = value })} lines={env.spendLines.filter(line => scope3SupersedableCategories("purchase_supplier", p.category).includes(line.category))} />
  </div>
}

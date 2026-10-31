import type { Scope3CompletionKind } from "../../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { SCOPE3_ACTIVITY_KINDS } from "@/lib/plain-language"
import type { Scope3FormProps } from "@/lib/scope3-form-defaults"
import { AssetEnergyForm } from "./AssetEnergyForm"
import { BuildingAverageForm } from "./BuildingAverageForm"
import { CommutingAverageForm } from "./CommutingAverageForm"
import { EndOfLifeSplitForm } from "./EndOfLifeSplitForm"
import { EnergyResoldForm } from "./EnergyResoldForm"
import { InvestmentForm } from "./InvestmentForm"
import { PartnerReportedForm } from "./PartnerReportedForm"
import { SoldEnergyProductForm } from "./SoldEnergyProductForm"
import { SoldFuelForm } from "./SoldFuelForm"
import { SoldGhgProductForm } from "./SoldGhgProductForm"
import { SpendLineForm } from "./SpendLineForm"
import { SupplierForm } from "./SupplierForm"
import { TeleworkingForm } from "./TeleworkingForm"

/**
 * The record form of each Scope 3 kind that migration 0030 added (Scope 3 completion I-08; Claude, 30 October 2026;
 * DESIGN 7.2). The Activity screen (CollectionWorkspace) keeps the fields every record has (site, source ID, period,
 * reference, notes, evidence, correction and withdrawal) and shows the calculation adapter's readiness; this form edits
 * the record's amount and the kind's own details. The four 0029 kinds keep their forms on the Activity screen.
 */
export function Scope3RecordForm(props: Scope3FormProps) {
  const kind = props.activity.kind as Scope3CompletionKind
  const about = SCOPE3_ACTIVITY_KINDS.find(item => item.kind === kind)
  return <>
    {about && <p className="nv-subtle">{about.categories} · {about.description} Usually from: {about.source.toLowerCase()}.</p>}
    {kind === "purchase_spend" && <SpendLineForm {...props} />}
    {kind === "purchase_supplier" && <SupplierForm {...props} />}
    {kind === "energy_resold" && <EnergyResoldForm {...props} />}
    {kind === "commuting_average" && <CommutingAverageForm {...props} />}
    {kind === "teleworking" && <TeleworkingForm {...props} />}
    {kind === "asset_energy" && <AssetEnergyForm {...props} />}
    {kind === "partner_reported" && <PartnerReportedForm {...props} />}
    {kind === "building_average" && <BuildingAverageForm {...props} />}
    {kind === "sold_fuel" && <SoldFuelForm {...props} />}
    {kind === "sold_energy_product" && <SoldEnergyProductForm {...props} />}
    {kind === "sold_ghg_product" && <SoldGhgProductForm {...props} />}
    {kind === "end_of_life_split" && <EndOfLifeSplitForm {...props} />}
    {kind === "investment" && <InvestmentForm {...props} />}
  </>
}

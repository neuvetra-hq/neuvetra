// WO-12b (CEO ruling after QA round 3 of PR #57): record-level holds. In these states one answer keeps the record from
// being counted whatever else is filled in, and the hold text says so (it belongs elsewhere, or is excluded, or the
// beta's method doesn't apply to it):
// - Scope 3, the four of the ruling: category 8 finance lease (finance_lease_in_scope1_2); category 13 operating lease
//   under financial control or equity share (lessor_operating_lease_in_scope1_2); category 9 spend the company paid for
//   (category_9_spend_paid_by_company); category 3 spend (spend_proxy_for_category_3_not_enabled);
// - found by the WO-12b search (same shape): a site excluded in company setup, or whose entity is
//   (location_excluded_by_company_setup, entity_excluded_by_company_setup and, for Scope 1 and 2, entity_outside_control_boundary);
//   a refrigerant record outside the reporting boundary (outside_declared_boundary); and one that keeps a refrigerant stock
//   or was retrofitted (simplified_method_not_applicable).
// Each is decided as the calculation adapters and engines decide it (scope3-collection.ts leaseGuard and the spend checks,
// collection-engine-input.ts collectionBoundaryHold, scope1_engine.py fugitive); wo12-field-needs.test.ts checks every one
// against them in every company world.
import { collectionBoundaryHold } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import type { CollectionActivity, CollectionContext } from "../../../../packages/neuvetra-database/src/collection-contract"
import { isScope3CollectionKind } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import type { Scope3ConsolidationApproach } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { reasonText } from "./plain-language"
import { scope3TokenLabel } from "./scope3-forms"
import { RECORD_HOLD_ANSWER_TEXT, RECORD_HOLD_INSTEAD_TEXT } from "./wo12b-text"

/** Every code that holds a record whatever else it says (the adapters' and engines' own codes). */
export const RECORD_HOLD_CODES = [
  "finance_lease_in_scope1_2", "lessor_operating_lease_in_scope1_2", "category_9_spend_paid_by_company", "spend_proxy_for_category_3_not_enabled",
  "location_excluded_by_company_setup", "entity_excluded_by_company_setup", "entity_outside_control_boundary", "outside_declared_boundary", "simplified_method_not_applicable",
] as const
export type RecordHoldCode = typeof RECORD_HOLD_CODES[number]

/** One record hold: its code, the answers that cause it (field keys of the label table) and the words of the notice. */
export interface RecordHold {
  code: RecordHoldCode
  /** The field keys whose answers hold the record (the first is the one the notice links to). */
  fields: readonly string[]
  /**
   * Fields answered before the cause, which keep their own label: leaving one blank replaces this hold with its own (a
   * refrigerant record whose boundary answer is unknown is held for that answer, before stock and retrofit are read).
   */
  upstream: readonly string[]
  question: string
  answer: string
  /** The server's own hold text (plain-language-labels reasonText), then, where it doesn't say it, what to do instead. */
  text: string
  instead: string | null
}

/** The site chosen for a record, as company setup has it: excluded (itself or its entity) or not. */
export interface RecordSiteExclusion { code: "location_excluded_by_company_setup" | "entity_excluded_by_company_setup" | "entity_outside_control_boundary"; name: string }

const APPROACH_WORDS: Readonly<Record<string, string>> = { financial_control: "financial control", equity_share: "equity share", operational_control: "operational control" }
const LEASE_KINDS = new Set(["asset_energy", "building_average", "partner_reported"])
const VALID_APPROACH = new Set(["operational_control", "financial_control", "equity_share"])

/**
 * Whether the record's site is excluded in company setup, as the record's own adapter decides it first: Scope 1 and 2 by
 * `collectionBoundaryHold`; Scope 3 by the location's inclusion, then (once setup has a valid approach) its entity's.
 */
export function recordSiteExclusion(activity: Pick<CollectionActivity, "kind" | "locationId">, context: CollectionContext | null | undefined): RecordSiteExclusion | null {
  if (!context || !activity.locationId) return null
  const location = context.locations.find(item => item.id === activity.locationId)
  if (!location) return null
  if (!isScope3CollectionKind(activity.kind)) {
    const hold = collectionBoundaryHold(activity as CollectionActivity, context)
    const code = hold?.status === "excluded" ? hold.reasons[0] : undefined
    return code === "location_excluded_by_company_setup" || code === "entity_excluded_by_company_setup" || code === "entity_outside_control_boundary" ? { code, name: location.name } : null
  }
  if (location.inclusion === "excluded") return { code: "location_excluded_by_company_setup", name: location.name }
  if (location.inclusion !== "included" || !VALID_APPROACH.has(context.boundaryApproach ?? "") || !location.entityId) return null
  const entity = location.entity
  return entity && entity.id === location.entityId && entity.inclusion === "excluded" ? { code: "entity_excluded_by_company_setup", name: location.name } : null
}

/**
 * The record hold that applies to this record now, or null. `approach` is company setup's consolidation approach as the
 * Scope 3 adapter takes it (undefined when setup couldn't be read: no category 13 hold is decided then).
 */
export function recordHold(activity: Pick<CollectionActivity, "kind" | "payload">, facts: { consolidationApproach?: Scope3ConsolidationApproach | null; siteExclusion?: RecordSiteExclusion | null }): RecordHold | null {
  const site = facts.siteExclusion
  if (site) return { code: site.code, fields: ["location"], upstream: [], question: "Company-setup location", answer: RECORD_HOLD_ANSWER_TEXT.site(site.name, site.code !== "location_excluded_by_company_setup"), text: reasonText(site.code), instead: RECORD_HOLD_INSTEAD_TEXT.location }
  const p = activity.payload as unknown as Record<string, unknown>
  const hold = (code: RecordHoldCode, fields: string[], question: string, answer: string, instead: string | null = null, upstream: string[] = []): RecordHold => ({ code, fields, upstream, question, answer, text: reasonText(code), instead })
  if (activity.kind === "fugitive") {
    if (p.insideBoundary === false) return hold("outside_declared_boundary", ["insideBoundary"], "Is the equipment inside your reporting boundary?", RECORD_HOLD_ANSWER_TEXT.no, RECORD_HOLD_INSTEAD_TEXT.outsideBoundary)
    if (p.insideBoundary !== true) return null
    const stock = p.maintainsRefrigerantStock === true, retrofit = p.retrofitInPeriod === true
    if (stock || retrofit) return hold("simplified_method_not_applicable", [...stock ? ["maintainsRefrigerantStock"] : [], ...retrofit ? ["retrofitInPeriod"] : []],
      stock ? "Do you maintain and track a stock of refrigerant?" : "Was any equipment converted to a different refrigerant during the year?", RECORD_HOLD_ANSWER_TEXT.yes, RECORD_HOLD_INSTEAD_TEXT.simplifiedMethod, ["insideBoundary"])
    return null
  }
  if (LEASE_KINDS.has(activity.kind)) {
    const category = p.category as number, lease = p.leaseType as string | null
    if (category === 8 && lease === "finance") return hold("finance_lease_in_scope1_2", ["leaseType"], "Lease", RECORD_HOLD_ANSWER_TEXT.lease(scope3TokenLabel("leaseType", lease), category))
    const approach = facts.consolidationApproach
    if (category === 13 && lease === "operating" && (approach === "financial_control" || approach === "equity_share"))
      return hold("lessor_operating_lease_in_scope1_2", ["leaseType"], "Lease", RECORD_HOLD_ANSWER_TEXT.leaseUnder(scope3TokenLabel("leaseType", lease), category, APPROACH_WORDS[approach]!))
    return null
  }
  if (activity.kind === "purchase_spend") {
    if (p.category === 3) return hold("spend_proxy_for_category_3_not_enabled", ["category"], "Category", RECORD_HOLD_ANSWER_TEXT.category(3))
    if (p.category === 9 && p.paidByReportingCompany === true) return hold("category_9_spend_paid_by_company", ["paidByReportingCompany"], "Did the company pay for this transport?", RECORD_HOLD_ANSWER_TEXT.yes)
  }
  return null
}

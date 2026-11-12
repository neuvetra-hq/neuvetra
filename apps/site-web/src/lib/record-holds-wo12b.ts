// WO-12b: record holds. In these states the record isn't counted as entered whatever else is filled in, so no other result
// field can make it count (the full classification of every hold code is lib/hold-classification-wo12b.json, checked
// against the code base by hold-classification-wo12b.test.ts):
// - company level: company setup holds every record of a scope (equity share or no approach for Scope 1 and 2, no
//   approach for Scope 3, no reporting period for Scope 1 and 2);
// - site level: company setup holds every record at the chosen site (excluded or undecided site or entity, an entity's
//   control, the site's controller or coverage, a site no longer in setup);
// - record level: one answer on this record (category 8 finance lease, category 13 operating lease under financial control
//   or equity share, category 9 spend the company paid for, category 3 spend, refrigerant equipment outside the boundary,
//   refrigerant stock or retrofit), or another record that replaces this spend line.
// Each is decided as the calculation adapters and engines decide it, in their order (collection-engine-input.ts
// collectionBoundaryHold; scope3-collection.ts planScope3Calculation, its eligibility checks, leaseGuard and spend checks;
// scope1_engine.py fugitive); wo12-field-needs.test.ts checks the screen's rule against them on every row in every company.
import { collectionBoundaryHold } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import type { CollectionActivity, CollectionContext } from "../../../../packages/neuvetra-database/src/collection-contract"
import { isScope3CollectionKind, SCOPE3_DEFAULT_PERIOD, SCOPE3_METHOD_ENVELOPE } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import type { Scope3ConsolidationApproach } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { reasonText } from "./plain-language"
import { scope3TokenLabel } from "./scope3-forms"
import { RECORD_HOLD_ANSWER_TEXT, RECORD_HOLD_INSTEAD_TEXT, RECORD_HOLD_TEXT, SETUP_APPROACH_WORDS, SETUP_HOLD_TEXT } from "./wo12b-text"

const COMPANY_CODES = ["equity_share_not_supported", "boundary_approach_unknown", "reporting_period_unknown", "scope3_consolidation_approach_required"] as const
const SITE_CODES = ["location_not_in_current_setup", "location_excluded_by_company_setup", "location_inclusion_unknown", "boundary_metadata_unavailable", "location_entity_unresolved",
  "entity_excluded_by_company_setup", "entity_inclusion_unknown", "entity_outside_control_boundary", "entity_control_unresolved", "location_control_unresolved", "location_coverage_unknown"] as const
const RECORD_CODES = ["finance_lease_in_scope1_2", "lessor_operating_lease_in_scope1_2", "category_9_spend_paid_by_company", "spend_proxy_for_category_3_not_enabled",
  "superseded_by_supplier_record", "outside_declared_boundary", "simplified_method_not_applicable"] as const
/** Every code that holds a record whatever else it says, by level (the adapters' and engines' own codes). */
export const RECORD_HOLD_LEVELS = { company: COMPANY_CODES, site: SITE_CODES, record: RECORD_CODES } as const
export const RECORD_HOLD_CODES = [...COMPANY_CODES, ...SITE_CODES, ...RECORD_CODES] as const
export type RecordHoldCode = typeof RECORD_HOLD_CODES[number]
export type CompanyHoldCode = typeof COMPANY_CODES[number]
export type SiteHoldCode = typeof SITE_CODES[number]

/** One record hold, and the words of its notice. */
export interface RecordHold {
  code: RecordHoldCode
  /** "company": company setup holds every record of the scope; "site": every record at the chosen site; "record": this record. */
  level: "company" | "site" | "record"
  /** The field keys whose answers hold the record (the first is the one "Go to" moves to); none for a company-level hold. */
  fields: readonly string[]
  /**
   * Fields answered before the cause, which keep their own label: leaving one blank replaces this hold with its own (a
   * refrigerant record whose boundary answer is unknown is held for that answer, before stock and retrofit are read).
   */
  upstream: readonly string[]
  /** The question "Go to" names (the first field's label), or null. */
  question: string | null
  /** What holds the record, in one sentence. */
  cause: string
  /** The server's own hold text, then, where it doesn't say it, what to do instead. */
  text: string
  instead: string | null
  /** Where in company setup it is decided, or null. */
  setupStep: string | null
  /** Another record to open (the record that replaces a spend line), or null. */
  link: { href: string; label: string } | null
}

/**
 * WO-12b QA round 2: the record that replaces a spend line, and what it matches the line on (scope3-collection.ts
 * planScope3Supersession): its "Spend lines this record replaces" names the line's supplier ("name"), lists the line's
 * mapping key, made of its GL account, supplier and description ("key"), or both. `fields` are this form's fields the match
 * is made on; they keep their own labels.
 */
export interface RecordSupersession { id: string; name: string; match: "name" | "key" | "both"; fields: readonly string[] }

/** What company setup says about the record's site and scope, as the adapters decide it (`recordBoundaryHold`). */
export interface RecordBoundaryHold { code: CompanyHoldCode | SiteHoldCode; site: string; approach: string; entityControl: string | null
  /** The hold company setup would place next, once this one is fixed as its notice says (so the instruction leads to a counted record). */
  then?: RecordBoundaryHold | null }

type Period = { start: string; endExclusive: string }
const within = (inner: Period, outer: Period) => inner.start >= outer.start && inner.endExclusive <= outer.endExclusive
const usable = (period: { start: string | null; endExclusive: string | null } | null | undefined): Period | null => period?.start && period.endExclusive ? { start: period.start, endExclusive: period.endExclusive } : null
const VALID_APPROACH = new Set(["operational_control", "financial_control", "equity_share"])

/**
 * The hold company setup places on this record before anything on it is read, or null (none, or a hold the record's own
 * dates decide, which stay field-level). Scope 1 and 2 by `collectionBoundaryHold` itself; Scope 3 in the order of
 * `planScope3Calculation` and its eligibility checks, with company setup's reporting period (`setupPeriod`).
 */
export function recordBoundaryHold(activity: Pick<CollectionActivity, "kind" | "locationId" | "period">, context: CollectionContext | null | undefined, setupPeriod?: Period | null): RecordBoundaryHold | null {
  const hold = boundaryHoldOnce(activity, context, setupPeriod)
  if (!hold || !context) return hold
  // Fix it in a copy of company setup as the notice says, and see what holds the record then (one step).
  const fixed = structuredClone(context)
  type Editable = { inclusion: string; control: string; entityId?: string | null; entity?: { inclusion: string; control: string } | null; startMode?: string; endMode?: string; start?: string | null; endExclusive?: string | null }
  const location = fixed.locations.find(item => item.id === activity.locationId) as Editable | undefined
  const approach: string = VALID_APPROACH.has(context.boundaryApproach ?? "") ? context.boundaryApproach! : "operational_control"
  if (!location) return hold
  if (hold.code === "location_excluded_by_company_setup" || hold.code === "location_inclusion_unknown") location.inclusion = "included"
  else if ((hold.code === "entity_excluded_by_company_setup" || hold.code === "entity_inclusion_unknown") && location.entity) location.entity.inclusion = "included"
  else if ((hold.code === "entity_outside_control_boundary" || hold.code === "entity_control_unresolved") && location.entity) location.entity.control = approach
  else if (hold.code === "location_control_unresolved") location.control = location.entityId ? "related_entity" : "reporting_company"
  else if (hold.code === "location_coverage_unknown") { location.startMode = location.startMode === "specific" && location.start ? "specific" : "period_start"; location.endMode = location.endMode === "specific" && location.endExclusive ? "specific" : "period_end" }
  else return hold
  const then = boundaryHoldOnce(activity, fixed, setupPeriod)
  return then && then.code !== hold.code ? { ...hold, then } : hold
}
function boundaryHoldOnce(activity: Pick<CollectionActivity, "kind" | "locationId" | "period">, context: CollectionContext | null | undefined, setupPeriod?: Period | null): RecordBoundaryHold | null {
  if (!context || !activity.locationId) return null
  const location = context.locations.find(item => item.id === activity.locationId)
  const of = (code: RecordBoundaryHold["code"]): RecordBoundaryHold => ({ code, site: location?.name ?? "", approach: context.boundaryApproach ?? "unknown", entityControl: location?.entity?.control ?? null })
  const isCode = (code: string | undefined): code is RecordBoundaryHold["code"] => (COMPANY_CODES as readonly string[]).includes(code ?? "") || (SITE_CODES as readonly string[]).includes(code ?? "")
  if (!isScope3CollectionKind(activity.kind)) {
    const code = collectionBoundaryHold(activity as CollectionActivity, context)?.reasons[0]
    return isCode(code) ? of(code) : null
  }
  if (!location) return of("location_not_in_current_setup")
  if (location.inclusion === "excluded") return of("location_excluded_by_company_setup")
  if (location.inclusion !== "included") return of("location_inclusion_unknown")
  if (!within(activity.period, SCOPE3_METHOD_ENVELOPE)) return null
  const effective = usable(setupPeriod) ?? SCOPE3_DEFAULT_PERIOD
  if (!usable(setupPeriod) && !within(activity.period, SCOPE3_DEFAULT_PERIOD)) return null
  if (!VALID_APPROACH.has(context.boundaryApproach ?? "")) return of("scope3_consolidation_approach_required")
  if (location.entityId === undefined) return of("boundary_metadata_unavailable")
  if (location.entityId !== null) {
    const entity = location.entity
    if (!entity || entity.id !== location.entityId) return of("location_entity_unresolved")
    if (entity.inclusion === "excluded") return of("entity_excluded_by_company_setup")
    if (entity.inclusion !== "included") return of("entity_inclusion_unknown")
  }
  if (!within(activity.period, effective)) return null
  const start = location.startMode === "period_start" ? effective.start : location.startMode === "specific" ? location.start : null
  const end = location.endMode === "period_end" ? effective.endExclusive : location.endMode === "specific" ? location.endExclusive : null
  if (!start || !end || start >= end) return of("location_coverage_unknown")
  return null
}

const LEASE_KINDS = new Set(["asset_energy", "building_average", "partner_reported"])

/**
 * The record hold that applies to this record now, or null. `consolidationApproach` is company setup's approach as the
 * Scope 3 adapter takes it (undefined when setup couldn't be read: no category 13 hold is decided then); `boundary` is
 * `recordBoundaryHold`; `supersededBy` the record that replaces a spend line (the adapter's supersession map).
 */
export function recordHold(activity: Pick<CollectionActivity, "kind" | "payload">, facts: { consolidationApproach?: Scope3ConsolidationApproach | null; boundary?: RecordBoundaryHold | null; supersededBy?: RecordSupersession | null }): RecordHold | null {
  const base = { upstream: [] as string[], setupStep: null as string | null, link: null as RecordHold["link"] }
  const boundary = facts.boundary
  if (boundary) {
    const approach = SETUP_APPROACH_WORDS[boundary.approach] ?? boundary.approach
    if ((COMPANY_CODES as readonly string[]).includes(boundary.code)) {
      const words = SETUP_HOLD_TEXT.company[boundary.code as CompanyHoldCode]
      return { ...base, code: boundary.code, level: "company", fields: [], question: null, cause: words.cause, text: words.text ?? reasonText(boundary.code), instead: words.instead, setupStep: words.step }
    }
    const words = SETUP_HOLD_TEXT.site[boundary.code as SiteHoldCode]
    const control = boundary.entityControl === null || boundary.entityControl === "unknown" ? "not assessed" : SETUP_APPROACH_WORDS[boundary.entityControl] ?? boundary.entityControl
    const then = boundary.then ? recordHold(activity, { ...facts, boundary: boundary.then }) : null
    const instead = [words.instead(approach), then ? SETUP_HOLD_TEXT.then([then.cause, then.level === "company" ? then.text : null, then.instead].filter(Boolean).join(" ")) : null].filter(Boolean).join(" ") || null
    return { ...base, code: boundary.code, level: "site", fields: ["location"], question: "Company-setup location", cause: SETUP_HOLD_TEXT.siteCause(boundary.site, words.phrase(approach, control)),
      text: reasonText(boundary.code), instead, setupStep: words.step }
  }
  const by = facts.supersededBy
  if (by) return { ...base, code: "superseded_by_supplier_record", level: "record", fields: by.fields, question: by.match === "key" ? "GL account" : "Supplier", cause: SETUP_HOLD_TEXT.supersededCause(by.name),
    text: reasonText("superseded_by_supplier_record"), instead: RECORD_HOLD_INSTEAD_TEXT.superseded(by.name, by.match), link: { href: `#/activity/${by.id}`, label: `Open ${by.name}` } }
  const p = activity.payload as unknown as Record<string, unknown>
  const hold = (code: RecordHoldCode, fields: string[], question: string, answer: string, instead: string | null = null, upstream: string[] = []): RecordHold =>
    ({ ...base, code, level: "record", fields, upstream, question, cause: RECORD_HOLD_TEXT.cause(question, answer), text: reasonText(code), instead })
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
      return hold("lessor_operating_lease_in_scope1_2", ["leaseType"], "Lease", RECORD_HOLD_ANSWER_TEXT.leaseUnder(scope3TokenLabel("leaseType", lease), category, SETUP_APPROACH_WORDS[approach]!))
    return null
  }
  if (activity.kind === "purchase_spend") {
    if (p.category === 3) return hold("spend_proxy_for_category_3_not_enabled", ["category"], "Category", RECORD_HOLD_ANSWER_TEXT.category(3), RECORD_HOLD_INSTEAD_TEXT.category3)
    if (p.category === 9 && p.paidByReportingCompany === true) return hold("category_9_spend_paid_by_company", ["paidByReportingCompany"], "Did the company pay for this transport?", RECORD_HOLD_ANSWER_TEXT.yes)
  }
  return null
}

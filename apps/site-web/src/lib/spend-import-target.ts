/**
 * Round 3 lane C (PR-3; Claude, 31 October 2026): after an import, the guided path (Overview, the Results to-do list, the
 * category rows) opens the spend import's grouped review instead of one line at a time. The caller asks for a tab with
 * `requestSpendImportFocus` just before it navigates to the Activity screen; the spend import panel takes the request
 * once (`takeSpendImportFocus`), opens that tab and brings itself into view. Tiny and dependency-free so the entry chunk
 * (Overview, Results) can use it without the lazy spend chunk.
 */
export type SpendImportTab = "code" | "other" | "duplicates" | "counted"
let pending: SpendImportTab | null = null
export function requestSpendImportFocus(tab: SpendImportTab): void { pending = tab }
export function takeSpendImportFocus(): SpendImportTab | null { const tab = pending; pending = null; return tab }
/** The id of the spend import panel on the Activity screen (an anchor for links). */
export const SPEND_IMPORT_ANCHOR = "spend-import"

/** Hold reasons a mapping (category, code, margins, the category or overlap confirmation) resolves. */
export const SCOPE3_SPEND_MAPPING_REASONS: ReadonlySet<string> = new Set(["naics_code_required", "naics_not_valid_for_category", "spend_overlap_not_confirmed", "energy_spend_belongs_in_scope_1_2_or_cat3", "spend_overlaps_other_category", "trade_sector_naics_maps_margin_only"])
/** Exact sum of plain decimal amounts (display only; never an emission). */
export function spendAmountSum(values: readonly string[]): string {
  let total = 0n
  for (const value of values) {
    const m = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(value)
    if (!m) continue
    const scaled = BigInt(m[2]!) * 1000n + BigInt((m[3] ?? "").padEnd(3, "0"))
    total += m[1] ? -scaled : scaled
  }
  const negative = total < 0n, abs = negative ? -total : total
  const fraction = String(abs % 1000n).padStart(3, "0").slice(0, 2)
  return `${negative ? "-" : ""}$${String(abs / 1000n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`
}

/**
 * Round 3 lane C texts (Claude, 31 October 2026): spend suggestions (owner decision 8), the import's date and file errors
 * (decision 9), bulk currency conversion (PR-11), the NAICS editions (PR-9), and the post-import to-do path and the
 * Activity record list (PR-3). New texts live here so no shipped text changes.
 */
import type { Scope3SpendWithdrawKind } from "./scope3-spend-terms"

export const SPEND_TEXT_R3C = {
  unreadable: "This file could not be read, so nothing was imported. Check that it is a CSV file and choose it again.",
  withdrawChip: (kind: Scope3SpendWithdrawKind) => kind === "energy" ? "Energy bill — Scope 1 or 2" : "Not a purchase — withdraw",
  withdrawWhy: (kind: Scope3SpendWithdrawKind, why: string) => kind === "energy" ? `Suggested: withdraw. ${capital(why)}; record the bill as electricity or fuel instead.` : `Suggested: withdraw. ${capital(why)}, so nothing is counted for these lines.`,
  withdrawReason: (kind: Scope3SpendWithdrawKind, why: string) => kind === "energy" ? `Energy bill, counted in Scope 1 or 2 from the bill (${why}).` : `Not a purchase: ${why}.`,
  withdrawButton: (lines: number) => `Withdraw ${lines} line${lines === 1 ? "" : "s"}`,
  noConfident: "No confident suggestion: open Map to search the NAICS titles.",
  categoryWhy: (why: string) => `Suggested category. ${why} Change it if these purchases belong elsewhere.`,
  confidence: { low: "Possible match", weak: "Weak hint" } as Record<string, string>,
  searchLabel: "Search 2017 NAICS titles",
  codeLabel: "NAICS code (2017)",
  /** PR-9: why spend uses 2017 codes while company setup asks for a 2022 code. */
  naicsEdition: "Spend lines use 2017 NAICS codes because the EPA Supply Chain GHG Emission Factors v1.3 are published by 2017 code; the 2022 code in company setup only describes your own industry.",
  convertTitle: "Convert to US dollars",
  convertIntro: "Only US dollars are calculated. Enter one rate per currency with where it comes from and its date; every held line in that currency is converted on the server, and each line keeps the rate, source and date.",
  convertLegend: (currency: string, lines: number, total: string) => `${currency}: ${lines} held line${lines === 1 ? "" : "s"} (${total})`,
  rateLabel: (currency: string) => `${currency} rate (US dollars per ${currency})`,
  sourceLabel: "Rate source",
  sourcePlaceholder: "e.g. ECB euro reference rate, annual average",
  dateLabel: "Rate date",
  convertButton: (lines: number, currency: string) => `Convert ${lines} ${currency} line${lines === 1 ? "" : "s"}`,
  convertFailed: "The lines could not be converted; nothing was changed.",
  converted: (count: number, currency: string, rate: string, source: string, date: string, skipped: ReadonlyArray<{ sourceId: string; reason: string }>) =>
    `${count} ${currency} line${count === 1 ? "" : "s"} converted to US dollars at ${rate} USD per ${currency} (${source}, ${date}).${skipped.length ? ` ${skipped.length} line${skipped.length === 1 ? "" : "s"} not converted: ${skipped.map(s => `${s.sourceId} (${s.reason === "negative_amount_not_supported" ? "a credit or refund" : "not a plain amount"})`).join(", ")}.` : ""}`,
  convertedFrom: (original: string, rate: string, currency: string, source: string, date: string) => `from ${original} at ${rate} USD per ${currency} (${source}, ${date})`,
  naicsEditionShort: "These are 2017 NAICS codes, the edition of the EPA Supply Chain factors v1.3 (company setup’s 2022 code describes only your own industry).",
  setupNaicsHint: "Your company’s own industry, in the current 2022 NAICS edition. Spend lines are mapped separately, to the 2017 codes the EPA spend factors use.",
}
const capital = (text: string) => text ? text[0]!.toUpperCase() + text.slice(1) : text

/** Round 3 lane C (PR-3): the to-do list and Overview after a spend import. */
export const TODO_SPEND_TEXT_R3C = {
  mapTitle: (lines: number, groups: number, usd: string | null) => `Map ${lines} imported spend line${lines === 1 ? "" : "s"} (${groups} vendor group${groups === 1 ? "" : "s"}${usd ? `, ${usd}` : ""}) in the spend import`,
  otherTitle: (lines: number, reason: string) => `${lines} imported spend line${lines === 1 ? "" : "s"}: ${reason}`,
  mapReason: "Lines are grouped by vendor and GL account in the spend import: one mapping covers a whole group and is remembered for later files.",
  otherReason: (tab: string) => tab === "duplicates" ? "Each possible duplicate is shown beside the earlier line in the spend import: confirm it or withdraw it." : "The spend import lists these lines with how to fix them (for other currencies, one rate converts them all).",
  open: "Open the spend import",
  categoryAction: (lines: number) => `Map ${lines} spend line${lines === 1 ? "" : "s"}`,
  nextTitle: (lines: number) => `Review ${lines} imported spend line${lines === 1 ? "" : "s"} in the spend import`,
  nextBody: (others: number) => `Lines that need a code are grouped by vendor and GL account, so one mapping covers a whole group; other holds and possible duplicates have their own tabs.${others ? ` ${others} other record${others === 1 ? " also needs" : "s also need"} input.` : ""}`,
  attentionTitle: (lines: number) => `${lines} imported spend line${lines === 1 ? "" : "s"}`,
  attentionDetail: "Need a code or another fix in the spend import (grouped by vendor and account).",
}

/** Round 3 lane C (PR-3): the Activity screen's saved-records list and its error state. */
export const ACTIVITY_LIST_TEXT_R3C = {
  neutralHeading: "Activity and evidence",
  retry: "Try again",
  notLoaded: "Saved records could not be loaded, so none are shown here. They are not lost: use Try again.",
  jumpLabel: "Go to",
  jumpSpend: "Spend import and mapping",
  jumpNew: "New activity record",
  filterLabel: "Filter saved records",
  statusLabel: "Status",
  statuses: [["all", "All"], ["attention", "Needs input"], ["ready", "No input needed"], ["withdrawn", "Withdrawn"]] as ReadonlyArray<readonly ["all" | "attention" | "ready" | "withdrawn", string]>,
  kindLabel: "Activity type",
  allKinds: "All types",
  searchLabel: "Find a source, vendor or description",
  noMatch: "No saved record matches these filters.",
  pageSize: 25,
  showing: (from: number, to: number, matching: number, total: number) => matching === total ? `Showing ${from}–${to} of ${total} records.` : `Showing ${from}–${to} of ${matching} matching records (${total} saved).`,
  previous: "Previous 25",
  next: "Next 25",
  pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
  /** What the search looks in: source ID, type, reference, notes, and a spend line's vendor, GL account and description. */
  searchText: (activity: { sourceId: string; reference: string; notes: string; payload: unknown }, kind: string) => {
    const p = (activity.payload ?? {}) as Record<string, unknown>
    return [activity.sourceId, kind, activity.reference, activity.notes, p.supplierName, p.glAccount, p.description].filter(x => typeof x === "string").join(" ").toLowerCase()
  },
}

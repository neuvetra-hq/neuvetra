/**
 * The spend review grid's data (round 2 UX-1, ACC-16; Claude, 31 October 2026). Pure: read from the decoded spend-import
 * view, nothing calculated (amounts are summed only as recorded US dollars for the progress meter and the supersession
 * reconciliation; emissions come only from the engine).
 *
 * - `scope3SpendReviewGroups`: the queue of lines that only need a code (every hold reason is a mapping reason), grouped
 *   by normalised vendor and GL account (scope3-spend-grouping.ts), with the group's remembered mapping and the lines that
 *   have their own (per-line overrides).
 * - `scope3SpendOtherHolds`: every other held line, by reason, each reason with its own fix.
 * - `scope3SpendProgress`: lines and US dollars mapped, of the lines to map.
 * - `scope3SpendNaicsSuggestions`: codes from the company's own remembered and applied mappings (same vendor, then same
 *   account), then a keyword match of the descriptions, GL account names and vendor against the EPA NAICS titles (R2).
 * - `scope3SpendSupersessionReconciliation`: each supplier or partner record beside the spend lines it replaces.
 */
import { scope3SpendAccountKey, scope3SpendGroupOf, scope3SpendIsGroupMapping, scope3SpendMappingKeyInputOf, scope3SpendVendorKey } from "../../../../packages/neuvetra-database/src/scope3-spend-grouping"
import { scope3SpendNaicsAllowed, SCOPE3_SPEND_NAICS_SETS } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { SCOPE3_SPEND_ACCOUNT_CATEGORY, SCOPE3_SPEND_TERMS, type Scope3SpendWithdrawKind } from "./scope3-spend-terms"
import { scope3DecimalSum } from "../../../../packages/neuvetra-database/src/scope3-spend-import"
import type { Scope3SpendImportsView, Scope3SpendLineView, Scope3SpendMappingView } from "./scope3-spend-import-api"
import { SCOPE3_NAICS_TITLES } from "./scope3-naics-titles"
import { shortUnit } from "./plain-language"
import { SCOPE3_SPEND_MAPPING_REASONS } from "./spend-import-target"

/** Hold reasons a mapping resolves (round 3: shared with the to-do list, which must not load this module's NAICS titles). */
export { SCOPE3_SPEND_MAPPING_REASONS }
const PLAIN_USD = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const usd = (line: Pick<Scope3SpendLineView, "currency" | "amount">) => line.currency === "USD" && PLAIN_USD.test(line.amount)
const sum = (lines: readonly Scope3SpendLineView[]) => scope3DecimalSum(lines.filter(usd).map(line => line.amount))
const active = (line: Scope3SpendLineView) => line.state === "active" && line.supersededBy === null
const needsOnlyCode = (line: Scope3SpendLineView) => active(line) && line.mappingSource !== "file" && line.plan.reasons.length > 0 && line.plan.reasons.every(reason => SCOPE3_SPEND_MAPPING_REASONS.has(reason))

export interface Scope3SpendReviewGroup {
  /** The group's key text (vendor and account; or the line key when the lines have neither) and the scope a save uses. */
  keyInput: string; scope: "group" | "line"
  vendor: string; glAccount: string; glDescriptions: string[]; descriptions: string[]
  lines: Scope3SpendLineView[]
  /** Exact sum of the group's plain US-dollar amounts. */
  usdTotal: string
  reasons: string[]
  /** The group's remembered mapping (a group row, or the line row for a line-scope group). */
  mapping: Scope3SpendMappingView | null
  /** Lines of the group with their own remembered (line) mapping, which wins over the group's. */
  overrides: Map<string, Scope3SpendMappingView>
}

/** Remembered mappings by the key text they are stored under. */
function mappingsByKeyInput(mappings: readonly Scope3SpendMappingView[]) {
  const out = new Map<string, Scope3SpendMappingView>()
  for (const mapping of mappings) { try { out.set(scope3SpendMappingKeyInputOf(mapping), mapping) } catch { /* a stored row without vendor and account cannot be a group */ } }
  return out
}

/** The lines that only need a code, grouped by vendor and account; groups with the most US dollars first. */
export function scope3SpendReviewGroups(view: Pick<Scope3SpendImportsView, "lines" | "mappings">): Scope3SpendReviewGroup[] {
  const remembered = mappingsByKeyInput(view.mappings)
  const lineMappings = new Map(view.mappings.filter(m => !scope3SpendIsGroupMapping(m)).map(m => [m.mappingKeySha256, m]))
  const groups = new Map<string, Scope3SpendReviewGroup>()
  for (const line of view.lines) {
    if (!needsOnlyCode(line)) continue
    const of = scope3SpendGroupOf({ glAccount: line.glAccount, supplierName: line.vendor, description: line.description })
    const group: Scope3SpendReviewGroup = groups.get(of.keyInput) ?? { keyInput: of.keyInput, scope: of.scope, vendor: line.vendor, glAccount: line.glAccount, glDescriptions: [], descriptions: [], lines: [], usdTotal: "0", reasons: [], mapping: remembered.get(of.keyInput) ?? null, overrides: new Map() }
    group.lines.push(line)
    if (line.glDescription && !group.glDescriptions.includes(line.glDescription)) group.glDescriptions.push(line.glDescription)
    if (!group.descriptions.includes(line.description)) group.descriptions.push(line.description)
    for (const reason of line.plan.reasons) if (!group.reasons.includes(reason)) group.reasons.push(reason)
    const own = of.scope === "group" ? lineMappings.get(line.mappingKeySha256) : undefined
    if (own) group.overrides.set(line.recordId, own)
    groups.set(of.keyInput, group)
  }
  const out = [...groups.values()]
  for (const group of out) { group.usdTotal = sum(group.lines); group.descriptions.sort((a, b) => a.localeCompare(b)); group.glDescriptions.sort((a, b) => a.localeCompare(b)) }
  const cents = (value: string) => Number(value)
  return out.sort((a, b) => cents(b.usdTotal) - cents(a.usdTotal) || b.lines.length - a.lines.length || a.vendor.localeCompare(b.vendor) || a.keyInput.localeCompare(b.keyInput))
}

/** What to do about each hold a mapping cannot fix (shown beside the lines; the reason text itself says why). */
export const SCOPE3_SPEND_HOLD_FIXES: Readonly<Record<string, { fix: string; withdraw: boolean }>> = {
  currency_not_supported: { fix: "Open the line and enter the amount in US dollars, saying in the notes how it was converted.", withdraw: false },
  currency_rate_outside_line_year: { fix: "Open the line, put back its original currency and amount (they are in its notes), then convert that year at a rate dated in the same year.", withdraw: false },
  negative_amount_not_supported: { fix: "A credit or refund: net it against the purchase it reverses, then withdraw this line.", withdraw: true },
  amount_not_a_number: { fix: "Open the line and enter the amount from the ledger as a plain number.", withdraw: false },
  quantity_not_calculable: { fix: "Open the line and enter the amount as a plain number with at most 3 decimals.", withdraw: false },
  spend_line_date_outside_reporting_period: { fix: "Check the date. A line that belongs to another period is withdrawn here and recorded in that period.", withdraw: true },
  capital_goods_must_be_full_cost: { fix: "Open the line and confirm the amount is the full purchase cost (not depreciation).", withdraw: false },
  without_margins_requires_factory_gate: { fix: "Open the line and choose the price basis: purchaser price, or producer price bought at the factory gate.", withdraw: false },
  dollar_year_required: { fix: "Open the line and give the year of the dollars.", withdraw: false },
  trade_sector_naics_maps_margin_only: { fix: "The file gave a wholesale or retail code. Open the line and confirm the category, or choose the code of the goods themselves.", withdraw: false },
  energy_spend_belongs_in_scope_1_2_or_cat3: { fix: "The file gave a fuel or energy code. Record the energy in Scope 1 or 2 and withdraw this line, or open it and confirm the category.", withdraw: true },
  spend_overlaps_other_category: { fix: "The file gave a transport, travel or waste code. Open the line and confirm the category, or withdraw it if another record covers it.", withdraw: true },
  spend_overlap_not_confirmed: { fix: "Open the line and confirm that no distance, waste or travel record covers this purchase.", withdraw: false },
  naics_not_valid_for_category: { fix: "Open the line and choose a code from the category’s own list.", withdraw: false },
  location_not_in_current_setup: { fix: "Open the line and choose a current company-setup location.", withdraw: false },
  location_inclusion_unknown: { fix: "Decide in company setup whether this location is included.", withdraw: false },
  location_excluded_by_company_setup: { fix: "The location is excluded in company setup, so the line is not counted. Nothing to fix unless the location should be included.", withdraw: false },
}
const DEFAULT_FIX = { fix: "Open the line, correct it and save; it is counted once nothing is held.", withdraw: false }
export const scope3SpendHoldFix = (reason: string) => SCOPE3_SPEND_HOLD_FIXES[reason] ?? DEFAULT_FIX

/** Every other held line (not only a code, not a possible duplicate, not withdrawn or replaced), by its first other reason. */
export function scope3SpendOtherHolds(view: Pick<Scope3SpendImportsView, "lines">): Array<{ reason: string; lines: Scope3SpendLineView[]; alsoNeedsCode: number; usdTotal: string }> {
  const out = new Map<string, Scope3SpendLineView[]>()
  for (const line of view.lines) {
    if (!active(line) || line.plan.action !== "hold" || needsOnlyCode(line)) continue
    const other = line.plan.reasons.filter(reason => reason !== "possible_duplicate_spend_line" && (line.mappingSource === "file" || !SCOPE3_SPEND_MAPPING_REASONS.has(reason)))
    const reason = other[0]
    if (!reason) continue
    out.set(reason, [...(out.get(reason) ?? []), line])
  }
  return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([reason, lines]) => ({ reason, lines, usdTotal: sum(lines), alsoNeedsCode: lines.filter(line => line.naicsCode === null).length }))
}

/**
 * Round 2c integration (walk item 4): the dollar figures are purchases (`usdTotal`, `usdMapped`: plain positive US-dollar
 * amounts; a credit or refund line is held and never mapped), with the credits and the net beside them, so the meter and
 * the file totals (net of credits) can each say which basis they show. A credit is no longer an "other amount".
 */
export interface Scope3SpendProgress { lines: number; mappedLines: number; usdTotal: string; usdMapped: string; otherAmountLines: number; counted: number; usdCredits: string; creditLines: number; usdNet: string }
/** Lines to map: active imported lines not replaced by a supplier record. Mapped: a code and no mapping hold left. */
export function scope3SpendProgress(view: Pick<Scope3SpendImportsView, "lines">): Scope3SpendProgress {
  const toMap = view.lines.filter(active)
  const mapped = toMap.filter(line => line.naicsCode !== null && !line.plan.reasons.some(reason => SCOPE3_SPEND_MAPPING_REASONS.has(reason)))
  const credits = toMap.filter(usdCredit)
  const usdTotal = sum(toMap), usdCredits = scope3DecimalSum(credits.map(line => line.amount.slice(1)))
  return { lines: toMap.length, mappedLines: mapped.length, usdTotal, usdMapped: sum(mapped), otherAmountLines: toMap.filter(line => !usd(line) && !usdCredit(line)).length, counted: toMap.filter(line => line.plan.action === "calculate").length,
    usdCredits, creditLines: credits.length, usdNet: scope3DecimalSum([usdTotal, `-${usdCredits}`]) }
}
const CREDIT = /^-(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const usdCredit = (line: Pick<Scope3SpendLineView, "currency" | "amount">) => line.currency === "USD" && CREDIT.test(line.amount) && /[1-9]/.test(line.amount)
export interface Scope3SpendAmountBasis { currency: string; purchases: string; credits: string; net: string; creditLines: number; lines: number }
/**
 * Round 2c integration (walk item 4): a file's plain amounts per currency as purchases, credits (a negative line, shown as
 * a positive amount) and net (purchases minus credits: the shared parser's file total and the reconciliation's). Amounts
 * that are not plain decimals are left out, as the parser's totals leave them out.
 */
export function scope3SpendAmountBasis(lines: ReadonlyArray<{ amount: string; currency: string }>): Scope3SpendAmountBasis[] {
  const plain = lines.filter(line => /^-?(0|[1-9][0-9]*)(\.[0-9]{1,3})?$/.test(line.amount))
  return [...new Set(plain.map(line => line.currency))].sort().map(currency => {
    const mine = plain.filter(line => line.currency === currency)
    const credits = mine.filter(line => line.amount.startsWith("-"))
    const purchases = scope3DecimalSum(mine.filter(line => !line.amount.startsWith("-")).map(line => line.amount)), credited = scope3DecimalSum(credits.map(line => line.amount.slice(1)))
    return { currency, purchases, credits: credited, net: scope3DecimalSum(mine.map(line => line.amount)), creditLines: credits.filter(line => /[1-9]/.test(line.amount)).length, lines: mine.length }
  })
}

/** A recorded decimal amount with thousands separators and at least two decimals (display only; never rounded). */
export function spendMoney(amount: string, currency = "USD"): string {
  const m = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(amount)
  if (!m) return `${currency} ${amount}`
  const fraction = (m[3] ?? "").padEnd(2, "0")
  return `${m[1]}${currency === "USD" ? "$" : `${currency} `}${m[2]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`
}

// --- NAICS suggestions (round 3 lane C, owner decision 8) ---

const STOP = new Set(["electricity", "power", "utilities", "utility", "facilities", "facility", "and", "the", "for", "of", "to", "in", "on", "a", "an", "with", "from", "by", "at", "or", "per", "fee", "fees", "services", "service", "expense", "expenses", "cost", "costs", "misc", "miscellaneous", "general", "other", "invoice", "inv", "oct", "nov", "dec", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "q1", "q2", "q3", "q4", "test", "inc", "llc", "ltd", "corp", "co", "annual", "monthly", "client", "outbound", "inbound", "raw", "materials", "material", "supplies", "supply"])
/** Ledger words → words of EPA NAICS titles (heuristic; the keyword step only runs when no curated term matches). */
const SYNONYMS: Readonly<Record<string, string[]>> = {
  toner: ["office", "supplies"], ink: ["office", "supplies"], pen: ["office", "supplies"], stationery: ["stationery"], paper: ["stationery"],
  laptop: ["electronic", "computer"], computer: ["computer"], monitor: ["computer"], hardware: ["computer"], server: ["computer"],
  software: ["software", "publishers"], saas: ["software", "publishers"], subscription: ["software", "publishers"], license: ["software", "publishers"], licence: ["software", "publishers"],
  hosting: ["hosting", "data", "processing"], cloud: ["hosting", "data", "processing"], aws: ["hosting", "data", "processing"],
  consulting: ["consulting"], consultant: ["consulting"], advisory: ["consulting"],
  legal: ["lawyers"], attorney: ["lawyers"], counsel: ["lawyers"], lawyer: ["lawyers"],
  audit: ["accountants"], accounting: ["accountants"], bookkeeping: ["accountants"],
  catering: ["caterers"], caterer: ["caterers"], lunch: ["caterers"], meals: ["restaurants"], meal: ["restaurants"], restaurant: ["restaurants"], dinner: ["restaurants"],
  flight: ["scheduled", "passenger", "air"], flights: ["scheduled", "passenger", "air"], airfare: ["scheduled", "passenger", "air"], airline: ["scheduled", "passenger", "air"],
  hotel: ["hotels", "motels"], lodging: ["hotels", "motels"],
  parcel: ["couriers", "express", "delivery"], courier: ["couriers", "express", "delivery"], shipping: ["couriers", "express", "delivery"],
  freight: ["freight", "trucking"], trucking: ["freight", "trucking"], haulage: ["freight", "trucking"], logistics: ["freight", "transportation", "arrangement"],
  cleaning: ["janitorial"], janitorial: ["janitorial"], security: ["security", "guards"],
  marketing: ["advertising", "agencies"], advertising: ["advertising", "agencies"], design: ["graphic", "design"], printing: ["commercial", "printing"],
  furniture: ["office", "furniture"], chair: ["office", "furniture"], desk: ["office", "furniture"], rent: ["lessors", "nonresidential"], lease: ["lessors", "nonresidential"],
  insurance: ["insurance", "carriers"], telecom: ["telecommunications"], phone: ["telecommunications"], internet: ["wired", "telecommunications"],
  training: ["training", "development"], course: ["training", "development"], staffing: ["temporary", "help"],
  waste: ["waste", "collection"], disposal: ["waste", "collection"], recycling: ["recycling"], car: ["passenger", "car", "rental"], taxi: ["taxi"],
  engineering: ["engineering"], laboratory: ["testing", "laboratories"], lab: ["testing", "laboratories"], packaging: ["box"], steel: ["iron", "steel", "mills"],
  repair: ["repair", "maintenance"], maintenance: ["repair", "maintenance"],
}
const stem = (word: string) => word.length > 4 && word.endsWith("ies") ? `${word.slice(0, -3)}y` : word.length > 4 && word.endsWith("es") && !word.endsWith("ses") ? word.slice(0, -2) : word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word
/** Lower-case words of a ledger text or title ("&" read as "and"); digits kept (a 401(k) is "401 k"). */
const tokens = (text: string) => text.normalize("NFKC").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter(Boolean)
const words = (text: string) => tokens(text).filter(word => word.length > 1 && !/^\d+$/.test(word))
/** A title's words for matching, without its "(except …)" clause; and the words that clause excepts. */
const TITLE_INFO = new Map(Object.entries(SCOPE3_NAICS_TITLES).map(([code, title]) => {
  const excepted = [...title.matchAll(/\(except ([^)]*)\)/gi)].flatMap(m => words(m[1]!).map(stem)).filter(word => word !== "and")
  return [code, { words: new Set(words(title.replace(/\([^)]*\)/g, " ")).map(stem)), excepted: new Set(excepted) }]
}))

export type Scope3SpendSuggestionSource = "memory" | "terms" | "keywords" | "account_memory"
export interface Scope3NaicsSuggestion {
  code: string; title: string; source: Scope3SpendSuggestionSource
  /** high: the company's own vendor memory or a curated term in the line's description or account name; medium: a curated
   * term in the vendor name only; low: a keyword match on the titles; weak: the same account mapped for another vendor. */
  confidence: "high" | "medium" | "low" | "weak"
  why: string
}
export interface Scope3SpendSuggestionSet {
  /** Owner decision 8: the line is not a purchase (withdraw it), or an energy bill counted in Scope 1 or 2 (withdraw it). */
  withdraw: { kind: Scope3SpendWithdrawKind; why: string } | null
  /** The category suggested from the account (fixed assets 2, freight 4, waste 5, travel 6) or the code; shown for confirmation. */
  category: { value: 1 | 2 | 4 | 5 | 6; why: string | null }
  suggestions: Scope3NaicsSuggestion[]
}
type SpendTexts = { vendor: string; glAccount: string; glDescriptions: readonly string[]; descriptions: readonly string[] }

/** A phrase's words match a text's at a position (a word also matches its plural in "s" or "es"). */
const sameWord = (a: string, b: string) => a === b || a === `${b}s` || b === `${a}s` || a === `${b}es` || b === `${a}es`
const PHRASES = SCOPE3_SPEND_TERMS.flatMap((term, index) => term.phrases.map(phrase => ({ index, words: tokens(phrase) })))
/** The curated terms a text names: longer phrases covering shorter ones win; per term, its longest phrase. */
function termHits(text: string): Map<number, number> {
  const ws = tokens(text), hits: Array<{ index: number; start: number; end: number }> = []
  for (const phrase of PHRASES) for (let i = 0; i + phrase.words.length <= ws.length; i++) if (phrase.words.every((w, k) => sameWord(w, ws[i + k]!))) hits.push({ index: phrase.index, start: i, end: i + phrase.words.length })
  const kept = hits.filter(h => !hits.some(o => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start))
  const out = new Map<number, number>()
  for (const h of kept) out.set(h.index, Math.max(out.get(h.index) ?? 0, h.end - h.start))
  return out
}
/** Per outcome (a NAICS code or a withdraw kind), a field's score: its longest phrase plus a tenth per extra term; and
 * whether any of its terms is specific (not an account-level generic word). */
function fieldScores(texts: readonly string[]): Map<string, { score: number; specific: boolean; votes: number }> {
  const out = new Map<string, { score: number; specific: boolean; votes: number }>()
  for (const text of texts) {
    const voted = new Set<string>()
    for (const [index, length] of termHits(text)) {
      const term = SCOPE3_SPEND_TERMS[index]!, key = term.withdraw ? `withdraw:${term.withdraw}` : term.naics!, current = out.get(key)
      // Votes: how many of the texts (a group's lines) name the outcome, so a group's commonest purchase leads.
      out.set(key, { score: Math.max(current?.score ?? 0, length) + (current ? 0.1 : 0), specific: (current?.specific ?? false) || !term.generic, votes: (current?.votes ?? 0) + (voted.has(key) ? 0 : 1) })
      voted.add(key)
    }
  }
  return out
}
const termWhy = (key: string) => SCOPE3_SPEND_TERMS.find(term => (term.withdraw ? `withdraw:${term.withdraw}` : term.naics) === key)?.why ?? ""

/** The category an account name (and an asset account's code) points to, or null. */
function accountCategory(glAccount: string, glNames: readonly string[]): { value: 2 | 4 | 5 | 6; why: string } | null {
  const asset = /^1\d{3}\b/.test(glAccount.trim())
  for (const rule of SCOPE3_SPEND_ACCOUNT_CATEGORY) {
    if (rule.assetAccountOnly && !asset) continue
    const phrases = rule.phrases.map(tokens)
    if (glNames.some(name => { const ws = tokens(name); return phrases.some(p => ws.some((_, i) => i + p.length <= ws.length && p.every((w, k) => sameWord(w, ws[i + k]!)))) })) return { value: rule.category, why: `${rule.why}` }
  }
  return null
}
const FALLBACK_SETS: ReadonlyArray<[4 | 5 | 6, readonly string[], string]> = [[4, SCOPE3_SPEND_NAICS_SETS.freight, "a freight code"], [5, SCOPE3_SPEND_NAICS_SETS.waste, "a waste code"], [6, SCOPE3_SPEND_NAICS_SETS.passenger, "a travel code"]]
/** The category for a code: the account's when the code belongs there (or the account is a fixed-asset one), else the code's own fallback set, else 1. */
function categoryFor(code: string | undefined, account: { value: 2 | 4 | 5 | 6; why: string } | null): Scope3SpendSuggestionSet["category"] {
  if (account && (account.value === 2 || !code || scope3SpendNaicsAllowed(account.value, code))) return { value: account.value, why: `From the account: ${account.why}.` }
  const own = code ? FALLBACK_SETS.find(([, set]) => set.includes(code)) : undefined
  if (own) return { value: own[0], why: `From the code: ${own[2]}.` }
  return { value: 1, why: null }
}

/**
 * Suggestions for a group of spend lines (owner decision 8), in this order:
 * 1. a withdraw suggestion when the description or GL account name is a non-purchase (payroll, wages, taxes, depreciation,
 *    amortisation, interest, intercompany, bank fees) or an energy bill (Scope 1 or 2);
 * 2. the company's vendor memory (the same vendor's remembered or applied codes; another account's only when the line's own
 *    words don't point elsewhere);
 * 3. the curated term map (description first, then the GL account name, then the vendor name);
 * 4. a keyword match on the EPA titles (titles excepting a word the line names are never offered);
 * 5. last, codes used on the same account for other vendors, as a labelled weak hint.
 * Codes are limited to `category`'s set when one is given (the mapping form's chosen category).
 */
export function scope3SpendSuggest(group: SpendTexts, view: Pick<Scope3SpendImportsView, "lines" | "mappings">, options: { category?: number; limit?: number } = {}): Scope3SpendSuggestionSet {
  const limit = options.limit ?? 5, only = options.category
  const out: Scope3NaicsSuggestion[] = []
  const add = (code: string, source: Scope3SpendSuggestionSource, confidence: Scope3NaicsSuggestion["confidence"], why: string) => {
    if (out.some(s => s.code === code) || !SCOPE3_NAICS_TITLES[code] || (only !== undefined && !scope3SpendNaicsAllowed(only, code))) return
    out.push({ code, title: SCOPE3_NAICS_TITLES[code]!, source, confidence, why })
  }
  const descriptions = group.descriptions.filter(text => text.trim()), names = group.glDescriptions.filter(text => text.trim())
  const fields = [fieldScores(descriptions), fieldScores(names), fieldScores([group.vendor])]
  // 1. Withdraw: a non-purchase or energy term in the description or the GL account name.
  const withdrawKey = (["withdraw:not_a_purchase", "withdraw:energy"] as const).find(key => fields[0]!.has(key) || fields[1]!.has(key))
  const withdraw = withdrawKey ? { kind: withdrawKey.slice(9) as Scope3SpendWithdrawKind, why: termWhy(withdrawKey) } : null
  // 3 (computed first: memory from another account yields to it). The first field with a code decides; later fields break ties.
  // Specific terms (any field) rank before generic ones; then the first field with a code decides; later fields break ties.
  const ranked: Array<{ code: string; field: number }> = []
  for (const specific of [true, false]) for (const [f, scores] of fields.entries()) {
    const codes = [...scores.keys()].filter(key => !key.startsWith("withdraw:") && scores.get(key)!.specific === specific)
    codes.sort((a, b) => scores.get(b)!.votes - scores.get(a)!.votes || scores.get(b)!.score - scores.get(a)!.score || fields.slice(f + 1).reduce((d, later) => d || (later.get(b)?.score ?? 0) - (later.get(a)?.score ?? 0), 0) || a.localeCompare(b))
    for (const code of codes) if (!ranked.some(r => r.code === code)) ranked.push({ code, field: f })
  }
  const lineWords = ranked.find(r => r.field < 2)?.code
  // 2. Vendor memory.
  const vendor = scope3SpendVendorKey(group.vendor), account = scope3SpendAccountKey(group.glAccount)
  const applied = [...view.mappings.map(m => ({ vendor: m.vendor, account: m.glAccount, code: m.naicsCode })),
    ...view.lines.filter(line => line.state === "active" && line.naicsCode !== null && !line.plan.reasons.some(reason => SCOPE3_SPEND_MAPPING_REASONS.has(reason))).map(line => ({ vendor: line.vendor, account: line.glAccount, code: line.naicsCode! }))]
  const counted = (match: (item: typeof applied[number]) => boolean) => {
    const counts = new Map<string, number>()
    for (const item of applied) if (match(item)) counts.set(item.code, (counts.get(item.code) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code]) => code)
  }
  const name = group.vendor.trim()
  if (vendor) {
    for (const code of counted(item => scope3SpendVendorKey(item.vendor) === vendor && scope3SpendAccountKey(item.account) === account)) add(code, "memory", "high", `Already used for ${name}`)
    for (const code of counted(item => scope3SpendVendorKey(item.vendor) === vendor && scope3SpendAccountKey(item.account) !== account)) if (!lineWords || lineWords === code) add(code, "memory", "high", `Already used for ${name} on another account`)
  }
  // 3. The curated terms.
  for (const r of ranked) add(r.code, "terms", r.field < 2 ? "high" : "medium", `${r.field === 0 ? "The description" : r.field === 1 ? "The account name" : "The vendor"} names ${termWhy(r.code)}`)
  if (vendor) for (const code of counted(item => scope3SpendVendorKey(item.vendor) === vendor && scope3SpendAccountKey(item.account) !== account)) add(code, "memory", "medium", `Used for ${name} on another account`)
  // 4. Keywords, only when no curated term or memory matched: descriptions and GL names weigh 2, the vendor 1.
  const accountHint = accountCategory(group.glAccount, names.length ? names : descriptions)
  if (out.length === 0) {
    const sources = new Map<string, { weight: number; targets: Set<string>; synonyms: Set<string>; word: string }>()
    const take = (text: string, weight: number) => {
      for (const word of words(text)) {
        if (STOP.has(word)) continue
        const key = stem(word), current = sources.get(key)
        if (current && current.weight >= weight) continue
        const synonyms = new Set((SYNONYMS[word] ?? SYNONYMS[key] ?? []).map(stem))
        sources.set(key, { weight, targets: new Set([key, ...synonyms]), synonyms, word: current?.word ?? word })
      }
    }
    for (const text of [...descriptions, ...names]) take(text, 2)
    take(group.vendor, 1)
    const named = new Set(sources.keys())
    const keywordCategory = only ?? accountHint?.value ?? 1
    const scored: Array<{ code: string; score: number; size: number; from: string[] }> = []
    for (const [code, title] of TITLE_INFO) {
      if (!scope3SpendNaicsAllowed(keywordCategory, code)) continue
      // "(except X)": never offered for a line that names X.
      if ([...title.excepted].some(word => named.has(word))) continue
      let score = 0
      const from: string[] = []
      for (const info of sources.values()) if ([...info.targets].some(target => title.words.has(target))) { score += info.weight + (info.synonyms.size ? 0.5 * [...info.synonyms].filter(target => title.words.has(target)).length / info.synonyms.size : 0); from.push(info.word) }
      if (score > 0) scored.push({ code, score, size: title.words.size, from })
    }
    scored.sort((a, b) => b.score - a.score || a.size - b.size || a.code.localeCompare(b.code))
    for (const s of scored) { if (out.length >= limit) break; add(s.code, "keywords", "low", `Matches “${s.from.slice(0, 3).join("”, “")}”`) }
  }
  // 5. The same account mapped for other vendors: a weak hint, always last.
  if (account) for (const item of applied.filter(item => scope3SpendAccountKey(item.account) === account && scope3SpendVendorKey(item.vendor) !== vendor)) add(item.code, "account_memory", "weak", `Used on account ${group.glAccount.trim()} for ${item.vendor.trim() || "another vendor"}; check it fits these lines`)
  const suggestions = out.slice(0, Math.max(limit, out.findIndex(s => s.source === "account_memory") + 1 || 0)).slice(0, limit + 1)
  return { withdraw, category: categoryFor(withdraw ? undefined : suggestions[0]?.code, accountHint), suggestions }
}

/** Suggested codes for a group in one category's set (the mapping form): `scope3SpendSuggest` limited to the category. */
export function scope3SpendNaicsSuggestions(group: SpendTexts, category: number, view: Pick<Scope3SpendImportsView, "lines" | "mappings">, limit = 5): Scope3NaicsSuggestion[] {
  return scope3SpendSuggest(group, view, { category, limit }).suggestions.slice(0, limit)
}

// --- Supersession reconciliation (ACC-16) ---

const BASIS_WORDS: Readonly<Record<string, string>> = { allocated_total: "supplier-allocated total", product_factor: "product factor" }
/** A unit token in words, also inside "metric_ton CO2e" or "kg CO2e per short_ton" (never a raw token on screen). */
const unitWords = (unit: string) => unit.split(" ").map(part => shortUnit(part)).join(" ")
/** The replacing figure exactly as entered: a total with its share, a factor times a quantity, or a partner's figure. */
function figureOf(s: Scope3SpendImportsView["superseders"][number]): string {
  const share = s.allocationNumerator && s.allocationDenominator ? `, share ${s.allocationNumerator} of ${s.allocationDenominator}` : ""
  if (s.kind === "purchase_supplier" && s.basis === "product_factor") return `${s.quantity} ${unitWords(s.unit)} × ${s.factorValue ?? "?"} ${unitWords(s.factorUnit ?? "")} (product factor)`.replace(/\s+\(/, " (")
  if (s.kind === "purchase_supplier") return `${s.quantity} ${unitWords(s.unit)} (${BASIS_WORDS[s.basis ?? ""] ?? "supplier figure"}${share})`
  return `${s.quantity} ${unitWords(s.unit)} (partner-reported${share})`
}
export interface Scope3SpendSupersessionRow { recordId: string; kind: string; sourceId: string; name: string; category: number; figure: string; lines: Scope3SpendImportsView["superseded"]; usdTotal: string; otherAmounts: string[] }
/** Each supplier or partner record beside the spend lines it replaces: the US dollars replaced (summed as recorded) and other amounts listed apart. */
export function scope3SpendSupersessionReconciliation(view: Pick<Scope3SpendImportsView, "superseded" | "superseders">): Scope3SpendSupersessionRow[] {
  return view.superseders.map(s => {
    const lines = view.superseded.filter(entry => entry.supersededBy === s.recordId)
    const plain = lines.filter(entry => entry.spendCurrency === "USD" && PLAIN_USD.test(entry.spendAmount))
    return { recordId: s.recordId, kind: s.kind, sourceId: s.sourceId, name: s.name, category: s.category, figure: figureOf(s), lines, usdTotal: scope3DecimalSum(plain.map(entry => entry.spendAmount)),
      otherAmounts: lines.filter(entry => !plain.includes(entry)).map(entry => `${entry.spendCurrency} ${entry.spendAmount}`) }
  }).sort((a, b) => a.name.localeCompare(b.name) || a.sourceId.localeCompare(b.sourceId))
}

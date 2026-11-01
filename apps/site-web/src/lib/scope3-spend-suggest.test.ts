// Round 3 lane C (owner decision 8; Claude, 31 October 2026): spend suggestions in the agreed order (the company's vendor
// memory, then the curated GL-account and description term map, then a keyword match on the EPA NAICS titles), account
// memory only as a labelled weak hint, "(except X)" titles never offered for a line that names X, non-purchase accounts
// offered as "Not a purchase — withdraw", the category inferred from the account, and the acceptance test: at least 90 %
// top-1 on two committed, labelled 200-line ledgers (this lane's and the round-2 reviewer's own, labelled here).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { scope3SpendGroupKeyInput } from "../../../../packages/neuvetra-database/src/scope3-spend-grouping"
import { parseScope3SpendCsv } from "../../../../packages/neuvetra-database/src/scope3-spend-import"
import { scope3SpendNaicsAllowed } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import type { Scope3SpendImportsView, Scope3SpendLineView, Scope3SpendMappingView } from "./scope3-spend-import-api"
import { scope3SpendNaicsSuggestions, scope3SpendSuggest } from "./scope3-spend-review"
import { SCOPE3_SPEND_TERMS } from "./scope3-spend-terms"
import { SCOPE3_NAICS_TITLES } from "./scope3-naics-titles"

const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")
const empty = { lines: [], mappings: [], superseded: [], superseders: [] } as unknown as Scope3SpendImportsView

/** RFC 4180 rows (the fixtures quote fields with commas). */
function csvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false } else field += c; continue }
    if (c === '"') quoted = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "" }
    else if (c !== "\r") field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}
interface Labelled { vendor: string; account: string; accountName: string; memo: string; label: string; category: string; justification: string }
function fixture(name: string): { text: string; lines: Labelled[] } {
  const text = readFileSync(new URL(`./testdata/${name}`, import.meta.url), "utf8")
  const [header, ...rows] = csvRows(text)
  expect(header).toEqual(["Document Number", "Posting Date", "Vendor Name", "Account", "Account Name", "Memo", "Amount", "Currency", "Label NAICS 2017", "Label category", "Justification"])
  return { text, lines: rows.map(r => ({ vendor: r[2]!, account: r[3]!, accountName: r[4]!, memo: r[5]!, label: r[8]!, category: r[9]!, justification: r[10]! })) }
}
/** The group texts the review grid builds for one imported line (description = memo, else the GL account name). */
const textsOf = (line: Labelled) => ({ vendor: line.vendor, glAccount: line.account, glDescriptions: line.memo && line.memo !== line.accountName ? [line.accountName] : [], descriptions: [line.memo || line.accountName] })
/** Top-1: the withdraw suggestion, else the first code; and the suggested category. */
function top(line: Labelled) {
  const s = scope3SpendSuggest(textsOf(line), empty)
  return { label: s.withdraw ? (s.withdraw.kind === "energy" ? "energy_scope_1_2" : "not_a_purchase") : s.suggestions[0]?.code ?? "(none)", category: s.withdraw ? "" : String(s.category.value) }
}
function accuracy(name: string) {
  const { lines } = fixture(name)
  const misses = lines.map(line => ({ line, got: top(line) })).filter(({ line, got }) => got.label !== line.label)
  const categoryMisses = lines.map(line => ({ line, got: top(line) })).filter(({ line, got }) => got.label === line.label && got.category !== line.category)
  return { lines, misses, categoryMisses, top1: (lines.length - misses.length) / lines.length }
}

describe("the labelled ledgers (fixtures)", () => {
  for (const name of ["spend-ledger-labelled-200.csv", "spend-ledger-reviewer-r2-labelled.csv"]) test(`${name}: 200 lines, every label a v1.3 code (in its category's set) or a withdraw label, each justified; the AP columns import`, () => {
    const { text, lines } = fixture(name)
    expect(lines.length).toBe(200)
    for (const line of lines) {
      expect(line.justification.length).toBeGreaterThan(10)
      if (line.label === "not_a_purchase" || line.label === "energy_scope_1_2") { expect(line.category).toBe(""); continue }
      expect(SCOPE3_NAICS_TITLES[line.label]).toBeDefined()
      expect(scope3SpendNaicsAllowed(Number(line.category), line.label)).toBe(true)
    }
    // Without the three label columns the file is an ordinary AP export the shared parser takes (aliases, US dates included).
    const ap = csvRows(text).map(row => row.slice(0, 8).map(cell => /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell).join(",")).join("\n") + "\n"
    const parsed = parseScope3SpendCsv(new TextEncoder().encode(ap), { period: { start: "2025-01-01", endExclusive: "2026-01-01" } })
    expect(parsed.ok ? parsed.lines.length : parsed.errors).toBe(200)
  })
  test("every code in the curated term map is a v1.3 code", () => {
    for (const term of SCOPE3_SPEND_TERMS) if (term.naics) expect(SCOPE3_NAICS_TITLES[term.naics]).toBeDefined()
  })
})

describe("acceptance: at least 90 % top-1 on the labelled ledgers (owner decision 8)", () => {
  for (const name of ["spend-ledger-labelled-200.csv", "spend-ledger-reviewer-r2-labelled.csv"]) test(name, () => {
    const result = accuracy(name)
    if (result.misses.length) console.log(`${name}: top-1 ${(result.top1 * 100).toFixed(1)} %; misses:\n${result.misses.map(m => `  ${m.line.vendor} | ${m.line.accountName} | ${m.line.memo} → ${m.got.label} (label ${m.line.label})`).join("\n")}`)
    if (result.categoryMisses.length) console.log(`${name}: category misses:\n${result.categoryMisses.map(m => `  ${m.line.vendor} | ${m.line.accountName} | ${m.line.memo} → ${m.got.category} (label ${m.line.category})`).join("\n")}`)
    expect(result.top1).toBeGreaterThanOrEqual(0.9)
    // The category shown for confirmation is right wherever the code is.
    expect(result.categoryMisses.length).toBe(0)
  })
})

describe("order and safeguards", () => {
  const remembered = (vendor: string, glAccount: string, naicsCode: string, category = 1): Scope3SpendMappingView => ({ id: "93940000-0000-4000-8000-0000000000f1", companyId: "c", mappingKeySha256: sha(scope3SpendGroupKeyInput({ glAccount, supplierName: vendor })!), glAccount, vendor, description: "",
    category, naicsCode, marginChoice: "with_margins", revision: 1, createdBy: "u", createdAt: "2025-06-01T00:00:00.000Z" })
  const view = (mappings: Scope3SpendMappingView[], lines: Scope3SpendLineView[] = []) => ({ ...empty, mappings, lines }) as unknown as Scope3SpendImportsView
  test("the reviewer's case: steel mapped on account 5010 is never the aluminum vendor's first suggestion, only a weak hint after the aluminum codes", () => {
    const s = scope3SpendSuggest({ vendor: "Northwest Aluminum", glAccount: "5010", glDescriptions: ["Raw materials - metals"], descriptions: ["Aluminum extrusions", "Aluminum ingot"] }, view([remembered("Pacific Steel Supply", "5010", "331221")]))
    expect(s.suggestions[0]!.code).toMatch(/^3313/)
    expect(s.suggestions[0]!.confidence).toBe("high")
    const hint = s.suggestions.find(item => item.code === "331221")!
    expect(hint.source).toBe("account_memory")
    expect(hint.confidence).toBe("weak")
    expect(hint.why).toContain("Pacific Steel Supply")
    expect(s.suggestions.indexOf(hint)).toBeGreaterThan(0)
  })
  test("the company's own vendor memory comes first", () => {
    const s = scope3SpendSuggest({ vendor: "Grainger Inc.", glAccount: "6110", glDescriptions: ["MRO supplies"], descriptions: ["Shop supplies"] }, view([remembered("Grainger", "6110", "423840")]))
    expect([s.suggestions[0]!.code, s.suggestions[0]!.source, s.suggestions[0]!.confidence]).toEqual(["423840", "memory", "high"])
  })
  test("titles with “(except X)” are never offered for a line that names X", () => {
    for (const category of [1, 2]) for (const s of scope3SpendNaicsSuggestions({ vendor: "Northwest Aluminum", glAccount: "5010", glDescriptions: ["Raw materials - metals"], descriptions: ["Aluminum ingot"] }, category, empty, 10))
      expect(s.title).not.toMatch(/except[^)]*aluminum/i)
    // The keyword step on its own (no term matches "nonferrous castings"): titles excepting what the line names are dropped.
    for (const s of scope3SpendNaicsSuggestions({ vendor: "", glAccount: "", glDescriptions: [], descriptions: ["Nonferrous copper castings"] }, 1, empty, 10)) expect(s.title).not.toMatch(/except[^)]*copper/i)
  })
  test("non-purchase accounts suggest “Not a purchase — withdraw”, payroll processing stays a purchase", () => {
    const withdraw = (accountName: string, memo: string, vendor = "") => scope3SpendSuggest({ vendor, glAccount: "7000", glDescriptions: [accountName], descriptions: [memo] }, empty).withdraw?.kind ?? null
    expect(withdraw("Salaries and wages", "Payroll funding", "ADP")).toBe("not_a_purchase")
    expect(withdraw("Payroll taxes", "Federal deposit")).toBe("not_a_purchase")
    expect(withdraw("Depreciation expense", "Depreciation - CNC mill")).toBe("not_a_purchase")
    expect(withdraw("Amortization expense", "Software amortization")).toBe("not_a_purchase")
    expect(withdraw("Interest expense", "Equipment loan interest")).toBe("not_a_purchase")
    expect(withdraw("Intercompany", "Management fee recharge")).toBe("not_a_purchase")
    expect(withdraw("Bank fees", "Wire fee")).toBe("not_a_purchase")
    expect(withdraw("Taxes and licenses", "Business license renewal")).toBe("not_a_purchase")
    expect(withdraw("Utilities - electricity", "Electricity - plant", "PG&E")).toBe("energy")
    expect(withdraw("Payroll services", "Payroll processing fee", "ADP")).toBeNull()
    expect(withdraw("Audit and accounting", "Tax return preparation", "Deloitte")).toBeNull()
  })
  test("the category comes from the account: fixed assets 2, freight 4, waste 5, travel 6 (a meal stays 1)", () => {
    const category = (glAccount: string, accountName: string, memo: string, vendor = "") => { const s = scope3SpendSuggest({ vendor, glAccount, glDescriptions: [accountName], descriptions: [memo] }, empty); return [s.category.value, s.suggestions[0]?.code] }
    expect(category("1500", "Machinery and equipment", "CNC vertical mill", "Haas Automation")).toEqual([2, "333517"])
    expect(category("1520", "Computer equipment", "Laptops x25", "Dell Technologies")).toEqual([2, "334111"])
    expect(category("6410", "Computer equipment", "Laptops", "Dell Technologies")).toEqual([1, "334111"])
    expect(category("5300", "Freight in", "LTL inbound", "XPO Logistics")).toEqual([4, "484122"])
    expect(category("6800", "Waste disposal", "Monthly hauling", "Waste Management")).toEqual([5, "562111"])
    expect(category("6700", "Travel - airfare", "Airfare sales team", "Delta Air Lines")).toEqual([6, "481111"])
    expect(category("6780", "Travel - meals", "Meals while traveling")).toEqual([1, "722511"])
    // A courier code is category 4 even on another account (category 1 would hold it as an overlap).
    expect(category("6100", "Office supplies", "Overnight parcels", "FedEx")).toEqual([4, "492110"])
    expect(scope3SpendSuggest({ vendor: "", glAccount: "1500", glDescriptions: ["Machinery and equipment"], descriptions: ["Mill"] }, empty).category.why).toContain("fixed-asset")
  })
  test("a group's commonest purchase leads: each line's description counts once", () => {
    const s = scope3SpendSuggest({ vendor: "Deloitte", glAccount: "6610", glDescriptions: ["Audit and accounting"], descriptions: ["Annual audit fee", "Annual audit fee", "Tax return preparation"] }, empty)
    expect(s.suggestions.slice(0, 2).map(item => item.code)).toEqual(["541211", "541213"])
  })
  test("the reviewer's six wrong suggestions are right now", () => {
    const first = (vendor: string, accountName: string, memo: string) => scope3SpendSuggest({ vendor, glAccount: "6000", glDescriptions: memo ? [accountName] : [], descriptions: [memo || accountName] }, empty).suggestions[0]?.code
    expect(first("ADP", "Payroll services", "Payroll processing fee")).toBe("541214")
    expect(first("Grainger", "MRO supplies", "")).toBe("332999")
    expect(first("Cintas", "Uniforms and facility services", "Uniform rental")).toBe("812332")
    expect(first("Deloitte", "Audit and consulting", "Annual audit fee")).toBe("541211")
    expect(first("Accrual - consultants", "Audit and consulting", "Year-end accrual")).toBe("541611")
    expect(first("Northwest Aluminum", "Raw materials - metals", "Aluminum ingot")).toBe("331313")
  })
})

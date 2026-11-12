// WO-03: Ask answers follow what the workspace does with Scope 3 (on, off, or not known), and every entry carries its review date.
import { describe, expect, test } from "bun:test"
import { HELP_ENTRIES, HELP_REVIEWED_ON, entriesFor, matchQuestion, scope3Mode, suggestedQuestions } from "./help-content"

const text = (mode: "on" | "off" | "unknown", question: string) => matchQuestion(question, undefined, mode)?.entry.answer.join(" ") ?? ""
const everything = HELP_ENTRIES.flatMap(entry => [entry.question, ...entry.answer, entry.source ?? ""]).join("\n")

describe("Ask follows the Scope 3 capability", () => {
  test("mode comes from the loaded status; a missing or failed status is neutral", () => {
    expect(scope3Mode({ scope3: true })).toBe("on")
    expect(scope3Mode({})).toBe("off")
    expect(scope3Mode(null)).toBe("unknown")
    expect(scope3Mode({ scope3: true }, true)).toBe("unknown")
  })
  test("'Do you calculate Scope 3?' answers for on, off and unknown", () => {
    expect(text("on", "Do you calculate Scope 3?")).toStartWith("Yes, in beta. Neuvetra calculates draft Scope 3 figures for supported categories with beta methods.")
    expect(text("on", "Do you calculate Scope 3?")).toContain("stay listed as open — never as zero")
    expect(text("off", "Do you calculate Scope 3?")).toBe("Scope 3 isn’t switched on in this workspace. You can still screen all 15 categories in Company setup (06); nothing is calculated for Scope 3 here.")
    const neutral = text("unknown", "Do you calculate Scope 3?")
    expect(neutral).toContain("depends on your workspace")
    expect(neutral).not.toMatch(/^Yes|isn’t switched on/)
  })
  test("only one variant of a topic is offered, and the import answer follows the capability", () => {
    for (const mode of ["on", "off", "unknown"] as const) {
      const entries = entriesFor(mode)
      expect(entries.filter(entry => (entry.variantOf ?? entry.id) === "scope3")).toHaveLength(1)
      expect(entries.filter(entry => (entry.variantOf ?? entry.id) === "import")).toHaveLength(1)
      expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length)
    }
    expect(text("on", "Can I import a spreadsheet of all my bills?")).toContain("purchase spend can be imported from a CSV")
    expect(text("off", "Can I import a spreadsheet of all my bills?")).toContain("no Scope 3 spend import")
    expect(entriesFor("off").some(entry => entry.id === "spend-import" || entry.id === "report-versions")).toBe(false)
    expect(suggestedQuestions("home", "on").length).toBeGreaterThan(0)
  })
  test("new topics are reachable", () => {
    expect(matchQuestion("how do I screen the scope 3 categories")?.entry.id).toBe("scope3-screening")
    expect(matchQuestion("what is a category assessment")?.entry.id).toBe("category-assessments")
    expect(matchQuestion("does approving mean it is externally assured", undefined, "on")?.entry.id).toBe("internal-approval")
    expect(matchQuestion("how does the spend import work", undefined, "on")?.entry.id).toBe("spend-import")
    expect(matchQuestion("what does approving a scope 3 report version mean", undefined, "on")?.entry.id).toBe("report-versions")
    expect(HELP_ENTRIES.find(entry => entry.id === "internal-approval")!.answer.join(" ")).toContain("internal approval by your company")
  })
  test("every entry has a review date, and the denylist is clean", () => {
    for (const entry of HELP_ENTRIES) expect([entry.id, entry.reviewedOn]).toEqual([entry.id, HELP_REVIEWED_ON])
    for (const banned of [/Scope 3 is not calculated/i, /schema 30/i, /reviewed methods/i, /staging owner/i, /no Scope 3 amount is calculated/i]) expect([banned.source, banned.test(everything)]).toEqual([banned.source, false])
  })
})

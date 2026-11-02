// D5 (board, 1 Nov 2026): the live private-beta landing and Ask help make no dated SB 253 claims and no claims stronger
// than the product supports — no "auditor", no "reviewed methods", no promise that other companies cannot reach the
// data. Dates and requirements belong to CARB's current guidance until a regulatory owner approves a dated statement.
import { describe, expect, test } from "bun:test"
import { HELP_ENTRIES, matchQuestion } from "./help-content"

const landing = await Bun.file(new URL("../components/Landing.tsx", import.meta.url)).text()
const help = HELP_ENTRIES.flatMap(entry => [entry.question, ...entry.answer, entry.source ?? ""]).join("\n")
// Help entries about the law or assurance (the reporting-period entry legitimately names calendar 2025 dates).
const regulatoryHelp = HELP_ENTRIES.filter(entry => /SB\s*253|CARB|assurance/i.test([entry.question, ...entry.answer].join(" ")))
  .flatMap(entry => [entry.question, ...entry.answer, entry.source ?? ""]).join("\n")
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"

describe("public claims (D5)", () => {
  test("no SB 253 deadline, assurance or Scope 3 dates on the landing or in Ask help", () => {
    expect(regulatoryHelp).toContain("SB 253")
    for (const [where, text] of [["landing", landing], ["help", regulatoryHelp]] as const) {
      expect([where, new RegExp(`(${MONTHS})\\s+\\d{1,2},?\\s+20\\d\\d`).test(text)]).toEqual([where, false])
      expect([where, /\b(?:from|in|by|starts in) 202[6-9]\b/i.test(text)]).toEqual([where, false])
      expect([where, /last checked/i.test(text)]).toEqual([where, false])
    }
  })

  test("no wording stronger than the product supports", () => {
    for (const [where, text] of [["landing", landing], ["help", help]] as const) {
      expect([where, /auditor can/i.test(text)]).toEqual([where, false])
      expect([where, /reviewed methods/i.test(text)]).toEqual([where, false])
      expect([where, /can(?:not|’t|'t) list, open or download/i.test(text)]).toEqual([where, false])
      expect([where, /kept private to your company/i.test(text)]).toEqual([where, false])
    }
    expect(landing).toContain("Greenhouse-gas reporting a reviewer can <em>trace</em>.")
    expect(landing).toContain("Calculate with beta methods")
    expect(landing).toContain("Does Neuvetra make us compliant with SB 253?")
  })

  test("SB 253 questions still reach the SB 253 answer, which points to CARB instead of giving dates", () => {
    for (const question of ["What is SB 253?", "when is limited assurance required", "do I need to report scope 3 in 2027"]) {
      expect(matchQuestion(question)?.entry.id).toBe("sb253")
    }
    const answer = HELP_ENTRIES.find(entry => entry.id === "sb253")!.answer.join(" ")
    expect(answer).toContain("check CARB’s current guidance")
    expect(answer).not.toMatch(/\$1 billion|20\d\d/)
  })
})

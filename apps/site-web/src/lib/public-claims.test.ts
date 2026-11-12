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
      // Neuvetra's operator checks uploads, so "only members of your company" would be untrue (D5 product review MF1).
      expect([where, /visible only to members/i.test(text)]).toEqual([where, false])
      expect([where, /are set by the California Air Resources Board/i.test(text)]).toEqual([where, false])
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

// WO-02 (11 Nov 2026): the landing is true at schema 28 and schema 30 alike. It reads no capability, so it never says Scope 3
// calculation is coming or missing, and it does not promise more than the beta saves or shows.
describe("truthful landing (WO-02)", () => {
  test("denylist: no stale Scope 3 or saving claims, no ✓ trust chips, no 78% bar", () => {
    for (const phrase of ["Coming next", "where you left off", "saves as a draft", "78%", "Scope 3 calculation (screening today)", "Scope 1 & 2 reporting · California SB 253", "What you can report today"]) {
      expect([phrase, landing.includes(phrase)]).toEqual([phrase, false])
    }
    expect(landing).not.toMatch(/nv-hero__trust[\s\S]{0,200}name="check"/)
    expect(landing).not.toMatch(/capabilit|status\.scope3|scope3:/)
  })

  test("allowlist: the WO-02 wording is present", () => {
    for (const phrase of [
      "Private beta · Corporate greenhouse-gas inventories",
      "Neuvetra guides your team from company setup to a draft Scope 1 and Scope 2 inventory, and helps you screen all 15 Scope 3 categories.",
      "EPA Emission Factors Hub (2025 edition)", "eGRID2023 and Green-e residual mix for electricity", "Unknown is never counted as zero", "Drafts — not externally assured",
      "Work at your own pace. Company setup is saved when you finish its review step; each activity record is saved on its own. The overview shows what’s open and what to do next.",
      "What the beta covers today", "recorded as open gaps, not calculated", "shown separately, never added together", "Purchased steam, heat and cooling: not supported yet",
      "Screen all 15 categories with reasons.", "Calculation for supported categories is in beta; your workspace shows whether it is switched on.",
      "Where it is on, categories without records or a supported method stay listed as open — never as zero.",
      "Not available yet", "Reviewer or assurance-provider access", "One frozen version of the full Scope 1, 2 and 3 report", "Rules outside California and the U.S.",
      "Neuvetra doesn’t determine whether a reporting law applies to your company.",
      "For Scope 1 and Scope 2 only, gases are combined with IPCC AR5 100-year global warming potentials.",
      "Your workspace opens on an overview of your progress and next step.",
    ]) expect([phrase, landing.includes(phrase)]).toEqual([phrase, true])
    expect(landing).toContain('<Icon name="info" size={16} />')
  })

  test("the sign-in section follows the hero, before How it works", () => {
    const hero = landing.indexOf('aria-labelledby="hero-title"'), signIn = landing.indexOf('id="sign-in"'), how = landing.indexOf('id="how"')
    expect(hero).toBeGreaterThan(0)
    expect(signIn).toBeGreaterThan(hero)
    expect(signIn).toBeLessThan(how)
  })
})

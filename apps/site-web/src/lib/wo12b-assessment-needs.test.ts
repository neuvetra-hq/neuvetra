/* eslint-disable @typescript-eslint/no-explicit-any -- the derivation edits assessments by field. */
// WO-12b: the owner's Scope 3 assessment form labels each field "Required", "Needed for results" or "Optional", derived
// from the real rules, as WO-12 derived the record forms' labels. Starting from a complete assessment that saves, in each
// setup decision (included, excluded, not applicable) and for category 3 (the energy-resale question) and category 4 (a
// documented within-category exclusion), each field is left as a person who doesn't answer it leaves it, and then
// - the save checks (`validateScope3AssessmentSaveInput`, the contract the server applies) refuse it → "Required";
// - else Results' open issues for the category (`scope3ReadinessIssues`) gain an item → "Needed for results";
// - else → "Optional", with the note "disclosed with the results" exactly where `scope3AssessmentDisclosures` gains a code.
import { describe, expect, test } from "bun:test"
import { validateScope3AssessmentSaveInput, type Scope3Assessment } from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import { scope3AssessmentDisclosures, type Scope3SetupDecision } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { ASSESSMENT_FIELDS, assessmentFieldLabel, type AssessmentField } from "./assessment-field-needs-wo12b"
import { scope3ReadinessIssues } from "./scope3-checklist"
import { ASSESSMENT_NEED_NOTES } from "./wo12b-text"

const SETUP = "95120000-0000-4000-8000-0000000000aa", FILE = "95120000-0000-4000-8000-0000000000e1"
const REASON: Record<Scope3SetupDecision, Scope3Assessment["reasonCode"]> = { included: null, excluded: "data_unavailable", not_relevant: "no_leased_assets", not_screened: null }
function complete(category: number, decision: Scope3SetupDecision): Scope3Assessment {
  return { category, reportingYear: 2025, setupVersionId: SETUP, reasonCode: REASON[decision], criteria: { size: true, influence: false, risk: false, stakeholders: false, outsourcing: false, sectorGuidance: false, other: true, otherText: "Customer requests" },
    activitiesIncluded: "Freight to customers.", justification: "Visible share of emissions.", magnitudeKind: "estimated", magnitudeTCo2e: "12.5", magnitudeBasis: "Spend times an average factor.", notQuantifiableReason: "",
    plannedMethodTypes: ["spend_based"], energyResale: category === 3 ? "none" : null, evidenceIds: [FILE],
    withinCategoryExclusions: category === 4 ? [{ noteCode: "third_party_facilities_not_included", justification: "Small share.", magnitudeKind: "estimated", magnitudeTCo2e: "1", basis: "Floor area." }] : [] }
}
const notQuantifiable = (a: Scope3Assessment) => { a.magnitudeKind = "not_quantifiable"; a.magnitudeTCo2e = null; a.magnitudeBasis = ""; a.notQuantifiableReason = "No activity data." }
/** How each field is left unanswered, and (where the field shows only in one state) the state it is checked in. */
const LEAVE: Record<AssessmentField, { leave: (a: Scope3Assessment, request: any) => void; from?: (a: Scope3Assessment, request: any) => void; categories?: number[] }> = {
  reason: { leave: a => { a.reasonCode = null } },
  activities: { leave: a => { a.activitiesIncluded = "" } },
  justification: { leave: a => { a.justification = "" } },
  criteria: { leave: a => { for (const name of ["size", "influence", "risk", "stakeholders", "outsourcing", "sectorGuidance", "other"] as const) a.criteria[name] = false; a.criteria.otherText = "" } },
  otherCriterion: { leave: a => { a.criteria.otherText = "" } },
  magnitude: { leave: a => { a.magnitudeKind = null; a.magnitudeTCo2e = null; a.magnitudeBasis = "" } },
  magnitudeTCo2e: { leave: a => { a.magnitudeTCo2e = "" } },
  magnitudeBasis: { leave: a => { a.magnitudeBasis = "" } },
  notQuantifiableReason: { from: notQuantifiable, leave: a => { a.notQuantifiableReason = "" } },
  energyResale: { leave: a => { a.energyResale = null }, categories: [3] },
  methodTypes: { leave: a => { a.plannedMethodTypes = [] } },
  evidence: { leave: a => { a.evidenceIds = [] } },
  exclusions: { leave: a => { a.withinCategoryExclusions = [] }, categories: [4] },
  exclusionJustification: { leave: a => { a.withinCategoryExclusions[0]!.justification = "" }, categories: [4] },
  exclusionMagnitude: { leave: a => { (a.withinCategoryExclusions[0] as any).magnitudeKind = "" }, categories: [4] },
  exclusionTCo2e: { leave: a => { a.withinCategoryExclusions[0]!.magnitudeTCo2e = "" }, categories: [4] },
  exclusionBasis: { leave: a => { a.withinCategoryExclusions[0]!.basis = "" }, categories: [4] },
  correctionReason: { from: (_a, request) => { request.expectedRevision = 1; request.correctionReason = "Corrected the estimate." }, leave: (_a, request) => { request.correctionReason = "" } },
}
const request = (assessment: Scope3Assessment) => ({ idempotencyKey: "95120000-0000-4000-8000-000000000001", expectedRevision: 0, correctionReason: null as string | null, assessment })
const refused = (input: unknown) => { try { validateScope3AssessmentSaveInput(input); return null } catch (cause) { return (cause as Error).message } }
/** Results' open issues for the category, with this assessment saved (the coverage row Results reads). */
const issues = (assessment: Scope3Assessment, decision: Scope3SetupDecision) => scope3ReadinessIssues({ coverage: { categories: [{ category: assessment.category, title: "", status: "calculated", screening: { decision, reason: null, description: null }, assessment }] } } as any).map(issue => issue.code)

function derive(field: AssessmentField, category: number, decision: Scope3SetupDecision) {
  const before = request(complete(category, decision))
  LEAVE[field].from?.(before.assessment, before)
  if (refused(before)) throw new Error(`${field} (category ${category}, ${decision}): the starting assessment doesn't save: ${refused(before)}`)
  const after = structuredClone(before)
  LEAVE[field].leave(after.assessment, after)
  const refusal = refused(after)
  if (refusal) return { need: "required", note: false, why: refusal }
  const gained = issues(after.assessment, decision).filter(code => !issues(before.assessment, decision).includes(code))
  if (gained.length) return { need: "results", note: false, why: gained.join(", ") }
  const disclosed = scope3AssessmentDisclosures(decision, after.assessment).filter(code => !scope3AssessmentDisclosures(decision, before.assessment).includes(code))
  return { need: "optional", note: disclosed.length > 0, why: disclosed.join(", ") || "saves; Results unchanged" }
}

describe("WO-12b: the Scope 3 assessment form's field labels, derived from the save checks and Results", () => {
  const decisions: Scope3SetupDecision[] = ["included", "excluded", "not_relevant"]
  test("every field's label, in every decision, is the one the rules give it", () => {
    const wrong: string[] = []
    for (const decision of decisions) for (const field of ASSESSMENT_FIELDS) for (const category of LEAVE[field].categories ?? [3, 4, 6]) {
      const rules = derive(field, category, decision), label = assessmentFieldLabel(field, decision)
      const note = label.needNote === ASSESSMENT_NEED_NOTES.disclosed || label.needNote === ASSESSMENT_NEED_NOTES.disclosedUnlessSetup
      if (label.need !== rules.need || note !== rules.note) wrong.push(`${field} (category ${category}, ${decision}): shown ${label.need}${note ? " (disclosed)" : ""}, rules say ${rules.need}${rules.note ? " (disclosed)" : ""} (${rules.why})`)
    }
    expect(wrong).toEqual([])
  })
  test("only a missing assessment is an open issue in Results: no answer is Needed for results; the required ones are the save's", () => {
    expect(ASSESSMENT_FIELDS.filter(field => assessmentFieldLabel(field, "excluded").need === "required")).toEqual(["magnitudeTCo2e", "notQuantifiableReason", "exclusionJustification", "exclusionMagnitude", "exclusionTCo2e", "correctionReason"])
    expect(issues(complete(6, "included"), "included")).toEqual([])
    expect(scope3ReadinessIssues({ coverage: { categories: [{ category: 6, title: "", status: "calculated", screening: { decision: "included", reason: null, description: null }, assessment: null }] } } as any).map(issue => issue.code)).toEqual(["assessment_missing"])
    // The included decision's description note: setup's own description also satisfies the rule.
    const blank = { ...complete(6, "included"), activitiesIncluded: "" }
    expect([scope3AssessmentDisclosures("included", blank), scope3AssessmentDisclosures("included", blank, "Flights.")]).toEqual([["included_activities_not_described"], []])
    expect(assessmentFieldLabel("activities", "included").needNote).toBe(ASSESSMENT_NEED_NOTES.disclosedUnlessSetup)
  })
})

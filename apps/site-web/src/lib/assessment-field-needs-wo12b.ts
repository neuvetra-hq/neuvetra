// WO-12b: the three field labels on the owner's Scope 3 assessment form (Scope3ScreeningEditor), as WO-12 gave them to the
// record forms. Each is derived from the real rules, and `wo12b-assessment-needs.test.ts` re-derives every entry:
// - "required": the save checks (`validateScope3AssessmentSaveInput`, the same contract the server applies) refuse the
//   assessment without it;
// - "results": the assessment saves but Results' open issues (`scope3ReadinessIssues`) gain an item until it is filled.
//   No assessment answer does that (only a missing assessment does), so no field here is "Needed for results";
// - "optional": everything else. Where leaving it blank adds a disclosure to the results for this decision
//   (`scope3AssessmentDisclosures`), the label says so.
import type { Scope3SetupDecision } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import type { FieldLabel } from "./field-needs-wo12"
import { ASSESSMENT_NEED_NOTES } from "./wo12b-text"

export const ASSESSMENT_FIELDS = ["reason", "activities", "justification", "criteria", "otherCriterion", "magnitude", "magnitudeTCo2e", "magnitudeBasis", "notQuantifiableReason",
  "energyResale", "methodTypes", "evidence", "exclusions", "exclusionJustification", "exclusionMagnitude", "exclusionTCo2e", "exclusionBasis", "correctionReason"] as const
export type AssessmentField = typeof ASSESSMENT_FIELDS[number]

const REQUIRED: ReadonlySet<AssessmentField> = new Set(["magnitudeTCo2e", "notQuantifiableReason", "exclusionJustification", "exclusionMagnitude", "exclusionTCo2e", "correctionReason"])

/** A field's label for an assessment of a category with this setup decision. */
export function assessmentFieldLabel(field: AssessmentField, decision: Scope3SetupDecision): FieldLabel {
  if (REQUIRED.has(field)) return { need: "required" }
  const disclosed = decision === "excluded" ? field === "reason" || field === "criteria" || field === "magnitude"
    : decision === "not_relevant" ? field === "reason" : false
  if (disclosed) return { need: "optional", needNote: ASSESSMENT_NEED_NOTES.disclosed }
  if (decision === "included" && field === "activities") return { need: "optional", needNote: ASSESSMENT_NEED_NOTES.disclosedUnlessSetup }
  return { need: "optional" }
}

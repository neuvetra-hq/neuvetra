// PR 22 bug hunt C (Claude, 1 November 2026), C-07: the Results "Download as ZIP (one CSV per section)" button's accessible
// name was "Download the Scope 3 CSV as a ZIP with one CSV file per section", which does not contain the words on the
// button (WCAG 2.5.3 Label in Name): a speech-input user saying "click Download as ZIP" could not reach it. Found live with
// c-tools/e2e/label-in-name.mjs (the only such control on Overview, Activity, Results and setup for C1).
import { expect, test } from "bun:test"
import { SCOPE3_CSV_TEXT_R3D } from "./scope3-text-r3d"

test("the ZIP download's accessible name contains its visible label", () => {
  expect(SCOPE3_CSV_TEXT_R3D.zipAria.toLowerCase()).toContain(SCOPE3_CSV_TEXT_R3D.zip.toLowerCase())
})

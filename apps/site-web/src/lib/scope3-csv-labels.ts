// Scope 3 completion I-10 (Claude, 30 October 2026; DESIGN A17, 7.4): the label functions of the Scope 3 CSV. Round 2 lane E
// (ENG-6): they live in the package (`plain-language-labels.ts`), which the API imports when it freezes a report version;
// this module re-exports them for the web, so a stored CSV is the bytes the web would write for the same results.
export { SCOPE3_CSV_LABELS } from "../../../../packages/neuvetra-database/src/plain-language-labels"

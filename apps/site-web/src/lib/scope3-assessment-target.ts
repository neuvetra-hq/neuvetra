/**
 * WO-04c (QA of PR #51, round-1 follow-up carried over): "Add the assessment" on the Overview opens that category's
 * assessment on Results, not just the Results screen. The caller asks for a category with `requestScope3AssessmentFocus`
 * just before it navigates to Results; the Scope 3 Results panel takes the request once (`takeScope3AssessmentFocus`) when
 * its results have loaded, opens the to-do list and the category's inline assessment, and brings it into view. Tiny and
 * dependency-free, like `spend-import-target.ts`, so the entry chunk can use it.
 */
let pending: number | null = null
export function requestScope3AssessmentFocus(category: number): void { pending = category }
export function takeScope3AssessmentFocus(): number | null { const category = pending; pending = null; return category }

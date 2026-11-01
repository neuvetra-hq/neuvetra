import { lazy, Suspense } from "react"
import type { ResultsReport as ResultsType } from "./ResultsReport"
import type { CompanyWorkspaceDemo as ExampleType } from "./CompanyWorkspaceDemo"
import { lazyChunkWithRetry } from "@/lib/lazy-retry"
import { NewerVersionNotice } from "./scope3/lazy-forms"

const Results = lazy(() => lazyChunkWithRetry(() => import("./ResultsReport").then(module => module.ResultsReport), NewerVersionNotice))
const Example = lazy(() => lazyChunkWithRetry(() => import("./CompanyWorkspaceDemo").then(module => module.CompanyWorkspaceDemo), NewerVersionNotice))

/** Load the report renderers when Results is opened; the saved activity and calculation contracts are unchanged. */
export function ResultsReport({ headingRef, ...props }: Parameters<typeof ResultsType>[0]) {
  return <Suspense fallback={<section aria-busy="true"><h1 ref={headingRef} tabIndex={-1}>Draft results</h1><p role="status">Loading results and report…</p></section>}><Results headingRef={headingRef} {...props} /></Suspense>
}
export function CompanyWorkspaceDemo(props: Parameters<typeof ExampleType>[0]) {
  return <Suspense fallback={<p role="status">Loading the example workspace…</p>}><Example {...props} /></Suspense>
}

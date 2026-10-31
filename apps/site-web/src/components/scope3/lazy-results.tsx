import { lazy, Suspense, useEffect } from "react"
import type { Scope3ReportSection as ReportType } from "../Scope3Results"
import type { Scope3ResultsPanel as PanelType } from "./Scope3ResultsPanel"
import { lazyChunkWithRetry } from "@/lib/lazy-retry"
import { NewerVersionNotice } from "./lazy-forms"

type ReportProps = Parameters<typeof ReportType>[0] & { onReady?: (results: Parameters<typeof ReportType>[0]["results"]) => void }
const Panel = lazy(() => lazyChunkWithRetry(() => import("./Scope3ResultsPanel").then(module => module.Scope3ResultsPanel), NewerVersionNotice))
const Report = lazy(() => lazyChunkWithRetry(() => import("../Scope3Results").then(module => {
  return function ReadyReport({ onReady, ...props }: ReportProps) {
    useEffect(() => { onReady?.(props.results) }, [onReady, props.results])
    return <module.Scope3ReportSection {...props} />
  }
}), NewerVersionNotice))

export function Scope3ResultsPanel(props: Parameters<typeof PanelType>[0]) {
  return <Suspense fallback={<p role="status">Loading Scope 3 results…</p>}><Panel {...props} /></Suspense>
}
export function Scope3ReportSection(props: ReportProps) {
  return <Suspense fallback={<p role="status">Scope 3 report is still loading. This printout is incomplete.</p>}><Report {...props} /></Suspense>
}

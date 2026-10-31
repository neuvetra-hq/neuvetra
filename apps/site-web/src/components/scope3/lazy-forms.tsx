import { lazy, Suspense, type ReactNode } from "react"
import type { Scope3FormProps } from "@/lib/scope3-form-defaults"
import type { DataQualityEditor as DataQualityEditorType } from "./DataQualityEditor"
import type { SpendImport as SpendImportType } from "./SpendImport"
import type { Scope3ReportVersions as Scope3ReportVersionsType } from "./Scope3ReportVersions"
import type { Scope3ScreeningEditorProps } from "./Scope3ScreeningEditor"
import { lazyChunkWithRetry } from "@/lib/lazy-retry"
import { LAZY_TEXT_R2C } from "@/lib/scope3-text-r2c"

/**
 * Round 2 lane E (ENG-13; Claude, 31 October 2026): the Scope 3 record forms, the data-quality editor and the spend import
 * load on first use, in their own chunks, so the Activity screen's first load no longer carries them. Same names and props
 * as the components they wrap; while a chunk loads, a short status line stands in for the form.
 */
// Round 2c integration (walk item 6): after a new release an open page asks for chunk files that no longer exist. Each chunk
// is retried once, then this notice stands in for it (lib/lazy-retry.ts).
export function NewerVersionNotice() {
  return <div className="nv-notice nv-notice--warn" role="alert"><p>{LAZY_TEXT_R2C.newerVersion}</p><button type="button" className="nv-btn nv-btn--sm" onClick={() => window.location.reload()}>{LAZY_TEXT_R2C.reload}</button></div>
}
const RecordForm = lazy(() => lazyChunkWithRetry(() => import("./Scope3RecordForm").then(module => module.Scope3RecordForm), NewerVersionNotice))
const QualityEditor = lazy(() => lazyChunkWithRetry(() => import("./DataQualityEditor").then(module => module.DataQualityEditor), NewerVersionNotice))
const Import = lazy(() => lazyChunkWithRetry(() => import("./SpendImport").then(module => module.SpendImport), NewerVersionNotice))
// Round 2 integration (ENG-13): the frozen report versions (prepare, open, approve; the v1 and v2 document validators) load
// when the Scope 3 panel first shows them, so lanes B and D's report code does not grow the entry chunk.
const ReportVersions = lazy(() => lazyChunkWithRetry(() => import("./Scope3ReportVersions").then(module => module.Scope3ReportVersions), NewerVersionNotice))
const ScreeningEditor = lazy(() => lazyChunkWithRetry(() => import("./Scope3ScreeningEditor").then(module => module.Scope3ScreeningEditor), NewerVersionNotice))
const loading = (what: string): ReactNode => <p className="nv-subtle" role="status">Loading the {what}…</p>

export function Scope3RecordForm(props: Scope3FormProps) {
  return <Suspense fallback={loading("form")}><RecordForm {...props} /></Suspense>
}
export function DataQualityEditor(props: Parameters<typeof DataQualityEditorType>[0]) {
  return <Suspense fallback={loading("data-quality questions")}><QualityEditor {...props} /></Suspense>
}
export function SpendImport(props: Parameters<typeof SpendImportType>[0]) {
  return <Suspense fallback={loading("spend import")}><Import {...props} /></Suspense>
}
export function Scope3ReportVersions(props: Parameters<typeof Scope3ReportVersionsType>[0]) {
  return <Suspense fallback={loading("report versions")}><ReportVersions {...props} /></Suspense>
}
export function Scope3ScreeningEditor(props: Scope3ScreeningEditorProps) {
  return <Suspense fallback={loading("category assessment")}><ScreeningEditor {...props} /></Suspense>
}

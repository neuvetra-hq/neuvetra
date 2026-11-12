import type { HostedWorkspaceActor } from "./workspace-api"
import { serverErrorText, withRequestTimeout } from "./request-timeout"
import type { Scope3ResultsDocument, Scope3ResultsLine, Scope3ResultsMethod } from "../../../../packages/neuvetra-database/src/scope3-trace"
// I-06 (DESIGN A17): the CSV, its statements and the status words live in the shared, browser-safe package modules, so the
// API (frozen report versions) and this screen write the same bytes; they are re-exported here for the screen and tests.
export { scope3Csv, scope3StatementLines, scope3LineStatusText, scope3LineReasonCodes, scope3DataQualityText, scope3ProfileDataQualityText, scope3EvidenceFileText, type Scope3CsvLabels } from "../../../../packages/neuvetra-database/src/scope3-report-csv"
export { scope3ExclusionRegister, scope3TotalStatement } from "../../../../packages/neuvetra-database/src/scope3-methodology"
// Round 3, lane A (owner decisions 2, 3 and 4): memo words, a line's memo text and the superseded spend memo words, for the screen and print.
export { scope3LineMemoText } from "../../../../packages/neuvetra-database/src/scope3-report-csv"
export { scope3MemoText } from "../../../../packages/neuvetra-database/src/scope3-r3a"
export { SCOPE3_SUPERSEDED_MEMO_TEXT_R3A } from "../../../../packages/neuvetra-database/src/scope3-text"
export { scope3ConstantSourceOf, scope3ConstantText, scope3ConversionText, scope3FactorSourceOfKey, scope3FactorText, scope3GasTexts, scope3KgToTonnesExact, scope3SupersededBy } from "../../../../packages/neuvetra-database/src/scope3-trace"
export { SCOPE3_DQ_INDICATOR_TEXT, SCOPE3_DQ_RATING_TEXT, SCOPE3_METHOD_TYPE_TEXT, SCOPE3_ORIGIN_TEXT, SCOPE3_REVIEW_FLAG_TEXT, SCOPE3_SET_BY_TEXT, SCOPE3_STATUS_TEXT, SCOPE3_TOTAL_TEXT, SCOPE3_TRACE_TEXT, SCOPE3_ASSESSMENT_REASON_TEXT, SCOPE3_EXCLUDABLE_NOTE_TEXT } from "../../../../packages/neuvetra-database/src/scope3-text"

/**
 * Draft Scope 3 results (Scope 3 package 2; Claude, 26 October 2026). A separate request, response, screen section and
 * CSV from the Scope 1 and 2 results (D4), so Scope 3 never changes their figures or their CSV.
 */
export const SCOPE3_RESULTS_PROFILE = "neuvetra.scope3-results.v1"
/** I-06: the response shapes are shared with the route and the CSV (packages `scope3-trace.ts`). */
export type Scope3MethodUsed = Scope3ResultsMethod
/** `plan.status` `method_pending`: a designed method whose factor source is not loaded (DESIGN A6); `optional: true` only on such a hold of an optional activity (A27). */
export type Scope3Row = Scope3ResultsLine
export type Scope3ResultsResponse = Scope3ResultsDocument

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)

/** What the Results screen knows about Scope 3 for this company. */
export interface Scope3State { data: Scope3ResultsResponse | null; message: string | null; unavailable: boolean; busy: boolean }
export const INITIAL_SCOPE3_STATE: Scope3State = { data: null, message: null, unavailable: false, busy: false }

export class Scope3ResultsApiError extends Error { constructor(message: string, readonly status: number, readonly code: string | null) { super(message) } }

export async function loadScope3Results(companyId: string, actor: HostedWorkspaceActor): Promise<Scope3ResultsResponse> {
  if (!UUID.test(companyId)) throw new Error("Invalid company reference.")
  if (!actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  // WO-09: Scope 3 results may take up to 95 s; the limit covers reading the answer too.
  const { response, value } = await withRequestTimeout("scope3Results", actor.signal, async signal => {
    const response = await fetch(`/workspace-api/workspace/${companyId}/results/scope3`, { headers: { authorization: `Bearer ${actor.accessToken}` }, cache: "no-store", signal })
    if (response.status === 401 || response.status === 403) actor.onUnauthorized?.(response.status)
    const value: unknown = response.ok ? await response.json() : await response.json().catch(() => null)
    return { response, value }
  })
  if (!response.ok) {
    const body = value, code = record(body) && typeof body.code === "string" ? body.code : null
    throw new Scope3ResultsApiError(serverErrorText(response.status, code, record(body) && typeof body.error === "string" ? body.error : "Scope 3 results are unavailable right now."), response.status, code)
  }
  const { decodeScope3Results } = await import("./scope3-results-decode")
  actor.signal?.throwIfAborted()
  return decodeScope3Results(value, companyId)
}

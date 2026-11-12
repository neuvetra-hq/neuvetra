// Round 3 (EN-9): the package's public exports, never its source paths.
import { scope3ReportDraft, scope3ReportingYearOf, scope3TextChunks, SCOPE3_CAPACITY_TEXT, type CompanySetupView, type Scope3CsvLabels, type Scope3ReportApproveRequest, type Scope3ReportPrepareCall, type Scope3ReportPrevious, type Scope3ReportVersionDetail, type Scope3ReportVersionSummary } from "@neuvetra/database"
import type { AuthenticatedUser } from "../lib/auth"
import { hasExactKeys, readScope3JsonBody, scope3BusyResponse, scope3CollectGarbage, scope3RespondRetry, scope3RoutePrelude, Scope3RouteProblem, SCOPE3_UUID, SCOPE3_UUID_SOURCE } from "./scope3-route-helpers"
import { MAX_SCOPE3_LINES, SCOPE3_BUDGET_WARNING, SCOPE3_FORMULA_WARNING, type Scope3ResultsRunner } from "./scope3-results-routes"

/**
 * Frozen Scope 3 report versions (Scope 3 completion I-10; Claude, 30 October 2026; DESIGN 3.7, 7.4, A16, A31;
 * assurance-ux M8). Per company and reporting year (the current setup version's):
 * - GET  /workspace/:id/scope3/reports                       every version of the year with its approval (who, when, why);
 * - POST /workspace/:id/scope3/reports                       prepares the next version (owner or admin): the server runs the
 *        engine-backed Scope 3 results exactly as /results/scope3 does, builds the report document (results, assertion,
 *        base-year statement, change log against the previous approved version) and the CSV with the web's own labels, and
 *        stores both texts with their SHA-256 through 0030's RPC. A reason is required after the first version. Idempotent
 *        by key: a retried request replays the stored version without recalculating;
 * - GET  /workspace/:id/scope3/reports/:versionId            one version with its exact stored report and CSV text;
 * - POST /workspace/:id/scope3/reports/:versionId/approval   approves (owner or admin) bound to the report SHA-256 the
 *        approver saw: any other hash is refused (409). Self-approval is allowed, recorded and listed.
 * Round 2 (owner decision 7, ENG-11, ENG-14, decision 10): the approval body is exactly `{ reportSha256,
 * acknowledgeOpenIssues, confirmSelfApproval }`: a version whose frozen results have open issues needs
 * `acknowledgeOpenIssues: true` (409 `open_issues_not_acknowledged`), a self-approval `confirmSelfApproval: true` (409
 * `self_approval_not_confirmed`); 0030 enforces both again and stores them. Preparing is always allowed. A prepare whose
 * results changed before they were stored is refused (409 `records_changed`, 0030's 40001); a report over 0030's size
 * limit is refused before any call (413 `report_too_large`). Every JSON write requires `application/json` (415).
 * Nothing is calculated here: the frozen figures are the results route's own. Approved bytes never change (0030 refuses
 * every update and delete). The staging server refuses every /workspace/:id/scope3/... route below schema 30 before any SQL.
 */
export const SCOPE3_REPORTS_PROFILE = "neuvetra.scope3-reports.v1" as const
export interface Scope3ReportsResponse {
  profile: typeof SCOPE3_REPORTS_PROFILE; companyId: string; canManage: boolean; actorId: string
  setupVersionId: string | null; reportingYear: number | null; versions: Scope3ReportVersionSummary[]
}
export interface Scope3ReportVersionResponse { profile: typeof SCOPE3_REPORTS_PROFILE; version: Scope3ReportVersionSummary; reportText: string; csvText: string }
export interface Scope3ReportSaveResponse { profile: typeof SCOPE3_REPORTS_PROFILE; version: Scope3ReportVersionSummary; replayed: boolean }

export interface Scope3ReportRouteDatabase {
  findCompanySetup(userId: string, companyId: string): Promise<CompanySetupView | null>
  findScope3ReportVersions(userId: string, companyId: string, reportingYear: number): Promise<Scope3ReportVersionSummary[]>
  findScope3ReportVersion(userId: string, companyId: string, versionId: string): Promise<Scope3ReportVersionDetail | null>
  findLatestApprovedScope3Report(userId: string, companyId: string, reportingYear: number): Promise<Scope3ReportPrevious | null>
  findScope3ReportRequest(userId: string, companyId: string, idempotencyKey: string): Promise<{ actorId: string; versionId: string } | null>
  /** Round 3 (owner decision 6): the small request plus both texts as separate text parameters. */
  prepareScope3Report(userId: string, companyId: string, call: Scope3ReportPrepareCall): Promise<{ version: Scope3ReportVersionSummary; replayed: boolean }>
  approveScope3Report(userId: string, companyId: string, input: Scope3ReportApproveRequest): Promise<{ version: Scope3ReportVersionSummary; replayed: boolean }>
}

const ROUTE = new RegExp(`^/workspace/(${SCOPE3_UUID_SOURCE})/scope3/reports(?:/(${SCOPE3_UUID_SOURCE})(/approval)?)?$`, "i")
const UUID = SCOPE3_UUID
const NOT_FOUND = { error: "Scope 3 report not found." }
const MAX_BODY_BYTES = 10_000
const exactKeys = hasExactKeys
const invalid = (message: string) => Object.assign(new Error(message), { code: "22023" })

/**
 * Round 3 (owner decision 6): at most one report prepare per API instance at a time. Preparing at the line cap builds two
 * texts of up to about 80 MB each from a results run; two at once would double the peak (decision 6's budget is for one).
 * A second prepare is refused at once with 503 `report_prepare_busy` and Retry-After, before any results run.
 */
export interface Scope3PrepareGate { tryAcquire(): boolean; release(): void }
export function createScope3PrepareGate(): Scope3PrepareGate {
  let busy = false
  return { tryAcquire: () => (busy ? false : (busy = true)), release: () => { busy = false } }
}
export const SCOPE3_REPORT_PREPARE_RETRY_SECONDS = 30

/**
 * Round 3 (owner decision 6): a stored version as JSON, streamed in pieces of at most 1,048,576 characters, byte for byte
 * `JSON.stringify(body)`, so opening a version at the line cap never builds a 160 MB JSON string or body in the API (round 2
 * measured 1.3 GB for one open). Pieces never split a surrogate pair, so each piece escapes exactly as in the whole.
 */
export function scope3ReportVersionResponse(body: Scope3ReportVersionResponse): Response {
  const encoder = new TextEncoder()
  function* pieces() {
    yield `{"profile":${JSON.stringify(body.profile)},"version":${JSON.stringify(body.version)},"reportText":"`
    for (const piece of scope3TextChunks(body.reportText, 1_048_576)) yield JSON.stringify(piece).slice(1, -1)
    yield '","csvText":"'
    for (const piece of scope3TextChunks(body.csvText, 1_048_576)) yield JSON.stringify(piece).slice(1, -1)
    yield '"}'
  }
  const it = pieces()
  let pulls = 0
  const stream = new ReadableStream<Uint8Array>({ pull(controller) {
    // Reclaim consumed database and transfer buffers while the exact frozen texts continue streaming.
    if (pulls++ % 16 === 0) scope3CollectGarbage()
    const next = it.next(); if (next.done) controller.close(); else controller.enqueue(encoder.encode(next.value))
  } })
  return new Response(stream, { status: 200, headers: { "content-type": "application/json;charset=utf-8", "cache-control": "no-store" } })
}


/** Round 2 (owner decision 7): the approval body, exactly `{ reportSha256, acknowledgeOpenIssues, confirmSelfApproval }`. */
function approvalBody(value: unknown): { reportSha256: string; acknowledgeOpenIssues: boolean; confirmSelfApproval: boolean } {
  if (!exactKeys(value, ["reportSha256", "acknowledgeOpenIssues", "confirmSelfApproval"])) throw invalid("Invalid Scope 3 report approval.")
  const v = value as Record<string, unknown>
  if (typeof v.reportSha256 !== "string" || !/^[0-9a-f]{64}$/.test(v.reportSha256) || typeof v.acknowledgeOpenIssues !== "boolean" || typeof v.confirmSelfApproval !== "boolean") throw invalid("Invalid Scope 3 report approval.")
  return { reportSha256: v.reportSha256, acknowledgeOpenIssues: v.acknowledgeOpenIssues, confirmSelfApproval: v.confirmSelfApproval }
}

/**
 * Bug hunt (PR 22, 1 November 2026): what 0030 can't store in a reason: U+0000 (PostgreSQL text and jsonb refuse it, 22P05),
 * the other control characters except tab, line feed and carriage return (scope3_assert_text, 22023) and a lone surrogate
 * (jsonb, 22P02). Refused before any results run, so a reason that can never be saved costs no prepare and is never a 503.
 */
const UNSTORABLE_REASON = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]|\p{Cs}/u
export const SCOPE3_REPORT_REASON_UNSTORABLE = "The reason contains a control character that can't be saved. Remove it and try again."
/** The route's own refusals whose sentence is shown as is (everything else invalid is the generic sentence). */
const SHOWN_REFUSALS = ["Say why", SCOPE3_REPORT_REASON_UNSTORABLE]

/** The prepare request body: exactly `{ idempotencyKey, expectedRevision, reason }`; a reason of 3+ characters after the first version. */
function prepareBody(value: unknown): { idempotencyKey: string; expectedRevision: number; reason: string | null } {
  if (!exactKeys(value, ["idempotencyKey", "expectedRevision", "reason"])) throw invalid("Invalid Scope 3 report request.")
  const v = value as Record<string, unknown>
  if (typeof v.idempotencyKey !== "string" || !UUID.test(v.idempotencyKey) || !Number.isSafeInteger(v.expectedRevision) || (v.expectedRevision as number) < 0 || (v.expectedRevision as number) > 999) throw invalid("Invalid Scope 3 report request.")
  if (!(v.reason === null || (typeof v.reason === "string" && v.reason.length <= 2000))) throw invalid("Invalid Scope 3 report reason.")
  if (typeof v.reason === "string" && UNSTORABLE_REASON.test(v.reason)) throw invalid(SCOPE3_REPORT_REASON_UNSTORABLE)
  const reason = v.reason as string | null
  if ((v.expectedRevision as number) > 0 && (reason ?? "").trim().length < 3) throw invalid("Say why this version replaces the earlier one (at least 3 characters).")
  return { idempotencyKey: v.idempotencyKey, expectedRevision: v.expectedRevision as number, reason }
}

export function createScope3ReportRoutes(deps: {
  database: Scope3ReportRouteDatabase
  /** The same runner as /results/scope3 (createScope3ResultsRunner): the frozen figures are exactly the route's. */
  results: Scope3ResultsRunner
  validateUser: (token: string) => Promise<AuthenticatedUser | null>
  origin: string
  /** The pinned Scope 3 engine; results naming another engine are never frozen. */
  engineSha256: string
  /** The CSV label functions (`SCOPE3_CSV_LABELS` of `@neuvetra/database`, which the web re-exports), so the stored CSV is the web's bytes. */
  labels: Scope3CsvLabels
  now?: () => Date
  /** Round 2: the size limit of each stored text (default 0030's); tests lower it to reach the refusal. */
  maxReportTextBytes?: number
  /** Round 3 (owner decision 6): the instance's one-prepare-at-a-time gate (a new one per route by default). */
  prepareGate?: Scope3PrepareGate
}) {
  const now = deps.now ?? (() => new Date())
  const gate = deps.prepareGate ?? createScope3PrepareGate()
  return async (request: Request): Promise<Response> => {
    const respond = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
    const match = ROUTE.exec(new URL(request.url).pathname)
    if (!match) return respond(404, NOT_FOUND)
    const companyId = match[1]!.toLowerCase(), versionId = match[2]?.toLowerCase() ?? null, approval = !!match[3]
    const prelude = await scope3RoutePrelude(request, deps, approval ? ["POST"] : versionId ? ["GET"] : ["GET", "POST"])
    if ("response" in prelude) return prelude.response
    const actor: AuthenticatedUser = prelude.actor
    const readBody = () => readScope3JsonBody(request, MAX_BODY_BYTES, "Invalid Scope 3 report JSON.")
    try {
      const setup = await deps.database.findCompanySetup(actor.id, companyId)
      if (!setup) return respond(404, NOT_FOUND)
      const current = setup.currentVersion
      const reportingYear = scope3ReportingYearOf(current?.setup.reportingPeriod.endExclusive ?? null)

      if (request.method === "GET" && !versionId) {
        const versions = reportingYear === null ? [] : await deps.database.findScope3ReportVersions(actor.id, companyId, reportingYear)
        const body: Scope3ReportsResponse = { profile: SCOPE3_REPORTS_PROFILE, companyId, canManage: setup.canManage, actorId: actor.id, setupVersionId: current?.id ?? null, reportingYear, versions }
        return respond(200, body)
      }
      if (request.method === "GET") {
        const detail = await deps.database.findScope3ReportVersion(actor.id, companyId, versionId!)
        if (!detail) return respond(404, NOT_FOUND)
        const body: Scope3ReportVersionResponse = { profile: SCOPE3_REPORTS_PROFILE, version: detail.version, reportText: detail.reportText, csvText: detail.csvText }
        return scope3ReportVersionResponse(body)
      }
      if (!setup.canManage) return respond(403, { error: "Forbidden." })

      if (approval) {
        const body = approvalBody(await readBody())
        // Round 2 (owner decision 7): the version's own readiness and preparer decide what the approval must state; 0030
        // checks the same again under its lock (23514) and stores the acknowledgement and the confirmation.
        // The summary only (never the texts): this year's versions; a version of another year is checked by 0030 alone.
        const yearVersions = reportingYear === null ? [] : await deps.database.findScope3ReportVersions(actor.id, companyId, reportingYear)
        const stored = yearVersions.find(item => item.id === versionId)
        if (stored && !stored.approval) {
          // BF-05 (BL-03): approval signs off the current figures, so a revision that a later one replaces cannot be approved
          // (checked first: the hash, open-issue and self-approval answers are about a version nobody should approve). An approval
          // recorded before the newer revision existed is not touched, and its repeat is still a replay (it has an approval).
          if (yearVersions.some(item => item.revision > stored.revision)) return respond(409, { code: "version_superseded", error: "A newer version of this report exists. Review and approve the newest version." })
          if (stored.reportSha256 !== body.reportSha256) return respond(409, { code: "report_hash_changed", error: "The report you reviewed is not this stored version. Reload the version, review it again and approve what you see." })
          if (stored.openIssues.length > 0 && !body.acknowledgeOpenIssues) return respond(409, { code: "open_issues_not_acknowledged", openIssues: stored.openIssues, error: "This version has open issues. Review them and approve with open issues acknowledged, or prepare a new version once they are resolved." })
          if (stored.createdBy === actor.id && !body.confirmSelfApproval) return respond(409, { code: "self_approval_not_confirmed", error: "You prepared this version. Confirm the self-approval explicitly; it is recorded and printed as a control exception." })
        }
        try {
          const saved = await deps.database.approveScope3Report(actor.id, companyId, { versionId: versionId!, ...body })
          const out: Scope3ReportSaveResponse = { profile: SCOPE3_REPORTS_PROFILE, version: saved.version, replayed: saved.replayed }
          return respond(saved.replayed ? 200 : 201, out)
        } catch (error) {
          const code = (error as { code?: string }).code
          if (code === "23503") return respond(404, NOT_FOUND)
          if (code === "23505") return respond(409, { code: "report_hash_changed", error: "The report you reviewed is not this stored version. Reload the version, review it again and approve what you see." })
          if (code === "23514") return respond(409, { code: "approval_requirements", error: "This approval needs the open issues acknowledged and, for your own version, the self-approval confirmed." })
          throw error
        }
      }

      if (!current || reportingYear === null) return respond(409, { code: "setup_required", error: "Save company setup with a reporting period before preparing a Scope 3 report." })
      const input = prepareBody(await readBody())
      // A retried request (same key) replays the version it stored, before anything is recalculated.
      const replay = async () => {
        const prior = await deps.database.findScope3ReportRequest(actor.id, companyId, input.idempotencyKey)
        if (!prior) return null
        const detail = prior.actorId === actor.id ? await deps.database.findScope3ReportVersion(actor.id, companyId, prior.versionId) : null
        if (!detail || detail.version.reason !== input.reason || detail.version.revision !== input.expectedRevision + 1 || detail.version.reportingYear !== reportingYear || detail.version.createdBy !== actor.id)
          return respond(409, { code: "idempotency_conflict", error: "This request key was already used for a different report request. Reload and try again." })
        const out: Scope3ReportSaveResponse = { profile: SCOPE3_REPORTS_PROFILE, version: detail.version, replayed: true }
        return respond(200, out)
      }
      const replayed = await replay()
      if (replayed) return replayed
      // The expected revision must be the year's latest (0030 checks it again when storing); a stale one is refused before any work.
      const changed = () => respond(409, { code: "report_changed", error: "A newer Scope 3 report version was prepared. Reload the versions and try again." })
      if ((await deps.database.findScope3ReportVersions(actor.id, companyId, reportingYear)).length !== input.expectedRevision) return changed()

      // Round 3 (owner decision 6): one prepare per API instance at a time; others are told to retry.
      if (!gate.tryAcquire()) return scope3RespondRetry(503, { code: "report_prepare_busy", error: "Another Scope 3 report is being prepared on this server. Try again in a minute." }, SCOPE3_REPORT_PREPARE_RETRY_SECONDS)
      try {
        // Round 3 (owner decision 6): the previous approved version first, reduced to its change-log basis, so its 83 MB
        // text and parse are never held together with the new results and texts.
        const previous = await deps.database.findLatestApprovedScope3Report(actor.id, companyId, reportingYear)
        // The results, the document and its texts live only inside `draftFrom`, so once the texts are built the results
        // and the document are garbage while the texts are stored; only the small request and the two texts leave it.
        const draftFrom = async (): Promise<Response | Scope3ReportPrepareCall> => {
          let results: Awaited<ReturnType<Scope3ResultsRunner>>
          try { results = await deps.results(actor.id, companyId) } catch (error) {
            // Round 3 (owner decision 7, EN-3): results over the line budget (the runner's 54000) are the line-budget error here too.
            if ((error as { code?: string }).code === "54000") return respond(422, { code: "line_budget_exceeded", error: SCOPE3_CAPACITY_TEXT.resultsOverBudget(MAX_SCOPE3_LINES) })
            throw error
          }
          if (!results) return respond(404, NOT_FOUND)
          // Only results that are complete right now are frozen: no line the engine couldn't answer, no budget overrun, formulas read.
          if (results.records.some(row => row.outcome === "unavailable") || results.warnings.some(warning => warning === SCOPE3_BUDGET_WARNING || warning === SCOPE3_FORMULA_WARNING))
            return respond(409, { code: "results_not_ready", error: "Some Scope 3 lines couldn’t be calculated just now, so no report version was prepared. Try again shortly." })
          if (results.setup?.revision !== current.revision) return respond(409, { code: "reload_required", error: "Company setup changed while the report was prepared. Reload and try again." })
          // Release the results runner's temporary buffers before building the report and CSV texts.
          scope3CollectGarbage()
          try {
            const draft = scope3ReportDraft({
              results, previous, reportingYear, expectedRevision: input.expectedRevision, reason: input.reason, idempotencyKey: input.idempotencyKey, setupVersionId: current.id,
              consolidationApproach: current.setup.boundary.approach, preparedBy: actor.id, preparedAt: now().toISOString(), engineSha256: deps.engineSha256, labels: deps.labels,
              ...(deps.maxReportTextBytes === undefined ? {} : { maxTextBytes: deps.maxReportTextBytes }), betweenPhases: scope3CollectGarbage,
            })
            return { request: draft.request, reportText: draft.reportText, csvText: draft.csvText }
          } catch (error) {
            // Round 2 (owner decision 10, ENG-3): larger than 0030 stores; refused before any call, with its own code.
            if ((error as { code?: string }).code === "report_too_large") return respond(413, { code: "report_too_large", error: SCOPE3_CAPACITY_TEXT.reportTooLarge })
            throw error
          }
        }
        scope3CollectGarbage()
        const prepare = await draftFrom()
        if (prepare instanceof Response) return prepare
        // The results and the document are garbage now; only the two texts and the small request remain.
        scope3CollectGarbage()
        try {
          const saved = await deps.database.prepareScope3Report(actor.id, companyId, prepare)
          const out: Scope3ReportSaveResponse = { profile: SCOPE3_REPORTS_PROFILE, version: saved.version, replayed: saved.replayed }
          return respond(saved.replayed ? 200 : 201, out)
        } catch (error) {
          // Round 2 (ENG-11), round 3 (EN-5): a record, an assessment, an evidence file's status or the latest approved version
          // changed after the results were read (0030's 40001).
          if ((error as { code?: string }).code === "40001") return respond(409, { code: "records_changed", error: "Records, assessments or approvals changed while the report was prepared, so it was not stored. Prepare it again." })
          if ((error as { code?: string }).code !== "23505") throw error
          // A concurrent retry of the same request may have stored it first; otherwise a newer version exists.
          return (await replay()) ?? changed()
        }
      } finally { gate.release() }
    } catch (error) {
      if (error instanceof Scope3RouteProblem) return respond(error.status, error.body)
      // Round 3 (EN-1): lock and statement timeouts are specific, retryable refusals (nothing was saved).
      const busy = scope3BusyResponse(error)
      if (busy) return busy
      const code = (error as { code?: string }).code
      if (code === "42501") return respond(404, NOT_FOUND)
      // Round 3 (owner decision 7): the line budget, as everywhere.
      if (code === "54N30") return respond(422, { code: "line_budget_exceeded", error: SCOPE3_CAPACITY_TEXT.resultsOverBudget(MAX_SCOPE3_LINES) })
      if (code === "23503") return respond(409, { code: "reload_required", error: "Company setup or the records changed while the report was prepared. Reload and try again." })
      if (code === "23505" || code === "40001") return respond(409, { code: "report_changed", error: "A newer Scope 3 report version was prepared. Reload the versions and try again." })
      if (code === "54000") return respond(422, { code: "history_limit", error: "This Scope 3 report is too large or its history capacity is reached." })
      // Bug hunt (PR 22): 22P05 and 22021 (text PostgreSQL can't store) are invalid input too, never a retryable outage.
      if (["22023", "22P02", "22P05", "22021", "22007", "22008", "22003", "23514", "23502"].includes(code ?? "")) return respond(422, { error: SHOWN_REFUSALS.some(start => (error as Error).message.startsWith(start)) ? (error as Error).message : "Invalid or unsupported Scope 3 report request." })
      return respond(503, { error: "Scope 3 report versions could not be read or saved. Try again shortly." })
    }
  }
}

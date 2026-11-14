import { createHash } from "node:crypto"
import {
  type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView,
  scope3ReportingYearOf, planScope3Calculation, planScope3SupersessionClaimants, planScope3SupersessionMatches, scope3SpendMappingKeyInput, type Scope3CollectionVersion,
  type PurchaseSpendCollectionPayload, type Scope3SpendLineRef, parseScope3SpendCsv, SCOPE3_SPEND_IMPORT_MAX_BYTES,
  type Scope3SpendImportProblem, type Scope3SpendParse, scope3SpendConversionOf, scope3SpendNotesWithoutConversion,
  type Scope3SpendConversion, type Scope3SpendImportRecord, type Scope3SpendMappingRecord, SCOPE3_CAPACITY_TEXT,
} from "@neuvetra/database"
import type { AuthenticatedUser } from "../lib/auth"
// Round 2b integration (ENG-14): the shared Scope 3 route helpers (prelude, body readers, UUID, responses).
import { readScope3Body, readScope3JsonBody, scope3BusyResponse, scope3Respond, scope3RoutePrelude, Scope3RouteProblem, SCOPE3_UUID, SCOPE3_UUID_SOURCE } from "./scope3-route-helpers"
// Round 2, lane B (owner decision 10): the active-line budget check before an import saves anything.
import { MAX_SCOPE3_LINES, scope3GridLossesIncluded, scope3LineBudget, scope3LineCountRule, scope3StoredLineCount, type Scope3LineCountRule } from "./scope3-results-routes"

/**
 * Spend CSV import (Scope 3 completion I-09; Claude, 30 October 2026; DESIGN §3.6, §7.3, D9, A11, A29):
 * - GET  /workspace/:id/scope3/spend-imports         imports (reconciliation per currency), remembered mappings, and every
 *                                                     imported spend line with the adapter's plan (unmatched, duplicate and
 *                                                     supersession queues are read from these);
 * - POST /workspace/:id/scope3/spend-imports?evidenceId=&locationId=   body: the CSV bytes (text/csv, ≤ 2 MB), which must be
 *                                                     the uploaded evidence file (same SHA-256); one transaction; the same
 *                                                     bytes replay (200, `replayed`), a new file saves (201);
 * - POST /workspace/:id/scope3/spend-mappings        saves a mapping (owner or admin) and corrects its group;
 * - POST /workspace/:id/scope3/spend-imports/:importId/withdrawal   round 3 (owner decision 7): body exactly `{ reason }`
 *                                                     (application/json); withdraws every active line of the import in one
 *                                                     set-based statement (owner or admin); 201 `{ importId, withdrawn,
 *                                                     alreadyWithdrawn, message }`; 404 for another company's import.
 * - POST /workspace/:id/scope3/spend-currency-conversions   round 3 (PR-11): one rate (US dollars per unit), its source and
 *                                                     date for one currency; every held imported line in that currency is
 *                                                     converted in one transaction (owner or admin).
 * Same authentication and membership pattern as the collection and assessment routes; the staging server refuses
 * /workspace/:id/scope3/... below schema 30 before any SQL. Nothing here calculates emissions: lines are planned by the
 * shared adapter (calculate or hold, with reasons) exactly as the results route plans them.
 */
export const SCOPE3_SPEND_IMPORTS_PROFILE = "neuvetra.scope3-spend-imports.v1" as const

/** One imported spend line as the queues read it (current version), with the adapter's plan. */
export interface Scope3SpendLineView {
  recordId: string; versionId: string; revision: number; importId: string; importRow: number; sourceId: string; state: "active" | "withdrawn"
  amount: string; currency: string; category: number; naicsCode: string | null; marginChoice: string; mappingSource: string; mappingKeySha256: string
  glAccount: string; vendor: string; description: string; lineDate: string | null; possibleDuplicateOf: Scope3SpendLineRef | null; duplicateConfirmedDistinct: boolean
  categoryConfirmed: boolean; activityOverlap: string
  plan: { action: "calculate" | "hold"; status: string | null; reasons: string[] }
  supersededBy: string | null
  /** Round 2 UX-1: the GL account name when it differs from the description (the import keeps it in the notes); else empty. */
  glDescription: string
  /** Round 3 lane C (PR-11): the line's conversion to US dollars (original amount, rate, its source and date), or null. */
  conversion: Scope3SpendConversion | null
}
/** Round 2 ACC-16: a spend line a supplier or partner record replaces, with its amount as recorded (never counted). */
export interface Scope3SpendSupersededView { spendRecordId: string; supersededBy: string; supplierName: string; kind: string; spendSourceId: string; spendDescription: string; spendAmount: string; spendCurrency: string; vendorKeyMatch?: true }
/** Round 2 ACC-16: the record that replaces spend lines, with its own figure exactly as entered (the engine calculates it). */
export interface Scope3SpendSupersederView {
  recordId: string; kind: string; sourceId: string; name: string; category: number; quantity: string; unit: string
  basis: string | null; factorValue: string | null; factorUnit: string | null; allocationNumerator: string | null; allocationDenominator: string | null
}
export interface Scope3SpendImportsResponse {
  profile: typeof SCOPE3_SPEND_IMPORTS_PROFILE
  companyId: string
  canManage: boolean
  setupVersionId: string | null
  reportingYear: number | null
  reportingPeriod: { start: string; endExclusive: string } | null
  /** Locations the current setup includes (DESIGN A11: an import is at one of them). */
  locations: Array<{ id: string; name: string }>
  imports: Scope3SpendImportRecord[]
  mappings: Scope3SpendMappingRecord[]
  lines: Scope3SpendLineView[]
  /** Spend lines (imported or entered) replaced by a supplier or partner record, never counted. */
  superseded: Scope3SpendSupersededView[]
  /** Round 2 ACC-16: the records that replace them, each with its figure as entered (supersession reconciliation). */
  superseders: Scope3SpendSupersederView[]
}
export interface Scope3SpendImportResponse {
  profile: typeof SCOPE3_SPEND_IMPORTS_PROFILE; import: Scope3SpendImportRecord; replayed: boolean; saved: number
  /** Held lines of this import by reason (a line may have several reasons); `calculable` lines go to the engine. */
  holds: Record<string, number>; calculable: number
  lines: Scope3SpendLineView[]
}
export interface Scope3SpendConversionResponse { profile: typeof SCOPE3_SPEND_IMPORTS_PROFILE; converted: Array<{ recordId: string; sourceId: string; versionId: string; revision: number; from: string; usd: string }>; skipped: Array<{ recordId: string; sourceId: string; reason: string }> }
export interface Scope3SpendMappingResponse { profile: typeof SCOPE3_SPEND_IMPORTS_PROFILE; mapping: Scope3SpendMappingRecord; corrected: Array<{ recordId: string; versionId: string; revision: number }>; unchanged: number }
/** Round 3 (owner decision 7): the answer to "withdraw this import". */
export interface Scope3SpendImportWithdrawalResponse { profile: typeof SCOPE3_SPEND_IMPORTS_PROFILE; importId: string; withdrawn: number; alreadyWithdrawn: number; message: string }

export interface Scope3SpendImportRouteDatabase {
  findCompanySetup(userId: string, companyId: string): Promise<CompanySetupView | null>
  findCollectionContext(userId: string, companyId: string): Promise<CollectionContext | null>
  findCollectionActivities(userId: string, companyId: string): Promise<CollectionActivityRecord[]>
  findCollectionEvidence(userId: string, companyId: string): Promise<CollectionEvidenceMetadata[]>
  findScope3SpendImports(userId: string, companyId: string): Promise<Scope3SpendImportRecord[]>
  findScope3SpendMappings(userId: string, companyId: string): Promise<Scope3SpendMappingRecord[]>
  importScope3Spend(userId: string, companyId: string, input: { parsed: Scope3SpendParse; fileSha256: string; evidenceId: string; locationId: string }): Promise<{ import: Scope3SpendImportRecord; replayed: boolean; saved: number }>
  saveScope3SpendMapping(userId: string, companyId: string, input: unknown): Promise<{ mapping: Scope3SpendMappingRecord; corrected: Array<{ recordId: string; versionId: string; revision: number }>; unchanged: number }>
  /** Round 3 (owner decision 7): withdraws every active line of one import (one set-based statement). */
  withdrawScope3SpendImport(userId: string, companyId: string, importId: string, input: unknown): Promise<{ importId: string; withdrawn: number; alreadyWithdrawn: number }>
  /**
   * Round 3 (for lane C's bulk actions, e.g. one currency conversion over every held line in a currency): corrects imported
   * spend lines in bulk, one set-based statement (owner or admin). Each correction: the line, the head version it was read at
   * and its next activity (same kind, import ID and row, source ID). Optional so route stubs need not implement it.
   */
  saveScope3SpendCorrections?(userId: string, companyId: string, input: { reason: string; corrections: Array<{ recordId: string; expectedVersionId: string; activity: unknown }> }): Promise<{ corrected: number; unchanged: number }>
  /** Round 3 lane C (PR-11): one transaction (the existing record-save RPC per line). */
  convertScope3SpendCurrency(userId: string, companyId: string, input: unknown): Promise<Omit<Scope3SpendConversionResponse, "profile">>
}

const ROUTE = new RegExp(`^/workspace/(${SCOPE3_UUID_SOURCE})/scope3/(spend-imports|spend-mappings|spend-currency-conversions)(?:/(${SCOPE3_UUID_SOURCE})/(withdrawal))?$`, "i")
const NOT_FOUND = { error: "Scope 3 spend imports not found." }
const MAX_MAPPING_BYTES = 20_000
const MAX_CONVERSION_BYTES = 2_000
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

/** The imported spend lines (current versions) with the adapter's plan: the route's own reporting period and supersession. */
const GL_NOTE = /^GL description: (.{1,200})$/s
export function scope3SpendLineViews(records: readonly CollectionActivityRecord[], context: CollectionContext, evidence: CollectionEvidenceMetadata[], setup: CompanySetupView | null): { lines: Scope3SpendLineView[]; superseded: Scope3SpendImportsResponse["superseded"]; superseders: Scope3SpendImportsResponse["superseders"] } {
  const period = setup?.currentVersion?.setup.reportingPeriod
  const reportingPeriod = period?.start && period.endExclusive ? { start: period.start, endExclusive: period.endExclusive } : null
  const scope3 = records.filter(record => record.kind === "purchase_spend" || record.kind === "purchase_supplier" || record.kind === "partner_reported")
  const versions = scope3.map(record => record.currentVersion as unknown as Scope3CollectionVersion)
  // BF-02b (b): the pre-pass map is provisional (BF-02). A claimant the adapter itself holds is certainly not counted, so a
  // line whose every claimant is held is shown as Results shows it (held, `replacing_record_not_counted`), never as replaced;
  // a line with a claimant that can calculate is shown as replaced by it (Results confirms it after the engine run). Display only.
  const claimants = planScope3SupersessionClaimants(versions, context, { reportingPeriod, sha256 })
  // BF-12 (QA F1): how each line matches each claimant, so a line shown as replaced only by the vendor key says so.
  const matches = planScope3SupersessionMatches(versions, context, { reportingPeriod, sha256 })
  const adapterHeld = new Set(versions.filter(v => (v.activity.kind === "purchase_supplier" || v.activity.kind === "partner_reported")
    && planScope3Calculation(v, context, evidence, { reportingPeriod }).action === "hold").map(v => v.recordId))
  const supersession = new Map<string, string>(), heldFor = new Map<string, string>()
  for (const [line, ids] of claimants) {
    const counted = ids.find(id => !adapterHeld.has(id))
    if (counted !== undefined) supersession.set(line, counted)
    else heldFor.set(line, ids[0]!)
  }
  const byId = new Map(records.map(record => [record.id, record]))
  const lines: Scope3SpendLineView[] = []
  for (const record of scope3) {
    const version = record.currentVersion, a = version.activity
    if (a.kind !== "purchase_spend") continue
    const p = a.payload as PurchaseSpendCollectionPayload
    if (p.importId === null || p.importRow === null) continue
    const planned = planScope3Calculation(version as unknown as Scope3CollectionVersion, context, evidence, { reportingPeriod, supersession })
    const plan = heldFor.has(record.id) && planned.status !== "withdrawn" && planned.status !== "excluded" ? { ...planned, action: "hold" as const, status: "input_needed" as const, reasons: ["replacing_record_not_counted"] } : planned
    lines.push({
      recordId: record.id, versionId: version.id, revision: version.revision, importId: p.importId, importRow: p.importRow, sourceId: a.sourceId, state: a.state,
      amount: a.quantity.originalValue, currency: a.quantity.originalUnit, category: p.category, naicsCode: p.naicsCode, marginChoice: p.marginChoice, mappingSource: p.mappingSource,
      mappingKeySha256: sha256(scope3SpendMappingKeyInput(p)), glAccount: p.glAccount, vendor: p.supplierName, description: p.description, lineDate: p.lineDate,
      possibleDuplicateOf: p.possibleDuplicateOf, duplicateConfirmedDistinct: p.duplicateConfirmedDistinct, categoryConfirmed: p.categoryConfirmed, activityOverlap: p.activityOverlap,
      plan: { action: plan.action, status: plan.status, reasons: [...plan.reasons] }, supersededBy: supersession.get(record.id) ?? null,
      // The import writes "GL description: …" only when it differs from the description (else the description is it).
      // Round 3 lane C: a conversion line (PR-11) is read apart, so the GL note is still exactly the import's.
      glDescription: GL_NOTE.exec(scope3SpendNotesWithoutConversion(a.notes))?.[1] ?? "", conversion: scope3SpendConversionOf(a.notes),
    })
  }
  lines.sort((x, y) => x.importId.localeCompare(y.importId) || x.importRow - y.importRow)
  const superseded = [...supersession.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([spendRecordId, supersededBy]) => {
    const by = byId.get(supersededBy)!.currentVersion.activity, spend = byId.get(spendRecordId)!.currentVersion.activity
    const sp = spend.payload as PurchaseSpendCollectionPayload
    return { spendRecordId, supersededBy, supplierName: (by.payload as { supersedesSpend: { supplierName: string } }).supersedesSpend.supplierName, kind: by.kind,
      spendSourceId: spend.sourceId, spendDescription: sp.description, spendAmount: spend.quantity.originalValue, spendCurrency: spend.quantity.originalUnit,
      // BF-12: present (true) only for a line the named record matches only by the vendor key, so other responses are unchanged.
      ...(matches.get(spendRecordId)?.get(supersededBy)?.match === "vendor_key" ? { vendorKeyMatch: true as const } : {}) }
  })
  // Round 2 ACC-16: each replacing record once, with its own figure as entered, so the screen can set it beside the spend it replaces.
  const superseders = [...new Set(superseded.map(entry => entry.supersededBy))].sort().map(recordId => {
    const a = byId.get(recordId)!.currentVersion.activity
    const p = a.payload as unknown as Record<string, unknown>
    const text = (key: string) => typeof p[key] === "string" ? p[key] as string : null
    return { recordId, kind: a.kind, sourceId: a.sourceId, name: text("supplierName") ?? text("counterpartyName") ?? "", category: p.category as number, quantity: a.quantity.originalValue, unit: a.quantity.originalUnit,
      basis: text("basis"), factorValue: text("factorValue"), factorUnit: text("factorUnit"), allocationNumerator: text("allocationNumerator"), allocationDenominator: text("allocationDenominator") }
  })
  return { lines, superseded, superseders }
}

/**
 * Bug hunt (PR 22, 1 November 2026): the company's active imported spend lines (only `importId`'s, when given) whose location
 * is not in the current setup version, which 0030's bulk spend writes refuse (23503).
 */
export async function scope3LinesAtRemovedLocations(database: Pick<Scope3SpendImportRouteDatabase, "findCompanySetup" | "findCollectionActivities">, actorId: string, companyId: string, importId: string | null): Promise<number> {
  const [setup, records] = await Promise.all([database.findCompanySetup(actorId, companyId), database.findCollectionActivities(actorId, companyId)])
  const locations = new Set((setup?.currentVersion?.setup.locations ?? []).map(location => location.id))
  return records.filter(record => {
    const a = record.currentVersion.activity
    if (record.kind !== "purchase_spend" || a.kind !== "purchase_spend" || a.state !== "active") return false
    const p = a.payload as PurchaseSpendCollectionPayload
    return p.importId !== null && (importId === null || p.importId === importId) && !locations.has(a.locationId)
  }).length
}

export function createScope3SpendImportRoutes(deps: { database: Scope3SpendImportRouteDatabase; validateUser: (token: string) => Promise<AuthenticatedUser | null>; origin: string
  /** BF-21: the database's schema version; from 32 the pre-check counts as 0032 does (stored Scope 3 records only). Absent: 0. */
  schemaVersion?: () => Promise<number> }) {
  return async (request: Request): Promise<Response> => {
    const respond = scope3Respond
    const url = new URL(request.url)
    const match = ROUTE.exec(url.pathname)
    if (!match) return respond(404, NOT_FOUND)
    const companyId = match[1]!.toLowerCase(), resource = match[2]!.toLowerCase(), withdrawImportId = match[4] ? match[3]!.toLowerCase() : null
    if (withdrawImportId !== null && resource !== "spend-imports") return respond(404, NOT_FOUND)
    // Round 2b integration (ENG-14): the shared prelude (origin 403, method 405, bearer 401/503), as the other Scope 3 routes.
    const prelude = await scope3RoutePrelude(request, deps, resource === "spend-imports" && withdrawImportId === null ? ["GET", "POST"] : ["POST"])
    if ("response" in prelude) return prelude.response
    const actor: AuthenticatedUser = prelude.actor
    let attemptedFileLines = 0
    let completedImport: Awaited<ReturnType<Scope3SpendImportRouteDatabase["importScope3Spend"]>> | null = null
    // BF-21: the count the database at this schema enforces (0030's below 32, 0032's from 32), read once per request.
    let rule: Scope3LineCountRule | null = null
    const lineRule = async () => rule ??= scope3LineCountRule(await (deps.schemaVersion?.() ?? Promise.resolve(0)))
    const capRefusal = (records: Parameters<typeof scope3LineBudget>[0], setup: Parameters<typeof scope3LineBudget>[1], counted: Scope3LineCountRule) => {
      const lineBudget = scope3LineBudget(records, setup, counted)
      // Below schema 32 exactly the answer before BF-21; from 32 the stored count, as the database counts it.
      return respond(409, { code: "line_budget_exceeded", lineBudget, fileLines: attemptedFileLines,
        error: counted === "stored" ? SCOPE3_CAPACITY_TEXT.storedLineBudgetExceeded(MAX_SCOPE3_LINES, scope3StoredLineCount(records, scope3GridLossesIncluded(setup)), attemptedFileLines)
          : SCOPE3_CAPACITY_TEXT.lineBudgetExceeded(lineBudget.max, lineBudget.used, attemptedFileLines) })
    }
    try {
      const setup = await deps.database.findCompanySetup(actor.id, companyId)
      if (!setup) return respond(404, NOT_FOUND)
      const current = setup.currentVersion
      const lineViews = async () => {
        const [context, records, evidence] = await Promise.all([deps.database.findCollectionContext(actor.id, companyId), deps.database.findCollectionActivities(actor.id, companyId), deps.database.findCollectionEvidence(actor.id, companyId)])
        if (!context) throw Object.assign(new Error("not found"), { code: "42501" })
        return scope3SpendLineViews(records, context, evidence, setup)
      }
      if (request.method === "GET") {
        const [imports, mappings, views] = await Promise.all([deps.database.findScope3SpendImports(actor.id, companyId), deps.database.findScope3SpendMappings(actor.id, companyId), lineViews()])
        const period = current?.setup.reportingPeriod
        const body: Scope3SpendImportsResponse = {
          profile: SCOPE3_SPEND_IMPORTS_PROFILE, companyId, canManage: setup.canManage, setupVersionId: current?.id ?? null,
          reportingYear: scope3ReportingYearOf(period?.endExclusive ?? null), reportingPeriod: period?.start && period.endExclusive ? { start: period.start, endExclusive: period.endExclusive } : null,
          locations: (current?.setup.locations ?? []).filter(location => location.inclusion === "included").map(location => ({ id: location.id, name: location.name })),
          imports, mappings, lines: views.lines, superseded: views.superseded, superseders: views.superseders,
        }
        return respond(200, body)
      }
      if (!setup.canManage) return respond(403, { error: "Forbidden." })
      if (withdrawImportId !== null) {
        // Round 3 (owner decision 7, EN-3): withdraw every active line of one import, in one set-based statement.
        const input = await readScope3JsonBody(request, MAX_MAPPING_BYTES, "Invalid Scope 3 spend import withdrawal JSON.")
        const done = await deps.database.withdrawScope3SpendImport(actor.id, companyId, withdrawImportId, input)
        const body: Scope3SpendImportWithdrawalResponse = { profile: SCOPE3_SPEND_IMPORTS_PROFILE, importId: done.importId, withdrawn: done.withdrawn, alreadyWithdrawn: done.alreadyWithdrawn, message: SCOPE3_CAPACITY_TEXT.importWithdrawn(done.withdrawn, done.alreadyWithdrawn) }
        return respond(201, body)
      }
      if (resource === "spend-currency-conversions") {
        const input = await readScope3JsonBody(request, MAX_CONVERSION_BYTES, "Invalid currency conversion JSON.")
        const done = await deps.database.convertScope3SpendCurrency(actor.id, companyId, input)
        const body: Scope3SpendConversionResponse = { profile: SCOPE3_SPEND_IMPORTS_PROFILE, converted: done.converted, skipped: done.skipped }
        return respond(201, body)
      }
      if (resource === "spend-mappings") {
        // The shared JSON reader: 415, 413 and 422 (strict UTF-8 JSON), as every Scope 3 JSON write.
        const input = await readScope3JsonBody(request, MAX_MAPPING_BYTES, "Invalid Scope 3 spend mapping JSON.")
        const saved = await deps.database.saveScope3SpendMapping(actor.id, companyId, input)
        const body: Scope3SpendMappingResponse = { profile: SCOPE3_SPEND_IMPORTS_PROFILE, mapping: saved.mapping, corrected: saved.corrected, unchanged: saved.unchanged }
        return respond(201, body)
      }
      // POST spend-imports: the CSV bytes, the uploaded evidence that holds them, and the setup location.
      const params = url.searchParams
      const evidenceId = params.get("evidenceId")?.toLowerCase() ?? "", locationId = params.get("locationId")?.toLowerCase() ?? ""
      if ([...params.keys()].sort().join("|") !== "evidenceId|locationId" || !SCOPE3_UUID.test(evidenceId) || !SCOPE3_UUID.test(locationId)) return respond(422, { error: "Name the uploaded file (evidenceId) and a setup location (locationId)." })
      if (!current || scope3ReportingYearOf(current.setup.reportingPeriod.endExclusive) === null) return respond(409, { code: "setup_required", error: "Save company setup with a reporting period before importing spend." })
      // Round 2b integration (ENG-14): the shared body reader, at the same step as the JSON writes (after the actor and the
      // setup are checked): text/csv only (415), at most 2 MB (413).
      const bytes = await readScope3Body(request, "text/csv", SCOPE3_SPEND_IMPORT_MAX_BYTES, { unsupported: "CSV content type required.", tooLarge: "The file is larger than 2 MB." })
      const period = current.setup.reportingPeriod
      const parsed = parseScope3SpendCsv(bytes, { period: period.start && period.endExclusive ? { start: period.start, endExclusive: period.endExclusive } : null })
      if (!parsed.ok) return respond(422, { code: "file_invalid", error: "The spend file has errors; nothing was imported.", problems: parsed.errors satisfies Scope3SpendImportProblem[] })
      attemptedFileLines = parsed.lines.length
      const fileSha256 = createHash("sha256").update(bytes).digest("hex")
      // Round 2, lane B (owner decision 10, ENG-2): a new file that would take the company past its active-line budget is
      // refused before anything is saved (withdrawn lines never count; a replay of the same bytes saves nothing, so it is
      // never refused). The body carries the budget and the file's line count.
      const [earlier, records] = await Promise.all([deps.database.findScope3SpendImports(actor.id, companyId), deps.database.findCollectionActivities(actor.id, companyId)])
      const counted = await lineRule()
      const budget = scope3LineBudget(records, setup, counted)
      if (!earlier.some(item => item.fileSha256 === fileSha256) && parsed.lines.length > budget.remaining)
        return capRefusal(records, setup, counted)
      const result = await deps.database.importScope3Spend(actor.id, companyId, { parsed, fileSha256, evidenceId, locationId })
      completedImport = result
      const ids = new Set(result.import.lines.map(line => line.recordId))
      const lines = (await lineViews()).lines.filter(line => ids.has(line.recordId))
      const holds: Record<string, number> = {}
      for (const line of lines) if (line.plan.action === "hold") for (const reason of line.plan.reasons) holds[reason] = (holds[reason] ?? 0) + 1
      const body: Scope3SpendImportResponse = { profile: SCOPE3_SPEND_IMPORTS_PROFILE, import: result.import, replayed: result.replayed, saved: result.saved, holds, calculable: lines.filter(line => line.plan.action === "calculate").length, lines }
      return respond(result.replayed ? 200 : 201, body)
    } catch (error) {
      if (error instanceof Scope3RouteProblem) return respond(error.status, error.body)
      const code = (error as { code?: string }).code
      if (code === "42501") return respond(404, NOT_FOUND)
      // The import transaction has already committed before its separate review read.
      // A failed read cannot truthfully be reported as a refused write.
      if (completedImport) return respond(503, {
        code: "import_saved_review_unavailable", importId: completedImport.import.id,
        saved: completedImport.saved, replayed: completedImport.replayed,
        error: "The import is saved, but its review could not be loaded. Reload to review the saved lines. Importing this same file again will not duplicate them.",
      })
      if (request.method === "GET" && (code === "55P03" || code === "57014")) return respond(503, {
        code: "read_unavailable", error: "Scope 3 spend imports could not be read. Reload and try again.",
      })
      // Round 3 (EN-1): lock timeout and statement timeout are specific, retryable refusals (nothing was saved).
      const busy = scope3BusyResponse(error)
      if (busy) return busy
      // Round 3 (owner decision 7, EN-3): 0030's line cap (54N30), checked under the company lock for the whole file.
      if (code === "54N30") {
        // A concurrent writer may have consumed the remaining capacity after the precheck. Read the
        // current count after the rejected transaction, so both refusal paths describe the same budget.
        try {
          const [setup, records] = await Promise.all([deps.database.findCompanySetup(actor.id, companyId), deps.database.findCollectionActivities(actor.id, companyId)])
          if (!setup) return respond(404, NOT_FOUND)
          return capRefusal(records, setup, await lineRule())
        } catch { return respond(503, { error: "The current Scope 3 line budget could not be read. Nothing was saved. Reload and try again." }) }
      }
      // Bug hunt (PR 22, 1 November 2026): every bulk spend write saves its lines against the current setup version, and 0030
      // refuses a line whose location is no longer in it (23503). Say so, with the way back, rather than "not found" for an
      // import the same screen lists, or "reload", which can never succeed.
      if (code === "23503" && request.method === "POST" && (withdrawImportId !== null || resource !== "spend-imports")) {
        const stranded = await scope3LinesAtRemovedLocations(deps.database, actor.id, companyId, withdrawImportId).catch(() => 0)
        if (stranded > 0) return respond(409, { code: "location_not_in_setup", lines: stranded, error: SCOPE3_CAPACITY_TEXT.spendLocationNotInSetup(stranded) })
      }
      if (code === "23503" && withdrawImportId !== null) return respond(404, NOT_FOUND)
      if (code === "setup_required") return respond(409, { code, error: "Save company setup with a reporting period before importing spend." })
      if (code === "location_not_included") return respond(422, { code, error: "Choose a location that company setup includes." })
      if (code === "evidence_mismatch") return respond(422, { code, error: "Upload this exact file as evidence first; the import must be the same bytes." })
      if (code === "23503") return respond(409, { code: "reload_required", error: "Company setup or the uploaded file changed. Reload and try again." })
      // BF-18: 0032's 23N32 (a line's receipt mismatch inside the import or a conversion) answers as 23505 did before 0032.
      if (code === "23505" || code === "23N32" || code === "40001") return respond(409, { code: "changed", error: resource === "spend-mappings" ? "This mapping changed elsewhere. Reload it before saving." : resource === "spend-currency-conversions" ? "Some lines changed while converting; nothing was converted. Reload and try again." : "This file was already imported for another reporting year, or the records changed. Reload and try again." })
      if (code === "54000") return respond(413, { error: "The import is too large." })
      if (code === "22023" && withdrawImportId !== null) {
        const helpful = "Say why this import is withdrawn (at least 3 characters)."
        return respond(422, { error: error instanceof Error && error.message === helpful ? helpful : "Invalid Scope 3 spend import withdrawal." })
      }
      if (["22023", "22P02", "22P05", "22021", "22007", "22008", "22003", "23514", "23502"].includes(code ?? "")) return respond(422, { error: resource === "spend-mappings" ? "Invalid or unsupported Scope 3 spend mapping." : resource === "spend-currency-conversions" ? (error instanceof Error && error.message && (error as { code?: string }).code === "22023" ? error.message : "Invalid currency conversion.") : "Invalid or unsupported Scope 3 spend import." })
      return respond(503, { error: "Scope 3 spend imports could not be read or saved. Try again shortly." })
    }
  }
}

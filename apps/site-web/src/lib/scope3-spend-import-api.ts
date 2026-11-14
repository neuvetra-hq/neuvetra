import { sharedFetch } from "./shared-get"
import type { HostedWorkspaceActor } from "./workspace-api"
import { scope3SpendNaicsAllowed, SCOPE3_SPEND_IMPORT_CATEGORIES } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { scope3DecimalSum, type Scope3SpendImportProblem } from "../../../../packages/neuvetra-database/src/scope3-spend-import"

/**
 * Spend CSV import client (Scope 3 completion I-09; Claude, 30 October 2026; DESIGN §3.6, §7.3). Every response is
 * decoded strictly (exact keys, ids, decimals, a reconciliation that adds up, lines that belong to a listed import), and
 * the queues (unmatched lines by mapping key, possible duplicates beside the earlier line, superseded lines by supplier)
 * are read from the decoded lines. Nothing here calculates emissions.
 */
export const SCOPE3_SPEND_IMPORTS_PROFILE = "neuvetra.scope3-spend-imports.v1"
export const SCOPE3_SPEND_TEMPLATE_PATH = "/templates/scope3-spend-import.csv"

export interface Scope3SpendReconciliationView { reconciled: boolean; nonNumericRows: { file: number; imported: number }; currencies: Array<{ currency: string; fileTotal: string | null; importedTotal: string | null; lines: number; matches: boolean }> }
export interface Scope3SpendImportView {
  id: string; companyId: string; reportingYear: number; fileSha256: string; fileName: string; evidenceId: string; locationId: string; setupVersionId: string
  rowCount: number; fileTotals: Record<string, string>; nonNumericRows: number; createdBy: string; createdAt: string
  lines: Array<{ row: number; recordId: string; lineFingerprint: string }>; reconciliation: Scope3SpendReconciliationView
}
export interface Scope3SpendMappingView { id: string; companyId: string; mappingKeySha256: string; glAccount: string; vendor: string; description: string; category: number; naicsCode: string; marginChoice: "with_margins" | "without_margins"; revision: number; createdBy: string; createdAt: string }
export interface Scope3SpendLineView {
  recordId: string; versionId: string; revision: number; importId: string; importRow: number; sourceId: string; state: "active" | "withdrawn"
  amount: string; currency: string; category: number; naicsCode: string | null; marginChoice: string; mappingSource: "file" | "memory" | "user" | "unmatched"; mappingKeySha256: string
  glAccount: string; vendor: string; description: string; lineDate: string | null; possibleDuplicateOf: { importId: string; row: number } | null; duplicateConfirmedDistinct: boolean
  categoryConfirmed: boolean; activityOverlap: "none_confirmed" | "unknown"
  plan: { action: "calculate" | "hold"; status: string | null; reasons: string[] }
  supersededBy: string | null
  /** Round 2 UX-1: the GL account name when it differs from the description; else empty. */
  glDescription: string
  /** Round 3 lane C (PR-11): the line's conversion to US dollars (original amount, rate, source, date), or null. */
  conversion: Scope3SpendConversionView | null
}
export interface Scope3SpendConversionView { currency: string; amount: string; rate: string; rateSource: string; rateDate: string; usd: string }
export interface Scope3SpendConversionResult { converted: Array<{ recordId: string; sourceId: string; versionId: string; revision: number; from: string; usd: string }>; skipped: Array<{ recordId: string; sourceId: string; reason: string }> }
/** Round 2 ACC-16: a superseded spend line (amount as recorded) and the record whose own figure replaces it. */
export interface Scope3SpendSupersededView { spendRecordId: string; supersededBy: string; supplierName: string; kind: "purchase_supplier" | "partner_reported"; spendSourceId: string; spendDescription: string; spendAmount: string; spendCurrency: string
  /** BF-12: present only when the replacing record matches this line only by the vendor key (`supplierName` is what it names). */
  vendorKeyMatch?: true }
export interface Scope3SpendSupersederView {
  recordId: string; kind: "purchase_supplier" | "partner_reported"; sourceId: string; name: string; category: number; quantity: string; unit: string
  basis: string | null; factorValue: string | null; factorUnit: string | null; allocationNumerator: string | null; allocationDenominator: string | null
}
export interface Scope3SpendImportsView {
  companyId: string; canManage: boolean; setupVersionId: string | null; reportingYear: number | null; reportingPeriod: { start: string; endExclusive: string } | null
  locations: Array<{ id: string; name: string }>; imports: Scope3SpendImportView[]; mappings: Scope3SpendMappingView[]; lines: Scope3SpendLineView[]
  superseded: Scope3SpendSupersededView[]
  superseders: Scope3SpendSupersederView[]
}
export interface Scope3SpendImportResult { import: Scope3SpendImportView; replayed: boolean; saved: number; holds: Record<string, number>; calculable: number; lines: Scope3SpendLineView[] }

export class Scope3SpendImportApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null, readonly problems: Scope3SpendImportProblem[] = []) { super(message) }
  get unavailable() { return this.status === 503 && this.code === "scope3_schema_30_required" }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA = /^[0-9a-f]{64}$/
const DECIMAL = /^-?(0|[1-9][0-9]{0,15})(\.[0-9]{1,3})?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
/**
 * BF-12b (QA F-2): a response this page can't read. After a release the server can answer in a shape an open page doesn't
 * know; the spend import then offers the existing "A newer version is available — reload" notice (lazy-forms.tsx).
 */
export class Scope3SpendResponseUnrecognized extends Error {
  constructor() { super("The spend import response was not recognized.") }
}
const fail = (): never => { throw new Scope3SpendResponseUnrecognized() }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
/**
 * Every listed key must be present; BF-12b (QA F-2): keys this page doesn't know are ignored (never copied into the
 * decoded value), so a field the server adds later can't make an open page refuse the whole response. Each decoder
 * builds its result from the listed keys only.
 */
const exact = (value: unknown, expected: readonly string[]): Record<string, unknown> => object(value) && expected.every(key => Object.prototype.hasOwnProperty.call(value, key)) ? value : fail()
const uuid = (value: unknown) => typeof value === "string" && UUID.test(value) ? value : fail()
const str = (value: unknown, max = 4000) => typeof value === "string" && value.length <= max ? value : fail()
const int = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max ? value as number : fail()
const bool = (value: unknown) => typeof value === "boolean" ? value : fail()
const time = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value ? value : fail()
const array = (value: unknown) => Array.isArray(value) ? value as unknown[] : fail()
const nullable = <T,>(value: unknown, read: (v: unknown) => T): T | null => value === null ? null : read(value)

function reconciliation(value: unknown, fileTotals: Record<string, string>, nonNumericRows: number): Scope3SpendReconciliationView {
  const v = exact(value, ["reconciled", "nonNumericRows", "currencies"])
  const nn = exact(v.nonNumericRows, ["file", "imported"])
  const currencies = array(v.currencies).map(item => {
    const c = exact(item, ["currency", "fileTotal", "importedTotal", "lines", "matches"])
    const fileTotal = nullable(c.fileTotal, x => typeof x === "string" && DECIMAL.test(x) ? x : fail()), importedTotal = nullable(c.importedTotal, x => typeof x === "string" && DECIMAL.test(x) ? x : fail())
    const row = { currency: str(c.currency, 80), fileTotal, importedTotal, lines: int(c.lines, 0, 2000), matches: bool(c.matches) }
    // The flag is the comparison, recomputed: exact decimals, never trusted as sent.
    if (row.matches !== (fileTotal !== null && importedTotal !== null && scope3DecimalSum([fileTotal]) === scope3DecimalSum([importedTotal]))) fail()
    if (fileTotal !== fileTotals[row.currency] && !(fileTotal === null && !(row.currency in fileTotals))) fail()
    return row
  })
  if (Object.keys(fileTotals).some(currency => !currencies.some(c => c.currency === currency))) fail()
  const out = { reconciled: bool(v.reconciled), nonNumericRows: { file: int(nn.file, 0, 2000), imported: int(nn.imported, 0, 2000) }, currencies }
  if (out.nonNumericRows.file !== nonNumericRows || out.reconciled !== (currencies.every(c => c.matches) && out.nonNumericRows.file === out.nonNumericRows.imported)) fail()
  return out
}

function importView(value: unknown, companyId: string): Scope3SpendImportView {
  const v = exact(value, ["id", "companyId", "reportingYear", "fileSha256", "fileName", "evidenceId", "locationId", "setupVersionId", "rowCount", "fileTotals", "nonNumericRows", "createdBy", "createdAt", "lines", "reconciliation"])
  if (v.companyId !== companyId || typeof v.fileSha256 !== "string" || !SHA.test(v.fileSha256)) fail()
  const totals = object(v.fileTotals) ? v.fileTotals : fail()
  for (const [currency, total] of Object.entries(totals)) if (!currency || currency.length > 80 || typeof total !== "string" || !DECIMAL.test(total)) fail()
  const rowCount = int(v.rowCount, 1, 2000), nonNumericRows = int(v.nonNumericRows, 0, rowCount)
  const lines = array(v.lines).map((item, i) => { const l = exact(item, ["row", "recordId", "lineFingerprint"]); if (l.row !== i + 1 || typeof l.lineFingerprint !== "string" || !SHA.test(l.lineFingerprint)) fail(); return { row: i + 1, recordId: uuid(l.recordId), lineFingerprint: l.lineFingerprint as string } })
  if (lines.length !== rowCount) fail()
  return { id: uuid(v.id), companyId, reportingYear: int(v.reportingYear, 2012, 2035), fileSha256: v.fileSha256 as string, fileName: str(v.fileName, 255), evidenceId: uuid(v.evidenceId), locationId: uuid(v.locationId),
    setupVersionId: uuid(v.setupVersionId), rowCount, fileTotals: totals as Record<string, string>, nonNumericRows, createdBy: uuid(v.createdBy), createdAt: time(v.createdAt), lines, reconciliation: reconciliation(v.reconciliation, totals as Record<string, string>, nonNumericRows) }
}

function mappingView(value: unknown, companyId: string): Scope3SpendMappingView {
  const v = exact(value, ["id", "companyId", "mappingKeySha256", "glAccount", "vendor", "description", "category", "naicsCode", "marginChoice", "revision", "createdBy", "createdAt"])
  const category = (SCOPE3_SPEND_IMPORT_CATEGORIES as readonly unknown[]).includes(v.category) ? v.category as number : fail()
  if (v.companyId !== companyId || typeof v.mappingKeySha256 !== "string" || !SHA.test(v.mappingKeySha256) || typeof v.naicsCode !== "string" || !/^\d{6}$/.test(v.naicsCode) || !scope3SpendNaicsAllowed(category, v.naicsCode) || !["with_margins", "without_margins"].includes(String(v.marginChoice))) fail()
  return { id: uuid(v.id), companyId, mappingKeySha256: v.mappingKeySha256 as string, glAccount: str(v.glAccount, 120), vendor: str(v.vendor, 200), description: str(v.description, 200), category, naicsCode: v.naicsCode as string,
    marginChoice: v.marginChoice as Scope3SpendMappingView["marginChoice"], revision: int(v.revision, 1, 1000), createdBy: uuid(v.createdBy), createdAt: time(v.createdAt) }
}

function lineView(value: unknown): Scope3SpendLineView {
  const v = exact(value, ["recordId", "versionId", "revision", "importId", "importRow", "sourceId", "state", "amount", "currency", "category", "naicsCode", "marginChoice", "mappingSource", "mappingKeySha256", "glAccount", "vendor", "description",
    "lineDate", "possibleDuplicateOf", "duplicateConfirmedDistinct", "categoryConfirmed", "activityOverlap", "plan", "supersededBy", "glDescription", "conversion"])
  const plan = exact(v.plan, ["action", "status", "reasons"])
  const action = plan.action === "calculate" || plan.action === "hold" ? plan.action : fail()
  const reasons = array(plan.reasons).map(reason => typeof reason === "string" && /^[a-z0-9_:.-]{1,200}$/.test(reason) ? reason : fail())
  // A line the engine will calculate carries no reason; a held line carries at least one (never a silent zero).
  if ((action === "calculate") !== (reasons.length === 0) || (action === "calculate" && plan.status !== null) || (action === "hold" && typeof plan.status !== "string")) fail()
  const dup = nullable(v.possibleDuplicateOf, d => { const x = exact(d, ["importId", "row"]); return { importId: uuid(x.importId), row: int(x.row, 1, 9_999_999) } })
  if (typeof v.mappingKeySha256 !== "string" || !SHA.test(v.mappingKeySha256)) fail()
  return {
    recordId: uuid(v.recordId), versionId: uuid(v.versionId), revision: int(v.revision, 1, 1000), importId: uuid(v.importId), importRow: int(v.importRow, 1, 9_999_999), sourceId: str(v.sourceId, 120),
    state: v.state === "active" || v.state === "withdrawn" ? v.state : fail(), amount: str(v.amount, 100), currency: str(v.currency, 80),
    category: [1, 2, 3, 4, 5, 6].includes(v.category as number) ? v.category as number : fail(), naicsCode: nullable(v.naicsCode, x => typeof x === "string" && /^\d{6}$/.test(x) ? x : fail()),
    marginChoice: ["with_margins", "without_margins"].includes(String(v.marginChoice)) ? v.marginChoice as string : fail(),
    mappingSource: ["file", "memory", "user", "unmatched"].includes(String(v.mappingSource)) ? v.mappingSource as Scope3SpendLineView["mappingSource"] : fail(), mappingKeySha256: v.mappingKeySha256 as string,
    glAccount: str(v.glAccount, 120), vendor: str(v.vendor, 200), description: str(v.description, 200), lineDate: nullable(v.lineDate, x => typeof x === "string" && DATE.test(x) ? x : fail()),
    possibleDuplicateOf: dup, duplicateConfirmedDistinct: bool(v.duplicateConfirmedDistinct), categoryConfirmed: bool(v.categoryConfirmed),
    activityOverlap: v.activityOverlap === "none_confirmed" || v.activityOverlap === "unknown" ? v.activityOverlap : fail(),
    plan: { action, status: plan.status as string | null, reasons }, supersededBy: nullable(v.supersededBy, uuid), glDescription: str(v.glDescription, 200),
    conversion: nullable(v.conversion, conversionView),
  }
}

/** Round 3 lane C (PR-11): a conversion as the line's notes record it (exact keys, a currency, plain decimals, a date). */
function conversionView(value: unknown): Scope3SpendConversionView {
  const c = exact(value, ["currency", "amount", "rate", "rateSource", "rateDate", "usd"])
  const plain = (x: unknown) => typeof x === "string" && /^(0|[1-9][0-9]{0,15})(\.[0-9]{1,8})?$/.test(x) ? x : fail()
  return { currency: typeof c.currency === "string" && /^[A-Z]{3}$/.test(c.currency) ? c.currency : fail(), amount: plain(c.amount), rate: plain(c.rate), rateSource: str(c.rateSource, 200),
    rateDate: typeof c.rateDate === "string" && DATE.test(c.rateDate) ? c.rateDate : fail(), usd: plain(c.usd) }
}

/** Every line must be a line of a listed import, at its row, with the record that import saved. */
function linesBelong(lines: Scope3SpendLineView[], imports: Scope3SpendImportView[]) {
  for (const line of lines) {
    const owner = imports.find(item => item.id === line.importId)
    if (!owner || owner.lines[line.importRow - 1]?.recordId !== line.recordId) fail()
  }
  if (new Set(lines.map(line => line.recordId)).size !== lines.length) fail()
}

export function decodeScope3SpendImports(value: unknown, companyId: string): Scope3SpendImportsView {
  const v = exact(value, ["profile", "companyId", "canManage", "setupVersionId", "reportingYear", "reportingPeriod", "locations", "imports", "mappings", "lines", "superseded", "superseders"])
  if (v.profile !== SCOPE3_SPEND_IMPORTS_PROFILE || v.companyId !== companyId) fail()
  const period = nullable(v.reportingPeriod, p => { const x = exact(p, ["start", "endExclusive"]); return typeof x.start === "string" && DATE.test(x.start) && typeof x.endExclusive === "string" && DATE.test(x.endExclusive) && x.start < x.endExclusive ? { start: x.start, endExclusive: x.endExclusive } : fail() })
  const imports = array(v.imports).map(item => importView(item, companyId))
  if (new Set(imports.map(item => item.id)).size !== imports.length || new Set(imports.map(item => item.fileSha256)).size !== imports.length) fail()
  const mappings = array(v.mappings).map(item => mappingView(item, companyId))
  if (new Set(mappings.map(item => item.mappingKeySha256)).size !== mappings.length) fail()
  const lines = array(v.lines).map(lineView)
  linesBelong(lines, imports)
  const kindOf = (x: unknown) => x === "purchase_supplier" || x === "partner_reported" ? x as "purchase_supplier" | "partner_reported" : fail()
  const superseded = array(v.superseded).map(item => {
    // BF-12: `vendorKeyMatch` is either absent or exactly true.
    const s = exact(item, ["spendRecordId", "supersededBy", "supplierName", "kind", "spendSourceId", "spendDescription", "spendAmount", "spendCurrency"])
    if (Object.prototype.hasOwnProperty.call(s, "vendorKeyMatch") && s.vendorKeyMatch !== true) fail()
    return { spendRecordId: uuid(s.spendRecordId), supersededBy: uuid(s.supersededBy), supplierName: str(s.supplierName, 200), kind: kindOf(s.kind),
      spendSourceId: str(s.spendSourceId, 120), spendDescription: str(s.spendDescription, 200), spendAmount: str(s.spendAmount, 100), spendCurrency: str(s.spendCurrency, 80),
      ...(s.vendorKeyMatch === true ? { vendorKeyMatch: true as const } : {}) }
  })
  for (const line of lines) {
    const entry = superseded.find(s => s.spendRecordId === line.recordId)
    if (line.supersededBy !== (entry?.supersededBy ?? null) || (entry && (entry.spendAmount !== line.amount || entry.spendCurrency !== line.currency || entry.spendSourceId !== line.sourceId))) fail()
  }
  const text = (x: unknown, max: number) => nullable(x, y => str(y, max))
  const superseders = array(v.superseders).map(item => {
    const s = exact(item, ["recordId", "kind", "sourceId", "name", "category", "quantity", "unit", "basis", "factorValue", "factorUnit", "allocationNumerator", "allocationDenominator"])
    return { recordId: uuid(s.recordId), kind: kindOf(s.kind), sourceId: str(s.sourceId, 120), name: str(s.name, 200), category: int(s.category, 1, 15), quantity: str(s.quantity, 100), unit: str(s.unit, 80),
      basis: text(s.basis, 40), factorValue: text(s.factorValue, 100), factorUnit: text(s.factorUnit, 120), allocationNumerator: text(s.allocationNumerator, 100), allocationDenominator: text(s.allocationDenominator, 100) }
  })
  // Each replacing record exactly once, and exactly the records that replace a listed line.
  if (new Set(superseders.map(s => s.recordId)).size !== superseders.length || [...new Set(superseded.map(s => s.supersededBy))].sort().join("|") !== superseders.map(s => s.recordId).sort().join("|")) fail()
  const setupVersionId = nullable(v.setupVersionId, uuid), reportingYear = nullable(v.reportingYear, x => int(x, 2012, 2035))
  if (setupVersionId === null && reportingYear !== null) fail()
  return { companyId, canManage: bool(v.canManage), setupVersionId, reportingYear, reportingPeriod: period,
    locations: array(v.locations).map(item => { const l = exact(item, ["id", "name"]); return { id: uuid(l.id), name: str(l.name, 255) } }), imports, mappings, lines, superseded, superseders }
}

export function decodeScope3SpendImportResult(value: unknown, companyId: string): Scope3SpendImportResult {
  const v = exact(value, ["profile", "import", "replayed", "saved", "holds", "calculable", "lines"])
  if (v.profile !== SCOPE3_SPEND_IMPORTS_PROFILE) fail()
  const imported = importView(v.import, companyId)
  const lines = array(v.lines).map(lineView)
  linesBelong(lines, [imported])
  const holds = object(v.holds) ? v.holds : fail()
  // The counts are the lines' own: held lines by reason, calculable lines with none.
  const recount: Record<string, number> = {}
  for (const line of lines) if (line.plan.action === "hold") for (const reason of line.plan.reasons) recount[reason] = (recount[reason] ?? 0) + 1
  if (JSON.stringify(Object.entries(holds).sort()) !== JSON.stringify(Object.entries(recount).sort()) || v.calculable !== lines.filter(line => line.plan.action === "calculate").length) fail()
  const replayed = bool(v.replayed), saved = int(v.saved, 0, 2000)
  if ((replayed && saved !== 0) || (!replayed && saved !== imported.rowCount)) fail()
  return { import: imported, replayed, saved, holds: holds as Record<string, number>, calculable: v.calculable as number, lines }
}

// --- Queues (pure; DESIGN 7.3) ---

const MAPPING_REASONS = new Set(["naics_code_required", "naics_not_valid_for_category", "spend_overlap_not_confirmed", "energy_spend_belongs_in_scope_1_2_or_cat3", "spend_overlaps_other_category", "trade_sector_naics_maps_margin_only"])
export interface Scope3SpendUnmatchedGroup { mappingKeySha256: string; glAccount: string; vendor: string; description: string; lines: Scope3SpendLineView[]; reasons: string[]; mapping: Scope3SpendMappingView | null }
/** Active lines held for a mapping reason (no code, a code outside the category, an attestation), grouped by mapping key. */
export function scope3SpendUnmatchedGroups(view: Pick<Scope3SpendImportsView, "lines" | "mappings">): Scope3SpendUnmatchedGroup[] {
  const groups = new Map<string, Scope3SpendUnmatchedGroup>()
  for (const line of view.lines) {
    if (line.state !== "active" || line.mappingSource === "file" || !line.plan.reasons.some(reason => MAPPING_REASONS.has(reason))) continue
    const group = groups.get(line.mappingKeySha256) ?? { mappingKeySha256: line.mappingKeySha256, glAccount: line.glAccount, vendor: line.vendor, description: line.description, lines: [], reasons: [], mapping: view.mappings.find(m => m.mappingKeySha256 === line.mappingKeySha256) ?? null }
    group.lines.push(line)
    for (const reason of line.plan.reasons) if (MAPPING_REASONS.has(reason) && !group.reasons.includes(reason)) group.reasons.push(reason)
    groups.set(line.mappingKeySha256, group)
  }
  return [...groups.values()].sort((a, b) => a.vendor.localeCompare(b.vendor) || a.mappingKeySha256.localeCompare(b.mappingKeySha256))
}
/** Active lines held as possible duplicates, each beside the earlier line it repeats. */
export function scope3SpendDuplicatePairs(view: Pick<Scope3SpendImportsView, "lines" | "imports">): Array<{ line: Scope3SpendLineView; earlier: Scope3SpendLineView | null; earlierFile: string | null }> {
  return view.lines.filter(line => line.state === "active" && line.possibleDuplicateOf !== null && !line.duplicateConfirmedDistinct).map(line => {
    const ref = line.possibleDuplicateOf!, file = view.imports.find(item => item.id === ref.importId)
    const recordId = file?.lines[ref.row - 1]?.recordId
    return { line, earlier: view.lines.find(other => other.recordId === recordId) ?? null, earlierFile: file?.fileName ?? null }
  })
}
/** Superseded spend lines per supplier name. */
export function scope3SpendSupersessionBySupplier(view: Pick<Scope3SpendImportsView, "superseded">): Array<{ supplierName: string; supersededBy: string; spendRecordIds: string[] }> {
  const out = new Map<string, { supplierName: string; supersededBy: string; spendRecordIds: string[] }>()
  for (const s of view.superseded) { const key = `${s.supersededBy}`; const entry = out.get(key) ?? { supplierName: s.supplierName, supersededBy: s.supersededBy, spendRecordIds: [] }; entry.spendRecordIds.push(s.spendRecordId); out.set(key, entry) }
  return [...out.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName))
}
/**
 * The mapping save body (the server computes the key from these texts). Round 2 UX-1: `scope: "group"` maps a vendor and
 * GL account (description empty); without a scope (or `"line"`) it maps one line key, a per-line override.
 */
export function scope3SpendMappingBody(group: Pick<Scope3SpendUnmatchedGroup, "glAccount" | "vendor" | "description" | "mapping"> & { scope?: "group" | "line" }, choice: { category: number; naicsCode: string; marginChoice: "with_margins" | "without_margins"; categoryConfirmed: boolean | null; activityOverlapConfirmed: boolean | null }) {
  return { expectedRevision: group.mapping?.revision ?? 0, ...(group.scope === "group" ? { scope: "group" as const } : {}),
    mapping: { glAccount: group.glAccount, vendor: group.vendor, description: group.scope === "group" ? "" : group.description, category: choice.category, naicsCode: choice.naicsCode, marginChoice: choice.marginChoice },
    categoryConfirmed: choice.categoryConfirmed, activityOverlapConfirmed: choice.activityOverlapConfirmed }
}

// --- Requests ---

async function request(actor: HostedWorkspaceActor, path: string, init: { method?: string; body?: BodyInit; type?: string } = {}): Promise<unknown> {
  if (!actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  actor.signal?.throwIfAborted()
  // Round 3 lane C (PR-3): GETs shared across screens and retried once on 429; writes clear them.
  const response = await sharedFetch(actor, path, { method: init.method ?? "GET", cache: "no-store", signal: actor.signal, body: init.body, headers: { authorization: `Bearer ${actor.accessToken}`, ...(init.type ? { "content-type": init.type } : {}) } })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) actor.onUnauthorized?.(response.status)
  const value: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const problems = object(value) && Array.isArray(value.problems) ? (value.problems as unknown[]).filter((p): p is Scope3SpendImportProblem => object(p) && typeof p.message === "string") : []
    throw new Scope3SpendImportApiError(object(value) && typeof value.error === "string" ? value.error : "Spend import is unavailable right now.", response.status, object(value) && typeof value.code === "string" ? value.code : null, problems)
  }
  return value
}
const base = (companyId: string) => { if (!UUID.test(companyId)) throw new Error("Invalid company."); return `/workspace-api/workspace/${companyId}/scope3` }

export async function loadScope3SpendImports(companyId: string, actor: HostedWorkspaceActor): Promise<Scope3SpendImportsView> {
  return decodeScope3SpendImports(await request(actor, `${base(companyId)}/spend-imports`), companyId)
}
/** Withdraw only this import's lines; preserve their history and validate the returned binding. */
export async function withdrawScope3SpendImport(companyId: string, importId: string, reason: string, actor: HostedWorkspaceActor): Promise<{ importId: string; withdrawn: number; alreadyWithdrawn: number; message: string }> {
  const explanation = reason.trim()
  // Refuse control characters while allowing ordinary multiline explanations.
  // eslint-disable-next-line no-control-regex
  if (!UUID.test(importId) || explanation.length < 3 || explanation.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(explanation)) throw new Error("Say why this import is withdrawn (3 to 2,000 characters).")
  const value = exact(await request(actor, `${base(companyId)}/spend-imports/${importId}/withdrawal`, { method: "POST", body: JSON.stringify({ reason: explanation }), type: "application/json" }), ["profile", "importId", "withdrawn", "alreadyWithdrawn", "message"])
  if (value.profile !== SCOPE3_SPEND_IMPORTS_PROFILE || value.importId !== importId) fail()
  const withdrawn = int(value.withdrawn, 0, 2000), alreadyWithdrawn = int(value.alreadyWithdrawn, 0, 2000)
  if (withdrawn + alreadyWithdrawn > 2000) fail()
  return { importId, withdrawn, alreadyWithdrawn, message: str(value.message, 2000) }
}
/** Imports the bytes of a file already uploaded as evidence (`evidenceId`), at one setup location. */
export async function importScope3SpendFile(companyId: string, bytes: Uint8Array<ArrayBuffer>, evidenceId: string, locationId: string, actor: HostedWorkspaceActor): Promise<Scope3SpendImportResult> {
  if (!UUID.test(evidenceId) || !UUID.test(locationId)) throw new Error("Invalid spend import reference.")
  const result = decodeScope3SpendImportResult(await request(actor, `${base(companyId)}/spend-imports?evidenceId=${evidenceId}&locationId=${locationId}`, { method: "POST", body: bytes, type: "text/csv" }), companyId)
  if (result.import.evidenceId !== evidenceId && !result.replayed) fail()
  return result
}
export async function saveScope3SpendMapping(companyId: string, body: ReturnType<typeof scope3SpendMappingBody>, actor: HostedWorkspaceActor): Promise<{ mapping: Scope3SpendMappingView; corrected: Array<{ recordId: string; versionId: string; revision: number }>; unchanged: number }> {
  const value = exact(await request(actor, `${base(companyId)}/spend-mappings`, { method: "POST", body: JSON.stringify(body), type: "application/json" }), ["profile", "mapping", "corrected", "unchanged"])
  if (value.profile !== SCOPE3_SPEND_IMPORTS_PROFILE) fail()
  const mapping = mappingView(value.mapping, companyId)
  if (mapping.naicsCode !== body.mapping.naicsCode || mapping.category !== body.mapping.category || mapping.revision !== body.expectedRevision + 1) fail()
  return { mapping, corrected: array(value.corrected).map(item => { const c = exact(item, ["recordId", "versionId", "revision"]); return { recordId: uuid(c.recordId), versionId: uuid(c.versionId), revision: int(c.revision, 2, 1000) } }), unchanged: int(value.unchanged, 0, 100_000) }
}
/** Round 3 lane C (PR-11): converts every held imported line in one currency to US dollars, in one server transaction. */
export async function convertScope3SpendCurrency(companyId: string, body: { currency: string; rate: string; rateSource: string; rateDate: string }, actor: HostedWorkspaceActor): Promise<Scope3SpendConversionResult> {
  const value = exact(await request(actor, `${base(companyId)}/spend-currency-conversions`, { method: "POST", body: JSON.stringify(body), type: "application/json" }), ["profile", "converted", "skipped"])
  if (value.profile !== SCOPE3_SPEND_IMPORTS_PROFILE) fail()
  return {
    converted: array(value.converted).map(item => { const c = exact(item, ["recordId", "sourceId", "versionId", "revision", "from", "usd"]); return { recordId: uuid(c.recordId), sourceId: str(c.sourceId, 120), versionId: uuid(c.versionId), revision: int(c.revision, 2, 1000), from: str(c.from, 100), usd: str(c.usd, 100) } }),
    skipped: array(value.skipped).map(item => { const c = exact(item, ["recordId", "sourceId", "reason"]); return { recordId: uuid(c.recordId), sourceId: str(c.sourceId, 120), reason: str(c.reason, 200) } }),
  }
}

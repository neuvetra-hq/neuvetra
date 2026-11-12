import { groupDigits, shortUnit } from "./plain-language"
import { SCOPE3_DQ_INDICATOR_TEXT, SCOPE3_DQ_RATING_TEXT, type Scope3ResultsResponse } from "./scope3-results-api"
import { SCOPE3_DQ_CAP_REASON_TEXT } from "../../../../packages/neuvetra-database/src/scope3-text"
import { SCOPE3_WASTE_MATERIAL_TEXT_R2E, SCOPE3_WASTE_TREATMENT_TEXT_R2E } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { SCOPE3_AIR_HAULS, SCOPE3_WASTE_TREATMENTS } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { SCOPE3_CONFLICT_STATUSES, scope3Tonnes } from "./scope3-checklist"
import { SCOPE3_WASTE_TREATMENTS_BY_MATERIAL } from "./scope3-waste-pairs"
import { SCOPE3_DQ_TEXT_R3D, SCOPE3_PRESAVE_TEXT_R3D, SCOPE3_PROVENANCE_TEXT_R3D, SCOPE3_SAVED_TEXT_R3D, SCOPE3_SCREENING_TEXT_R3D } from "./scope3-text-r3d"

/**
 * Display rules of round 3, lane D (Claude, 31 October 2026; ROUND3 decision 5, round-2 product review PR-2, PR-6, PR-8,
 * PR-9, PR-10, PR-12; accounting AC-3). Pure functions over decoded results, stored documents and drafts: nothing here
 * calculates emissions; sums of figures are exact decimal sums of the engine's own display strings, for a headline note.
 */
type Category = Scope3ResultsResponse["coverage"]["categories"][number]

// --- Owner decision 5: one data-quality label per category, everywhere ---

/** A category's data-quality label as shown: the capped label (decision 5), or for a version stored before capping, its stored label. */
export interface Scope3CategoryDq {
  /** Words ("fair"); null when the category has no profile. */
  label: string | null
  capped: boolean
  /** Why it was capped, in words. */
  reasons: string[]
  /** The engine's kg-weighted overall score (secondary, a number only). */
  score: string | null
  /** True for a stored document that predates the capped label (v1): the label is the one it stored. */
  beforeCap: boolean
}
type DqRow = Pick<Category, "profile"> & { dataQualityLabel?: Category["dataQualityLabel"] | null }
export function scope3CategoryDq(row: DqRow): Scope3CategoryDq {
  const score = row.profile?.dataQuality.overall.score?.display ?? null
  const shown = row.dataQualityLabel
  if (shown) return { label: shown.label ? SCOPE3_DQ_RATING_TEXT[shown.label] ?? shown.label : null, capped: shown.capped, reasons: shown.reasons.map(code => SCOPE3_DQ_CAP_REASON_TEXT[code] ?? code.replace(/_/g, " ")), score, beforeCap: false }
  const stored = row.profile?.dataQuality.overall.label ?? null
  return { label: stored ? SCOPE3_DQ_RATING_TEXT[stored] ?? stored : null, capped: false, reasons: [], score, beforeCap: true }
}
/** Screen and print: "fair (capped) · weighted score 1.44", or "—". The engine's own label word never appears. */
export function scope3CategoryDqText(row: DqRow): string {
  const dq = scope3CategoryDq(row)
  if (!dq.label) return "—"
  return `${SCOPE3_DQ_TEXT_R3D.label(dq.label, dq.capped)}${dq.score ? ` · ${SCOPE3_DQ_TEXT_R3D.weighted(dq.score)}` : ""}`
}
/** Print: the five indicator scores and the weighted score, as numbers ("T 2.30 / Ti 1.00 / … / weighted 2.00"). */
export function scope3DqScoresText(profile: Category["profile"]): string {
  if (!profile) return "—"
  const dq = profile.dataQuality
  return [...Object.keys(SCOPE3_DQ_INDICATOR_TEXT).map(name => `${SCOPE3_DQ_INDICATOR_TEXT[name]!.short} ${dq.indicators[name as keyof typeof dq.indicators]?.score?.display ?? "—"}`), `weighted ${dq.overall.score?.display ?? "—"}`].join(" / ")
}

// --- PR-8: plural units, provenance in words ---

/** Count units that read wrongly after a number other than 1 ("85,000 vehicle-mile"). */
const PLURAL_UNITS: Readonly<Record<string, string>> = {
  "vehicle-mile": "vehicle-miles", "passenger-mile": "passenger-miles", "short ton-mile": "short ton-miles", "ton-mile": "ton-miles", "room-night": "room-nights",
  unit: "units", employee: "employees", mile: "miles", trip: "trips", night: "nights", liter: "litres", gallon: "gallons",
}
const ONE = /^1(\.0+)?$/
/** A quantity with grouped digits and its unit in the right number: "85,000 vehicle-miles", "1 room-night". */
export function scope3QuantityText(value: string, unit: string): string {
  const words = ONE.test(value) ? shortUnit(unit) : PLURAL_UNITS[unit] ?? shortUnit(unit)
  return `${groupDigits(value)} ${words}`
}
/** A factor cell's provenance tag in words: "[transcription: webfetch_double_read; …]" → "[transcribed from the source document (read twice); …]". */
export function scope3ProvenanceText(cell: string): string {
  return cell.replace(/\[transcription: ([a-z0-9_]+)(;?)/g, (_match, method: string, separator: string) => `[${SCOPE3_PROVENANCE_TEXT_R3D[method] ?? method.replace(/_/g, " ")}${separator}`)
}

// --- PR-9: one sentence ends with one period; screening words as setup says them ---

/** Text that ends with exactly one sentence end ("Acme Inc." stays "Acme Inc.", never "Acme Inc.."). */
export const scope3Sentence = (text: string) => /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`
export const scope3ScreeningWord = (decision: string) => SCOPE3_SCREENING_TEXT_R3D[decision] ?? decision.replace(/_/g, " ")

// --- PR-10: what the headline includes from categories screened out ---

const sumDecimals = (values: readonly string[]): string => {
  const parsed = values.map(value => { const negative = value.startsWith("-"), [whole = "0", fraction = ""] = (negative ? value.slice(1) : value).split("."); return { units: (negative ? -1n : 1n) * BigInt(whole + fraction), scale: fraction.length } })
  const scale = Math.max(0, ...parsed.map(p => p.scale)), units = parsed.reduce((total, p) => total + p.units * 10n ** BigInt(scale - p.scale), 0n)
  const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(scale + 1, "0")
  return `${negative ? "-" : ""}${scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`
}
/** The categories with a screening conflict that carry a figure, and that figure in t (2 decimals); null when none. */
export function scope3ConflictInHeadline(categories: ReadonlyArray<Pick<Category, "category" | "status" | "subtotal">>): { tonnes: string; categories: number[] } | null {
  const rows = categories.filter(row => SCOPE3_CONFLICT_STATUSES.has(row.status) && row.subtotal !== null)
  if (!rows.length) return null
  return { tonnes: scope3Tonnes(sumDecimals(rows.map(row => row.subtotal!.unrounded))), categories: rows.map(row => row.category) }
}

// --- PR-6, PR-12: the 0029 forms (freight, business travel, waste) stop a record the engine would hold, naming the field ---

/** The treatments with an EPA factor for a listed material (all treatments for an unlisted one, which is held anyway). */
export function scope3WasteTreatmentsFor(material: string): readonly string[] {
  return SCOPE3_WASTE_TREATMENTS_BY_MATERIAL[material] ?? SCOPE3_WASTE_TREATMENTS
}
export interface Scope3PreSaveProblem { field: string; text: string }
/** Problems to fix before saving a freight, business travel or waste record; each names the field (its label). */
export function scope3PreSaveProblems(draft: { kind: string; payload: unknown }): Scope3PreSaveProblem[] {
  const p = (draft.payload ?? {}) as Record<string, unknown>
  const out: Scope3PreSaveProblem[] = []
  if (draft.kind === "transport" && typeof p.vehicle === "string" && p.vehicle.trim() === "") out.push({ field: "Vehicle", text: SCOPE3_PRESAVE_TEXT_R3D.vehicle })
  if (draft.kind === "business_travel" && typeof p.mode === "string" && (SCOPE3_AIR_HAULS as readonly string[]).includes(p.mode) && !(typeof p.haulBasis === "string" && p.haulBasis.trim()))
    out.push({ field: "How do you know the haul length?", text: SCOPE3_PRESAVE_TEXT_R3D.haulBasis })
  if (draft.kind === "waste" && typeof p.material === "string" && typeof p.treatment === "string" && SCOPE3_WASTE_TREATMENTS_BY_MATERIAL[p.material] && (SCOPE3_WASTE_TREATMENTS as readonly string[]).includes(p.treatment) && !SCOPE3_WASTE_TREATMENTS_BY_MATERIAL[p.material]!.includes(p.treatment))
    out.push({ field: "Treatment", text: SCOPE3_PRESAVE_TEXT_R3D.wastePair(SCOPE3_WASTE_MATERIAL_TEXT_R2E[p.material] ?? p.material, SCOPE3_WASTE_TREATMENT_TEXT_R2E[p.treatment] ?? p.treatment) })
  return out
}

// --- PR-8: the saved-records list ---

/** An amount as written, with grouped digits ("18505.65" → "18,505.65"); anything that isn't a plain number is unchanged. */
export const scope3GroupedAmount = (value: string) => groupDigits(value)

/** When a saved record happened ("Invoice date 2025-06-30" for a dated spend line) and its amount with grouped digits. */
export function scope3SavedRecordWhen(activity: { kind: string; period: { start: string }; payload: unknown }, lastDay: string): string {
  const lineDate = activity.kind === "purchase_spend" ? (activity.payload as { lineDate?: unknown } | null)?.lineDate : null
  return typeof lineDate === "string" && lineDate ? SCOPE3_SAVED_TEXT_R3D.invoiceDate(lineDate) : SCOPE3_SAVED_TEXT_R3D.period(activity.period.start, lastDay)
}

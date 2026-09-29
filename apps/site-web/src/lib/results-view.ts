import type { ResultRow } from "./results-api"
import { reasonText } from "./plain-language"

export type Tone = "ready" | "warn" | "danger" | "muted" | "info"
export interface RowStatus { label: string; tone: Tone }
export const GAS_LABELS: Record<string, string> = { co2: "CO2", ch4: "CH4", n2o: "N2O" }
export const KIND_COLORS: Record<string, string> = { natural_gas: "#b8d997", vehicle: "#8ec5a4", distillate_no2: "#d9c77f", fugitive: "#9fb8e8", electricity: "#e3a77f" }

/** Status wording follows the reviewed collection labels. */
export function rowStatus(row: ResultRow): RowStatus {
  if (row.outcome === "refused" || row.outcome === "unavailable") return { label: "Not calculated", tone: "danger" }
  if (row.outcome === "held" && row.plan.status !== "withdrawn" && row.plan.status !== "excluded" && (row.periodCheck === "outside" || row.periodCheck === "partial")) return { label: "Held pending correction", tone: "warn" }
  if (row.outcome === "held") return row.plan.status === "withdrawn" ? { label: "Withdrawn", tone: "muted" } : row.plan.status === "excluded" ? { label: "Excluded", tone: "muted" } : { label: "Input needed", tone: "warn" }
  const status = row.scope1?.status ?? row.scope2?.locationBased.status
  switch (status) {
    case "complete": return { label: "Calculated", tone: "ready" }
    case "partial": return { label: "Partial calculation", tone: "info" }
    case "provisional": return { label: "Provisional", tone: "info" }
    case "memo_only": return { label: "Reported separately", tone: "info" }
    case "excluded": return { label: "Excluded", tone: "muted" }
    case "review_required": return { label: "Review required", tone: "warn" }
    default: return { label: "Input needed", tone: "warn" }
  }
}
/** Plain reasons for a row, deduplicated; codes are kept for the export. */
export function rowReasons(row: ResultRow): string[] {
  const codes = [...(row.periodCheck === "outside" ? ["outside_reporting_period"] : row.periodCheck === "partial" ? ["partly_outside_reporting_period"] : []), ...row.plan.reasons, ...(row.refusalCode ? [row.refusalCode] : []), ...(row.scope1?.findings ?? []), ...(row.scope1?.estimates ?? []), ...(row.scope2?.findings ?? []), ...(row.scope2?.locationBased.findings ?? []), ...(row.scope2?.marketBased.findings ?? []), ...(row.scope2?.estimates ?? [])]
  if (row.outcome === "unavailable") codes.push("engine_unavailable")
  return [...new Set(codes.map(code => code === "engine_unavailable" ? "The calculation service was unavailable for this record. Try again shortly." : reasonText(code)))]
}

/** A record needs attention when it is held, not calculated, or only partly calculated. Shared by results and overview. */
export const needsWork = (row: ResultRow) => { const tone = rowStatus(row).tone; return tone === "warn" || tone === "danger" || row.scope1?.status === "partial" }
/** The dataset a register factor comes from, from its key prefix. */
export function factorSource(key: string): string {
  const prefix = key.split(".")[0]
  if (prefix === "egrid2023") return "EPA eGRID2023 rev2"
  if (prefix === "residual_mix_green_e_2025") return "Green-e 2025 residual mix"
  if (prefix === "gwp_ar5") return "EPA Hub 2025, IPCC AR5 GWP"
  return "EPA GHG Emission Factors Hub 2025"
}

import type { JourneyStatus } from "./journey-status"
import { BOUNDARY_LABELS, periodLabel } from "./plain-language"

// WO-08: the context bar's wording and values (kept out of the component file so it only exports components).
/** CEO decision O-5 (DG-P13 / N6): the period wording by scope. The Scope 3 sentence shows only while Scope 3 is on. */
export const PERIOD_BY_SCOPE = {
  scope12: "Scope 1 and 2: calendar 2025 in this beta.",
  scope3: "Scope 3 records may cover 2025–2026; each line shows its own dates.",
} as const
export const CONTEXT_TEXT = {
  label: "Reporting context",
  loading: "Loading company details…",
  failed: "Company details couldn’t be loaded",
  draft: "Draft · beta methods",
  viewOnly: "View only",
  viewOnlyDetail: "You have view access. An owner or admin of your company can make changes.",
  canEdit: "You can make changes (owner or admin).",
  noName: "Company name not set",
  notSaved: "Setup not saved",
  details: "Details",
} as const

export interface ContextValues { company: string; period: string; boundary: string; setup: string; periodNotes: string[] }

/** WO-08 (QA-200): every value is the API's company setup value (via the journey status), in the app's own labels. */
export function contextValues(status: JourneyStatus): ContextValues {
  const { setup } = status
  return {
    company: setup.legalName.trim() || CONTEXT_TEXT.noName,
    period: periodLabel(setup.period.start, setup.period.endExclusive),
    boundary: BOUNDARY_LABELS[setup.boundary] ?? setup.boundary,
    setup: setup.saved && setup.revision !== null ? `Setup v${setup.revision}` : CONTEXT_TEXT.notSaved,
    periodNotes: status.scope3 ? [PERIOD_BY_SCOPE.scope12, PERIOD_BY_SCOPE.scope3] : [PERIOD_BY_SCOPE.scope12],
  }
}

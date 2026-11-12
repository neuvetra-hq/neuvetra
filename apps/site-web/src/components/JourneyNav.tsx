import { Icon } from "./Icon"
import type { JourneyStatus } from "@/lib/journey-status"
import { ACTIVITY_KINDS } from "@/lib/plain-language"
import type { WorkspaceView } from "@/lib/view-route"

export type JourneyView = WorkspaceView

/**
 * Board decision D2 (O-2, 11 Nov 2026): the retired earlier views are not in the sidebar; `#/earlier` stays reachable by
 * URL only. Set to true to list them under "More" again.
 */
export const SHOW_RETIRED_VIEWS_IN_NAV = false

function plural(count: number, word: string) { return `${count} ${word}${count === 1 ? "" : "s"}` }

/**
 * WO-04a (CEO decision O-6): the interim "N open" count is Scope 1 and 2 items only — setup answers that affect totals,
 * records needing input, held records and possible gaps. Scope 3 open items are named separately on the Overview
 * ("Scope 3 to-do: see Results") until the full readiness definitions (WO-04b) replace this.
 */
function openScope12(status: JourneyStatus): number {
  const scope12 = (kind: string) => ACTIVITY_KINDS.some(item => item.kind === kind)
  const records = status.collection.records.filter(row => scope12(row.kind))
  return status.setup.missing.filter(item => item.scopes.length > 0).length
    + records.filter(row => row.state === "input_needed" || row.state === "review_required").length
    + records.filter(row => row.state === "held_period").length
    + status.gaps.length
}

/**
 * The app's primary navigation: the overview, the three-step journey and Ask Neuvetra. WO-08: the side navigation at
 * 1080 px and wider ("side"), and the same items inside the Menu sheet below that ("sheet").
 */
export function JourneyNav({ current, onNavigate, status, onAsk, variant = "side" }: { current: JourneyView; onNavigate: (view: JourneyView) => void; status: JourneyStatus | null; onAsk: () => void; variant?: "side" | "sheet" }) {
  const setupMeta = !status ? "" : !status.setup.saved ? "Not started" : status.setup.missing.length ? `${plural(status.setup.missing.length, "open answer")}` : `Saved · version ${status.setup.revision}`
  const collectionMeta = !status ? "" : !status.collection.active ? "No records yet" : status.collection.attention ? `${plural(status.collection.active, "record")} · ${status.collection.attention} input needed` : status.collection.held ? `${plural(status.collection.active, "record")} · ${status.collection.held} held` : status.gaps.length ? `${plural(status.collection.active, "record")} · ${plural(status.gaps.length, "possible gap")}` : plural(status.collection.active, "record")
  const resultsMeta = !status ? "" : status.collection.ready ? `Draft results available · ${openScope12(status)} open` : status.collection.active ? "Nothing to calculate yet" : "Add records first"
  // WO-04a (PROD-B01 interim, O-7): while Scope 3 is on, its open items aren't checked here, so no step shows a ✓ or "(done)".
  const scope3 = Boolean(status?.scope3)
  const items: Array<{ view: JourneyView; step: string | null; title: string; meta: string; done: boolean }> = [
    { view: "home", step: null, title: "Overview", meta: status ? status.next.title : "", done: false },
    { view: "setup", step: "1", title: "Company setup", meta: setupMeta, done: !scope3 && status?.progress.setup === "done" },
    { view: "collection", step: "2", title: "Activity & evidence", meta: collectionMeta, done: !scope3 && status?.progress.collection === "done" },
    { view: "results", step: "3", title: "Results & report", meta: resultsMeta, done: false },
  ]
  return <nav className={variant === "sheet" ? "nv-sheetnav" : "nv-sidenav"} aria-label="Workspace">
    <p className="nv-sidenav__label">Your inventory</p>
    {items.map(item => <button type="button" key={item.view} className="nv-navitem" aria-current={current === item.view ? "page" : undefined} onClick={() => onNavigate(item.view)}>
      <span className={`nv-navitem__icon${item.done && current !== item.view ? " nv-navitem__icon--done" : ""}`} aria-hidden="true">{item.step === null ? <Icon name="home" size={16} /> : item.done ? <Icon name="check" size={16} /> : item.step}</span>
      <span className="nv-navitem__title">{item.step ? <span className="nv-sr">Step {item.step}: </span> : null}{item.title}{item.done ? <span className="nv-sr"> (done)</span> : null}</span>
      <span className="nv-navitem__meta">{item.meta}</span>
    </button>)}
    <p className="nv-sidenav__label">More</p>
    {SHOW_RETIRED_VIEWS_IN_NAV && <button type="button" className="nv-navitem" aria-current={current === "archive" ? "page" : undefined} onClick={() => onNavigate("archive")}>
      <span className="nv-navitem__icon" aria-hidden="true"><Icon name="archive" size={16} /></span>
      <span className="nv-navitem__title">Earlier workspace views (retired)</span>
      <span className="nv-navitem__meta">For reference only</span>
    </button>}
    <button type="button" className="nv-navitem" onClick={onAsk}>
      <span className="nv-navitem__icon" aria-hidden="true"><Icon name="help" size={16} /></span>
      <span className="nv-navitem__title">Ask Neuvetra</span>
      <span className="nv-navitem__meta">Help with any field or flag</span>
    </button>
    <div className="nv-sidenav__help"><p>Setup saves at 07 Review; each record saves on its own. Unknown answers stay visible and are never counted as zero.</p></div>
  </nav>
}

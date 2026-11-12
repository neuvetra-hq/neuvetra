import { Icon } from "./Icon"
import { READINESS_TEXT, type Readiness } from "@/lib/readiness"
import type { WorkspaceView } from "@/lib/view-route"

export type JourneyView = WorkspaceView

/**
 * Board decision D2 (O-2, 11 Nov 2026): the retired earlier views are not in the sidebar; `#/earlier` stays reachable by
 * URL only. Set to true to list them under "More" again.
 */
export const SHOW_RETIRED_VIEWS_IN_NAV = false

/**
 * The app's primary navigation: the overview, the three-step journey and Ask Neuvetra. WO-08: the side navigation at
 * 1080 px and wider ("side"), and the same items inside the Menu sheet below that ("sheet"). WO-04b: every status line
 * comes from the one readiness (lib/readiness.ts) the Overview and Ask read, so they agree; while it is checking or
 * couldn't check, each line says so and no step shows a ✓.
 */
export function JourneyNav({ current, onNavigate, readiness, onAsk, variant = "side" }: { current: JourneyView; onNavigate: (view: JourneyView) => void; readiness: Readiness; onAsk: () => void; variant?: "side" | "sheet" }) {
  const ready = readiness.state === "ready" ? readiness : null
  const pending = readiness.state === "checking" ? READINESS_TEXT.checking : readiness.state === "failed" ? READINESS_TEXT.failed : ""
  const items: Array<{ view: JourneyView; step: string | null; title: string; meta: string; done: boolean }> = [
    { view: "home", step: null, title: "Overview", meta: ready ? ready.next.title : pending, done: false },
    { view: "setup", step: "1", title: "Company setup", meta: ready ? ready.s1.text : pending, done: Boolean(ready?.s1.done) },
    { view: "collection", step: "2", title: "Activity & evidence", meta: ready ? ready.s2.text : pending, done: Boolean(ready?.s2.done) },
    // S3 is never a ✓.
    { view: "results", step: "3", title: "Results & report", meta: ready ? ready.s3.text : pending, done: false },
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

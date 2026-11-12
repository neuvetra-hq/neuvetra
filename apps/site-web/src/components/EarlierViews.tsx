import type { RefObject } from "react"
import { viewHash, type WorkspaceView } from "@/lib/view-route"

type CurrentView = Extract<WorkspaceView, "setup" | "collection" | "results">

const CURRENT_VIEW_NAMES: Record<CurrentView, string> = { setup: "Company setup", collection: "Activity & evidence", results: "Results & report" }

/** The retired milestone views, by plain name, with the current journey view that replaced each (WO-07). Static: no data is loaded. */
const RETIRED_VIEWS: ReadonlyArray<{ name: string; useInstead: CurrentView }> = [
  { name: "Earlier Scope 1 setup", useInstead: "setup" },
  { name: "Corporate coverage", useInstead: "setup" },
  { name: "Scope 1 inventory", useInstead: "results" },
  { name: "Stationary natural gas", useInstead: "collection" },
  { name: "Stationary diesel generator", useInstead: "collection" },
  { name: "Stationary equipment coverage", useInstead: "collection" },
  { name: "Mobile diesel vehicles", useInstead: "collection" },
  { name: "Fleet reconciliation", useInstead: "collection" },
  { name: "Refrigerants and fire suppression", useInstead: "collection" },
  { name: "Annual electricity and bills", useInstead: "collection" },
  { name: "Full-year electricity", useInstead: "collection" },
  { name: "Bill-linked electricity worksheet", useInstead: "collection" },
  { name: "Electricity worksheet", useInstead: "collection" },
  { name: "Saved example report", useInstead: "results" },
]

/** `#/earlier`: a static, read-only list of the retired milestone views. No retired panel is mounted, so nothing can be read or changed here. */
export function EarlierViews({ headingRef, onNavigate }: { headingRef: RefObject<HTMLHeadingElement | null>; onNavigate: (view: CurrentView) => void }) {
  return <section>
    <h1 ref={headingRef} tabIndex={-1}>Earlier workspace views (retired)</h1>
    <p className="nv-lead">These milestone views were replaced by Company setup, Activity & evidence and Results & report. They’re listed for reference only; no data is shown and nothing can be changed here.</p>
    <div className="nv-card nv-card--flat">
      <ul className="nv-list">{RETIRED_VIEWS.map(view => <li key={view.name}>
        <span className="nv-list__main"><span className="nv-list__title">{view.name}</span> <span className="nv-chip nv-chip--muted nv-chip--plain">Retired</span><br />
          <span className="nv-subtle">Use instead: <a className="nv-link" href={viewHash(view.useInstead)} onClick={event => { event.preventDefault(); onNavigate(view.useInstead) }}>{CURRENT_VIEW_NAMES[view.useInstead]}</a></span></span>
      </li>)}</ul>
    </div>
  </section>
}

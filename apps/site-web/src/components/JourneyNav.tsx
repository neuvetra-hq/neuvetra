import { Icon } from "./Icon"
import type { JourneyStatus } from "@/lib/journey-status"

export type JourneyView = "home" | "setup" | "collection" | "results" | "archive"

function plural(count: number, word: string) { return `${count} ${word}${count === 1 ? "" : "s"}` }

/** The app's primary navigation: the three-step journey, the overview and the earlier views. */
export function JourneyNav({ current, onNavigate, status, onAsk }: { current: JourneyView; onNavigate: (view: JourneyView) => void; status: JourneyStatus | null; onAsk: () => void }) {
  const setupMeta = !status ? "" : !status.setup.saved ? "Not started" : status.setup.missing.length ? `${plural(status.setup.missing.length, "item")} to finish` : `Saved · version ${status.setup.revision}`
  const collectionMeta = !status ? "" : !status.collection.active ? "No records yet" : status.collection.attention ? `${plural(status.collection.active, "record")} · ${status.collection.attention} input needed` : plural(status.collection.active, "record")
  const resultsMeta = !status ? "" : status.collection.ready ? "Draft ready to review" : "Add records first"
  const items: Array<{ view: JourneyView; step: string | null; title: string; meta: string; done: boolean }> = [
    { view: "home", step: null, title: "Overview", meta: status ? status.next.title : "", done: false },
    { view: "setup", step: "1", title: "Company setup", meta: setupMeta, done: status?.progress.setup === "done" },
    { view: "collection", step: "2", title: "Activity & evidence", meta: collectionMeta, done: status?.progress.collection === "done" },
    { view: "results", step: "3", title: "Results & report", meta: resultsMeta, done: false },
  ]
  return <nav className="nv-sidenav" aria-label="Workspace">
    <p className="nv-sidenav__label">Your inventory</p>
    {items.map(item => <button type="button" key={item.view} className="nv-navitem" aria-current={current === item.view ? "page" : undefined} onClick={() => onNavigate(item.view)}>
      <span className={`nv-navitem__icon${item.done && current !== item.view ? " nv-navitem__icon--done" : ""}`} aria-hidden="true">{item.step === null ? <Icon name="home" size={16} /> : item.done ? <Icon name="check" size={16} /> : item.step}</span>
      <span className="nv-navitem__title">{item.step ? <span className="nv-sr">Step {item.step}: </span> : null}{item.title}{item.done ? <span className="nv-sr"> (done)</span> : null}</span>
      <span className="nv-navitem__meta">{item.meta}</span>
    </button>)}
    <p className="nv-sidenav__label">More</p>
    <button type="button" className="nv-navitem" aria-current={current === "archive" ? "page" : undefined} onClick={() => onNavigate("archive")}>
      <span className="nv-navitem__icon" aria-hidden="true"><Icon name="archive" size={16} /></span>
      <span className="nv-navitem__title">Earlier workspace views</span>
      <span className="nv-navitem__meta">Registers and worksheets</span>
    </button>
    <button type="button" className="nv-navitem" onClick={onAsk}>
      <span className="nv-navitem__icon" aria-hidden="true"><Icon name="help" size={16} /></span>
      <span className="nv-navitem__title">Ask Neuvetra</span>
      <span className="nv-navitem__meta">Help with any field or flag</span>
    </button>
    <div className="nv-sidenav__help"><p>Everything saves as a draft. Unknown answers stay visible and are never counted as zero.</p></div>
  </nav>
}

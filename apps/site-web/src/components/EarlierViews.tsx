import type { RefObject } from "react"
import { Icon } from "./Icon"

export interface EarlierView { id: string; label: string; description: string }

/** The earlier milestone screens, one click away but out of the main journey (Sept 24 UX review). */
export function EarlierViews({ groups, onOpen, headingRef }: { groups: Array<{ title: string; views: EarlierView[] }>; onOpen: (id: string) => void; headingRef: RefObject<HTMLHeadingElement | null> }) {
  return <section>
    <p className="nv-eyebrow">More</p>
    <h1 ref={headingRef} tabIndex={-1}>Earlier workspace views</h1>
    <p className="nv-lead">Registers and worksheets from earlier milestones, kept for reference and review. New work belongs in Company setup and Activity & evidence.</p>
    {groups.map(group => <div className="nv-card nv-card--flat" key={group.title}>
      <h2 className="nv-h3">{group.title}</h2>
      <ul className="nv-list">{group.views.map(view => <li key={view.id}>
        <span className="nv-list__main"><span className="nv-list__title">{view.label}</span><br /><span className="nv-subtle">{view.description}</span></span>
        <button type="button" className="nv-btn nv-btn--sm" onClick={() => onOpen(view.id)}>Open<Icon name="arrow" size={16} /></button>
      </li>)}</ul>
    </div>)}
  </section>
}

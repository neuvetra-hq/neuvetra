import { useEffect, useId, useRef, useState, type RefObject } from "react"
import type { JourneyStatus } from "@/lib/journey-status"
import { CONTEXT_TEXT, contextValues } from "@/lib/context-values"

/**
 * The sticky chrome publishes its real heights (QA measured the top bar at 61 px against a 69 px token), so headings,
 * jump targets and the side navigation land below whatever is sticky at this width. wo08.css turns these into
 * --nv-topbar-h and --nv-contextbar-h, and zeroes them where a bar isn't sticky (short viewports).
 */
function useChromeHeights(bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = bar.current, topbar = element?.parentElement?.querySelector<HTMLElement>(".nv-topbar") ?? null
    if (!element || typeof ResizeObserver === "undefined") return
    const root = document.documentElement
    const publish = () => {
      root.style.setProperty("--nv-contextbar-measured", `${Math.ceil(element.getBoundingClientRect().height)}px`)
      if (topbar) root.style.setProperty("--nv-topbar-measured", `${Math.ceil(topbar.getBoundingClientRect().height)}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    if (topbar) observer.observe(topbar)
    return () => { observer.disconnect(); root.style.removeProperty("--nv-contextbar-measured"); root.style.removeProperty("--nv-topbar-measured") }
  }, [bar])
}

/**
 * WO-08: which company, period, setup version and role every view shows. Below 720 px only the company and period (and
 * "View only" for a member) stay on the bar; the rest is under "Details ▸", which also gives the period wording by scope.
 */
export function ContextBar({ status, failed, canManage, inert }: { status: JourneyStatus | null; failed: boolean; canManage: boolean; inert?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const id = useId()
  useChromeHeights(ref)
  const values = status ? contextValues(status) : null
  const sep = <span className="nv-contextbar__sep" aria-hidden="true">·</span>
  return <div className="nv-contextbar" role="region" aria-label={CONTEXT_TEXT.label} ref={ref} inert={inert || undefined}
    onKeyDown={event => { if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); toggle.current?.focus() } }}>
    <div className="nv-contextbar__inner">
      <p className="nv-contextbar__line">
        {values ? <>
          <span className="nv-contextbar__item nv-contextbar__company" data-context="company">{values.company}</span>{sep}
          <span className="nv-contextbar__item" data-context="period">{values.period}</span>
          <span className="nv-contextbar__wide">{sep}<span className="nv-contextbar__item" data-context="boundary">{values.boundary}</span>{sep}
            <span className="nv-contextbar__item" data-context="setup">{values.setup}</span>{sep}
            <span className="nv-contextbar__item" data-context="state">{CONTEXT_TEXT.draft}</span></span>
        </> : <span className="nv-contextbar__item nv-contextbar__muted">{failed ? CONTEXT_TEXT.failed : CONTEXT_TEXT.loading}</span>}
        {!canManage && <span className="nv-contextbar__badge" data-context="access">{CONTEXT_TEXT.viewOnly}</span>}
      </p>
      {values && <button type="button" ref={toggle} className="nv-contextbar__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        {CONTEXT_TEXT.details}<span className="nv-contextbar__chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>}
    </div>
    {values && open && <div className="nv-contextbar__details" id={id}>
      <dl>
        <div><dt>Company</dt><dd>{values.company}</dd></div>
        <div><dt>Reporting period</dt><dd>{values.period}{values.periodNotes.map(note => <span key={note} className="nv-contextbar__note">{note}</span>)}</dd></div>
        <div><dt>Boundary</dt><dd>{values.boundary}</dd></div>
        <div><dt>Company setup</dt><dd>{values.setup}</dd></div>
        <div><dt>Figures</dt><dd>{CONTEXT_TEXT.draft}</dd></div>
        <div><dt>Your access</dt><dd>{canManage ? CONTEXT_TEXT.canEdit : `${CONTEXT_TEXT.viewOnly}. ${CONTEXT_TEXT.viewOnlyDetail}`}</dd></div>
      </dl>
    </div>}
  </div>
}

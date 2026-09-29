import type { RefObject } from "react"
import { Icon } from "./Icon"
import type { JourneyView } from "./JourneyNav"
import type { JourneyStatus } from "@/lib/journey-status"
import { ACTIVITY_KINDS, BOUNDARY_LABELS, kindIcon, periodLabel, RECORD_STATE_LABELS, RECORD_STATE_TONE } from "@/lib/plain-language"

export function JourneyHome({ status, error, headingRef, onNavigate, onAsk, onRetry, onFix }: {
  status: JourneyStatus | null; error: string | null; headingRef: RefObject<HTMLHeadingElement | null>
  onNavigate: (view: JourneyView) => void; onAsk: () => void; onRetry: () => void; onFix: (recordId: string) => void
}) {
  if (!status) return <section aria-busy={!error}>
    <p className="nv-eyebrow">Overview</p>
    <h1 ref={headingRef} tabIndex={-1}>Your reporting workspace</h1>
    {error ? <div className="nv-notice nv-notice--error" role="alert"><Icon name="alert" /><div><p>{error}</p><div className="nv-actions" style={{ marginTop: 10 }}><button type="button" className="nv-btn nv-btn--sm" onClick={onRetry}>Try again</button></div></div></div>
      : <p className="nv-lead" role="status">Loading your progress…</p>}
  </section>
  const { setup, collection, evidence, next, progress } = status
  const name = setup.legalName || "Your company"
  const stepState = (key: "setup" | "collection" | "results") => {
    if (key === "results") return next.panel === "results" ? "current" : "todo"
    if (progress[key] === "done") return "done"
    return next.panel === key ? "current" : "todo"
  }
  const attention = collection.records.filter(row => row.state === "input_needed" || row.state === "review_required")
  const percent = Math.round(((progress.setup === "done" ? 1 : progress.setup === "in_progress" ? .5 : 0) + (progress.collection === "done" ? 1 : progress.collection === "in_progress" ? .5 : 0) + (next.panel === "results" ? 1 : 0)) / 3 * 100)
  return <section>
    <p className="nv-eyebrow">Overview</p>
    <h1 ref={headingRef} tabIndex={-1}>{setup.saved ? name : "Welcome to Neuvetra"}</h1>
    <p className="nv-lead">{setup.saved
      ? `${periodLabel(setup.period.start, setup.period.endExclusive)} · ${BOUNDARY_LABELS[setup.boundary] ?? setup.boundary} · ${setup.sites.included} of ${setup.sites.total} site${setup.sites.total === 1 ? "" : "s"} included`
      : "Three steps take you from company details to a draft Scope 1 and Scope 2 report. Your progress saves as you go."}</p>

    <div className="nv-card nv-card--accent">
      <div className="nv-card__head">
        <div><p className="nv-eyebrow" style={{ marginBottom: 4 }}>Next step</p><h2 className="nv-h2">{next.title}</h2></div>
        <span className="nv-subtle nv-num" aria-label={`About ${percent}% of the journey done`}>{percent}% done</span>
      </div>
      <div className="nv-progress" aria-hidden="true" style={{ marginBottom: 14 }}><span style={{ width: `${Math.max(percent, 4)}%` }} /></div>
      <p className="nv-muted" style={{ marginTop: 0 }}>{next.body}</p>
      <div className="nv-actions">
        <button type="button" className="nv-btn nv-btn--primary" onClick={() => next.recordId ? onFix(next.recordId) : onNavigate(next.panel)}>{next.action}<Icon name="arrow" size={18} /></button>
        <button type="button" className="nv-btn nv-btn--ghost" onClick={onAsk}><Icon name="help" size={18} />Ask a question</button>
      </div>
    </div>

    <h2 className="nv-h2" style={{ marginTop: 28 }}>Your three steps</h2>
    <div className="nv-journey" style={{ marginTop: 12 }}>
      <button type="button" className="nv-journey__step" data-state={stepState("setup")} onClick={() => onNavigate("setup")}>
        <span className="nv-journey__num" aria-hidden="true">{stepState("setup") === "done" ? <Icon name="check" size={16} /> : 1}</span>
        <span className="nv-journey__title">Company setup</span>
        <span className="nv-journey__meta">{!setup.saved ? "Not started — about 10 minutes" : setup.missing.length ? `Saved · ${setup.missing.length} item${setup.missing.length === 1 ? "" : "s"} to finish` : `Complete · version ${setup.revision}`}</span>
      </button>
      <button type="button" className="nv-journey__step" data-state={stepState("collection")} onClick={() => onNavigate("collection")}>
        <span className="nv-journey__num" aria-hidden="true">{stepState("collection") === "done" ? <Icon name="check" size={16} /> : 2}</span>
        <span className="nv-journey__title">Activity & evidence</span>
        <span className="nv-journey__meta">{!collection.active ? "No records yet" : `${collection.active} record${collection.active === 1 ? "" : "s"} · ${collection.attention ? `${collection.attention} input needed` : "all complete"}`}</span>
      </button>
      <button type="button" className="nv-journey__step" data-state={stepState("results")} onClick={() => onNavigate("results")}>
        <span className="nv-journey__num" aria-hidden="true">3</span>
        <span className="nv-journey__title">Results & report</span>
        <span className="nv-journey__meta">{collection.ready ? `${collection.ready} record${collection.ready === 1 ? "" : "s"} ready to calculate` : "Available once records are complete"}</span>
      </button>
    </div>

    <div className="nv-grid-2" style={{ marginTop: 18 }}>
      <div className="nv-card nv-card--flat" style={{ margin: 0 }}>
        <h2 className="nv-h3">What needs attention</h2>
        {!setup.missing.length && !attention.length && evidence.checking === 0
          ? <p className="nv-muted">Nothing is waiting on you right now.</p>
          : <ul className="nv-list">
            {setup.missing.map(item => <li key={item}><span className="nv-list__main"><span className="nv-list__title">{item}</span><br /><span className="nv-subtle">Company setup</span></span><button type="button" className="nv-btn nv-btn--sm" onClick={() => onNavigate("setup")}>Open</button></li>)}
            {attention.slice(0, 5).map(row => <li key={row.id}><span className="nv-list__main"><span className="nv-list__title">{row.label} · {row.sourceId}</span><br /><span className="nv-subtle">{row.reasons[0] ?? RECORD_STATE_LABELS[row.state]}</span></span><button type="button" className="nv-btn nv-btn--sm" onClick={() => onFix(row.id)}>Fix</button></li>)}
            {attention.length > 5 && <li><span className="nv-subtle">and {attention.length - 5} more in Activity & evidence</span></li>}
            {evidence.checking > 0 && <li><span className="nv-list__main"><span className="nv-list__title">{evidence.checking} file{evidence.checking === 1 ? " is" : "s are"} being checked</span><br /><span className="nv-subtle">You can keep working; files can be downloaded once cleared.</span></span></li>}
          </ul>}
      </div>
      <div className="nv-card nv-card--flat" style={{ margin: 0 }}>
        <h2 className="nv-h3">Your records</h2>
        {!collection.active ? <p className="nv-muted">No activity records yet. Most companies start with a gas or electricity bill.</p> :
          <ul className="nv-list">{ACTIVITY_KINDS.filter(kind => collection.byKind[kind.kind]).map(kind => <li key={kind.kind}>
            <span className="nv-list__main" style={{ display: "flex", gap: 10, alignItems: "center" }}><Icon name={kindIcon(kind.kind)} size={18} /><span>{kind.label}</span></span>
            <span className="nv-num nv-muted">{collection.byKind[kind.kind]}</span>
          </li>)}</ul>}
        <p className="nv-subtle" style={{ marginBottom: 0 }}>{evidence.total} evidence file{evidence.total === 1 ? "" : "s"} · {evidence.cleared} cleared{evidence.checking ? ` · ${evidence.checking} being checked` : ""}{evidence.rejected ? ` · ${evidence.rejected} rejected` : ""}</p>
        <div className="nv-actions" style={{ marginTop: 12 }}><button type="button" className="nv-btn nv-btn--sm" onClick={() => onNavigate("collection")}><Icon name="plus" size={16} />Add activity</button></div>
      </div>
    </div>

    {collection.records.length > 0 && <details className="nv-detail" style={{ marginTop: 18 }}>
      <summary>See every record’s status</summary>
      <ul className="nv-list" style={{ marginTop: 8 }}>{collection.records.map(row => <li key={row.id}><span className="nv-list__main"><span className="nv-list__title">{row.label} · {row.sourceId}</span><br /><span className="nv-subtle">{row.site}</span></span><span className={`nv-chip nv-chip--${RECORD_STATE_TONE[row.state]}`}>{RECORD_STATE_LABELS[row.state]}</span></li>)}</ul>
    </details>}
  </section>
}

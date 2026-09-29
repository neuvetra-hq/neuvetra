import type { RefObject } from "react"
import { Icon } from "./Icon"
import type { JourneyView } from "./JourneyNav"
import type { JourneyStatus } from "@/lib/journey-status"
import { ACTIVITY_KINDS, BOUNDARY_LABELS, kindIcon, periodLabel, RECORD_STATE_LABELS, RECORD_STATE_TONE } from "@/lib/plain-language"

function plural(count: number, one: string, many = `${one}s`) { return `${count} ${count === 1 ? one : many}` }

export function JourneyHome({ status, error, headingRef, onNavigate, onAsk, onRetry, onFix }: {
  status: JourneyStatus | null; error: string | null; headingRef: RefObject<HTMLHeadingElement | null>
  onNavigate: (view: JourneyView) => void; onAsk: () => void; onRetry: () => void; onFix: (recordId: string) => void
}) {
  if (!status) return <section aria-busy={!error}>
    <p className="nv-eyebrow">Overview</p>
    <h1 ref={headingRef} tabIndex={-1}>Your reporting workspace</h1>
    {error ? <div className="nv-notice nv-notice--error" role="alert"><Icon name="alert" /><div><p><strong>Your progress couldn’t be loaded.</strong> {error}</p><div className="nv-actions" style={{ marginTop: 10 }}><button type="button" className="nv-btn nv-btn--sm" onClick={onRetry}>Try again</button></div></div></div>
      : <p className="nv-lead" role="status">Loading your progress…</p>}
  </section>
  const { setup, collection, evidence, next, progress, gaps, canManage } = status
  const name = setup.legalName || "Your company"
  const stepState = (key: "setup" | "collection" | "results") => {
    if (key === "results") return next.panel === "results" ? "current" : "todo"
    if (progress[key] === "done") return "done"
    return next.panel === key ? "current" : "todo"
  }
  const mustFix = collection.records.filter(row => row.state === "input_needed" || row.state === "review_required")
  const heldRows = collection.records.filter(row => row.state === "held_period")
  const improve: Array<{ key: string; title: string; detail: string }> = []
  if (collection.partial) improve.push({ key: "partial", title: `${plural(collection.partial, "record is", "records are")} only partly calculated`, detail: "For vehicles, add miles driven or fuel economy to include CH4 and N2O." })
  if (collection.noEvidence) improve.push({ key: "evidence", title: `${plural(collection.noEvidence, "record has", "records have")} no evidence linked`, detail: "Attach the bill or log so a reviewer can trace the figure." })
  if (collection.olderSetup && canManage) improve.push({ key: "older-setup", title: `${plural(collection.olderSetup, "record was", "records were")} saved before your latest company-setup change`, detail: "When you next edit one, choose its site again before saving — the form asks for a current site." })
  if (collection.qualityUnknown) improve.push({ key: "quality", title: `${plural(collection.qualityUnknown, "record has", "records have")} data quality “Unknown”`, detail: "Mark each record as actual or estimated." })
  const nothingFlagged = !setup.missing.length && !mustFix.length && !heldRows.length && !gaps.length && !improve.length && evidence.checking === 0
  return <section>
    <p className="nv-eyebrow">Overview</p>
    <h1 ref={headingRef} tabIndex={-1}>{setup.saved ? name : "Welcome to Neuvetra"}</h1>
    <p className="nv-lead">{setup.saved
      ? `${periodLabel(setup.period.start, setup.period.endExclusive)} · ${BOUNDARY_LABELS[setup.boundary] ?? setup.boundary} · ${setup.sites.included} of ${plural(setup.sites.total, "site")} included`
      : "Three steps take you from company details to a draft Scope 1 and Scope 2 report. Your progress saves as you go."}</p>

    <div className="nv-card nv-card--accent">
      <p className="nv-eyebrow" style={{ marginBottom: 4 }}>Next step</p>
      <h2 className="nv-h2">{next.title}</h2>
      <p className="nv-muted" style={{ marginTop: 6 }}>{next.body}</p>
      <div className="nv-actions">
        <button type="button" className="nv-btn nv-btn--primary" onClick={() => next.recordId ? onFix(next.recordId) : onNavigate(next.panel)}>{next.action}<Icon name="arrow" size={18} /></button>
        {next.secondary && <button type="button" className="nv-btn" onClick={() => onNavigate(next.secondary!.panel)}>{next.secondary.action}</button>}
        <button type="button" className="nv-btn nv-btn--ghost" onClick={onAsk}><Icon name="help" size={18} />Ask a question</button>
      </div>
    </div>

    <h2 className="nv-h2" style={{ marginTop: 28 }}>Your three steps</h2>
    <div className="nv-journey" style={{ marginTop: 12 }}>
      <button type="button" className="nv-journey__step" data-state={stepState("setup")} onClick={() => onNavigate("setup")}>
        <span className="nv-journey__num" aria-hidden="true">{stepState("setup") === "done" ? <Icon name="check" size={16} /> : 1}</span>
        <span className="nv-journey__title">Company setup</span>
        <span className="nv-journey__meta">{!setup.saved ? "Not started — about 10 minutes" : setup.missing.length ? `Saved · ${plural(setup.missing.length, "open answer")}` : `Complete · version ${setup.revision}`}</span>
      </button>
      <button type="button" className="nv-journey__step" data-state={stepState("collection")} onClick={() => onNavigate("collection")}>
        <span className="nv-journey__num" aria-hidden="true">{stepState("collection") === "done" ? <Icon name="check" size={16} /> : 2}</span>
        <span className="nv-journey__title">Activity & evidence</span>
        <span className="nv-journey__meta">{!collection.active ? "No records yet" : [plural(collection.active, "record"), mustFix.length ? `${mustFix.length} input needed` : "", heldRows.length ? `${heldRows.length} held — outside the reporting period` : "", gaps.length ? plural(gaps.length, "possible gap") : "", !mustFix.length && !heldRows.length && !gaps.length ? "none waiting on input" : ""].filter(Boolean).join(" · ")}</span>
      </button>
      <button type="button" className="nv-journey__step" data-state={stepState("results")} onClick={() => onNavigate("results")}>
        <span className="nv-journey__num" aria-hidden="true">3</span>
        <span className="nv-journey__title">Results & report</span>
        <span className="nv-journey__meta">{collection.ready ? `${plural(collection.ready, "record")} can be calculated` : collection.active ? "No record can be calculated yet" : "Available once a record is complete"}</span>
      </button>
    </div>

    <div className="nv-grid-2" style={{ marginTop: 18 }}>
      <div className="nv-card nv-card--flat" style={{ margin: 0 }}>
        <h2 className="nv-h3">What needs attention</h2>
        {nothingFlagged ? <p className="nv-muted">{collection.active ? "Nothing is flagged. Review your draft results." : "No records yet — start with the next step above."}</p> : <>
          {(setup.missing.length > 0 || mustFix.length > 0) && <p className="nv-attn-label nv-attn-label--warn">Input needed</p>}
          <ul className="nv-list">
            {setup.missing.slice(0, 6).map(item => <li key={item.id}><span className="nv-list__main"><span className="nv-list__title">{item.title}</span><br /><span className="nv-subtle">Company setup · {item.detail}</span></span><button type="button" className="nv-btn nv-btn--sm" aria-label={`${canManage ? "Open" : "View"} company setup: ${item.title}`} onClick={() => onNavigate("setup")}>{canManage ? "Open" : "View"}</button></li>)}
            {setup.missing.length > 6 && <li><span className="nv-subtle">and {setup.missing.length - 6} more in Company setup</span></li>}
            {mustFix.slice(0, 5).map(row => <li key={row.id}><span className="nv-list__main"><span className="nv-list__title">{row.label} · {row.sourceId}</span><br /><span className="nv-subtle">{row.reasons[0] ?? RECORD_STATE_LABELS[row.state]}</span></span><button type="button" className="nv-btn nv-btn--sm" aria-label={`${canManage ? "Fix" : "View"} ${row.label} · ${row.sourceId}`} onClick={() => onFix(row.id)}>{canManage ? "Fix" : "View"}</button></li>)}
            {mustFix.length > 5 && <li><span className="nv-subtle">and {mustFix.length - 5} more in Activity & evidence</span></li>}
          </ul>
          {heldRows.length > 0 && <><p className="nv-attn-label nv-attn-label--warn">Outside reporting period</p><ul className="nv-list">
            {heldRows.slice(0, 5).map(row => <li key={row.id}><span className="nv-list__main"><span className="nv-list__title">{row.label} · {row.sourceId}</span><br /><span className="nv-subtle">{row.reasons[0]}</span></span><button type="button" className="nv-btn nv-btn--sm" aria-label={`${canManage ? "Open" : "View"} company setup for ${row.label} · ${row.sourceId}`} onClick={() => onNavigate("setup")}>{canManage ? "Open setup" : "View setup"}</button></li>)}
            {heldRows.length > 5 && <li><span className="nv-subtle">and {heldRows.length - 5} more</span></li>}
          </ul></>}
          {gaps.length > 0 && <><p className="nv-attn-label nv-attn-label--info">Possible gaps</p><ul className="nv-list">
            {gaps.slice(0, 5).map(gap => <li key={gap.id}><span className="nv-list__main"><span className="nv-list__title">{gap.title}</span><br />{canManage && <span className="nv-subtle">{gap.detail}</span>}{gap.note && <>{canManage && <br />}<span className="nv-subtle">Note: {gap.note}</span></>}</span>{canManage && <button type="button" className="nv-btn nv-btn--sm" aria-label={`Add a record: ${gap.title}`} onClick={() => onNavigate("collection")}>Add</button>}</li>)}
            {gaps.length > 5 && <li><span className="nv-subtle">and {gaps.length - 5} more</span></li>}
          </ul></>}
          {(improve.length > 0 || evidence.checking > 0) && <><p className="nv-attn-label">Can be improved</p><ul className="nv-list">
            {improve.map(item => <li key={item.key}><span className="nv-list__main"><span className="nv-list__title">{item.title}</span>{canManage && <><br /><span className="nv-subtle">{item.detail}</span></>}</span><button type="button" className="nv-btn nv-btn--sm" aria-label={`${item.key === "partial" ? "See" : canManage ? "Open" : "View"}: ${item.title}`} onClick={() => onNavigate(item.key === "partial" ? "results" : "collection")}>{item.key === "partial" ? "See" : canManage ? "Open" : "View"}</button></li>)}
            {evidence.checking > 0 && <li><span className="nv-list__main"><span className="nv-list__title">{plural(evidence.checking, "file")} with scan pending</span><br /><span className="nv-subtle">You can keep working; files can be downloaded once cleared.</span></span></li>}
          </ul></>}
        </>}
      </div>
      <div className="nv-card nv-card--flat" style={{ margin: 0 }}>
        <h2 className="nv-h3">Your records</h2>
        {!collection.active ? <p className="nv-muted">No activity records yet. Most companies start with a gas or electricity bill.</p> :
          <ul className="nv-list">{ACTIVITY_KINDS.filter(kind => collection.byKind[kind.kind]).map(kind => <li key={kind.kind}>
            <span className="nv-list__main" style={{ display: "flex", gap: 10, alignItems: "center" }}><Icon name={kindIcon(kind.kind)} size={18} /><span>{kind.label}</span></span>
            <span className="nv-num nv-muted">{collection.byKind[kind.kind]}</span>
          </li>)}</ul>}
        <p className="nv-subtle" style={{ marginBottom: 0 }}>{plural(evidence.total, "evidence file")} · {evidence.cleared} cleared{evidence.checking ? ` · ${evidence.checking} scan pending` : ""}{evidence.rejected ? ` · ${evidence.rejected} rejected` : ""}</p>
        {canManage && <div className="nv-actions" style={{ marginTop: 12 }}><button type="button" className="nv-btn nv-btn--sm" onClick={() => onNavigate("collection")}><Icon name="plus" size={16} />Add activity</button></div>}
      </div>
    </div>

    {collection.records.length > 0 && <details className="nv-detail" style={{ marginTop: 18 }}>
      <summary>See every record’s status</summary>
      <ul className="nv-list" style={{ marginTop: 8 }}>{collection.records.map(row => <li key={row.id}><span className="nv-list__main"><span className="nv-list__title">{row.label} · {row.sourceId}</span><br /><span className="nv-subtle">{row.site}</span></span><span className={`nv-chip nv-chip--${RECORD_STATE_TONE[row.state]}`}>{RECORD_STATE_LABELS[row.state]}</span></li>)}</ul>
    </details>}
  </section>
}

import type { RefObject } from "react"
import { Icon } from "./Icon"
import type { JourneyView } from "./JourneyNav"
import type { JourneyStatus } from "@/lib/journey-status"
import { ACTIVITY_KINDS, BOUNDARY_LABELS, kindIcon, periodLabel, RECORD_STATE_LABELS, RECORD_STATE_TONE, SCOPE3_ACTIVITY_KINDS } from "@/lib/plain-language"
import { COPY_TEXT_R2E } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
// Round 3 lane C (PR-3): imported spend lines are one item that opens the spend import's grouped review.
import { requestSpendImportFocus } from "@/lib/spend-import-target"
import { READINESS_GROUP_TEXT, READINESS_GROUPS, READINESS_TEXT, OVERVIEW_SCOPE3_TEXT, type Readiness, type ReadinessTarget } from "@/lib/readiness"

function plural(count: number, one: string, many = `${one}s`) { return `${count} ${count === 1 ? one : many}` }

// WO-04a (decision O-4): site-web's own save copy replaces the database package's Scope 3 home lead (QA-B02), which is
// Codex-owned and can retire later.
const homeLead = (scope3: boolean) => `Three steps take you from company details to a draft Scope 1 and Scope 2 report${scope3 ? ", with Scope 3 reported separately" : ""}. Company setup is saved when you press Save setup in 07 Review; each activity record is saved on its own.`

export function JourneyHome({ status, readiness, error, headingRef, onNavigate, onAsk, onRetry, onRetryScope3, onFix }: {
  status: JourneyStatus | null; readiness: Readiness; error: string | null; headingRef: RefObject<HTMLHeadingElement | null>
  onNavigate: (view: JourneyView) => void; onAsk: () => void; onRetry: () => void; onRetryScope3: () => void; onFix: (recordId: string) => void
}) {
  if (!status || readiness.state !== "ready") return <section aria-busy={!error}>
    <p className="nv-eyebrow">Overview</p>
    <h1 ref={headingRef} tabIndex={-1}>Your reporting workspace</h1>
    {error ? <div className="nv-notice nv-notice--error" role="alert"><Icon name="alert" /><div><p><strong>Your progress couldn’t be checked.</strong> {error}</p><div className="nv-actions" style={{ marginTop: 10 }}><button type="button" className="nv-btn nv-btn--sm" onClick={onRetry}>Try again</button></div></div></div>
      : <p className="nv-lead" role="status">Checking your progress…</p>}
  </section>
  const { setup, collection, evidence, canManage } = status
  const { next, items, duplicates, s1, s2, s3, open } = readiness
  const name = setup.legalName || "Your company"
  const scope3 = Boolean(status.scope3)
  // WO-04b: a step is "done" only by its §8 definition (S3 never); the step the next action opens is "current".
  const nextView = next.target.type === "view" ? next.target.view : "collection"
  const stepState = (key: "setup" | "collection" | "results", done: boolean) => done ? "done" : nextView === key ? "current" : "todo"
  const act = (target: ReadinessTarget) => {
    if (target.type === "record") onFix(target.recordId)
    else if (target.type === "spend") { requestSpendImportFocus(target.tab); onNavigate("collection") }
    else if (target.type === "retryScope3") onRetryScope3()
    else onNavigate(target.view)
  }
  const improve: Array<{ key: string; title: string; detail: string }> = []
  if (collection.partial) improve.push({ key: "partial", title: `${plural(collection.partial, "record is", "records are")} only partly calculated`, detail: "For vehicles, add miles driven or fuel economy to include CH4 and N2O." })
  if (collection.noEvidence) improve.push({ key: "evidence", title: `${plural(collection.noEvidence, "record has", "records have")} no evidence linked`, detail: "Attach the bill or log so a reviewer can trace the figure." })
  if (collection.olderSetup && canManage) improve.push({ key: "older-setup", title: `${plural(collection.olderSetup, "record was", "records were")} saved before your latest company-setup change`, detail: "When you next edit one, choose its site again before saving — the form asks for a current site." })
  if (collection.qualityUnknown) improve.push({ key: "quality", title: `${plural(collection.qualityUnknown, "record has", "records have")} data quality “Unknown”`, detail: "Mark each record as actual or estimated." })
  const groups = READINESS_GROUPS.map(group => ({ group, rows: items.filter(item => item.group === group) })).filter(entry => entry.rows.length)
  const resolved = readiness.scope3 === "off" || readiness.scope3 === "ready"
  return <section>
    <p className="nv-eyebrow">Overview</p>
    <h1 ref={headingRef} tabIndex={-1}>{setup.saved ? name : "Welcome to Neuvetra"}</h1>
    <p className="nv-lead">{setup.saved
      ? `${periodLabel(setup.period.start, setup.period.endExclusive)} · ${BOUNDARY_LABELS[setup.boundary] ?? setup.boundary} · ${setup.sites.included} of ${plural(setup.sites.total, "site")} included`
      : homeLead(scope3)}</p>

    <div className="nv-card nv-card--accent">
      <p className="nv-eyebrow" style={{ marginBottom: 4 }}>Next step</p>
      <h2 className="nv-h2" data-readiness-next="">{next.title}</h2>
      <p className="nv-muted" style={{ marginTop: 6 }}>{next.body}</p>
      <div className="nv-actions">
        <button type="button" className="nv-btn nv-btn--primary" data-readiness-action="next" onClick={() => act(next.target)}>{next.action}<Icon name="arrow" size={18} /></button>
        {next.secondary && <button type="button" className="nv-btn" onClick={() => act(next.secondary!.target)}>{next.secondary.action}</button>}
        <button type="button" className="nv-btn nv-btn--ghost" onClick={onAsk}><Icon name="help" size={18} />Ask a question</button>
      </div>
    </div>

    <h2 className="nv-h2" style={{ marginTop: 28 }}>Your three steps</h2>
    <div className="nv-journey" style={{ marginTop: 12 }}>
      <button type="button" className="nv-journey__step" data-state={stepState("setup", s1.done)} onClick={() => onNavigate("setup")}>
        <span className="nv-journey__num" aria-hidden="true">{s1.done ? <Icon name="check" size={16} /> : 1}</span>
        <span className="nv-journey__title">Company setup</span>
        <span className="nv-journey__meta">{s1.text}</span>
      </button>
      <button type="button" className="nv-journey__step" data-state={stepState("collection", s2.done)} onClick={() => onNavigate("collection")}>
        <span className="nv-journey__num" aria-hidden="true">{s2.done ? <Icon name="check" size={16} /> : 2}</span>
        <span className="nv-journey__title">Activity & evidence</span>
        <span className="nv-journey__meta">{s2.text}</span>
        {collection.active > 0 && <span className="nv-journey__meta nv-subtle">{readiness.s2Hint}</span>}
      </button>
      <button type="button" className="nv-journey__step" data-state={stepState("results", false)} onClick={() => onNavigate("results")}>
        <span className="nv-journey__num" aria-hidden="true">3</span>
        <span className="nv-journey__title">Results & report</span>
        <span className="nv-journey__meta">{s3.text}</span>
      </button>
    </div>

    <div className="nv-grid-2" style={{ marginTop: 18 }}>
      <div className="nv-card nv-card--flat" style={{ margin: 0 }} id="overview-open-items">
        <h2 className="nv-h3">What needs attention</h2>
        {/* WO-04b: one list across all scopes, in the next-step order; its length is the "N open" of the navigation. */}
        <p className="nv-subtle" data-readiness-summary="">{!resolved ? READINESS_TEXT.openSummaryPartial(open.scope12, readiness.scope3 === "failed")
          : items.length ? READINESS_TEXT.openSummary(open.total, open.scope12, open.scope3, open.blocking, open.scope3Duplicates)
          : !collection.active ? "No records yet — start with the next step above." : duplicates.length ? "Nothing is waiting on you." : OVERVIEW_SCOPE3_TEXT.nothingOpen}{duplicates.length ? ` ${READINESS_TEXT.duplicatesSummary(duplicates.length)}.` : ""}</p>
        {groups.map(({ group, rows }) => <div key={group}>
          <p className={`nv-attn-label nv-attn-label--${group === "gap" || group === "method" ? "info" : "warn"}`}>{READINESS_GROUP_TEXT[group]}</p>
          <ul className="nv-list">
            {rows.map(item => <li key={item.key} data-readiness-item={item.key}><span className="nv-list__main"><span className="nv-list__title">{item.title}</span>{item.blocking && <> <span className="nv-chip nv-chip--warn">Blocks internal approval</span></>}<br /><span className="nv-subtle">{item.detail}</span></span>
              <button type="button" className="nv-btn nv-btn--sm" data-readiness-action={item.key} data-readiness-target={item.target.type === "view" ? item.target.view : item.target.type} aria-label={`${item.action}: ${item.title}`} onClick={() => act(item.target)}>{item.action}</button></li>)}
          </ul>
        </div>)}
        {/* CEO ruling: possible duplicates are listed to confirm, apart from the open items (not in "N open"). */}
        {duplicates.length > 0 && <div>
          <p className="nv-attn-label nv-attn-label--info">{READINESS_GROUP_TEXT.duplicate}</p>
          <ul className="nv-list">
            {duplicates.map(item => <li key={item.key} data-readiness-duplicate={item.key}><span className="nv-list__main"><span className="nv-list__title">{item.title}</span><br /><span className="nv-subtle">{item.detail}</span></span>
              <button type="button" className="nv-btn nv-btn--sm" data-readiness-target={item.target.type === "view" ? item.target.view : item.target.type} aria-label={`${item.action}: ${item.title}`} onClick={() => act(item.target)}>{item.action}</button></li>)}
          </ul>
        </div>}
        <p className="nv-attn-label">Scope 3</p>
        <ul className="nv-list">
          {readiness.scope3 === "off" && <li key="scope3-off"><span className="nv-list__main"><span className="nv-list__title">{OVERVIEW_SCOPE3_TEXT.off}</span></span></li>}
          {readiness.scope3 === "checking" && <li key="scope3-checking" role="status"><span className="nv-list__main"><span className="nv-list__title">{OVERVIEW_SCOPE3_TEXT.checking}</span><br /><span className="nv-subtle">{OVERVIEW_SCOPE3_TEXT.checkingDetail}</span></span></li>}
          {readiness.scope3 === "failed" && <li key="scope3-failed" role="alert"><span className="nv-list__main"><span className="nv-list__title">{OVERVIEW_SCOPE3_TEXT.failed}</span><br /><span className="nv-subtle">{OVERVIEW_SCOPE3_TEXT.failedDetail}</span></span>
            <span className="nv-actions" style={{ margin: 0 }}><button type="button" className="nv-btn nv-btn--sm" onClick={onRetryScope3}>{OVERVIEW_SCOPE3_TEXT.retry}</button><button type="button" className="nv-btn nv-btn--sm" aria-label="Open Results: Scope 3 to-do" onClick={() => onNavigate("results")}>{OVERVIEW_SCOPE3_TEXT.openResults}</button></span></li>}
          {readiness.scope3 === "ready" && <li key="scope3-ready"><span className="nv-list__main"><span className="nv-list__title">{open.scope3 ? `${plural(open.scope3, "Scope 3 item")} listed above` : "No Scope 3 items open"}</span><br /><span className="nv-subtle">The same items as the Scope 3 to-do on Results.</span></span><button type="button" className="nv-btn nv-btn--sm" aria-label="Open Results: Scope 3 to-do" onClick={() => onNavigate("results")}>{OVERVIEW_SCOPE3_TEXT.openResults}</button></li>}
        </ul>
        {(improve.length > 0 || evidence.checking > 0) && <><p className="nv-attn-label">Can be improved</p><p className="nv-subtle" style={{ marginTop: 0 }}>{OVERVIEW_SCOPE3_TEXT.improveNote}</p><ul className="nv-list">
          {improve.map(item => <li key={item.key}><span className="nv-list__main"><span className="nv-list__title">{item.title}</span>{canManage && <><br /><span className="nv-subtle">{item.detail}</span></>}</span><button type="button" className="nv-btn nv-btn--sm" aria-label={`${item.key === "partial" ? "See" : canManage ? "Open" : "View"}: ${item.title}`} onClick={() => onNavigate(item.key === "partial" ? "results" : "collection")}>{item.key === "partial" ? "See" : canManage ? "Open" : "View"}</button></li>)}
          {evidence.checking > 0 && <li><span className="nv-list__main"><span className="nv-list__title">{plural(evidence.checking, "file")} waiting for quarantine review</span><br /><span className="nv-subtle">You can keep working; files can be downloaded once cleared.</span></span></li>}
        </ul></>}
      </div>
      <div className="nv-card nv-card--flat" style={{ margin: 0 }}>
        <h2 className="nv-h3">Your records</h2>
        {!collection.active ? <p className="nv-muted">{status.scope3 ? COPY_TEXT_R2E.journeyActivityScope3 : "No activity records yet. Most companies start with a gas or electricity bill."}</p> :
          <ul className="nv-list">{[...ACTIVITY_KINDS, ...SCOPE3_ACTIVITY_KINDS.map(kind => ({ ...kind, label: `${kind.label} (Scope 3)` }))].filter(kind => collection.byKind[kind.kind]).map(kind => <li key={kind.kind}>
            <span className="nv-list__main" style={{ display: "flex", gap: 10, alignItems: "center" }}><Icon name={kindIcon(kind.kind)} size={18} /><span>{kind.label}</span></span>
            <span className="nv-num nv-muted">{collection.byKind[kind.kind]}</span>
          </li>)}</ul>}
        <p className="nv-subtle" style={{ marginBottom: 0 }}>{plural(evidence.total, "evidence file")} · {evidence.cleared} cleared{evidence.checking ? ` · ${evidence.checking} in quarantine review` : ""}{evidence.rejected ? ` · ${evidence.rejected} rejected` : ""}</p>
        {canManage && <div className="nv-actions" style={{ marginTop: 12 }}><button type="button" className="nv-btn nv-btn--sm" onClick={() => onNavigate("collection")}><Icon name="plus" size={16} />Add activity</button></div>}
      </div>
    </div>

    {collection.records.length > 0 && <details className="nv-detail" style={{ marginTop: 18 }}>
      <summary>See every record’s status</summary>
      <ul className="nv-list" style={{ marginTop: 8 }}>{collection.records.map(row => <li key={row.id}><span className="nv-list__main"><span className="nv-list__title">{row.label} · {row.sourceId}</span><br /><span className="nv-subtle">{row.site}</span></span><span className={`nv-chip nv-chip--${RECORD_STATE_TONE[row.state]}`}>{RECORD_STATE_LABELS[row.state]}</span></li>)}</ul>
    </details>}
  </section>
}

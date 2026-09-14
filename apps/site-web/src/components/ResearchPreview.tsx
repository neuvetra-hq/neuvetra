import { lazy, Suspense, useRef, useState } from "react"
import { ResearchSpirit } from "@/components/ResearchSpirit"
import { ResearchAnswerPanel } from "@/components/ResearchAnswerPanel"
import { filterResearchSources, RESEARCH_SOURCES, SOURCE_CATEGORIES, type SourceCategory } from "@/data/research-sources"

const ReviewedDemoPanel = import.meta.env.DEV ? lazy(() => import("@/components/ReviewedDemoPanel").then((module) => ({ default: module.ReviewedDemoPanel }))) : null
const DeterministicCalculationDemo = import.meta.env.DEV ? lazy(() => import("@/components/DeterministicCalculationDemo").then((module) => ({ default: module.DeterministicCalculationDemo }))) : null
const CompanyWorkspaceDemo = import.meta.env.VITE_COMPANY_WORKSPACE_DEMO === "synthetic-m54" && import.meta.env.VITE_SYNTHETIC_BILL_DEMO === "synthetic-m55" && import.meta.env.VITE_SYNTHETIC_BILL_CALCULATION === "synthetic-m56" && import.meta.env.VITE_SYNTHETIC_INVENTORY_REVIEW === "synthetic-m57" && import.meta.env.VITE_SYNTHETIC_ANNUAL_REGISTER === "synthetic-m58" && import.meta.env.VITE_SYNTHETIC_EVIDENCE_PACK === "synthetic-m59" && import.meta.env.VITE_SYNTHETIC_DRAFT_REPORT === "synthetic-m60" && import.meta.env.VITE_SYNTHETIC_DRAFT_REPORT_REVIEW === "synthetic-m61" ? lazy(() => import("@/components/CompanyWorkspaceDemo").then((module) => ({ default: module.CompanyWorkspaceDemo }))) : null

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h15m-6-6 6 6-6 6" />}
    </svg>
  )
}

export function ResearchPreview() {
  type View = "overview" | "sources" | "answers" | "demo" | "calculation" | "workspace"
  const reviewedDemoEnabled = import.meta.env.DEV && import.meta.env.VITE_RESEARCH_BOARD_DEMO === "preserved-results"
  const calculationDemoEnabled = import.meta.env.DEV && import.meta.env.VITE_DETERMINISTIC_CALC_DEMO === "stationary-natural-gas"
  const workspaceDemoEnabled = import.meta.env.VITE_COMPANY_WORKSPACE_DEMO === "synthetic-m54" && import.meta.env.VITE_SYNTHETIC_BILL_DEMO === "synthetic-m55" && import.meta.env.VITE_SYNTHETIC_BILL_CALCULATION === "synthetic-m56" && import.meta.env.VITE_SYNTHETIC_INVENTORY_REVIEW === "synthetic-m57" && import.meta.env.VITE_SYNTHETIC_ANNUAL_REGISTER === "synthetic-m58" && import.meta.env.VITE_SYNTHETIC_EVIDENCE_PACK === "synthetic-m59" && import.meta.env.VITE_SYNTHETIC_DRAFT_REPORT === "synthetic-m60" && import.meta.env.VITE_SYNTHETIC_DRAFT_REPORT_REVIEW === "synthetic-m61"
  const requestedView = new URLSearchParams(window.location.search).get("view")
  const initialView: View = workspaceDemoEnabled && requestedView === "workspace" ? "workspace" : calculationDemoEnabled && requestedView === "calculation" ? "calculation" : reviewedDemoEnabled && requestedView === "demo" ? "demo" : "overview"
  const [view, setView] = useState<View>(initialView)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<SourceCategory>("All sources")
  const headingRef = useRef<HTMLHeadingElement>(null)
  const sources = filterResearchSources(query, category)

  function navigate(nextView: View) {
    setView(nextView)
    const url = new URL(window.location.href)
    if (nextView === "demo" || nextView === "calculation" || nextView === "workspace") url.searchParams.set("view", nextView)
    else url.searchParams.delete("view")
    window.history.replaceState({}, "", url)
    requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: "instant" })
    })
  }

  return (
    <div className="research-page">
      <a className="research-skip-link" href="#main-content">Skip to content</a>
      <header className="research-header research-shell">
        <button className="research-brand" type="button" onClick={() => navigate("overview")} aria-label="Neuvetra overview">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 24V8l18 16V8M7 8h6m6 16h6" stroke="currentColor" strokeWidth="1.5" /></svg>
          <span>Neuvetra</span>
        </button>
        <nav className="research-navigation" aria-label="Main navigation">
          <button type="button" aria-current={view === "overview" ? "page" : undefined} onClick={() => navigate("overview")}>Overview</button>
          <button type="button" aria-current={view === "sources" ? "page" : undefined} onClick={() => navigate("sources")}>Sources <span>{RESEARCH_SOURCES.length}</span></button>
          {reviewedDemoEnabled && <button type="button" aria-current={view === "demo" ? "page" : undefined} onClick={() => navigate("demo")}>Reviewed demo <span>3</span></button>}
          {calculationDemoEnabled && <button type="button" aria-current={view === "calculation" ? "page" : undefined} onClick={() => navigate("calculation")}>Calculate <span>1</span></button>}
          {workspaceDemoEnabled && <button type="button" aria-current={view === "workspace" ? "page" : undefined} onClick={() => navigate("workspace")}>Workspace <span>1</span></button>}
          <button type="button" aria-current={view === "answers" ? "page" : undefined} onClick={() => navigate("answers")}>Ask Neuvetra</button>
        </nav>
        <span className="research-preview-badge"><span /> Research preview</span>
      </header>

      <main id="main-content" className="research-shell" tabIndex={-1}>
        {view === "overview" ? (
          <>
            <section className="research-hero" aria-labelledby="overview-heading">
              <div className="research-hero-copy">
                <p className="research-eyebrow"><span className="research-small-line" /> California + United States</p>
                <h1 id="overview-heading" ref={headingRef} tabIndex={-1}>GHG research.<br /><span>Grounded in<br className="research-desktop-break" /> evidence.</span></h1>
                <p className="research-intro">A clearer path through greenhouse gas accounting. Neuvetra is taking shape as a workspace for source-backed answers and traceable emissions calculations.</p>
                <div className="research-hero-actions">
                  <button type="button" className="research-primary-button" onClick={() => navigate("answers")}>Try the research pilot <Arrow /></button>
                  <a className="research-text-link" href="#workflow">See what we're building <span aria-hidden="true">↓</span></a>
                </div>
                <p className="research-availability">Explore the source library or try the private Scope 2 research pilot. Calculations are in development.</p>
              </div>
              <ResearchSpirit />
            </section>

            <section className="research-source-strip" aria-label="Source library introduction">
              <div><span className="research-strip-number">0{RESEARCH_SOURCES.length}</span><p>Primary references.<br /><span>One place to begin.</span></p></div>
              <p>Accounting standards, U.S. emission factors,<br className="research-desktop-break" /> and California reporting resources.</p>
              <button type="button" className="research-text-link" onClick={() => navigate("sources")}>Browse library <Arrow /></button>
            </section>

            <section id="workflow" className="research-workflow" aria-labelledby="workflow-heading">
              <div className="research-section-heading">
                <div><p className="research-eyebrow">The workspace we're building</p><h2 id="workflow-heading">From a question to a traceable result.</h2></div>
                <span className="research-outline-label">Our approach</span>
              </div>
              <div className="research-steps">
                <article><span className="research-step-number">01 / RESEARCH</span><h3>Start at the source.</h3><p>Explore original materials from GHG Protocol, EPA, and CARB. Open the publisher's page and find the context behind the guidance.</p><span className="research-step-status is-available">Source library available</span></article>
                <article><span className="research-step-number">02 / UNDERSTAND</span><h3>See what supports the answer.</h3><p>Try a bounded Scope 2 research pilot with specific source references, qualifications, and an honest response when the sources aren't enough.</p><span className="research-step-status is-available">Private research pilot</span></article>
                <article><span className="research-step-number">03 / ACCOUNT</span><h3>Follow every number.</h3><p>Planned calculations will connect activity data, units, factor versions, and methodology, so results can be reviewed and reproduced.</p><span className="research-step-status">Calculations in development</span></article>
              </div>
            </section>
          </>
        ) : view === "answers" ? <ResearchAnswerPanel headingRef={headingRef} /> : view === "demo" && ReviewedDemoPanel ? <Suspense fallback={<div className="reviewed-demo-loading" role="status">Opening the reviewed replay…</div>}><ReviewedDemoPanel headingRef={headingRef} /></Suspense> : view === "calculation" && DeterministicCalculationDemo ? <Suspense fallback={<div className="reviewed-demo-loading" role="status">Opening the deterministic calculation…</div>}><DeterministicCalculationDemo headingRef={headingRef} /></Suspense> : view === "workspace" && CompanyWorkspaceDemo ? <Suspense fallback={<div className="reviewed-demo-loading" role="status">Opening the company workspace…</div>}><CompanyWorkspaceDemo headingRef={headingRef} /></Suspense> : (
          <section className="research-library" aria-labelledby="sources-heading">
            <div className="research-library-heading">
              <div><p className="research-eyebrow">The Neuvetra source library</p><h1 id="sources-heading" ref={headingRef} tabIndex={-1}>The source comes first.</h1><p className="research-intro">A starting collection of primary references for GHG accounting and reporting research. Explore the original materials directly.</p></div>
              <span className="research-library-count">0{RESEARCH_SOURCES.length}<span>PRIMARY<br />REFERENCES</span></span>
            </div>
            <div className="research-library-tools">
              <label className="research-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
                <span className="sr-only">Search sources</span>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a topic, source, or publisher…" />
              </label>
              <div className="research-filters" role="group" aria-label="Filter sources by category">
                {SOURCE_CATEGORIES.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
            </div>
            <div className="research-results-heading">
              <p aria-live="polite" role="status">{sources.length} {sources.length === 1 ? "source" : "sources"}{category !== "All sources" ? ` · ${category}` : " · All categories"}</p>
              <span>Original publisher links <Arrow diagonal /></span>
            </div>
            {sources.length ? (
              <div className="research-source-grid">
                {sources.map((source) => (
                  <a className="research-source-card" key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`${source.title} — ${source.publisher} (opens in a new tab)`}>
                    <div className="research-source-card-top"><span className="research-category-label">{source.category}</span><Arrow diagonal /></div>
                    <p className="research-source-publisher">{source.publisher}</p>
                    <h2>{source.title}</h2>
                    <p className="research-source-description">{source.description}</p>
                    <div className="research-source-card-bottom"><span>{source.domain}</span><span>Read source <Arrow /></span></div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="research-empty-state">
                <h2>No sources match this search.</h2><p>Try a topic such as electricity, a publisher such as EPA, or a different category.</p>
                <button type="button" className="research-primary-button" onClick={() => { setQuery(""); setCategory("All sources") }}>Reset search <Arrow /></button>
              </div>
            )}
            <p className="research-library-note">These references link to the publishers' materials. Check the edition, reporting period, and applicable guidance before using a source. The separate research pilot covers a small reviewed Scope 2 evidence set; calculations remain in development.</p>
          </section>
        )}
      </main>
      <footer className="research-footer research-shell"><span>Neuvetra <span className="research-footer-divider">/</span> GHG research & accounting</span><span>California + United States <span aria-hidden="true">↗</span></span></footer>
    </div>
  )
}

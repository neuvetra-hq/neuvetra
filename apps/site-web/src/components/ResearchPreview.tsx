import { useRef, useState } from "react"
import { ResearchSpirit } from "@/components/ResearchSpirit"
import { filterResearchSources, RESEARCH_SOURCES, SOURCE_CATEGORIES, type SourceCategory } from "@/data/research-sources"

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h15m-6-6 6 6-6 6" />}
    </svg>
  )
}

export function ResearchPreview() {
  const [view, setView] = useState<"overview" | "sources">("overview")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<SourceCategory>("All sources")
  const headingRef = useRef<HTMLHeadingElement>(null)
  const sources = filterResearchSources(query, category)

  function navigate(nextView: typeof view) {
    setView(nextView)
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
                  <button type="button" className="research-primary-button" onClick={() => navigate("sources")}>Explore the sources <Arrow /></button>
                  <a className="research-text-link" href="#workflow">See what we're building <span aria-hidden="true">↓</span></a>
                </div>
                <p className="research-availability">Start with the source library. Q&A and calculations are in development.</p>
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
                <article><span className="research-step-number">02 / UNDERSTAND</span><h3>See what supports the answer.</h3><p>We're developing answers linked to specific evidence, with clear assumptions and an honest response when the sources aren't enough.</p><span className="research-step-status">Q&A in development</span></article>
                <article><span className="research-step-number">03 / ACCOUNT</span><h3>Follow every number.</h3><p>Planned calculations will connect activity data, units, factor versions, and methodology, so results can be reviewed and reproduced.</p><span className="research-step-status">Calculations in development</span></article>
              </div>
            </section>
          </>
        ) : (
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
            <p className="research-library-note">These references link to the publishers' materials. Check the edition, reporting period, and applicable guidance before using a source. This preview does not yet generate answers or calculate emissions.</p>
          </section>
        )}
      </main>
      <footer className="research-footer research-shell"><span>Neuvetra <span className="research-footer-divider">/</span> GHG research & accounting</span><span>California + United States <span aria-hidden="true">↗</span></span></footer>
    </div>
  )
}

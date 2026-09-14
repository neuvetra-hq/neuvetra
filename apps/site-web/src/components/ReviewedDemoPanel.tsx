import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react"
import { ResearchAnswerResult } from "@/components/ResearchAnswerResult"
import { loadReviewedDemoCases, type ReviewedDemoCase } from "@/data/reviewed-demo"

const SOURCE_RELEASE_SHA = "38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f"
const reviewedCasesPromise = loadReviewedDemoCases()

export function ReviewedDemoPanel({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [cases, setCases] = useState<ReviewedDemoCase[] | null>(null)
  const [selected, setSelected] = useState(0)
  const [failed, setFailed] = useState(false)
  const scenarioHeadingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let active = true
    reviewedCasesPromise.then((loaded) => { if (active) setCases(loaded) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [])

  function choose(index: number, focusHeading = true) {
    setSelected(index)
    if (focusHeading) requestAnimationFrame(() => scenarioHeadingRef.current?.focus({ preventScroll: true }))
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!cases || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    const next = event.key === "Home" ? 0 : event.key === "End" ? cases.length - 1 : event.key === "ArrowLeft" ? (index + cases.length - 1) % cases.length : (index + 1) % cases.length
    choose(next, false)
    requestAnimationFrame(() => document.getElementById(`demo-tab-${cases[next]!.id}`)?.focus())
  }

  const current = cases?.[selected]
  return (
    <section className="reviewed-demo" aria-labelledby="reviewed-demo-heading">
      <div className="reviewed-demo-banner" role="status">
        <div><p className="research-eyebrow">Offline board demo</p><strong>Preserved reviewed replay</strong></div>
        <p>This board demo renders three responses captured and independently accepted on September 11, 2026. It does not contact the research service or an AI provider.</p>
        <span>Offline replay · no new model request</span>
      </div>

      <div className="reviewed-demo-heading-row">
        <div><p className="research-eyebrow">Ask · Answer · Abstain</p><h1 id="reviewed-demo-heading" ref={headingRef} tabIndex={-1}>Three decisions you can inspect.</h1><p className="answer-intro">Explore how Neuvetra handles missing company context, supported source-backed guidance, and a real gap in the reviewed material.</p></div>
        <span className="research-outline-label">Release false</span>
      </div>

      <aside className="reviewed-demo-limits" aria-labelledby="pilot-limits-heading">
        <h2 id="pilot-limits-heading">Pilot limits</h2>
        <p>Private purchased-electricity research pilot. These preserved responses cover selected EPA guidance only. They do not calculate emissions, select factors, determine legal duties or instrument eligibility, use company data, establish customer isolation, expand source rights, or show production readiness.</p>
        <p>No provider request, source expansion, deployment or release occurs in this replay.</p>
      </aside>

      {failed ? <div className="reviewed-demo-unavailable" role="alert"><h2>Reviewed replay unavailable</h2><p>One or more preserved artifacts could not be verified. No substitute content was displayed.</p></div> : !current ? <div className="reviewed-demo-loading" role="status">Verifying the three preserved artifacts…</div> : <>
        <div className="reviewed-demo-tabs" role="tablist" aria-label="Reviewed scenarios">
          {cases.map((item, index) => <button key={item.id} type="button" role="tab" id={`demo-tab-${item.id}`} aria-selected={selected === index} aria-controls={`demo-panel-${item.id}`} tabIndex={selected === index ? 0 : -1} onClick={() => choose(index)} onKeyDown={(event) => moveTab(event, index)}><small>{item.id}</small><span>{item.step}</span></button>)}
        </div>

        <article className="reviewed-demo-scenario" role="tabpanel" id={`demo-panel-${current.id}`} aria-labelledby={`demo-tab-${current.id}`}>
          <div className="reviewed-demo-scenario-heading"><div><p className="research-eyebrow">Historical diagnostic · {current.id}</p><h2 ref={scenarioHeadingRef} tabIndex={-1}>{current.navigationLabel}</h2><p>{current.interpretation}</p></div><span>Preserved replay<br />Original diagnostic was live</span></div>
          <ResearchAnswerResult answer={current.answer} question={current.question} headingId={`demo-result-${current.id}`} idPrefix={`demo-${current.id}`} />
          <details className="reviewed-demo-provenance"><summary>Reviewed evidence and full provenance <span aria-hidden="true">+</span></summary><dl><div><dt>Historical run / case</dt><dd>{current.id === "W11" ? "website-epa-live-35" : current.id === "W03" ? "website-epa-live-39" : "website-epa-live-40"} / {current.id}</dd></div><div><dt>Run disposition</dt><dd>{current.runDisposition}</dd></div><div><dt>Captured</dt><dd>September 11, 2026</dd></div><div><dt>Response SHA-256</dt><dd><code>{current.responseSha256}</code></dd></div><div><dt>Terminal QA SHA-256</dt><dd><code>{current.terminalQaSha256}</code></dd></div><div><dt>Independent closure QA SHA-256</dt><dd><code>{current.closureQaSha256}</code></dd></div><div><dt>Source release</dt><dd><code>scope2-website / v1 / {SOURCE_RELEASE_SHA}</code></dd></div></dl><p>The release was reviewed for the original diagnostic through September 15, 2026 at 23:20:32 UTC. This historical replay does not renew or revalidate the source review.</p></details>
        </article>
      </>}
    </section>
  )
}

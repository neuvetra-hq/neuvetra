import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react"
import { ANSWER_LABELS, publisherUrl, requestResearchAnswer, type ResearchAnswer } from "@/lib/research-api"

const SUGGESTIONS = [
  { label: "Compare the two methods", question: "What is the difference between location-based and market-based Scope 2 accounting?" },
  { label: "Find factor sources", question: "Where do electricity emission factors come from?" },
  { label: "Check the limits", question: "Calculate our Scope 2 emissions and file our California report." },
  { label: "Draft or published guidance?", question: "Does a newer Scope 2 draft replace the published guidance?" },
]

const CONTEXT_LABELS: Record<string, string> = {
  location: "Facility location or electricity grid",
  reporting_period: "The year or period being reported",
  electricity_supply: "Electricity supplier, tariff and any contractual arrangements",
}

function sourcePageUrl(canonicalUrl: string, locator: string): string | null {
  const safeUrl = publisherUrl(canonicalUrl)
  if (!safeUrl) return null
  const page = locator.match(/PDF page (\d+)/)?.[1]
  const url = new URL(safeUrl)
  if (page && url.pathname.toLowerCase().endsWith(".pdf")) url.hash = `page=${page}`
  return url.href
}

function shortLocator(locator: string): string {
  const pages = locator.match(/PDF page (\d+).*printed page (\d+)/)
  return pages ? `PDF p. ${pages[1]} · printed p. ${pages[2]}` : locator
}

export function ResearchAnswerPanel({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  const [question, setQuestion] = useState("")
  const [submittedQuestion, setSubmittedQuestion] = useState("")
  const [answer, setAnswer] = useState<ResearchAnswer | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [connection, setConnection] = useState<"checking" | "ready" | "unavailable" | "offline">("checking")
  const requestRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/research-api/status", { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json()
        if (controller.signal.aborted) return
        setConnection(response.ok && typeof body === "object" && body !== null && "readiness" in body ? (body.readiness === "ready" ? "ready" : "unavailable") : "offline")
      })
      .catch(() => { if (!controller.signal.aborted) setConnection("offline") })
    return () => { controller.abort(); requestRef.current?.abort(); requestRef.current = null }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || pending) return
    const controller = new AbortController()
    requestRef.current = controller
    setPending(true)
    setError("")
    setAnswer(null)
    setSubmittedQuestion(trimmed)
    const timeout = window.setTimeout(() => controller.abort("timeout"), 155000)
    try {
      const result = await requestResearchAnswer(trimmed, controller.signal)
      if (requestRef.current !== controller) return
      setAnswer(result)
      if (result.status === "unavailable") setConnection("unavailable")
      requestAnimationFrame(() => {
        resultRef.current?.focus({ preventScroll: true })
        resultRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
      })
    } catch {
      if (requestRef.current !== controller) return
      setError(controller.signal.aborted ? "The request stopped before an answer was ready. You can try again." : "The research service could not be reached or returned an unusable response. Please try again.")
    } finally {
      window.clearTimeout(timeout)
      if (requestRef.current === controller) { setPending(false); requestRef.current = null }
    }
  }

  function cancel() {
    requestRef.current?.abort()
  }

  return (
    <section className="answer-workspace" aria-labelledby="answer-heading">
      <div className="answer-heading-row">
        <div>
          <p className="research-eyebrow">A closer look at purchased electricity</p>
          <h1 id="answer-heading" ref={headingRef} tabIndex={-1}>Ask. Then inspect the evidence.</h1>
          <p className="answer-intro">Ask about U.S. purchased electricity. Answers link to the reviewed evidence and explain their limits.</p>
        </div>
        <span className="research-outline-label">Private pilot</span>
      </div>

      <div className="answer-workspace-grid">
        <div className="answer-main-column">
          <form className="answer-form" onSubmit={submit}>
            <label htmlFor="research-question">Your question</label>
            <textarea id="research-question" ref={textareaRef} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={4} placeholder="How do location-based and market-based accounting differ?" aria-describedby="answer-question-help" disabled={pending} required />
            <div className="answer-form-footer">
              <span id="answer-question-help">Use a general question. Leave out confidential company information.</span>
              <button className="research-primary-button" type="submit" disabled={pending || !question.trim()}>{pending ? "Checking the evidence…" : "Ask Neuvetra"}<span aria-hidden="true">↗</span></button>
            </div>
          </form>

          <div className="answer-suggestions" aria-label="Example questions">
            {SUGGESTIONS.map((item) => <button type="button" key={item.label} disabled={pending} onClick={() => { setQuestion(item.question); textareaRef.current?.focus() }}>{item.label}<span aria-hidden="true">↗</span></button>)}
          </div>

          <div role="status" aria-live="polite" className="answer-progress">
            {pending && <><span className="answer-progress-dot" /> Reviewing the question and its source support.<button type="button" onClick={cancel}>Cancel</button></>}
          </div>
          {error && <div role="alert" className="answer-error"><strong>No answer was displayed.</strong><p>{error}</p></div>}

          {answer ? (
            <section className={`answer-result answer-result-${answer.status}`} aria-labelledby="answer-result-heading" ref={resultRef} tabIndex={-1}>
              <p className="answer-result-question">{submittedQuestion}</p>
              <div className="answer-result-title"><span className="answer-status-dot" /><h2 id="answer-result-heading">{ANSWER_LABELS[answer.status]}</h2></div>
              <p className="answer-result-message">{answer.message}</p>
              {answer.claims.map((claim) => (
                <article className="answer-claim" key={claim.id}>
                  <p>{claim.text}</p>
                  {claim.qualifications.length > 0 && <ul className="answer-qualifications">{claim.qualifications.map((item) => <li key={item}>{item}</li>)}</ul>}
                  <div className="answer-citation-links">{claim.evidence_ids.map((id) => {
                    const item = answer.evidence.find((evidence) => evidence.id === id)
                    return item ? <a key={id} href={`#evidence-${id}`} onClick={() => { const detail = document.getElementById(`evidence-${id}`); if (detail instanceof HTMLDetailsElement) detail.open = true }}>Source · {shortLocator(item.locator)} <span aria-hidden="true">↓</span></a> : null
                  })}</div>
                </article>
              ))}
              {answer.missing_context.length > 0 && <div className="answer-missing-context"><h3>Useful context for the next step</h3><ul>{answer.missing_context.map((item) => <li key={item}>{CONTEXT_LABELS[item] ?? item}</li>)}</ul></div>}
              {answer.evidence.length > 0 && <div className="answer-evidence"><h3>Inspect the supporting material</h3>{answer.evidence.map((item) => {
                const source = answer.sources.find((entry) => entry.id === item.source_id)
                const url = source ? sourcePageUrl(source.canonical_url, item.locator) : null
                return <details key={item.id} id={`evidence-${item.id}`}><summary><span>{source?.title ?? "Source material"}<small>{item.locator}</small></span><span aria-hidden="true">+</span></summary><div className="answer-evidence-detail"><p className="answer-source-meta">{answer.answer_mode === "passage_grounded" ? "Reviewed source passage. Open the original for its full surrounding context." : "Find this phrase in the original; read its full surrounding context."}</p><blockquote>{item.excerpt}</blockquote>{source && <p className="answer-source-meta">{source.version} · {source.status.replace(/_/g, " ")}</p>}{url && <a href={url} target="_blank" rel="noopener noreferrer">Open original source <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>}</div></details>
              })}</div>}
              <p className="answer-provenance">{answer.claims.length > 0 && answer.provider.mode === "live" ? (answer.answer_mode === "passage_grounded" ? "AI response checked against reviewed passages" : "AI-selected, reviewed source statements") : answer.provider.mode === "disabled" ? "No live model answer" : "No supported answer displayed"}{answer.release ? ` · Evidence ${answer.release.version}` : ""}</p>
            </section>
          ) : !pending && !error && <div className="answer-empty"><span className="answer-empty-mark" aria-hidden="true">↗</span><h2>Start with a question.</h2><p>The answer, its qualifications, and the original source references will appear together here.</p></div>}
        </div>

        <aside className="answer-scope" aria-label="Pilot coverage">
          <p className="research-eyebrow">What this pilot covers</p>
          <h2>One topic.<br />Visible support.</h2>
          <p>Purchased-electricity methods, activity records, factor sources and reporting periods from reviewed U.S. guidance.</p>
          <div className="answer-scope-divider" />
          <h3>When the evidence is not enough</h3>
          <p>Neuvetra asks for context, identifies a source limitation, or leaves the question unanswered.</p>
          <div className="answer-scope-divider" />
          <h3>Still to come</h3>
          <p>Company-specific factors, emissions calculations, legal deadlines and filing. This pilot does not submit reports.</p>
          <p className={`answer-connection ${connection}`} role="status">{connection === "checking" ? "Connecting to research service…" : connection === "ready" ? "Research service ready" : connection === "unavailable" ? "Research service connected; answering is unavailable." : "Research service offline. Answers are unavailable."}</p>
        </aside>
      </div>
    </section>
  )
}

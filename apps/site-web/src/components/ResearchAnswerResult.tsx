import { answerHeading, CONTEXT_LABELS, publisherUrl, qualificationNotes, type ResearchAnswer } from "@/lib/research-api"

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

export function ResearchAnswerResult({ answer, question, headingId = "answer-result-heading", idPrefix = "answer" }: { answer: ResearchAnswer; question: string; headingId?: string; idPrefix?: string }) {
  const notes = answer.answer_mode === "cloud_reviewed_composition" ? qualificationNotes(answer) : []
  const claimId = (id: string) => `${idPrefix}-claim-${id}`
  const noteId = (index: number) => `${idPrefix}-note-${index + 1}`
  const evidenceId = (id: string) => `${idPrefix}-evidence-${id}`

  return (
    <section className={`answer-result answer-result-${answer.status}`} aria-labelledby={headingId} tabIndex={-1}>
      <p className="answer-result-question">{question}</p>
      <div className="answer-result-title"><span className="answer-status-dot" /><h2 id={headingId}>{answerHeading(answer)}</h2></div>
      <p className="answer-result-message">{answer.message}</p>
      {answer.claims.map((claim) => {
        const unit = answer.composition?.units.find((item) => item.id === claim.id)
        return <article className="answer-claim" id={claimId(claim.id)} key={claim.id}>
          {unit && <><p className="research-eyebrow">{unit.type === "reviewed_interpretation" ? "Reviewed interpretation" : "Reviewed source summary"}</p><h3>{unit.title}</h3></>}
          <p>{claim.text}</p>
          {answer.answer_mode === "cloud_reviewed_composition" ? <div className="answer-citation-links">{notes.filter((note) => note.claim_ids.includes(claim.id)).map((note) => {
            const index = notes.indexOf(note)
            return <a key={note.id} href={`#${noteId(index)}`}>Source note {index + 1} ↓</a>
          })}</div> : claim.qualifications.length > 0 && <ul className="answer-qualifications">{claim.qualifications.map((item) => <li key={item}>{item}</li>)}</ul>}
          <div className="answer-citation-links">{claim.evidence_ids.map((id) => {
            const item = answer.evidence.find((evidence) => evidence.id === id)
            return item ? <a key={id} href={`#${evidenceId(id)}`} onClick={() => { const detail = document.getElementById(evidenceId(id)); if (detail instanceof HTMLDetailsElement) detail.open = true }}>Source · {shortLocator(item.locator)} <span aria-hidden="true">↓</span></a> : null
          })}</div>
        </article>
      })}
      {notes.length > 0 && <div className="answer-qualifications"><h3>Source notes</h3><ol className="list-none">{notes.map((note, index) => <li id={noteId(index)} key={note.id}><p><strong>{index + 1}. </strong>{note.text}</p><div className="answer-citation-links">{note.claim_ids.map((id) => <a key={id} href={`#${claimId(id)}`}>{answer.composition?.units.find((unit) => unit.id === id)?.title ?? id} ↑</a>)}</div></li>)}</ol></div>}
      {!!answer.scope_gaps?.length && <div className="answer-missing-context"><h3>What remains unresolved</h3><ul>{answer.scope_gaps.map((gap, index) => <li key={index}><blockquote>{gap.question_fragment}</blockquote><p>{gap.reason === "coverage_missing" ? "The reviewed material does not yet resolve this part." : gap.reason === "action_out_of_scope" ? "This requested action or determination is outside the preview." : "This reference or context needs clarification."}</p>{gap.context_ids.length > 0 && <ul>{gap.context_ids.map((id) => <li key={id}>{CONTEXT_LABELS[id]}</li>)}</ul>}</li>)}</ul></div>}
      {answer.missing_context.length > 0 && !answer.scope_gaps?.length && <div className="answer-missing-context"><h3>Useful context for the next step</h3><ul>{answer.missing_context.map((item) => <li key={item}>{CONTEXT_LABELS[item] ?? item}</li>)}</ul></div>}
      {answer.evidence.length > 0 && <div className="answer-evidence"><h3>Inspect the supporting material</h3>{answer.evidence.map((item) => {
        const source = answer.sources.find((entry) => entry.id === item.source_id)
        const url = source ? sourcePageUrl(source.canonical_url, item.locator) : null
        return <details key={item.id} id={evidenceId(item.id)}><summary><span>{source?.title ?? "Source material"}<small>{item.locator}</small></span><span aria-hidden="true">+</span></summary><div className="answer-evidence-detail"><p className="answer-source-meta">{answer.answer_mode === "passage_grounded" || answer.answer_mode === "cloud_passage_grounded" || answer.answer_mode === "cloud_reviewed_composition" ? "Reviewed source passage. Open the original for its full surrounding context." : "Find this phrase in the original; read its full surrounding context."}</p><blockquote>{item.excerpt}</blockquote>{source && <p className="answer-source-meta">{source.version} · {source.status.replace(/_/g, " ")}</p>}{url && <a href={url} target="_blank" rel="noopener noreferrer">Open original source <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>}</div></details>
      })}</div>}
      <p className="answer-provenance">Preserved replay of an independently accepted diagnostic artifact · Evidence {answer.release?.version ?? "unavailable"}</p>
    </section>
  )
}

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Icon } from "./Icon"
import type { JourneyView } from "./JourneyNav"
import { HELP_REVIEWED_ON, isProgressQuestion, matchQuestion, suggestedQuestions, type HelpLink, type HelpPanel } from "@/lib/help-content"
import { progressAnswer, type JourneyStatus } from "@/lib/journey-status"

interface Message { id: number; from: "user" | "bot"; text: string[]; matched?: string; source?: string; link?: HelpLink; followUps?: string[] }

export function AskNeuvetra({ open, onClose, panel, status, onNavigate }: { open: boolean; onClose: () => void; panel: HelpPanel; status: JourneyStatus | null; onNavigate: (view: JourneyView) => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const counter = useRef(0)
  const suggestions = ["What’s left for me to do?", ...suggestedQuestions(panel).map(entry => entry.question)]

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    window.setTimeout(() => inputRef.current?.focus(), 30)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return }
      if (event.key !== "Tab" || !panelRef.current) return
      // Keep keyboard focus inside the dialog while it is open.
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")]
      if (!focusable.length) return
      const first = focusable[0]!, last = focusable[focusable.length - 1]!
      if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.() }
  }, [open, onClose])
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" }) }, [messages])

  function ask(text: string) {
    const question = text.trim()
    if (!question) return
    const user: Message = { id: ++counter.current, from: "user", text: [question] }
    let reply: Message
    if (isProgressQuestion(question) || /left for me/i.test(question)) reply = { id: ++counter.current, from: "bot", text: progressAnswer(status), source: "Your saved company setup and records", link: status ? { label: status.next.action, panel: status.next.panel as HelpPanel } : undefined }
    else {
      const match = matchQuestion(question, panel)
      reply = match
        ? { id: ++counter.current, from: "bot", text: match.entry.answer, matched: match.entry.question, source: match.entry.source ? `Reviewed Neuvetra help · ${match.entry.source}` : "Reviewed Neuvetra help", link: match.entry.link }
        : { id: ++counter.current, from: "bot", text: ["I don’t have a reviewed answer for that yet, so I won’t guess. Try one of the questions below, or ask your Neuvetra contact — unanswered questions help us decide what to write next."], followUps: suggestions.slice(0, 4) }
    }
    setMessages(items => [...items, user, reply])
    setQuery("")
  }
  function submit(event: FormEvent) { event.preventDefault(); ask(query) }

  if (!open) return null
  return <div className="nv-drawer" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="nv-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="ask-title" ref={panelRef}>
      <div className="nv-drawer__head">
        <span className="nv-record-card__icon" aria-hidden="true" style={{ width: 38, height: 38 }}><Icon name="help" /></span>
        <div style={{ flex: 1 }}><h2 id="ask-title" className="nv-h3" style={{ margin: 0 }}>Ask Neuvetra</h2><p>Answers from reviewed Neuvetra help, updated {HELP_REVIEWED_ON}. No AI model is used.</p></div>
        <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm" onClick={onClose} aria-label="Close help"><Icon name="close" size={18} /></button>
      </div>
      <div className="nv-drawer__body" ref={bodyRef} aria-live="polite">
        <div className="nv-msg nv-msg--bot"><p>Hi — ask about any field, flag or reporting term, or ask what’s left to do. I only answer from written, reviewed guidance; if I don’t know, I’ll say so.</p></div>
        {messages.length === 0 && <div className="nv-suggestions">{suggestions.map(item => <button type="button" key={item} onClick={() => ask(item)}>{item}</button>)}</div>}
        {messages.map(message => <div key={message.id} className={`nv-msg nv-msg--${message.from}`}>
          {message.matched && <p className="nv-msg__matched">Closest reviewed answer: {message.matched}</p>}
          {message.text.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          {message.link && <p><button type="button" className="nv-link" onClick={() => { onNavigate(message.link!.panel); onClose() }}>{message.link.label} →</button></p>}
          {message.source && <p className="nv-msg__source">Source: {message.source}</p>}
          {message.followUps && <div className="nv-suggestions" style={{ margin: "10px 0 0" }}>{message.followUps.map(item => <button type="button" key={item} onClick={() => ask(item)}>{item}</button>)}</div>}
        </div>)}
      </div>
      <form className="nv-drawer__foot" onSubmit={submit}>
        <label htmlFor="ask-input" className="nv-sr">Your question</label>
        <div className="nv-askform"><input id="ask-input" ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. Why do you need my ZIP code?" autoComplete="off" maxLength={300} /><button type="submit" className="nv-btn nv-btn--primary" disabled={!query.trim()} aria-label="Ask"><Icon name="send" size={18} /></button></div>
      </form>
    </div>
  </div>
}

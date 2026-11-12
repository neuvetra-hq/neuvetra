import type { RecordHold } from "@/lib/record-holds-wo12b"
import { RECORD_HOLD_TEXT } from "@/lib/wo12b-text"

/**
 * WO-12b (CEO ruling after QA round 3 of PR #57): while one answer holds the record whatever else is filled in, the top of
 * the record form says so, names that answer, gives the server's own hold text (and what to do instead where that text
 * doesn't say it), and says the field labels apply once the answer changes. The live region is always in the page, so the
 * notice is announced as it appears and as it goes; "Go to …" moves focus to the answer. It never blocks saving.
 */
export function RecordHoldNotice({ hold }: { hold: RecordHold | null }) {
  function goToAnswer() {
    if (!hold) return
    const names = [...document.querySelectorAll<HTMLElement>("#collection-record-editor .setup-field__name")]
    const name = names.find(item => item.textContent?.trim() === hold.question)
    const control = name?.closest(".setup-field")?.querySelector<HTMLElement>("select, input, textarea")
      ?? (name?.closest("label")?.htmlFor ? document.getElementById(name.closest("label")!.htmlFor) : null)
    if (!control) return
    control.focus({ preventScroll: true })
    control.scrollIntoView?.({ block: "center" })
  }
  return <div className={hold ? "wo12b-hold nv-notice nv-notice--warn" : "wo12b-hold wo12b-hold--none"} data-hold={hold?.code}>
    <div role="status" className="wo12b-hold__text">{hold && <>
      <p><strong>{RECORD_HOLD_TEXT.title}</strong></p>
      <p>{RECORD_HOLD_TEXT.cause(hold.question, hold.answer)}</p>
      <p>{hold.text}{hold.instead ? ` ${hold.instead}` : ""}</p>
      <p>{RECORD_HOLD_TEXT.labels} {RECORD_HOLD_TEXT.save}</p>
    </>}</div>
    {hold && <button type="button" className="nv-btn nv-btn--sm" onClick={goToAnswer}>{RECORD_HOLD_TEXT.goTo(hold.question)}</button>}
  </div>
}

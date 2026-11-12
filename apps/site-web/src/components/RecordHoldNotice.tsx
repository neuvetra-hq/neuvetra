import type { RecordHold } from "@/lib/record-holds-wo12b"
import { RECORD_HOLD_TEXT, SETUP_HOLD_TEXT } from "@/lib/wo12b-text"
import { setupSectionHash } from "@/lib/view-route"

/**
 * WO-12b (CEO ruling after QA round 3 of PR #57): while the record isn't counted as entered whatever else is filled in,
 * the top of the record form says so and says what holds it (an answer on this form, the site's or the company's setup,
 * or another record that replaces it), gives the server's own hold text (and what to do instead where that text doesn't
 * say it), and says the field labels apply once that changes. The live region is always in the page, so the notice is
 * announced as it appears and as it goes. "Go to …" moves focus to the answer on this form; a hold company setup decides
 * links to company setup at the section it names (#/setup/03; owners and admins; plain text for anyone else); a replaced spend line links to the record that
 * replaces it. It never blocks saving.
 */
export function RecordHoldNotice({ hold, canManage = true }: { hold: RecordHold | null; canManage?: boolean }) {
  function goToAnswer() {
    if (!hold?.question) return
    const names = [...document.querySelectorAll<HTMLElement>("#collection-record-editor .setup-field__name")]
    const name = names.find(item => item.textContent?.trim() === hold.question)
    const control = name?.closest(".setup-field")?.querySelector<HTMLElement>("select, input, textarea")
    if (!control) return
    control.focus({ preventScroll: true })
    control.scrollIntoView?.({ block: "center" })
  }
  return <div className={hold ? "wo12b-hold nv-notice nv-notice--warn" : "wo12b-hold wo12b-hold--none"} data-hold={hold?.code} data-hold-level={hold?.level}>
    <div role="status" className="wo12b-hold__text">{hold && <>
      <p><strong>{RECORD_HOLD_TEXT.title}</strong></p>
      <p>{hold.cause}</p>
      <p>{hold.text}{hold.instead ? ` ${hold.instead}` : ""}</p>
      <p>{hold.level === "record" && hold.question && hold.code !== "superseded_by_supplier_record" ? RECORD_HOLD_TEXT.labels : RECORD_HOLD_TEXT.labelsElsewhere} {RECORD_HOLD_TEXT.save}</p>
      {hold.setupStep && !canManage && <p>{SETUP_HOLD_TEXT.stepText(hold.setupStep)}</p>}
    </>}</div>
    {hold && <div className="wo12b-hold__actions">
      {hold.question && <button type="button" className="nv-btn nv-btn--sm" onClick={goToAnswer}>{RECORD_HOLD_TEXT.goTo(hold.question)}</button>}
      {hold.setupStep && canManage && <a className="nv-btn nv-btn--sm" href={setupSectionHash(Number(hold.setupStep.slice(0, 2)))}>{`${SETUP_HOLD_TEXT.link} (${hold.setupStep})`}</a>}
      {hold.link && <a className="nv-btn nv-btn--sm" href={hold.link.href}>{hold.link.label}</a>}
    </div>}
  </div>
}

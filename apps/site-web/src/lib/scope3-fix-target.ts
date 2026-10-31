/**
 * "Fix" lands on the right field (round 2, lane D; Claude, 31 October 2026; round-1 product review UX-3).
 *
 * Results asks for a record to be opened with `requestRecordFieldFocus(recordId, fields)` just before it navigates to the
 * Activity screen. The record editor calls `focusRecordEditor(recordId)` once it shows that record and the screen is idle:
 * the first listed field that is rendered and enabled is scrolled to the middle of the screen, focused and outlined until
 * it is changed; with none, the editor heading is focused as before. While late data (setup facts, spend lines) still moves
 * the layout, the target is brought back into view twice. One request at a time; it is used once.
 */
let pending: { recordId: string; fields: readonly string[] } | null = null

export function requestRecordFieldFocus(recordId: string, fields: readonly string[]): void { pending = { recordId, fields: [...fields] } }
/** The fields requested for this record (once), or none. */
export function takeRecordFieldFocus(recordId: string): readonly string[] {
  const request = pending
  pending = null
  return request && request.recordId === recordId ? request.fields : []
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement
const usable = (element: Element | null): element is Control => !!element && !(element as Control).disabled && !element.closest("fieldset:disabled")
const words = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim()

/**
 * The editor control named by one of `fields`, in order: a field whose label text is exactly the name (`label > span`, the
 * forms' markup), a checkbox whose label reads the name, or a button with that text. Null when none is rendered and enabled.
 */
export function findFieldControl(root: ParentNode, fields: readonly string[]): Control | null {
  for (const field of fields) {
    for (const label of Array.from(root.querySelectorAll("label"))) {
      const span = label.querySelector(":scope > span")
      const name = span ? words(span.textContent) : words(label.textContent)
      if (name !== field && !(span === null && name.startsWith(field))) continue
      const control = label.querySelector("input, select, textarea")
      if (usable(control)) return control
    }
    for (const button of Array.from(root.querySelectorAll("button"))) if (words(button.textContent) === field && usable(button)) return button
  }
  return null
}

/** How long a requested field is waited for while the record form's chunk loads (round 2 polish: forms load lazily). */
export const FIX_FIELD_WAIT_MS = 4000
const FIX_FIELD_POLL_MS = 100

/** Scrolls to and focuses the requested field of the open record (or the editor heading), and keeps it in view briefly. */
export function focusRecordEditor(recordId: string, doc: Document = document): HTMLElement | null {
  const editor = doc.getElementById("collection-record-editor")
  if (!editor) return null
  const fields = takeRecordFieldFocus(recordId)
  const control = fields.length ? findFieldControl(editor, fields) : null
  const heading = editor.querySelector("h2")
  const target: HTMLElement | null = control ?? heading
  if (!target) return null
  focusTarget(control ?? target, !!control, doc)
  // Round 2 polish (lane D): since the record forms load on first use (lane E, ENG-13), the editor can show the record
  // before its form has rendered the fields. The heading is focused now and the named field as soon as it renders.
  const view = doc.defaultView
  if (!control && fields.length && view) {
    let waited = 0
    const poll = () => {
      const later = findFieldControl(editor, fields)
      if (later) { focusTarget(later, true, doc); return }
      waited += FIX_FIELD_POLL_MS
      if (waited < FIX_FIELD_WAIT_MS) view.setTimeout(poll, FIX_FIELD_POLL_MS)
    }
    view.setTimeout(poll, FIX_FIELD_POLL_MS)
  }
  return target
}

function focusTarget(target: HTMLElement, isControl: boolean, doc: Document): void {
  if (!isControl) target.tabIndex = -1
  const block: ScrollLogicalPosition = isControl ? "center" : "start"
  target.scrollIntoView({ block })
  target.focus({ preventScroll: true })
  if (isControl) {
    const control = target as Control
    const outlined = (control.closest("label") ?? control) as HTMLElement
    outlined.dataset.fixTarget = "true"
    outlined.style.outline = "3px solid #e3b341"
    outlined.style.outlineOffset = "4px"
    const clear = () => { delete outlined.dataset.fixTarget; outlined.style.outline = ""; outlined.style.outlineOffset = "" }
    control.addEventListener("change", clear, { once: true })
    control.addEventListener("input", clear, { once: true })
  }
  const view = doc.defaultView
  for (const delay of [250, 800]) view?.setTimeout(() => {
    const box = target.getBoundingClientRect()
    if (box.top < 0 || box.bottom > (view.innerHeight || 0)) target.scrollIntoView({ block })
  }, delay)
}

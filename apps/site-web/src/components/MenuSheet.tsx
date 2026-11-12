import { useEffect, useRef, type ReactNode, type RefObject } from "react"
import { Icon } from "./Icon"

export const MENU_SHEET_ID = "nv-menu-sheet"
export const MENU_TEXT = { open: "Menu", title: "Menu", close: "Close menu", account: "Signed in as", signOut: "Sign out" } as const

/**
 * WO-08 (QA-180/181): below 1080 px the workspace navigation, Ask and the account controls live in this full-height
 * dialog. Focus is trapped inside it, Esc closes it, and closing returns focus to the ≡ Menu button (unless a navigation
 * moves focus to the new page heading afterwards). It scrolls internally under a sticky header.
 */
export function MenuSheet({ open, onClose, trigger, email, signingOut, onSignOut, children }: {
  open: boolean; onClose: () => void; trigger: RefObject<HTMLButtonElement | null>
  email: string | null; signingOut: boolean; onSignOut: () => void; children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    // Start on the current view's item, so Enter on the next item is one Tab away.
    const start = panel?.querySelector<HTMLElement>("[aria-current='page']") ?? panel?.querySelector<HTMLElement>("button:not([disabled])")
    start?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return }
      if (event.key !== "Tab" || !panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")].filter(item => item.getClientRects().length > 0)
      if (!focusable.length) return
      const first = focusable[0]!, last = focusable[focusable.length - 1]!
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKey)
    const button = trigger.current
    return () => { document.removeEventListener("keydown", onKey); button?.focus() }
  }, [open, onClose, trigger])

  if (!open) return null
  return <div className="nv-sheet" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="nv-sheet__panel" id={MENU_SHEET_ID} role="dialog" aria-modal="true" aria-labelledby="nv-menu-sheet-title" ref={panelRef}>
      <div className="nv-sheet__head">
        <h2 id="nv-menu-sheet-title" className="nv-sheet__title">{MENU_TEXT.title}</h2>
        <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm" onClick={onClose} aria-label={MENU_TEXT.close}><Icon name="close" size={18} /></button>
      </div>
      <div className="nv-sheet__body">
        {children}
        <div className="nv-sheet__account">
          <p className="nv-sheet__label">{MENU_TEXT.account}</p>
          <p className="nv-sheet__email">{email}</p>
          <button type="button" className="nv-btn nv-btn--block" disabled={signingOut} onClick={onSignOut}><Icon name="logout" size={18} />{MENU_TEXT.signOut}</button>
        </div>
      </div>
    </div>
  </div>
}

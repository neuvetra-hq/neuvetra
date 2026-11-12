import { useSyncExternalStore } from "react"
import { SLOW_REQUEST_TEXT, slowRequestCount, subscribeRequestEvents } from "@/lib/request-timeout"

const subscribe = (onChange: () => void) => subscribeRequestEvents(onChange)
/** True while at least one request is past the slow mark (8 s). */
const slowRequestsShowing = () => slowRequestCount() > 0

/**
 * WO-09 (P0-08): "Taking longer than usual…" while any workspace request runs past 8 s. Mounted once, beside the app.
 * The polite live region is always in the page and only its text changes, so a screen reader announces the notice once
 * however many slow requests overlap; it clears when the last one settles. It holds nothing focusable, never moves focus
 * and lets clicks pass through, so it never blocks the screen.
 */
export function SlowRequestNotice() {
  const showing = useSyncExternalStore(subscribe, slowRequestsShowing, () => false)
  return <div role="status" aria-live="polite" aria-atomic="true" className="slow-request-notice"
    style={{ position: "fixed", insetInline: 16, bottom: 16, zIndex: 50, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
    {showing && <div className="nv-notice nv-notice--info" style={{ margin: 0, maxWidth: 420, boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)" }}><p>{SLOW_REQUEST_TEXT}</p></div>}
  </div>
}

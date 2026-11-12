/**
 * The signed-in workspace's addresses (WO-07). One place turns a view into its `#/…` address and back, so the
 * workspace shell, session return (WO-05a) and the record view (WO-06) agree on what a valid address is.
 *
 * Addresses:
 *   #/overview            the Overview ("home")
 *   #/setup               Company setup
 *   #/activity            Activity & evidence
 *   #/activity/<uuid>     Activity & evidence with one record open
 *   #/results             Results & report
 *   #/earlier             the retired earlier views, a static list ("archive")
 *
 * Anything else parses to the Overview. Every `#/earlier/<anything>` parses to the static list, so its canonical
 * address is `#/earlier` (the milestone panels it used to open are retired).
 */

/** A view the workspace can show. */
export type WorkspaceView = "home" | "setup" | "collection" | "results" | "archive"

/** A parsed address: the view and, for Activity & evidence only, the open record's ID. */
export interface ViewRoute { panel: WorkspaceView; recordId: string | null }

const HASHES: Record<WorkspaceView, string> = { home: "overview", setup: "setup", collection: "activity", results: "results", archive: "earlier" }
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The canonical address of a view. A record ID is used only with Activity & evidence. */
export function viewHash(panel: WorkspaceView, recordId: string | null = null): string {
  if (panel === "collection" && recordId) return `#/activity/${recordId}`
  return `#/${HASHES[panel]}`
}

/**
 * Reads an address. Never throws: an unknown or malformed address is the Overview, and a record ID that isn't a UUID
 * is dropped (Activity & evidence opens without a record). `viewHash(parseViewHash(x))` is the canonical form of `x`.
 */
export function parseViewHash(hash: string): ViewRoute {
  const match = /^#\/([a-z]+)(?:\/([A-Za-z0-9-]+))?$/.exec(hash)
  if (!match) return { panel: "home", recordId: null }
  const [, view, detail] = match
  if (view === "activity") return { panel: "collection", recordId: detail && RECORD_ID.test(detail) ? detail : null }
  if (view === "earlier") return { panel: "archive", recordId: null }
  const found = (Object.entries(HASHES) as Array<[WorkspaceView, string]>).find(([, value]) => value === view)
  return { panel: found ? found[0] : "home", recordId: null }
}

/**
 * WO-05a (QA-145): an address that comes from outside the running view (storage, a sign-in redirect) is used only if it
 * is one of the addresses above. Returns its canonical form, or null for anything else: a full URL, `javascript:`,
 * another origin, an unknown view, or text that merely falls back to the Overview.
 */
export function acceptedViewHash(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 64 || !/^#\/[a-z]+(?:\/[A-Za-z0-9-]+)?$/.test(raw)) return null
  const route = parseViewHash(raw)
  if (route.panel === "home" && !raw.startsWith("#/overview")) return null
  return viewHash(route.panel, route.recordId)
}

/**
 * WO-05a: the view to return to after the session ends and the same person signs in again, possibly from an email link
 * opened in another tab. Kept for 24 hours in this browser, bound to the user, and removed when it is read and on a
 * deliberate sign-out. It holds only a view address (never a token or any workspace data).
 */
export const RETURN_VIEW_KEY = "nv:return-view:v1"
const RETURN_VIEW_TTL_MS = 24 * 60 * 60 * 1000
type ViewStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function rememberReturnView(storage: ViewStorage | null, userId: string, hash: string, now = Date.now()): void {
  const accepted = acceptedViewHash(hash)
  try {
    if (!storage) return
    if (!accepted) { storage.removeItem(RETURN_VIEW_KEY); return }
    storage.setItem(RETURN_VIEW_KEY, JSON.stringify({ hash: accepted, userId, savedAt: now }))
  } catch { /* storage may be unavailable; the address in the URL still works */ }
}

/** Reads and removes the stored view. Returns it only if it belongs to `userId`, is unexpired and is a valid address. */
export function takeReturnView(storage: ViewStorage | null, userId: string, now = Date.now()): string | null {
  try {
    if (!storage) return null
    const raw = storage.getItem(RETURN_VIEW_KEY)
    storage.removeItem(RETURN_VIEW_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object") return null
    const { hash, userId: owner, savedAt } = value as Record<string, unknown>
    if (owner !== userId || typeof savedAt !== "number" || !(now - savedAt >= 0 && now - savedAt <= RETURN_VIEW_TTL_MS)) return null
    return acceptedViewHash(hash)
  } catch { return null }
}

export function forgetReturnView(storage: ViewStorage | null): void {
  try { storage?.removeItem(RETURN_VIEW_KEY) } catch { /* nothing stored */ }
}

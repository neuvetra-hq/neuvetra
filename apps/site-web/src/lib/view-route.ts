/**
 * The signed-in workspace's addresses (WO-07). One place turns a view into its `#/…` address and back, so the
 * workspace shell, session return (WO-05a) and the record view (WO-06) agree on what a valid address is.
 *
 * Addresses:
 *   #/overview            the Overview ("home")
 *   #/setup               Company setup
 *   #/activity            Activity & evidence
 *   #/activity/<uuid>     Activity & evidence with one record open (the record view, WO-06)
 *   #/activity?status=…   the Activity list with its filters (WO-06; see parseActivityListQuery)
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

/**
 * WO-06: the Activity list keeps its filters in its address, `#/activity?status=&type=&page=` (page counts from 1), so
 * Back, Forward and refresh restore them. Free-text search never goes in the address. Only `#/activity` takes a query;
 * a value that isn't one of the known shapes falls back to its default, and a query with any other character makes the
 * whole address unknown (the Overview), as before.
 */
export type ActivityListStatus = "all" | "attention" | "ready" | "withdrawn"
export interface ActivityListQuery { status: ActivityListStatus; type: string; page: number }
export const DEFAULT_ACTIVITY_LIST_QUERY: ActivityListQuery = { status: "all", type: "", page: 1 }
const LIST_STATUSES: readonly ActivityListStatus[] = ["all", "attention", "ready", "withdrawn"]
const LIST_TYPE = /^[a-z][a-z0-9_]{0,39}$/
const LIST_PAGE = /^[1-9][0-9]{0,3}$/

/** The list filters in an Activity list address (defaults for anything missing, unknown or malformed). */
export function parseActivityListQuery(hash: string): ActivityListQuery {
  const query = { ...DEFAULT_ACTIVITY_LIST_QUERY }
  const route = parseViewHash(hash)
  if (route.panel !== "collection" || route.recordId !== null) return query
  const at = hash.indexOf("?")
  if (at < 0) return query
  for (const part of hash.slice(at + 1).split("&")) {
    const [key, value = "", ...rest] = part.split("=")
    if (rest.length) continue
    if (key === "status" && (LIST_STATUSES as readonly string[]).includes(value)) query.status = value as ActivityListStatus
    else if (key === "type" && LIST_TYPE.test(value)) query.type = value
    else if (key === "page" && LIST_PAGE.test(value)) query.page = Number(value)
  }
  return query
}

/** The Activity list address for these filters; a default value is left out, so no filters is plain `#/activity`. */
export function activityListHash(query: Partial<ActivityListQuery>): string {
  const params: string[] = []
  if (query.status && query.status !== "all" && (LIST_STATUSES as readonly string[]).includes(query.status)) params.push(`status=${query.status}`)
  if (query.type && LIST_TYPE.test(query.type)) params.push(`type=${query.type}`)
  if (query.page && Number.isInteger(query.page) && query.page > 1 && LIST_PAGE.test(String(query.page))) params.push(`page=${query.page}`)
  return params.length ? `#/activity?${params.join("&")}` : "#/activity"
}

/** The canonical form of any address: `viewHash` of what it parses to, keeping valid Activity list filters. */
export function canonicalViewHash(hash: string): string {
  const route = parseViewHash(hash)
  return route.panel === "collection" && route.recordId === null ? activityListHash(parseActivityListQuery(hash)) : viewHash(route.panel, route.recordId)
}

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
  const match = /^#\/([a-z]+)(?:\/([A-Za-z0-9-]+)|(?<=^#\/activity)\?[a-z0-9_=&]{0,120})?$/.exec(hash)
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
 * opened in another tab. Kept for 24 hours in this browser and bound to the user. Reading it for another person (or
 * finding it expired or invalid) removes it; the same person may read it again (the tab the session ended in and the
 * sign-in link's new tab both return to it). A deliberate sign-out or the next session end replaces or removes it.
 * It holds only a view address (never a token or any workspace data).
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

/** Reads the stored view for `userId`: returns it only if it is theirs, unexpired and valid; otherwise removes it. */
export function takeReturnView(storage: ViewStorage | null, userId: string, now = Date.now()): string | null {
  return readReturnView(storage, userId, now, true)
}

/** Reads the stored view without removing it (for the sign-in link), under the same rules as takeReturnView. */
export function peekReturnView(storage: ViewStorage | null, userId: string, now = Date.now()): string | null {
  return readReturnView(storage, userId, now, false)
}

function readReturnView(storage: ViewStorage | null, userId: string, now: number, remove: boolean): string | null {
  try {
    if (!storage) return null
    const raw = storage.getItem(RETURN_VIEW_KEY)
    if (!raw) return null
    let found: string | null = null
    try {
      const value: unknown = JSON.parse(raw)
      if (value && typeof value === "object") {
        const { hash, userId: owner, savedAt } = value as Record<string, unknown>
        if (owner === userId && typeof savedAt === "number" && now - savedAt >= 0 && now - savedAt <= RETURN_VIEW_TTL_MS) found = acceptedViewHash(hash)
      }
    } catch { found = null }
    if (remove && !found) storage.removeItem(RETURN_VIEW_KEY)
    return found
  } catch { return null }
}

export function forgetReturnView(storage: ViewStorage | null): void {
  try { storage?.removeItem(RETURN_VIEW_KEY) } catch { /* nothing stored */ }
}

/**
 * WO-05a QA fix: a deliberate sign-out leaves a short-lived mark, so another tab that sees the resulting SIGNED_OUT does
 * not write its view back as a return view (WO-05b's BroadcastChannel will clear the rest). Holds only a time.
 */
export const SIGNED_OUT_MARK_KEY = "nv:signed-out:v1"
const SIGNED_OUT_MARK_MS = 60_000
export function markDeliberateSignOut(storage: ViewStorage | null, now = Date.now()): void {
  try { storage?.setItem(SIGNED_OUT_MARK_KEY, String(now)) } catch { /* best effort */ }
}
export function recentlySignedOut(storage: ViewStorage | null, now = Date.now()): boolean {
  try {
    const at = Number(storage?.getItem(SIGNED_OUT_MARK_KEY))
    return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at <= SIGNED_OUT_MARK_MS
  } catch { return false }
}

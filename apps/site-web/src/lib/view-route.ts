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

/**
 * WO-14a (step 1 of the CTO's WO-14 sign-out design, §1 and §2; Claude, 12 November 2026): pure lineage rules. Nothing in
 * the app imports this module yet: it is the specification the next steps are built against.
 *
 * - A **lineage** is a random ID made at a deliberate sign-in and inherited by every refresh of that session. The stored
 *   Supabase session (`neuvetra:m63:<ref>:auth`) carries it as `nv_lineage`.
 * - **E** (`nv:auth-ended:v1` in localStorage) lists the lineages that were signed out on this browser:
 *   `{ lineage, userId, at }`, kept 30 days and at most 50 entries. It never holds a token: only those three fields are
 *   ever written, and a lineage must be a UUID.
 * - A **generation** is one Supabase client of one tab, tied to one lineage (or none, on the landing page). The decision
 *   functions below say what that generation's storage adapter does with each `getItem`, `setItem` and `removeItem` of the
 *   session key. Removal and refusal act only on the lineage that was signed out, never on "any session".
 *
 * WO-14b (CTO Addendum A, CEO Addendum B): a generation sees only its own lineage's session (R1); `wouldRefuseSet` and
 * `wouldRefuseRemove` let its fetch refuse an answer before auth-js acts on it (A2 iv); `adoptLegacy` stamps a session
 * that has no lineage, in app code (R3); lineages (F3) and E's user IDs (F4) must be UUIDs.
 */
import { DRAFT_PREFIX } from "./draft-store"

export const ENDED_KEY = "nv:auth-ended:v1"
export const ENDED_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const ENDED_MAX = 50
export const LINEAGE_FIELD = "nv_lineage"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface EndedLineage { lineage: string; userId: string | null; at: number }
type ReadStorage = Pick<Storage, "getItem">
type WriteStorage = Pick<Storage, "getItem" | "setItem">
type DraftStorage = Pick<Storage, "getItem" | "removeItem" | "key" | "length">

export function isLineage(value: unknown): value is string { return typeof value === "string" && UUID.test(value) }

/** A fresh lineage for a deliberate sign-in (or for adopting a stored session that has none). */
export function newLineage(): string { return crypto.randomUUID() }

/** Only well-formed, unexpired entries; the newest `ENDED_MAX`, newest first; one entry per lineage (the newest). */
export function pruneEnded(entries: readonly unknown[], now: number): EndedLineage[] {
  const kept = new Map<string, EndedLineage>()
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
    const { lineage, userId, at } = entry as Record<string, unknown>
    if (!isLineage(lineage) || typeof at !== "number" || !Number.isFinite(at)) continue
    if (at < now - ENDED_TTL_MS || at > now + ENDED_TTL_MS) continue
    // F4: a user ID is a UUID (Supabase's auth.users.id); anything else, such as an opaque refresh token, is not kept.
    const user = typeof userId === "string" && UUID.test(userId) ? userId.toLowerCase() : null
    const key = lineage.toLowerCase()
    const previous = kept.get(key)
    if (!previous || previous.at < at) kept.set(key, { lineage: key, userId: user, at })
  }
  return [...kept.values()].sort((a, b) => b.at - a.at).slice(0, ENDED_MAX)
}

/** E as stored, pruned. Missing, corrupt or refused storage reads as an empty list (it never throws). */
export function readEnded(storage: ReadStorage | null, now: number): EndedLineage[] {
  if (!storage) return []
  try {
    const value: unknown = JSON.parse(storage.getItem(ENDED_KEY) ?? "[]")
    return Array.isArray(value) ? pruneEnded(value, now) : []
  } catch { return [] }
}

/**
 * Adds a signed-out lineage to E (pruned, rewritten whole: a corrupt E is replaced). Returns the list written, or null
 * when the lineage isn't a UUID or the storage refused. Only `lineage`, `userId` and `at` are written.
 */
export function addEnded(storage: WriteStorage | null, entry: { lineage: string; userId: string | null }, now: number): EndedLineage[] | null {
  if (!storage || !isLineage(entry.lineage)) return null
  const list = pruneEnded([{ lineage: entry.lineage, userId: entry.userId, at: now }, ...readEnded(storage, now)], now)
  try {
    storage.setItem(ENDED_KEY, JSON.stringify(list.map(({ lineage, userId, at }) => ({ lineage, userId, at }))))
    return list
  } catch { return null }
}

export function isEnded(ended: readonly EndedLineage[], lineage: string | null): boolean {
  if (!lineage) return false
  const key = lineage.toLowerCase()
  return ended.some(entry => entry.lineage === key)
}

/** What a stored session says about itself: its lineage (null when it has none or isn't readable). */
export interface StoredView { lineage: string | null; userId: string | null; readable: boolean }
export function readStored(raw: string | null): StoredView | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return { lineage: null, userId: null, readable: false }
    const record = value as Record<string, unknown>
    const lineage = isLineage(record[LINEAGE_FIELD]) ? (record[LINEAGE_FIELD] as string).toLowerCase() : null
    const user = record.user && typeof record.user === "object" ? (record.user as Record<string, unknown>).id : null
    return { lineage, userId: typeof user === "string" ? user : null, readable: true }
  } catch { return { lineage: null, userId: null, readable: false } }
}

/** The session JSON with `nv_lineage` set (for a write by a generation, or for adopting a session that has none). */
export function stampLineage(raw: string, lineage: string): string | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    return JSON.stringify({ ...(value as Record<string, unknown>), [LINEAGE_FIELD]: lineage })
  } catch { return null }
}

/** The part of a generation the rules read. `lineage` is null on the landing page (a generation with no session). */
export interface GenerationState { retired: boolean; deliberate: boolean; lineage: string | null; lastWritten: string | null }

export type GetDecision =
  /** Hand the stored value to the client unchanged (only ever this generation's own lineage, or nothing stored). */
  | { kind: "value"; value: string | null }
  /** Hand the client nothing and leave storage as it is. */
  | { kind: "none" }
  /** The stored session belongs to an ended lineage: remove it (only while it still holds that lineage) and hand nothing. */
  | { kind: "drop"; lineage: string }
  /** An ended lineage overwrote this live generation's own session (cross-tab lag): write `value` back and hand it over. */
  | { kind: "repair"; value: string; dropped: string }

/** The generation's lineage when it is a UUID (F3: anything else counts as no lineage), lower case. */
function ownLineage(state: GenerationState): string | null { return isLineage(state.lineage) ? state.lineage.toLowerCase() : null }

/**
 * `getItem(sessionKey)`:
 * - a retired generation reads nothing;
 * - a stored session of an ended lineage is dropped, unless this generation is live, its own lineage isn't ended and it
 *   wrote the session last (`lastWritten`): then the ended lineage overwrote it in a lagging tab, and it is repaired.
 *   F1: a repair happens only over an ended lineage, never over a live other lineage or a session without one;
 * - R1: otherwise the client sees only its own lineage's session. Another lineage's session, a session without a lineage,
 *   an unreadable value, or any session for a generation without a lineage reads as nothing, so a generation can never send
 *   another lineage's refresh token (I9). App code reads the stored session directly, never through a client.
 */
export function decideGet(state: GenerationState, stored: string | null, ended: readonly EndedLineage[]): GetDecision {
  if (state.retired) return { kind: "none" }
  const view = readStored(stored)
  if (!view) return { kind: "value", value: null }
  const own = ownLineage(state)
  if (view.lineage && isEnded(ended, view.lineage)) {
    const mine = readStored(state.lastWritten)
    if (own && state.lastWritten && mine?.lineage === own && !isEnded(ended, own)) return { kind: "repair", value: state.lastWritten, dropped: view.lineage }
    return { kind: "drop", lineage: view.lineage }
  }
  return own && view.lineage === own ? { kind: "value", value: stored } : { kind: "none" }
}

export type RefusalReason = "retired" | "ended" | "other-lineage" | "no-lineage"
export type SetDecision =
  | { kind: "write"; value: string }
  /** Throw (so auth-js neither notifies nor broadcasts); `retire` says the generation retires itself as well. */
  | { kind: "refuse"; reason: RefusalReason; retire: boolean }

/**
 * `setItem(sessionKey, value)`:
 * - refused if the generation is retired, or its lineage is in E (it then retires itself);
 * - refused if it has no lineage, or one that isn't a UUID (F3; only a sign-in or an adoption gives one);
 * - a non-deliberate generation (a refresh, an adopted session) may not replace a stored session of another lineage, or
 *   one with no lineage: refused, and it retires itself;
 * - a deliberate generation (a sign-in) always writes: the deliberate sign-in wins. L1: the generation is deliberate for
 *   exactly one write, the sign-in's own session; `auth-generation.ts` clears `deliberate` once that write is made;
 * - the value written is the session with `nv_lineage` set to the generation's lineage.
 */
export function decideSet(state: GenerationState, value: string, stored: string | null, ended: readonly EndedLineage[]): SetDecision {
  if (state.retired) return { kind: "refuse", reason: "retired", retire: false }
  const own = ownLineage(state)
  if (!own) return { kind: "refuse", reason: "no-lineage", retire: false }
  if (isEnded(ended, own)) return { kind: "refuse", reason: "ended", retire: true }
  const view = readStored(stored)
  if (!state.deliberate && view && view.lineage !== own) return { kind: "refuse", reason: "other-lineage", retire: true }
  const stamped = stampLineage(value, own)
  return stamped === null ? { kind: "refuse", reason: "no-lineage", retire: false } : { kind: "write", value: stamped }
}

export type RemoveDecision = { kind: "remove" } | { kind: "absent" } | { kind: "refuse"; reason: RefusalReason }

/**
 * `removeItem(sessionKey)`: a retired generation removes nothing; otherwise the session is removed only when it holds this
 * generation's own lineage (also when that lineage has ended). A session of another lineage, or one with no lineage, is
 * refused, so a late 400 from A's generation never removes B's session and no SIGNED_OUT follows. No session: nothing to do.
 */
export function decideRemove(state: GenerationState, stored: string | null): RemoveDecision {
  if (state.retired) return { kind: "refuse", reason: "retired" }
  const view = readStored(stored)
  if (!view) return { kind: "absent" }
  const own = ownLineage(state)
  if (!own) return { kind: "refuse", reason: "no-lineage" }
  return view.lineage === own ? { kind: "remove" } : { kind: "refuse", reason: "other-lineage" }
}

/**
 * A2 (iv): what the generation's storage would refuse if auth-js wrote a session now. The fetch asks this for a 2xx answer
 * carrying a session, in the same task in which auth-js will then write it, and answers 503 instead of letting it through.
 */
export function wouldRefuseSet(state: GenerationState, stored: string | null, ended: readonly EndedLineage[]): Extract<SetDecision, { kind: "refuse" }> | null {
  // The session's own fields don't change the decision: only state, the stored session and E do.
  const decision = decideSet(state, "{}", stored, ended)
  return decision.kind === "refuse" ? decision : null
}

/** A2 (iv): what the generation's storage would refuse if auth-js removed the session now (a refresh answered with an error). */
export function wouldRefuseRemove(state: GenerationState, stored: string | null): Extract<RemoveDecision, { kind: "refuse" }> | null {
  const decision = decideRemove(state, stored)
  return decision.kind === "refuse" ? decision : null
}

export type AdoptResult =
  /** Nothing stored, or nothing that is a session. */
  | { kind: "none" }
  /** The stored session already has a live lineage (stamped by a sign-in, or by another tab's adoption): adopt that one. */
  | { kind: "existing"; lineage: string }
  /** The stored session's lineage has ended: nothing to adopt (the boot drop removes it). */
  | { kind: "ended"; lineage: string }
  /** The session had no lineage: it now holds `lineage`, written by this call. */
  | { kind: "stamped"; lineage: string }

function sessionTokens(raw: string | null): { refreshToken: string } | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const { access_token: access, refresh_token: refresh, expires_at: expires } = value as Record<string, unknown>
    return typeof access === "string" && access && typeof refresh === "string" && refresh && typeof expires === "number" ? { refreshToken: refresh } : null
  } catch { return null }
}

/**
 * R3: adopts a stored session that has no lineage (signed in before WO-14, or refreshed by a tab still on old code),
 * in app code, before any generation exists for it. Synchronous compare-and-set: the stored value is re-read, and only if
 * it is still a valid session without a lineage (and, when `expectedRefreshToken` is given, still that refresh token) is
 * it written back stamped with a fresh lineage. A session that already has a lineage is adopted as it is; so two tabs
 * adopting at once converge: the stamp written last wins, and the next read in the other tab adopts that lineage.
 */
export function adoptLegacy(storage: Pick<Storage, "getItem" | "setItem"> | null, sessionKey: string, ended: readonly EndedLineage[], options: { expectedRefreshToken?: string; lineage?: () => string } = {}): AdoptResult {
  if (!storage) return { kind: "none" }
  try {
    const raw = storage.getItem(sessionKey)
    const view = readStored(raw)
    const tokens = sessionTokens(raw)
    if (!view || !tokens) return { kind: "none" }
    if (view.lineage) return isEnded(ended, view.lineage) ? { kind: "ended", lineage: view.lineage } : { kind: "existing", lineage: view.lineage }
    if (options.expectedRefreshToken !== undefined && tokens.refreshToken !== options.expectedRefreshToken) return { kind: "none" }
    const lineage = (options.lineage ?? newLineage)()
    const stamped = isLineage(lineage) ? stampLineage(raw!, lineage.toLowerCase()) : null
    if (!stamped) return { kind: "none" }
    storage.setItem(sessionKey, stamped)
    return { kind: "stamped", lineage: lineage.toLowerCase() }
  } catch { return { kind: "none" } }
}

/**
 * At boot (a reload, a tab opened later or a closed tab restored), and on a `storage` event: removes the stored session
 * if it holds an ended lineage (lineage-bound: a session of a live lineage is never touched). Returns whether it removed.
 */
export function dropEndedSession(storage: Pick<Storage, "getItem" | "removeItem"> | null, sessionKey: string, ended: readonly EndedLineage[]): boolean {
  if (!storage) return false
  try {
    const view = readStored(storage.getItem(sessionKey))
    if (!view?.lineage || !isEnded(ended, view.lineage)) return false
    storage.removeItem(sessionKey)
    storage.removeItem(`${sessionKey}-user`)
    return true
  } catch { return false }
}

/**
 * The boot purge of drafts against E (a closed tab restored with Ctrl+Shift+T after its user signed out elsewhere): a draft
 * goes when its user has an E entry newer than the draft's `savedAt`. A draft of such a user whose `savedAt` can't be read
 * goes too. Drafts of other users, and drafts saved after the user's latest sign-out, stay. Returns the keys removed.
 */
export function purgeEndedDrafts(storage: DraftStorage | null, ended: readonly EndedLineage[]): string[] {
  if (!storage || ended.length === 0) return []
  const latest = new Map<string, number>()
  for (const entry of ended) if (entry.userId) latest.set(entry.userId, Math.max(latest.get(entry.userId) ?? -Infinity, entry.at))
  const removed: string[] = []
  try {
    const keys: string[] = []
    for (let index = 0; index < storage.length; index++) { const key = storage.key(index); if (key?.startsWith(DRAFT_PREFIX)) keys.push(key) }
    for (const key of keys) {
      const userId = key.slice(DRAFT_PREFIX.length).split(":")[0] ?? ""
      const endedAt = latest.get(userId)
      if (endedAt === undefined) continue
      let savedAt: number | null = null
      try {
        const value: unknown = JSON.parse(storage.getItem(key) ?? "null")
        const found = value && typeof value === "object" ? (value as Record<string, unknown>).savedAt : null
        savedAt = typeof found === "number" && Number.isFinite(found) ? found : null
      } catch { savedAt = null }
      if (savedAt === null || savedAt < endedAt) { storage.removeItem(key); removed.push(key) }
    }
  } catch { /* storage refused: nothing more can be removed */ }
  return removed
}

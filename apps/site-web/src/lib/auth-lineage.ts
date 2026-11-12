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
 */
import { DRAFT_PREFIX } from "./draft-store"

export const ENDED_KEY = "nv:auth-ended:v1"
export const ENDED_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const ENDED_MAX = 50
export const LINEAGE_FIELD = "nv_lineage"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const USER_ID = /^[A-Za-z0-9-]{1,64}$/

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
    const user = typeof userId === "string" && USER_ID.test(userId) ? userId : null
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
  /** Hand the stored value to the client unchanged. */
  | { kind: "value"; value: string | null }
  /** Hand the client nothing and leave storage as it is. */
  | { kind: "none" }
  /** The stored session belongs to an ended lineage: remove it (only while it still holds that lineage) and hand nothing. */
  | { kind: "drop"; lineage: string }
  /** An ended lineage overwrote this live generation's own session (cross-tab lag): write `value` back and hand it over. */
  | { kind: "repair"; value: string; dropped: string }

/**
 * `getItem(sessionKey)`:
 * - a retired generation reads nothing;
 * - a stored session of an ended lineage is dropped, unless this generation is live, its own lineage isn't ended and it
 *   wrote the session last (`lastWritten`): then the ended lineage overwrote it in a lagging tab, and it is repaired;
 * - anything else (no session, this lineage, another live lineage, a session with no lineage) is returned as stored. The
 *   extra `nv_lineage` field is harmless: auth-js checks only the token fields.
 */
export function decideGet(state: GenerationState, stored: string | null, ended: readonly EndedLineage[]): GetDecision {
  if (state.retired) return { kind: "none" }
  const view = readStored(stored)
  if (view?.lineage && isEnded(ended, view.lineage)) {
    const own = readStored(state.lastWritten)
    if (state.lineage && state.lastWritten && own?.lineage === state.lineage.toLowerCase() && !isEnded(ended, state.lineage)) return { kind: "repair", value: state.lastWritten, dropped: view.lineage }
    return { kind: "drop", lineage: view.lineage }
  }
  return { kind: "value", value: stored }
}

export type RefusalReason = "retired" | "ended" | "other-lineage" | "no-lineage"
export type SetDecision =
  | { kind: "write"; value: string }
  /** Throw (so auth-js neither notifies nor broadcasts); `retire` says the generation retires itself as well. */
  | { kind: "refuse"; reason: RefusalReason; retire: boolean }

/**
 * `setItem(sessionKey, value)`:
 * - refused if the generation is retired, or its lineage is in E (it then retires itself);
 * - refused if it has no lineage (only a sign-in or an adoption gives one, and only those may store a session);
 * - a non-deliberate generation (a refresh, an adopted session) may not replace a stored session of another lineage, or
 *   one with no lineage: refused, and it retires itself;
 * - a deliberate generation (a sign-in) always writes: the deliberate sign-in wins;
 * - the value written is the session with `nv_lineage` set to the generation's lineage.
 */
export function decideSet(state: GenerationState, value: string, stored: string | null, ended: readonly EndedLineage[]): SetDecision {
  if (state.retired) return { kind: "refuse", reason: "retired", retire: false }
  if (!state.lineage) return { kind: "refuse", reason: "no-lineage", retire: false }
  if (isEnded(ended, state.lineage)) return { kind: "refuse", reason: "ended", retire: true }
  const view = readStored(stored)
  if (!state.deliberate && view && view.lineage !== state.lineage.toLowerCase()) return { kind: "refuse", reason: "other-lineage", retire: true }
  const stamped = stampLineage(value, state.lineage.toLowerCase())
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
  if (!state.lineage) return { kind: "refuse", reason: "no-lineage" }
  return view.lineage === state.lineage.toLowerCase() ? { kind: "remove" } : { kind: "refuse", reason: "other-lineage" }
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

/**
 * WO-05b (Claude, 12 November 2026): unsaved activity and setup input survives a session end or a refresh.
 *
 * A draft lives in this browser tab's sessionStorage under
 *   nv:draft:v1:<userId>:<companyId>:<view>[:<recordId|new>]
 * as { savedAt, expiresAt (24 h), fields, binding: { expectedRevision, expectedVersionId }, idempotencyKey, request }.
 * `fields` is what the person typed; `binding` is the saved version the input was based on, so a restored draft saves
 * against it and newer server data gives the existing 409 conflict state (never a silent overwrite); `idempotencyKey` and
 * `request` are kept only after a save was attempted and nothing changed since, so a retry after restoring reuses that
 * exact request (one new version even if the first attempt reached the server). Never a token, a file's contents or a
 * server response.
 *
 * Who may hold drafts is decided before the workspace renders (`admitDrafts`, from PrivateStaging): only an owner or
 * admin, and only for the user and company that just opened. Every other draft in the tab is removed then, as are
 * expired and unreadable ones; a member's activation removes them all. A deliberate sign-out removes every draft here and
 * tells the other tabs (BroadcastChannel `nv-drafts`, message `nv:draft-clear`), and writes stop until the next
 * activation. Nothing restores by itself: the screen offers "Restore unsaved changes from <time>?".
 */

export const DRAFT_PREFIX = "nv:draft:v1:"
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000
/** Typing is written at most once a second (the last change wins); a session end or page hide writes at once. */
export const DRAFT_DEBOUNCE_MS = 1_000
export const DRAFT_CHANNEL = "nv-drafts"
export const DRAFT_CLEAR_MESSAGE = "nv:draft-clear"
/** The largest draft kept (characters of JSON); the server refuses requests above 150,000 bytes anyway. */
const MAX_DRAFT_CHARS = 300_000

export const DRAFT_TEXT = {
  offer: (time: string) => `Restore unsaved changes from ${time}?`,
  restore: "Restore",
  discard: "Discard",
  restored: "Unsaved changes restored. They aren’t saved yet: save them when you’re ready.",
  discarded: "Unsaved changes discarded.",
  /**
   * The second sentence of the "Your session ended" screen (WO-05a left it to this order). WO-13 (WO-05b follow-up): it
   * says how long the changes stay on this device and how to remove them now.
   */
  sessionEnded: "Unsaved changes are kept on this device, in this browser tab, until the next sign-in here (you’re offered them back if it’s you), until the tab is closed, or for up to 24 hours. Signing out or discarding removes them now.",
  /** WO-13: the session-ended screen's controls and the in-page confirmation. */
  discardOnDevice: "Discard unsaved changes on this device",
  discardConfirmTitle: "Discard unsaved changes on this device?",
  /** WO-13 (QA F4 of PR #56): the drafts of every open tab of this browser go, not only this tab's. */
  discardConfirmBody: "Your unsaved changes in every open tab of this browser on this device, and this browser’s stored sign-in, are removed. This can’t be undone.",
  discardConfirm: "Discard changes and sign-in",
  discardCancel: "Keep them",
  discardDone: "Unsaved changes discarded. Signed out on this browser.",
  signOut: "Sign out",
  /** WO-13 (QA F4): Sign out also removes the drafts, so while this tab holds some the button says so. */
  signOutAndDiscard: "Sign out and discard unsaved changes",
  /** Landing, "Shared computer?". */
  sharedComputer: "Sign out when you finish — it clears this browser’s session and any unsaved changes kept in this tab.",
} as const

/**
 * WO-13 (QA B1 of PR #56): a sign-out removes everything on this device first; when the server then can't be told (no
 * answer within 5 s, or a failure), the message says so plainly.
 */
export const SIGN_OUT_SERVER_NOT_TOLD = {
  plain: "Signed out: the sign-in was removed from this device. The server could not be told, so the sign-in may stay valid elsewhere until it expires.",
  discard: "Unsaved changes discarded and the sign-in removed from this device. The server could not be told, so the sign-in may stay valid elsewhere until it expires.",
} as const

export type DraftView = "activity" | "setup"
export interface DraftScope { userId: string; companyId: string; view: DraftView; item?: string | null }
export interface DraftBinding { expectedRevision: number; expectedVersionId: string | null }
export interface StoredDraft<F> {
  savedAt: number
  expiresAt: number
  fields: F
  binding: DraftBinding
  idempotencyKey: string | null
  /** The exact request (without its key) last sent with `idempotencyKey`; present only with it. */
  request: Record<string, unknown> | null
}
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SEGMENT = /^[A-Za-z0-9-]{1,64}$/

/** This tab's sessionStorage, or null where there is none (or it is refused). */
export function draftStorage(): DraftStorage | null {
  try { return typeof sessionStorage === "undefined" ? null : sessionStorage } catch { return null }
}

/** The storage key of a draft, or null when any part isn't a plain identifier (nothing is then read or written). */
export function draftKey(scope: DraftScope): string | null {
  const { userId, companyId, view, item } = scope
  if (!SEGMENT.test(userId) || !SEGMENT.test(companyId) || (view !== "activity" && view !== "setup")) return null
  if (view === "setup") return item ? null : `${DRAFT_PREFIX}${userId}:${companyId}:setup`
  if (!item || (item !== "new" && !UUID.test(item))) return null
  return `${DRAFT_PREFIX}${userId}:${companyId}:activity:${item}`
}

function parseKey(key: string): { userId: string; companyId: string } | null {
  if (!key.startsWith(DRAFT_PREFIX)) return null
  const [userId, companyId, view, item, ...rest] = key.slice(DRAFT_PREFIX.length).split(":")
  if (rest.length || !userId || !companyId) return null
  const scope = { userId, companyId, view: view as DraftView, item: item ?? null }
  return draftKey(scope) === key ? { userId, companyId } : null
}

/**
 * Who may write drafts in this tab now: set by `admitDrafts` when a workspace opens, and cleared by a deliberate sign-out
 * here or in another tab. A session end leaves it, so the input typed until then is still written.
 */
let owner: { userId: string; companyId: string; canStore: boolean } | null = null
/** Keys whose removal waits for the end of this task: a component that leaves the screen (StrictMode remounts at once). */
const removals = new Map<string, ReturnType<typeof setTimeout>>()

function canStoreRole(role: string) { return role === "owner" || role === "admin" }
function allDraftKeys(storage: DraftStorage): string[] {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index++) { const key = storage.key(index); if (key?.startsWith(DRAFT_PREFIX)) keys.push(key) }
  return keys
}

function decode(raw: string | null, now: number): StoredDraft<unknown> | null {
  if (!raw || raw.length > MAX_DRAFT_CHARS) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const { savedAt, expiresAt, fields, binding, idempotencyKey, request } = value as Record<string, unknown>
  if (typeof savedAt !== "number" || typeof expiresAt !== "number" || !Number.isFinite(savedAt) || expiresAt !== savedAt + DRAFT_TTL_MS) return null
  if (savedAt > now + 60_000 || now > expiresAt) return null
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null
  if (!binding || typeof binding !== "object") return null
  const { expectedRevision, expectedVersionId } = binding as Record<string, unknown>
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0 || (expectedRevision as number) > 9999) return null
  if (expectedVersionId !== null && !(typeof expectedVersionId === "string" && UUID.test(expectedVersionId))) return null
  if ((expectedRevision === 0) !== (expectedVersionId === null)) return null
  if (idempotencyKey !== null && !(typeof idempotencyKey === "string" && UUID.test(idempotencyKey))) return null
  if ((idempotencyKey === null) !== (request === null)) return null
  if (request !== null && (typeof request !== "object" || Array.isArray(request))) return null
  return { savedAt, expiresAt, fields, binding: { expectedRevision: expectedRevision as number, expectedVersionId: expectedVersionId as string | null }, idempotencyKey: idempotencyKey as string | null, request: request as Record<string, unknown> | null }
}

/**
 * A workspace opened for this user, company and role (call before it renders). Removes every draft in the tab that
 * belongs to another user or company, has expired or can't be read; a member (or any role that can't save) removes them
 * all and stores none. Writes are allowed again for this user and company only.
 */
export function admitDrafts(storage: DraftStorage | null, active: { userId: string; companyId: string | null; role: string }, now = Date.now()): void {
  cancelPendingRemovals()
  const canStore = canStoreRole(active.role) && active.companyId !== null
  owner = active.companyId ? { userId: active.userId, companyId: active.companyId, canStore } : null
  if (!storage) return
  try {
    for (const key of allDraftKeys(storage)) {
      const parsed = parseKey(key)
      const keep = canStore && parsed !== null && parsed.userId === active.userId && parsed.companyId === active.companyId && decode(storage.getItem(key), now) !== null
      if (!keep) storage.removeItem(key)
    }
  } catch { /* storage refused: nothing can be offered either */ }
}

/**
 * WO-13 (WO-05b follow-up): the saved record IDs last listed for a user and company (from the Activity list's own answer),
 * so a "new record" draft that names one of them is refused on restore.
 */
const savedRecords = new Map<string, ReadonlySet<string>>()
export function noteSavedRecords(scope: { userId: string; companyId: string }, recordIds: Iterable<string>): void {
  savedRecords.set(`${scope.userId}:${scope.companyId}`, new Set([...recordIds].map(id => id.toLowerCase())))
}
/**
 * WO-13: a draft of the new-record form must not carry an existing record's ID or a saved version (only a hand-written or
 * corrupted draft does): restoring it would aim the new-record form at a record that exists.
 */
function newDraftAllowed(scope: DraftScope, found: StoredDraft<unknown>): boolean {
  if (scope.view !== "activity" || scope.item !== "new") return true
  if (found.binding.expectedRevision !== 0 || found.binding.expectedVersionId !== null) return false
  const request = found.request
  if (request && (request.expectedRevision !== 0 || request.expectedVersionId !== null)) return false
  const recordId = (found.fields as { recordId?: unknown }).recordId
  return !(typeof recordId === "string" && savedRecords.get(`${scope.userId}:${scope.companyId}`)?.has(recordId.toLowerCase()))
}

/** A deliberate sign-out (here or in another tab): every draft in this tab goes, and none is written until the next workspace opens. */
export function clearAllDrafts(storage: DraftStorage | null): void {
  owner = null
  savedRecords.clear()
  cancelPendingRemovals()
  if (!storage) return
  try { for (const key of allDraftKeys(storage)) storage.removeItem(key) } catch { /* nothing kept */ }
}

/** Whether this tab holds a draft of `userId` (for the "Your session ended" sentence). */
export function hasDraftsFor(storage: DraftStorage | null, userId: string, now = Date.now()): boolean {
  if (!storage) return false
  try { return allDraftKeys(storage).some(key => parseKey(key)?.userId === userId && decode(storage.getItem(key), now) !== null) } catch { return false }
}

export function writeDraft<F>(storage: DraftStorage | null, scope: DraftScope, value: { fields: F; binding: DraftBinding; idempotencyKey: string | null; request: Record<string, unknown> | null }, now = Date.now()): boolean {
  const key = draftKey(scope)
  if (!storage || !key || !owner?.canStore || owner.userId !== scope.userId || owner.companyId !== scope.companyId) return false
  const stored: StoredDraft<F> = { savedAt: now, expiresAt: now + DRAFT_TTL_MS, fields: value.fields, binding: value.binding, idempotencyKey: value.idempotencyKey && value.request ? value.idempotencyKey : null, request: value.idempotencyKey && value.request ? value.request : null }
  try {
    const text = JSON.stringify(stored)
    if (text.length > MAX_DRAFT_CHARS) { storage.removeItem(key); return false }
    cancelRemoval(key)
    storage.setItem(key, text)
    return true
  } catch { return false }
}

/**
 * Reads the draft for `scope`, if this tab may hold it and it is readable, unexpired and its fields pass `fields` (which
 * returns the checked fields or null). Anything else at that key is removed.
 */
export function readDraft<F>(storage: DraftStorage | null, scope: DraftScope, fields: (value: unknown) => F | null, now = Date.now()): StoredDraft<F> | null {
  const key = draftKey(scope)
  if (!storage || !key) return null
  try {
    const raw = storage.getItem(key)
    if (raw === null) return null
    const allowed = owner?.canStore && owner.userId === scope.userId && owner.companyId === scope.companyId
    const found = allowed ? decode(raw, now) : null
    const checked = found && newDraftAllowed(scope, found) ? fields(found.fields) : null
    if (!found || !checked) { storage.removeItem(key); return null }
    return { ...found, fields: checked }
  } catch { return null }
}

export function removeDraft(storage: DraftStorage | null, scope: DraftScope): void {
  const key = draftKey(scope)
  if (!key) return
  cancelRemoval(key)
  try { storage?.removeItem(key) } catch { /* nothing kept */ }
}

/**
 * The screen holding a draft's form is leaving while its workspace stays open (the person moved on, after the leave
 * guard). The draft is removed at the end of this task unless the same screen mounts again at once, as React's
 * StrictMode does in development.
 */
export function removeDraftSoon(storage: DraftStorage | null, scope: DraftScope): void {
  const key = draftKey(scope)
  if (!key || !storage) return
  cancelRemoval(key)
  removals.set(key, setTimeout(() => { removals.delete(key); try { storage.removeItem(key) } catch { /* nothing kept */ } }, 0))
}
export function keepDraft(scope: DraftScope): void { const key = draftKey(scope); if (key) cancelRemoval(key) }
function cancelRemoval(key: string) { const timer = removals.get(key); if (timer !== undefined) { clearTimeout(timer); removals.delete(key) } }
function cancelPendingRemovals() { for (const timer of removals.values()) clearTimeout(timer); removals.clear() }

/** Tells the other tabs of this browser that a deliberate sign-out happened here. */
export function announceDraftClear(): void {
  try {
    if (typeof BroadcastChannel === "undefined") return
    const channel = new BroadcastChannel(DRAFT_CHANNEL)
    channel.postMessage(DRAFT_CLEAR_MESSAGE)
    channel.close()
  } catch { /* the sign-out mark in localStorage still reaches the other tabs */ }
}

/** Calls `onClear` when another tab announces a deliberate sign-out. Returns the unsubscribe. */
export function listenForDraftClear(onClear: () => void): () => void {
  try {
    if (typeof BroadcastChannel === "undefined") return () => {}
    const channel = new BroadcastChannel(DRAFT_CHANNEL)
    channel.onmessage = event => { if (event.data === DRAFT_CLEAR_MESSAGE) onClear() }
    return () => channel.close()
  } catch { return () => {} }
}

/** The time a draft was kept, as the offer shows it (UTC, labelled, like the record history). */
export function draftTime(savedAt: number): string {
  const iso = new Date(savedAt).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

// --- The fields of each kind of draft, checked when read back (a draft is never trusted to have the right shape) ---

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === "string"
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString)

/** An Activity draft: the record's ID, the form's activity and the correction reason. */
export interface ActivityDraftFields<A = Record<string, unknown>> { recordId: string; activity: A; reason: string }
export function activityDraftFields<A>(kinds: ReadonlySet<string>) {
  return (value: unknown): ActivityDraftFields<A> | null => {
    if (!isObject(value) || !isString(value.recordId) || !UUID.test(value.recordId) || !isString(value.reason) || value.reason.length > 2_000) return null
    const activity = value.activity
    if (!isObject(activity) || !isString(activity.kind) || !kinds.has(activity.kind)) return null
    const { quantity, period, payload } = activity
    if (!isString(activity.locationId) || !isString(activity.setupVersionId) || !isString(activity.sourceId) || !isString(activity.reference) || !isString(activity.notes)) return null
    if (activity.state !== "active" && activity.state !== "withdrawn") return null
    if (activity.withdrawalReason !== null && activity.withdrawalReason !== undefined && !isString(activity.withdrawalReason)) return null
    if (!isStringArray(activity.evidenceIds) || !isObject(payload)) return null
    if (!isObject(quantity) || !isString(quantity.originalValue) || !isString(quantity.originalUnit)) return null
    if (!isObject(period) || !isString(period.start) || !isString(period.endExclusive)) return null
    return { recordId: value.recordId, activity: activity as A, reason: value.reason }
  }
}

/** A company setup draft: the setup, the correction reason and the section shown. */
export interface SetupDraftFields<S = Record<string, unknown>> { setup: S; reason: string; step: number }
export function setupDraftFields<S>(sections: number) {
  return (value: unknown): SetupDraftFields<S> | null => {
    if (!isObject(value) || !isString(value.reason) || value.reason.length > 2_000 || !Number.isInteger(value.step) || (value.step as number) < 0 || (value.step as number) >= sections) return null
    const setup = value.setup
    if (!isObject(setup) || !isObject(setup.company) || !isObject(setup.reportingPeriod) || !isObject(setup.boundary) || !isObject(setup.review) || !isString(setup.changeNotes)) return null
    if (![setup.entities, setup.relationships, setup.locations, setup.screening, setup.changes].every(list => Array.isArray(list) && list.every(isObject))) return null
    if (!isString(setup.company.legalName) || typeof setup.review.acknowledged !== "boolean") return null
    return { setup: setup as S, reason: value.reason, step: value.step as number }
  }
}

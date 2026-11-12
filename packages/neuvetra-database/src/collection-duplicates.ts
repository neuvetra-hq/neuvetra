/**
 * Possible duplicate records (BF-01, 12 November 2026; closes BL-01 and S12-02). Browser-safe and free of imports, so the
 * Scope 1 and 2 results, the Scope 3 results and (BF-01 part B) the Overview use exactly one rule.
 *
 * The same bill saved twice used to be counted twice with no warning. Detection runs on the server, before any engine:
 * the engines cannot tell (their inputs carry no source ID, so two meters with identical bills legitimately give
 * identical result hashes).
 *
 * The rule, among records whose current state is `active`:
 * - Scope 1 and 2 kinds: same kind, same normalised source ID and overlapping periods. The location is ignored, as the
 *   entry form ignores it.
 * - Scope 3 saved records: same kind, same category, same normalised source ID, overlapping periods and the same
 *   normalised quantity (value and unit). The quantity condition is deliberate: Scope 3 source IDs are free text, and
 *   users reuse them for different trips. Imported spend lines (`purchase_spend` with an `importId`) keep the 0030
 *   fingerprint rule and are not checked here; derived lines are not records and are never checked.
 * - Normalised source ID: trimmed, NFC, lower-cased (en-US), internal whitespace collapsed. A blank source ID matches
 *   nothing.
 * - Periods are half-open: [start, endExclusive). Consecutive bills (Jan 1–Feb 1 and Feb 1–Mar 1) do not overlap.
 * - Records joined by overlap form one group (transitively). The keeper is the record whose first version was saved
 *   earliest (ties: the smaller record ID); every other record in the group is a possible duplicate of the keeper.
 * - A record whose payload has `duplicateConfirmedDistinct === true` is never flagged and takes no part in a group.
 *   For Scope 1 and 2 that key exists only once BF-09 (schema 31) lands.
 *
 * Whether a possible duplicate is held out of the totals or counted with a warning is one constant,
 * `COLLECTION_DUPLICATE_POLICY`. The board has not ruled yet; the default is "hold" (the CEO's recommendation).
 */

/** The board's choice. "hold": a possible duplicate is not calculated until it is resolved. "count_and_warn": it is counted, and Results says so. */
export type CollectionDuplicatePolicy = 'hold' | 'count_and_warn'
/** BF-01: change this one line when the board rules. */
export const COLLECTION_DUPLICATE_POLICY: CollectionDuplicatePolicy = 'hold'

/** The hold reason of a possible duplicate (hold mode). */
export const POSSIBLE_DUPLICATE_REASON = 'possible_duplicate_record' as const
/** The reason code a counted possible duplicate carries in the Scope 3 CSV and on screen (count mode). */
export const POSSIBLE_DUPLICATE_COUNTED_REASON = 'possible_duplicate_counted' as const
/** Plan note prefixes: `possible_duplicate_of:<keeper record ID>` on a duplicate, `has_possible_duplicates:<n>` on its keeper. */
export const POSSIBLE_DUPLICATE_OF_NOTE = 'possible_duplicate_of:' as const
export const HAS_POSSIBLE_DUPLICATES_NOTE = 'has_possible_duplicates:' as const

/** The parts of a saved record the rule reads (a `CollectionActivityRecord` fits). */
export interface DuplicateCheckRecord {
  id: string
  kind: string
  currentVersion: {
    createdAt?: string
    activity: {
      state: string
      sourceId: string
      period: { start: string; endExclusive: string }
      quantity: { originalValue: string; originalUnit: string; normalizedValue: string | null; normalizedUnit: string | null }
      payload: unknown
    }
  }
  history?: ReadonlyArray<{ createdAt?: string }>
}

/** The Scope 1 and 2 kinds; every other saved kind is a Scope 3 kind. */
const SCOPE12_KINDS: ReadonlySet<string> = new Set(['natural_gas', 'vehicle', 'distillate_no2', 'fugitive', 'electricity'])

/** Trim, NFC, lower case (en-US), internal whitespace collapsed. */
export function normalizedSourceId(sourceId: string): string {
  return sourceId.normalize('NFC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ')
}
/** Half-open periods overlap when each starts before the other ends. */
export function periodsOverlap(a: { start: string; endExclusive: string }, b: { start: string; endExclusive: string }): boolean {
  return a.start < b.endExclusive && b.start < a.endExclusive
}
/** A plain decimal without insignificant zeros ("100.0" → "100", "0.50" → "0.5"); anything else is compared as trimmed text. */
function canonicalDecimal(value: string): string {
  const text = value.trim()
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(text)
  if (!match) return text
  const whole = match[2]!.replace(/^0+(?=\d)/, ''), fraction = (match[3] ?? '').replace(/0+$/, '')
  return `${match[1] && (whole !== '0' || fraction) ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const payloadOf = (record: DuplicateCheckRecord) => isObject(record.currentVersion.activity.payload) ? record.currentVersion.activity.payload : {}
const firstSavedAt = (record: DuplicateCheckRecord) => record.history?.[0]?.createdAt ?? record.currentVersion.createdAt ?? ''

/** The key two records must share to be compared at all, or null when the record is not checked. */
function groupKey(record: DuplicateCheckRecord): string | null {
  const activity = record.currentVersion.activity
  if (activity.state !== 'active') return null
  const payload = payloadOf(record)
  if (payload.duplicateConfirmedDistinct === true) return null
  const source = normalizedSourceId(activity.sourceId)
  if (!source) return null
  if (SCOPE12_KINDS.has(record.kind)) return JSON.stringify([record.kind, source])
  // Imported spend lines keep the 0030 fingerprint rule (possible_duplicate_spend_line).
  if (record.kind === 'purchase_spend' && typeof payload.importId === 'string') return null
  const quantity = activity.quantity
  const value = canonicalDecimal(quantity.normalizedValue ?? quantity.originalValue), unit = (quantity.normalizedUnit ?? quantity.originalUnit).trim()
  // Kinds without a payload category have one fixed category, so the kind alone separates them.
  const category = typeof payload.category === 'number' ? payload.category : null
  return JSON.stringify([record.kind, category, source, value, unit])
}

/**
 * Each possible duplicate's record ID → the record ID of the keeper it repeats. Records that are not duplicates (keepers
 * included) are not in the map.
 */
export function possibleDuplicateRecords(records: readonly DuplicateCheckRecord[]): Map<string, string> {
  const buckets = new Map<string, DuplicateCheckRecord[]>()
  for (const record of records) {
    const key = groupKey(record)
    if (key === null) continue
    const bucket = buckets.get(key)
    if (bucket) bucket.push(record); else buckets.set(key, [record])
  }
  const out = new Map<string, string>()
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue
    // Overlap joins records transitively: sorted by start, a record joins the current group when it starts before the
    // latest end so far (half-open periods), which is exactly the transitive closure of pairwise overlap.
    const sorted = [...bucket].sort((a, b) => a.currentVersion.activity.period.start.localeCompare(b.currentVersion.activity.period.start))
    const groups: DuplicateCheckRecord[][] = []
    let end = ''
    for (const record of sorted) {
      const period = record.currentVersion.activity.period
      if (groups.length && period.start < end) { groups[groups.length - 1]!.push(record); if (period.endExclusive > end) end = period.endExclusive }
      else { groups.push([record]); end = period.endExclusive }
    }
    for (const group of groups) {
      if (group.length < 2) continue
      const keeper = [...group].sort((a, b) => firstSavedAt(a).localeCompare(firstSavedAt(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]!
      for (const record of group) if (record.id !== keeper.id) out.set(record.id, keeper.id)
    }
  }
  return out
}

/** How many possible duplicates each keeper has (keeper record ID → count). */
export function possibleDuplicateCounts(duplicates: ReadonlyMap<string, string>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const keeper of duplicates.values()) counts.set(keeper, (counts.get(keeper) ?? 0) + 1)
  return counts
}

/** The keeper record ID a plan's notes name, or null when the line is not a possible duplicate. */
export function possibleDuplicateOf(notes: readonly string[]): string | null {
  const note = notes.find(item => item.startsWith(POSSIBLE_DUPLICATE_OF_NOTE))
  return note ? note.slice(POSSIBLE_DUPLICATE_OF_NOTE.length) : null
}
/** True for a possible duplicate that was counted (count mode): it carries the note but not the hold reason. */
export function possibleDuplicateCounted(plan: { reasons: readonly string[]; notes: readonly string[] }): boolean {
  return possibleDuplicateOf(plan.notes) !== null && !plan.reasons.includes(POSSIBLE_DUPLICATE_REASON)
}

/**
 * Applies the policy to one plan. `duplicateOf` is the keeper's record ID (null when the record is not a duplicate),
 * `duplicates` the number of possible duplicates when the record is a keeper. The caller applies it only after its
 * withdrawn, excluded and outside-period checks, which keep their precedence. Hold: the plan becomes an input-needed
 * hold with the reason and the note, and is never sent to an engine. Count: the plan is unchanged apart from the note.
 * A plan with nothing to add is returned as it is (the same object), so responses without duplicates do not change.
 */
export function applyDuplicatePolicy<P extends { action: 'calculate' | 'hold'; status: string | null; reasons: string[]; notes: string[]; call: unknown }>(
  plan: P, duplicateOf: string | null, duplicates: number, policy: CollectionDuplicatePolicy,
): P {
  if (duplicateOf !== null) {
    const notes = [...plan.notes, `${POSSIBLE_DUPLICATE_OF_NOTE}${duplicateOf}`]
    if (policy === 'count_and_warn') return { ...plan, notes }
    return { ...plan, action: 'hold', status: 'input_needed', reasons: [...plan.reasons, POSSIBLE_DUPLICATE_REASON], notes, call: null }
  }
  if (duplicates > 0) return { ...plan, notes: [...plan.notes, `${HAS_POSSIBLE_DUPLICATES_NOTE}${duplicates}`] }
  return plan
}

/** The response warning in count mode (`counted`: records counted while they may repeat another record). */
export function possibleDuplicatesCountedWarning(counted: number): string {
  return counted === 1
    ? '1 record may repeat another record and is counted in these totals. Check the record marked as a possible duplicate.'
    : `${counted} records may repeat other records and are counted in these totals. Check the records marked as possible duplicates.`
}

/**
 * Possible duplicate records (BF-01, 12 November 2026; closes BL-01 and S12-02). Browser-safe and free of imports, so the
 * Scope 1 and 2 results, the Scope 3 results and (BF-01 part B) the Overview use exactly one rule.
 *
 * The same record saved twice used to be counted twice with no warning. Detection runs on the server, before any engine:
 * the engines cannot tell (their inputs carry no source ID, so two meters with identical bills legitimately give
 * identical result hashes).
 *
 * The rule, among records whose current state is `active`:
 * - Scope 1 and 2 kinds: same kind, same location, same normalised source ID and overlapping periods.
 * - Scope 3 saved records: same kind, same category, same location, same normalised source ID, overlapping periods and
 *   the same normalised quantity (value and unit). The quantity condition is deliberate: Scope 3 source IDs are free
 *   text, and users reuse them for different trips. Imported spend lines (`purchase_spend` with an `importId`) keep the
 *   0030 fingerprint rule and are not checked here; derived lines are not records and are never checked.
 * - Normalised source ID: trimmed, NFC, lower-cased (en-US), internal whitespace collapsed. A blank source ID matches
 *   nothing.
 * - Periods are half-open: [start, endExclusive). Consecutive bills (Jan 1–Feb 1 and Feb 1–Mar 1) do not overlap. An
 *   overlap of exactly one day that is the last day of one record and the first day of the other (a shared meter-read
 *   day: the form asks for the inclusive last day shown on the source) does not count either (BF-01, QA finding B1).
 * - Not transitive (QA finding B1): a record is a possible duplicate only of records it actually overlaps. Each record
 *   is compared with the records saved before it (first version's `createdAt`; ties: the smaller record ID) and names
 *   the earliest-saved one it overlaps. The record saved first is never the duplicate of a later one.
 * - A record whose payload has `duplicateConfirmedDistinct === true` is never flagged and takes no part in a pair.
 *   For Scope 1 and 2 that key exists only once BF-09 (schema 31) lands.
 *
 * Whether a possible duplicate is held out of the totals or counted with a warning is one constant,
 * `COLLECTION_DUPLICATE_POLICY`. CEO ruling (12 November 2026, after QA of PR #48): "count_and_warn". An overstatement
 * disclosed everywhere is the conservative error; an understatement that looks like a clean total is not. "hold" stays
 * available and tested; returning to it is a later order (BF-01d).
 */

/** The policy. "hold": a possible duplicate is not calculated until it is resolved. "count_and_warn": it is counted, and every output says so. */
export type CollectionDuplicatePolicy = 'hold' | 'count_and_warn'
/** BF-01: the CEO's ruling of 12 November 2026. Returning to "hold" waits for BF-01d (see the module comment). */
export const COLLECTION_DUPLICATE_POLICY: CollectionDuplicatePolicy = 'count_and_warn'

/** The hold reason of a possible duplicate (hold mode). */
export const POSSIBLE_DUPLICATE_REASON = 'possible_duplicate_record' as const
/** The reason code a counted possible duplicate carries in the Scope 3 CSV and on screen (count mode). */
export const POSSIBLE_DUPLICATE_COUNTED_REASON = 'possible_duplicate_counted' as const
/**
 * Plan note prefixes: `possible_duplicate_of:<record ID>` on a duplicate (the earlier-saved record it overlaps),
 * `has_possible_duplicates:<n>` on a record that later records may repeat.
 */
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
      locationId: string
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
/** Days since 1970-01-01 of an ISO date (YYYY-MM-DD), or NaN. */
const dayNumber = (date: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000 : Number.NaN }
/**
 * Whether two periods overlap enough to be possible duplicates: they overlap (half-open), and the overlap is not just one
 * shared meter-read day, the last day of one record and the first day of the other. Two records of one day each on the
 * same day, or a one-day record inside a longer one, still overlap.
 */
export function periodsOverlapAsDuplicates(a: { start: string; endExclusive: string }, b: { start: string; endExclusive: string }): boolean {
  if (!periodsOverlap(a, b)) return false
  const start = a.start > b.start ? a.start : b.start, end = a.endExclusive < b.endExclusive ? a.endExclusive : b.endExclusive
  if (dayNumber(end) - dayNumber(start) !== 1) return true
  const sharedReadDay = (first: typeof a, second: typeof a) => first.start < start && first.endExclusive === end && second.start === start && second.endExclusive > end
  return !(sharedReadDay(a, b) || sharedReadDay(b, a))
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
  // QA finding B2: two sites may each have a meter called "Main meter"; the location is part of the key.
  const location = activity.locationId ?? ''
  if (SCOPE12_KINDS.has(record.kind)) return JSON.stringify([record.kind, location, source])
  // Imported spend lines keep the 0030 fingerprint rule (possible_duplicate_spend_line).
  if (record.kind === 'purchase_spend' && typeof payload.importId === 'string') return null
  const quantity = activity.quantity
  const value = canonicalDecimal(quantity.normalizedValue ?? quantity.originalValue), unit = (quantity.normalizedUnit ?? quantity.originalUnit).trim()
  // Kinds without a payload category have one fixed category, so the kind alone separates them.
  const category = typeof payload.category === 'number' ? payload.category : null
  return JSON.stringify([record.kind, category, location, source, value, unit])
}

/**
 * Each possible duplicate's record ID → the record ID of the earliest-saved record it actually overlaps (among the
 * records saved before it). Records that repeat nothing (the first saved of a pair included) are not in the map. Not
 * transitive: three monthly bills A, B, C where only A–B and B–C overlap give B → A and C → B, never C → A.
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
    // In save order (first version's time; ties: the smaller ID); each record is compared with those saved before it.
    const sorted = [...bucket].sort((a, b) => firstSavedAt(a).localeCompare(firstSavedAt(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (let i = 1; i < sorted.length; i++) {
      const period = sorted[i]!.currentVersion.activity.period
      for (let j = 0; j < i; j++) if (periodsOverlapAsDuplicates(sorted[j]!.currentVersion.activity.period, period)) { out.set(sorted[i]!.id, sorted[j]!.id); break }
    }
  }
  return out
}

/** How many later records name each record as the one they may repeat (record ID → count). */
export function possibleDuplicateCounts(duplicates: ReadonlyMap<string, string>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const keeper of duplicates.values()) counts.set(keeper, (counts.get(keeper) ?? 0) + 1)
  return counts
}

/** The record ID a plan's notes name as the one it may repeat, or null when the line is not a possible duplicate. */
export function possibleDuplicateOf(notes: readonly string[]): string | null {
  const note = notes.find(item => item.startsWith(POSSIBLE_DUPLICATE_OF_NOTE))
  return note ? note.slice(POSSIBLE_DUPLICATE_OF_NOTE.length) : null
}
/**
 * BF-01 (QA: name the record that actually overlaps, identifiably): "Possible duplicate of M-1 at Office, Jan 1 – Jan 31,
 * 2025 (record <id>)." The caller passes the named record's period already in words; null when it isn't listed.
 */
export function possibleDuplicateOfText(recordId: string, other: { sourceId: string; locationName: string | null; period: string } | null): string {
  return other ? `Possible duplicate of ${other.sourceId} at ${other.locationName ?? 'an unknown site'}, ${other.period} (record ${recordId}).` : `Possible duplicate of record ${recordId}.`
}
/** True for a possible duplicate that was counted (count mode): it carries the note but not the hold reason. */
export function possibleDuplicateCounted(plan: { reasons: readonly string[]; notes: readonly string[] }): boolean {
  return possibleDuplicateOf(plan.notes) !== null && !plan.reasons.includes(POSSIBLE_DUPLICATE_REASON)
}

/**
 * Applies the policy to one plan. `duplicateOf` is the record ID of the earlier record it overlaps (null when the record is
 * not a possible duplicate), `duplicates` the number of later records that name this one. The caller applies it only after its
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

/**
 * The response warning in count mode (`counted`: records counted while they may repeat another record). Record-neutral
 * (bills, trips, waste lines), and it says plainly that both records are in the totals and what to do.
 */
export function possibleDuplicatesCountedWarning(counted: number): string {
  return counted === 1
    ? 'These totals include 1 possible duplicate: a record that matches another active record for overlapping dates. Both records are counted. If they are the same record, withdraw or correct one of them; if they are different records, no action is needed.'
    : `These totals include ${counted} possible duplicates: records that match another active record for overlapping dates. Both records of each pair are counted. Where two are the same record, withdraw or correct one of them; where they are different records, no action is needed.`
}

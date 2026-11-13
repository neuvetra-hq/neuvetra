/**
 * BF-01c: the possible-duplicate state of one saved record, for the record view. The same rule and records as both results
 * routes (`possibleDuplicateRecords` over the company's saved records) and the Overview's "To confirm" group, so the record
 * view, the Overview and Results agree on which records may repeat which. B1 (QA of PR #63): whether a record is counted is
 * the caller's (`counted`), decided from the same plan the readiness panel shows (withdrawn, excluded, superseded, held or
 * outside the period: not counted), and a pair is shown, and called counted, only when both of its records are counted.
 * Nothing here changes what is counted. BF-01e: the pairs come from the shared rule (`possibleDuplicatePairs`), as the routes
 * and the Overview take them; a record that isn't counted but matches a counted one gets the caution instead.
 */
import { possibleDuplicateOfText, possibleDuplicatePairs, wouldRepeatCountedText } from "../../../../packages/neuvetra-database/src/collection-duplicates"
import type { CollectionActivityRecord, CollectionContext } from "./collection-api"
import { kindLabel, periodLabel } from "./plain-language"

export interface RecordDuplicateLink { id: string; name: string; text: string }
export interface RecordDuplicateState {
  /** The earlier record this one may repeat, with possibleDuplicateOfText's sentence; null when it repeats none. */
  of: RecordDuplicateLink | null
  /** The later records that may repeat this one (each with its own sentence naming it). */
  repeatedBy: RecordDuplicateLink[]
  /** BF-01e: on a record that isn't counted, the counted record completing it would repeat (the caution's sentence); else null. */
  caution: RecordDuplicateLink | null
}

/** The record's possible-duplicate state, or null when it has none (the usual case: no notice is shown). */
export function recordDuplicateState(records: readonly CollectionActivityRecord[], recordId: string, context: CollectionContext | null, counted: (recordId: string) => boolean, completable: (recordId: string) => boolean = () => true): RecordDuplicateState | null {
  const self = records.find(record => record.id === recordId)
  if (!self || self.currentVersion.activity.state !== "active") return null
  const pairs = possibleDuplicatePairs(records, counted, completable)
  const duplicates = pairs.counted
  const link = (id: string, sentenceFor: string): RecordDuplicateLink => {
    const other = records.find(record => record.id === id)
    const activity = other?.currentVersion.activity
    const subject = records.find(record => record.id === sentenceFor)?.currentVersion.activity
    return {
      id, name: other && activity ? `${kindLabel(other.kind)} · ${activity.sourceId}` : `record ${id}`,
      text: possibleDuplicateOfText(sentenceFor, subject ? { sourceId: subject.sourceId, locationName: context?.locations.find(location => location.id === subject.locationId)?.name ?? null, period: periodLabel(subject.period.start, subject.period.endExclusive) } : null),
    }
  }
  const facts = (id: string) => { const activity = records.find(record => record.id === id)?.currentVersion.activity; return activity ? { sourceId: activity.sourceId, locationName: context?.locations.find(location => location.id === activity.locationId)?.name ?? null, period: periodLabel(activity.period.start, activity.period.endExclusive) } : null }
  if (!counted(recordId)) {
    const cautionId = pairs.cautions.get(recordId)
    return cautionId === undefined ? null : { of: null, repeatedBy: [], caution: { ...link(cautionId, cautionId), text: wouldRepeatCountedText(cautionId, facts(cautionId)) } }
  }
  const earlier = duplicates.get(recordId)
  const of = earlier !== undefined ? link(earlier, earlier) : null
  // A later record names this one; its sentence says which record it may repeat (this one), so it is described by its own facts.
  const repeatedBy = [...duplicates.entries()].filter(([, named]) => named === recordId)
    .map(([later]) => { const item = link(later, later); return { ...item, text: `${item.name}${laterFacts(records, later, context)}.` } })
  return of || repeatedBy.length ? { of, repeatedBy, caution: null } : null
}
function laterFacts(records: readonly CollectionActivityRecord[], id: string, context: CollectionContext | null): string {
  const activity = records.find(record => record.id === id)?.currentVersion.activity
  if (!activity) return ""
  return ` at ${context?.locations.find(location => location.id === activity.locationId)?.name ?? "an unknown site"}, ${periodLabel(activity.period.start, activity.period.endExclusive)} (record ${id})`
}

/**
 * BF-01c: the saved records the form's draft would match by the same rule, before it is saved (the form's alert). The draft
 * stands in for the record it corrects (keeping that record's first save time), or is the newest record when it is new; the
 * records named are those it would repeat and those that would repeat it.
 */
export function draftDuplicateMatches(records: readonly CollectionActivityRecord[], draft: CollectionActivityRecord["currentVersion"]["activity"], recordId: string, counted: (recordId: string) => boolean = () => true): CollectionActivityRecord[] {
  const saved = records.find(record => record.id === recordId)
  const standIn = { id: recordId, kind: draft.kind, currentVersion: { createdAt: saved?.currentVersion.createdAt ?? "9999-12-31T23:59:59.999Z", activity: draft }, history: saved?.history ?? [] }
  // BF-01e: the shared rule, the draft taken as counted once saved complete (the caller keeps a draft placed outside every
  // total out), against the saved records that are counted.
  const duplicates = possibleDuplicatePairs([...records.filter(record => record.id !== recordId), standIn], id => id === recordId || counted(id)).counted
  const ids = new Set([...(duplicates.has(recordId) ? [duplicates.get(recordId)!] : []), ...[...duplicates.entries()].filter(([, named]) => named === recordId).map(([later]) => later)])
  return records.filter(record => ids.has(record.id))
}

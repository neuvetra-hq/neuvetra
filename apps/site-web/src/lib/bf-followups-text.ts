/**
 * BF-03b, BF-02b and BF-01c (QA follow-ups of PRs #41, #45 and #48): the new user-facing words, in one place so the PR can
 * list them and the tests can pin them.
 */

/** BF-03b (d): a save refused at the Scope 1 and 2 record cap links to the list where records are withdrawn. */
export const RECORD_LIMIT_LINK_TEXT = {
  /** The link after the refusal, to the saved activities list (the record view's "All activity", or the list on this page). */
  link: "Open the saved activities list to withdraw records",
} as const

/** BF-02b (a): the record that replaces a spend line, named where the line is shown. */
export const REPLACING_RECORD_TEXT = {
  /** A held line (its replacing record isn't counted): the record to finish, by name. */
  held: (name: string) => `Waiting for ${name}, the record that replaces this spend line: it isn’t counted right now, so this line is held.`,
  /** The calculation details' term for a held line's replacing record. */
  heldTerm: "Replacing record (not counted right now)",
  /** The record's words when it isn't listed in these results. */
  unlisted: (recordId: string) => `record ${recordId}`,
  /** The to-do's title for the lines that wait for one replacing record. */
  todoTitle: (count: number, name: string) => `${count} spend line${count === 1 ? "" : "s"} wait${count === 1 ? "s" : ""} for ${name}`,
  /** The to-do's action: open the replacing record (the record the reason text says to finish). */
  todoAction: (name: string) => `Open ${name}`,
} as const

/** BF-02b (b): the spend import's replaced-lines step, which can't know whether the replacing record calculates in full. */
export const SPEND_REPLACED_STEP_TEXT = {
  /** The record form's hint under "Spend lines this record replaces" (retires "…, marked as replaced."). */
  formHint: "The replaced lines stay listed in Results: marked as replaced while this record is counted, or held as needing input while it isn’t.",
  intro: "These spend lines aren’t counted while the record beside them is calculated in full and counted instead. If that record isn’t counted (it needs input or review), Results holds its lines as needing input. Check that its figure covers the same purchases.",
} as const

/** BF-01c: the record view's possible-duplicate state (Overview "To confirm" group; Results wording). */
export const RECORD_DUPLICATE_TEXT = {
  heading: "To confirm: possible duplicate (both are counted)",
  /** BF-01e: on a record that isn't counted but matches one that is (completing it would count the activity twice). */
  cautionHeading: "Possible duplicate of a counted record",
  /** On the record that repeats an earlier one; `of` is possibleDuplicateOfText's sentence. */
  isDuplicate: (of: string) => `${of} Both records are counted in the totals.`,
  /** On the earlier record that later records may repeat. */
  repeatedBy: (count: number) => count === 1 ? "Another active record may repeat this one; both records are counted in the totals:" : `${count} other active records may repeat this one; all are counted in the totals:`,
  /** What to do, for someone who can change records. */
  manage: "If they are the same record, withdraw or correct one of them; if they are different records, no action is needed.",
  /** What to do, for a view-only member. */
  view: "If they are the same record, an owner or admin can withdraw one of them; if they are different records, no action is needed.",
  open: (name: string) => `Open ${name}`,
  /** The form's alert while the draft matches saved records by the same rule (before it is saved). Retires "Probable duplicate". */
  formHeading: "Possible duplicate",
  formText: (names: readonly string[]) => `This record matches ${names.length === 1 ? "an active record" : `${names.length} active records`} (${names.join("; ")}) for overlapping dates: same activity type, site and source ID (for Scope 3, also the same category and quantity). If it is the same record, don’t save it twice; if it is a different one, save it: both are counted, and Results marks them to confirm.`,
} as const

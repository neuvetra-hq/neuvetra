// WO-12 (members read-only) and its follow-ups: the field labels ruling (CEO, 12 Nov 2026) and the BF-08 web follow-ups.
// The words of the read-only views, the three field labels and the save outcomes after a definite refusal.

/** The three field labels: exactly one on every field of the Activity record form and the Scope 3 record forms. */
export type FieldNeed = "required" | "results" | "optional"
export const FIELD_NEED_TEXT: Readonly<Record<FieldNeed, string>> = {
  /** The record cannot be saved without it. */
  required: "Required",
  /** The record can be saved; it shows as needing input (and isn't counted) until this is filled. */
  results: "Needed for results",
  optional: "Optional",
}

/**
 * The hint under "If the company has no operational control over this asset, why?" (an operating lease in category 8). It
 * replaces COPY_TEXT_R2E.leaseNoControlHint here (O-4: overridden locally), which called the field "Required" although the
 * record saves without it and is held until it is given ("Needed for results").
 */
export const LEASE_NO_CONTROL_HINT_WO12 = "Needed for an operating lease under operational control (Scope 3 Standard Table A.1); until it is given, the record is held."

/**
 * WO-12 QA round 1: what a label depends on, shown after it (inside the <label>, so it is read with the field's name).
 */
export const FIELD_NEED_NOTES = {
  /** Vehicle miles and fuel economy are alternatives; with neither, CH4 and N2O can't be calculated. */
  vehicleEither: "(one of: miles driven, or fuel economy)",
  /** Company setup couldn't be read, so the site's country isn't known here. */
  hotelCountryUnknown: "(not needed when company setup puts this site in the U.S.)",
  /** The saved records couldn't be compared, so an overlap isn't known here. */
  commutingOverlapUnknown: "(only when distance-based commuting records cover the same period)",
  /** Company setup couldn't be read, so its consolidation approach isn't known here. */
  leaseApproachUnknown: "(only under operational control in company setup)",
  /** Company setup hasn't chosen a consolidation approach yet. */
  leaseApproachNotChosen: "(needed if company setup chooses operational control)",
} as const

/** A view-only member's Scope 3 assessment (company setup and the Results to-do): text, never disabled controls. */
export const SCREENING_READ_ONLY_TEXT = {
  viewOnly: "View only: an owner or admin of your company can change it.",
  notStated: "Not stated",
  none: "None",
  unavailableFile: "A file that isn’t available",
  /** The Results to-do's assessment button for a member (it opens the saved assessment as text). */
  viewAssessment: "View the assessment",
  /** Results' "Screen in company setup" and "Change the screening" for a member: the same navigation, read-only there. */
  viewSetup: "View company setup",
  /** Results' "Map N spend lines" and "Open the spend import" for a member: the same navigation, read-only there. */
  viewSpendImport: "View the spend import",
} as const

/** A view-only member's spend import: the lists and queues, without the upload, mapping or withdrawal controls. */
export const SPEND_IMPORT_READ_ONLY_TEXT = {
  upload: "View only: an owner or admin of your company imports spend files and maps or withdraws their lines.",
  /** Lines held for their currency, listed for a member (the rate form is an owner's or admin's). */
  currencies: "Only US dollars are calculated. These lines are held until an owner or admin converts them:",
} as const

/** A view-only member's Activity screen: the list and each record, with no new-record form. */
export const ACTIVITY_READ_ONLY_TEXT = {
  gridLossLinked: "Grid-loss source linked",
} as const

/**
 * BF-08 web follow-ups: the save outcomes the server's new codes make definite. A refusal (422) or a permission answer
 * (403) is final, so no retry of the same request is offered; a record ID another company holds (409
 * record_id_unavailable) is replaced with a new one and the save is sent again, once.
 */
export const SAVE_OUTCOME_TEXT_WO12 = {
  /**
   * After a 422 (a new request on the next save). The server's words lead when they already say what to do ("Choose…",
   * "…, then save again."), so there is one instruction; a capacity limit can't be fixed by editing; any other refusal
   * names nothing specific, so the person is told to check the form's answers.
   */
  refused: (server: string, code: string | null = null) => /^(Choose|Enter|Select|Remove|Withdraw)\b|save again\.?$/.test(server.trim()) ? `Nothing was saved. ${server}`
    : code === "history_limit" ? `${server} Nothing was saved.`
    : `${server} Nothing was saved. Check the answers on this form, then save again.`,
  /** After a 403: this person can view the company but not change it. */
  readOnly: (server: string) => `${server} Nothing was saved.`,
  /** The record or upload ID was taken by another company and the one automatic retry with a new ID failed too. */
  idUnavailableTwice: "Nothing was saved: the record’s ID couldn’t be used, and a second try with a new ID didn’t succeed either. Save again.",
  /** Company setup: which kind of ID repeats (duplicate_setup_id). */
  duplicateSetupId: {
    entities: "Two legal entities in this setup have the same ID. Remove the repeated entity, then save again.",
    relationships: "Two ownership relationships in this setup have the same ID. Remove the repeated relationship, then save again.",
    locations: "Two locations in this setup have the same ID. Remove the repeated location, then save again.",
    screening: "Two Scope 3 screening rows in this setup have the same ID. Remove the repeated row, then save again.",
    screening_category: "A category is screened twice in this setup (the same scope and category). Keep one answer for each, then save again.",
    changes: "Two recorded changes in this setup have the same ID. Remove the repeated change, then save again.",
    unknown: "Two items in this setup have the same ID. Remove the repeated item, then save again.",
  },
} as const

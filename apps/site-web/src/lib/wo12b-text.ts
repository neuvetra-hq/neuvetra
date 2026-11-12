// WO-12b (CEO ruling after QA round 3 of PR #57): the words of the record-hold notice and of the Scope 3 assessment form's
// field labels. A record hold is one answer that keeps the record from being counted whatever else is filled in.

/** The notice at the top of the record form while one answer holds the record. */
export const RECORD_HOLD_TEXT = {
  title: "This record won’t be counted as entered",
  /** Which answer holds it. */
  cause: (question: string, answer: string) => `Your answer to “${question}” (${answer}) holds this record, whatever else is filled in.`,
  /** What the labels mean while the answer stands. */
  labels: "Until that answer changes, the other result fields below are marked Optional: filling them in won’t make this record count. Once it changes, each field’s label applies as shown.",
  save: "You can still save the record as it is.",
  goTo: (question: string) => `Go to “${question}”`,
  /** Read after the label of the answer that holds the record (inside its <label>). */
  fieldNote: "(this answer holds the record: see the notice at the top of the form)",
} as const

/**
 * What to do instead, where the server's own hold text doesn't say it. The four Scope 3 holds of the ruling (category 8
 * finance lease, category 13 operating lease under financial control or equity share, category 9 spend paid by the
 * company, category 3 spend) are explained by the server's text alone.
 */
export const RECORD_HOLD_INSTEAD_TEXT = {
  location: "Choose an included site if the activity belongs to one, or change the site’s inclusion in company setup.",
  outsideBoundary: "Nothing else is needed for it. If the equipment is inside the boundary, change this answer.",
  simplifiedMethod: "The simplified method in this beta can’t calculate it, so it stays held for review whatever else is entered here. Change the answer only if it is wrong.",
} as const

/** Answers as the notice quotes them. */
export const RECORD_HOLD_ANSWER_TEXT = {
  yes: "Yes",
  no: "No",
  category: (category: number) => `category ${category}`,
  lease: (lease: string, category: number) => `${lease}, category ${category}`,
  leaseUnder: (lease: string, category: number, approach: string) => `${lease}, category ${category}, under ${approach} in company setup`,
  site: (name: string, entity: boolean) => `${name || "Unnamed location"}, ${entity ? "whose entity is excluded" : "excluded"} in company setup`,
} as const

/**
 * The Scope 3 assessment form (company setup step 06 and Results): what a label depends on. No assessment answer holds a
 * result (the assessment's disclosures never block a save or a result), so an answer the save doesn't need is Optional;
 * where leaving it blank adds a disclosure to the results, the label says so.
 */
export const ASSESSMENT_NEED_NOTES = {
  disclosed: "(left blank, it is disclosed with the results)",
  disclosedUnlessSetup: "(left blank, it is disclosed with the results unless company setup describes the activities)",
} as const

/** Company setup for a member (view only): every answer as text. */
export const SETUP_READ_ONLY_TEXT = {
  notAnswered: "Not answered",
  yes: "Yes",
  no: "No",
  /** The review step's confirmation, a checkbox for an owner or admin. */
  acknowledgement: "I have listed known entities, locations and source types, and left uncertain facts visible for review.",
} as const

// WO-12b (CEO ruling after QA round 3 of PR #57): the words of the record-hold notice and of the Scope 3 assessment form's
// field labels. A record hold is one answer that keeps the record from being counted whatever else is filled in.

/** The notice at the top of the record form while one answer holds the record. */
export const RECORD_HOLD_TEXT = {
  title: "This record won’t be counted as entered",
  /** Which answer holds it. */
  cause: (question: string, answer: string) => `Your answer to “${question}” (${answer}) holds this record, whatever else is filled in.`,
  /** What the labels mean while the answer stands. */
  labels: "Until that answer changes, the other result fields below are marked Optional: filling them in won’t make this record count. Once it changes, each field’s label applies as shown.",
  /** The same, where company setup or another record holds it (there is no answer on this form to change). */
  labelsElsewhere: "Until that changes, the other result fields below are marked Optional: filling them in won’t make this record count. Once it changes, each field’s label applies as shown.",
  save: "You can still save the record as it is.",
  goTo: (question: string) => `Go to “${question}”`,
  /** Read after the label of the answer that holds the record (inside its <label>). */
  fieldNote: "(this answer holds the record: see the notice at the top of the form)",
  /** WO-12b QA rounds 2 and 3: read after the label of a field whose correction alone stops a replacing record replacing this line. */
  matchNote: "(correcting this stops the replacement if the line isn’t that record’s: see the notice at the top of the form)",
} as const

/**
 * What to do instead, where the server's own hold text doesn't say it. Company setup's steps are named as its section
 * buttons read ("03 Entities & boundary").
 */
export const RECORD_HOLD_INSTEAD_TEXT = {
  outsideBoundary: "Nothing else is needed for it. If the equipment is inside the boundary, change this answer.",
  simplifiedMethod: "The simplified method in this beta can’t calculate it, so it stays held for review whatever else is entered here. Change the answer only if it is wrong.",
  category3: "Withdraw the line rather than completing it: nothing on this form makes a category 3 spend line count.",
  /**
   * WO-12b QA round 2: a replaced spend line. The supersession matches the line by its supplier name, by its mapping key
   * (GL account, supplier and description together), or both; correcting a field it matches on stops the replacement.
   */
  superseded: (name: string, match: "name" | "key" | "both", categories: readonly number[]) => {
    const cats = categories.length > 1 ? `${categories.slice(0, -1).join(", ")} or ${categories[categories.length - 1]}` : String(categories[0] ?? "")
    const clause = match === "name" ? "correct its Supplier" : match === "key" ? "correct its GL account, Supplier or Description (the replacement matches those three together)"
      : "correct its Supplier (the replacement matches the supplier name, and also the GL account, Supplier and Description together)"
    return `If this line isn’t one of ${name}’s purchases, ${clause}; if it isn’t a category ${cats} purchase, correct its Category. Any of these stops the replacement, and the labels below then apply as shown. Otherwise each purchase is counted once: to count this line instead, open ${name} and change “Spend lines this record replaces” there, or withdraw ${name}.`
  },
} as const

/** Answers as the notice quotes them. */
export const RECORD_HOLD_ANSWER_TEXT = {
  yes: "Yes",
  no: "No",
  category: (category: number) => `category ${category}`,
  lease: (lease: string, category: number) => `${lease}, category ${category}`,
  leaseUnder: (lease: string, category: number, approach: string) => `${lease}, category ${category}, under ${approach} in company setup`,
} as const

/** Company setup's words for its consolidation approaches and an entity's control. */
export const SETUP_APPROACH_WORDS: Readonly<Record<string, string>> = { operational_control: "operational control", financial_control: "financial control", equity_share: "equity share", unknown: "not chosen", none: "no control identified" }
const SETUP_ENTITIES = "03 Entities & boundary", SETUP_LOCATIONS = "04 Locations", SETUP_PERIOD = "02 Reporting period"

/**
 * WO-12b QA round 1: the holds company setup decides. A company-level hold holds every record of a scope whatever is
 * entered (`step`: where in company setup it is decided); a site-level hold holds every record at the chosen site. Each
 * says what holds the record without implying the person did something wrong, then the server's own text
 * (`reasonText`), then what to do instead.
 */
export const SETUP_HOLD_TEXT = {
  link: "Open company setup",
  stepText: (step: string) => `See company setup, ${step}.`,
  company: {
    equity_share_not_supported: { cause: "Company setup’s consolidation approach is equity share, which holds every Scope 1 and 2 record, whatever is filled in here.",
      text: "These draft calculations don’t support equity-share allocation yet, so Scope 1 and 2 records are saved but not counted.", instead: "Nothing on this form changes that: the approach is chosen in company setup.", step: SETUP_ENTITIES },
    boundary_approach_unknown: { cause: "Company setup has no consolidation approach yet, which holds every Scope 1 and 2 record, whatever is filled in here.",
      text: "Scope 1 and 2 records are saved but not counted until company setup chooses its consolidation approach.", instead: null, step: SETUP_ENTITIES },
    reporting_period_unknown: { cause: "Company setup has no complete reporting period yet, which holds every Scope 1 and 2 record, whatever is filled in here.",
      text: "Scope 1 and 2 records are saved but not counted until company setup has a reporting period.", instead: null, step: SETUP_PERIOD },
    scope3_consolidation_approach_required: { cause: "Company setup has no consolidation approach yet, which holds every Scope 3 record, whatever is filled in here.",
      text: null, instead: null, step: SETUP_ENTITIES },
  },
  site: {
    location_excluded_by_company_setup: { phrase: () => "is excluded in company setup", instead: () => `Choose an included site if the activity belongs to one, or change the site’s inclusion in company setup (${SETUP_LOCATIONS}).`, step: SETUP_LOCATIONS },
    entity_excluded_by_company_setup: { phrase: () => "belongs to an entity that is excluded in company setup", instead: () => `Choose a site of an included entity if the activity belongs to one, or change the entity’s inclusion in company setup (${SETUP_ENTITIES}).`, step: SETUP_ENTITIES },
    entity_outside_control_boundary: { phrase: () => "belongs to an entity that company setup marks as outside the control boundary (no control identified)",
      instead: (approach: string) => `If the company does control that entity, change the entity’s control in company setup (${SETUP_ENTITIES}) to ${approach}; otherwise choose another site.`, step: SETUP_ENTITIES },
    entity_control_unresolved: { phrase: (approach: string, control: string) => `belongs to an entity whose control in company setup (${control}) isn’t the consolidation approach (${approach})`,
      instead: (approach: string) => `If ${approach} is right for that entity, change the entity’s control to it in company setup (${SETUP_ENTITIES}); otherwise choose another site.`, step: SETUP_ENTITIES },
    location_control_unresolved: { phrase: () => "has no confirmed controller of its equipment in company setup",
      instead: () => `In company setup (${SETUP_LOCATIONS}), answer “Who controls the equipment?” for the site with Reporting company, or Related entity with the site linked to that entity; otherwise choose another site.`, step: SETUP_LOCATIONS },
    location_inclusion_unknown: { phrase: () => "isn’t included or excluded in company setup yet", instead: () => `Decide the site’s inclusion in company setup (${SETUP_LOCATIONS}), or choose another site.`, step: SETUP_LOCATIONS },
    entity_inclusion_unknown: { phrase: () => "belongs to an entity that isn’t included or excluded in company setup yet", instead: () => `Decide the entity’s inclusion in company setup (${SETUP_ENTITIES}), or choose another site.`, step: SETUP_ENTITIES },
    location_coverage_unknown: { phrase: () => "has no complete coverage start and end in company setup", instead: () => `Complete the site’s “Coverage starts” and “Coverage ends” in company setup (${SETUP_LOCATIONS}).`, step: SETUP_LOCATIONS },
    location_entity_unresolved: { phrase: () => "is linked to an entity that company setup no longer has", instead: () => `Choose the site’s reporting entity again in company setup (${SETUP_LOCATIONS}), or choose another site.`, step: SETUP_LOCATIONS },
    boundary_metadata_unavailable: { phrase: () => "has boundary details this page couldn’t read", instead: () => "Reload the page.", step: null },
    location_not_in_current_setup: { phrase: () => "is no longer in company setup", instead: () => null, step: null },
  },
  /** The cause line of a site-level hold. */
  siteCause: (name: string, phrase: string) => `The site chosen (${name || "Unnamed location"}) ${phrase}, which holds this record, whatever else is filled in.`,
  /** What holds the record next, once the site's hold is fixed as the notice says. */
  then: (next: string) => `After that change, the record would still be held: ${next.replace(/, which holds this record, whatever else is filled in\./, ".")}`,
  /** The cause line of a spend line another record replaces. */
  supersededCause: (name: string) => `Another record replaces this spend line: ${name}.`,
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

/* eslint-disable @typescript-eslint/no-explicit-any -- test harness: runs a real component's source with injected hooks, no DOM. */
// BF1 (Claude, 14 October 2026): shared by bf1-regressions.test.tsx. Test-only; nothing in the app imports it.
// Same technique as StagingWorkspace.test.tsx: transpile the component, inject hooks and dependencies, drive props.
type Node = { type: unknown; props: Record<string, any>; children: any[] }

/**
 * Scope 3 package 2 (Claude, 26 October 2026): the components' new imports, as real implementations, so the existing
 * component tests keep working unchanged (including the save's client-side contract check, validateCollectionActivity, and
 * A-01's certificate claim count, instrumentEvidenceClaims). A test's own injections win. Scope 3 is off by default (a schema-28 server):
 * the collection overview reports no Scope 3 and Scope 3 results are "not switched on".
 */
async function scope3Defaults(injected: Record<string, unknown>): Promise<Record<string, unknown>> {
  const [collection, coverage, m71, language, results, panel, contract, adapter, assessmentApi, editor, texts, formDefaults, forms, recordForm, dataQuality, textsR2e, checklist, resultsText, naics, textsR2c, textsR3c, spendTarget, displayR3d, textsR3d, textsWo10, readiness] = await Promise.all([
    import("../../../../packages/neuvetra-database/src/scope3-collection"), import("../../../../packages/neuvetra-database/src/scope3-coverage"),
    import("../../../../packages/neuvetra-database/src/m71-contract"), import("@/lib/plain-language"), import("@/lib/scope3-results-api"), import("./Scope3Results"),
    import("../../../../packages/neuvetra-database/src/collection-contract"), import("../../../../packages/neuvetra-database/src/collection-engine-input"),
    import("@/lib/scope3-assessment-api"), import("./scope3/Scope3ScreeningEditor"), import("../../../../packages/neuvetra-database/src/scope3-text"),
    import("@/lib/scope3-form-defaults"), import("@/lib/scope3-forms"), import("./scope3/Scope3RecordForm"), import("./scope3/DataQualityEditor"),
    // Round 2 lane E: the new texts (scope3-text-r2e.ts) the screens use. Round 2 lane D: the checklist and Results texts.
    import("../../../../packages/neuvetra-database/src/scope3-text-r2e"), import("@/lib/scope3-checklist"), import("@/lib/scope3-results-text"),
    // Round 2 polish lane D: the NAICS search moved out of scope3-forms (lazy spend chunks only).
    import("@/lib/scope3-naics"),
    // Round 2c integration: the texts of the six walk items (amount labels, estimate basis, spend basis, reload, next step).
    import("@/lib/scope3-text-r2c"),
    // Round 3 lane C: the spend suggestion, date, currency, NAICS-edition and to-do texts.
    import("@/lib/scope3-text-r3c"), import("@/lib/spend-import-target"),
    // Round 3 lane D: the display rules and texts of decision 5 and the round-2 product findings (forms, Results, frozen view).
    import("@/lib/scope3-display-r3d"), import("@/lib/scope3-text-r3d"),
    // WO-10: the Activity form's field anatomy and error-summary texts.
    import("@/lib/activity-form-text-wo10"),
    // WO-04b: the one readiness the Overview, the navigation and Ask read.
    import("@/lib/readiness")])
  // WO-05b: the draft store (no sessionStorage under bun test, so nothing is kept unless a test injects storage).
  const drafts = await import("@/lib/draft-store")
  // WO-04b: completed writes recheck Scope 3 readiness (the real subscription; nothing writes in these tests unless they do).
  // WO-13: and a write's start says "Checking…" for Scope 3 at once.
  const { subscribeWrites, subscribeWriteActivity } = await import("@/lib/shared-get")
  // WO-04c: the Overview's "Add the assessment" asks Results to open that category.
  const assessmentTarget = await import("@/lib/scope3-assessment-target")
  // WO-12: the read-only texts, the three field labels and BF-08's save outcomes (and the setup ID check they name).
  const [wo12Text, fieldNeeds, setupContract, saveChecks] = await Promise.all([import("@/lib/wo12-text"), import("@/lib/field-needs-wo12"), import("../../../../packages/neuvetra-database/src/company-setup-contract"), import("@/lib/activity-save-checks")])
  const loadContext = injected.loadCollectionContext as ((...args: unknown[]) => Promise<unknown>) | undefined
  return {
    ...drafts, ...readiness, ...assessmentTarget, ...wo12Text, ...fieldNeeds, ...saveChecks, duplicateCompanySetupIds: setupContract.duplicateCompanySetupIds, subscribeWrites, subscribeWriteActivity, ...textsR2e, ...textsR2c, ...textsWo10, ...textsR3c, ...spendTarget, ...displayR3d, ...textsR3d, ...collection, CARB_PROPOSED_MANDATORY_CATEGORIES: coverage.CARB_PROPOSED_MANDATORY_CATEGORIES, SCOPE3_ENGINE_CATEGORIES: coverage.SCOPE3_ENGINE_CATEGORIES, SCOPE3_SETUP_CATEGORY_TOKENS: coverage.SCOPE3_SETUP_CATEGORY_TOKENS,
    validateCollectionActivity: contract.validateCollectionActivity, instrumentEvidenceClaims: adapter.instrumentEvidenceClaims, M71_CATEGORIES: m71.M71_CATEGORIES, SCOPE3_ACTIVITY_KINDS: language.SCOPE3_ACTIVITY_KINDS, unitLabel: language.unitLabel, sourceCategoryLabel: language.sourceCategoryLabel,
    Scope3ResultsApiError: results.Scope3ResultsApiError, loadScope3Results: async () => { throw new results.Scope3ResultsApiError("Scope 3 results are not available yet.", 503, "scope3_unavailable") },
    INITIAL_SCOPE3_STATE: results.INITIAL_SCOPE3_STATE, Scope3Panel: panel.Scope3Panel, Scope3ReportSection: panel.Scope3ReportSection,
    // I-04: company setup's category assessments. Off by default (a database below schema 30), as Scope 3 results are.
    Scope3AssessmentApiError: assessmentApi.Scope3AssessmentApiError, scope3DownstreamWarning: assessmentApi.scope3DownstreamWarning, scope3SetupCategoryNote: assessmentApi.scope3SetupCategoryNote,
    scope3SetupStatements: assessmentApi.scope3SetupStatements, Scope3ScreeningEditor: editor.Scope3ScreeningEditor, SCOPE3_ASSESSMENT_REASON_TEXT: texts.SCOPE3_ASSESSMENT_REASON_TEXT,
    loadScope3Assessments: async () => { throw new assessmentApi.Scope3AssessmentApiError("This Scope 3 feature needs database schema 30.", 503, "scope3_schema_30_required") },
    // I-08: the Activity screen's Scope 3 record forms, data-quality editor and their helpers (rendered as nodes, not run).
    SCOPE3_DISCLOSURE_TEXT: texts.SCOPE3_DISCLOSURE_TEXT, SCOPE3_RECORD_STATE_TEXT_I08: texts.SCOPE3_RECORD_STATE_TEXT_I08, ...formDefaults, ...forms, ...naics,
    Scope3RecordForm: recordForm.Scope3RecordForm, DataQualityEditor: dataQuality.DataQualityEditor,
    // I-09: the spend import panel (rendered as a node; its own test drives it).
    SpendImport: () => null,
    // Round 2 lane D: Results renders the Scope 3 panel through its stateful wrapper (a node here), and names the Scope 3 to-do count.
    Scope3ResultsPanel: panel.Scope3Panel, scope3Todos: checklist.scope3Todos, SCOPE3_ATTENTION_LINK_TEXT: resultsText.SCOPE3_ATTENTION_LINK_TEXT,
    // Round 2 polish lane D: company setup prefills a new assessment from the category's answer.
    scope3AssessmentPrefill: checklist.scope3AssessmentPrefill, SCOPE3_PREFILL_TEXT: resultsText.SCOPE3_PREFILL_TEXT, scope3ExcludableNotesFor: checklist.scope3ExcludableNotesFor,
    // Round 2 lane D (UX-3): the record editor focuses the field a Fix names once it shows the record.
    focusRecordEditor: () => null,
    // WO-06: whether a Fix named fields of the record the record view opens (none in these tests).
    hasRecordFieldFocus: () => false,
    saveScope3Assessment: async () => { throw new assessmentApi.Scope3AssessmentApiError("Scope 3 assessments are unavailable right now.", 503, "scope3_schema_30_required") },
    ...(loadContext ? { loadCollectionOverview: async (...args: unknown[]) => ({ context: await loadContext(...args), scope3: false, scope3Kinds: [], scope3Completion: false }) } : {}),
  }
}

export async function loadComponent(file: string, name: string, injectedByTest: Record<string, unknown>) {
  const injected = { ...await scope3Defaults(injectedByTest), ...injectedByTest }
  const source = await Bun.file(new URL(file, import.meta.url)).text()
  const body = source.replace(/^import [\s\S]*?from "[^"]+"\n/gm, "").replace(/^export (function|const|async function)/gm, "$1").replace(/^export type .*\n/gm, "")
  const script = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h", jsxFragmentFactory: "Fragment" } } }).transformSync(body) + `\nreturn ${name}`
  return (hooks: Record<string, unknown>) => {
    const all = { ...injected, ...hooks }
    return new Function(...Object.keys(all), script)(...Object.values(all)) as (props: unknown) => Node
  }
}

export function harness(make: (hooks: Record<string, unknown>) => (props: unknown) => Node, props: () => Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const slots: any[] = [], pending: Array<() => void> = []
  let cursor = 0, changed = false, tree: Node
  const same = (a?: unknown[], b?: unknown[]) => a?.length === b?.length && a?.every((value, index) => Object.is(value, b?.[index]))
  function useState(initial: any) {
    const index = cursor++
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
    return [slots[index], (next: any) => { const value = typeof next === "function" ? next(slots[index]) : next; if (!Object.is(value, slots[index])) { slots[index] = value; changed = true } }]
  }
  function useRef(initial: any) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }) }
  function useCallback(fn: any, deps: unknown[]) { const index = cursor++, previous = slots[index]; if (!previous || !same(previous.deps, deps)) slots[index] = { fn, deps }; return slots[index].fn }
  function useMemo(fn: any, deps: unknown[]) { const index = cursor++, previous = slots[index]; if (!previous || !same(previous.deps, deps)) slots[index] = { value: fn(), deps }; return slots[index].value }
  function useEffect(effect: () => void | (() => void), deps?: unknown[]) {
    const index = cursor++, previous = slots[index]
    if (!previous || !deps || !same(previous.deps, deps)) pending.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() } })
  }
  function useReducer(reducer: any, initial: any) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (action: any) => { const value = reducer(slots[index], action); if (!Object.is(value, slots[index])) { slots[index] = value; changed = true } }] }
  const h = (type: unknown, p: Record<string, any> | null, ...children: any[]): Node => ({ type, props: p ?? {}, children })
  const Component = make({ useState, useRef, useCallback, useMemo, useEffect, useReducer, h, Fragment: "fragment", React: { Fragment: "fragment" }, ...globals })
  function render() { cursor = 0; tree = Component(props()) }
  async function settle() {
    for (let pass = 0; pass < 200; pass++) {
      while (pending.length) pending.shift()!()
      await new Promise(resolve => setTimeout(resolve, 0))
      if (changed) { changed = false; render(); continue }
      if (!pending.length) return
    }
    throw new Error("did not settle")
  }
  function flatten(value: any): Node[] { return Array.isArray(value) ? value.flatMap(flatten) : value && typeof value === "object" && "type" in value ? [value, ...value.children.flat(Infinity).flatMap(flatten)] : [] }
  const nodes = () => flatten(tree)
  const text = () => nodes().flatMap(node => node.children.flat(Infinity).filter((item: unknown) => typeof item === "string" || typeof item === "number")).join(" ")
  const byLabel = (label: string) => nodes().find(node => node.props.label === label)
  const button = (label: string) => nodes().find(node => node.type === "button" && node.children.flat(Infinity).join("").includes(label))
  render()
  return { settle, nodes, text, byLabel, button, render }
}

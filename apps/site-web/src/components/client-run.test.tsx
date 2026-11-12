/* eslint-disable @typescript-eslint/no-explicit-any */
// Beta client run (Claude, 26 October 2026): what entering Codex's three test companies through the real web app showed.
// 1. A record the server would refuse (dates outside calendar 2025) says why and nothing is sent: the board's
//    clarification of 26 October keeps the pre-save rejection, with no record or emissions saved.
// 2. An activity the beta can't calculate (a hotel stay) can still be recorded under "Something else": it is saved with
//    the client's own words, its unit isn't normalized, and it is held as needing input, never counted as zero.
import { expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { reasonText } from "@/lib/plain-language"
import { CollectionApiError } from "@/lib/collection-api"
import { harness, loadComponent } from "./component-harness"

const W = "29700000-0000-4000-8000-000000000001", SETUP = "29700000-0000-4000-8000-0000000000aa", SITE = "29700000-0000-4000-8000-0000000000bb"
const context = { companyId: W, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [{ id: SITE, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, entity: null, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" }] }

async function workspace() {
  const sent: any[] = []
  const api = {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion,
    listCollectionActivities: async () => [], listCollectionEvidence: async () => [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3: true, scope3Kinds: ["transport", "waste", "business_travel", "employee_commuting"] }),
    // The server validates exactly like this (collection-routes.ts), so a captured request is one the server accepts.
    saveCollectionActivity: async (_c: string, _r: string, input: any) => { sent.push(input); validateCollectionSaveInput(input); throw new CollectionApiError("stop after capture", 500) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null, uploadCollectionEvidence: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  }
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", api)
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null }))
  await app.settle()
  return { app, sent }
}

test("a record dated outside calendar 2025 says why, and nothing is sent or saved", async () => {
  const { app, sent } = await workspace()
  app.byLabel("Company-setup location")!.props.onChange(SITE); await app.settle()
  app.byLabel("Gas account or meter ID")!.props.onChange("GAS-2024"); await app.settle()
  app.byLabel("Period start")!.props.onChange("2024-12-01"); await app.settle()
  app.byLabel("Last day covered")!.props.onChange("2024-12-31"); await app.settle()
  app.byLabel("Original quantity from source")!.props.onChange("100"); await app.settle()
  app.byLabel("Original unit as printed")!.props.onChange("therm"); await app.settle()
  await app.button("Save activity")!.props.onClick(); await app.settle()
  expect(sent).toHaveLength(0)
  // WO-10: Save stays on; the summary says nothing was saved and names the dates, which carry the error.
  expect(app.text()).toContain("Not saved. Fix this: Collection periods must fall inside calendar 2025.")
  expect(app.byLabel("Period start")!.props.error).toBe("Collection periods must fall inside calendar 2025.")
})

// I-05 (DESIGN A14, A27): the Scope 3 adapter now recognises a hotel stay saved this way (mode "hotel", room-nights as
// written) as the optional hotel line, waiting for its factor source (DESNZ), so the plan's reason is no longer "mode not
// an engine token" but "factor source not yet loaded". I-12h: the U.S. hotel table is loaded; the stay calculates once its
// country is known (its own, or its U.S. reporting location's), and this screen has no setup facts, so it asks for it.
// I-08: the screen shows that as its own state, "Waiting for a factor source" (not input needed: nothing needs to change),
// with the optional-activity sentence, and its unit rule accepts room-nights for a hotel as the adapter does.
test("a hotel stay is recorded under “Something else”: the client's words, no normalized unit; I-12h: held for its country when the screen doesn't know the location's", async () => {
  const { app, sent } = await workspace()
  app.button("Business travel (Scope 3)")!.props.onClick(); await app.settle()
  app.byLabel("Company-setup location")!.props.onChange(SITE); await app.settle()
  const source = app.nodes().find(node => node.props.label && /ID/.test(node.props.label) && typeof node.props.value === "string")!
  source.props.onChange("HOTEL-1"); await app.settle()
  app.byLabel("Amount (distance, or mass of waste)")!.props.onChange("10"); await app.settle()
  app.byLabel("Mode")!.props.onChange("hotel"); await app.settle()
  app.byLabel("Unit")!.props.onChange("room-night"); await app.settle()
  app.byLabel("Data quality")!.props.onChange("actual"); await app.settle()
  // Before saving, the screen already says it will be held, in plain words.
  const findings = app.nodes().find(node => Array.isArray(node.props.findings))!.props.findings.map((finding: any) => [finding.status, finding.reason])
  // I-12h: the hotel factor is loaded; this screen has no setup facts here (schema 29), so the stay's country is not known.
  expect(findings).toEqual([["input_needed", reasonText("hotel_country_required")]])
  await app.button("Save activity")!.props.onClick(); await app.settle()
  expect(sent).toHaveLength(1)
  expect(app.text()).toContain("stop after capture") // the contract accepted it
  const activity = sent[0].activity
  expect([activity.payload.mode, activity.quantity]).toEqual(["hotel", { originalValue: "10", originalUnit: "room-night", normalizedValue: null, normalizedUnit: null }])
})

test("“Something else” keeps the client's words, never an empty token, and shows them for editing", async () => {
  const make = await loadComponent("./CollectionWorkspace.tsx", "ChoiceOrOther", {})
  const h = (type: unknown, props: any, ...children: any[]) => ({ type, props: props ?? {}, children })
  const ChoiceOrOther = make({ h, Fragment: "fragment", React: { Fragment: "fragment" } })
  const changes: string[] = []
  const props = { label: "Mode", choices: [["air", "Air"], ["bus", "Bus"]] as const, placeholder: "Choose a mode", otherLabel: "Something else", describeLabel: "What was it?", onChange: (value: string) => changes.push(value) }
  const parts = (value: string) => (ChoiceOrOther({ ...props, value }) as any).children.flat(Infinity).filter(Boolean)
  // A supported value: the list shows it, with no description field.
  expect(parts("air").map((node: any) => [node.props.label, node.props.value])).toEqual([["Mode", "air"]])
  // An unsupported value: the list shows "Something else" and the description field holds the client's words.
  const [select, describe] = parts("hotel")
  expect([select.props.value, describe.props.label, describe.props.value]).toEqual(["__other__", "What was it?", "hotel"])
  expect(select.props.options.at(-1)).toEqual(["__other__", "Something else"])
  // Choosing "Something else" from empty starts a placeholder token; clearing the words never leaves an empty token.
  ;(parts("")[0] as any).props.onChange("__other__"); describe.props.onChange(""); describe.props.onChange("x".repeat(100)); select.props.onChange("bus")
  expect(changes).toEqual(["other", "other", "x".repeat(80), "bus"])
})

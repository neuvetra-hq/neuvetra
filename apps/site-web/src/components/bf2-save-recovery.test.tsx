/* eslint-disable @typescript-eslint/no-explicit-any */
// BF2 r2 (Claude, 25 October 2026): BF2-QA-01. A save refused because company setup moved on must recover without
// losing the draft. Drives the real Activity editor and the server's input validator (same technique as bf1-regressions).
import { expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { reasonText } from "@/lib/plain-language"
import { CollectionApiError } from "@/lib/collection-api"
import { harness, loadComponent } from "./component-harness"

const W = "29300000-0000-4000-8000-000000000001", A = "29300000-0000-4000-8000-0000000000aa", C = "29300000-0000-4000-8000-0000000000ac"
const SITE = "29300000-0000-4000-8000-0000000000bb", OTHER_SITE = "29300000-0000-4000-8000-0000000000bc"
const site = { id: SITE, name: "Depot", inclusion: "included", control: "reporting_company" }
const atA = { companyId: W, setupVersionId: A, setupRevision: 1, sameContentSetupVersionIds: [A], locations: [site] }

/**
 * `contexts` are returned by successive context reads; `refuse(input)` decides how the server answers a save:
 * a definite refusal (422), an uncertain failure (503) or success (the test stops there).
 */
async function editor(contexts: any[], refuse: (input: any) => CollectionApiError) {
  let reads = 0
  const submitted: any[] = []
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion,
    listCollectionActivities: async () => [], listCollectionEvidence: async () => [], listGridLossLineages: async () => [],
    loadCollectionContext: async () => contexts[Math.min(reads++, contexts.length - 1)],
    saveCollectionActivity: async (_c: string, _r: string, input: any) => { validateCollectionSaveInput(input); submitted.push(structuredClone(input)); throw refuse(input) },
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null, uploadCollectionEvidence: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, document: { getElementById: () => null }, requestAnimationFrame: () => 0,
  })
  const app = harness(make, () => ({ actor: { userId: "u", role: "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null }, onDirtyChange: () => {}, openRecordId: null, intro: null }))
  await app.settle()
  app.button("Road vehicle or vehicle group")!.props.onClick(); await app.settle()
  for (const [label, value] of [["Company-setup location", SITE], ["Vehicle or group ID", "VAN-BF2"], ["Fuel", "gasoline"], ["Vehicle type", "gasoline_passenger_car"]]) { app.byLabel(label)!.props.onChange(value); await app.settle() }
  const save = async () => { await app.button("Save activity")!.props.onClick(); await app.settle() }
  return { app, submitted, save, reads: () => reads }
}
const staleSetup = () => new CollectionApiError("current company setup location required; reload setup", 422)

test("BF2-QA-01: after an identical-content setup restore, the next save uses the current setup with the same location and edits", async () => {
  const restored = { ...atA, setupVersionId: C, setupRevision: 3, sameContentSetupVersionIds: [C, A] }
  const { app, submitted, save } = await editor([atA, restored], input => input.activity.setupVersionId === A ? staleSetup() : new CollectionApiError("reached the current setup", 422))
  await save()
  expect(app.text()).toContain("Your edits and location are kept")
  await save()
  expect(submitted.map(input => input.activity.setupVersionId)).toEqual([A, C])
  // The refused request is retired: the second save is a new request, not a replay of the refused one.
  expect(submitted[1].idempotencyKey).not.toBe(submitted[0].idempotencyKey)
  // Location and every edit are kept.
  expect(submitted[1].activity.locationId).toBe(SITE)
  expect({ ...submitted[1].activity, setupVersionId: A }).toEqual(submitted[0].activity)
})

test("control: a genuinely changed setup still asks for the location again, and the refused request is retired", async () => {
  const changed = { ...atA, setupVersionId: C, setupRevision: 3, sameContentSetupVersionIds: [C], locations: [{ ...site, id: OTHER_SITE, name: "New depot" }] }
  const { app, submitted, save } = await editor([atA, changed], staleSetup)
  await save()
  expect(app.text()).toContain("Company setup changed. Select a current location before retrying this save.")
  expect(app.byLabel("Company-setup location")!.props.value).toBe("")
  app.byLabel("Company-setup location")!.props.onChange(OTHER_SITE); await app.settle()
  await save()
  expect(submitted.map(input => [input.activity.setupVersionId, input.activity.locationId])).toEqual([[A, SITE], [C, OTHER_SITE]])
  expect(submitted[1].idempotencyKey).not.toBe(submitted[0].idempotencyKey)
})

test("control: an uncertain failure keeps the same request, so a retry cannot save twice", async () => {
  const { app, submitted, save } = await editor([atA], () => new CollectionApiError("Activity service unavailable.", 503))
  await save()
  expect(app.text()).toContain("Retry keeps the same save request.")
  await save()
  expect(submitted).toHaveLength(2)
  expect(submitted[1]).toEqual(submitted[0])
})

test("control: a definite refusal with the setup unchanged keeps today's behaviour (same request, its reason shown)", async () => {
  const { app, submitted, save, reads } = await editor([atA], () => new CollectionApiError("collection evidence unavailable", 422))
  await save()
  expect(app.text()).toContain("collection evidence unavailable Retry keeps the same save request.")
  await save()
  expect(submitted[1]).toEqual(submitted[0])
  expect(reads()).toBe(3)
})

/* eslint-disable @typescript-eslint/no-explicit-any */
// WO-05b: unsaved Activity and setup input survives a session end or a refresh, in this browser tab only.
// - Typing is kept a second after it stops (owners and admins only); a session end keeps it at once.
// - Nothing restores by itself: "Restore unsaved changes from <time>? [Restore] [Discard]". Restore brings the fields back,
//   unsaved (the leave guard counts them), with focus on the form's heading; Discard removes the draft.
// - A restored draft saves against the version it was based on: newer server data gives the existing conflict state.
// - A save attempt keeps its idempotency key with the draft, and restoring reuses that exact request.
// - A member stores and is offered nothing; a save removes the draft.
import { afterEach, beforeEach, expect, test } from "bun:test"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionSaveInput, withCurrentSetupVersion } from "../../../../packages/neuvetra-database/src/collection-contract"
import { planCollectionCalculation } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { reasonText } from "@/lib/plain-language"
import { CollectionApiError } from "@/lib/collection-api"
import { createSyntheticCompanySetup } from "../../../../packages/neuvetra-database/src/company-setup-fixture"
import { CompanySetupApiError, type CompanySetupSaveInput, type CompanySetupVersion, type CompanySetupView } from "@/lib/company-setup-api"
import { admitDrafts, clearAllDrafts, DRAFT_TEXT, draftKey, writeDraft } from "@/lib/draft-store"
import { harness, loadComponent } from "./component-harness"

const U = "29870000-0000-4000-8000-0000000000ee", W = "29870000-0000-4000-8000-000000000001", SETUP = "29870000-0000-4000-8000-0000000000aa", SITE = "29870000-0000-4000-8000-0000000000bb"
const R = "29870000-0000-4000-8000-000000000101", V1 = "29870000-0000-4000-8000-000000000201", V2 = "29870000-0000-4000-8000-000000000202"
const context = { companyId: W, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], locations: [{ id: SITE, name: "Plant", inclusion: "included", control: "reporting_company" }] }
const gasActivity = (value = "100") => ({ kind: "natural_gas", locationId: SITE, setupVersionId: SETUP, sourceId: "GAS-1", state: "active", withdrawalReason: null,
  quantity: { originalValue: value, originalUnit: "therm", normalizedValue: value, normalizedUnit: "therm" }, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2025-02-01" }, reference: "Bill 1", notes: "", evidenceIds: [], payload: { heatContent: null } })
/** The saved record at revision `revision` (version V1, or V2 at revision 2). */
const gas = (revision = 1, value = "100") => {
  const history = [{ id: V1, revision: 1, correctionReason: null, createdAt: "2026-11-01T00:00:00.000Z" }, ...(revision > 1 ? [{ id: V2, revision: 2, correctionReason: "Elsewhere", createdAt: "2026-11-02T00:00:00.000Z" }] : [])]
  return { id: R, companyId: W, kind: "natural_gas", history, currentVersion: { id: revision > 1 ? V2 : V1, recordId: R, companyId: W, revision, activity: gasActivity(value) } }
}
function memoryStorage() {
  const entries = new Map<string, string>()
  return { entries, get length() { return entries.size }, key: (i: number) => [...entries.keys()][i] ?? null, getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v) }, removeItem: (k: string) => { entries.delete(k) } }
}
let tab = memoryStorage()
beforeEach(() => { tab = memoryStorage() })
afterEach(() => clearAllDrafts(null))
const recordKey = draftKey({ userId: U, companyId: W, view: "activity", item: R })!
const keep = (fields: Record<string, unknown>, binding = { expectedRevision: 1, expectedVersionId: V1 }, sent: { idempotencyKey: string | null; request: Record<string, unknown> | null } = { idempotencyKey: null, request: null }) =>
  writeDraft(tab, { userId: U, companyId: W, view: "activity", item: R }, { fields, binding, ...sent })

async function workspace(records: any[], options: { role?: string; save?: (input: any) => Promise<any>; dirty?: boolean[]; focused?: string[] } = {}) {
  const role = options.role ?? "owner"
  const api = {
    deriveCollectionQuantity, planCollectionCalculation, reasonText, CollectionApiError, savedAgainstCurrentSetup, withCurrentSetupVersion, validateCollectionSaveInput,
    listCollectionActivities: async () => records, listCollectionEvidence: async () => [], listGridLossLineages: async () => [], loadCollectionContext: async () => context,
    loadCollectionOverview: async () => ({ context, scope3: false, scope3Kinds: [], scope3Completion: false }),
    saveCollectionActivity: async (_c: string, _r: string, input: any) => options.save ? options.save(input) : Promise.reject(new CollectionApiError("stop", 500)),
    downloadCollectionEvidence: async () => null, loadCollectionVersion: async () => null, lookupCollectionZip: async () => null, saveGridLossLineage: async () => null, uploadCollectionEvidence: async () => null,
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {}, scrollTo() {} }, requestAnimationFrame: (fn: () => void) => { fn(); return 0 },
    document: { getElementById: (id: string) => ({ focus: () => options.focused?.push(id), scrollIntoView() {}, closest: () => null }) },
    draftStorage: () => tab,
  }
  const make = await loadComponent("./CollectionWorkspace.tsx", "CollectionWorkspace", api)
  const heading = { current: { focus: () => options.focused?.push("h1") } }
  const onDirtyChange = (value: boolean) => options.dirty?.push(value)
  const app = harness(make, () => ({ actor: { userId: U, role, accessToken: "t" }, workspaceId: W, headingRef: heading, onDirtyChange, openRecordId: R, intro: null, onRecordMissing: () => {} }))
  await app.settle(); await new Promise(r => setTimeout(r, 5)); await app.settle()
  return app
}
const offerText = (app: Awaited<ReturnType<typeof workspace>>) => app.nodes().find(node => node.props.id === "collection-draft-offer")

test("typing a correction is kept a second after it stops, and only then; nothing is kept without a change", async () => {
  admitDrafts(tab, { userId: U, companyId: W, role: "owner" })
  const app = await workspace([gas()])
  app.button("Correct this record")!.props.onClick(); await app.settle()
  await new Promise(r => setTimeout(r, 1100)); await app.settle()
  expect(tab.entries.size).toBe(0)
  app.byLabel("Original quantity from source")!.props.onChange("120"); await app.settle()
  app.byLabel("Reason for this correction")!.props.onChange("Meter read again"); await app.settle()
  await new Promise(r => setTimeout(r, 500))
  expect(tab.entries.size).toBe(0)
  await new Promise(r => setTimeout(r, 700)); await app.settle()
  const stored = JSON.parse(tab.getItem(recordKey)!)
  expect(stored.fields.recordId).toBe(R)
  expect(stored.fields.activity.quantity.originalValue).toBe("120")
  expect(stored.fields.reason).toBe("Meter read again")
  expect(stored.binding).toEqual({ expectedRevision: 1, expectedVersionId: V1 })
  expect(stored.idempotencyKey).toBeNull()
})

test("the offer: nothing restores by itself; Restore brings the fields back unsaved, with focus on the form heading", async () => {
  admitDrafts(tab, { userId: U, companyId: W, role: "admin" })
  keep({ recordId: R, activity: gasActivity("130"), reason: "Meter read again" })
  const dirty: boolean[] = [], focused: string[] = []
  const app = await workspace([gas()], { role: "admin", dirty, focused })
  expect(offerText(app)!.children.join("")).toMatch(/^Restore unsaved changes from \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC\?$/)
  // Not restored yet: no form, no "Correct this record" while the offer waits, and nothing unsaved.
  expect(app.byLabel("Original quantity from source")).toBeUndefined()
  expect(app.button("Correct this record")).toBeUndefined()
  expect(dirty.at(-1)).toBe(false)
  expect(app.button(DRAFT_TEXT.discard)).toBeDefined()
  app.button(DRAFT_TEXT.restore)!.props.onClick(); await app.settle()
  expect(offerText(app)).toBeUndefined()
  expect(app.byLabel("Original quantity from source")!.props.value).toBe("130")
  expect(app.byLabel("Reason for this correction")!.props.value).toBe("Meter read again")
  // A restored draft is unsaved: the leave guard and the page-unload warning count it.
  expect(dirty.at(-1)).toBe(true)
  expect(focused).toContain("collection-editor-heading")
  expect(app.text()).toContain(DRAFT_TEXT.restored)
})

test("Discard removes the draft and puts focus on the record's heading", async () => {
  admitDrafts(tab, { userId: U, companyId: W, role: "owner" })
  keep({ recordId: R, activity: gasActivity("130"), reason: "" })
  const focused: string[] = []
  const app = await workspace([gas()], { focused })
  app.button(DRAFT_TEXT.discard)!.props.onClick(); await app.settle()
  expect(tab.entries.size).toBe(0)
  expect(offerText(app)).toBeUndefined()
  expect(focused.at(-1)).toBe("h1")
  expect(app.button("Correct this record")).toBeDefined()
})

test("QA-144: a draft based on an older revision saves against it, so newer server data gives the conflict state", async () => {
  admitDrafts(tab, { userId: U, companyId: W, role: "owner" })
  keep({ recordId: R, activity: gasActivity("130"), reason: "Meter read again" })
  const sent: any[] = []
  const app = await workspace([gas(2, "110")], { save: async input => { sent.push(input); throw new CollectionApiError("collection changed; reload before saving", 409) } })
  app.button(DRAFT_TEXT.restore)!.props.onClick(); await app.settle()
  app.button("Save correction")!.props.onClick(); await app.settle()
  expect(sent).toHaveLength(1)
  expect(sent[0].expectedRevision).toBe(1)
  expect(sent[0].expectedVersionId).toBe(V1)
  expect(app.text()).toContain("This record changed elsewhere. Reload before correcting it.")
  // Still unsaved and still kept, still bound to revision 1: a retry conflicts again, never overwrites.
  expect(JSON.parse(tab.getItem(recordKey)!).binding).toEqual({ expectedRevision: 1, expectedVersionId: V1 })
  app.button("Save correction")!.props.onClick(); await app.settle()
  expect(sent.map(input => input.expectedRevision)).toEqual([1, 1])
  expect(sent[1].idempotencyKey).not.toBe(sent[0].idempotencyKey)
})

test("a save attempt keeps its key with the draft; restoring reuses the exact request, and a saved version removes the draft", async () => {
  admitDrafts(tab, { userId: U, companyId: W, role: "owner" })
  const sent: any[] = []
  let answer: (input: any) => Promise<any> = async () => { throw new CollectionApiError("Neuvetra didn’t answer in time.", 0) }
  const first = await workspace([gas()], { save: input => { sent.push(input); return answer(input) } })
  first.button("Correct this record")!.props.onClick(); await first.settle()
  first.byLabel("Original quantity from source")!.props.onChange("140"); await first.settle()
  first.byLabel("Reason for this correction")!.props.onChange("Meter read again"); await first.settle()
  first.button("Save correction")!.props.onClick(); await first.settle()
  const stored = JSON.parse(tab.getItem(recordKey)!)
  expect(stored.idempotencyKey).toBe(sent[0].idempotencyKey)
  expect(stored.request).toEqual({ expectedRevision: 1, expectedVersionId: V1, correctionReason: "Meter read again", activity: sent[0].activity })

  // The session ended; the same person signs in again on this tab and restores.
  const saved = { ...gas(2, "140"), history: [...gas().history, { id: V2, revision: 2, correctionReason: "Meter read again", createdAt: "2026-11-12T00:00:00.000Z" }] }
  answer = async input => ({ record: saved, version: { ...saved.currentVersion, id: V2 }, replayed: input.idempotencyKey === sent[0].idempotencyKey })
  const again = await workspace([gas()], { save: input => { sent.push(input); return answer(input) } })
  again.button(DRAFT_TEXT.restore)!.props.onClick(); await again.settle()
  again.button("Save correction")!.props.onClick(); await again.settle()
  expect(sent).toHaveLength(2)
  expect(sent[1]).toEqual(sent[0])
  expect(tab.entries.size).toBe(0)
})

test("a member stores nothing and is offered nothing; another user's draft is never read", async () => {
  admitDrafts(tab, { userId: U, companyId: W, role: "owner" })
  keep({ recordId: R, activity: gasActivity("130"), reason: "" })
  // The same person, now a member: the activation removed every draft (admitDrafts), and the screen offers none.
  admitDrafts(tab, { userId: U, companyId: W, role: "member" })
  expect(tab.entries.size).toBe(0)
  const app = await workspace([gas()], { role: "member" })
  expect(offerText(app)).toBeUndefined()
  // A draft written behind its back (by another user, say) is neither offered nor kept.
  tab.setItem(recordKey, JSON.stringify({ savedAt: Date.now(), expiresAt: Date.now() + 86_400_000, fields: { recordId: R, activity: gasActivity("999"), reason: "" }, binding: { expectedRevision: 1, expectedVersionId: V1 }, idempotencyKey: null, request: null }))
  const again = await workspace([gas()], { role: "member" })
  expect(offerText(again)).toBeUndefined()
})

test("a draft for a record that no longer exists goes with it", async () => {
  admitDrafts(tab, { userId: U, companyId: W, role: "owner" })
  keep({ recordId: R, activity: gasActivity("130"), reason: "" })
  const app = await workspace([])
  expect(offerText(app)).toBeUndefined()
  expect(tab.entries.size).toBe(0)
})

// --- Company setup drafts ---

const S1 = "29870000-0000-4000-8000-000000000301", S2 = "29870000-0000-4000-8000-000000000302"
const setupKey = draftKey({ userId: U, companyId: W, view: "setup" })!
function setupView(revision = 1, legalName = "Synthetic Bayline"): CompanySetupView {
  const setup = createSyntheticCompanySetup(); setup.company.legalName = legalName
  const version = (id: string, rev: number): CompanySetupVersion => ({ id, companyId: W, revision: rev, previousVersionId: rev > 1 ? S1 : null, correctionReason: rev > 1 ? "Elsewhere" : null, payloadSha256: "c".repeat(64), createdBy: U, createdAt: "2025-06-01T00:00:00.000Z", setup })
  const history = revision > 1 ? [version(S1, 1), version(S2, 2)] : [version(S1, 1)]
  return { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, currentVersion: history.at(-1)!, history } as CompanySetupView
}
async function setupScreen(view: CompanySetupView, options: { role?: string; save?: (input: CompanySetupSaveInput) => Promise<any>; focused?: string[] } = {}) {
  const make = await loadComponent("./CompanySetup.tsx", "CompanySetup", {
    CompanySetupApiError, loadCompanySetup: async () => structuredClone(view), loadCompanySetupVersion: async () => null,
    saveCompanySetup: async (_company: string, input: CompanySetupSaveInput) => options.save ? options.save(input) : Promise.reject(new Error("stop")),
    window: { confirm: () => true }, draftStorage: () => tab, requestAnimationFrame: (fn: () => void) => { fn(); return 0 },
    document: { getElementById: (id: string) => ({ focus: () => options.focused?.push(id) }) },
  })
  const app = harness(make, () => ({ actor: { userId: U, role: options.role ?? "owner", accessToken: "t" }, workspaceId: W, headingRef: { current: null } }))
  await app.settle()
  return app
}

test("setup: typing is kept after a second; the offer restores the fields and the section, unsaved, with focus on the form heading", async () => {
  admitDrafts(tab, { userId: U, companyId: W, role: "owner" })
  const first = await setupScreen(setupView())
  first.byLabel("Legal name")!.props.onChange("Synthetic Bayline Holdings"); await first.settle()
  first.button("07 Review")!.props.onClick(); await first.settle()
  first.byLabel("Reason for this correction")!.props.onChange("Renamed"); await first.settle()
  await new Promise(r => setTimeout(r, 1100)); await first.settle()
  const stored = JSON.parse(tab.getItem(setupKey)!)
  expect(stored.fields.setup.company.legalName).toBe("Synthetic Bayline Holdings")
  expect([stored.fields.reason, stored.fields.step]).toEqual(["Renamed", 6])
  expect(stored.binding).toEqual({ expectedRevision: 1, expectedVersionId: S1 })

  const focused: string[] = []
  const again = await setupScreen(setupView(), { focused })
  expect(again.nodes().find(node => node.props.id === "setup-draft-offer")!.children.join("")).toMatch(/^Restore unsaved changes from .+ UTC\?$/)
  expect(again.byLabel("Legal name")!.props.value).toBe("Synthetic Bayline")
  again.button(DRAFT_TEXT.restore)!.props.onClick(); await again.settle()
  expect(again.byLabel("Reason for this correction")!.props.value).toBe("Renamed")
  again.button("01 Company")!.props.onClick(); await again.settle()
  expect(again.byLabel("Legal name")!.props.value).toBe("Synthetic Bayline Holdings")
  expect(focused).toEqual(["setup-form-heading"])
})

test("setup QA-144: a restored draft saves against its own version, so a newer setup gives the conflict state; Discard removes it", async () => {
  admitDrafts(tab, { userId: U, companyId: W, role: "admin" })
  const old = setupView()
  writeDraft(tab, { userId: U, companyId: W, view: "setup" }, { fields: { setup: { ...old.currentVersion!.setup, company: { ...old.currentVersion!.setup.company, legalName: "Mine" } }, reason: "Mine", step: 6 }, binding: { expectedRevision: 1, expectedVersionId: S1 }, idempotencyKey: null, request: null })
  const sent: CompanySetupSaveInput[] = []
  const app = await setupScreen(setupView(2, "Theirs"), { role: "admin", save: async input => { sent.push(input); throw new CompanySetupApiError("setup changed", 409) } })
  app.button(DRAFT_TEXT.restore)!.props.onClick(); await app.settle()
  app.button("Save correction")!.props.onClick(); await app.settle()
  expect(sent.map(input => [input.expectedRevision, input.expectedVersionId])).toEqual([[1, S1]])
  expect(app.text()).toContain("This setup changed elsewhere. Refresh the latest version before correcting it.")

  const other = await setupScreen(setupView(2, "Theirs"), { role: "admin" })
  other.button(DRAFT_TEXT.discard)!.props.onClick(); await other.settle()
  expect(tab.entries.size).toBe(0)
  expect(other.byLabel("Legal name")!.props.value).toBe("Theirs")
})

test("setup: a member stores and is offered nothing", async () => {
  admitDrafts(tab, { userId: U, companyId: W, role: "member" })
  const view = { ...setupView(), canManage: false }
  const app = await setupScreen(view, { role: "member" })
  expect(app.nodes().find(node => node.props.id === "setup-draft-offer")).toBeUndefined()
  expect(tab.entries.size).toBe(0)
})

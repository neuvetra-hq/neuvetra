import { describe, expect, test } from "bun:test"
import { m80LoadIsCurrent, m80SetupPermissions, prioritizeM80Eligibility } from "@/lib/m80-beta-ui-state"
import type { M80FoundationView } from "@/lib/m80-beta-api"

describe("Scope1BetaSetup state boundaries", () => {
  test("server authority keeps a member view-only even while correction state is requested", () => {
    const view = { canManage: false, currentVersion: { revision: 1 } } as unknown as Pick<M80FoundationView, "canManage" | "currentVersion">
    expect(m80SetupPermissions(view, true, true)).toEqual({ canManage: false, canEdit: false, showCorrection: false })
  })

  test("permits a first save and an explicit successor correction only for server-authorized managers", () => {
    const initial = { canManage: true, currentVersion: null } as Pick<M80FoundationView, "canManage" | "currentVersion">
    expect(m80SetupPermissions(initial, false, true)).toEqual({ canManage: true, canEdit: true, showCorrection: false })
    const saved = { canManage: true, currentVersion: { revision: 1 } } as unknown as Pick<M80FoundationView, "canManage" | "currentVersion">
    expect(m80SetupPermissions(saved, false, true)).toEqual({ canManage: true, canEdit: false, showCorrection: true })
    expect(m80SetupPermissions(saved, true, true).canEdit).toBe(true)
  })

  test("prioritizes missing facts ahead of unsupported and held profiles without combining counts", () => {
    const result = (state: "held_candidate" | "unsupported" | "missing_facts", sourceId: string) => ({ state, sourceId }) as M80FoundationView["eligibility"]["results"][number]
    const ranked = prioritizeM80Eligibility([result("held_candidate", "held"), result("unsupported", "unsupported"), result("missing_facts", "missing")])
    expect(ranked.map(item => item.sourceId)).toEqual(["missing", "unsupported", "held"])
    expect(ranked.filter(item => item.state === "unsupported")).toHaveLength(1)
    expect(ranked.filter(item => item.state === "held_candidate")).toHaveLength(1)
  })

  test("drops stale loads after an actor or workspace switch and after abort", () => {
    expect(m80LoadIsCurrent("actor-a:workspace-a", "actor-b:workspace-a", false)).toBe(false)
    expect(m80LoadIsCurrent("actor-a:workspace-a", "actor-a:workspace-b", false)).toBe(false)
    expect(m80LoadIsCurrent("actor-a:workspace-a", "actor-a:workspace-a", true)).toBe(false)
    expect(m80LoadIsCurrent("actor-a:workspace-a", "actor-a:workspace-a", false)).toBe(true)
  })
})

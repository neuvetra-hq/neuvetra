import { describe, expect, test } from "bun:test"
import { m80LoadIsCurrent, prioritizeM80Eligibility } from "@/lib/m80-beta-ui-state"
import type { M80FoundationView } from "@/lib/m80-beta-api"

describe("Scope1BetaSetup state boundaries", () => {
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

import { describe, expect, test } from "bun:test"
import { createActor } from "xstate"
import { sceneMachine } from "./scene.actor"

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe("sceneMachine", () => {
  test("starts idle with no active scene", () => {
    const actor = createActor(sceneMachine).start()
    expect(actor.getSnapshot().value).toBe("idle")
    expect(actor.getSnapshot().context.active).toBeNull()
  })

  test("ACTIVATE puts the scene in the 'active' state with the supplied id + props", () => {
    const actor = createActor(sceneMachine).start()
    actor.send({
      type: "ACTIVATE",
      scenarioId: "collect_otp_verification",
      component: "otp_input",
      props: { phone: "+15551234567" },
    })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("active")
    expect(snap.context.active).toEqual({
      scenarioId: "collect_otp_verification",
      component: "otp_input",
      props: { phone: "+15551234567" },
    })
  })

  test("DEACTIVATE clears the active scene and returns to idle", () => {
    const actor = createActor(sceneMachine).start()
    actor.send({ type: "ACTIVATE", scenarioId: "x", component: "y", props: {} })
    actor.send({ type: "DEACTIVATE" })
    expect(actor.getSnapshot().value).toBe("idle")
    expect(actor.getSnapshot().context.active).toBeNull()
  })

  test("DONE event with output emits SCENARIO_DONE upward and returns to idle", async () => {
    const actor = createActor(sceneMachine).start()
    const received: Array<{ type: string; scenarioId: string; output: unknown }> = []
    actor.on("SCENARIO_DONE", (ev) =>
      received.push(ev as { type: string; scenarioId: string; output: unknown }),
    )

    actor.send({
      type: "ACTIVATE",
      scenarioId: "collect_otp_verification",
      component: "otp_input",
      props: {},
    })
    actor.send({ type: "DONE", output: { authenticated: true } })
    await flush()

    expect(received).toEqual([
      {
        type: "SCENARIO_DONE",
        scenarioId: "collect_otp_verification",
        output: { authenticated: true },
      },
    ])
    expect(actor.getSnapshot().value).toBe("idle")
    expect(actor.getSnapshot().context.active).toBeNull()
  })
})

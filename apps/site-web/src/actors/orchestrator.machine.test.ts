import { describe, expect, test } from "bun:test"
import { createActor } from "xstate"
import { orchestratorMachine } from "./orchestrator.machine"
import type { ChatMessage, ChatToolCall, StreamChatCallbacks } from "@/lib/api"

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

/** Builds a streamChat fake whose body the test drives explicitly. */
function makeStream(
  body: (cbs: StreamChatCallbacks) => Promise<void> | void,
) {
  return async (_messages: ChatMessage[], cbs: StreamChatCallbacks) => {
    await body(cbs)
  }
}

describe("orchestratorMachine", () => {
  test("appends user message immediately, transitions to sending", async () => {
    const streamChat = makeStream(async () => {
      // Never resolves during this assertion — we want to catch the in-flight state.
      await new Promise(() => {})
    })
    const actor = createActor(orchestratorMachine, { input: { streamChat } }).start()

    actor.send({ type: "USER_MESSAGE", content: "hi" })

    expect(actor.getSnapshot().context.messages).toEqual([
      { role: "user", content: "hi" },
    ])
    expect(actor.getSnapshot().value).toBe("sending")
  })

  test("upserts the assistant message as TEXT_UPDATE arrives, returns to idle on STREAM_DONE", async () => {
    const streamChat = makeStream(async (cbs) => {
      cbs.onTextUpdate("Hi")
      cbs.onTextUpdate("Hi there")
      cbs.onTextUpdate("Hi there — Neuvetra has two products.")
    })
    const actor = createActor(orchestratorMachine, { input: { streamChat } }).start()

    actor.send({ type: "USER_MESSAGE", content: "hello" })
    await flush()
    await flush() // give STREAM_DONE a chance to land after the awaited body resolves

    expect(actor.getSnapshot().value).toBe("idle")
    expect(actor.getSnapshot().context.messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "Hi there — Neuvetra has two products." },
    ])
  })

  test("emits TOOL_CALL once per tool call as it arrives", async () => {
    const streamChat = makeStream(async (cbs) => {
      cbs.onTextUpdate("Moving the spirit up...")
      cbs.onToolCall({ id: "c1", name: "move_spirit", input: { direction: "up" } })
      cbs.onTextUpdate("Done.")
      cbs.onToolCall({ id: "c2", name: "set_spirit_color", input: { color: "red" } })
    })
    const actor = createActor(orchestratorMachine, { input: { streamChat } }).start()

    const received: Array<{ toolCall: ChatToolCall }> = []
    actor.on("TOOL_CALL", (ev) => received.push(ev as { toolCall: ChatToolCall }))

    actor.send({ type: "USER_MESSAGE", content: "move spirit up then turn red" })
    await flush()
    await flush()

    expect(received.map((r) => r.toolCall)).toEqual([
      { id: "c1", name: "move_spirit", input: { direction: "up" } },
      { id: "c2", name: "set_spirit_color", input: { color: "red" } },
    ])
  })

  test("sets error and returns to idle when the stream throws mid-flight", async () => {
    const streamChat = makeStream(async () => {
      throw new Error("connection reset")
    })
    const actor = createActor(orchestratorMachine, { input: { streamChat } }).start()

    actor.send({ type: "USER_MESSAGE", content: "hi" })
    await flush()
    await flush()

    expect(actor.getSnapshot().value).toBe("idle")
    expect(actor.getSnapshot().context.error).toBe("connection reset")
    // User message was appended; assistant message was never started.
    expect(actor.getSnapshot().context.messages).toEqual([
      { role: "user", content: "hi" },
    ])
  })

  test("trims user message content before storing", async () => {
    const streamChat = makeStream(async (cbs) => {
      cbs.onTextUpdate("ok")
    })
    const actor = createActor(orchestratorMachine, { input: { streamChat } }).start()

    actor.send({ type: "USER_MESSAGE", content: "  hello  " })

    expect(actor.getSnapshot().context.messages[0]?.content).toBe("hello")
  })

  test("emits SCENARIO_ACTIVATE when streamChat reports a scenario directive via onScenarioActivate", async () => {
    const streamChat = makeStream(async (cbs) => {
      cbs.onScenarioActivate({
        id: "collect_otp_verification",
        props: { phone: "+15551234567" },
      })
    })
    const actor = createActor(orchestratorMachine, { input: { streamChat } }).start()
    const received: Array<{ activate: { id: string; props: Record<string, unknown> } }> = []
    actor.on("SCENARIO_ACTIVATE", (ev) =>
      received.push(ev as { activate: { id: string; props: Record<string, unknown> } }),
    )

    actor.send({ type: "USER_MESSAGE", content: "my phone is +15551234567" })
    await flush()
    await flush()

    expect(received).toHaveLength(1)
    expect(received[0]?.activate).toEqual({
      id: "collect_otp_verification",
      props: { phone: "+15551234567" },
    })
  })
})
